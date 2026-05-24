
-- =========================================================================
-- Unknown Recovery Optimization
-- =========================================================================

-- ---- provider_profiles ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  mx_patterns text[] NOT NULL DEFAULT '{}',
  banner_patterns text[] NOT NULL DEFAULT '{}',
  smtp_timeout_ms int NOT NULL DEFAULT 20000,
  connect_timeout_ms int NOT NULL DEFAULT 10000,
  retry_base_seconds int NOT NULL DEFAULT 60,
  retry_multiplier numeric NOT NULL DEFAULT 2.0,
  max_concurrency int NOT NULL DEFAULT 5,
  per_domain_delay_ms int NOT NULL DEFAULT 5000,
  greylisting_strategy text NOT NULL DEFAULT 'standard',  -- standard | aggressive | minimal
  helo_rotation boolean NOT NULL DEFAULT false,
  extended_timeout_ms int NOT NULL DEFAULT 60000,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_profiles read" ON public.provider_profiles;
CREATE POLICY "provider_profiles read" ON public.provider_profiles
  FOR SELECT TO authenticated USING (true);

-- Seed (idempotent)
INSERT INTO public.provider_profiles
  (provider_key, display_name, mx_patterns, banner_patterns, smtp_timeout_ms, connect_timeout_ms, retry_base_seconds, retry_multiplier, max_concurrency, per_domain_delay_ms, greylisting_strategy, helo_rotation, extended_timeout_ms, notes)
VALUES
  ('microsoft365', 'Microsoft 365 / Outlook',
    ARRAY['outlook.com','protection.outlook.com','mail.protection.outlook.com'],
    ARRAY['Microsoft ESMTP','outlook.com'],
    30000, 12000, 120, 2.0, 3, 8000, 'aggressive', true, 75000,
    'M365 throttles aggressively; long backoff + low concurrency.'),
  ('google_workspace', 'Google Workspace / Gmail',
    ARRAY['google.com','googlemail.com','aspmx.l.google.com','gmail-smtp-in.l.google.com'],
    ARRAY['mx.google.com','ESMTP'],
    20000, 8000, 45, 1.8, 8, 3000, 'standard', false, 60000,
    'Greylisting rare; tolerates higher concurrency.'),
  ('yahoo', 'Yahoo / AOL',
    ARRAY['yahoodns.net','yahoo.com','aol.com'],
    ARRAY['yahoo','aol'],
    25000, 10000, 90, 2.0, 4, 6000, 'standard', false, 60000,
    'Frequent temp 421 deferrals — needs patient retries.'),
  ('proofpoint', 'Proofpoint',
    ARRAY['pphosted.com','ppe-hosted.com','proofpoint.com'],
    ARRAY['Proofpoint','pphosted'],
    30000, 12000, 180, 2.2, 2, 10000, 'aggressive', true, 90000,
    'Aggressive antispam; rotate HELO; long backoff.'),
  ('mimecast', 'Mimecast',
    ARRAY['mimecast.com','mimecast.co.za'],
    ARRAY['Mimecast'],
    30000, 12000, 180, 2.2, 2, 10000, 'aggressive', true, 90000,
    'Similar to Proofpoint; HELO/IP-sensitive.'),
  ('barracuda', 'Barracuda',
    ARRAY['barracudanetworks.com','barracuda.com','cudasvc.com'],
    ARRAY['Barracuda'],
    25000, 10000, 120, 2.0, 3, 8000, 'standard', true, 75000,
    'Tempfails common, recovers within 15m.'),
  ('cloudflare_email', 'Cloudflare Email',
    ARRAY['mx.cloudflare.net','cloudflare-email'],
    ARRAY['cloudflare'],
    20000, 8000, 60, 1.8, 5, 4000, 'standard', false, 60000,
    'Routes to upstream; behavior varies.'),
  ('generic', 'Generic / Unknown',
    ARRAY[]::text[], ARRAY[]::text[],
    20000, 10000, 60, 2.0, 4, 5000, 'standard', false, 60000,
    'Fallback profile.')
