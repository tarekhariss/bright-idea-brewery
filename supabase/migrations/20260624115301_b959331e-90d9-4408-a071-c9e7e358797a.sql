CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id_id ON public.contacts (workspace_id, id);
CREATE INDEX IF NOT EXISTS idx_companies_workspace_id_id ON public.companies (workspace_id, id);