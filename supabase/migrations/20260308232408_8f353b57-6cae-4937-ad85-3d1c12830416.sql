
-- Platform admin role check function (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Admin workspace summaries table
CREATE TABLE IF NOT EXISTS public.admin_workspace_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  workspace_name text NOT NULL,
  owner_email text,
  member_count integer DEFAULT 0,
  active_campaigns integer DEFAULT 0,
  total_contacts integer DEFAULT 0,
  total_companies integer DEFAULT 0,
  total_campaigns integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  attributed_revenue numeric DEFAULT 0,
  last_activity_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.admin_workspace_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all workspace summaries"
  ON public.admin_workspace_summaries FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage workspace summaries"
  ON public.admin_workspace_summaries FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Admin mailbox summaries
CREATE TABLE IF NOT EXISTS public.admin_mailbox_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  workspace_name text,
  mailbox_id uuid NOT NULL,
  mailbox_email text,
  provider text,
  health_score numeric DEFAULT 0,
  bounce_rate numeric DEFAULT 0,
  reply_rate numeric DEFAULT 0,
  emails_sent_7d integer DEFAULT 0,
  status text DEFAULT 'unknown',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_mailbox_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view mailbox summaries"
  ON public.admin_mailbox_summaries FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage mailbox summaries"
  ON public.admin_mailbox_summaries FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Admin campaign summaries
CREATE TABLE IF NOT EXISTS public.admin_campaign_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  workspace_name text,
  campaign_id uuid NOT NULL,
  campaign_name text,
  status text DEFAULT 'draft',
  emails_sent integer DEFAULT 0,
  replies integer DEFAULT 0,
  meetings integer DEFAULT 0,
  deals integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  attributed_revenue numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_campaign_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view campaign summaries"
  ON public.admin_campaign_summaries FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage campaign summaries"
  ON public.admin_campaign_summaries FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Admin LinkedIn summaries
CREATE TABLE IF NOT EXISTS public.admin_linkedin_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  workspace_name text,
  linkedin_account_id uuid NOT NULL,
  account_name text,
  connection_status text DEFAULT 'disconnected',
  health_score numeric DEFAULT 0,
  connects_sent_today integer DEFAULT 0,
  messages_sent_today integer DEFAULT 0,
  last_activity_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_linkedin_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view linkedin summaries"
  ON public.admin_linkedin_summaries FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage linkedin summaries"
  ON public.admin_linkedin_summaries FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Admin activity feed
CREATE TABLE IF NOT EXISTS public.admin_activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_name text,
  event_type text NOT NULL,
  event_title text NOT NULL,
  event_description text,
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view activity feed"
  ON public.admin_activity_feed FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage activity feed"
  ON public.admin_activity_feed FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Platform KPIs (aggregated across all workspaces)
CREATE TABLE IF NOT EXISTS public.admin_platform_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_workspaces integer DEFAULT 0,
  active_workspaces integer DEFAULT 0,
  total_contacts integer DEFAULT 0,
  total_companies integer DEFAULT 0,
  total_campaigns integer DEFAULT 0,
  active_campaigns integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  attributed_revenue numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_platform_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view platform kpis"
  ON public.admin_platform_kpis FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage platform kpis"
  ON public.admin_platform_kpis FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
