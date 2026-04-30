
-- ============ Execution adapters registry ============
CREATE TABLE IF NOT EXISTS public.linkedin_execution_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'unipile' | 'heyreach' | 'phantombuster' | 'internal_extension' | 'custom_webhook'
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb, -- non-sensitive config (account ids, urls, etc.)
  credentials_secret_name text, -- the name of a Supabase secret holding the API key
  last_health_at timestamptz,
  health_status text NOT NULL DEFAULT 'unknown', -- 'healthy' | 'degraded' | 'down' | 'unknown'
  health_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_li_exec_adapters_ws ON public.linkedin_execution_adapters(workspace_id);
ALTER TABLE public.linkedin_execution_adapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "li_exec_adapters_read" ON public.linkedin_execution_adapters;
CREATE POLICY "li_exec_adapters_read" ON public.linkedin_execution_adapters FOR SELECT TO authenticated
USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "li_exec_adapters_write" ON public.linkedin_execution_adapters;
CREATE POLICY "li_exec_adapters_write" ON public.linkedin_execution_adapters FOR ALL TO authenticated
USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id) AND public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'))
WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id) AND public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'));

CREATE OR REPLACE FUNCTION public.tg_li_exec_adapters_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_li_exec_adapters_touch ON public.linkedin_execution_adapters;
CREATE TRIGGER trg_li_exec_adapters_touch BEFORE UPDATE ON public.linkedin_execution_adapters
FOR EACH ROW EXECUTE FUNCTION public.tg_li_exec_adapters_touch();

-- ============ Lead lifecycle columns ============
ALTER TABLE public.linkedin_campaign_leads
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason text;

CREATE INDEX IF NOT EXISTS idx_li_leads_next_action ON public.linkedin_campaign_leads(next_action_at) WHERE status = 'active';

-- Make sure we have an active state value supported
-- Existing default 'queued', allow: queued, active, paused, completed, removed, bounced

-- Set workspace trigger for queue (already exists). Add one for action_history if missing.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_li_history_set_workspace') THEN
    CREATE TRIGGER trg_li_history_set_workspace BEFORE INSERT ON public.linkedin_action_history
    FOR EACH ROW EXECUTE FUNCTION public.tg_li_history_set_workspace();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_li_queue_set_workspace') THEN
    CREATE TRIGGER trg_li_queue_set_workspace BEFORE INSERT ON public.linkedin_action_queue
    FOR EACH ROW EXECUTE FUNCTION public.tg_li_queue_set_workspace();
  END IF;
END $$;

