
DROP POLICY IF EXISTS bf_select ON public.bounce_feedback;
CREATE POLICY bf_select ON public.bounce_feedback FOR SELECT
USING (
  (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  OR (workspace_id IN (SELECT public.user_workspace_ids()))
);

DROP POLICY IF EXISTS erh_select ON public.email_reputation_history;
CREATE POLICY erh_select ON public.email_reputation_history FOR SELECT
USING (
  (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  OR (workspace_id IN (SELECT public.user_workspace_ids()))
);

DROP POLICY IF EXISTS val_select ON public.verification_audit_log;
CREATE POLICY val_select ON public.verification_audit_log FOR SELECT
USING (
  (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  OR public.is_workspace_member_or_admin(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS vql_ws_select ON public.verification_quality_logs;
CREATE POLICY vql_ws_select ON public.verification_quality_logs FOR SELECT
USING (
  (workspace_id IS NULL AND public.is_platform_admin(auth.uid()))
  OR public.is_workspace_member_or_admin(auth.uid(), workspace_id)
);
