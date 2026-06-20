
-- 1. Canonical status enum
DO $$ BEGIN
  CREATE TYPE public.email_canonical_status AS ENUM (
    'valid','valid_catch_all','risky','unknown','invalid','bounced','suppressed','unverified'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. email_status_history (append-only)
CREATE TABLE IF NOT EXISTS public.email_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_email text NOT NULL,
  canonical_status public.email_canonical_status NOT NULL,
  is_role_based boolean NOT NULL DEFAULT false,
  is_disposable boolean NOT NULL DEFAULT false,
  is_free_email boolean NOT NULL DEFAULT false,
  is_catch_all boolean NOT NULL DEFAULT false,
  is_syntax_invalid boolean NOT NULL DEFAULT false,
  is_mx_missing boolean NOT NULL DEFAULT false,
  is_temporary_failure boolean NOT NULL DEFAULT false,
  provider text,
  provider_status text,
  source text NOT NULL,
  verification_job_id uuid,
  import_job_id uuid,
  verified_at timestamptz NOT NULL DEFAULT now(),
  smtp_code text,
  reason text,
  mx_record text,
  domain text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esh_workspace_email ON public.email_status_history(workspace_id, normalized_email);
CREATE INDEX IF NOT EXISTS idx_esh_workspace_verified_at ON public.email_status_history(workspace_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_esh_workspace_domain ON public.email_status_history(workspace_id, domain);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_status_history TO authenticated;
GRANT ALL ON public.email_status_history TO service_role;
ALTER TABLE public.email_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esh_workspace_read" ON public.email_status_history FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "esh_workspace_insert" ON public.email_status_history FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "esh_workspace_update" ON public.email_status_history FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "esh_workspace_delete" ON public.email_status_history FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- 3. verification_status_map (provider status -> canonical mapping)
CREATE TABLE IF NOT EXISTS public.verification_status_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_status text NOT NULL,
  canonical_status public.email_canonical_status NOT NULL,
  is_role_based boolean NOT NULL DEFAULT false,
  is_disposable boolean NOT NULL DEFAULT false,
  is_free_email boolean NOT NULL DEFAULT false,
  is_catch_all boolean NOT NULL DEFAULT false,
  is_syntax_invalid boolean NOT NULL DEFAULT false,
  is_mx_missing boolean NOT NULL DEFAULT false,
  is_temporary_failure boolean NOT NULL DEFAULT false,
  notes text,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vsm_global ON public.verification_status_map(provider, lower(provider_status)) WHERE is_global = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vsm_workspace ON public.verification_status_map(workspace_id, provider, lower(provider_status)) WHERE is_global = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_status_map TO authenticated;
GRANT ALL ON public.verification_status_map TO service_role;
ALTER TABLE public.verification_status_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vsm_read_global_or_workspace" ON public.verification_status_map FOR SELECT TO authenticated
  USING (is_global = true OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "vsm_workspace_write" ON public.verification_status_map FOR INSERT TO authenticated
  WITH CHECK (is_global = false AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "vsm_workspace_update" ON public.verification_status_map FOR UPDATE TO authenticated
  USING (is_global = false AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "vsm_workspace_delete" ON public.verification_status_map FOR DELETE TO authenticated
  USING (is_global = false AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- 4. Seed global mappings for common providers (EmailListVerify, ZeroBounce, NeverBounce, MillionVerifier, Bouncer, generic)
INSERT INTO public.verification_status_map (provider, provider_status, canonical_status, is_role_based, is_disposable, is_catch_all, is_free_email, is_syntax_invalid, is_mx_missing, is_temporary_failure, is_global) VALUES
-- EmailListVerify
('emaillistverify','ok','valid',false,false,false,false,false,false,false,true),
('emaillistverify','ok_for_all','valid_catch_all',false,false,true,false,false,false,false,true),
('emaillistverify','accept_all','valid_catch_all',false,false,true,false,false,false,false,true),
('emaillistverify','catch_all','valid_catch_all',false,false,true,false,false,false,false,true),
('emaillistverify','email_disabled','invalid',false,false,false,false,false,false,false,true),
('emaillistverify','dead_server','invalid',false,false,false,false,false,true,false,true),
('emaillistverify','invalid_mx','invalid',false,false,false,false,false,true,false,true),
('emaillistverify','invalid','invalid',false,false,false,false,false,false,false,true),
('emaillistverify','disposable','invalid',false,true,false,false,false,false,false,true),
('emaillistverify','spamtrap','suppressed',false,false,false,false,false,false,false,true),
('emaillistverify','role','valid',true,false,false,false,false,false,false,true),
('emaillistverify','role_based','valid',true,false,false,false,false,false,false,true),
('emaillistverify','free','valid',false,false,false,true,false,false,false,true),
('emaillistverify','syntax_error','invalid',false,false,false,false,true,false,false,true),
('emaillistverify','smtp_protocol','risky',false,false,false,false,false,false,true,true),
('emaillistverify','antispam_system','risky',false,false,false,false,false,false,true,true),
('emaillistverify','greylisted','risky',false,false,false,false,false,false,true,true),
('emaillistverify','unknown','unknown',false,false,false,false,false,false,false,true),
('emaillistverify','risky','risky',false,false,false,false,false,false,false,true),
-- ZeroBounce
('zerobounce','valid','valid',false,false,false,false,false,false,false,true),
('zerobounce','invalid','invalid',false,false,false,false,false,false,false,true),
('zerobounce','catch-all','valid_catch_all',false,false,true,false,false,false,false,true),
('zerobounce','spamtrap','suppressed',false,false,false,false,false,false,false,true),
('zerobounce','abuse','suppressed',false,false,false,false,false,false,false,true),
('zerobounce','do_not_mail','suppressed',false,false,false,false,false,false,false,true),
('zerobounce','unknown','unknown',false,false,false,false,false,false,false,true),
-- NeverBounce
('neverbounce','valid','valid',false,false,false,false,false,false,false,true),
('neverbounce','invalid','invalid',false,false,false,false,false,false,false,true),
('neverbounce','catchall','valid_catch_all',false,false,true,false,false,false,false,true),
('neverbounce','disposable','invalid',false,true,false,false,false,false,false,true),
('neverbounce','unknown','unknown',false,false,false,false,false,false,false,true),
-- MillionVerifier
('millionverifier','ok','valid',false,false,false,false,false,false,false,true),
('millionverifier','catch_all','valid_catch_all',false,false,true,false,false,false,false,true),
('millionverifier','disposable','invalid',false,true,false,false,false,false,false,true),
('millionverifier','invalid','invalid',false,false,false,false,false,false,false,true),
('millionverifier','unknown','unknown',false,false,false,false,false,false,false,true),
-- Bouncer
('bouncer','deliverable','valid',false,false,false,false,false,false,false,true),
('bouncer','undeliverable','invalid',false,false,false,false,false,false,false,true),
('bouncer','risky','risky',false,false,false,false,false,false,false,true),
('bouncer','unknown','unknown',false,false,false,false,false,false,false,true),
-- Generic fallbacks
('generic','valid','valid',false,false,false,false,false,false,false,true),
('generic','invalid','invalid',false,false,false,false,false,false,false,true),
('generic','risky','risky',false,false,false,false,false,false,false,true),
('generic','unknown','unknown',false,false,false,false,false,false,false,true),
('generic','catch_all','valid_catch_all',false,false,true,false,false,false,false,true),
('generic','bounced','bounced',false,false,false,false,false,false,false,true),
('generic','suppressed','suppressed',false,false,false,false,false,false,false,true)
ON CONFLICT DO NOTHING;

-- 5. Contact cached projection columns
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_canonical_status public.email_canonical_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS email_is_role_based boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_disposable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_free_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_catch_all boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_syntax_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_mx_missing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_is_temporary_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_status_source text,
  ADD COLUMN IF NOT EXISTS email_status_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_status_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_workspace_email_canonical ON public.contacts(workspace_id, email_canonical_status);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_email_normalized ON public.contacts(workspace_id, email_normalized);

-- 6. Workspace feature flag
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS intelligence_v2 boolean NOT NULL DEFAULT false;

-- 7. Precedence-aware projection function: recomputes contact cached fields
-- Precedence (highest wins):
--   1. bounced (hard) within last 180 days
--   2. suppressed
--   3. most recent internal verification (source = 'internal_verification' or 'verification_job') within last 90 days
--   4. most recent verification overall (any source) within last 365 days
--   5. otherwise 'unverified'
-- Modifier flags are unioned (sticky) from the chosen winning row + most recent disposable/role/free observations.
CREATE OR REPLACE FUNCTION public.recompute_email_status_projection(p_workspace_id uuid, p_normalized_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF p_normalized_email IS NULL OR length(p_normalized_email) = 0 THEN RETURN; END IF;

  WITH ranked AS (
    SELECT *,
      CASE
        WHEN canonical_status = 'bounced' AND verified_at > now() - interval '180 days' THEN 1
        WHEN canonical_status = 'suppressed' THEN 2
        WHEN source IN ('internal_verification','verification_job') AND verified_at > now() - interval '90 days' THEN 3
        WHEN verified_at > now() - interval '365 days' THEN 4
        ELSE 5
      END AS tier
    FROM public.email_status_history
    WHERE workspace_id = p_workspace_id AND normalized_email = p_normalized_email
  ),
  winner AS (
    SELECT * FROM ranked ORDER BY tier ASC, verified_at DESC LIMIT 1
  ),
  flags AS (
    SELECT
      bool_or(is_role_based) AS is_role_based,
      bool_or(is_disposable) AS is_disposable,
      bool_or(is_free_email) AS is_free_email,
      bool_or(is_catch_all) AS is_catch_all,
      bool_or(is_syntax_invalid) AS is_syntax_invalid,
      bool_or(is_mx_missing) AS is_mx_missing,
      bool_or(is_temporary_failure) AS is_temporary_failure
    FROM public.email_status_history
    WHERE workspace_id = p_workspace_id AND normalized_email = p_normalized_email
      AND verified_at > now() - interval '365 days'
  )
  SELECT w.canonical_status, w.source, w.verified_at,
         f.is_role_based, f.is_disposable, f.is_free_email, f.is_catch_all,
         f.is_syntax_invalid, f.is_mx_missing, f.is_temporary_failure
    INTO v_row
  FROM winner w CROSS JOIN flags f;

  IF v_row IS NULL THEN
    UPDATE public.contacts
       SET email_canonical_status = 'unverified',
           email_status_updated_at = now()
     WHERE workspace_id = p_workspace_id AND email_normalized = p_normalized_email;
    RETURN;
  END IF;

  UPDATE public.contacts
     SET email_canonical_status = v_row.canonical_status,
         email_is_role_based = COALESCE(v_row.is_role_based,false),
         email_is_disposable = COALESCE(v_row.is_disposable,false),
         email_is_free_email = COALESCE(v_row.is_free_email,false),
         email_is_catch_all = COALESCE(v_row.is_catch_all,false),
         email_is_syntax_invalid = COALESCE(v_row.is_syntax_invalid,false),
         email_is_mx_missing = COALESCE(v_row.is_mx_missing,false),
         email_is_temporary_failure = COALESCE(v_row.is_temporary_failure,false),
         email_status_source = v_row.source,
         email_status_verified_at = v_row.verified_at,
         email_status_updated_at = now()
   WHERE workspace_id = p_workspace_id AND email_normalized = p_normalized_email;
END;
$$;

-- 8. Trigger: when a history row is inserted, recompute projection
CREATE OR REPLACE FUNCTION public.trg_email_status_history_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_email_status_projection(NEW.workspace_id, NEW.normalized_email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_status_history_recompute ON public.email_status_history;
CREATE TRIGGER email_status_history_recompute
AFTER INSERT ON public.email_status_history
FOR EACH ROW EXECUTE FUNCTION public.trg_email_status_history_after_insert();

-- 9. Forward-matching trigger: when a contact is inserted/updated with an email_normalized,
-- pull any existing verification memory and project it onto the contact.
CREATE OR REPLACE FUNCTION public.trg_contacts_apply_email_memory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_normalized IS NOT NULL AND length(NEW.email_normalized) > 0
     AND (TG_OP = 'INSERT' OR NEW.email_normalized IS DISTINCT FROM OLD.email_normalized) THEN
    PERFORM public.recompute_email_status_projection(NEW.workspace_id, NEW.email_normalized);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_apply_email_memory ON public.contacts;
CREATE TRIGGER contacts_apply_email_memory
AFTER INSERT OR UPDATE OF email_normalized ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_contacts_apply_email_memory();

-- 10. Public RPC for clients: current canonical status for an email
CREATE OR REPLACE FUNCTION public.email_status_current(p_workspace_id uuid, p_email text)
RETURNS TABLE (
  normalized_email text,
  canonical_status public.email_canonical_status,
  is_role_based boolean,
  is_disposable boolean,
  is_free_email boolean,
  is_catch_all boolean,
  is_syntax_invalid boolean,
  is_mx_missing boolean,
  is_temporary_failure boolean,
  source text,
  verified_at timestamptz,
  observation_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  v_norm := lower(trim(p_email));
  RETURN QUERY
  WITH ranked AS (
    SELECT *,
      CASE
        WHEN canonical_status = 'bounced' AND verified_at > now() - interval '180 days' THEN 1
        WHEN canonical_status = 'suppressed' THEN 2
        WHEN source IN ('internal_verification','verification_job') AND verified_at > now() - interval '90 days' THEN 3
        WHEN verified_at > now() - interval '365 days' THEN 4
        ELSE 5
      END AS tier
    FROM public.email_status_history
    WHERE workspace_id = p_workspace_id AND normalized_email = v_norm
  ),
  winner AS (
    SELECT * FROM ranked ORDER BY tier, verified_at DESC LIMIT 1
  ),
  flags AS (
    SELECT
      bool_or(is_role_based) AS rb, bool_or(is_disposable) AS dp, bool_or(is_free_email) AS fe,
      bool_or(is_catch_all) AS ca, bool_or(is_syntax_invalid) AS sx, bool_or(is_mx_missing) AS mx,
      bool_or(is_temporary_failure) AS tf, count(*) AS cnt
    FROM public.email_status_history
    WHERE workspace_id = p_workspace_id AND normalized_email = v_norm
  )
  SELECT v_norm,
         COALESCE(w.canonical_status, 'unverified'::public.email_canonical_status),
         COALESCE(f.rb,false), COALESCE(f.dp,false), COALESCE(f.fe,false),
         COALESCE(f.ca,false), COALESCE(f.sx,false), COALESCE(f.mx,false), COALESCE(f.tf,false),
         w.source, w.verified_at, COALESCE(f.cnt,0)
  FROM flags f LEFT JOIN winner w ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_status_current(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_email_status_projection(uuid, text) TO authenticated, service_role;
