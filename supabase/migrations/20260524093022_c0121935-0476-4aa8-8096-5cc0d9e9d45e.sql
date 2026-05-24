
-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM (
    'safe','valid','invalid','risky','catch_all','disposable',
    'role_based','unknown','suppressed','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_job_status AS ENUM (
    'pending','processing','partial','completed','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_job_source AS ENUM (
    'csv_upload','import_clean','campaign_precheck','single_lookup','api','recheck'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── verification_jobs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  source public.verification_job_source NOT NULL DEFAULT 'csv_upload',
  status public.verification_job_status NOT NULL DEFAULT 'pending',
  total_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  cached_hit_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  safe_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  risky_count integer NOT NULL DEFAULT 0,
  catch_all_count integer NOT NULL DEFAULT 0,
  disposable_count integer NOT NULL DEFAULT 0,
  role_based_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  list_quality_score numeric(5,2),
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  max_retries integer NOT NULL DEFAULT 2,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  list_id uuid,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vjobs_ws_status ON public.verification_jobs(workspace_id, status, created_at DESC);

-- ── verification_results (one row per email per job) ───────────────────────
CREATE TABLE IF NOT EXISTS public.verification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.verification_jobs(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(email)) STORED,
  domain text,
  status public.verification_status NOT NULL DEFAULT 'unknown',
  confidence numeric(5,2),
  risk_reasons text[] NOT NULL DEFAULT '{}',
  is_disposable boolean,
  is_role_based boolean,
  is_catch_all boolean,
  is_free_provider boolean,
  did_you_mean text,
  mx_provider text,
  mx_record text,
  smtp_response text,
  smtp_code integer,
  source_engine text,
  engine_version text,
  retry_count integer NOT NULL DEFAULT 0,
  from_cache boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  cached_until timestamptz,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vresults_job ON public.verification_results(job_id);
CREATE INDEX IF NOT EXISTS idx_vresults_ws_email ON public.verification_results(workspace_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_vresults_status ON public.verification_results(workspace_id, status);

-- ── verification_cache (shared across workspaces, 30-day reuse) ────────────
CREATE TABLE IF NOT EXISTS public.verification_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL UNIQUE,
  domain text,
  status public.verification_status NOT NULL,
  confidence numeric(5,2),
  risk_reasons text[] NOT NULL DEFAULT '{}',
  is_disposable boolean,
  is_role_based boolean,
  is_catch_all boolean,
  is_free_provider boolean,
  mx_provider text,
  mx_record text,
  smtp_response text,
  smtp_code integer,
  source_engine text,
  engine_version text,
  raw_response jsonb,
  verified_at timestamptz NOT NULL DEFAULT now(),
  cached_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vcache_cached_until ON public.verification_cache(cached_until);

-- ── email_reputation_history ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_reputation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  status public.verification_status NOT NULL,
  confidence numeric(5,2),
  event_type text NOT NULL DEFAULT 'verified',
  source_engine text,
  details jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erh_email ON public.email_reputation_history(email_normalized, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_erh_ws ON public.email_reputation_history(workspace_id, recorded_at DESC);

-- ── domain_reputation ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.domain_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  mx_provider text,
  is_catch_all boolean,
  is_disposable boolean,
  is_free_provider boolean,
  quality_score numeric(5,2),
  total_verifications integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  bounce_count integer NOT NULL DEFAULT 0,
  last_verified_at timestamptz,
  last_smtp_behavior jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dr_quality ON public.domain_reputation(quality_score DESC NULLS LAST);

-- ── suppression_list (email-keyed, workspace-scoped) ───────────────────────
CREATE TABLE IF NOT EXISTS public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  source text NOT NULL DEFAULT 'manual',
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email_normalized)
);
CREATE INDEX IF NOT EXISTS idx_supp_ws_email ON public.suppression_list(workspace_id, email_normalized);

-- ── bounce_feedback (external ingestion of bounces from any provider) ──────
CREATE TABLE IF NOT EXISTS public.bounce_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  bounce_type text NOT NULL DEFAULT 'hard',
  smtp_code integer,
  smtp_response text,
  diagnostic_code text,
  mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'smtp',
  raw_payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bf_ws_email ON public.bounce_feedback(workspace_id, email_normalized);

-- ── provider_behavior_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_behavior_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  mx_provider text,
  behavior_type text NOT NULL,
  smtp_code integer,
  smtp_response text,
  sample_email text,
  details jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pbl_domain ON public.provider_behavior_logs(domain, observed_at DESC);

-- ── Triggers ───────────────────────────────────────────────────────────────
CREATE TRIGGER trg_vjobs_updated BEFORE UPDATE ON public.verification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vcache_updated BEFORE UPDATE ON public.verification_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dr_updated BEFORE UPDATE ON public.domain_reputation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_reputation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounce_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_behavior_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vj_select ON public.verification_jobs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));
CREATE POLICY vj_insert ON public.verification_jobs FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY vj_update ON public.verification_jobs FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY vj_delete ON public.verification_jobs FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));

