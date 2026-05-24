
-- ============================================================
-- PHASE 1: Verification infrastructure expansion
-- ============================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.bounce_category AS ENUM (
    'hard_bounce','soft_bounce','mailbox_full','spam_block',
    'greylisted','invalid_recipient','policy_block','temporary_failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_risk_tier AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_engine_kind AS ENUM ('primary','fallback','consensus','ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_worker_status AS ENUM ('online','idle','degraded','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. EXTEND EXISTING TABLES (additive only)

ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS primary_engine text,
  ADD COLUMN IF NOT EXISTS fallback_engine text,
  ADD COLUMN IF NOT EXISTS engine_latency_ms integer,
  ADD COLUMN IF NOT EXISTS engine_consensus_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS engine_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_risk_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS behavioral_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS historical_outcome_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS engagement_correlation numeric(5,2),
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id text;

CREATE INDEX IF NOT EXISTS idx_vresults_dead_letter
  ON public.verification_results(workspace_id, dead_letter) WHERE dead_letter = true;
CREATE INDEX IF NOT EXISTS idx_vresults_next_retry
  ON public.verification_results(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vresults_processing
  ON public.verification_results(processing_started_at) WHERE processing_started_at IS NOT NULL;

ALTER TABLE public.verification_jobs
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dead_letter_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_latency_ms numeric(10,2),
  ADD COLUMN IF NOT EXISTS cache_hit_rate numeric(5,2);

ALTER TABLE public.domain_reputation
  ADD COLUMN IF NOT EXISTS total_verified integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invalid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bounces integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_catch_all integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smtp_accept_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS bounce_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS provider_type text,
  ADD COLUMN IF NOT EXISTS mx_host text,
  ADD COLUMN IF NOT EXISTS mx_region text,
  ADD COLUMN IF NOT EXISTS suspicious_pattern_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS last_seen_active timestamptz,
  ADD COLUMN IF NOT EXISTS temporary_failure_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS risk_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS risk_tier public.verification_risk_tier,
  ADD COLUMN IF NOT EXISTS catch_all_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS catch_all_delivery_success_rate numeric(5,2);

CREATE INDEX IF NOT EXISTS idx_dr_risk_tier ON public.domain_reputation(risk_tier);
CREATE INDEX IF NOT EXISTS idx_dr_provider ON public.domain_reputation(provider_type);

ALTER TABLE public.bounce_feedback
  ADD COLUMN IF NOT EXISTS bounce_category public.bounce_category,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bf_category ON public.bounce_feedback(bounce_category, received_at DESC);

-- 3. NEW TABLES

-- 3a. verification_engines (global registry)
CREATE TABLE IF NOT EXISTS public.verification_engines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind public.verification_engine_kind NOT NULL DEFAULT 'primary',
  version text,
  is_active boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL DEFAULT 5,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_heartbeat_at timestamptz,
  status public.verification_worker_status NOT NULL DEFAULT 'offline',
  avg_latency_ms numeric(10,2),
  success_rate numeric(5,2),
  total_runs bigint NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_engines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ve_select ON public.verification_engines FOR SELECT TO authenticated USING (true);
CREATE POLICY ve_admin_write ON public.verification_engines FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_ve_updated BEFORE UPDATE ON public.verification_engines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3b. verification_engine_runs (per-result per-engine)
CREATE TABLE IF NOT EXISTS public.verification_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.verification_results(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  engine_name text NOT NULL,
  engine_version text,
  status public.verification_status,
  confidence numeric(5,2),
  latency_ms integer,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ver_runs_result ON public.verification_engine_runs(result_id);
CREATE INDEX IF NOT EXISTS idx_ver_runs_ws_engine ON public.verification_engine_runs(workspace_id, engine_name, created_at DESC);
ALTER TABLE public.verification_engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ver_runs_select ON public.verification_engine_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY ver_runs_insert ON public.verification_engine_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- 3c. provider_behavior_rules
CREATE TABLE IF NOT EXISTS public.provider_behavior_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL,
  rule_key text NOT NULL,
  rule_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_type, rule_key)
);
ALTER TABLE public.provider_behavior_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbr_select ON public.provider_behavior_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY pbr_admin_write ON public.provider_behavior_rules FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_pbr_updated BEFORE UPDATE ON public.provider_behavior_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3d. verification_workers (heartbeat registry)
CREATE TABLE IF NOT EXISTS public.verification_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL UNIQUE,
  host text,
  version text,
  status public.verification_worker_status NOT NULL DEFAULT 'offline',
  last_heartbeat_at timestamptz,
  claimed_batch_size integer DEFAULT 0,
  in_flight_count integer DEFAULT 0,
  total_processed bigint NOT NULL DEFAULT 0,
  avg_latency_ms numeric(10,2),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY vw_select ON public.verification_workers FOR SELECT TO authenticated USING (true);
CREATE POLICY vw_admin_write ON public.verification_workers FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_vw_updated BEFORE UPDATE ON public.verification_workers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3e. verification_audit_log
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_val_ws_time ON public.verification_audit_log(workspace_id, created_at DESC);
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY val_select ON public.verification_audit_log FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY val_insert ON public.verification_audit_log FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- 3f. verification_quotas (one row per workspace)
CREATE TABLE IF NOT EXISTS public.verification_quotas (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL DEFAULT 50000,
  monthly_limit integer NOT NULL DEFAULT 1000000,
  used_today integer NOT NULL DEFAULT 0,
  used_month integer NOT NULL DEFAULT 0,
  day_reset_at date NOT NULL DEFAULT CURRENT_DATE,
  month_reset_at date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  abuse_flagged boolean NOT NULL DEFAULT false,
  abuse_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vq_select ON public.verification_quotas FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY vq_admin_manage ON public.verification_quotas FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.workspace_role(auth.uid(), workspace_id) IN ('admin'::public.app_role,'manager'::public.app_role)
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.workspace_role(auth.uid(), workspace_id) IN ('admin'::public.app_role,'manager'::public.app_role)
  );
CREATE TRIGGER trg_vq_updated BEFORE UPDATE ON public.verification_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3g. verification_dead_letter
CREATE TABLE IF NOT EXISTS public.verification_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  result_id uuid REFERENCES public.verification_results(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.verification_jobs(id) ON DELETE SET NULL,
  email text NOT NULL,
  reason text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalated_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_vdl_ws ON public.verification_dead_letter(workspace_id, escalated_at DESC);
ALTER TABLE public.verification_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY vdl_select ON public.verification_dead_letter FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY vdl_insert ON public.verification_dead_letter FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY vdl_update ON public.verification_dead_letter FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- 4. HELPER FUNCTIONS

-- 4a. compute_domain_risk
CREATE OR REPLACE FUNCTION public.compute_domain_risk(_domain text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int; v_invalid int; v_bounces int; v_catch int;
  v_bounce_rate numeric; v_accept_rate numeric; v_risk numeric;
  v_tier public.verification_risk_tier;
BEGIN
  SELECT total_verifications, invalid_count, bounce_count, COALESCE(total_catch_all,0)
    INTO v_total, v_invalid, v_bounces, v_catch
    FROM public.domain_reputation WHERE domain = _domain;
  IF NOT FOUND OR v_total = 0 THEN
    RETURN jsonb_build_object('risk', 0, 'tier','low');
  END IF;

  v_bounce_rate := ROUND(100.0 * v_bounces / GREATEST(v_total,1), 2);
  v_accept_rate := ROUND(100.0 * GREATEST(v_total - v_invalid - v_bounces, 0) / GREATEST(v_total,1), 2);

  v_risk := LEAST(100,
    (v_bounce_rate * 0.6)
    + ((100 - v_accept_rate) * 0.3)
    + (CASE WHEN v_catch > 0 THEN 10 ELSE 0 END)
  );

  v_tier := CASE
    WHEN v_risk >= 75 THEN 'critical'::public.verification_risk_tier
    WHEN v_risk >= 50 THEN 'high'::public.verification_risk_tier
    WHEN v_risk >= 25 THEN 'medium'::public.verification_risk_tier
    ELSE 'low'::public.verification_risk_tier
  END;

  UPDATE public.domain_reputation
    SET bounce_rate = v_bounce_rate,
        smtp_accept_rate = v_accept_rate,
        risk_score = v_risk,
        risk_tier = v_tier,
        total_verified = v_total,
        total_invalid = v_invalid,
        total_bounces = v_bounces,
        updated_at = now()
    WHERE domain = _domain;

  RETURN jsonb_build_object('risk', v_risk, 'tier', v_tier, 'bounce_rate', v_bounce_rate, 'accept_rate', v_accept_rate);
END $$;

-- 4b. record_bounce — feedback loop
CREATE OR REPLACE FUNCTION public.record_bounce(
  _workspace_id uuid,
  _email text,
  _category public.bounce_category,
  _smtp_code int DEFAULT NULL,
  _smtp_response text DEFAULT NULL,
  _provider text DEFAULT NULL,
  _campaign_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_soft_count int;
  v_escalated boolean := false;
  v_bounce_type text;
BEGIN
  v_domain := split_part(lower(_email), '@', 2);
  v_bounce_type := CASE
    WHEN _category IN ('hard_bounce','invalid_recipient','policy_block','spam_block') THEN 'hard'
    ELSE 'soft' END;

  INSERT INTO public.bounce_feedback(
    workspace_id, email_normalized, bounce_type, bounce_category,
    smtp_code, smtp_response, provider, campaign_id, source
  )
  VALUES (_workspace_id, lower(_email), v_bounce_type, _category,
          _smtp_code, _smtp_response, _provider, _campaign_id, COALESCE(_provider,'smtp'));

  -- Update domain rep counters
  INSERT INTO public.domain_reputation(domain, bounce_count, total_verifications)
  VALUES (v_domain, 1, 1)
  ON CONFLICT (domain) DO UPDATE
    SET bounce_count = domain_reputation.bounce_count + 1,
        total_bounces = COALESCE(domain_reputation.total_bounces,0) + 1,
        updated_at = now();

  -- Auto-suppress on hard bounce categories
  IF v_bounce_type = 'hard' THEN
    INSERT INTO public.suppression_list(workspace_id, email_normalized, reason, source)
    VALUES (_workspace_id, lower(_email), 'bounce_'|| _category::text, 'bounce_feedback')
    ON CONFLICT (workspace_id, email_normalized) DO NOTHING;
    v_escalated := true;
  ELSE
    -- Escalate after 3 soft bounces in 30 days
    SELECT COUNT(*) INTO v_soft_count
      FROM public.bounce_feedback
      WHERE workspace_id = _workspace_id
        AND email_normalized = lower(_email)
        AND bounce_type = 'soft'
        AND received_at >= now() - interval '30 days';
    IF v_soft_count >= 3 THEN
      INSERT INTO public.suppression_list(workspace_id, email_normalized, reason, source)
      VALUES (_workspace_id, lower(_email), 'repeated_soft_bounce', 'bounce_feedback')
      ON CONFLICT (workspace_id, email_normalized) DO NOTHING;
      UPDATE public.bounce_feedback SET escalated = true
        WHERE id = (SELECT id FROM public.bounce_feedback
                    WHERE workspace_id = _workspace_id AND email_normalized = lower(_email)
                    ORDER BY received_at DESC LIMIT 1);
      v_escalated := true;
    END IF;
  END IF;

  -- Refresh domain risk
  PERFORM public.compute_domain_risk(v_domain);

  RETURN jsonb_build_object('ok', true, 'escalated', v_escalated, 'domain', v_domain);
END $$;

-- 4c. compute_list_health for a job
CREATE OR REPLACE FUNCTION public.compute_list_health(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j record;
  v_quality numeric; v_bounce_prob numeric; v_inbox_risk numeric; v_provider_risk numeric;
  v_warnings text[] := '{}';
BEGIN
  SELECT * INTO v_j FROM public.verification_jobs WHERE id = _job_id;
  IF NOT FOUND OR v_j.total_count = 0 THEN
    RETURN jsonb_build_object('list_quality_score', 0, 'warnings', ARRAY['Job not found or empty']);
  END IF;

  v_quality := ROUND(100.0 * (v_j.safe_count + v_j.valid_count) / GREATEST(v_j.total_count,1), 2);
  v_bounce_prob := ROUND(100.0 * (v_j.invalid_count + v_j.disposable_count) / GREATEST(v_j.total_count,1), 2);
  v_inbox_risk := ROUND(100.0 * (v_j.risky_count + v_j.catch_all_count + v_j.unknown_count) / GREATEST(v_j.total_count,1), 2);
  v_provider_risk := ROUND((v_inbox_risk * 0.5 + v_bounce_prob * 0.5), 2);

  IF v_quality < 70 THEN v_warnings := array_append(v_warnings, 'List quality below 70%'); END IF;
  IF v_bounce_prob > 10 THEN v_warnings := array_append(v_warnings, 'Estimated bounce > 10%'); END IF;
  IF v_inbox_risk > 25 THEN v_warnings := array_append(v_warnings, 'High inbox-placement risk'); END IF;
  IF v_j.catch_all_count > v_j.total_count * 0.4 THEN
    v_warnings := array_append(v_warnings, 'Heavy catch-all concentration'); END IF;

  RETURN jsonb_build_object(
    'list_quality_score', v_quality,
    'bounce_probability', v_bounce_prob,
    'inbox_risk', v_inbox_risk,
    'provider_trust_risk', v_provider_risk,
    'warnings', v_warnings
  );
END $$;

-- 4d. check_campaign_list_safety
CREATE OR REPLACE FUNCTION public.check_campaign_list_safety(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_invalid int := 0;
  v_disposable int := 0;
  v_suppressed int := 0;
  v_unknown int := 0;
  v_risk numeric;
  v_warnings text[] := '{}';
BEGIN
  -- Count enrolled contacts by verification status
  WITH ce AS (
    SELECT ct.email FROM public.campaign_enrollments e
    JOIN public.contacts ct ON ct.id = e.contact_id
    WHERE e.campaign_id = _campaign_id AND e.status = 'active'
  ),
  vr AS (
    SELECT DISTINCT ON (lower(c.email)) lower(c.email) AS em, r.status
    FROM ce c
    LEFT JOIN public.verification_results r ON r.email_normalized = lower(c.email)
    ORDER BY lower(c.email), r.verified_at DESC NULLS LAST
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'invalid'),
    COUNT(*) FILTER (WHERE status = 'disposable'),
    COUNT(*) FILTER (WHERE status IS NULL OR status IN ('unknown','failed'))
    INTO v_total, v_invalid, v_disposable, v_unknown
  FROM vr;

  SELECT COUNT(*) INTO v_suppressed
    FROM public.campaign_enrollments e
    JOIN public.contacts ct ON ct.id = e.contact_id
    JOIN public.suppression_list s
      ON s.email_normalized = lower(ct.email)
     AND s.workspace_id IN (SELECT workspace_id FROM public.campaigns WHERE id = _campaign_id)
   WHERE e.campaign_id = _campaign_id;

  v_risk := CASE WHEN v_total = 0 THEN 0 ELSE
    ROUND(100.0 * (v_invalid + v_disposable + v_suppressed) / v_total, 2) END;

  IF v_invalid + v_disposable > 0 THEN
    v_warnings := array_append(v_warnings, format('%s invalid/disposable contacts will be skipped', v_invalid + v_disposable));
  END IF;
  IF v_suppressed > 0 THEN
    v_warnings := array_append(v_warnings, format('%s suppressed contacts will be skipped', v_suppressed));
  END IF;
  IF v_unknown::numeric / GREATEST(v_total,1) > 0.25 THEN
    v_warnings := array_append(v_warnings, 'Over 25% of contacts have no verification — quality is unknown');
  END IF;

  RETURN jsonb_build_object(
    'total', v_total, 'invalid', v_invalid, 'disposable', v_disposable,
    'suppressed', v_suppressed, 'unknown', v_unknown,
    'risk_score', v_risk, 'warnings', v_warnings,
    'recommend_block', v_risk >= 40
  );
END $$;

-- 4e. recover_stuck_verification_jobs (cron)
CREATE OR REPLACE FUNCTION public.recover_stuck_verification_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_requeued int := 0; v_dead int := 0;
BEGIN
  -- Requeue rows stuck in processing > 15 min
  WITH stuck AS (
    UPDATE public.verification_results
    SET processing_started_at = NULL, worker_id = NULL,
        attempt_count = attempt_count + 1,
        next_retry_at = now() + (LEAST(attempt_count + 1, 6) * interval '2 minutes')
    WHERE processing_started_at IS NOT NULL
      AND processing_started_at < now() - interval '15 minutes'
      AND status = 'unknown'
      AND dead_letter = false
      AND attempt_count < 5
    RETURNING id
  )
  SELECT COUNT(*) INTO v_requeued FROM stuck;

  -- Move repeatedly failed rows to dead letter
  WITH dead AS (
    UPDATE public.verification_results r
    SET dead_letter = true
    WHERE attempt_count >= 5 AND dead_letter = false AND status = 'unknown'
    RETURNING r.id, r.workspace_id, r.job_id, r.email, r.attempt_count, r.error_message
  )
  INSERT INTO public.verification_dead_letter(workspace_id, result_id, job_id, email, reason, attempt_count, last_error)
  SELECT workspace_id, id, job_id, email, 'max_attempts_exceeded', attempt_count, error_message FROM dead
  RETURNING 1 INTO v_dead;
  GET DIAGNOSTICS v_dead = ROW_COUNT;

  RETURN jsonb_build_object('requeued', v_requeued, 'dead_letter', v_dead);
END $$;

-- 4f. consume_verification_quota
CREATE OR REPLACE FUNCTION public.consume_verification_quota(_workspace_id uuid, _count int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_q record; v_today date := CURRENT_DATE;
BEGIN
  INSERT INTO public.verification_quotas(workspace_id) VALUES (_workspace_id)
    ON CONFLICT (workspace_id) DO NOTHING;

  SELECT * INTO v_q FROM public.verification_quotas WHERE workspace_id = _workspace_id FOR UPDATE;

  -- Reset windows
  IF v_q.day_reset_at < v_today THEN
    UPDATE public.verification_quotas SET used_today = 0, day_reset_at = v_today WHERE workspace_id = _workspace_id;
    v_q.used_today := 0;
  END IF;
  IF v_q.month_reset_at < date_trunc('month', v_today)::date THEN
    UPDATE public.verification_quotas SET used_month = 0, month_reset_at = date_trunc('month', v_today)::date WHERE workspace_id = _workspace_id;
    v_q.used_month := 0;
  END IF;

  IF v_q.abuse_flagged THEN
    RETURN jsonb_build_object('ok', false, 'reason','abuse_flagged');
  END IF;
  IF v_q.used_today + _count > v_q.daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason','daily_limit_exceeded',
                              'remaining', GREATEST(v_q.daily_limit - v_q.used_today, 0));
  END IF;
  IF v_q.used_month + _count > v_q.monthly_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason','monthly_limit_exceeded',
                              'remaining', GREATEST(v_q.monthly_limit - v_q.used_month, 0));
  END IF;

  UPDATE public.verification_quotas
    SET used_today = used_today + _count,
        used_month = used_month + _count,
        updated_at = now()
    WHERE workspace_id = _workspace_id;

  -- Abuse signal: > 5x daily limit attempt in a single call
  IF _count > v_q.daily_limit * 5 THEN
    UPDATE public.verification_quotas SET abuse_flagged = true,
      abuse_reason = 'oversized batch request' WHERE workspace_id = _workspace_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'used_today', v_q.used_today + _count, 'used_month', v_q.used_month + _count);
END $$;

-- 4g. worker_heartbeat (called by external worker)
CREATE OR REPLACE FUNCTION public.worker_heartbeat(
  _worker_id text,
  _status public.verification_worker_status DEFAULT 'online',
  _in_flight int DEFAULT 0,
  _batch_size int DEFAULT 0,
  _avg_latency numeric DEFAULT NULL,
  _version text DEFAULT NULL,
  _host text DEFAULT NULL,
  _last_error text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.verification_workers(
    worker_id, status, in_flight_count, claimed_batch_size, avg_latency_ms,
    version, host, last_error, metadata, last_heartbeat_at
  )
  VALUES (_worker_id, _status, _in_flight, _batch_size, _avg_latency,
          _version, _host, _last_error, _metadata, now())
  ON CONFLICT (worker_id) DO UPDATE SET
    status = EXCLUDED.status,
    in_flight_count = EXCLUDED.in_flight_count,
    claimed_batch_size = EXCLUDED.claimed_batch_size,
    avg_latency_ms = COALESCE(EXCLUDED.avg_latency_ms, verification_workers.avg_latency_ms),
    version = COALESCE(EXCLUDED.version, verification_workers.version),
    host = COALESCE(EXCLUDED.host, verification_workers.host),
    last_error = COALESCE(EXCLUDED.last_error, verification_workers.last_error),
    metadata = EXCLUDED.metadata,
    last_heartbeat_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 4h. workspace_verification_overview (read view-like RPC for dashboard)
CREATE OR REPLACE FUNCTION public.workspace_verification_overview(_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.is_workspace_member_or_admin(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  WITH j AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'processing') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= now() - interval '24 hours') AS completed_24h,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      SUM(processed_count) FILTER (WHERE created_at >= now() - interval '24 hours') AS processed_24h,
      SUM(cached_hit_count) FILTER (WHERE created_at >= now() - interval '24 hours') AS cached_24h,
      AVG(list_quality_score) FILTER (WHERE status = 'completed') AS avg_quality
    FROM public.verification_jobs WHERE workspace_id = _workspace_id
  ),
  r AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'invalid' AND created_at >= now() - interval '7 days') AS invalid_7d,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS total_7d,
      AVG(engine_latency_ms) FILTER (WHERE engine_latency_ms IS NOT NULL AND created_at >= now() - interval '24 hours') AS avg_latency,
      COUNT(*) FILTER (WHERE dead_letter = true) AS dead_letter
    FROM public.verification_results WHERE workspace_id = _workspace_id
  ),
  b AS (
    SELECT COUNT(*) AS bounces_7d FROM public.bounce_feedback
    WHERE workspace_id = _workspace_id AND received_at >= now() - interval '7 days'
  ),
  s AS (
    SELECT COUNT(*) AS suppressed FROM public.suppression_list WHERE workspace_id = _workspace_id
  ),
  q AS (
    SELECT * FROM public.verification_quotas WHERE workspace_id = _workspace_id
  )
  SELECT jsonb_build_object(
    'jobs_in_progress', COALESCE(j.in_progress,0),
    'jobs_completed_24h', COALESCE(j.completed_24h,0),
    'jobs_failed', COALESCE(j.failed,0),
    'processed_24h', COALESCE(j.processed_24h,0),
    'cache_hits_24h', COALESCE(j.cached_24h,0),
    'cache_hit_rate', CASE WHEN COALESCE(j.processed_24h,0) > 0
        THEN ROUND(100.0 * COALESCE(j.cached_24h,0) / j.processed_24h, 2) ELSE 0 END,
    'avg_list_quality', ROUND(COALESCE(j.avg_quality,0)::numeric, 2),
    'invalid_rate_7d', CASE WHEN COALESCE(r.total_7d,0) > 0
        THEN ROUND(100.0 * COALESCE(r.invalid_7d,0) / r.total_7d, 2) ELSE 0 END,
    'avg_engine_latency_ms', ROUND(COALESCE(r.avg_latency,0)::numeric, 2),
    'dead_letter_count', COALESCE(r.dead_letter,0),
    'bounces_7d', COALESCE(b.bounces_7d,0),
    'suppression_size', COALESCE(s.suppressed,0),
    'quota', CASE WHEN q.workspace_id IS NULL THEN NULL ELSE
      jsonb_build_object('used_today', q.used_today, 'daily_limit', q.daily_limit,
                         'used_month', q.used_month, 'monthly_limit', q.monthly_limit,
                         'abuse_flagged', q.abuse_flagged)
    END
  ) INTO v_out FROM j, r, b, s LEFT JOIN q ON true;
  RETURN v_out;
END $$;

-- 5. Seed default verification engines + provider rules

INSERT INTO public.verification_engines(name, kind, version, is_active, priority, status, notes)
VALUES
  ('internal_smtp_v1', 'primary', '1.0.0', false, 1, 'offline', 'Default primary engine — connect an external SMTP verifier worker.'),
  ('truemail_go', 'fallback', '0.0.0', false, 2, 'offline', 'Optional self-hosted truemail-go fallback.'),
  ('consensus_v1', 'consensus', '1.0.0', false, 3, 'offline', 'Combines primary + fallback results for conflict detection.'),
  ('ai_risk_v0', 'ai', '0.0.0', false, 9, 'offline', 'Reserved for future AI risk model.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.provider_behavior_rules(provider_type, rule_key, rule_value, notes) VALUES
  ('google',     'throttle_per_minute',   '{"value":120}'::jsonb, 'Google Workspace SMTP throttle hint'),
  ('google',     'greylisting_retry_min', '{"value":15}'::jsonb,   NULL),
  ('microsoft',  'throttle_per_minute',   '{"value":60}'::jsonb,   'Microsoft 365 / Exchange Online'),
  ('microsoft',  'requires_helo',         '{"value":true}'::jsonb, NULL),
  ('yahoo',      'throttle_per_minute',   '{"value":30}'::jsonb,   NULL),
  ('proton',     'block_smtp_probe',      '{"value":true}'::jsonb, 'ProtonMail blocks SMTP verification probes'),
  ('zoho',       'throttle_per_minute',   '{"value":60}'::jsonb,   NULL),
  ('proofpoint', 'sender_reputation_strict','{"value":true}'::jsonb,'Proofpoint enforces sender reputation strictly'),
  ('mimecast',   'sender_reputation_strict','{"value":true}'::jsonb,NULL),
  ('cisco_esa',  'sender_reputation_strict','{"value":true}'::jsonb,NULL)
ON CONFLICT (provider_type, rule_key) DO NOTHING;
