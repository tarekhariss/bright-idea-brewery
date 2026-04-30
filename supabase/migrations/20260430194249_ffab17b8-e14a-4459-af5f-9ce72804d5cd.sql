
-- Extend enums (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_action_type'::regtype AND enumlabel = 'view_profile') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'view_profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_action_type'::regtype AND enumlabel = 'follow_up_message') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'follow_up_message';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_action_type'::regtype AND enumlabel = 'manual_task') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'manual_task';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_action_type'::regtype AND enumlabel = 'wait') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'wait';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_connection_status'::regtype AND enumlabel = 'pending_setup') THEN
    ALTER TYPE linkedin_connection_status ADD VALUE 'pending_setup';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'linkedin_connection_status'::regtype AND enumlabel = 'paused') THEN
    ALTER TYPE linkedin_connection_status ADD VALUE 'paused';
  END IF;
END $$;

-- Add a few extra columns to linkedin_accounts for richer settings (idempotent)
ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS daily_view_limit integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS sending_window_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS sending_window_end time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============== Campaigns ==============
CREATE TABLE IF NOT EXISTS public.linkedin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft', -- draft|active|paused|completed|archived
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  source_list_id uuid, -- soft ref to lists table (if exists)
  daily_connect_limit integer NOT NULL DEFAULT 20,
  daily_message_limit integer NOT NULL DEFAULT 50,
  sending_window_start time NOT NULL DEFAULT '09:00',
  sending_window_end time NOT NULL DEFAULT '17:00',
  timezone text NOT NULL DEFAULT 'UTC',
  stop_on_reply boolean NOT NULL DEFAULT true,
  exclude_existing_connections boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_camp_ws ON public.linkedin_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_li_camp_status ON public.linkedin_campaigns(workspace_id, status);

ALTER TABLE public.linkedin_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_camp_select ON public.linkedin_campaigns;
DROP POLICY IF EXISTS li_camp_insert ON public.linkedin_campaigns;
DROP POLICY IF EXISTS li_camp_update ON public.linkedin_campaigns;
DROP POLICY IF EXISTS li_camp_delete ON public.linkedin_campaigns;
CREATE POLICY li_camp_select ON public.linkedin_campaigns FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_insert ON public.linkedin_campaigns FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_update ON public.linkedin_campaigns FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_delete ON public.linkedin_campaigns FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));

-- ============== Campaign Steps ==============
CREATE TABLE IF NOT EXISTS public.linkedin_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  step_type text NOT NULL, -- view_profile|connect_request|message|follow_up_message|manual_task|wait
  delay_days integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,
  message_body text,
  template_id uuid REFERENCES public.linkedin_message_templates(id) ON DELETE SET NULL,
  task_title text,
  task_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_steps_campaign ON public.linkedin_campaign_steps(campaign_id, step_order);

ALTER TABLE public.linkedin_campaign_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_steps_select ON public.linkedin_campaign_steps;
DROP POLICY IF EXISTS li_steps_insert ON public.linkedin_campaign_steps;
DROP POLICY IF EXISTS li_steps_update ON public.linkedin_campaign_steps;
DROP POLICY IF EXISTS li_steps_delete ON public.linkedin_campaign_steps;
CREATE POLICY li_steps_select ON public.linkedin_campaign_steps FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_steps_insert ON public.linkedin_campaign_steps FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_steps_update ON public.linkedin_campaign_steps FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_steps_delete ON public.linkedin_campaign_steps FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- Auto-set workspace_id from campaign
CREATE OR REPLACE FUNCTION public.tg_li_step_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_li_step_workspace ON public.linkedin_campaign_steps;
CREATE TRIGGER trg_li_step_workspace BEFORE INSERT ON public.linkedin_campaign_steps
  FOR EACH ROW EXECUTE FUNCTION public.tg_li_step_set_workspace();

-- ============== Campaign Leads ==============
CREATE TABLE IF NOT EXISTS public.linkedin_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued', -- queued|active|paused|replied|connected|completed|failed|skipped
  connection_status text NOT NULL DEFAULT 'not_connected', -- not_connected|invited|connected|withdrawn|declined
  current_step_order integer NOT NULL DEFAULT 0,
  last_action_at timestamptz,
  last_action_type text,
  last_reply_at timestamptz,
  reply_status text, -- none|interested|not_interested|neutral|meeting_booked|auto_reply
  outcome text, -- pending|won|lost|nurture|unsubscribed
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_li_leads_campaign ON public.linkedin_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_li_leads_ws ON public.linkedin_campaign_leads(workspace_id);

