
-- Rewrite trigger to compute scores inline (no nested UPDATE on same row).
-- Root cause of "tuple to be updated was already modified" errors flooding verification-worker-api.

CREATE OR REPLACE FUNCTION public.tg_recompute_verification_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_score numeric; v_history_score numeric; v_fresh_score numeric;
  v_provider_rep numeric; v_domain_rep numeric; v_bounce_pen numeric;
  v_eng_bonus numeric; v_catch_prob numeric; v_decay numeric;
  v_final numeric; v_bounce_risk numeric;
  v_tier public.verification_risk_tier; v_fresh public.verification_freshness;
BEGIN
  IF NEW.verified_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.verified_at IS NOT DISTINCT FROM NEW.verified_at
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  NEW.last_verified_at := COALESCE(NEW.last_verified_at, NEW.verified_at);

  v_status_score := CASE NEW.status::text
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
    WHERE workspace_id = NEW.workspace_id AND email_normalized = lower(NEW.email)
  ), 50);

  v_fresh := public.compute_freshness(COALESCE(NEW.last_verified_at, NEW.verified_at));
  v_fresh_score := CASE v_fresh
    WHEN 'fresh' THEN 100 WHEN 'reverified' THEN 95
    WHEN 'aging' THEN 70 WHEN 'stale' THEN 40 ELSE 10 END;

  v_provider_rep := COALESCE(
    (SELECT reliability_score FROM public.provider_behavior WHERE provider_type = NEW.provider_type),
    50);
  v_domain_rep := COALESCE(
    (SELECT reputation_score FROM public.domain_intelligence WHERE domain = NEW.domain),
    50);

  v_bounce_pen := CASE WHEN NEW.last_bounce_at IS NOT NULL
                        AND NEW.last_bounce_at > now() - interval '90 days' THEN 30 ELSE 0 END;
  v_eng_bonus := CASE WHEN NEW.last_reply_at IS NOT NULL THEN 10
                      WHEN NEW.last_open_at IS NOT NULL THEN 5 ELSE 0 END;
  v_catch_prob := COALESCE(public.compute_catch_all_probability(NEW.domain), 0);
  v_decay := COALESCE(
    public.compute_decay(NEW.confidence, COALESCE(NEW.last_verified_at, NEW.verified_at)),
    NEW.confidence);

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

  NEW.deliverability_score := ROUND(v_final, 2);
  NEW.bounce_risk_score := ROUND(v_bounce_risk, 2);
  NEW.confidence_decay_score := v_decay;
  NEW.domain_reputation_score := v_domain_rep;
  NEW.provider_reputation_score := v_provider_rep;
  NEW.catch_all_probability := ROUND(v_catch_prob, 4);
  NEW.freshness_label := v_fresh;
  NEW.risk_level := v_tier;

  RETURN NEW;
END
$function$;
