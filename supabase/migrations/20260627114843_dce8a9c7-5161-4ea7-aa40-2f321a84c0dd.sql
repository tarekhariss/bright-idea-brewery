CREATE OR REPLACE FUNCTION public.run_company_dedupe_tick()
RETURNS TABLE(companies_merged int, groups_processed int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  v_remaining int;
  v_total_merged int := 0;
  v_total_groups int := 0;
  v_started timestamptz := clock_timestamp();
  r record;
BEGIN
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

  -- Loop chunks for up to ~50s of wall time per tick
  WHILE extract(epoch FROM clock_timestamp() - v_started) < 50 LOOP
    FOR r IN
      SELECT * FROM public.dedupe_companies_global_chunk(
        25,
        '461b9c23-7c0e-4cab-b552-d3c5c8ad8c7e'::uuid
      )
    LOOP
      v_total_merged := v_total_merged + COALESCE(r.companies_merged, 0);
      v_total_groups := v_total_groups + COALESCE(r.groups_processed, 0);
      EXIT WHEN COALESCE(r.groups_processed, 0) = 0;
    END LOOP;
    -- If last chunk did nothing, stop
    IF v_total_groups = 0 THEN EXIT; END IF;
  END LOOP;

  RETURN QUERY SELECT v_total_merged, v_total_groups;
END;
$$;
