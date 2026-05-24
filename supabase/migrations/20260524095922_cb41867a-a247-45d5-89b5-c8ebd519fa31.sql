
-- 1. Replace safety function with a stricter, structured result
CREATE OR REPLACE FUNCTION public.check_campaign_list_safety(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0;
  v_invalid int := 0;
  v_disposable int := 0;
  v_suppressed int := 0;
  v_unknown int := 0;
  v_catch_all int := 0;
  v_risky int := 0;
  v_high_risk int := 0;
  v_risk numeric;
  v_warnings text[] := '{}';
  v_blocked boolean := false;
BEGIN
  WITH ce AS (
    SELECT ct.email, ct.id AS contact_id
    FROM public.campaign_enrollments e
    JOIN public.contacts ct ON ct.id = e.contact_id
    WHERE e.campaign_id = _campaign_id AND e.status = 'active'
  ),
  vr AS (
    SELECT DISTINCT ON (lower(c.email))
      lower(c.email) AS em,
      r.status,
      r.is_disposable,
      r.is_catch_all,
      r.ai_risk_score
    FROM ce c
    LEFT JOIN public.verification_results r ON r.email_normalized = lower(c.email)
    ORDER BY lower(c.email), r.verified_at DESC NULLS LAST
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'invalid'),
    COUNT(*) FILTER (WHERE status = 'disposable' OR is_disposable = true),
    COUNT(*) FILTER (WHERE status IS NULL OR status IN ('unknown','failed')),
    COUNT(*) FILTER (WHERE status = 'catch_all' OR is_catch_all = true),
    COUNT(*) FILTER (WHERE status = 'risky'),
    COUNT(*) FILTER (WHERE ai_risk_score IS NOT NULL AND ai_risk_score >= 0.75)
    INTO v_total, v_invalid, v_disposable, v_unknown, v_catch_all, v_risky, v_high_risk
  FROM vr;

  SELECT COUNT(*) INTO v_suppressed
    FROM public.campaign_enrollments e
    JOIN public.contacts ct ON ct.id = e.contact_id
    JOIN public.suppression_list s
      ON s.email_normalized = lower(ct.email)
     AND s.workspace_id IN (SELECT workspace_id FROM public.campaigns WHERE id = _campaign_id)
   WHERE e.campaign_id = _campaign_id;

  v_risk := CASE WHEN v_total = 0 THEN 0 ELSE
    ROUND(100.0 * (v_invalid + v_disposable + v_suppressed + v_high_risk) / v_total, 2) END;

  -- HARD BLOCKS (cannot launch)
  IF v_invalid > 0 THEN
    v_warnings := array_append(v_warnings, format('blocked:%s invalid email(s) must be removed', v_invalid));
    v_blocked := true;
  END IF;
  IF v_disposable > 0 THEN
    v_warnings := array_append(v_warnings, format('blocked:%s disposable email(s) must be removed', v_disposable));
    v_blocked := true;
  END IF;
  IF v_suppressed > 0 THEN
    v_warnings := array_append(v_warnings, format('blocked:%s suppressed contact(s) must be removed', v_suppressed));
    v_blocked := true;
  END IF;
  IF v_high_risk > 0 THEN
    v_warnings := array_append(v_warnings, format('blocked:%s high-risk contact(s) (AI risk ≥ 0.75)', v_high_risk));
    v_blocked := true;
  END IF;

  -- WARNINGS (manual approval required)
  IF v_catch_all > 0 THEN
    v_warnings := array_append(v_warnings, format('%s catch-all domain(s) — delivery not guaranteed', v_catch_all));
  END IF;
  IF v_risky > 0 THEN
    v_warnings := array_append(v_warnings, format('%s risky email(s) — review recommended', v_risky));
  END IF;
  IF v_unknown::numeric / GREATEST(v_total,1) > 0.25 THEN
    v_warnings := array_append(v_warnings,
      format('%s unverified contact(s) — run verification before launch', v_unknown));
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'invalid', v_invalid,
    'disposable', v_disposable,
    'suppressed', v_suppressed,
    'unknown', v_unknown,
    'catch_all', v_catch_all,
    'risky', v_risky,
    'high_risk', v_high_risk,
    'risk_score', v_risk,
    'warnings', v_warnings,
    'blocked', v_blocked,
    'recommend_block', v_blocked OR v_risk >= 40
  );
END $function$;

-- 2. Server-side enforcement: block status transition to active/running/scheduled
-- when the safety check returns blocked=true. Platform admins can override.
CREATE OR REPLACE FUNCTION public.enforce_campaign_safety_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_safety jsonb;
  v_active_states text[] := ARRAY['active','running','scheduled','launched'];
BEGIN
  -- Only check when status is changing INTO an active-like state
  IF NEW.status::text = ANY(v_active_states)
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text)
     AND NOT (OLD.status::text = ANY(v_active_states)) THEN

    -- Platform admins can bypass for support
    IF auth.uid() IS NOT NULL AND public.is_platform_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;

    v_safety := public.check_campaign_list_safety(NEW.id);
    IF (v_safety->>'blocked')::boolean THEN
      RAISE EXCEPTION 'Campaign launch blocked by verification safety check: %',
        v_safety->'warnings'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_campaign_safety ON public.campaigns;
CREATE TRIGGER trg_enforce_campaign_safety
  BEFORE INSERT OR UPDATE OF status ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_safety_on_activation();
