
-- 1) Extend verification_status enum (idempotent). New values won't be referenced as literals in this migration.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'ok','ok_for_all','email_disabled','invalid_syntax','dead_server','invalid_mx',
    'antispam_system','smtp_protocol','spamtrap','greylisted','temporary_failure','provider_blocked'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 2) New enums
DO $$ BEGIN
  CREATE TYPE public.verification_source AS ENUM ('live','historical','imported_legacy','api','recheck');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_freshness AS ENUM ('fresh','aging','stale','expired','reverified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_quality_mode AS ENUM ('standard','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.historical_import_status AS ENUM ('pending','processing','completed','failed','partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Extend verification_results
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS historical_status      public.verification_status,
  ADD COLUMN IF NOT EXISTS current_status         public.verification_status,
  ADD COLUMN IF NOT EXISTS status_changed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_valid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS last_bounce_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_campaign_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_reply_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_open_at           timestamptz,
  ADD COLUMN IF NOT EXISTS confidence_decay_score numeric,
  ADD COLUMN IF NOT EXISTS deliverability_score   numeric,
  ADD COLUMN IF NOT EXISTS risk_level             public.verification_risk_tier,
  ADD COLUMN IF NOT EXISTS freshness_label        public.verification_freshness,
  ADD COLUMN IF NOT EXISTS recheck_required       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_type          text,
  ADD COLUMN IF NOT EXISTS verification_source    public.verification_source DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS verification_quality   public.verification_quality_mode DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS domain_reputation_score numeric,
  ADD COLUMN IF NOT EXISTS smtp_result            text,
  ADD COLUMN IF NOT EXISTS mx_status              text,
  ADD COLUMN IF NOT EXISTS verification_reason    text,
  ADD COLUMN IF NOT EXISTS greylisting_detected   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS catch_all_probability  numeric,
  ADD COLUMN IF NOT EXISTS bounce_risk_score      numeric;

CREATE INDEX IF NOT EXISTS idx_vr_freshness ON public.verification_results(freshness_label);
CREATE INDEX IF NOT EXISTS idx_vr_provider_type ON public.verification_results(provider_type);
CREATE INDEX IF NOT EXISTS idx_vr_recheck_required ON public.verification_results(recheck_required) WHERE recheck_required = true;
CREATE INDEX IF NOT EXISTS idx_vr_last_verified_at ON public.verification_results(last_verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_vr_verification_source ON public.verification_results(verification_source);

ALTER TABLE public.verification_jobs
  ADD COLUMN IF NOT EXISTS source_file_path       text,
  ADD COLUMN IF NOT EXISTS source_file_name       text,
  ADD COLUMN IF NOT EXISTS source_columns         jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_quality   public.verification_quality_mode DEFAULT 'standard';

-- 4) email_history
CREATE TABLE IF NOT EXISTS public.email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  email_normalized text NOT NULL,
  domain text,
  provider_type text,
  current_status public.verification_status,
  historical_status public.verification_status,
  freshness_label public.verification_freshness,
  risk_level public.verification_risk_tier,
  confidence_decay_score numeric,
  deliverability_score numeric,
  bounce_risk_score numeric,
  catch_all_probability numeric,
  is_disposable boolean,
  is_role_based boolean,
  is_catch_all boolean,
  first_seen_at timestamptz DEFAULT now(),
  last_verified_at timestamptz,
  last_seen_valid_at timestamptz,
  last_bounce_at timestamptz,
  last_campaign_sent_at timestamptz,
  last_reply_at timestamptz,
  last_open_at timestamptz,
  status_changed_at timestamptz,
  verification_count integer DEFAULT 0,
  bounce_count integer DEFAULT 0,
  engagement_count integer DEFAULT 0,
  verification_source public.verification_source,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email_normalized)
);
CREATE INDEX IF NOT EXISTS idx_eh_workspace ON public.email_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_eh_domain ON public.email_history(domain);
CREATE INDEX IF NOT EXISTS idx_eh_provider ON public.email_history(provider_type);
CREATE INDEX IF NOT EXISTS idx_eh_freshness ON public.email_history(freshness_label);
CREATE INDEX IF NOT EXISTS idx_eh_last_verified ON public.email_history(last_verified_at DESC);
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eh_ws_select ON public.email_history;
CREATE POLICY eh_ws_select ON public.email_history FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS eh_ws_write ON public.email_history;
CREATE POLICY eh_ws_write ON public.email_history FOR ALL TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- verification_events
CREATE TABLE IF NOT EXISTS public.verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  email_normalized text NOT NULL,
  event_type text NOT NULL,
  status public.verification_status,
  previous_status public.verification_status,
  source public.verification_source,
  smtp_code integer,
  smtp_response text,
  provider_type text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ve_workspace_email ON public.verification_events(workspace_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_ve_event_type ON public.verification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ve_created_at ON public.verification_events(created_at DESC);
ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ve_ws_select ON public.verification_events;
CREATE POLICY ve_ws_select ON public.verification_events FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS ve_ws_insert ON public.verification_events;
CREATE POLICY ve_ws_insert ON public.verification_events FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- historical_imports
CREATE TABLE IF NOT EXISTS public.historical_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_path text,
  file_size_bytes bigint,
  row_count integer DEFAULT 0,
  processed_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_label text,
  status public.historical_import_status NOT NULL DEFAULT 'pending',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.historical_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hi_admin_all ON public.historical_imports;
CREATE POLICY hi_admin_all ON public.historical_imports FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- provider_behavior
CREATE TABLE IF NOT EXISTS public.provider_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL UNIQUE,
  total_verifications bigint DEFAULT 0,
  accepts bigint DEFAULT 0,
  rejects bigint DEFAULT 0,
  greylists bigint DEFAULT 0,
  catch_all_count bigint DEFAULT 0,
  bounces bigint DEFAULT 0,
  avg_latency_ms numeric,
  top_responses jsonb DEFAULT '[]'::jsonb,
  accept_rate numeric,
  bounce_rate numeric,
  reliability_score numeric,
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_behavior ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pb_read_auth ON public.provider_behavior;
CREATE POLICY pb_read_auth ON public.provider_behavior FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pb_admin_write ON public.provider_behavior;
CREATE POLICY pb_admin_write ON public.provider_behavior FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- smtp_patterns
CREATE TABLE IF NOT EXISTS public.smtp_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL,
  smtp_code integer,
  response_pattern text NOT NULL,
  inferred_status public.verification_status,
  occurrences bigint DEFAULT 1,
  confidence numeric DEFAULT 0.5,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_type, smtp_code, response_pattern)
);
ALTER TABLE public.smtp_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sp_read_auth ON public.smtp_patterns;
CREATE POLICY sp_read_auth ON public.smtp_patterns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sp_admin_write ON public.smtp_patterns;
CREATE POLICY sp_admin_write ON public.smtp_patterns FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- verification_quality_logs
CREATE TABLE IF NOT EXISTS public.verification_quality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  job_id uuid,
  quality_mode public.verification_quality_mode NOT NULL DEFAULT 'standard',
  total_processed integer DEFAULT 0,
  unknown_recovery_attempts integer DEFAULT 0,
  unknown_recovery_success integer DEFAULT 0,
  retry_total integer DEFAULT 0,
  retry_success integer DEFAULT 0,
  greylist_detected integer DEFAULT 0,
  avg_latency_ms numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_quality_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vql_ws_select ON public.verification_quality_logs;
