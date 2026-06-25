
REVOKE SELECT ON public.linkedin_webhooks FROM authenticated;
GRANT SELECT (id, workspace_id, name, url, events, is_active, created_by, created_at, updated_at) ON public.linkedin_webhooks TO authenticated;
GRANT ALL ON public.linkedin_webhooks TO service_role;

DROP POLICY IF EXISTS "smtp_log workspace read" ON public.smtp_session_log;
CREATE POLICY "smtp_log admin manager read" ON public.smtp_session_log
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NOT NULL AND public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::app_role,'manager'::app_role]))
    OR (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "sal_insert_owner" ON public.system_activity_log;
CREATE POLICY "sal_insert_platform_admin" ON public.system_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND performed_by = auth.uid());

DROP POLICY IF EXISTS "vr_select" ON public.verification_results;
CREATE POLICY "vr_select_admin_manager" ON public.verification_results
  FOR SELECT TO authenticated
  USING (
    public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::app_role,'manager'::app_role])
  );
