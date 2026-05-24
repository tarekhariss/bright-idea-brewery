
-- ============= Verification cache intelligence + execution trace =============

-- 1. Cache policy enum
DO $$ BEGIN
  CREATE TYPE public.verification_cache_policy AS ENUM
    ('default', 'trusted_cache', 'recheck_weak', 'force_live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. verification_jobs: cache_policy + reuse/live counters
ALTER TABLE public.verification_jobs
  ADD COLUMN IF NOT EXISTS cache_policy public.verification_cache_policy
    NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS live_smtp_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_live_verification_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reused_from_cache_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reused_from_history_count integer NOT NULL DEFAULT 0;

-- Backfill reused_from_cache_count from legacy cached_hit_count
UPDATE public.verification_jobs
   SET reused_from_cache_count = cached_hit_count
 WHERE reused_from_cache_count = 0 AND cached_hit_count > 0;

-- 3. verification_results: execution trace columns
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS result_source text,                  -- live_smtp | cache | history | recovery | syntax | mx_only
  ADD COLUMN IF NOT EXISTS reuse_kind text,                      -- reused_from_cache | reused_from_history | reused_from_previous_job
  ADD COLUMN IF NOT EXISTS claimed_by_worker text,
  ADD COLUMN IF NOT EXISTS worker_version text,
  ADD COLUMN IF NOT EXISTS pass_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS smtp_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_detected text,
  ADD COLUMN IF NOT EXISTS used_probe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalization_reason text;

CREATE INDEX IF NOT EXISTS idx_verification_results_result_source
  ON public.verification_results(job_id, result_source);

-- 4. Rewritten enqueue_verification_job with cache intelligence + cache_policy
CREATE OR REPLACE FUNCTION public.enqueue_verification_job(
  _workspace_id uuid,
  _name text,
  _emails text[],
  _source public.verification_job_source DEFAULT 'csv_upload'::public.verification_job_source,
  _campaign_id uuid DEFAULT NULL,
  _list_id uuid DEFAULT NULL,
  _quality public.verification_quality_mode DEFAULT 'balanced'::public.verification_quality_mode,
  _cache_policy public.verification_cache_policy DEFAULT NULL
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
  v_reused int := 0;
  v_skipped_live int := 0;
  v_cache public.verification_cache%ROWTYPE;
  v_policy public.verification_cache_policy;
  v_reuse boolean;
  v_age_days numeric;
  v_conf numeric;
  v_deterministic boolean;
BEGIN
  -- Default policy: force_live for high_accuracy, otherwise 'default'
  v_policy := COALESCE(_cache_policy,
    CASE WHEN _quality = 'high_accuracy' THEN 'force_live'::verification_cache_policy
         ELSE 'default'::verification_cache_policy END);

  INSERT INTO public.verification_jobs
    (workspace_id, name, source, campaign_id, list_id, status, verification_quality, cache_policy)
  VALUES
    (_workspace_id, COALESCE(_name, 'Import ' || to_char(now(), 'YYYY-MM-DD HH24:MI')),
     _source, _campaign_id, _list_id, 'pending', _quality, v_policy)
  RETURNING id INTO v_job_id;

  FOREACH v_email IN ARRAY _emails LOOP
    v_norm := lower(trim(v_email));
    IF v_norm = '' OR position('@' in v_norm) = 0 THEN CONTINUE; END IF;
    v_dom := split_part(v_norm, '@', 2);
    v_total := v_total + 1;

    v_reuse := false;

    IF v_policy <> 'force_live' THEN
      SELECT * INTO v_cache FROM public.verification_cache
        WHERE email_normalized = v_norm AND cached_until > now();

      IF FOUND THEN
        v_conf := COALESCE(v_cache.confidence, 0);
        v_age_days := EXTRACT(EPOCH FROM (now() - COALESCE(v_cache.verified_at, v_cache.created_at))) / 86400.0;

        -- Deterministic verdicts that never need re-verification
        v_deterministic :=
          v_cache.is_disposable IS TRUE
          OR v_cache.status::text IN ('invalid_syntax','invalid_mx','dead_server','spamtrap','disposable');

        IF v_policy = 'trusted_cache' THEN
          v_reuse := true;
        ELSIF v_deterministic THEN
          v_reuse := true;
        ELSIF v_policy = 'recheck_weak' THEN
          -- Reuse only high-confidence valid (+ deterministic above)
          v_reuse := v_cache.status::text = 'valid'
                     AND v_conf >= 85
                     AND v_age_days <= 30
                     AND v_cache.mx_record IS NOT NULL
                     AND v_cache.smtp_response IS NOT NULL;
        ELSE
          -- 'default' policy
          v_reuse := v_cache.status::text = 'valid'
                     AND v_conf >= 80
                     AND v_age_days <= 30
                     AND v_cache.mx_record IS NOT NULL
                     AND v_cache.smtp_response IS NOT NULL;
        END IF;

        -- Never auto-reuse weak/ambiguous statuses (overrides anything except trusted_cache)
        IF v_policy <> 'trusted_cache'
           AND v_cache.status::text IN ('unknown','risky','catch_all','ok_for_all',
                                        'smtp_protocol','antispam_system') THEN
          v_reuse := false;
        END IF;
      END IF;
    END IF;

    IF v_reuse THEN
      INSERT INTO public.verification_results
        (workspace_id, job_id, email, domain, status, confidence, risk_reasons,
         is_disposable, is_role_based, is_catch_all, is_free_provider,
         mx_provider, mx_record, smtp_response, smtp_code, source_engine, engine_version,
         from_cache, verified_at, cached_until, raw_response,
         result_source, reuse_kind, finalization_reason, verification_quality)
      VALUES
        (_workspace_id, v_job_id, v_norm, v_dom, v_cache.status, v_cache.confidence, v_cache.risk_reasons,
         v_cache.is_disposable, v_cache.is_role_based, v_cache.is_catch_all, v_cache.is_free_provider,
         v_cache.mx_provider, v_cache.mx_record, v_cache.smtp_response, v_cache.smtp_code,
         v_cache.source_engine, v_cache.engine_version,
         true, v_cache.verified_at, v_cache.cached_until, v_cache.raw_response,
         'cache', 'reused_from_cache',
         'cache_hit:policy=' || v_policy::text || ',status=' || v_cache.status::text
           || ',conf=' || COALESCE(v_cache.confidence::text,'-'),
         _quality);
      UPDATE public.verification_cache SET hit_count = hit_count + 1 WHERE id = v_cache.id;
      v_reused := v_reused + 1;
      v_skipped_live := v_skipped_live + 1;
    ELSE
      INSERT INTO public.verification_results
        (workspace_id, job_id, email, domain, status, verification_quality, result_source)
      VALUES
        (_workspace_id, v_job_id, v_norm, v_dom, 'unknown', _quality, NULL);
    END IF;
  END LOOP;

  UPDATE public.verification_jobs
    SET total_count = v_total,
        cached_hit_count = v_reused,
        reused_from_cache_count = v_reused,
        skipped_live_verification_count = v_skipped_live,
        processed_count = v_reused,
        cache_hit_rate = CASE WHEN v_total > 0 THEN ROUND(100.0 * v_reused / v_total, 2) ELSE 0 END,
        status = (CASE WHEN v_reused = v_total AND v_total > 0 THEN 'completed' ELSE 'pending' END)::verification_job_status,
        started_at = COALESCE(started_at, now()),
        completed_at = CASE WHEN v_reused = v_total AND v_total > 0 THEN now() ELSE NULL END
    WHERE id = v_job_id;

  RETURN v_job_id;
END $function$;

-- 5. Drop the older 7-arg overload (no _cache_policy) to avoid ambiguity again
DROP FUNCTION IF EXISTS public.enqueue_verification_job(
  uuid, text, text[], public.verification_job_source, uuid, uuid, public.verification_quality_mode);

-- 6. Helper: increment live/recovery counters atomically
CREATE OR REPLACE FUNCTION public.bump_job_trace_counters(
  _job_id uuid,
  _kind text  -- 'live_smtp' | 'recovery'
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.verification_jobs
     SET live_smtp_count = live_smtp_count + (CASE WHEN _kind = 'live_smtp' THEN 1 ELSE 0 END),
         recovery_count  = recovery_count  + (CASE WHEN _kind = 'recovery'  THEN 1 ELSE 0 END)
   WHERE id = _job_id;
$$;
