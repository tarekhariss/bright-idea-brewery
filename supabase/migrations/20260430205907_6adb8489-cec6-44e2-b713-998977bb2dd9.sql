-- Worker run diagnostics
CREATE TABLE IF NOT EXISTS public.linkedin_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  claimed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  blocked integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text
);
ALTER TABLE public.linkedin_worker_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_worker_runs_select ON public.linkedin_worker_runs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_li_worker_runs_started ON public.linkedin_worker_runs (started_at DESC);

-- Atomic claim: pick due actions, set status=pending->scheduled handled by worker; we use a SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.linkedin_claim_due_actions(_limit integer DEFAULT 20)
RETURNS SETOF public.linkedin_action_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.linkedin_action_queue
    WHERE status IN ('pending','scheduled')
      AND (scheduled_at IS NULL OR scheduled_at <= now())
    ORDER BY priority ASC, scheduled_at ASC NULLS FIRST
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.linkedin_action_queue q
  SET status = 'scheduled', updated_at = now()
  FROM due
  WHERE q.id = due.id
  RETURNING q.*;
END $$;

-- Mark a single action as blocked with reason (used when no adapter)
CREATE OR REPLACE FUNCTION public.linkedin_block_action(_queue_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.linkedin_action_queue
  SET status = 'blocked', error_message = _reason, updated_at = now()
  WHERE id = _queue_id;
END $$;

-- Record final result of an action attempt and cascade state updates
CREATE OR REPLACE FUNCTION public.linkedin_record_action_result(
  _queue_id uuid,
  _outcome text,                -- 'success' | 'failure' | 'retry'
  _provider_response jsonb DEFAULT '{}'::jsonb,
  _error text DEFAULT NULL,
  _max_retries integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q record;
  v_lead_id uuid;
  v_new_status linkedin_queue_status;
  v_retry int;
BEGIN
  SELECT * INTO v_q FROM public.linkedin_action_queue WHERE id = _queue_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'queue row missing'); END IF;

  v_lead_id := NULLIF(v_q.payload->>'lead_id','')::uuid;

  IF _outcome = 'success' THEN
    v_new_status := 'completed';
    UPDATE public.linkedin_action_queue
      SET status = v_new_status, executed_at = now(), error_message = NULL,
          payload = COALESCE(payload,'{}'::jsonb) || jsonb_build_object('provider_response', _provider_response),
          updated_at = now()
      WHERE id = _queue_id;

    INSERT INTO public.linkedin_action_history
      (linkedin_account_id, contact_id, campaign_id, action_type, status, result, metadata, executed_at, workspace_id)
    VALUES
      (v_q.linkedin_account_id, v_q.contact_id, v_q.campaign_id, v_q.action_type,
       'completed', 'ok', _provider_response, now(), v_q.workspace_id);

    -- Contact state: refresh last activity and connection status if relevant
    INSERT INTO public.linkedin_contact_state
      (workspace_id, contact_id, linkedin_account_id, connection_status, last_li_activity_at, last_li_action_type)
    VALUES (
      v_q.workspace_id, v_q.contact_id, v_q.linkedin_account_id,
      CASE
        WHEN v_q.action_type::text = 'connect' THEN 'pending'
        WHEN v_q.action_type::text = 'message' THEN 'connected'
        ELSE 'not_connected'
      END,
      now(), v_q.action_type::text
    )
    ON CONFLICT (workspace_id, contact_id) DO UPDATE
      SET linkedin_account_id = EXCLUDED.linkedin_account_id,
          last_li_activity_at = EXCLUDED.last_li_activity_at,
          last_li_action_type = EXCLUDED.last_li_action_type,
          connection_status = CASE
            WHEN v_q.action_type::text = 'connect' AND linkedin_contact_state.connection_status = 'not_connected'
              THEN 'pending'
            WHEN v_q.action_type::text = 'message' THEN 'connected'
            ELSE linkedin_contact_state.connection_status
          END,
          updated_at = now();

    -- Lead progression
    IF v_lead_id IS NOT NULL THEN
      UPDATE public.linkedin_campaign_leads
        SET last_action_at = now(),
            last_action_type = v_q.action_type::text,
            updated_at = now()
        WHERE id = v_lead_id;
      PERFORM public.linkedin_schedule_next_action(v_lead_id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'completed');

  ELSIF _outcome = 'retry' THEN
    v_retry := COALESCE(v_q.retry_count, 0) + 1;
    IF v_retry >= _max_retries THEN
      UPDATE public.linkedin_action_queue
        SET status = 'failed', retry_count = v_retry, error_message = _error,
            executed_at = now(), updated_at = now()
        WHERE id = _queue_id;
      INSERT INTO public.linkedin_action_history
        (linkedin_account_id, contact_id, campaign_id, action_type, status, result, error_message, metadata, executed_at, workspace_id)
      VALUES
        (v_q.linkedin_account_id, v_q.contact_id, v_q.campaign_id, v_q.action_type,
         'failed', 'error', _error, _provider_response, now(), v_q.workspace_id);
      RETURN jsonb_build_object('ok', false, 'status', 'failed', 'reason', _error);
    ELSE
      -- Exponential backoff: 5min * 2^(retry-1)
      UPDATE public.linkedin_action_queue
        SET status = 'pending', retry_count = v_retry, error_message = _error,
            scheduled_at = now() + (5 * power(2, v_retry - 1) || ' minutes')::interval,
            updated_at = now()
        WHERE id = _queue_id;
      RETURN jsonb_build_object('ok', false, 'status', 'retry', 'attempt', v_retry);
    END IF;

  ELSE  -- failure (terminal)
    UPDATE public.linkedin_action_queue
      SET status = 'failed', retry_count = COALESCE(retry_count,0) + 1,
          error_message = _error, executed_at = now(), updated_at = now()
      WHERE id = _queue_id;
    INSERT INTO public.linkedin_action_history
      (linkedin_account_id, contact_id, campaign_id, action_type, status, result, error_message, metadata, executed_at, workspace_id)
    VALUES
      (v_q.linkedin_account_id, v_q.contact_id, v_q.campaign_id, v_q.action_type,
       'failed', 'error', _error, _provider_response, now(), v_q.workspace_id);
    RETURN jsonb_build_object('ok', false, 'status', 'failed', 'reason', _error);
  END IF;
END $$;

-- Aggregated diagnostics view (admin only via worker_runs RLS / hook fetches)
CREATE OR REPLACE VIEW public.linkedin_queue_health_v
WITH (security_invoker = true) AS
SELECT
  workspace_id,
  status::text AS status,
  COUNT(*)::int AS count,
  MIN(scheduled_at) AS oldest_scheduled_at,
  MAX(updated_at) AS last_updated_at
FROM public.linkedin_action_queue
GROUP BY workspace_id, status;

GRANT EXECUTE ON FUNCTION public.linkedin_claim_due_actions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.linkedin_block_action(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.linkedin_record_action_result(uuid, text, jsonb, text, integer) TO service_role;