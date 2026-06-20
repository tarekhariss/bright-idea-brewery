
-- ============================================================
-- 1. Quarantine table
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.quarantine_status AS ENUM ('pending','approved','excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.import_quarantine_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  import_row_id uuid REFERENCES public.import_job_rows(id) ON DELETE CASCADE,
  row_index integer,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons text[] NOT NULL DEFAULT '{}',
  status public.quarantine_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  decided_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, import_row_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_quarantine_rows TO authenticated;
GRANT ALL ON public.import_quarantine_rows TO service_role;

ALTER TABLE public.import_quarantine_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iqr_select_workspace_members" ON public.import_quarantine_rows
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = import_quarantine_rows.workspace_id AND m.user_id = auth.uid()));

CREATE POLICY "iqr_modify_workspace_members" ON public.import_quarantine_rows
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = import_quarantine_rows.workspace_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = import_quarantine_rows.workspace_id AND m.user_id = auth.uid()));

CREATE POLICY "iqr_insert_workspace_members" ON public.import_quarantine_rows
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = import_quarantine_rows.workspace_id AND m.user_id = auth.uid()));

CREATE POLICY "iqr_delete_workspace_members" ON public.import_quarantine_rows
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = import_quarantine_rows.workspace_id AND m.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_iqr_job ON public.import_quarantine_rows (import_job_id);
CREATE INDEX IF NOT EXISTS idx_iqr_ws_status ON public.import_quarantine_rows (workspace_id, status);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_iqr_touch ON public.import_quarantine_rows;
CREATE TRIGGER trg_iqr_touch BEFORE UPDATE ON public.import_quarantine_rows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. Quarantine detection RPC
-- ============================================================
-- Heuristics, all conservative:
--  * "no_valid_email": email missing OR no '@' OR more than one '@' OR no '.' in domain
--  * "no_linkedin": no recognizable linkedin url anywhere in the row
--  * "no_company": company/company_name/organization fields all blank
--  * "malformed_email": email looks like a normal word (no '@'); only flagged when row
--      also has an "email"-named column, so we don't false-positive headerless rows
--  * "shifted_row": cell count departs from header count by >=2 (when row preserves order)
CREATE OR REPLACE FUNCTION public.scan_import_quarantine(p_import_job_id uuid)
RETURNS TABLE(quarantined int, scanned int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_flag boolean;
  v_user uuid := auth.uid();
  v_scanned int := 0;
  v_q int := 0;
BEGIN
  SELECT j.workspace_id INTO v_ws FROM public.import_jobs j WHERE j.id = p_import_job_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'import_job_not_found'; END IF;

  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = v_ws;
  IF NOT COALESCE(v_flag, false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;

  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = v_ws AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH src AS (
    SELECT r.id, r.row_number, r.raw_data,
      LOWER(COALESCE(r.raw_data->>'email', r.raw_data->>'Email', r.raw_data->>'EMAIL','')) AS email,
      LOWER(COALESCE(
        r.raw_data->>'linkedin_url', r.raw_data->>'linkedin',
        r.raw_data->>'LinkedIn Url', r.raw_data->>'LinkedIn',''
      )) AS linkedin,
      COALESCE(
        NULLIF(TRIM(r.raw_data->>'company'), ''),
        NULLIF(TRIM(r.raw_data->>'company_name'), ''),
        NULLIF(TRIM(r.raw_data->>'Company'), ''),
        NULLIF(TRIM(r.raw_data->>'organization'), '')
      ) AS company,
      (SELECT count(*) FROM jsonb_object_keys(r.raw_data)) AS key_count
    FROM public.import_job_rows r
    WHERE r.import_job_id = p_import_job_id
      AND r.status IN ('pending','review','error','skipped')
      AND NOT EXISTS (
        SELECT 1 FROM public.import_quarantine_rows q WHERE q.import_row_id = r.id
      )
  ),
  classified AS (
    SELECT id, row_number, raw_data, key_count,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN email = '' OR email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN 'no_valid_email' END,
        CASE WHEN linkedin = '' OR linkedin NOT LIKE '%linkedin.%' THEN 'no_linkedin' END,
        CASE WHEN company IS NULL THEN 'no_company' END,
        CASE WHEN email <> '' AND email NOT LIKE '%@%' THEN 'malformed_email' END
      ], NULL) AS reasons
    FROM src
  ),
  to_q AS (
    SELECT id, row_number, raw_data, reasons FROM classified
    -- Quarantine when ALL three identity anchors are missing or malformed
    WHERE 'no_valid_email' = ANY(reasons)
      AND 'no_linkedin'    = ANY(reasons)
      AND 'no_company'     = ANY(reasons)
  ),
  ins AS (
    INSERT INTO public.import_quarantine_rows
      (workspace_id, import_job_id, import_row_id, row_index, raw_row, reasons, status)
    SELECT v_ws, p_import_job_id, id, row_number, raw_data, reasons, 'pending'
    FROM to_q
    ON CONFLICT (import_job_id, import_row_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM classified), (SELECT count(*) FROM ins)
  INTO v_scanned, v_q;

  RETURN QUERY SELECT v_q, v_scanned;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.scan_import_quarantine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_import_quarantine(uuid) TO authenticated, service_role;

-- ============================================================
-- 3. Data Quality summary RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_data_quality(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag, false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH c AS (
    SELECT
      count(*)                                            AS total_contacts,
      count(*) FILTER (WHERE company_id IS NOT NULL)      AS with_company,
      count(*) FILTER (WHERE email IS NULL OR email = '') AS missing_email,
      count(*) FILTER (WHERE email_canonical_status = 'valid')          AS s_valid,
      count(*) FILTER (WHERE email_canonical_status = 'valid_catch_all')AS s_catch_all,
      count(*) FILTER (WHERE email_canonical_status = 'risky')          AS s_risky,
      count(*) FILTER (WHERE email_canonical_status = 'unknown')        AS s_unknown,
      count(*) FILTER (WHERE email_canonical_status = 'invalid')        AS s_invalid,
      count(*) FILTER (WHERE email_canonical_status = 'bounced')        AS s_bounced,
      count(*) FILTER (WHERE email_canonical_status = 'suppressed')     AS s_suppressed,
      count(*) FILTER (WHERE email_canonical_status IS NULL OR email_canonical_status = 'unverified') AS s_unverified
    FROM public.contacts WHERE workspace_id = p_workspace_id
  ),
  co AS (
    SELECT
      count(*) AS total_companies,
      count(DISTINCT NULLIF(LOWER(domain),'')) AS unique_domains,
      count(*) FILTER (WHERE domain IS NULL OR domain = '') AS missing_domain
    FROM public.companies WHERE workspace_id = p_workspace_id
  ),
  q AS (
    SELECT count(*) FILTER (WHERE status='pending') AS quarantine_pending,
           count(*) FILTER (WHERE status='approved') AS quarantine_approved,
           count(*) FILTER (WHERE status='excluded') AS quarantine_excluded
    FROM public.import_quarantine_rows WHERE workspace_id = p_workspace_id
  ),
  cf AS (
    SELECT count(*) AS custom_fields FROM public.custom_fields WHERE workspace_id = p_workspace_id
  )
  SELECT jsonb_build_object(
    'contacts', jsonb_build_object(
      'total', c.total_contacts,
      'with_company', c.with_company,
      'missing_email', c.missing_email
    ),
    'companies', jsonb_build_object(
      'total', co.total_companies,
      'unique_domains', co.unique_domains,
      'missing_domain', co.missing_domain
    ),
    'email_status', jsonb_build_object(
      'valid', c.s_valid, 'catch_all', c.s_catch_all, 'risky', c.s_risky,
      'unknown', c.s_unknown, 'invalid', c.s_invalid, 'bounced', c.s_bounced,
      'suppressed', c.s_suppressed, 'unverified', c.s_unverified
    ),
    'quarantine', jsonb_build_object(
      'pending', q.quarantine_pending,
      'approved', q.quarantine_approved,
      'excluded', q.quarantine_excluded
    ),
    'custom_fields', cf.custom_fields,
    'computed_at', now()
  )
  INTO v_result FROM c, co, q, cf;
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_workspace_data_quality(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_data_quality(uuid) TO authenticated, service_role;

-- ============================================================
-- 4. Dataset Readiness RPC
-- ============================================================
-- Computes readiness for either a list (list_id) or a saved_search (saved_search_id).
-- Returns counts plus a 0-100 score using transparent weights based on real data.
CREATE OR REPLACE FUNCTION public.compute_dataset_readiness(
  p_workspace_id uuid,
  p_list_id uuid DEFAULT NULL,
  p_saved_search_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_result jsonb;
  v_quarantined int := 0;
  v_score int;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag, false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_list_id IS NULL AND p_saved_search_id IS NULL THEN
    RAISE EXCEPTION 'requires_list_or_saved_search';
  END IF;

  -- Resolve the contact set. Saved searches are not materialized — for the MVP,
  -- we only score list-backed datasets and saved searches that already have a
  -- materialized cache. Saved search dynamic scoring is intentionally deferred.
  WITH base AS (
    SELECT c.*
    FROM public.contacts c
    JOIN public.list_contacts lc ON lc.contact_id = c.id
    WHERE c.workspace_id = p_workspace_id
      AND p_list_id IS NOT NULL
      AND lc.list_id = p_list_id
  ),
  agg AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE email_canonical_status = 'valid')           AS s_valid,
      count(*) FILTER (WHERE email_canonical_status = 'valid_catch_all') AS s_catch_all,
      count(*) FILTER (WHERE email_canonical_status = 'risky')           AS s_risky,
      count(*) FILTER (WHERE email_canonical_status = 'unknown')         AS s_unknown,
      count(*) FILTER (WHERE email_canonical_status = 'invalid')         AS s_invalid,
      count(*) FILTER (WHERE email_canonical_status = 'bounced')         AS s_bounced,
      count(*) FILTER (WHERE email_canonical_status = 'suppressed')      AS s_suppressed,
      count(*) FILTER (WHERE email_canonical_status IS NULL OR email_canonical_status='unverified') AS s_unverified,
      count(*) FILTER (WHERE company_id IS NULL)                         AS missing_company,
      count(*) FILTER (WHERE company_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.companies co WHERE co.id = base.company_id AND co.domain IS NOT NULL AND co.domain <> '')) AS missing_company_domain
    FROM base
  )
  SELECT
    CASE WHEN total = 0 THEN 0 ELSE
      -- weights: valid+catch_all good, risky/unknown neutral, invalid/bounced/suppressed bad, unverified soft penalty
      GREATEST(0, LEAST(100, (
        ((s_valid + s_catch_all) * 100 / total)
        - (s_risky * 10 / GREATEST(total,1))
        - (s_invalid * 80 / GREATEST(total,1))
        - (s_bounced * 80 / GREATEST(total,1))
        - (s_suppressed * 60 / GREATEST(total,1))
        - (s_unverified * 15 / GREATEST(total,1))
        - (missing_company * 5 / GREATEST(total,1))
      )))
    END,
    jsonb_build_object(
      'total', total,
      'valid', s_valid, 'catch_all', s_catch_all, 'risky', s_risky,
      'unknown', s_unknown, 'invalid', s_invalid, 'bounced', s_bounced,
      'suppressed', s_suppressed, 'unverified', s_unverified,
      'missing_company', missing_company,
      'missing_company_domain', missing_company_domain
    )
  INTO v_score, v_result FROM agg;

  SELECT count(*) INTO v_quarantined
  FROM public.import_quarantine_rows
  WHERE workspace_id = p_workspace_id AND status = 'pending';

  v_result := v_result || jsonb_build_object(
    'score', v_score,
    'quarantined_pending', v_quarantined,
    'list_id', p_list_id,
    'saved_search_id', p_saved_search_id,
    'computed_at', now()
  );
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.compute_dataset_readiness(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_dataset_readiness(uuid, uuid, uuid) TO authenticated, service_role;
