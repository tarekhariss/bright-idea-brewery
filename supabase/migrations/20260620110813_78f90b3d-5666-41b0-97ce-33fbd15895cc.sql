
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS email_targeting_mode text NOT NULL DEFAULT 'strict'
  CHECK (email_targeting_mode IN ('strict','balanced','aggressive'));

CREATE OR REPLACE FUNCTION public.email_status_allowed_for_mode(
  p_status public.email_canonical_status,
  p_is_disposable boolean,
  p_mode text
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_is_disposable,false) THEN false
    WHEN p_status IN ('invalid','bounced','suppressed','unverified') THEN false
    WHEN p_mode = 'strict'     THEN p_status = 'valid'
    WHEN p_mode = 'balanced'   THEN p_status IN ('valid','valid_catch_all')
    WHEN p_mode = 'aggressive' THEN p_status IN ('valid','valid_catch_all','risky','unknown')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_guard_campaign_enrollment_email_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text; v_ws uuid; v_intel boolean;
  v_status public.email_canonical_status; v_disposable boolean;
BEGIN
  SELECT c.email_targeting_mode, c.workspace_id INTO v_mode, v_ws
  FROM public.campaigns c WHERE c.id = NEW.campaign_id;
  IF v_mode IS NULL THEN RETURN NEW; END IF;

  SELECT intelligence_v2 INTO v_intel FROM public.workspaces WHERE id = v_ws;
  IF NOT COALESCE(v_intel,false) THEN
    RETURN NEW;  -- legacy workspaces unaffected
  END IF;

  SELECT email_canonical_status, email_is_disposable
    INTO v_status, v_disposable
    FROM public.contacts WHERE id = NEW.contact_id;
  IF v_status IS NULL THEN v_status := 'unverified'; END IF;

  IF NOT public.email_status_allowed_for_mode(v_status, v_disposable, v_mode) THEN
    RAISE EXCEPTION 'Contact blocked by campaign targeting mode % (status=%, disposable=%)',
      v_mode, v_status, COALESCE(v_disposable,false)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_campaign_enrollment_email_status ON public.campaign_enrollments;
CREATE TRIGGER guard_campaign_enrollment_email_status
BEFORE INSERT ON public.campaign_enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_campaign_enrollment_email_status();

-- Preview RPC: counts how many of a contact set are allowed/blocked by reason.
CREATE OR REPLACE FUNCTION public.preview_campaign_targeting(
  p_campaign_id uuid,
  p_contact_ids uuid[]
) RETURNS TABLE (
  total bigint,
  included bigint,
  blocked_disposable bigint,
  blocked_invalid bigint,
  blocked_bounced bigint,
  blocked_suppressed bigint,
  blocked_unverified bigint,
  blocked_catch_all bigint,
  blocked_risky bigint,
  blocked_unknown bigint,
  mode text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_mode text; v_ws uuid;
BEGIN
  SELECT c.email_targeting_mode, c.workspace_id INTO v_mode, v_ws
  FROM public.campaigns c WHERE c.id = p_campaign_id;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_ws AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT id, COALESCE(email_canonical_status,'unverified'::public.email_canonical_status) AS s,
           COALESCE(email_is_disposable,false) AS d
    FROM public.contacts
    WHERE workspace_id = v_ws AND id = ANY(p_contact_ids)
  )
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE public.email_status_allowed_for_mode(s,d,v_mode))::bigint,
    count(*) FILTER (WHERE d)::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'invalid')::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'bounced')::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'suppressed')::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'unverified')::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'valid_catch_all' AND NOT public.email_status_allowed_for_mode(s,d,v_mode))::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'risky' AND NOT public.email_status_allowed_for_mode(s,d,v_mode))::bigint,
    count(*) FILTER (WHERE NOT d AND s = 'unknown' AND NOT public.email_status_allowed_for_mode(s,d,v_mode))::bigint,
    v_mode
  FROM base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_status_allowed_for_mode(public.email_canonical_status, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_campaign_targeting(uuid, uuid[]) TO authenticated;