ON CONFLICT (provider_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    mx_patterns = EXCLUDED.mx_patterns,
    banner_patterns = EXCLUDED.banner_patterns,
    updated_at = now();

-- ---- verification_results: add recovery columns --------------------------
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS unknown_reason text,
  ADD COLUMN IF NOT EXISTS unknown_confidence text,
  ADD COLUMN IF NOT EXISTS provider_key text,
  ADD COLUMN IF NOT EXISTS recovery_passes int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_recovery_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vresults_unknown_reason
  ON public.verification_results(unknown_reason) WHERE status = 'unknown';

-- ---- verification_recovery_queue -----------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_recovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.verification_results(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  job_id uuid,
  email text NOT NULL,
  domain text,
  provider_key text NOT NULL DEFAULT 'generic',
  pass_number int NOT NULL CHECK (pass_number BETWEEN 2 AND 5),
  reason_code text NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_smtp_code int,
  last_smtp_message text,
  last_error text,
  state text NOT NULL DEFAULT 'queued', -- queued | in_flight | done | exhausted
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, pass_number)
);

CREATE INDEX IF NOT EXISTS idx_recq_due
  ON public.verification_recovery_queue(state, next_attempt_at)
  WHERE state = 'queued';
CREATE INDEX IF NOT EXISTS idx_recq_workspace ON public.verification_recovery_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recq_provider ON public.verification_recovery_queue(provider_key, state);

ALTER TABLE public.verification_recovery_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recq workspace read" ON public.verification_recovery_queue;
CREATE POLICY "recq workspace read" ON public.verification_recovery_queue
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- ---- smtp_session_log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smtp_session_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES public.verification_results(id) ON DELETE SET NULL,
  workspace_id uuid,
  email text NOT NULL,
  domain text,
  provider_key text,
  mx_host text,
  banner text,
  helo_used text,
  response_code int,
  response_text text,
  latency_ms int,
  tls_used boolean,
  disconnect_reason text,
  pass_number int,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_smtp_log_provider_time
  ON public.smtp_session_log(provider_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_smtp_log_code
  ON public.smtp_session_log(response_code) WHERE response_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smtp_log_workspace ON public.smtp_session_log(workspace_id);

ALTER TABLE public.smtp_session_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "smtp_log workspace read" ON public.smtp_session_log;
CREATE POLICY "smtp_log workspace read" ON public.smtp_session_log
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- ---- greylisting_events --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.greylisting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  provider_key text,
  result_id uuid REFERENCES public.verification_results(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  attempts int NOT NULL DEFAULT 1,
  success boolean
);
CREATE INDEX IF NOT EXISTS idx_grey_provider_time
  ON public.greylisting_events(provider_key, detected_at DESC);

ALTER TABLE public.greylisting_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grey read auth" ON public.greylisting_events;
CREATE POLICY "grey read auth" ON public.greylisting_events
  FOR SELECT TO authenticated USING (true);

-- ---- unknown_reason_stats (rollup) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.unknown_reason_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  provider_key text NOT NULL,
  reason_code text NOT NULL,
  total int NOT NULL DEFAULT 0,
  recovered int NOT NULL DEFAULT 0,
  recovery_rate numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, provider_key, reason_code)
);
ALTER TABLE public.unknown_reason_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "urs read" ON public.unknown_reason_stats;
CREATE POLICY "urs read" ON public.unknown_reason_stats FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- Helper functions
-- =========================================================================

