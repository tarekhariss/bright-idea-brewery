
-- 1. Job runs audit log
CREATE TABLE IF NOT EXISTS public.crm_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_name text NOT NULL,                  -- detect_replies | stale_sweeper | bulk_push
  status text NOT NULL,                    -- ok | error | skipped
  scanned int NOT NULL DEFAULT 0,
  queued int NOT NULL DEFAULT 0,
  auto_pushed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  duration_ms int NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_job_runs TO authenticated;
GRANT ALL ON public.crm_job_runs TO service_role;
ALTER TABLE public.crm_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_job_runs_select" ON public.crm_job_runs
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_crm_job_runs_workspace_job_time
  ON public.crm_job_runs(workspace_id, job_name, ran_at DESC);

-- 2. Bulk push job: filter snapshot support
ALTER TABLE public.crm_bulk_push_jobs
  ADD COLUMN IF NOT EXISTS selection_mode text NOT NULL DEFAULT 'ids',
  ADD COLUMN IF NOT EXISTS filter_snapshot jsonb;

-- 3. Bulk approve review items
CREATE OR REPLACE FUNCTION public.approve_review_items_bulk(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_failed int := 0;
  v_row public.crm_review_queue;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      SELECT * INTO v_row FROM public.crm_review_queue WHERE id = v_id;
      IF v_row.id IS NULL OR v_row.status <> 'pending' THEN
        v_failed := v_failed + 1; CONTINUE;
      END IF;
      IF NOT public.is_workspace_member(v_caller, v_row.workspace_id) THEN
        v_failed := v_failed + 1; CONTINUE;
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
        'status', v_row.suggested_status,
        'note', v_row.suggested_note
      );
      v_result := public.push_to_crm(v_payload);
      IF (v_result->>'created')::boolean THEN v_created := v_created + 1; ELSE v_updated := v_updated + 1; END IF;
      UPDATE public.crm_review_queue SET
        status='approved', resolved_by=v_caller, resolved_at=now(),
        resolved_opportunity_id=(v_result->>'opportunity_id')::uuid, updated_at=now()
      WHERE id = v_id;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'failed', v_failed);
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_review_items_bulk(uuid[]) TO authenticated;

-- 4. Bulk reject
CREATE OR REPLACE FUNCTION public.reject_review_items_bulk(p_ids uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count int;
BEGIN
  WITH eligible AS (
    SELECT q.id FROM public.crm_review_queue q
    WHERE q.id = ANY(p_ids) AND q.status='pending'
      AND public.is_workspace_member(v_caller, q.workspace_id)
  ),
  upd AS (
    UPDATE public.crm_review_queue
      SET status='rejected', resolved_by=v_caller, resolved_at=now(),
          resolution_note=p_reason, updated_at=now()
      WHERE id IN (SELECT id FROM eligible)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN jsonb_build_object('rejected', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_review_items_bulk(uuid[], text) TO authenticated;