CREATE POLICY vr_select ON public.verification_results FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));
CREATE POLICY vr_insert ON public.verification_results FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- Cache: any authenticated user can read (shared resource), writes via service role only
CREATE POLICY vc_select ON public.verification_cache FOR SELECT TO authenticated USING (true);

-- Domain reputation: read for all authenticated, writes service role
CREATE POLICY dr_select ON public.domain_reputation FOR SELECT TO authenticated USING (true);

-- Reputation history: workspace-scoped or global (null ws)
CREATE POLICY erh_select ON public.email_reputation_history FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY supp_select ON public.suppression_list FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));
CREATE POLICY supp_insert ON public.suppression_list FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY supp_delete ON public.suppression_list FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE POLICY bf_select ON public.bounce_feedback FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY pbl_select ON public.provider_behavior_logs FOR SELECT TO authenticated USING (true);

-- ── RPCs ───────────────────────────────────────────────────────────────────

-- Enqueue a verification job with a list of emails
CREATE OR REPLACE FUNCTION public.enqueue_verification_job(
  _workspace_id uuid,
  _name text,
  _emails text[],
  _source public.verification_job_source DEFAULT 'csv_upload',
  _campaign_id uuid DEFAULT NULL,
  _list_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_id uuid;
  v_email text;
  v_norm text;
  v_dom text;
  v_cache record;
  v_cached_hits int := 0;
  v_total int := 0;
BEGIN
  IF NOT public.is_workspace_member_or_admin(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.verification_jobs (workspace_id, created_by, name, source, campaign_id, list_id, total_count, status)
  VALUES (_workspace_id, auth.uid(), COALESCE(_name, 'Verification job'), _source, _campaign_id, _list_id, 0, 'pending')
  RETURNING id INTO v_job_id;

  FOREACH v_email IN ARRAY _emails LOOP
    v_norm := lower(btrim(v_email));
    CONTINUE WHEN v_norm IS NULL OR v_norm = '' OR position('@' in v_norm) = 0;
    v_dom := split_part(v_norm, '@', 2);
    v_total := v_total + 1;

    -- Check 30-day cache
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
      -- Insert a pending result row that the external engine will fill in
      INSERT INTO public.verification_results (workspace_id, job_id, email, domain, status)
      VALUES (_workspace_id, v_job_id, v_norm, v_dom, 'unknown');
    END IF;
  END LOOP;

  UPDATE public.verification_jobs
    SET total_count = v_total,
        cached_hit_count = v_cached_hits,
        processed_count = v_cached_hits,
        status = CASE WHEN v_cached_hits = v_total AND v_total > 0 THEN 'completed' ELSE 'pending' END,
        started_at = COALESCE(started_at, now()),
        completed_at = CASE WHEN v_cached_hits = v_total AND v_total > 0 THEN now() ELSE NULL END
    WHERE id = v_job_id;

  RETURN v_job_id;
END $$;

-- Worker claim: returns pending result rows for the external engine to process
CREATE OR REPLACE FUNCTION public.claim_verification_batch(_limit integer DEFAULT 50)
RETURNS TABLE (result_id uuid, job_id uuid, email text, domain text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT r.id FROM public.verification_results r
    JOIN public.verification_jobs j ON j.id = r.job_id
    WHERE r.from_cache = false
      AND r.verified_at IS NULL
      AND j.status IN ('pending','processing','partial')
    ORDER BY r.created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.verification_jobs j
    SET status = 'processing', started_at = COALESCE(started_at, now()), updated_at = now()
    FROM due d
    JOIN public.verification_results r ON r.id = d.id
    WHERE j.id = r.job_id AND j.status = 'pending';

  RETURN QUERY
  SELECT r.id, r.job_id, r.email, r.domain
    FROM public.verification_results r
   WHERE r.id IN (SELECT id FROM (
     SELECT r2.id FROM public.verification_results r2
     JOIN public.verification_jobs j2 ON j2.id = r2.job_id
     WHERE r2.from_cache = false AND r2.verified_at IS NULL
       AND j2.status IN ('pending','processing','partial')
     ORDER BY r2.created_at ASC LIMIT _limit
   ) s);
END $$;

-- Record a single verification outcome from the external engine
CREATE OR REPLACE FUNCTION public.record_verification_result(
  _result_id uuid,
  _status public.verification_status,
  _confidence numeric DEFAULT NULL,
  _risk_reasons text[] DEFAULT '{}',
  _is_disposable boolean DEFAULT NULL,
  _is_role_based boolean DEFAULT NULL,
  _is_catch_all boolean DEFAULT NULL,
  _is_free_provider boolean DEFAULT NULL,
  _mx_provider text DEFAULT NULL,
  _mx_record text DEFAULT NULL,
  _smtp_response text DEFAULT NULL,
  _smtp_code integer DEFAULT NULL,
  _source_engine text DEFAULT NULL,
  _engine_version text DEFAULT NULL,
  _did_you_mean text DEFAULT NULL,
  _raw jsonb DEFAULT '{}'::jsonb,
  _error text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r record;
  v_remaining int;
BEGIN
  SELECT * INTO v_r FROM public.verification_results WHERE id = _result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Result not found'; END IF;

  UPDATE public.verification_results SET
    status = _status,
    confidence = _confidence,
    risk_reasons = COALESCE(_risk_reasons,'{}'),
    is_disposable = _is_disposable,
    is_role_based = _is_role_based,
    is_catch_all = _is_catch_all,
    is_free_provider = _is_free_provider,
    mx_provider = _mx_provider,
    mx_record = _mx_record,
    smtp_response = _smtp_response,
    smtp_code = _smtp_code,
    source_engine = _source_engine,
    engine_version = _engine_version,
    did_you_mean = _did_you_mean,
    raw_response = _raw,
    error_message = _error,
    verified_at = now(),
    cached_until = now() + interval '30 days'
  WHERE id = _result_id;

  -- Upsert shared cache
  INSERT INTO public.verification_cache (email_normalized, domain, status, confidence, risk_reasons,
    is_disposable, is_role_based, is_catch_all, is_free_provider, mx_provider, mx_record,
    smtp_response, smtp_code, source_engine, engine_version, raw_response, verified_at, cached_until)
  VALUES (v_r.email_normalized, v_r.domain, _status, _confidence, COALESCE(_risk_reasons,'{}'),
    _is_disposable, _is_role_based, _is_catch_all, _is_free_provider, _mx_provider, _mx_record,
    _smtp_response, _smtp_code, _source_engine, _engine_version, _raw, now(), now() + interval '30 days')
  ON CONFLICT (email_normalized) DO UPDATE SET
    status = EXCLUDED.status, confidence = EXCLUDED.confidence, risk_reasons = EXCLUDED.risk_reasons,
    is_disposable = EXCLUDED.is_disposable, is_role_based = EXCLUDED.is_role_based,
    is_catch_all = EXCLUDED.is_catch_all, is_free_provider = EXCLUDED.is_free_provider,
    mx_provider = EXCLUDED.mx_provider, mx_record = EXCLUDED.mx_record,
    smtp_response = EXCLUDED.smtp_response, smtp_code = EXCLUDED.smtp_code,
    source_engine = EXCLUDED.source_engine, engine_version = EXCLUDED.engine_version,
    raw_response = EXCLUDED.raw_response, verified_at = EXCLUDED.verified_at,
    cached_until = EXCLUDED.cached_until, updated_at = now();

  -- History
  INSERT INTO public.email_reputation_history (workspace_id, email_normalized, status, confidence, event_type, source_engine, details)
  VALUES (v_r.workspace_id, v_r.email_normalized, _status, _confidence, 'verified', _source_engine, _raw);

  -- Domain reputation rollup
  INSERT INTO public.domain_reputation (domain, mx_provider, is_catch_all, is_disposable, is_free_provider,
    total_verifications, valid_count, invalid_count, last_verified_at, last_smtp_behavior)
  VALUES (v_r.domain, _mx_provider, _is_catch_all, _is_disposable, _is_free_provider,
    1,
    CASE WHEN _status IN ('valid','safe') THEN 1 ELSE 0 END,
    CASE WHEN _status = 'invalid' THEN 1 ELSE 0 END,
    now(), jsonb_build_object('code',_smtp_code,'response',_smtp_response))
  ON CONFLICT (domain) DO UPDATE SET
    mx_provider = COALESCE(EXCLUDED.mx_provider, domain_reputation.mx_provider),
    is_catch_all = COALESCE(EXCLUDED.is_catch_all, domain_reputation.is_catch_all),
    is_disposable = COALESCE(EXCLUDED.is_disposable, domain_reputation.is_disposable),
    is_free_provider = COALESCE(EXCLUDED.is_free_provider, domain_reputation.is_free_provider),
    total_verifications = domain_reputation.total_verifications + 1,
    valid_count = domain_reputation.valid_count + CASE WHEN _status IN ('valid','safe') THEN 1 ELSE 0 END,
    invalid_count = domain_reputation.invalid_count + CASE WHEN _status = 'invalid' THEN 1 ELSE 0 END,
    quality_score = ROUND(100.0 * (domain_reputation.valid_count + CASE WHEN _status IN ('valid','safe') THEN 1 ELSE 0 END)
                          / GREATEST(domain_reputation.total_verifications + 1, 1), 2),
    last_verified_at = now(),
    last_smtp_behavior = jsonb_build_object('code',_smtp_code,'response',_smtp_response),
    updated_at = now();

  -- Auto-suppress invalid / disposable / bounced
  IF _status IN ('invalid','disposable') OR COALESCE(_is_disposable, false) THEN
    INSERT INTO public.suppression_list (workspace_id, email_normalized, reason, source)
    VALUES (v_r.workspace_id, v_r.email_normalized,
            CASE WHEN _status = 'disposable' OR COALESCE(_is_disposable,false) THEN 'disposable' ELSE 'invalid' END,
            'verification')
    ON CONFLICT (workspace_id, email_normalized) DO NOTHING;
  END IF;

  -- Job rollup
  UPDATE public.verification_jobs SET
    processed_count = processed_count + 1,
    safe_count = safe_count + CASE WHEN _status = 'safe' THEN 1 ELSE 0 END,
    valid_count = valid_count + CASE WHEN _status = 'valid' THEN 1 ELSE 0 END,
    invalid_count = invalid_count + CASE WHEN _status = 'invalid' THEN 1 ELSE 0 END,
    risky_count = risky_count + CASE WHEN _status = 'risky' THEN 1 ELSE 0 END,
    catch_all_count = catch_all_count + CASE WHEN _status = 'catch_all' THEN 1 ELSE 0 END,
    disposable_count = disposable_count + CASE WHEN _status = 'disposable' THEN 1 ELSE 0 END,
    role_based_count = role_based_count + CASE WHEN _status = 'role_based' THEN 1 ELSE 0 END,
    unknown_count = unknown_count + CASE WHEN _status = 'unknown' THEN 1 ELSE 0 END,
    failed_count = failed_count + CASE WHEN _status = 'failed' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE id = v_r.job_id;

  -- Complete job if done
  SELECT (total_count - processed_count) INTO v_remaining FROM public.verification_jobs WHERE id = v_r.job_id;
  IF COALESCE(v_remaining,0) <= 0 THEN
    UPDATE public.verification_jobs SET
      status = 'completed',
      completed_at = now(),
      list_quality_score = CASE WHEN total_count > 0
        THEN ROUND(100.0 * (safe_count + valid_count) / total_count, 2) ELSE NULL END
      WHERE id = v_r.job_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Mark a result for retry (worker uses this on transient failures)
CREATE OR REPLACE FUNCTION public.retry_verification_result(_result_id uuid, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r record; v_job record;
BEGIN
  SELECT * INTO v_r FROM public.verification_results WHERE id = _result_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_job FROM public.verification_jobs WHERE id = v_r.job_id;
  IF v_r.retry_count >= COALESCE(v_job.max_retries, 2) THEN
    PERFORM public.record_verification_result(_result_id, 'failed', NULL, ARRAY['max_retries'],
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, _error);
  ELSE
    UPDATE public.verification_results
      SET retry_count = retry_count + 1, error_message = _error
      WHERE id = _result_id;
  END IF;
END $$;

-- Campaign safety check: returns whether an email is allowed for outbound
CREATE OR REPLACE FUNCTION public.check_email_send_eligibility(_workspace_id uuid, _email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text; v_cache record; v_supp boolean;
BEGIN
  v_norm := lower(btrim(_email));
  IF v_norm IS NULL OR position('@' in v_norm) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_format', 'requires_approval', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.suppression_list
    WHERE workspace_id = _workspace_id AND email_normalized = v_norm
      AND (expires_at IS NULL OR expires_at > now())) INTO v_supp;
  IF v_supp THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'suppressed', 'requires_approval', false);
  END IF;

  SELECT * INTO v_cache FROM public.verification_cache
    WHERE email_normalized = v_norm AND cached_until > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', true,
      'reason', 'unverified', 'status', 'unknown');
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

-- Ingest bounce feedback (auto-suppress)
CREATE OR REPLACE FUNCTION public.ingest_bounce_feedback(
  _workspace_id uuid, _email text, _bounce_type text, _smtp_code integer,
  _smtp_response text, _source text DEFAULT 'smtp', _raw jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text;
BEGIN
  v_norm := lower(btrim(_email));
  INSERT INTO public.bounce_feedback (workspace_id, email_normalized, bounce_type, smtp_code, smtp_response, source, raw_payload)
  VALUES (_workspace_id, v_norm, COALESCE(_bounce_type,'hard'), _smtp_code, _smtp_response, _source, _raw);

  IF COALESCE(_bounce_type,'hard') = 'hard' AND _workspace_id IS NOT NULL THEN
    INSERT INTO public.suppression_list (workspace_id, email_normalized, reason, source)
    VALUES (_workspace_id, v_norm, 'hard_bounce', 'bounce_feedback')
    ON CONFLICT (workspace_id, email_normalized) DO NOTHING;
  END IF;

  INSERT INTO public.email_reputation_history (workspace_id, email_normalized, status, event_type, details)
  VALUES (_workspace_id, v_norm, 'invalid', 'bounce', _raw);
END $$;
