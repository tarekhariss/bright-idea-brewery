-- Login audit log
CREATE TABLE IF NOT EXISTS public.login_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "login_audit_admin_select" ON public.login_audit_log
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow anon inserts (login happens before auth)
CREATE POLICY "login_audit_anon_insert" ON public.login_audit_log
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "login_audit_auth_insert" ON public.login_audit_log
FOR INSERT TO authenticated
WITH CHECK (true);

-- Server-side allowlist enforcement function for use in edge functions/RPCs
CREATE OR REPLACE FUNCTION public.assert_email_allowed()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(v_email)) THEN
    RAISE EXCEPTION 'Access denied: email not on allowlist';
  END IF;
END;
$$;