
-- Drop prior signature so we can return additional fields
DROP FUNCTION IF EXISTS public.claim_verification_batch(integer);

-- 1) Extend domain_intelligence
ALTER TABLE public.domain_intelligence
  ADD COLUMN IF NOT EXISTS bounce_rate numeric,
  ADD COLUMN IF NOT EXISTS catch_all_rate numeric,
  ADD COLUMN IF NOT EXISTS reputation_score numeric,
  ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS total_bounces bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_valid bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_catch_all bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_unknown bigint DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_di_reputation ON public.domain_intelligence(reputation_score);
CREATE INDEX IF NOT EXISTS idx_di_blocked ON public.domain_intelligence(is_blocked) WHERE is_blocked = true;

ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS next_recheck_at timestamptz,
  ADD COLUMN IF NOT EXISTS recheck_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_reputation_score numeric;
CREATE INDEX IF NOT EXISTS idx_vr_next_recheck ON public.verification_results(next_recheck_at)
  WHERE next_recheck_at IS NOT NULL;

ALTER TABLE public.provider_behavior
  ADD COLUMN IF NOT EXISTS avg_retry_delay_seconds integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS recommended_concurrency integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS greylist_rate numeric;

-- 4) Scoring engine
CREATE OR REPLACE FUNCTION public.compute_catch_all_probability(_domain text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(SUM(occurrences),0) = 0 THEN 0
    ELSE LEAST(1.0, SUM(CASE WHEN inferred_status::text IN ('catch_all','ok_for_all') THEN occurrences ELSE 0 END)::numeric
                  / NULLIF(SUM(occurrences),0))
  END
  FROM public.smtp_patterns sp
  WHERE EXISTS (SELECT 1 FROM public.verification_results r
                WHERE r.domain = _domain AND r.provider_type = sp.provider_type LIMIT 1)
$$;

CREATE OR REPLACE FUNCTION public.compute_provider_reputation(_provider text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint; v_accepts bigint; v_bounces bigint; v_grey bigint;
        v_accept_rate numeric; v_bounce_rate numeric; v_grey_rate numeric; v_score numeric;
BEGIN
  SELECT total_verifications, accepts, bounces, greylists
    INTO v_total, v_accepts, v_bounces, v_grey
    FROM public.provider_behavior WHERE provider_type = _provider;
  IF NOT FOUND OR COALESCE(v_total,0) = 0 THEN RETURN 50; END IF;
  v_accept_rate := 100.0 * v_accepts / GREATEST(v_total,1);
  v_bounce_rate := 100.0 * v_bounces / GREATEST(v_total,1);
  v_grey_rate   := 100.0 * v_grey    / GREATEST(v_total,1);
  v_score := GREATEST(0, LEAST(100, (v_accept_rate * 0.7) - (v_bounce_rate * 1.2) - (v_grey_rate * 0.3) + 30));
  UPDATE public.provider_behavior
    SET accept_rate = ROUND(v_accept_rate,2),
        bounce_rate = ROUND(v_bounce_rate,2),
        greylist_rate = ROUND(v_grey_rate,2),
        reliability_score = ROUND(v_score,2),
        recommended_concurrency = CASE WHEN v_score >= 80 THEN 10 WHEN v_score >= 60 THEN 5 WHEN v_score >= 40 THEN 3 ELSE 1 END,
        avg_retry_delay_seconds = CASE WHEN v_grey_rate > 30 THEN 600 WHEN v_grey_rate > 10 THEN 180 ELSE 60 END,
        updated_at = now()
    WHERE provider_type = _provider;
  RETURN ROUND(v_score,2);
END $$;

CREATE OR REPLACE FUNCTION public.compute_domain_intelligence(_domain text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint; v_valid bigint; v_bounces bigint; v_catch bigint; v_unk bigint;
        v_bounce_rate numeric; v_catch_rate numeric; v_rep numeric; v_provider text;
BEGIN
  SELECT COUNT(*),
    COUNT(*) FILTER (WHERE status::text IN ('valid','ok')),
    COUNT(*) FILTER (WHERE last_bounce_at IS NOT NULL),
    COUNT(*) FILTER (WHERE COALESCE(is_catch_all,false) = true OR status::text IN ('catch_all','ok_for_all')),
    COUNT(*) FILTER (WHERE status::text IN ('unknown','risky','temporary_failure','greylisted'))
    INTO v_total, v_valid, v_bounces, v_catch, v_unk
  FROM public.verification_results WHERE domain = _domain;
  IF COALESCE(v_total,0) = 0 THEN RETURN 50; END IF;
  v_bounce_rate := 100.0 * v_bounces / GREATEST(v_total,1);
  v_catch_rate  := 100.0 * v_catch   / GREATEST(v_total,1);
  v_rep := GREATEST(0, LEAST(100,
    (100.0 * v_valid / GREATEST(v_total,1)) * 0.7 - v_bounce_rate * 1.1 - (v_catch_rate * 0.2) + 20));
  SELECT provider_type INTO v_provider FROM public.verification_results
    WHERE domain = _domain AND provider_type IS NOT NULL LIMIT 1;
  INSERT INTO public.domain_intelligence (
    domain, provider_type, deliverability_score, reputation_score,
    bounce_rate, catch_all_rate, total_emails_seen,
    total_bounces, total_valid, total_catch_all, total_unknown, last_seen_at
  ) VALUES (
    _domain, v_provider, ROUND(v_rep,2), ROUND(v_rep,2),
    ROUND(v_bounce_rate,2), ROUND(v_catch_rate,2), v_total,
    v_bounces, v_valid, v_catch, v_unk, now()
  )
  ON CONFLICT (domain) DO UPDATE
    SET provider_type = COALESCE(EXCLUDED.provider_type, domain_intelligence.provider_type),
        deliverability_score = EXCLUDED.deliverability_score,
        reputation_score = EXCLUDED.reputation_score,
        bounce_rate = EXCLUDED.bounce_rate, catch_all_rate = EXCLUDED.catch_all_rate,
        total_emails_seen = EXCLUDED.total_emails_seen,
        total_bounces = EXCLUDED.total_bounces, total_valid = EXCLUDED.total_valid,
        total_catch_all = EXCLUDED.total_catch_all, total_unknown = EXCLUDED.total_unknown,
        last_seen_at = now(), updated_at = now();
  RETURN ROUND(v_rep,2);
END $$;

CREATE OR REPLACE FUNCTION public.compute_deliverability_score(_result_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
  v_status_score numeric; v_history_score numeric; v_fresh_score numeric;
  v_provider_rep numeric; v_domain_rep numeric; v_bounce_pen numeric;
  v_eng_bonus numeric; v_catch_prob numeric; v_decay numeric;
  v_final numeric; v_bounce_risk numeric;
  v_tier public.verification_risk_tier; v_fresh public.verification_freshness;
BEGIN
  SELECT * INTO r FROM public.verification_results WHERE id = _result_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_status_score := CASE r.status::text
    WHEN 'valid' THEN 100 WHEN 'ok' THEN 100
    WHEN 'catch_all' THEN 55 WHEN 'ok_for_all' THEN 55
    WHEN 'risky' THEN 35 WHEN 'unknown' THEN 30
    WHEN 'greylisted' THEN 40 WHEN 'temporary_failure' THEN 40
    WHEN 'antispam_system' THEN 25 WHEN 'smtp_protocol' THEN 20
    WHEN 'invalid' THEN 0 WHEN 'disposable' THEN 5
    WHEN 'invalid_syntax' THEN 0 WHEN 'invalid_mx' THEN 0
    WHEN 'dead_server' THEN 0 WHEN 'spamtrap' THEN 0
    WHEN 'email_disabled' THEN 5 WHEN 'provider_blocked' THEN 10
    ELSE 50 END;

  v_history_score := COALESCE((
    SELECT CASE
      WHEN bounce_count > 0 THEN GREATEST(0, 80 - bounce_count * 15)
      WHEN engagement_count > 0 THEN LEAST(100, 70 + engagement_count * 5)
      ELSE 60 END
    FROM public.email_history
    WHERE workspace_id = r.workspace_id AND email_normalized = lower(r.email)
  ), 50);

  v_fresh := public.compute_freshness(COALESCE(r.last_verified_at, r.verified_at));
  v_fresh_score := CASE v_fresh
    WHEN 'fresh' THEN 100 WHEN 'reverified' THEN 95
    WHEN 'aging' THEN 70 WHEN 'stale' THEN 40 ELSE 10 END;

  v_provider_rep := COALESCE((SELECT reliability_score FROM public.provider_behavior WHERE provider_type = r.provider_type), 50);
  v_domain_rep := COALESCE((SELECT reputation_score FROM public.domain_intelligence WHERE domain = r.domain), 50);

  v_bounce_pen := CASE WHEN r.last_bounce_at IS NOT NULL AND r.last_bounce_at > now() - interval '90 days' THEN 30 ELSE 0 END;
  v_eng_bonus := CASE WHEN r.last_reply_at IS NOT NULL THEN 10
                      WHEN r.last_open_at IS NOT NULL THEN 5 ELSE 0 END;
  v_catch_prob := COALESCE(public.compute_catch_all_probability(r.domain), 0);
  v_decay := COALESCE(public.compute_decay(r.confidence, COALESCE(r.last_verified_at, r.verified_at)), r.confidence);

  v_final := GREATEST(0, LEAST(100,
      v_status_score * 0.35 + v_history_score * 0.20 + v_fresh_score * 0.15
    + v_provider_rep * 0.10 + v_domain_rep * 0.10 + 50 * 0.05
    + v_eng_bonus - v_bounce_pen - (v_catch_prob * 15)));

  v_bounce_risk := GREATEST(0, LEAST(100,
      (100 - v_status_score) * 0.5 + v_bounce_pen + (v_catch_prob * 30)
    + (100 - v_domain_rep) * 0.3 + (100 - v_provider_rep) * 0.2));

  v_tier := CASE
    WHEN v_bounce_risk >= 75 OR v_final < 25 THEN 'critical'::public.verification_risk_tier
    WHEN v_bounce_risk >= 50 OR v_final < 50 THEN 'high'::public.verification_risk_tier
    WHEN v_bounce_risk >= 25 OR v_final < 70 THEN 'medium'::public.verification_risk_tier
    ELSE 'low'::public.verification_risk_tier END;

  UPDATE public.verification_results
    SET deliverability_score = ROUND(v_final,2),
        bounce_risk_score = ROUND(v_bounce_risk,2),
        confidence_decay_score = v_decay,
        domain_reputation_score = v_domain_rep,
        provider_reputation_score = v_provider_rep,
        catch_all_probability = ROUND(v_catch_prob,4),
        freshness_label = v_fresh,
        risk_level = v_tier
    WHERE id = _result_id;
  RETURN ROUND(v_final,2);
END $$;

CREATE OR REPLACE FUNCTION public.tg_recompute_verification_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verified_at IS NOT NULL AND (OLD.verified_at IS DISTINCT FROM NEW.verified_at OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_verified_at := COALESCE(NEW.last_verified_at, NEW.verified_at);
    PERFORM public.compute_deliverability_score(NEW.id);
    SELECT deliverability_score, bounce_risk_score, confidence_decay_score,
           domain_reputation_score, provider_reputation_score, catch_all_probability,
           freshness_label, risk_level
      INTO NEW.deliverability_score, NEW.bounce_risk_score, NEW.confidence_decay_score,
           NEW.domain_reputation_score, NEW.provider_reputation_score, NEW.catch_all_probability,
           NEW.freshness_label, NEW.risk_level
      FROM public.verification_results WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_recompute_verification_scores ON public.verification_results;
CREATE TRIGGER trg_recompute_verification_scores
  BEFORE UPDATE ON public.verification_results
  FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_verification_scores();

-- 5) Decision layer
CREATE OR REPLACE FUNCTION public.decide_verification_strategy(_workspace_id uuid, _email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text := lower(btrim(_email));
        v_hist record; v_domain text := split_part(lower(btrim(_email)),'@',2);
        v_domain_int record;
BEGIN
  SELECT * INTO v_domain_int FROM public.domain_intelligence WHERE domain = v_domain;
  IF v_domain_int.is_blocked THEN
    RETURN jsonb_build_object('strategy','skip','reason','domain_blocked','block_reason', v_domain_int.block_reason);
  END IF;
  SELECT * INTO v_hist FROM public.email_history
    WHERE workspace_id = _workspace_id AND email_normalized = v_norm;
  IF FOUND AND v_hist.last_verified_at IS NOT NULL
     AND v_hist.last_verified_at > now() - interval '30 days'
     AND COALESCE(v_hist.bounce_count,0) = 0
     AND COALESCE(v_hist.deliverability_score,0) >= 70 THEN
    RETURN jsonb_build_object('strategy','cache','reason','fresh_history',
                              'cached_status', v_hist.current_status, 'cached_score', v_hist.deliverability_score);
  END IF;
  IF FOUND AND v_hist.last_verified_at IS NOT NULL
     AND v_hist.last_verified_at > now() - interval '90 days'
     AND COALESCE(v_hist.bounce_count,0) = 0 THEN
    RETURN jsonb_build_object('strategy','light','reason','aging_history','cached_status', v_hist.current_status);
  END IF;
  IF COALESCE(v_domain_int.bounce_rate,0) > 15 OR COALESCE(v_domain_int.catch_all_rate,0) > 50 THEN
    RETURN jsonb_build_object('strategy','high_quality','reason','high_risk_domain',
                              'bounce_rate', v_domain_int.bounce_rate, 'catch_all_rate', v_domain_int.catch_all_rate);
  END IF;
  RETURN jsonb_build_object('strategy','full','reason','no_recent_signal');
END $$;

-- 6) Recovery engine
CREATE OR REPLACE FUNCTION public.schedule_recheck(_result_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_delay int; v_max_attempts int := 5;
        v_provider_mult numeric := 1; v_next timestamptz;
BEGIN
  SELECT * INTO r FROM public.verification_results WHERE id = _result_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  IF COALESCE(r.recheck_attempts,0) >= v_max_attempts THEN
    UPDATE public.verification_results
      SET recheck_required = false, dead_letter = true,
          error_message = COALESCE(error_message,'') || ' [max_recheck]'
      WHERE id = _result_id;
    RETURN jsonb_build_object('ok',false,'reason','max_recheck_attempts');
  END IF;
  v_delay := CASE _reason
    WHEN 'greylisted' THEN 300 WHEN 'temporary_failure' THEN 900
    WHEN 'antispam_system' THEN 1800 WHEN 'smtp_protocol' THEN 600
    WHEN 'unknown' THEN 3600 ELSE 600 END;
  IF r.provider_type IS NOT NULL THEN
    SELECT GREATEST(1, avg_retry_delay_seconds::numeric / 60.0) INTO v_provider_mult
      FROM public.provider_behavior WHERE provider_type = r.provider_type;
    v_provider_mult := COALESCE(v_provider_mult, 1);
  END IF;
  v_delay := (v_delay * v_provider_mult * power(1.5, COALESCE(r.recheck_attempts,0)))::int;
  v_next := now() + (v_delay || ' seconds')::interval;
  UPDATE public.verification_results
    SET recheck_required = true,
        recheck_attempts = COALESCE(recheck_attempts,0) + 1,
        next_recheck_at = v_next,
        verification_reason = _reason,
        error_message = _reason
    WHERE id = _result_id;
  RETURN jsonb_build_object('ok',true,'next_recheck_at',v_next,'attempt',COALESCE(r.recheck_attempts,0)+1);
END $$;

CREATE OR REPLACE FUNCTION public.sweep_due_rechecks(_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH due AS (
    SELECT id FROM public.verification_results
    WHERE recheck_required = true AND next_recheck_at IS NOT NULL
      AND next_recheck_at <= now() AND COALESCE(dead_letter,false) = false
    LIMIT _limit FOR UPDATE SKIP LOCKED
  )
  UPDATE public.verification_results r
    SET verified_at = NULL, processing_started_at = NULL,
        next_recheck_at = NULL, recheck_required = false,
        verification_source = 'recheck'
    FROM due d WHERE d.id = r.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 7) Rollup
CREATE OR REPLACE FUNCTION public.intelligence_rollup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p int := 0; v_d int := 0; v_f int := 0; rec record;
BEGIN
  FOR rec IN SELECT provider_type FROM public.provider_behavior LOOP
    PERFORM public.compute_provider_reputation(rec.provider_type);
    v_p := v_p + 1;
  END LOOP;
  FOR rec IN
    SELECT DISTINCT domain FROM public.verification_results
    WHERE domain IS NOT NULL
      AND (last_verified_at > now() - interval '24 hours' OR created_at > now() - interval '24 hours')
    LIMIT 2000
  LOOP
    PERFORM public.compute_domain_intelligence(rec.domain);
    v_d := v_d + 1;
  END LOOP;
  v_f := public.refresh_email_freshness_batch(5000);
  RETURN jsonb_build_object('providers_updated', v_p, 'domains_updated', v_d, 'freshness_updated', v_f);
END $$;

-- 8) Provider behavior bump
CREATE OR REPLACE FUNCTION public.bump_provider_behavior(
  _provider text, _status public.verification_status, _latency_ms numeric DEFAULT NULL, _smtp_response text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.provider_behavior (provider_type, total_verifications, accepts, rejects, greylists, catch_all_count, bounces, last_seen_at, avg_latency_ms)
  VALUES (
    COALESCE(_provider,'unknown'), 1,
    CASE WHEN _status::text IN ('valid','ok') THEN 1 ELSE 0 END,
    CASE WHEN _status::text IN ('invalid','invalid_syntax','invalid_mx','dead_server','disposable') THEN 1 ELSE 0 END,
    CASE WHEN _status::text IN ('greylisted','temporary_failure') THEN 1 ELSE 0 END,
    CASE WHEN _status::text IN ('catch_all','ok_for_all') THEN 1 ELSE 0 END,
    CASE WHEN _status::text IN ('invalid','dead_server') THEN 1 ELSE 0 END,
    now(), _latency_ms
  )
  ON CONFLICT (provider_type) DO UPDATE
    SET total_verifications = provider_behavior.total_verifications + 1,
        accepts = provider_behavior.accepts + (CASE WHEN _status::text IN ('valid','ok') THEN 1 ELSE 0 END),
        rejects = provider_behavior.rejects + (CASE WHEN _status::text IN ('invalid','invalid_syntax','invalid_mx','dead_server','disposable') THEN 1 ELSE 0 END),
        greylists = provider_behavior.greylists + (CASE WHEN _status::text IN ('greylisted','temporary_failure') THEN 1 ELSE 0 END),
        catch_all_count = provider_behavior.catch_all_count + (CASE WHEN _status::text IN ('catch_all','ok_for_all') THEN 1 ELSE 0 END),
        bounces = provider_behavior.bounces + (CASE WHEN _status::text IN ('invalid','dead_server') THEN 1 ELSE 0 END),
        avg_latency_ms = CASE WHEN _latency_ms IS NULL THEN provider_behavior.avg_latency_ms
          ELSE ((COALESCE(provider_behavior.avg_latency_ms,_latency_ms) * 0.9) + (_latency_ms * 0.1)) END,
        last_seen_at = now(), updated_at = now();
END $$;

-- 9) Campaign safety upgrade
CREATE OR REPLACE FUNCTION public.check_email_send_eligibility(_workspace_id uuid, _email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text; v_cache record; v_supp boolean; v_hist record;
        v_domain text; v_dom record;
BEGIN
  v_norm := lower(btrim(_email));
  IF v_norm IS NULL OR position('@' in v_norm) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_format', 'requires_approval', false);
  END IF;
  v_domain := split_part(v_norm,'@',2);
  SELECT EXISTS (SELECT 1 FROM public.suppression_list
    WHERE workspace_id = _workspace_id AND email_normalized = v_norm
      AND (expires_at IS NULL OR expires_at > now())) INTO v_supp;
  IF v_supp THEN RETURN jsonb_build_object('allowed', false, 'reason', 'suppressed', 'requires_approval', false); END IF;
  SELECT * INTO v_dom FROM public.domain_intelligence WHERE domain = v_domain;
  IF FOUND AND v_dom.is_blocked THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'domain_blocked', 'block_reason', v_dom.block_reason);
  END IF;
  SELECT * INTO v_hist FROM public.email_history
    WHERE workspace_id = _workspace_id AND email_normalized = v_norm;
  IF FOUND THEN
    IF COALESCE(v_hist.bounce_count,0) > 0 AND v_hist.last_bounce_at > now() - interval '180 days' THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'recent_bounce_history', 'bounce_count', v_hist.bounce_count);
    END IF;
    IF COALESCE(v_hist.deliverability_score,100) < 40 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'low_deliverability', 'score', v_hist.deliverability_score, 'recommend','revalidate');
    END IF;
    IF COALESCE(v_hist.bounce_risk_score,0) > 70 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'high_bounce_risk', 'score', v_hist.bounce_risk_score, 'recommend','revalidate');
    END IF;
    IF v_hist.risk_level IN ('high','critical') THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'high_risk', 'risk_level', v_hist.risk_level, 'recommend','revalidate');
    END IF;
    IF v_hist.freshness_label IN ('stale','expired')
       AND COALESCE(v_hist.last_verified_at, now() - interval '999 days') < now() - interval '90 days' THEN
      RETURN jsonb_build_object('allowed', true, 'requires_approval', true,
        'reason', 'stale_verification', 'recommend','revalidate', 'freshness', v_hist.freshness_label);
    END IF;
  END IF;
  SELECT * INTO v_cache FROM public.verification_cache
    WHERE email_normalized = v_norm AND cached_until > now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', true, 'reason', 'unverified', 'status', 'unknown');
  END IF;
  IF v_cache.status IN ('invalid','disposable') OR COALESCE(v_cache.is_disposable,false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', v_cache.status::text, 'status', v_cache.status);
  END IF;
  IF v_cache.status IN ('catch_all','unknown','risky') THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', true,
      'reason', v_cache.status::text, 'status', v_cache.status, 'confidence', v_cache.confidence);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'requires_approval', false,
    'status', v_cache.status, 'confidence', v_cache.confidence);
