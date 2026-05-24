
-- 1. mailboxes: restrict SELECT to admin/manager workspace members
DROP POLICY IF EXISTS mailboxes_select ON public.mailboxes;
CREATE POLICY mailboxes_select ON public.mailboxes
  FOR SELECT TO authenticated
  USING (
    is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
  );

-- 2. provider_behavior_logs: platform admin only
DROP POLICY IF EXISTS pbl_select ON public.provider_behavior_logs;
CREATE POLICY pbl_select ON public.provider_behavior_logs
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- 3. verification_cache: platform admin only (workers use service role)
DROP POLICY IF EXISTS vc_select ON public.verification_cache;
CREATE POLICY vc_select ON public.verification_cache
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- 4. smtp_session_log: remove null-workspace public read path
DROP POLICY IF EXISTS "smtp_log workspace read" ON public.smtp_session_log;
CREATE POLICY "smtp_log workspace read" ON public.smtp_session_log
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NOT NULL AND workspace_id IN (SELECT user_workspace_ids()))
    OR (workspace_id IS NULL AND is_platform_admin(auth.uid()))
  );

-- 5. Add workspace scoping to manage policies that use unscoped has_any_role
-- 5a. workspace_kpis
DROP POLICY IF EXISTS wk_manage ON public.workspace_kpis;
CREATE POLICY wk_manage ON public.workspace_kpis
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 5b. mailbox_performance_metrics
DROP POLICY IF EXISTS mpm_manage ON public.mailbox_performance_metrics;
CREATE POLICY mpm_manage ON public.mailbox_performance_metrics
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 5c. linkedin_performance_metrics
DROP POLICY IF EXISTS lpm_manage ON public.linkedin_performance_metrics;
CREATE POLICY lpm_manage ON public.linkedin_performance_metrics
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 5d. domain_send_limits
DROP POLICY IF EXISTS domain_send_limits_manage ON public.domain_send_limits;
CREATE POLICY domain_send_limits_manage ON public.domain_send_limits
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 5e. linkedin_safety_rules
DROP POLICY IF EXISTS linkedin_safety_rules_manage ON public.linkedin_safety_rules;
CREATE POLICY linkedin_safety_rules_manage ON public.linkedin_safety_rules
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member_or_admin(auth.uid(), workspace_id)
  );

-- 5f. campaign_stats (no direct workspace_id; join through campaigns)
DROP POLICY IF EXISTS campaign_stats_manage ON public.campaign_stats;
CREATE POLICY campaign_stats_manage ON public.campaign_stats
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'operator'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_stats.campaign_id
        AND c.workspace_id IN (SELECT user_workspace_ids())
    )
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'operator'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_stats.campaign_id
        AND c.workspace_id IN (SELECT user_workspace_ids())
    )
  );

-- 5g. linkedin_account_health (join through linkedin_accounts)
DROP POLICY IF EXISTS linkedin_account_health_manage ON public.linkedin_account_health;
CREATE POLICY linkedin_account_health_manage ON public.linkedin_account_health
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.linkedin_accounts la
      WHERE la.id = linkedin_account_health.account_id
        AND la.workspace_id IN (SELECT user_workspace_ids())
    )
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.linkedin_accounts la
      WHERE la.id = linkedin_account_health.account_id
        AND la.workspace_id IN (SELECT user_workspace_ids())
    )
  );

-- 6. verification-uploads bucket: explicit UPDATE policy mirroring select/delete
DROP POLICY IF EXISTS vu_update ON storage.objects;
CREATE POLICY vu_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'verification-uploads'
    AND (
      is_platform_admin(auth.uid())
      OR (storage.foldername(name))[1] IN (
        SELECT (wm.workspace_id)::text
        FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'verification-uploads'
    AND (
      is_platform_admin(auth.uid())
      OR (storage.foldername(name))[1] IN (
        SELECT (wm.workspace_id)::text
        FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
      )
    )
  );

-- 7. Fix mutable search_path on classify_unknown_* functions
ALTER FUNCTION public.classify_unknown_confidence(text, integer, text) SET search_path = public;
ALTER FUNCTION public.classify_unknown_reason(integer, text, text) SET search_path = public;
