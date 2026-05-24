CREATE OR REPLACE FUNCTION public.enqueue_verification_job(
  _workspace_id uuid,
  _name text,
  _emails text[],
  _source public.verification_job_source DEFAULT 'csv_upload'::public.verification_job_source,
  _campaign_id uuid DEFAULT NULL,
  _list_id uuid DEFAULT NULL,
  _quality public.verification_quality_mode DEFAULT 'balanced'::public.verification_quality_mode
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_job_id uuid;
  v_email text;
  v_norm  text;
  v_dom   text;
  v_total int := 0;
  v_cached_hits int := 0;
  v_cache public.verification_cache%ROWTYPE;
BEGIN
  INSERT INTO public.verification_jobs (workspace_id, name, source, campaign_id, list_id, status, verification_quality)
  VALUES (_workspace_id, COALESCE(_name, 'Import ' || to_char(now(), 'YYYY-MM-DD HH24:MI')),
          _source, _campaign_id, _list_id, 'pending', _quality)
  RETURNING id INTO v_job_id;

  FOREACH v_email IN ARRAY _emails LOOP
    v_norm := lower(trim(v_email));
    IF v_norm = '' OR position('@' in v_norm) = 0 THEN CONTINUE; END IF;
    v_dom := split_part(v_norm, '@', 2);
    v_total := v_total + 1;

    SELECT * INTO v_cache FROM public.verification_cache
      WHERE email_normalized = v_norm AND cached_until > now();

    IF FOUND THEN
      INSERT INTO public.verification_results
        (workspace_id, job_id, email, domain, status, confidence, risk_reasons,
         is_disposable, is_role_based, is_catch_all, is_free_provider,
         mx_provider, mx_record, smtp_response, smtp_code, source_engine, engine_version,
         from_cache, verified_at, cached_until, raw_response)
      VALUES
        (_workspace_id, v_job_id, v_norm, v_dom, v_cache.status, v_cache.confidence, v_cache.risk_reasons,
         v_cache.is_disposable, v_cache.is_role_based, v_cache.is_catch_all, v_cache.is_free_provider,
         v_cache.mx_provider, v_cache.mx_record, v_cache.smtp_response, v_cache.smtp_code,
         v_cache.source_engine, v_cache.engine_version,
         true, v_cache.verified_at, v_cache.cached_until, v_cache.raw_response);
      UPDATE public.verification_cache SET hit_count = hit_count + 1 WHERE id = v_cache.id;
      v_cached_hits := v_cached_hits + 1;
    ELSE
      INSERT INTO public.verification_results (workspace_id, job_id, email, domain, status, verification_quality)
      VALUES (_workspace_id, v_job_id, v_norm, v_dom, 'unknown', _quality);
    END IF;
  END LOOP;

  UPDATE public.verification_jobs
    SET total_count = v_total,
        cached_hit_count = v_cached_hits,
        processed_count = v_cached_hits,
        status = (CASE WHEN v_cached_hits = v_total AND v_total > 0 THEN 'completed' ELSE 'pending' END)::verification_job_status,
        started_at = COALESCE(started_at, now()),
        completed_at = CASE WHEN v_cached_hits = v_total AND v_total > 0 THEN now() ELSE NULL END
    WHERE id = v_job_id;

  RETURN v_job_id;
END $function$;