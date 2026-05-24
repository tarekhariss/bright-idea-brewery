DROP FUNCTION IF EXISTS public.claim_verification_batch(integer);

CREATE FUNCTION public.claim_verification_batch(_limit integer DEFAULT 50)
RETURNS TABLE(result_id uuid, job_id uuid, workspace_id uuid, email text, domain text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  WITH due AS (
    SELECT r.id
    FROM public.verification_results r
    JOIN public.verification_jobs j ON j.id = r.job_id
    WHERE r.from_cache = false
      AND r.verified_at IS NULL
      AND COALESCE(r.dead_letter, false) = false
      AND j.status IN ('pending','processing','partial')
    ORDER BY r.created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.verification_jobs j
     SET status = 'processing',
         started_at = COALESCE(started_at, now()),
         updated_at = now()
    FROM due d
    JOIN public.verification_results r ON r.id = d.id
   WHERE j.id = r.job_id
     AND j.status = 'pending';

  RETURN QUERY
  SELECT r.id,
         r.job_id,
         r.workspace_id,
         r.email,
         r.domain
    FROM public.verification_results r
    JOIN public.verification_jobs j ON j.id = r.job_id
   WHERE r.from_cache = false
     AND r.verified_at IS NULL
     AND COALESCE(r.dead_letter, false) = false
     AND j.status IN ('pending','processing','partial')
   ORDER BY r.created_at ASC
   LIMIT _limit;
END;
$function$;