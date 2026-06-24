
-- 1) mailboxes: revoke read of credential columns from regular users
REVOKE SELECT (smtp_password_encrypted, oauth_access_token, oauth_refresh_token)
  ON public.mailboxes FROM authenticated, anon;
-- service_role retains full access (GRANT ALL already applied)

-- 2) linkedin_webhooks: revoke read of signing secret from regular users
REVOKE SELECT (secret) ON public.linkedin_webhooks FROM authenticated, anon;

-- 3) login_audit_log: route writes through a validated SECURITY DEFINER function
--    and remove the wide-open anon/authenticated insert policies.

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email text,
  p_success boolean,
  p_error_message text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_err   text;
  v_ua    text;
BEGIN
  -- Basic input validation to prevent log flooding / garbage rows.
  IF p_email IS NULL OR length(p_email) < 3 OR length(p_email) > 320 THEN
    RETURN;
  END IF;
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN;
  END IF;

  v_email := lower(p_email);
  v_err   := left(coalesce(p_error_message, ''), 500);
  v_ua    := left(coalesce(p_user_agent, ''), 500);

  INSERT INTO public.login_audit_log (email, success, error_message, user_agent)
  VALUES (v_email, coalesce(p_success, false), nullif(v_err, ''), nullif(v_ua, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_attempt(text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS login_audit_anon_insert ON public.login_audit_log;
DROP POLICY IF EXISTS login_audit_auth_insert ON public.login_audit_log;
-- SELECT policy for platform admins remains in place.
-- Direct INSERT is now blocked; all writes must go through record_login_attempt().
