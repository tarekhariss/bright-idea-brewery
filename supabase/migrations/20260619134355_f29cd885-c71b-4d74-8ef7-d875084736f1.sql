
-- 1. Extend crm_settings
ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS positive_reply_review_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_push_high_confidence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_sweeper_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_stale_sweep_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reply_detection_at timestamptz,
  ADD COLUMN IF NOT EXISTS automation_rules jsonb NOT NULL DEFAULT '{
    "create_followup_task_on_opp": {"enabled": true, "days": 2},
    "assign_owner_fallback": {"enabled": true},
    "move_to_meeting_booked_on_meeting": {"enabled": true},
    "flag_stale_after_days": {"enabled": true},
    "auto_push_high_confidence_replies": {"enabled": false}
  }'::jsonb;

-- 2. Opportunities stale flag (denormalized for fast queue counts)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_opportunities_workspace_status_stale
  ON public.opportunities(workspace_id, status, is_stale);
CREATE INDEX IF NOT EXISTS idx_opportunities_workspace_next_action
  ON public.opportunities(workspace_id, next_action_at) WHERE next_action_at IS NOT NULL;

-- 3. Review queue
CREATE TABLE IF NOT EXISTS public.crm_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type text NOT NULL,                      -- 'email_thread' | 'linkedin_thread'
  source_thread_id uuid,
  source_thread_text_id text,                     -- linkedin uses text id sometimes
  source_message_id uuid,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  source_campaign_id uuid,
  source_campaign_type text,
  detected_intent text NOT NULL,                  -- interested/meeting_requested/proposal_rfq/bad_timing/not_interested/neutral
  suggested_status text NOT NULL DEFAULT 'interested',
  confidence numeric NOT NULL DEFAULT 0,
  reasoning text,
  suggested_note text,
  message_excerpt text,
  ai_model text,
  status text NOT NULL DEFAULT 'pending',         -- pending | approved | rejected | auto_pushed
  resolved_opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_type, source_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_review_queue TO authenticated;
GRANT ALL ON public.crm_review_queue TO service_role;
ALTER TABLE public.crm_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_queue_workspace_members" ON public.crm_review_queue
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_review_queue_workspace_status
  ON public.crm_review_queue(workspace_id, status, created_at DESC);

-- 4. Bulk push jobs
CREATE TABLE IF NOT EXISTS public.crm_bulk_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid,
  source_kind text NOT NULL,                      -- contacts | companies | search | list
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_ids uuid[] NOT NULL DEFAULT '{}',
  push_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  total int NOT NULL DEFAULT 0,
  processed int NOT NULL DEFAULT 0,
  created_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',          -- queued | running | completed | failed | cancelled
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_bulk_push_jobs TO authenticated;
GRANT ALL ON public.crm_bulk_push_jobs TO service_role;
ALTER TABLE public.crm_bulk_push_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bulk_push_jobs_members" ON public.crm_bulk_push_jobs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.crm_bulk_push_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.crm_bulk_push_jobs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  contact_id uuid,
  company_id uuid,
  opportunity_id uuid,
  outcome text,                                   -- created | updated | failed | skipped
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_bulk_push_job_rows TO authenticated;
GRANT ALL ON public.crm_bulk_push_job_rows TO service_role;
ALTER TABLE public.crm_bulk_push_job_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bulk_push_rows_members" ON public.crm_bulk_push_job_rows
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_bulk_rows_job ON public.crm_bulk_push_job_rows(job_id);

