
-- 1. Fix search_path on compute_freshness_state
CREATE OR REPLACE FUNCTION public.compute_freshness_state(_verified_at timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _verified_at IS NULL THEN 'unknown'
    WHEN _verified_at > now() - interval '30 days'  THEN 'fresh'
    WHEN _verified_at > now() - interval '90 days'  THEN 'aging'
    WHEN _verified_at > now() - interval '180 days' THEN 'stale'
    ELSE 'expired'
  END
$function$;

-- 2. campaigns_delete: require workspace membership
DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
CREATE POLICY campaigns_delete ON public.campaigns
  FOR DELETE TO authenticated
  USING (
    public.is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
      OR owner_id = auth.uid()
    )
  );

-- 3. ai_prompt_templates: scope manage policy to workspace
DROP POLICY IF EXISTS apt_manage ON public.ai_prompt_templates;
CREATE POLICY apt_manage ON public.ai_prompt_templates
  FOR ALL TO authenticated
  USING (
    (workspace_id IS NOT NULL AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]))
    OR (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    (workspace_id IS NOT NULL AND public.is_workspace_member_or_admin(auth.uid(), workspace_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]))
    OR (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  );

-- 4. email_providers: restrict manage to platform admins (no workspace_id on this table)
DROP POLICY IF EXISTS email_providers_manage ON public.email_providers;
CREATE POLICY email_providers_manage ON public.email_providers
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 5. import_job_rows: require workspace membership
DROP POLICY IF EXISTS ijr_all_owner ON public.import_job_rows;
CREATE POLICY ijr_all_owner ON public.import_job_rows
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.import_jobs ij
    WHERE ij.id = import_job_rows.import_job_id
      AND ij.created_by = auth.uid()
      AND public.is_workspace_member_or_admin(auth.uid(), ij.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_jobs ij
    WHERE ij.id = import_job_rows.import_job_id
      AND ij.created_by = auth.uid()
      AND public.is_workspace_member_or_admin(auth.uid(), ij.workspace_id)
  ));

-- 6. Convert public-role policies to authenticated-only for the listed tables
-- campaign_mailbox_pool
DROP POLICY IF EXISTS cmp_select ON public.campaign_mailbox_pool;
DROP POLICY IF EXISTS cmp_write  ON public.campaign_mailbox_pool;
CREATE POLICY cmp_select ON public.campaign_mailbox_pool FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY cmp_write  ON public.campaign_mailbox_pool FOR ALL TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- linkedin_campaign_senders
DROP POLICY IF EXISTS li_camp_senders_select ON public.linkedin_campaign_senders;
DROP POLICY IF EXISTS li_camp_senders_insert ON public.linkedin_campaign_senders;
DROP POLICY IF EXISTS li_camp_senders_update ON public.linkedin_campaign_senders;
DROP POLICY IF EXISTS li_camp_senders_delete ON public.linkedin_campaign_senders;
CREATE POLICY li_camp_senders_select ON public.linkedin_campaign_senders FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_senders_insert ON public.linkedin_campaign_senders FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_senders_update ON public.linkedin_campaign_senders FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_camp_senders_delete ON public.linkedin_campaign_senders FOR DELETE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- linkedin_message_variants
DROP POLICY IF EXISTS li_variants_select ON public.linkedin_message_variants;
DROP POLICY IF EXISTS li_variants_insert ON public.linkedin_message_variants;
DROP POLICY IF EXISTS li_variants_update ON public.linkedin_message_variants;
DROP POLICY IF EXISTS li_variants_delete ON public.linkedin_message_variants;
CREATE POLICY li_variants_select ON public.linkedin_message_variants FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_variants_insert ON public.linkedin_message_variants FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_variants_update ON public.linkedin_message_variants FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_variants_delete ON public.linkedin_message_variants FOR DELETE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- linkedin_workflow_edges
DROP POLICY IF EXISTS li_wf_edges_select ON public.linkedin_workflow_edges;
DROP POLICY IF EXISTS li_wf_edges_insert ON public.linkedin_workflow_edges;
DROP POLICY IF EXISTS li_wf_edges_update ON public.linkedin_workflow_edges;
DROP POLICY IF EXISTS li_wf_edges_delete ON public.linkedin_workflow_edges;
CREATE POLICY li_wf_edges_select ON public.linkedin_workflow_edges FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_edges_insert ON public.linkedin_workflow_edges FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_edges_update ON public.linkedin_workflow_edges FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_edges_delete ON public.linkedin_workflow_edges FOR DELETE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- linkedin_workflow_nodes
DROP POLICY IF EXISTS li_wf_nodes_select ON public.linkedin_workflow_nodes;
DROP POLICY IF EXISTS li_wf_nodes_insert ON public.linkedin_workflow_nodes;
DROP POLICY IF EXISTS li_wf_nodes_update ON public.linkedin_workflow_nodes;
DROP POLICY IF EXISTS li_wf_nodes_delete ON public.linkedin_workflow_nodes;
CREATE POLICY li_wf_nodes_select ON public.linkedin_workflow_nodes FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_nodes_insert ON public.linkedin_workflow_nodes FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_nodes_update ON public.linkedin_workflow_nodes FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_wf_nodes_delete ON public.linkedin_workflow_nodes FOR DELETE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- user_workspace_preferences
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_workspace_preferences;
CREATE POLICY "Users manage own preferences" ON public.user_workspace_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- prospect_verification_history
DROP POLICY IF EXISTS "pvh workspace select" ON public.prospect_verification_history;
DROP POLICY IF EXISTS "pvh workspace insert" ON public.prospect_verification_history;
DROP POLICY IF EXISTS "pvh workspace update" ON public.prospect_verification_history;
DROP POLICY IF EXISTS "pvh workspace delete" ON public.prospect_verification_history;
CREATE POLICY "pvh workspace select" ON public.prospect_verification_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pvh workspace insert" ON public.prospect_verification_history FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pvh workspace update" ON public.prospect_verification_history FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pvh workspace delete" ON public.prospect_verification_history FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
