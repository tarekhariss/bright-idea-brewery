
-- Lock down newly created SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.tg_li_queue_set_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_li_history_set_workspace() FROM PUBLIC, anon, authenticated;

-- Replace permissive FOR ALL policies with explicit per-action ones
-- Webhooks
DROP POLICY IF EXISTS li_webhooks_all ON public.linkedin_webhooks;
CREATE POLICY li_webhooks_select ON public.linkedin_webhooks FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_webhooks_insert ON public.linkedin_webhooks FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_webhooks_update ON public.linkedin_webhooks FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_webhooks_delete ON public.linkedin_webhooks FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));

-- API Keys
DROP POLICY IF EXISTS li_apikeys_all ON public.linkedin_api_keys;
CREATE POLICY li_apikeys_select ON public.linkedin_api_keys FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_apikeys_insert ON public.linkedin_api_keys FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));
CREATE POLICY li_apikeys_update ON public.linkedin_api_keys FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));
CREATE POLICY li_apikeys_delete ON public.linkedin_api_keys FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));

-- Filter Presets
DROP POLICY IF EXISTS li_filters_all ON public.linkedin_filter_presets;
CREATE POLICY li_filters_select ON public.linkedin_filter_presets FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_filters_insert ON public.linkedin_filter_presets FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_filters_update ON public.linkedin_filter_presets FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_filters_delete ON public.linkedin_filter_presets FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- Stoplist
DROP POLICY IF EXISTS li_stoplist_all ON public.linkedin_stoplist;
CREATE POLICY li_stoplist_select ON public.linkedin_stoplist FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_stoplist_insert ON public.linkedin_stoplist FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_stoplist_update ON public.linkedin_stoplist FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_stoplist_delete ON public.linkedin_stoplist FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- LLM Integrations
DROP POLICY IF EXISTS li_llm_all ON public.linkedin_llm_integrations;
CREATE POLICY li_llm_select ON public.linkedin_llm_integrations FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_llm_insert ON public.linkedin_llm_integrations FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));
CREATE POLICY li_llm_update ON public.linkedin_llm_integrations FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));
CREATE POLICY li_llm_delete ON public.linkedin_llm_integrations FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]));
