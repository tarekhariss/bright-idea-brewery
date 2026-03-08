
-- LinkedIn Account Connection Status
CREATE TYPE public.linkedin_connection_status AS ENUM ('connected', 'disconnected');

-- LinkedIn Action Type
CREATE TYPE public.linkedin_action_type AS ENUM ('connect', 'message');

-- LinkedIn Action Queue Status
CREATE TYPE public.linkedin_queue_status AS ENUM ('pending', 'scheduled', 'completed', 'failed');

-- ── 1. LinkedIn Accounts ──
CREATE TABLE public.linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  profile_url text,
  connection_status public.linkedin_connection_status NOT NULL DEFAULT 'disconnected',
  daily_connect_limit integer NOT NULL DEFAULT 20,
  daily_message_limit integer NOT NULL DEFAULT 50,
  last_action_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_accounts_select" ON public.linkedin_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_accounts_manage" ON public.linkedin_accounts FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 2. LinkedIn Account Health ──
CREATE TABLE public.linkedin_account_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE UNIQUE,
  connects_sent_today integer NOT NULL DEFAULT 0,
  messages_sent_today integer NOT NULL DEFAULT 0,
  connects_last_7_days integer NOT NULL DEFAULT 0,
  messages_last_7_days integer NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 100,
  last_health_update timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_account_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_account_health_select" ON public.linkedin_account_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_account_health_manage" ON public.linkedin_account_health FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 3. Campaign LinkedIn Accounts (junction) ──
CREATE TABLE public.campaign_linkedin_accounts (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, linkedin_account_id)
);
ALTER TABLE public.campaign_linkedin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_linkedin_accounts_select" ON public.campaign_linkedin_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_linkedin_accounts_insert" ON public.campaign_linkedin_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_linkedin_accounts_delete" ON public.campaign_linkedin_accounts FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 4. Extend campaign_steps with linkedin_message_template_id ──
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS linkedin_message_template_id uuid;

-- ── 5. LinkedIn Message Templates ──
CREATE TABLE public.linkedin_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  message_body text,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_message_templates_select" ON public.linkedin_message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_message_templates_insert" ON public.linkedin_message_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "linkedin_message_templates_update" ON public.linkedin_message_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "linkedin_message_templates_delete" ON public.linkedin_message_templates FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add FK from campaign_steps to linkedin_message_templates
ALTER TABLE public.campaign_steps
  ADD CONSTRAINT campaign_steps_linkedin_message_template_id_fkey
  FOREIGN KEY (linkedin_message_template_id) REFERENCES public.linkedin_message_templates(id) ON DELETE SET NULL;

-- ── 6. LinkedIn Action Queue ──
CREATE TABLE public.linkedin_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_step_id uuid REFERENCES public.campaign_steps(id) ON DELETE SET NULL,
  action_type public.linkedin_action_type NOT NULL,
  status public.linkedin_queue_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_action_queue_select" ON public.linkedin_action_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_action_queue_insert" ON public.linkedin_action_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "linkedin_action_queue_update" ON public.linkedin_action_queue FOR UPDATE TO authenticated USING (true);

-- ── 7. LinkedIn Action History ──
CREATE TABLE public.linkedin_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  action_type public.linkedin_action_type NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  executed_at timestamptz DEFAULT now(),
  result text
);
ALTER TABLE public.linkedin_action_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_action_history_select" ON public.linkedin_action_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_action_history_insert" ON public.linkedin_action_history FOR INSERT TO authenticated WITH CHECK (true);

-- ── 8. LinkedIn Safety Rules ──
CREATE TABLE public.linkedin_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  max_connects_per_day integer NOT NULL DEFAULT 20,
  max_messages_per_day integer NOT NULL DEFAULT 50,
  min_delay_minutes integer NOT NULL DEFAULT 2,
  max_delay_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_safety_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linkedin_safety_rules_select" ON public.linkedin_safety_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "linkedin_safety_rules_manage" ON public.linkedin_safety_rules FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));