CREATE OR REPLACE FUNCTION public.detect_provider(_mx text, _banner text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  lo_mx text := lower(coalesce(_mx, ''));
  lo_bn text := lower(coalesce(_banner, ''));
BEGIN
  FOR r IN SELECT provider_key, mx_patterns, banner_patterns FROM provider_profiles WHERE provider_key <> 'generic' LOOP
    IF lo_mx <> '' THEN
      FOR i IN 1..array_length(coalesce(r.mx_patterns, ARRAY[]::text[]), 1) LOOP
        IF lo_mx LIKE '%' || lower(r.mx_patterns[i]) || '%' THEN
          RETURN r.provider_key;
        END IF;
      END LOOP;
    END IF;
    IF lo_bn <> '' THEN
      FOR i IN 1..array_length(coalesce(r.banner_patterns, ARRAY[]::text[]), 1) LOOP
        IF lo_bn LIKE '%' || lower(r.banner_patterns[i]) || '%' THEN
          RETURN r.provider_key;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN 'generic';
END $$;

CREATE OR REPLACE FUNCTION public.classify_unknown_reason(_smtp_code int, _smtp_text text, _err text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t text := lower(coalesce(_smtp_text, '') || ' ' || coalesce(_err, ''));
BEGIN
  IF _smtp_code = 421 OR t LIKE '%try again%' OR t LIKE '%temporarily%defer%' OR t LIKE '%greylist%' THEN
    IF t LIKE '%greylist%' OR t LIKE '%try later%' THEN RETURN 'greylisting'; END IF;
    RETURN 'temp_reject';
  END IF;
  IF _smtp_code = 450 OR _smtp_code = 451 OR _smtp_code = 452 THEN
    IF t LIKE '%mailbox%busy%' OR t LIKE '%mailbox%unavailable%' THEN RETURN 'mailbox_busy'; END IF;
    RETURN 'temp_reject';
  END IF;
  IF t LIKE '%timeout%' OR t LIKE '%timed out%' OR t LIKE '%etimedout%' THEN RETURN 'timeout'; END IF;
  IF t LIKE '%econnreset%' OR t LIKE '%connection reset%' THEN RETURN 'conn_reset'; END IF;
  IF t LIKE '%enotfound%' OR t LIKE '%dns%' OR t LIKE '%servfail%' THEN RETURN 'dns_temp'; END IF;
  IF t LIKE '%tls%' OR t LIKE '%ssl%' OR t LIKE '%handshake%' THEN RETURN 'tls_fail'; END IF;
  IF t LIKE '%rate%limit%' OR t LIKE '%too many%' OR _smtp_code = 471 THEN RETURN 'ratelimit'; END IF;
  IF t LIKE '%spam%' OR t LIKE '%blacklist%' OR t LIKE '%blocked%' OR t LIKE '%denied%' THEN RETURN 'antispam'; END IF;
  IF t LIKE '%throttle%' THEN RETURN 'provider_throttle'; END IF;
  IF t LIKE '%disconnect%' OR t LIKE '%closed%' THEN RETURN 'smtp_disconnect'; END IF;
  IF t LIKE '%worker%timeout%' OR t LIKE '%engine_5xx%' THEN RETURN 'worker_timeout'; END IF;
  RETURN 'timeout';
END $$;

CREATE OR REPLACE FUNCTION public.classify_unknown_confidence(_reason text, _pass int, _provider text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _reason = 'greylisting' THEN 'greylisted'
    WHEN _reason = 'antispam' THEN 'provider_blocked'
    WHEN _reason IN ('timeout','conn_reset','smtp_disconnect','tls_fail','dns_temp','worker_timeout') AND _pass < 5 THEN 'temporary_failure'
    WHEN _reason IN ('temp_reject','mailbox_busy','ratelimit','provider_throttle') AND _pass < 5 THEN 'temporary_failure'
    WHEN _pass >= 5 AND _reason IN ('antispam','ratelimit','provider_throttle') THEN 'provider_blocked'
    WHEN _pass >= 5 AND _reason IN ('timeout','conn_reset','smtp_disconnect','tls_fail') THEN 'likely_valid'
    WHEN _pass >= 5 THEN 'high_risk_unknown'
    ELSE 'temporary_failure'
  END
$$;

-- Pass selection: greylisting → pass 3; antispam → pass 4; timeout/conn → pass 2; everything else → pass 2
CREATE OR REPLACE FUNCTION public.enqueue_recovery(
  _result_id uuid,
  _reason text,
  _smtp_code int,
  _smtp_text text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r record;
  v_p record;
  v_pass int;
  v_delay int;
  v_prev int;
BEGIN
  SELECT id, workspace_id, job_id, email, domain, provider_key, recovery_passes
  INTO v_r FROM verification_results WHERE id = _result_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_p FROM provider_profiles WHERE provider_key = coalesce(v_r.provider_key, 'generic');
  IF NOT FOUND THEN
    SELECT * INTO v_p FROM provider_profiles WHERE provider_key = 'generic';
  END IF;

  -- determine target pass
  v_prev := coalesce(v_r.recovery_passes, 1);
  v_pass := CASE
    WHEN _reason = 'greylisting' THEN GREATEST(3, v_prev + 1)
    WHEN _reason = 'antispam' THEN GREATEST(4, v_prev + 1)
    ELSE GREATEST(2, v_prev + 1)
  END;
  IF v_pass > 5 THEN RETURN; END IF;

  -- delay
  IF _reason = 'greylisting' THEN
    v_delay := CASE v_pass WHEN 3 THEN 60 WHEN 4 THEN 300 WHEN 5 THEN 900 ELSE 1800 END;
  ELSE
    v_delay := (v_p.retry_base_seconds * power(v_p.retry_multiplier, v_pass - 2))::int;
  END IF;

  INSERT INTO verification_recovery_queue
    (result_id, workspace_id, job_id, email, domain, provider_key, pass_number, reason_code, next_attempt_at, last_smtp_code, last_smtp_message)
  VALUES
    (v_r.id, v_r.workspace_id, v_r.job_id, v_r.email, v_r.domain,
     coalesce(v_r.provider_key, 'generic'), v_pass, _reason,
     now() + (v_delay || ' seconds')::interval, _smtp_code, _smtp_text)
  ON CONFLICT (result_id, pass_number) DO UPDATE
    SET reason_code = EXCLUDED.reason_code,
        next_attempt_at = EXCLUDED.next_attempt_at,
        last_smtp_code = EXCLUDED.last_smtp_code,
        last_smtp_message = EXCLUDED.last_smtp_message,
        state = 'queued',
        updated_at = now();

  IF _reason = 'greylisting' THEN
    INSERT INTO greylisting_events (domain, provider_key, result_id)
    VALUES (v_r.domain, v_r.provider_key, v_r.id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_recovery_batch(_worker_id text, _limit int DEFAULT 25)
RETURNS TABLE (
  id uuid, result_id uuid, workspace_id uuid, job_id uuid, email text, domain text,
  provider_key text, pass_number int, reason_code text, attempt_count int,
  smtp_timeout_ms int, connect_timeout_ms int, extended_timeout_ms int,
  per_domain_delay_ms int, greylisting_strategy text, helo_rotation boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM verification_recovery_queue q
    WHERE q.state = 'queued' AND q.next_attempt_at <= now()
    ORDER BY q.next_attempt_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE verification_recovery_queue q
    SET state = 'in_flight', claimed_by = _worker_id, claimed_at = now(), updated_at = now(),
        attempt_count = q.attempt_count + 1
    FROM picked
    WHERE q.id = picked.id
    RETURNING q.*
  )
  SELECT u.id, u.result_id, u.workspace_id, u.job_id, u.email, u.domain,
         u.provider_key, u.pass_number, u.reason_code, u.attempt_count,
         coalesce(CASE WHEN u.pass_number = 5 THEN p.extended_timeout_ms ELSE p.smtp_timeout_ms END, 20000),
         coalesce(p.connect_timeout_ms, 10000),
         coalesce(p.extended_timeout_ms, 60000),
         coalesce(p.per_domain_delay_ms, 5000),
         coalesce(p.greylisting_strategy, 'standard'),
         coalesce(p.helo_rotation, false)
  FROM upd u
  LEFT JOIN provider_profiles p ON p.provider_key = u.provider_key;
END $$;

CREATE OR REPLACE FUNCTION public.complete_recovery(
  _id uuid,
  _status text,
  _smtp_code int,
  _smtp_text text,
  _latency int,
  _banner text DEFAULT NULL,
  _mx_host text DEFAULT NULL,
  _helo_used text DEFAULT NULL,
  _tls_used boolean DEFAULT NULL,
  _disconnect_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q record;
  v_reason text;
  v_conf text;
  v_provider text;
BEGIN
  SELECT * INTO v_q FROM verification_recovery_queue WHERE id = _id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  v_provider := coalesce(detect_provider(_mx_host, _banner), v_q.provider_key, 'generic');

  -- log session
  INSERT INTO smtp_session_log
    (result_id, workspace_id, email, domain, provider_key, mx_host, banner, helo_used,
     response_code, response_text, latency_ms, tls_used, disconnect_reason, pass_number)
  VALUES
    (v_q.result_id, v_q.workspace_id, v_q.email, v_q.domain, v_provider,
     _mx_host, _banner, _helo_used, _smtp_code, _smtp_text, _latency, _tls_used, _disconnect_reason, v_q.pass_number);

  -- update result row provider key
  UPDATE verification_results
  SET provider_key = v_provider,
      recovery_passes = v_q.pass_number,
      last_recovery_at = now(),
      updated_at = now()
  WHERE id = v_q.result_id;

  IF _status IN ('valid','invalid','catch_all','disposable','role_based','safe','risky') THEN
    -- finalize
    UPDATE verification_results
    SET status = _status, verified_at = now(), unknown_reason = NULL, unknown_confidence = NULL,
        smtp_response = coalesce(_smtp_text, smtp_response),
        smtp_code = coalesce(_smtp_code, smtp_code)
    WHERE id = v_q.result_id;

    UPDATE verification_recovery_queue SET state = 'done', updated_at = now() WHERE id = _id;

    -- mark greylist recovered
    IF v_q.reason_code = 'greylisting' THEN
      UPDATE greylisting_events SET recovered_at = now(), success = true,
        attempts = attempts + 1
      WHERE result_id = v_q.result_id AND recovered_at IS NULL;
    END IF;

    RETURN jsonb_build_object('ok', true, 'final_status', _status);
  END IF;

  -- still unknown — classify and either re-enqueue next pass or exhaust
  v_reason := classify_unknown_reason(_smtp_code, _smtp_text, _status);
  v_conf := classify_unknown_confidence(v_reason, v_q.pass_number, v_provider);

  UPDATE verification_results
  SET unknown_reason = v_reason, unknown_confidence = v_conf
  WHERE id = v_q.result_id;

  IF v_q.pass_number < 5 THEN
    UPDATE verification_recovery_queue SET state = 'done', updated_at = now() WHERE id = _id;
    PERFORM enqueue_recovery(v_q.result_id, v_reason, _smtp_code, _smtp_text);
    RETURN jsonb_build_object('ok', true, 'requeued', true, 'reason', v_reason);
  ELSE
    UPDATE verification_recovery_queue SET state = 'exhausted', updated_at = now() WHERE id = _id;
    UPDATE verification_results SET verified_at = now() WHERE id = v_q.result_id AND verified_at IS NULL;
    IF v_q.reason_code = 'greylisting' THEN
      UPDATE greylisting_events SET recovered_at = now(), success = false, attempts = attempts + 1
      WHERE result_id = v_q.result_id AND recovered_at IS NULL;
    END IF;
    RETURN jsonb_build_object('ok', true, 'exhausted', true, 'confidence', v_conf);
  END IF;
END $$;

-- Trigger: when a result flips to unknown on pass 1 from worker, enqueue recovery
CREATE OR REPLACE FUNCTION public.trg_enqueue_unknown_recovery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.status = 'unknown'
     AND coalesce(NEW.recovery_passes, 1) = 1
     AND NEW.verification_mode IS DISTINCT FROM 'cache'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_reason := classify_unknown_reason(NEW.smtp_code, NEW.smtp_response, NEW.error_message);
    NEW.unknown_reason := v_reason;
    NEW.unknown_confidence := classify_unknown_confidence(v_reason, 1, coalesce(NEW.provider_key,'generic'));
    PERFORM enqueue_recovery(NEW.id, v_reason, NEW.smtp_code, NEW.smtp_response);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enqueue_unknown_recovery ON public.verification_results;
CREATE TRIGGER trg_enqueue_unknown_recovery
BEFORE INSERT OR UPDATE OF status ON public.verification_results
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_unknown_recovery();

-- Metrics RPC
CREATE OR REPLACE FUNCTION public.recovery_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'queue_state', (
      SELECT jsonb_object_agg(state, c) FROM (
        SELECT state, count(*) c FROM verification_recovery_queue GROUP BY state
      ) s
    ),
    'pass_breakdown', (
      SELECT jsonb_agg(jsonb_build_object('pass', pass_number, 'queued', queued, 'done', done, 'exhausted', exhausted)) FROM (
        SELECT pass_number,
          count(*) FILTER (WHERE state='queued') queued,
          count(*) FILTER (WHERE state='done') done,
          count(*) FILTER (WHERE state='exhausted') exhausted
        FROM verification_recovery_queue GROUP BY pass_number ORDER BY pass_number
      ) p
    ),
    'reason_breakdown', (
      SELECT jsonb_agg(jsonb_build_object('reason', reason_code, 'total', t, 'recovered', r,
        'recovery_rate', CASE WHEN t > 0 THEN round((r::numeric/t)*100, 1) ELSE 0 END)) FROM (
        SELECT reason_code, count(*) t, count(*) FILTER (WHERE state='done') r
        FROM verification_recovery_queue
        WHERE created_at >= now() - interval '7 days'
        GROUP BY reason_code ORDER BY count(*) DESC
      ) x
    ),
    'provider_breakdown', (
      SELECT jsonb_agg(jsonb_build_object('provider', provider_key, 'total', t, 'recovered', r,
        'recovery_rate', CASE WHEN t > 0 THEN round((r::numeric/t)*100, 1) ELSE 0 END)) FROM (
        SELECT provider_key, count(*) t, count(*) FILTER (WHERE state='done') r
        FROM verification_recovery_queue
        WHERE created_at >= now() - interval '7 days'
        GROUP BY provider_key ORDER BY count(*) DESC
      ) y
    ),
    'greylisting', (
      SELECT jsonb_build_object(
        'total', count(*),
        'recovered', count(*) FILTER (WHERE success = true),
        'success_rate', CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE success=true)::numeric/count(*))*100, 1) ELSE 0 END
      ) FROM greylisting_events WHERE detected_at >= now() - interval '7 days'
    ),
    'top_smtp_codes', (
      SELECT jsonb_agg(jsonb_build_object('code', response_code, 'count', c)) FROM (
        SELECT response_code, count(*) c FROM smtp_session_log
        WHERE response_code IS NOT NULL AND captured_at >= now() - interval '24 hours'
        GROUP BY response_code ORDER BY count(*) DESC LIMIT 10
      ) z
    ),
    'unknown_confidence', (
      SELECT jsonb_object_agg(unknown_confidence, c) FROM (
        SELECT unknown_confidence, count(*) c FROM verification_results
        WHERE status='unknown' AND unknown_confidence IS NOT NULL
          AND created_at >= now() - interval '7 days'
        GROUP BY unknown_confidence
      ) k
    )
  ) INTO v;
  RETURN v;
END $$;

-- Rollup tick (called by cron)
CREATE OR REPLACE FUNCTION public.recovery_rollup_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO unknown_reason_stats (day, provider_key, reason_code, total, recovered, recovery_rate, updated_at)
  SELECT date_trunc('day', created_at)::date, provider_key, reason_code,
         count(*),
         count(*) FILTER (WHERE state = 'done'),
         CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE state='done')::numeric/count(*))*100, 2) ELSE 0 END,
         now()
  FROM verification_recovery_queue
  WHERE created_at >= now() - interval '14 days'
  GROUP BY 1,2,3
  ON CONFLICT (day, provider_key, reason_code) DO UPDATE
  SET total = EXCLUDED.total,
      recovered = EXCLUDED.recovered,
      recovery_rate = EXCLUDED.recovery_rate,
      updated_at = now();

  DELETE FROM smtp_session_log WHERE captured_at < now() - interval '30 days';
END $$;

GRANT EXECUTE ON FUNCTION public.recovery_metrics() TO authenticated;