ALTER TABLE public.linkedin_campaign_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_leads_select ON public.linkedin_campaign_leads;
DROP POLICY IF EXISTS li_leads_insert ON public.linkedin_campaign_leads;
DROP POLICY IF EXISTS li_leads_update ON public.linkedin_campaign_leads;
DROP POLICY IF EXISTS li_leads_delete ON public.linkedin_campaign_leads;
CREATE POLICY li_leads_select ON public.linkedin_campaign_leads FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_leads_insert ON public.linkedin_campaign_leads FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_leads_update ON public.linkedin_campaign_leads FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_leads_delete ON public.linkedin_campaign_leads FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE OR REPLACE FUNCTION public.tg_li_lead_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_li_lead_workspace ON public.linkedin_campaign_leads;
CREATE TRIGGER trg_li_lead_workspace BEFORE INSERT ON public.linkedin_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_li_lead_set_workspace();

-- ============== LinkedIn Inbox ==============
CREATE TABLE IF NOT EXISTS public.linkedin_inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.linkedin_campaigns(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  subject text,
  preview text,
  category text NOT NULL DEFAULT 'needs_review', -- interested|not_interested|meeting_booked|neutral|auto_reply|needs_review
  user_category text, -- manual override
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_inbox_ws ON public.linkedin_inbox_threads(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_li_inbox_campaign ON public.linkedin_inbox_threads(campaign_id);

ALTER TABLE public.linkedin_inbox_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_inbox_threads_select ON public.linkedin_inbox_threads;
DROP POLICY IF EXISTS li_inbox_threads_insert ON public.linkedin_inbox_threads;
DROP POLICY IF EXISTS li_inbox_threads_update ON public.linkedin_inbox_threads;
DROP POLICY IF EXISTS li_inbox_threads_delete ON public.linkedin_inbox_threads;
CREATE POLICY li_inbox_threads_select ON public.linkedin_inbox_threads FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_threads_insert ON public.linkedin_inbox_threads FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_threads_update ON public.linkedin_inbox_threads FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_threads_delete ON public.linkedin_inbox_threads FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.linkedin_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.linkedin_inbox_threads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'inbound', -- inbound|outbound
  body text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_inbox_msg_thread ON public.linkedin_inbox_messages(thread_id, sent_at);

ALTER TABLE public.linkedin_inbox_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_inbox_msg_select ON public.linkedin_inbox_messages;
DROP POLICY IF EXISTS li_inbox_msg_insert ON public.linkedin_inbox_messages;
DROP POLICY IF EXISTS li_inbox_msg_update ON public.linkedin_inbox_messages;
DROP POLICY IF EXISTS li_inbox_msg_delete ON public.linkedin_inbox_messages;
CREATE POLICY li_inbox_msg_select ON public.linkedin_inbox_messages FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_msg_insert ON public.linkedin_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_msg_update ON public.linkedin_inbox_messages FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_inbox_msg_delete ON public.linkedin_inbox_messages FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE OR REPLACE FUNCTION public.tg_li_inbox_msg_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.thread_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_inbox_threads WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_li_inbox_msg_ws ON public.linkedin_inbox_messages;
CREATE TRIGGER trg_li_inbox_msg_ws BEFORE INSERT ON public.linkedin_inbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_li_inbox_msg_set_workspace();

-- ============== LinkedIn Tasks ==============
CREATE TABLE IF NOT EXISTS public.linkedin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.linkedin_campaigns(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.linkedin_campaign_steps(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'manual_task', -- manual_task|view_profile|connect_request|message|follow_up_message
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending', -- pending|in_progress|done|skipped
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_tasks_ws_status ON public.linkedin_tasks(workspace_id, status, due_at);

ALTER TABLE public.linkedin_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_tasks_select ON public.linkedin_tasks;
DROP POLICY IF EXISTS li_tasks_insert ON public.linkedin_tasks;
DROP POLICY IF EXISTS li_tasks_update ON public.linkedin_tasks;
DROP POLICY IF EXISTS li_tasks_delete ON public.linkedin_tasks;
CREATE POLICY li_tasks_select ON public.linkedin_tasks FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_tasks_insert ON public.linkedin_tasks FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_tasks_update ON public.linkedin_tasks FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_tasks_delete ON public.linkedin_tasks FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_li_camp_updated ON public.linkedin_campaigns;
CREATE TRIGGER trg_li_camp_updated BEFORE UPDATE ON public.linkedin_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_li_steps_updated ON public.linkedin_campaign_steps;
CREATE TRIGGER trg_li_steps_updated BEFORE UPDATE ON public.linkedin_campaign_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_li_leads_updated ON public.linkedin_campaign_leads;
CREATE TRIGGER trg_li_leads_updated BEFORE UPDATE ON public.linkedin_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_li_inbox_threads_updated ON public.linkedin_inbox_threads;
CREATE TRIGGER trg_li_inbox_threads_updated BEFORE UPDATE ON public.linkedin_inbox_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_li_tasks_updated ON public.linkedin_tasks;
CREATE TRIGGER trg_li_tasks_updated BEFORE UPDATE ON public.linkedin_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_li_accounts_updated ON public.linkedin_accounts;
CREATE TRIGGER trg_li_accounts_updated BEFORE UPDATE ON public.linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
