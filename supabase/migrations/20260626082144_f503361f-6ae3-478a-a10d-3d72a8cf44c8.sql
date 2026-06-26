
-- 1) verification_workers: restrict SELECT to platform admins
DROP POLICY IF EXISTS vw_select ON public.verification_workers;
CREATE POLICY vw_select ON public.verification_workers
FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

-- 2) campaign_stats: split read vs write; only admin/manager can write
DROP POLICY IF EXISTS campaign_stats_manage ON public.campaign_stats;
CREATE POLICY campaign_stats_write ON public.campaign_stats
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_stats.campaign_id
    AND workspace_role(auth.uid(), c.workspace_id) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_stats.campaign_id
    AND workspace_role(auth.uid(), c.workspace_id) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
));

-- 3) linkedin_action_queue: drop duplicate contact-based insert/update policies
DROP POLICY IF EXISTS laq_insert_ws ON public.linkedin_action_queue;
DROP POLICY IF EXISTS laq_update_ws ON public.linkedin_action_queue;
