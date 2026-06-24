
CREATE OR REPLACE FUNCTION public.try_claim_parent_finalize(p_parent_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claimed boolean := false;
  v_pending int;
BEGIN
  SELECT count(*) INTO v_pending
  FROM public.import_jobs
  WHERE parent_job_id = p_parent_job_id
    AND status <> 'completed';

  IF v_pending > 0 THEN
    RETURN false;
  END IF;

  UPDATE public.import_jobs
     SET post_processing_stage = 'dedupe_companies',
         updated_at = now()
   WHERE id = p_parent_job_id
     AND (post_processing_stage IS NULL OR post_processing_stage IN ('failed','pending'))
  RETURNING true INTO v_claimed;

  RETURN coalesce(v_claimed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_claim_parent_finalize(uuid) TO authenticated, service_role;
