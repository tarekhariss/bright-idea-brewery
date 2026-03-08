
-- ============================================================
-- Outbound Architecture Extension — Full Schema Migration
-- ============================================================

-- 1. Email Providers
CREATE TABLE IF NOT EXISTS public.email_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL, -- gmail, outlook, smtp, ses, sendgrid, mailgun
  auth_type text NOT NULL DEFAULT 'smtp', -- oauth, smtp
  api_endpoint text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_providers_select" ON public.email_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_providers_manage" ON public.email_providers FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 2. Extend mailboxes with provider_id and OAuth fields
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.email_providers(id) ON DELETE SET NULL;
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS smtp_password_encrypted text;
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS oauth_access_token text;
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS oauth_refresh_token text;
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS oauth_expires_at timestamptz;

-- 3. Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text,
  body text,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_templates_select" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_templates_insert" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "email_templates_update" ON public.email_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "email_templates_delete" ON public.email_templates FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 4. Email Variants (A/B testing)
CREATE TABLE IF NOT EXISTS public.email_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  variant_name text NOT NULL DEFAULT 'A', -- A, B, C, D
  subject text,
  body text,
  sent_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_variants_select" ON public.email_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_variants_insert" ON public.email_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "email_variants_update" ON public.email_variants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "email_variants_delete" ON public.email_variants FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 5. Campaign status enum
DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft','active','paused','completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  owner_id uuid,
  daily_limit integer DEFAULT 50,
  min_wait_minutes integer DEFAULT 3,
  random_wait_minutes integer DEFAULT 5,
  max_new_leads_per_day integer DEFAULT 30,
  stop_on_reply boolean DEFAULT true,
  stop_on_auto_reply boolean DEFAULT false,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  description text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campaigns_delete" ON public.campaigns FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]) OR owner_id = auth.uid());

-- 7. Campaign contact status enum
DO $$ BEGIN
  CREATE TYPE public.campaign_contact_status AS ENUM ('pending','sent','replied','bounced','opted_out','meeting_booked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Campaign Contacts
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.campaign_contact_status NOT NULL DEFAULT 'pending',
  sent_count integer DEFAULT 0,
  last_sent_at timestamptz,
  reply_status text,
  meeting_booked boolean DEFAULT false,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_contacts_select" ON public.campaign_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_contacts_insert" ON public.campaign_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_contacts_update" ON public.campaign_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campaign_contacts_delete" ON public.campaign_contacts FOR DELETE TO authenticated USING (true);

-- 9. Campaign Mailboxes
CREATE TABLE IF NOT EXISTS public.campaign_mailboxes (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, mailbox_id)
);
ALTER TABLE public.campaign_mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_mailboxes_select" ON public.campaign_mailboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_mailboxes_insert" ON public.campaign_mailboxes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_mailboxes_delete" ON public.campaign_mailboxes FOR DELETE TO authenticated USING (true);

-- 10. Mailbox Health
CREATE TABLE IF NOT EXISTS public.mailbox_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE UNIQUE,
  bounce_rate numeric DEFAULT 0,
  reply_rate numeric DEFAULT 0,
  open_rate numeric DEFAULT 0,
  sent_last_7_days integer DEFAULT 0,
  sent_last_30_days integer DEFAULT 0,
  health_score integer DEFAULT 100,
  last_health_update timestamptz DEFAULT now()
);
ALTER TABLE public.mailbox_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mailbox_health_select" ON public.mailbox_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "mailbox_health_manage" ON public.mailbox_health FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager','operator']::app_role[]));

-- 11. Mailbox Warmup Settings
CREATE TABLE IF NOT EXISTS public.mailbox_warmup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE UNIQUE,
  warmup_enabled boolean DEFAULT false,
  daily_warmup_limit integer DEFAULT 5,
  increase_per_day integer DEFAULT 2,
  reply_rate_target numeric DEFAULT 30,
  open_rate_target numeric DEFAULT 60,
  spam_protection_rate numeric DEFAULT 95,
  read_emulation boolean DEFAULT true,
  weekdays_only boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.mailbox_warmup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warmup_settings_select" ON public.mailbox_warmup_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "warmup_settings_manage" ON public.mailbox_warmup_settings FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 12. Sending Windows
CREATE TABLE IF NOT EXISTS public.sending_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text DEFAULT 'Default',
  start_hour integer NOT NULL DEFAULT 9,
  end_hour integer NOT NULL DEFAULT 17,
  timezone text NOT NULL DEFAULT 'America/New_York',
  weekdays_only boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sending_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sending_windows_select" ON public.sending_windows FOR SELECT TO authenticated USING (true);
