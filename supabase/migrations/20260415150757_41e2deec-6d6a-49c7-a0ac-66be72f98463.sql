
-- 1. Add workspace_id to saved_views
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_saved_views_workspace ON public.saved_views(workspace_id);

-- 2. Helper: workspace member OR platform admin check
CREATE OR REPLACE FUNCTION public.is_workspace_member_or_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id)
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- ============ CONTACTS ============
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- ============ DEALS ============
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "deals_insert" ON public.deals;
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- ============ LISTS ============
DROP POLICY IF EXISTS "lists_all" ON public.lists;
CREATE POLICY "lists_select" ON public.lists FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "lists_insert" ON public.lists FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "lists_update" ON public.lists FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "lists_delete" ON public.lists FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ============ ACTIVITIES ============
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- ============ SAVED_VIEWS ============
DROP POLICY IF EXISTS "saved_views_all" ON public.saved_views;
CREATE POLICY "saved_views_select" ON public.saved_views FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "saved_views_insert" ON public.saved_views FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND created_by = auth.uid());
CREATE POLICY "saved_views_update" ON public.saved_views FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id) AND (created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])));
CREATE POLICY "saved_views_delete" ON public.saved_views FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id) AND (created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])));

-- ============ IMPORT_JOBS ============
DROP POLICY IF EXISTS "import_jobs_all" ON public.import_jobs;
CREATE POLICY "import_jobs_select" ON public.import_jobs FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "import_jobs_insert" ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "import_jobs_update" ON public.import_jobs FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "import_jobs_delete" ON public.import_jobs FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ============ TASKS ============
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ CALLS ============
DROP POLICY IF EXISTS "calls_select" ON public.calls;
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ CAMPAIGNS ============
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- ============ SEQUENCES ============
DROP POLICY IF EXISTS "sequences_select" ON public.sequences;
CREATE POLICY "sequences_select" ON public.sequences FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ MAILBOXES ============
DROP POLICY IF EXISTS "mailboxes_select" ON public.mailboxes;
CREATE POLICY "mailboxes_select" ON public.mailboxes FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ SENDING_DOMAINS ============
DROP POLICY IF EXISTS "domains_select" ON public.sending_domains;
CREATE POLICY "domains_select" ON public.sending_domains FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ LINKEDIN_ACCOUNTS ============
DROP POLICY IF EXISTS "linkedin_accounts_select" ON public.linkedin_accounts;
CREATE POLICY "linkedin_accounts_select" ON public.linkedin_accounts FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ PIPELINES ============
DROP POLICY IF EXISTS "pipelines_select" ON public.pipelines;
CREATE POLICY "pipelines_select" ON public.pipelines FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============ CUSTOM_FIELDS ============
DROP POLICY IF EXISTS "custom_fields_select" ON public.custom_fields;
CREATE POLICY "custom_fields_select" ON public.custom_fields FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