CREATE POLICY vql_ws_select ON public.verification_quality_logs FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- worker_activity_logs
CREATE TABLE IF NOT EXISTS public.worker_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  event_type text NOT NULL,
  throughput numeric,
  in_flight integer,
  version text,
  host text,
  cpu_pct numeric,
  mem_mb numeric,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wal_worker_created ON public.worker_activity_logs(worker_id, created_at DESC);
ALTER TABLE public.worker_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wal_admin_read ON public.worker_activity_logs;
CREATE POLICY wal_admin_read ON public.worker_activity_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- bounce_intelligence
CREATE TABLE IF NOT EXISTS public.bounce_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text,
  provider_type text,
  smtp_code integer,
  bounce_category text,
  occurrences bigint DEFAULT 1,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, provider_type, smtp_code, bounce_category)
);
ALTER TABLE public.bounce_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bi_read_auth ON public.bounce_intelligence;
CREATE POLICY bi_read_auth ON public.bounce_intelligence FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS bi_admin_write ON public.bounce_intelligence;
CREATE POLICY bi_admin_write ON public.bounce_intelligence FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- domain_intelligence
CREATE TABLE IF NOT EXISTS public.domain_intelligence (
  domain text PRIMARY KEY,
  provider_type text,
  mx_health text,
  deliverability_score numeric,
  freshness_label public.verification_freshness,
  total_emails_seen bigint DEFAULT 0,
  learning_signals jsonb DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.domain_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS di_read_auth ON public.domain_intelligence;
CREATE POLICY di_read_auth ON public.domain_intelligence FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS di_admin_write ON public.domain_intelligence;
CREATE POLICY di_admin_write ON public.domain_intelligence FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- 5) Functions (use ::text casts to avoid new-enum-value parse errors in same tx)
CREATE OR REPLACE FUNCTION public.compute_freshness(_last_verified_at timestamptz)
RETURNS public.verification_freshness LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _last_verified_at IS NULL THEN 'expired'::public.verification_freshness
    WHEN _last_verified_at > now() - interval '30 days' THEN 'fresh'::public.verification_freshness
    WHEN _last_verified_at > now() - interval '90 days' THEN 'aging'::public.verification_freshness
    WHEN _last_verified_at > now() - interval '180 days' THEN 'stale'::public.verification_freshness
    ELSE 'expired'::public.verification_freshness
  END