END $$;

-- 10) Claim with intelligence hints
CREATE OR REPLACE FUNCTION public.claim_verification_batch(_limit integer DEFAULT 50)
RETURNS TABLE(
  result_id uuid, job_id uuid, workspace_id uuid, email text, domain text,
  quality_mode public.verification_quality_mode, provider_hint text,
  recommended_concurrency integer, retry_delay_seconds integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  WITH due AS (
    SELECT r.id
    FROM public.verification_results r
    JOIN public.verification_jobs j ON j.id = r.job_id
    WHERE r.from_cache = false AND r.verified_at IS NULL
      AND COALESCE(r.dead_letter, false) = false
      AND j.status IN ('pending','processing','partial')
    ORDER BY r.created_at ASC LIMIT _limit FOR UPDATE SKIP LOCKED
  )
  UPDATE public.verification_jobs j
     SET status = 'processing', started_at = COALESCE(started_at, now()), updated_at = now()
    FROM due d JOIN public.verification_results r ON r.id = d.id
   WHERE j.id = r.job_id AND j.status = 'pending';

  RETURN QUERY
  SELECT r.id, r.job_id, r.workspace_id, r.email, r.domain,
         COALESCE(j.verification_quality,'standard'::public.verification_quality_mode),
         COALESCE(di.provider_type, r.provider_type),
         COALESCE(pb.recommended_concurrency, 5),
         COALESCE(pb.avg_retry_delay_seconds, 60)
    FROM public.verification_results r
    JOIN public.verification_jobs j ON j.id = r.job_id
    LEFT JOIN public.domain_intelligence di ON di.domain = r.domain
    LEFT JOIN public.provider_behavior pb ON pb.provider_type = COALESCE(di.provider_type, r.provider_type)
   WHERE r.from_cache = false AND r.verified_at IS NULL
     AND COALESCE(r.dead_letter, false) = false
     AND j.status IN ('pending','processing','partial')
   ORDER BY r.created_at ASC LIMIT _limit;
END $$;

-- 11) Cron
DO $$ BEGIN PERFORM cron.unschedule('verification-recheck-sweeper'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('verification-intelligence-rollup'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('verification-recheck-sweeper', '* * * * *', $cron$ SELECT public.sweep_due_rechecks(500); $cron$);
SELECT cron.schedule('verification-intelligence-rollup', '*/5 * * * *', $cron$ SELECT public.intelligence_rollup(); $cron$);
