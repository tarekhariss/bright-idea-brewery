-- Persistent background dedupe loop via pg_cron
-- Each tick processes one safe chunk; pg_cron runs even when the agent session is gone.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper: run one safe chunk with bounded statement_timeout so the cron tick
-- never gets cancelled mid-merge by a global limit.
CREATE OR REPLACE FUNCTION public.run_company_dedupe_tick()
RETURNS TABLE(companies_merged int, groups_processed int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Stop early if there's nothing left to do (keeps the cron log clean)
  SELECT count(*) INTO v_remaining
  FROM (
    SELECT 1 FROM public.companies
    WHERE merged_into IS NULL
      AND normalized_domain IS NOT NULL
      AND normalized_domain <> ''
    GROUP BY normalized_domain
    HAVING count(*) > 1
  ) g;

  IF v_remaining = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Smaller chunk = safer under statement timeout
  RETURN QUERY
  SELECT * FROM public.dedupe_companies_global_chunk(
    25,
    '461b9c23-7c0e-4cab-b552-d3c5c8ad8c7e'::uuid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_company_dedupe_tick() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_company_dedupe_tick() TO service_role;

-- Schedule it: every minute. Unschedule any prior version first.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'company-dedupe-tick';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END;
$$;

SELECT cron.schedule(
  'company-dedupe-tick',
  '* * * * *',
  $$SELECT public.run_company_dedupe_tick();$$
);
