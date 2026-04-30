DROP POLICY IF EXISTS prp_select ON public.prospect_research_profiles;
CREATE POLICY prp_select ON public.prospect_research_profiles
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS prs_select ON public.prospect_research_sources;
CREATE POLICY prs_select ON public.prospect_research_sources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospect_research_profiles p
    WHERE p.id = prospect_research_sources.research_profile_id
      AND p.workspace_id IN (SELECT user_workspace_ids())
  ));

DROP POLICY IF EXISTS apt_select ON public.ai_prompt_templates;
CREATE POLICY apt_select ON public.ai_prompt_templates
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS gc_select ON public.generated_content;
CREATE POLICY gc_select ON public.generated_content
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS ca_select ON public.campaign_attribution;
CREATE POLICY ca_select ON public.campaign_attribution
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS contact_suppression_select ON public.contact_suppression;
CREATE POLICY contact_suppression_select ON public.contact_suppression
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS linkedin_action_queue_select ON public.linkedin_action_queue;
CREATE POLICY linkedin_action_queue_select ON public.linkedin_action_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.linkedin_accounts la
    WHERE la.id = linkedin_action_queue.linkedin_account_id
      AND la.workspace_id IN (SELECT user_workspace_ids())
  ));

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members me
      JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
      WHERE me.user_id = auth.uid() AND them.user_id = profiles.id
    )
    OR is_platform_admin(auth.uid())
  );