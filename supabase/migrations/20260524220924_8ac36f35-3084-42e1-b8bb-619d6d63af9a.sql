
-- 1. Platform admin registry (separate from workspace 'admin' role)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins themselves can see/modify the list
DROP POLICY IF EXISTS platform_admins_select ON public.platform_admins;
CREATE POLICY platform_admins_select ON public.platform_admins
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS platform_admins_manage ON public.platform_admins;
CREATE POLICY platform_admins_manage ON public.platform_admins
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. Correct is_platform_admin — check ONLY the new table
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

-- 3. Remove unconditional 'admin' bypass from workspace check.
--    Workspace access = real membership OR explicit platform admin.
CREATE OR REPLACE FUNCTION public.is_workspace_member_or_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id)
    OR public.is_platform_admin(_user_id)
$$;

-- 4. Platform settings / system log — platform admins only
DROP POLICY IF EXISTS platform_settings_manage ON public.platform_settings;
CREATE POLICY platform_settings_manage ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS system_log_select ON public.system_activity_log;
CREATE POLICY system_log_select ON public.system_activity_log
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 5. Scope DELETE policies to workspace ----------------------------

DROP POLICY IF EXISTS prp_delete ON public.prospect_research_profiles;
CREATE POLICY prp_delete ON public.prospect_research_profiles
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS domain_suppression_delete ON public.domain_suppression;
CREATE POLICY domain_suppression_delete ON public.domain_suppression
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS contact_suppression_delete ON public.contact_suppression;
CREATE POLICY contact_suppression_delete ON public.contact_suppression
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS vj_delete ON public.verification_jobs;
CREATE POLICY vj_delete ON public.verification_jobs
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS email_templates_delete ON public.email_templates;
CREATE POLICY email_templates_delete ON public.email_templates
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS email_variants_delete ON public.email_variants;
CREATE POLICY email_variants_delete ON public.email_variants
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.email_templates t
      WHERE t.id = email_variants.template_id
        AND public.is_workspace_member_or_admin(auth.uid(), t.workspace_id)
    )
  );

DROP POLICY IF EXISTS gc_delete ON public.generated_content;
CREATE POLICY gc_delete ON public.generated_content
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS pv_delete ON public.personalization_variables;
CREATE POLICY pv_delete ON public.personalization_variables
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS prs_delete ON public.prospect_research_sources;
CREATE POLICY prs_delete ON public.prospect_research_sources
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.prospect_research_profiles p
      WHERE p.id = prospect_research_sources.research_profile_id
        AND public.is_workspace_member_or_admin(auth.uid(), p.workspace_id)
    )
  );

DROP POLICY IF EXISTS ca_delete ON public.campaign_attribution;
CREATE POLICY ca_delete ON public.campaign_attribution
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS campaign_linkedin_accounts_delete ON public.campaign_linkedin_accounts;
CREATE POLICY campaign_linkedin_accounts_delete ON public.campaign_linkedin_accounts
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_linkedin_accounts.campaign_id
        AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)
    )
  );

DROP POLICY IF EXISTS linkedin_message_templates_delete ON public.linkedin_message_templates;
CREATE POLICY linkedin_message_templates_delete ON public.linkedin_message_templates
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 6. Scope ALL/manage policies to workspace ------------------------

DROP POLICY IF EXISTS emails_manage ON public.emails;
CREATE POLICY emails_manage ON public.emails
  FOR ALL TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
  WITH CHECK (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS calls_manage ON public.calls;
CREATE POLICY calls_manage ON public.calls
  FOR ALL TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
  WITH CHECK (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS meetings_delete ON public.meetings;
CREATE POLICY meetings_delete ON public.meetings
  FOR DELETE TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS tasks_manage ON public.tasks;
CREATE POLICY tasks_manage ON public.tasks
  FOR ALL TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
  WITH CHECK (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS cpm_manage ON public.campaign_performance_metrics;
CREATE POLICY cpm_manage ON public.campaign_performance_metrics
  FOR ALL TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'operator'::app_role])
  )
  WITH CHECK (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'operator'::app_role])
  );
