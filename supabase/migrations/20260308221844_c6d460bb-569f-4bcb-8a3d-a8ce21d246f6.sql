
-- Enums for new tables
CREATE TYPE public.campaign_step_type AS ENUM ('email', 'linkedin_connect', 'linkedin_message', 'task', 'delay');
CREATE TYPE public.campaign_enrollment_status AS ENUM ('pending', 'active', 'completed', 'stopped');
CREATE TYPE public.campaign_step_execution_status AS ENUM ('scheduled', 'completed', 'skipped', 'failed');

-- 1. Campaign Steps
CREATE TABLE public.campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  step_type public.campaign_step_type NOT NULL DEFAULT 'email',
  delay_days integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,
  email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  task_description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_steps_select" ON public.campaign_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_steps_insert" ON public.campaign_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_steps_update" ON public.campaign_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campaign_steps_delete" ON public.campaign_steps FOR DELETE TO authenticated USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
);

-- 2. Campaign Enrollments
CREATE TABLE public.campaign_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  current_step_id uuid REFERENCES public.campaign_steps(id) ON DELETE SET NULL,
  status public.campaign_enrollment_status NOT NULL DEFAULT 'pending',
  scheduled_start timestamptz,
  last_step_executed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_enrollments_select" ON public.campaign_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_enrollments_insert" ON public.campaign_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_enrollments_update" ON public.campaign_enrollments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campaign_enrollments_delete" ON public.campaign_enrollments FOR DELETE TO authenticated USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
);

-- 3. Campaign Step Executions
CREATE TABLE public.campaign_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.campaign_steps(id) ON DELETE CASCADE,
  status public.campaign_step_execution_status NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  executed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_step_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_step_executions_select" ON public.campaign_step_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_step_executions_insert" ON public.campaign_step_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_step_executions_update" ON public.campaign_step_executions FOR UPDATE TO authenticated USING (true);

-- 4. Extend tasks table with campaign_id
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- 5. Mailbox Rotation State
CREATE TABLE public.mailbox_rotation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE UNIQUE,
  emails_sent_today integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  last_reset_date date DEFAULT CURRENT_DATE
);
ALTER TABLE public.mailbox_rotation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mailbox_rotation_select" ON public.mailbox_rotation_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "mailbox_rotation_manage" ON public.mailbox_rotation_state FOR ALL TO authenticated USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'operator'::app_role])
);

-- 6. Contact Outreach History
CREATE TABLE public.contact_outreach_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  emails_sent integer NOT NULL DEFAULT 0,
  linkedin_actions integer NOT NULL DEFAULT 0,
  tasks_completed integer NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, campaign_id)
);
ALTER TABLE public.contact_outreach_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_outreach_history_select" ON public.contact_outreach_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "contact_outreach_history_insert" ON public.contact_outreach_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contact_outreach_history_update" ON public.contact_outreach_history FOR UPDATE TO authenticated USING (true);

-- 7. Sequence Safety Rules
CREATE TABLE public.sequence_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  max_emails_per_contact integer NOT NULL DEFAULT 5,
  max_emails_per_domain integer NOT NULL DEFAULT 50,
  cooldown_days integer NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);
ALTER TABLE public.sequence_safety_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequence_safety_rules_select" ON public.sequence_safety_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "sequence_safety_rules_manage" ON public.sequence_safety_rules FOR ALL TO authenticated USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
);