$$;

CREATE OR REPLACE FUNCTION public.compute_decay(_confidence numeric, _last_verified_at timestamptz)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _confidence IS NULL OR _last_verified_at IS NULL THEN NULL
    ELSE ROUND(GREATEST(0, _confidence * (1.0 - LEAST(1.0, EXTRACT(EPOCH FROM (now() - _last_verified_at)) / (180.0 * 86400.0))))::numeric, 4)
  END
$$;

CREATE OR REPLACE FUNCTION public.compute_recheck_required(
  _status public.verification_status, _last_verified_at timestamptz, _is_catch_all boolean, _confidence_decay numeric
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT
    _last_verified_at IS NULL
    OR _last_verified_at < now() - interval '90 days'
    OR _status::text IN ('unknown','risky','catch_all','greylisted','temporary_failure','failed')
    OR COALESCE(_is_catch_all, false)
    OR COALESCE(_confidence_decay, 0) < 0.4
$$;

CREATE OR REPLACE FUNCTION public.refresh_email_freshness_batch(_limit integer DEFAULT 5000)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer;
BEGIN
  WITH due AS (
    SELECT id, confidence, last_verified_at, status, is_catch_all
    FROM public.verification_results
    WHERE last_verified_at IS NOT NULL
    ORDER BY created_at ASC
    LIMIT _limit
  )
  UPDATE public.verification_results r
  SET freshness_label = public.compute_freshness(r.last_verified_at),
      confidence_decay_score = public.compute_decay(r.confidence, r.last_verified_at),
      recheck_required = public.compute_recheck_required(r.status, r.last_verified_at, r.is_catch_all,
                          public.compute_decay(r.confidence, r.last_verified_at))
  FROM due d WHERE d.id = r.id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END $$;

CREATE OR REPLACE FUNCTION public.record_engagement(_workspace_id uuid, _email text, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text := lower(btrim(_email));
BEGIN
  INSERT INTO public.email_history (workspace_id, email_normalized, last_reply_at, last_open_at, last_campaign_sent_at, engagement_count, verification_source)
  VALUES (_workspace_id, v_norm,
          CASE WHEN _event = 'reply' THEN now() END,
          CASE WHEN _event = 'open'  THEN now() END,
          CASE WHEN _event = 'sent'  THEN now() END,
          1, 'live')
  ON CONFLICT (workspace_id, email_normalized) DO UPDATE
    SET last_reply_at = CASE WHEN _event = 'reply' THEN now() ELSE email_history.last_reply_at END,
        last_open_at  = CASE WHEN _event = 'open'  THEN now() ELSE email_history.last_open_at END,
        last_campaign_sent_at = CASE WHEN _event = 'sent' THEN now() ELSE email_history.last_campaign_sent_at END,
        engagement_count = email_history.engagement_count + CASE WHEN _event IN ('reply','open') THEN 1 ELSE 0 END,
        updated_at = now();
  INSERT INTO public.verification_events (workspace_id, email_normalized, event_type, source)
  VALUES (_workspace_id, v_norm, _event, 'live');
END $$;

CREATE OR REPLACE FUNCTION public.record_smtp_pattern(_provider text, _smtp_code integer, _response text, _inferred public.verification_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.smtp_patterns (provider_type, smtp_code, response_pattern, inferred_status, occurrences, confidence, last_seen_at)
  VALUES (COALESCE(_provider,'unknown'), _smtp_code, COALESCE(_response,''), _inferred, 1, 0.5, now())
  ON CONFLICT (provider_type, smtp_code, response_pattern) DO UPDATE
    SET occurrences = smtp_patterns.occurrences + 1,
        confidence = LEAST(1.0, smtp_patterns.confidence + 0.01),
        last_seen_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.record_bounce_outcome(
  _workspace_id uuid, _email text, _smtp_code integer, _category text, _provider text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text := lower(btrim(_email)); v_domain text := split_part(v_norm,'@',2);
BEGIN
  INSERT INTO public.bounce_intelligence (domain, provider_type, smtp_code, bounce_category, occurrences, last_seen_at)
  VALUES (v_domain, COALESCE(_provider,'unknown'), _smtp_code, COALESCE(_category,'hard_bounce'), 1, now())
  ON CONFLICT (domain, provider_type, smtp_code, bounce_category) DO UPDATE
    SET occurrences = bounce_intelligence.occurrences + 1,
        last_seen_at = now();
  INSERT INTO public.email_history (workspace_id, email_normalized, domain, provider_type, last_bounce_at, bounce_count, verification_source)
  VALUES (_workspace_id, v_norm, v_domain, _provider, now(), 1, 'live')
  ON CONFLICT (workspace_id, email_normalized) DO UPDATE
    SET last_bounce_at = now(),
        bounce_count = email_history.bounce_count + 1,
        updated_at = now();
  INSERT INTO public.verification_events (workspace_id, email_normalized, event_type, source, smtp_code, provider_type, details)
  VALUES (_workspace_id, v_norm, 'bounced', 'live', _smtp_code, _provider, jsonb_build_object('category', _category));
END $$;

-- 6) Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-uploads', 'verification-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS vu_select ON storage.objects;
CREATE POLICY vu_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-uploads' AND (
    public.is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (SELECT workspace_id::text FROM public.workspace_members WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS vu_insert ON storage.objects;
CREATE POLICY vu_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-uploads' AND (
    public.is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (SELECT workspace_id::text FROM public.workspace_members WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS vu_delete ON storage.objects;
CREATE POLICY vu_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-uploads' AND (
    public.is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (SELECT workspace_id::text FROM public.workspace_members WHERE user_id = auth.uid())
  ));
