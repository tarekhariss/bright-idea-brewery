
-- User workspace preferences
CREATE TABLE IF NOT EXISTS public.user_workspace_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_workspace_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_workspace_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_uwp_updated_at BEFORE UPDATE ON public.user_workspace_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add workspace_id to tables missing it
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.sending_domains ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_ws_lifecycle ON public.contacts (workspace_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_ws_outreach ON public.contacts (workspace_id, outreach_status);
CREATE INDEX IF NOT EXISTS idx_contacts_ws_email ON public.contacts (workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_companies_ws_industry ON public.companies (workspace_id, industry);
CREATE INDEX IF NOT EXISTS idx_companies_ws_domain ON public.companies (workspace_id, domain);
CREATE INDEX IF NOT EXISTS idx_emails_ws ON public.emails (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON public.tasks (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_ws ON public.deals (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_ws ON public.campaigns (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_sequences_ws ON public.sequences (workspace_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_ws ON public.import_jobs (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_ws ON public.export_jobs (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_ws ON public.duplicate_groups (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_lists_ws ON public.lists (workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_ws ON public.saved_searches (workspace_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_mailboxes_ws ON public.mailboxes (workspace_id, connection_status);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_ws ON public.linkedin_accounts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_sending_domains_ws ON public.sending_domains (workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_ws ON public.activities (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_ws ON public.calls (workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_pending ON public.message_queue (status, scheduled_for) WHERE status = 'pending';
