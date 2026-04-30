
-- Helper used by the worker to branch on a wait_for_connection pulse
CREATE OR REPLACE FUNCTION public.linkedin_check_connection_status(_contact_id uuid, _workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT connection_status FROM public.linkedin_contact_state
   WHERE contact_id = _contact_id AND workspace_id = _workspace_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.linkedin_count_workflow_nodes(_campaign_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.linkedin_workflow_nodes WHERE campaign_id = _campaign_id
$$;

-- Replace the result recorder so it routes through the graph scheduler when applicable
CREATE OR REPLACE FUNCTION public.linkedin_record_action_result(
  _queue_id uuid, _outcome text,
  _provider_response jsonb DEFAULT '{}'::jsonb,
  _error text DEFAULT NULL,
  _max_retries integer DEFAULT 3
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q record;
  v_lead_id uuid;
  v_node record;
  v_condition public.linkedin_edge_condition;
  v_provider_hint text;
  v_retry int;
BEGIN
  SELECT * INTO v_q FROM public.linkedin_action_queue WHERE id = _queue_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'queue row missing'); END IF;

  v_lead_id := NULLIF(v_q.payload->>'lead_id','')::uuid;

  IF _outcome = 'success' THEN
    UPDATE public.linkedin_action_queue
      SET status = 'completed', executed_at = now(), error_message = NULL,
          payload = COALESCE(payload,'{}'::jsonb) || jsonb_build_object('provider_response', _provider_response),
          updated_at = now()
      WHERE id = _queue_id;

    INSERT INTO public.linkedin_action_history
      (linkedin_account_id, contact_id, campaign_id, action_type, status, result, metadata, executed_at, workspace_id)
    VALUES
      (v_q.linkedin_account_id, v_q.contact_id, v_q.campaign_id, v_q.action_type,
       'completed', 'ok', _provider_response, now(), v_q.workspace_id);

    -- Update contact state
    INSERT INTO public.linkedin_contact_state
      (workspace_id, contact_id, linkedin_account_id, connection_status, last_li_activity_at, last_li_action_type)
    VALUES (
      v_q.workspace_id, v_q.contact_id, v_q.linkedin_account_id,
      CASE
        WHEN v_q.action_type::text = 'connect_request' THEN 'pending'
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
            WHEN v_q.action_type::text = 'connect_request' AND linkedin_contact_state.connection_status = 'not_connected' THEN 'pending'
            WHEN v_q.action_type::text = 'message' THEN 'connected'
            ELSE linkedin_contact_state.connection_status
          END,
          updated_at = now();

    -- Bump variant accepted/positive counters from provider hints
    IF v_q.variant_id IS NOT NULL THEN
      v_provider_hint := lower(COALESCE(_provider_response->>'result', _provider_response->>'status', ''));
      IF v_provider_hint IN ('accepted','connected') THEN
        UPDATE public.linkedin_message_variants SET accepted_count = accepted_count + 1 WHERE id = v_q.variant_id;
      END IF;
      IF v_provider_hint IN ('replied','positive_reply') THEN
        UPDATE public.linkedin_message_variants SET replies_count = replies_count + 1 WHERE id = v_q.variant_id;
      END IF;
      IF v_provider_hint = 'positive_reply' THEN
        UPDATE public.linkedin_message_variants SET positive_count = positive_count + 1 WHERE id = v_q.variant_id;
      END IF;
    END IF;

    -- Lead progression
    IF v_lead_id IS NOT NULL THEN
      UPDATE public.linkedin_campaign_leads
        SET last_action_at = now(), last_action_type = v_q.action_type::text, updated_at = now()
        WHERE id = v_lead_id;

      -- If we have a workflow_node_id, use graph scheduler with branch condition
      IF v_q.workflow_node_id IS NOT NULL THEN
        SELECT * INTO v_node FROM public.linkedin_workflow_nodes WHERE id = v_q.workflow_node_id;

        v_condition := 'success';

        IF v_node.node_type = 'wait_for_connection' THEN
          -- Check connection status via contact state
          IF public.linkedin_check_connection_status(v_q.contact_id, v_q.workspace_id) = 'connected' THEN
            v_condition := 'connected';
          ELSE
            v_condition := 'not_connected';
          END IF;
        ELSIF v_node.node_type = 'connect_request' THEN
          IF v_provider_hint IN ('accepted','connected') THEN v_condition := 'accepted';
          ELSIF v_provider_hint IN ('declined','rejected') THEN v_condition := 'declined';
          ELSIF v_provider_hint = 'timeout' THEN v_condition := 'timeout';
          ELSE v_condition := 'success';
          END IF;
        ELSIF v_node.node_type IN ('message','inmail') THEN
          IF v_provider_hint IN ('replied','positive_reply') THEN v_condition := 'replied';
          ELSE v_condition := 'success';
          END IF;
        END IF;

        PERFORM public.linkedin_schedule_next_action_v2(v_lead_id, v_condition);
      ELSE
        -- Legacy linear path
        PERFORM public.linkedin_schedule_next_action(v_lead_id);
      END IF;
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
      -- Branch on failure if graph
      IF v_lead_id IS NOT NULL AND v_q.workflow_node_id IS NOT NULL THEN
        PERFORM public.linkedin_schedule_next_action_v2(v_lead_id, 'failure');
      END IF;
      RETURN jsonb_build_object('ok', false, 'status', 'failed', 'reason', _error);
    ELSE
      UPDATE public.linkedin_action_queue
        SET status = 'pending', retry_count = v_retry, error_message = _error,
            scheduled_at = now() + (5 * power(2, v_retry - 1) || ' minutes')::interval,
            updated_at = now()
        WHERE id = _queue_id;
      RETURN jsonb_build_object('ok', false, 'status', 'retry', 'attempt', v_retry);
    END IF;

  ELSE
    UPDATE public.linkedin_action_queue
      SET status = 'failed', retry_count = COALESCE(retry_count,0) + 1,
          error_message = _error, executed_at = now(), updated_at = now()
      WHERE id = _queue_id;
    INSERT INTO public.linkedin_action_history
      (linkedin_account_id, contact_id, campaign_id, action_type, status, result, error_message, metadata, executed_at, workspace_id)
    VALUES
      (v_q.linkedin_account_id, v_q.contact_id, v_q.campaign_id, v_q.action_type,
       'failed', 'error', _error, _provider_response, now(), v_q.workspace_id);
    IF v_lead_id IS NOT NULL AND v_q.workflow_node_id IS NOT NULL THEN
      PERFORM public.linkedin_schedule_next_action_v2(v_lead_id, 'failure');
    END IF;
    RETURN jsonb_build_object('ok', false, 'status', 'failed', 'reason', _error);
  END IF;
END $$;
