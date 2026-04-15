-- Create an allowed_emails table for the allowlist
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Seed the two approved emails
INSERT INTO public.allowed_emails (email) VALUES
  ('tarekhariss@theleadsbridge.com'),
  ('tarekhariss3@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- RLS: only admins can manage, anon/authenticated can read for login check
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_emails_select_auth" ON public.allowed_emails
FOR SELECT TO authenticated USING (true);

CREATE POLICY "allowed_emails_select_anon" ON public.allowed_emails
FOR SELECT TO anon USING (true);

CREATE POLICY "allowed_emails_admin_insert" ON public.allowed_emails
FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "allowed_emails_admin_delete" ON public.allowed_emails
FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- RPC callable before full auth to check allowlist
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(p_email)
  );
$$;