-- 5. Patch push_to_crm to accept caller override (for edge-function/system calls).
CREATE OR REPLACE FUNCTION public.push_to_crm(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id uuid := (payload->>'workspace_id')::uuid;
  v_contact_id   uuid := NULLIF(payload->>'contact_id','')::uuid;
  v_company_id   uuid := NULLIF(payload->>'company_id','')::uuid;
  v_thread_id    uuid := NULLIF(payload->>'source_thread_id','')::uuid;
  v_thread_type  text := NULLIF(payload->>'source_thread_type','');
  v_campaign_id  uuid := NULLIF(payload->>'source_campaign_id','')::uuid;
  v_campaign_typ text := NULLIF(payload->>'source_campaign_type','');
  v_message_id   uuid := NULLIF(payload->>'source_message_id','')::uuid;
  v_source       public.opportunity_source_channel := COALESCE(NULLIF(payload->>'source_channel','')::public.opportunity_source_channel, 'manual_push');
  v_status       public.opportunity_status := COALESCE(NULLIF(payload->>'status','')::public.opportunity_status, 'interested');
  v_priority     public.opportunity_priority := COALESCE(NULLIF(payload->>'priority','')::public.opportunity_priority, 'normal');
  v_owner_id     uuid := NULLIF(payload->>'owner_id','')::uuid;
  v_stage_id     uuid := NULLIF(payload->>'stage_id','')::uuid;
  v_pipeline_id  uuid := NULLIF(payload->>'pipeline_id','')::uuid;
  v_title        text := NULLIF(payload->>'title','');
  v_note         text := NULLIF(payload->>'note','');
  v_force_new    boolean := COALESCE((payload->>'force_create_new')::boolean, false);
  v_create_deal  boolean := COALESCE((payload->'deal'->>'create')::boolean, false);
  v_deal_value   numeric := NULLIF(payload->'deal'->>'value','')::numeric;
  v_deal_name    text := NULLIF(payload->'deal'->>'name','');
  v_link_deal_id uuid := NULLIF(payload->>'link_deal_id','')::uuid;
  v_task_title   text := NULLIF(payload->'next_task'->>'title','');
  v_task_due     timestamptz := NULLIF(payload->'next_task'->>'due_at','')::timestamptz;
  v_caller_override uuid := NULLIF(payload->>'caller_id','')::uuid;
  v_caller       uuid := COALESCE(v_caller_override, auth.uid());
  v_opp_id       uuid;
  v_existing     uuid;
  v_created      boolean := false;
  v_default_pipeline uuid;
  v_deal_id      uuid;
  v_company_owner uuid;
  v_contact_owner uuid;
BEGIN
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'workspace_id required'; END IF;
  -- Skip membership check when caller_id provided (service role); otherwise enforce.
  IF v_caller_override IS NULL AND NOT public.is_workspace_member(auth.uid(), v_workspace_id) THEN
    RAISE EXCEPTION 'not a member of workspace %', v_workspace_id;
  END IF;
  IF v_contact_id IS NULL AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'contact_id or company_id required';
  END IF;

  IF v_owner_id IS NULL AND v_contact_id IS NOT NULL THEN
    SELECT owner_id INTO v_contact_owner FROM public.contacts WHERE id = v_contact_id;
    v_owner_id := v_contact_owner;
  END IF;
  IF v_owner_id IS NULL AND v_company_id IS NOT NULL THEN
    SELECT owner_id INTO v_company_owner FROM public.companies WHERE id = v_company_id;
    v_owner_id := v_company_owner;
  END IF;
  IF v_owner_id IS NULL THEN v_owner_id := v_caller; END IF;

  IF v_pipeline_id IS NULL THEN
    SELECT default_pipeline_id INTO v_default_pipeline FROM public.crm_settings WHERE workspace_id = v_workspace_id;
    IF v_default_pipeline IS NULL THEN
      v_default_pipeline := public.ensure_crm_pipeline(v_workspace_id);
    END IF;
    v_pipeline_id := v_default_pipeline;
  END IF;
  IF v_stage_id IS NULL THEN
    SELECT id INTO v_stage_id FROM public.pipeline_stages
      WHERE pipeline_id = v_pipeline_id AND is_active IS NOT FALSE
      ORDER BY display_order ASC LIMIT 1;
  END IF;

  IF NOT v_force_new THEN
    IF v_contact_id IS NOT NULL AND v_thread_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id AND source_thread_id = v_thread_id
        LIMIT 1;
    END IF;
    IF v_existing IS NULL AND v_contact_id IS NOT NULL AND v_campaign_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id AND source_campaign_id = v_campaign_id
          AND status NOT IN ('won','lost','not_fit','bad_timing')
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_existing IS NULL AND v_contact_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id
          AND status NOT IN ('won','lost','not_fit','bad_timing')
          AND created_at > now() - interval '30 days'
        ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;

  IF v_existing IS NOT NULL THEN
    v_opp_id := v_existing;
    UPDATE public.opportunities SET
      status = v_status,
      priority = GREATEST(priority::text, v_priority::text)::public.opportunity_priority,
      last_activity_at = now(),
      updated_at = now(),
      source_message_id = COALESCE(v_message_id, source_message_id),
      source_thread_id = COALESCE(v_thread_id, source_thread_id),
      source_thread_type = COALESCE(v_thread_type, source_thread_type),
      source_campaign_id = COALESCE(v_campaign_id, source_campaign_id),
      source_campaign_type = COALESCE(v_campaign_typ, source_campaign_type),
      is_stale = false
    WHERE id = v_opp_id;
  ELSE
    INSERT INTO public.opportunities (
      workspace_id, owner_id, contact_id, company_id, pipeline_id, stage_id,
      status, priority, source_channel, source_thread_id, source_thread_type,
      source_campaign_id, source_campaign_type, source_message_id, title,
      created_by, last_activity_at, is_stale
    ) VALUES (
      v_workspace_id, v_owner_id, v_contact_id, v_company_id, v_pipeline_id, v_stage_id,
      v_status, v_priority, v_source, v_thread_id, v_thread_type,
      v_campaign_id, v_campaign_typ, v_message_id, v_title,
      v_caller, now(), false
    ) RETURNING id INTO v_opp_id;
    v_created := true;
  END IF;

  IF v_link_deal_id IS NOT NULL THEN
    UPDATE public.opportunities SET deal_id = v_link_deal_id WHERE id = v_opp_id;
    v_deal_id := v_link_deal_id;
  ELSIF v_create_deal THEN
    INSERT INTO public.deals (workspace_id, owner_id, contact_id, company_id, name, amount, status, created_by)
    VALUES (v_workspace_id, v_owner_id, v_contact_id, v_company_id,
            COALESCE(v_deal_name, v_title, 'New deal'), v_deal_value, 'open', v_caller)
    RETURNING id INTO v_deal_id;
    UPDATE public.opportunities SET deal_id = v_deal_id WHERE id = v_opp_id;
  END IF;

  IF v_note IS NOT NULL THEN
    INSERT INTO public.opportunity_notes (workspace_id, opportunity_id, body, created_by)
    VALUES (v_workspace_id, v_opp_id, v_note, v_caller);
  END IF;

  IF v_task_title IS NOT NULL THEN
    INSERT INTO public.tasks (workspace_id, title, due_date, contact_id, company_id, status, created_by, assigned_to)
    VALUES (v_workspace_id, v_task_title, v_task_due, v_contact_id, v_company_id, 'pending', v_caller, v_owner_id);
  END IF;

  INSERT INTO public.activities (workspace_id, activity_type, contact_id, company_id, deal_id,
    source_type, source_id, title, description, performed_by, metadata)
  VALUES (v_workspace_id, 'note', v_contact_id, v_company_id, v_deal_id,
    'opportunity', v_opp_id,
    CASE WHEN v_created THEN 'Pushed to CRM' ELSE 'Updated CRM opportunity' END,
    COALESCE(v_note, ''), v_caller,
    jsonb_build_object('source_channel', v_source, 'auto', v_caller_override IS NOT NULL));

  RETURN jsonb_build_object('opportunity_id', v_opp_id, 'created', v_created, 'deal_id', v_deal_id);
END;
$function$;

-- 6. Smart queue counts RPC (one round trip)
CREATE OR REPLACE FUNCTION public.crm_smart_queue_counts(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_result jsonb;
BEGIN
  IF NOT public.is_workspace_member(v_caller, p_workspace_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  WITH o AS (
    SELECT * FROM public.opportunities WHERE workspace_id = p_workspace_id
  )
  SELECT jsonb_build_object(
    'new_interested',   (SELECT count(*) FROM o WHERE status = 'interested' AND created_at > now() - interval '7 days'),
    'needs_owner',      (SELECT count(*) FROM o WHERE owner_id IS NULL AND status NOT IN ('won','lost','not_fit','bad_timing')),
    'no_follow_up',     (SELECT count(*) FROM o WHERE next_action_at IS NULL AND status NOT IN ('won','lost','not_fit','bad_timing')),
    'due_today',        (SELECT count(*) FROM o WHERE next_action_at < v_today_end AND status NOT IN ('won','lost','not_fit','bad_timing')),
    'overdue_tasks',    (SELECT count(*) FROM public.tasks WHERE workspace_id = p_workspace_id AND status <> 'completed' AND due_date < now()),
    'stale',            (SELECT count(*) FROM o WHERE is_stale = true AND status NOT IN ('won','lost','not_fit','bad_timing')),
    'high_priority',    (SELECT count(*) FROM o WHERE priority IN ('high','urgent') AND status NOT IN ('won','lost','not_fit','bad_timing')),
    'meetings_booked',  (SELECT count(*) FROM o WHERE status = 'meeting_booked'),
    'proposal_rfq',     (SELECT count(*) FROM o WHERE status = 'proposal_rfq'),
    'recently_updated', (SELECT count(*) FROM o WHERE last_activity_at > now() - interval '24 hours'),
    'review_needed',    (SELECT count(*) FROM public.crm_review_queue WHERE workspace_id = p_workspace_id AND status = 'pending')
  ) INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crm_smart_queue_counts(uuid) TO authenticated;

-- 7. Time-series RPC
CREATE OR REPLACE FUNCTION public.crm_timeseries(p_workspace_id uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_start timestamptz := date_trunc('day', now()) - (p_days || ' days')::interval;
  v_result jsonb;
BEGIN
  IF NOT public.is_workspace_member(v_caller, p_workspace_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  WITH days AS (
    SELECT generate_series(v_start, date_trunc('day', now()), interval '1 day')::date AS d
  ),
  created AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*) AS c
    FROM public.opportunities WHERE workspace_id = p_workspace_id AND created_at >= v_start
    GROUP BY 1
  ),
  closed AS (
    SELECT date_trunc('day', closed_at)::date AS d, status, count(*) AS c
    FROM public.opportunities WHERE workspace_id = p_workspace_id AND closed_at >= v_start
    GROUP BY 1, 2
  ),
  transitions AS (
    SELECT date_trunc('day', changed_at)::date AS d, to_status, count(*) AS c
    FROM public.opportunity_status_history
    WHERE workspace_id = p_workspace_id AND changed_at >= v_start
    GROUP BY 1, 2
  ),
  by_source AS (
    SELECT date_trunc('day', created_at)::date AS d, source_channel::text AS sc, count(*) AS c
    FROM public.opportunities WHERE workspace_id = p_workspace_id AND created_at >= v_start
    GROUP BY 1, 2
  )
  SELECT jsonb_build_object(
    'days', (SELECT jsonb_agg(d ORDER BY d) FROM days),
    'created', (SELECT jsonb_object_agg(d::text, c) FROM created),
    'won', (SELECT jsonb_object_agg(d::text, c) FROM closed WHERE status = 'won'),
    'lost', (SELECT jsonb_object_agg(d::text, c) FROM closed WHERE status = 'lost'),
    'meetings_booked', (SELECT jsonb_object_agg(d::text, c) FROM transitions WHERE to_status::text = 'meeting_booked'),
    'by_source', (SELECT jsonb_agg(jsonb_build_object('day', d, 'source', sc, 'count', c)) FROM by_source)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crm_timeseries(uuid, int) TO authenticated;

-- 8. Approve review item -> push to CRM
CREATE OR REPLACE FUNCTION public.approve_review_item(p_id uuid, p_overrides jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.crm_review_queue;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_row FROM public.crm_review_queue WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.is_workspace_member(v_caller, v_row.workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'already resolved';
  END IF;

  v_payload := jsonb_build_object(
    'workspace_id', v_row.workspace_id,
    'contact_id', v_row.contact_id,
    'company_id', v_row.company_id,
    'source_thread_id', v_row.source_thread_id,
    'source_thread_type', v_row.source_type,
    'source_message_id', v_row.source_message_id,
    'source_campaign_id', v_row.source_campaign_id,
    'source_campaign_type', v_row.source_campaign_type,
    'source_channel', CASE WHEN v_row.source_type='linkedin_thread' THEN 'linkedin_reply' ELSE 'email_reply' END,
    'status', COALESCE(p_overrides->>'status', v_row.suggested_status),
    'note', COALESCE(p_overrides->>'note', v_row.suggested_note)
  ) || COALESCE(p_overrides, '{}'::jsonb);

  v_result := public.push_to_crm(v_payload);

  UPDATE public.crm_review_queue SET
    status = 'approved',
    resolved_by = v_caller,
    resolved_at = now(),
    resolved_opportunity_id = (v_result->>'opportunity_id')::uuid,
    updated_at = now()
  WHERE id = p_id;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_review_item(uuid, jsonb) TO authenticated;

-- 9. Reject review item
CREATE OR REPLACE FUNCTION public.reject_review_item(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_caller uuid := auth.uid(); v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.crm_review_queue WHERE id = p_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.is_workspace_member(v_caller, v_ws) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.crm_review_queue SET status='rejected', resolved_by=v_caller, resolved_at=now(),
    resolution_note=p_reason, updated_at=now() WHERE id = p_id AND status='pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_review_item(uuid, text) TO authenticated;

-- 10. update timestamp triggers
DROP TRIGGER IF EXISTS trg_review_queue_updated ON public.crm_review_queue;
CREATE TRIGGER trg_review_queue_updated BEFORE UPDATE ON public.crm_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_bulk_jobs_updated ON public.crm_bulk_push_jobs;
CREATE TRIGGER trg_bulk_jobs_updated BEFORE UPDATE ON public.crm_bulk_push_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