CREATE POLICY "sending_windows_manage" ON public.sending_windows FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 13. ESP Routing Rules
CREATE TABLE IF NOT EXISTS public.esp_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_provider text NOT NULL, -- gmail, outlook, yahoo, other
  preferred_mailbox_provider text NOT NULL, -- gmail, outlook, smtp
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.esp_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_routing_select" ON public.esp_routing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_routing_manage" ON public.esp_routing_rules FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 14. Email Bounces
CREATE TABLE IF NOT EXISTS public.email_bounces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES public.emails(id) ON DELETE CASCADE,
  mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  bounce_type text NOT NULL DEFAULT 'hard', -- hard, soft, complaint
  bounce_reason text,
  smtp_code text,
  recipient_address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_bounces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_bounces_select" ON public.email_bounces FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_bounces_insert" ON public.email_bounces FOR INSERT TO authenticated WITH CHECK (true);

-- 15. Domain Send Limits
CREATE TABLE IF NOT EXISTS public.domain_send_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  max_per_day integer DEFAULT 100,
  sent_today integer DEFAULT 0,
  sent_last_30_days integer DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, domain)
);
ALTER TABLE public.domain_send_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_send_limits_select" ON public.domain_send_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "domain_send_limits_manage" ON public.domain_send_limits FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 16. Contact Suppression
CREATE TABLE IF NOT EXISTS public.contact_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'manual',
  suppressed_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, contact_id)
);
ALTER TABLE public.contact_suppression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_suppression_select" ON public.contact_suppression FOR SELECT TO authenticated USING (true);
CREATE POLICY "contact_suppression_insert" ON public.contact_suppression FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contact_suppression_delete" ON public.contact_suppression FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 17. Domain Suppression
CREATE TABLE IF NOT EXISTS public.domain_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  suppressed_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, domain)
);
ALTER TABLE public.domain_suppression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_suppression_select" ON public.domain_suppression FOR SELECT TO authenticated USING (true);
CREATE POLICY "domain_suppression_insert" ON public.domain_suppression FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "domain_suppression_delete" ON public.domain_suppression FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 18. Campaign Stats (materialized/aggregated)
CREATE TABLE IF NOT EXISTS public.campaign_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE,
  emails_sent integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  emails_clicked integer DEFAULT 0,
  replies integer DEFAULT 0,
  bounces integer DEFAULT 0,
  meetings integer DEFAULT 0,
  deals integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  last_updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_stats_select" ON public.campaign_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_stats_manage" ON public.campaign_stats FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin','manager','operator']::app_role[]));

-- 19. Inbox thread status enum
DO $$ BEGIN
  CREATE TYPE public.inbox_thread_status AS ENUM ('open','snoozed','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 20. Inbox Threads
CREATE TABLE IF NOT EXISTS public.inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text, -- external thread identifier
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject text,
  status public.inbox_thread_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  assigned_to uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.inbox_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_threads_select" ON public.inbox_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "inbox_threads_insert" ON public.inbox_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inbox_threads_update" ON public.inbox_threads FOR UPDATE TO authenticated USING (true);

-- 21. Inbox Messages
CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.inbox_threads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'inbound', -- inbound, outbound
  from_address text,
  to_address text,
  subject text,
  body_text text,
  body_html text,
  timestamp timestamptz DEFAULT now(),
  email_id uuid REFERENCES public.emails(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_messages_select" ON public.inbox_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "inbox_messages_insert" ON public.inbox_messages FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON public.campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON public.campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact ON public.campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON public.campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON public.email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_bounces_email ON public.email_bounces(email_id);
CREATE INDEX IF NOT EXISTS idx_email_bounces_mailbox ON public.email_bounces(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_workspace ON public.inbox_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_contact ON public.inbox_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_status ON public.inbox_threads(status);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON public.inbox_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_contact_suppression_workspace ON public.contact_suppression(workspace_id);
CREATE INDEX IF NOT EXISTS idx_domain_suppression_workspace ON public.domain_suppression(workspace_id);
CREATE INDEX IF NOT EXISTS idx_domain_send_limits_workspace ON public.domain_send_limits(workspace_id);

-- Seed default email providers
INSERT INTO public.email_providers (provider_name, auth_type, api_endpoint) VALUES
  ('gmail', 'oauth', 'https://gmail.googleapis.com'),
  ('outlook', 'oauth', 'https://graph.microsoft.com'),
  ('smtp', 'smtp', null),
  ('ses', 'smtp', 'https://email.amazonaws.com'),
  ('sendgrid', 'smtp', 'https://api.sendgrid.com'),
  ('mailgun', 'smtp', 'https://api.mailgun.net')
ON CONFLICT DO NOTHING;