-- ============ Capacity helper ============
-- Returns remaining capacity today for a given account & action type, taking smart_limits into account.
CREATE OR REPLACE FUNCTION public.linkedin_account_remaining_capacity(_account_id uuid, _action_type text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  SELECT
    CASE _action_type
      WHEN 'connect_request' THEN COALESCE(daily_connect_limit, 0)
      WHEN 'message' THEN COALESCE(daily_message_limit, 0)
      WHEN 'follow_up_message' THEN COALESCE(daily_message_limit, 0)
      WHEN 'inmail' THEN COALESCE(daily_inmail_limit, 0)
      WHEN 'view_profile' THEN COALESCE(daily_view_limit, 0)
      WHEN 'like_post' THEN COALESCE(daily_like_limit, 0)
      WHEN 'comment_post' THEN COALESCE(daily_comment_limit, 0)
      WHEN 'endorse_skills' THEN COALESCE(daily_endorse_limit, 0)
      WHEN 'withdraw_request' THEN COALESCE(daily_withdraw_limit, 0)
      ELSE 9999
    END
  INTO v_limit FROM public.linkedin_accounts WHERE id = _account_id;

  IF v_limit IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.linkedin_action_history
  WHERE linkedin_account_id = _account_id
    AND action_type::text = _action_type
    AND status = 'completed'
    AND executed_at >= date_trunc('day', now());

  RETURN GREATEST(v_limit - COALESCE(v_used, 0), 0);
END $$;

-- ============ Sending window helper ============
CREATE OR REPLACE FUNCTION public.linkedin_account_in_window(_account_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a record; v_now time; v_dow int;
BEGIN
  SELECT sending_window_start, sending_window_end, schedule_days_of_week INTO v_a FROM public.linkedin_accounts WHERE id = _account_id;
  IF v_a.sending_window_start IS NULL OR v_a.sending_window_end IS NULL THEN RETURN true; END IF;
  v_now := (now() AT TIME ZONE 'UTC')::time;
  v_dow := EXTRACT(DOW FROM now())::int;
  IF v_a.schedule_days_of_week IS NOT NULL AND array_length(v_a.schedule_days_of_week, 1) > 0
     AND NOT (v_dow = ANY(v_a.schedule_days_of_week)) THEN RETURN false; END IF;
  RETURN v_now BETWEEN v_a.sending_window_start AND v_a.sending_window_end;
END $$;

-- ============ Adapter availability ============
CREATE OR REPLACE FUNCTION public.linkedin_has_active_adapter(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.linkedin_execution_adapters WHERE workspace_id = _workspace_id AND is_active = true)
$$;

-- ============ Stoplist check ============
CREATE OR REPLACE FUNCTION public.linkedin_contact_on_stoplist(_workspace_id uuid, _contact_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; hit boolean;
BEGIN
  SELECT email, linkedin_url, company_id INTO c FROM public.contacts WHERE id = _contact_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.linkedin_stoplist s
    WHERE s.workspace_id = _workspace_id
      AND (
        (s.match_type = 'email' AND lower(s.match_value) = lower(coalesce(c.email,'')))
        OR (s.match_type = 'linkedin_url' AND lower(s.match_value) = lower(coalesce(c.linkedin_url,'')))
        OR (s.match_type = 'domain' AND c.email IS NOT NULL AND lower(c.email) LIKE '%@' || lower(s.match_value))
      )
  ) INTO hit;
  RETURN COALESCE(hit, false);
END $$;

-- ============ Schedule next action for a lead ============
-- Materializes the lead's current step into either a queued action or a manual task.
CREATE OR REPLACE FUNCTION public.linkedin_schedule_next_action(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead record; v_camp record; v_step record; v_when timestamptz;
  v_next_order int; v_queue_id uuid; v_task_id uuid;
BEGIN
  SELECT l.*, c.linkedin_account_id, c.workspace_id AS ws, c.timezone, c.status AS campaign_status
  INTO v_lead
  FROM public.linkedin_campaign_leads l
  JOIN public.linkedin_campaigns c ON c.id = l.campaign_id
  WHERE l.id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  IF v_lead.status NOT IN ('queued','active') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'lead status ' || v_lead.status);
  END IF;
  IF v_lead.campaign_status NOT IN ('active','draft') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'campaign not active');
  END IF;
  IF public.linkedin_contact_on_stoplist(v_lead.ws, v_lead.contact_id) THEN
    UPDATE public.linkedin_campaign_leads SET status='removed', pause_reason='stoplist', updated_at=now() WHERE id=_lead_id;
    RETURN jsonb_build_object('skipped', true, 'reason', 'stoplist');
  END IF;

  v_next_order := COALESCE(v_lead.current_step_order, 0) + 1;

  SELECT * INTO v_step FROM public.linkedin_campaign_steps
  WHERE campaign_id = v_lead.campaign_id AND step_order = v_next_order;
  IF NOT FOUND THEN
    UPDATE public.linkedin_campaign_leads SET status='completed', updated_at=now() WHERE id=_lead_id;
    RETURN jsonb_build_object('completed', true);
  END IF;

  v_when := now() + (COALESCE(v_step.delay_days,0) || ' days')::interval + (COALESCE(v_step.delay_hours,0) || ' hours')::interval;

  IF v_step.step_type = 'wait' THEN
    UPDATE public.linkedin_campaign_leads
      SET current_step_order = v_next_order, next_action_at = v_when, status='active', updated_at=now()
      WHERE id=_lead_id;
    -- Recursively schedule the action that follows the wait at the right time
    -- (we still need a queue entry so the worker fires at v_when; create a no-op 'wait' action)
    INSERT INTO public.linkedin_action_queue (linkedin_account_id, contact_id, campaign_id, campaign_step_id, action_type, status, scheduled_at, payload)
    VALUES (v_lead.linkedin_account_id, v_lead.contact_id, v_lead.campaign_id, v_step.id, 'wait', 'scheduled', v_when, jsonb_build_object('lead_id', _lead_id))
    RETURNING id INTO v_queue_id;
    RETURN jsonb_build_object('scheduled', true, 'queue_id', v_queue_id, 'type', 'wait', 'at', v_when);
  END IF;

  IF v_step.step_type = 'manual_task' THEN
    INSERT INTO public.linkedin_tasks (workspace_id, contact_id, campaign_id, campaign_step_id, title, description, status, due_at)
    VALUES (v_lead.ws, v_lead.contact_id, v_lead.campaign_id, v_step.id,
            COALESCE(v_step.task_title, 'LinkedIn task'),
            v_step.task_description, 'open', v_when)
    RETURNING id INTO v_task_id;
    UPDATE public.linkedin_campaign_leads
      SET current_step_order = v_next_order, next_action_at = v_when, status='active', updated_at=now()
      WHERE id=_lead_id;
    RETURN jsonb_build_object('scheduled', true, 'task_id', v_task_id, 'type', 'manual_task', 'at', v_when);
  END IF;

  -- Real LinkedIn action: queue it
  INSERT INTO public.linkedin_action_queue
    (linkedin_account_id, contact_id, campaign_id, campaign_step_id, action_type, status, scheduled_at, payload)
  VALUES (
    v_lead.linkedin_account_id, v_lead.contact_id, v_lead.campaign_id, v_step.id,
    v_step.step_type::linkedin_action_type, 'scheduled', v_when,
    jsonb_build_object('lead_id', _lead_id, 'message_body', v_step.message_body)
  )
  RETURNING id INTO v_queue_id;

  UPDATE public.linkedin_campaign_leads
    SET current_step_order = v_next_order, next_action_at = v_when, status='active', updated_at=now()
    WHERE id=_lead_id;

  RETURN jsonb_build_object('scheduled', true, 'queue_id', v_queue_id, 'type', v_step.step_type, 'at', v_when);
END $$;

-- ============ Enroll many leads at once ============
CREATE OR REPLACE FUNCTION public.linkedin_enroll_leads(_campaign_id uuid, _contact_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_camp record; v_id uuid; v_lead_id uuid; v_added int := 0; v_skipped int := 0;
BEGIN
  SELECT * INTO v_camp FROM public.linkedin_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT public.is_workspace_member_or_admin(auth.uid(), v_camp.workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOREACH v_id IN ARRAY _contact_ids LOOP
    INSERT INTO public.linkedin_campaign_leads (workspace_id, campaign_id, contact_id, status, added_by)
    VALUES (v_camp.workspace_id, _campaign_id, v_id, 'queued', auth.uid())
    ON CONFLICT (campaign_id, contact_id) DO NOTHING
    RETURNING id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      v_added := v_added + 1;
      PERFORM public.linkedin_schedule_next_action(v_lead_id);
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped);
END $$;

-- ============ Transition lead state ============
CREATE OR REPLACE FUNCTION public.linkedin_transition_lead(_lead_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead record;
BEGIN
  SELECT * INTO v_lead FROM public.linkedin_campaign_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF NOT public.is_workspace_member_or_admin(auth.uid(), v_lead.workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _action = 'pause' THEN
    UPDATE public.linkedin_campaign_leads SET status='paused', paused_at=now(), pause_reason=_reason, updated_at=now() WHERE id=_lead_id;
    UPDATE public.linkedin_action_queue SET status='paused', updated_at=now()
      WHERE campaign_id = v_lead.campaign_id AND contact_id = v_lead.contact_id AND status IN ('pending','scheduled');
  ELSIF _action = 'resume' THEN
    UPDATE public.linkedin_campaign_leads SET status='active', paused_at=NULL, pause_reason=NULL, updated_at=now() WHERE id=_lead_id;
    UPDATE public.linkedin_action_queue SET status='scheduled', updated_at=now()
      WHERE campaign_id = v_lead.campaign_id AND contact_id = v_lead.contact_id AND status = 'paused';
  ELSIF _action = 'complete' THEN
    UPDATE public.linkedin_campaign_leads SET status='completed', updated_at=now() WHERE id=_lead_id;
    DELETE FROM public.linkedin_action_queue
      WHERE campaign_id = v_lead.campaign_id AND contact_id = v_lead.contact_id AND status IN ('pending','scheduled','paused');
  ELSIF _action = 'remove' THEN
    DELETE FROM public.linkedin_action_queue
      WHERE campaign_id = v_lead.campaign_id AND contact_id = v_lead.contact_id AND status IN ('pending','scheduled','paused');
    DELETE FROM public.linkedin_campaign_leads WHERE id = _lead_id;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', _action;
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', _action);
END $$;

-- ============ Analytics view ============
CREATE OR REPLACE VIEW public.linkedin_campaign_stats_v AS
SELECT
  c.id AS campaign_id,
  c.workspace_id,
  COUNT(DISTINCT l.id) AS leads_total,
  COUNT(DISTINCT l.id) FILTER (WHERE l.connection_status = 'connected') AS connected,
  COUNT(DISTINCT h.id) FILTER (WHERE h.action_type::text = 'connect_request' AND h.status = 'completed') AS connects_sent,
  COUNT(DISTINCT h.id) FILTER (WHERE h.action_type::text IN ('message','follow_up_message','inmail') AND h.status = 'completed') AS messages_sent,
  COUNT(DISTINCT l.id) FILTER (WHERE l.reply_status IS NOT NULL AND l.reply_status NOT IN ('none','bounce','auto_reply')) AS replies,
  COUNT(DISTINCT l.id) FILTER (WHERE l.reply_status = 'meeting_booked') AS meetings,
  COUNT(DISTINCT q.id) FILTER (WHERE q.status IN ('pending','scheduled')) AS queued_actions
FROM public.linkedin_campaigns c
LEFT JOIN public.linkedin_campaign_leads l ON l.campaign_id = c.id
LEFT JOIN public.linkedin_action_history h ON h.campaign_id = c.id
LEFT JOIN public.linkedin_action_queue q ON q.campaign_id = c.id
GROUP BY c.id, c.workspace_id;

GRANT SELECT ON public.linkedin_campaign_stats_v TO authenticated;

-- ============ Permissions on RPCs ============
REVOKE ALL ON FUNCTION public.linkedin_schedule_next_action(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_enroll_leads(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_transition_lead(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_account_remaining_capacity(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_account_in_window(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_has_active_adapter(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.linkedin_contact_on_stoplist(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.linkedin_schedule_next_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_enroll_leads(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_transition_lead(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_account_remaining_capacity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_account_in_window(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_has_active_adapter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_contact_on_stoplist(uuid, uuid) TO authenticated;

-- Ensure unique constraint exists for ON CONFLICT in enroll
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'linkedin_campaign_leads_campaign_id_contact_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.linkedin_campaign_leads ADD CONSTRAINT linkedin_campaign_leads_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END;
  END IF;
END $$;
