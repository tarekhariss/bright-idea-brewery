
-- 1. Add post_processing_stage column for UI status
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS post_processing_stage text;

-- 2. Chunked dedupe: process N duplicate groups per call
CREATE OR REPLACE FUNCTION public.dedupe_companies_by_domain_chunk(
  p_workspace_id uuid,
  p_limit int DEFAULT 50,
  p_actor uuid DEFAULT NULL
) RETURNS TABLE(domain text, survivor uuid, merged_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  grp record;
  survivor_id uuid;
  loser_id uuid;
  cnt int;
BEGIN
  FOR grp IN
    SELECT normalized_domain
    FROM public.companies
    WHERE merged_into IS NULL
      AND normalized_domain IS NOT NULL
      AND normalized_domain <> ''
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    GROUP BY normalized_domain
    HAVING count(*) > 1
    LIMIT p_limit
  LOOP
    SELECT id INTO survivor_id
    FROM public.companies c
    WHERE c.normalized_domain = grp.normalized_domain
      AND c.merged_into IS NULL
      AND (p_workspace_id IS NULL OR c.workspace_id = p_workspace_id)
    ORDER BY public._company_field_score(c) DESC, c.created_at ASC NULLS LAST
    LIMIT 1;

    cnt := 0;
    FOR loser_id IN
      SELECT id FROM public.companies
      WHERE normalized_domain = grp.normalized_domain
        AND merged_into IS NULL
        AND id <> survivor_id
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    LOOP
      PERFORM public.merge_company_pair(survivor_id, loser_id, p_actor);
      cnt := cnt + 1;
    END LOOP;

    domain := grp.normalized_domain;
    survivor := survivor_id;
    merged_count := cnt;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dedupe_companies_by_domain_chunk(uuid, int, uuid) TO authenticated, service_role;

-- 3. Parent-level finalize after all child batches complete
CREATE OR REPLACE FUNCTION public.finalize_import_parent(p_parent_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace uuid;
  v_pending int;
  v_total_children int;
  v_merged int := 0;
  r record;
BEGIN
  SELECT workspace_id INTO v_workspace
  FROM public.import_jobs
  WHERE id = p_parent_job_id;

  IF v_workspace IS NULL THEN
    RETURN jsonb_build_object('error','parent_not_found');
  END IF;

  SELECT count(*) FILTER (WHERE status <> 'completed'),
         count(*)
    INTO v_pending, v_total_children
  FROM public.import_jobs
  WHERE parent_job_id = p_parent_job_id;

  IF v_total_children > 0 AND v_pending > 0 THEN
    RETURN jsonb_build_object('skipped','children_not_done','pending',v_pending);
  END IF;

  UPDATE public.import_jobs
     SET post_processing_stage = 'dedupe_companies',
         updated_at = now()
   WHERE id = p_parent_job_id;

  -- Chunked dedupe loop, capped so a single call cannot run away
  FOR i IN 1..200 LOOP
    SELECT coalesce(sum(merged_count),0)::int AS m, count(*)::int AS g
      INTO r
      FROM public.dedupe_companies_by_domain_chunk(v_workspace, 50, NULL);
    v_merged := v_merged + coalesce(r.m,0);
    EXIT WHEN coalesce(r.g,0) = 0;
  END LOOP;

  UPDATE public.import_jobs
     SET post_processing_stage = 'completed',
         status = 'completed',
         updated_at = now()
   WHERE id = p_parent_job_id;

  RETURN jsonb_build_object(
    'parent_job_id', p_parent_job_id,
    'workspace_id', v_workspace,
    'companies_merged', v_merged,
    'children', v_total_children
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_import_parent(uuid) TO authenticated, service_role;
