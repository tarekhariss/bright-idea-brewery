-- ============================================================
-- Provider Connection Setup Tables
-- Run when database is back online
-- ============================================================

-- Provider connections table
CREATE TABLE IF NOT EXISTS public.provider_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('google', 'microsoft', 'smtp', 'linkedin')),
  account_email TEXT,
  display_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'pending' CHECK (connection_status IN ('connected', 'disconnected', 'needs_reauth', 'invalid_credentials', 'pending')),
  oauth_token_status TEXT CHECK (oauth_token_status IN ('valid', 'expired', 'revoked', 'none')),
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  imap_host TEXT,
  imap_port INTEGER,
  from_email TEXT,
  from_name TEXT,
  daily_send_limit INTEGER DEFAULT 50,
  daily_message_limit INTEGER DEFAULT 50,
  aliases TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  last_validated_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider connection logs
CREATE TABLE IF NOT EXISTS public.provider_connection_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider validation results
CREATE TABLE IF NOT EXISTS public.provider_validation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_validation_results ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own workspace provider connections"
  ON public.provider_connections FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers+ can insert provider connections"
  ON public.provider_connections FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'manager')));

CREATE POLICY "Managers+ can update provider connections"
  ON public.provider_connections FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'manager')));

CREATE POLICY "Managers+ can delete provider connections"
  ON public.provider_connections FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'manager')));

CREATE POLICY "Users can view own workspace connection logs"
  ON public.provider_connection_logs FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.provider_connections WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can view own workspace validation results"
  ON public.provider_validation_results FOR SELECT TO authenticated
  USING (connection_id IN (SELECT id FROM public.provider_connections WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())));

-- Indexes
CREATE INDEX idx_provider_connections_workspace ON public.provider_connections(workspace_id);
CREATE INDEX idx_provider_connections_type ON public.provider_connections(provider_type);
CREATE INDEX idx_provider_connection_logs_conn ON public.provider_connection_logs(connection_id);
CREATE INDEX idx_provider_validation_results_conn ON public.provider_validation_results(connection_id);
