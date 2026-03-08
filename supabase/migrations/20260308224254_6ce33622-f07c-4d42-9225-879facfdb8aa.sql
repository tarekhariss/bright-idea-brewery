
-- Attribution types
CREATE TYPE public.attribution_type AS ENUM ('first_touch', 'last_touch', 'multi_touch');

-- Campaign Attribution
CREATE TABLE public.campaign_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  attribution_type public.attribution_type NOT NULL DEFAULT 'first_touch',
  attributed_revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_select" ON public.campaign_attribution FOR SELECT TO authenticated USING (true);
CREATE POLICY "ca_insert" ON public.campaign_attribution FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ca_update" ON public.campaign_attribution FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ca_delete" ON public.campaign_attribution FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- Contact Funnel Metrics
CREATE TABLE public.contact_funnel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  emails_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  linkedin_actions_completed integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  last_activity_at timestamptz
);
ALTER TABLE public.contact_funnel_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfm_select" ON public.contact_funnel_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfm_insert" ON public.contact_funnel_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cfm_update" ON public.contact_funnel_metrics FOR UPDATE TO authenticated USING (true);

-- Campaign Performance Metrics
CREATE TABLE public.campaign_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  emails_sent integer DEFAULT 0,
  emails_delivered integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  positive_replies integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  open_rate numeric,
  reply_rate numeric,
  meeting_rate numeric,
  deal_rate numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpm_select" ON public.campaign_performance_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpm_manage" ON public.campaign_performance_metrics FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager','operator']::app_role[]));

-- Mailbox Performance Metrics
CREATE TABLE public.mailbox_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE CASCADE NOT NULL,
  emails_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  bounce_count integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  health_score integer DEFAULT 100,
  period_start date NOT NULL,
  period_end date NOT NULL
);
ALTER TABLE public.mailbox_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpm_select" ON public.mailbox_performance_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "mpm_manage" ON public.mailbox_performance_metrics FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- LinkedIn Performance Metrics
CREATE TABLE public.linkedin_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE NOT NULL,
  connect_requests_sent integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL
);
ALTER TABLE public.linkedin_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lpm_select" ON public.linkedin_performance_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "lpm_manage" ON public.linkedin_performance_metrics FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- Workspace KPIs
CREATE TABLE public.workspace_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  campaigns_active integer DEFAULT 0,
  contacts_enrolled integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_created integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.workspace_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wk_select" ON public.workspace_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "wk_manage" ON public.workspace_kpis FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));
