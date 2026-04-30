-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Replace overly-permissive SELECT USING (true) policies
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS inbox_threads_select ON public.inbox_threads;
CREATE POLICY inbox_threads_select ON public.inbox_threads
  FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS campaign_mailboxes_select ON public.campaign_mailboxes;
CREATE POLICY campaign_mailboxes_select ON public.campaign_mailboxes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_mailboxes.campaign_id
      AND is_workspace_member_or_admin(auth.uid(), c.workspace_id)
  ));

DROP POLICY IF EXISTS linkedin_message_templates_select ON public.linkedin_message_templates;
CREATE POLICY linkedin_message_templates_select ON public.linkedin_message_templates
  FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS picklists_select ON public.global_picklists;
CREATE POLICY picklists_select ON public.global_picklists
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tighten "manage" policies that only checked has_any_role,
--    so they also require workspace membership of the row's workspace.
--    (Owner-table variant: workspace_id is on the row itself.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper expression used: has_any_role(auth.uid(), ARRAY['admin','manager'])
--                          AND is_workspace_member_or_admin(auth.uid(), workspace_id)

DO $$
DECLARE
  rec record;
  tables_with_ws text[] := ARRAY[
    'mailboxes',
    'sending_domains',
    'sending_windows',
    'esp_routing_rules',
    'linkedin_accounts',
    'pipelines',
    'pipeline_stages',
    'custom_fields',
    'goals',
    'sequence_safety_rules',
    'global_picklists'
  ];
  policy_names text[] := ARRAY[
    'mailboxes_manage',
    'domains_manage',
    'sending_windows_manage',
    'esp_routing_manage',
    'linkedin_accounts_manage',
    'pipelines_manage',
    'pipeline_stages_manage',
    'custom_fields_manage',
    'goals_manage',
    'sequence_safety_rules_manage',
    'picklists_manage'
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(tables_with_ws, 1) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_names[i], tables_with_ws[i]);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY[''admin''::app_role,''manager''::app_role]) AND is_workspace_member_or_admin(auth.uid(), workspace_id)) WITH CHECK (has_any_role(auth.uid(), ARRAY[''admin''::app_role,''manager''::app_role]) AND is_workspace_member_or_admin(auth.uid(), workspace_id))',
      policy_names[i], tables_with_ws[i]
    );
  END LOOP;
END $$;

-- Child tables that don't carry workspace_id directly, gate via parent mailbox.
DROP POLICY IF EXISTS warmup_settings_manage ON public.mailbox_warmup_settings;
CREATE POLICY warmup_settings_manage ON public.mailbox_warmup_settings
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_warmup_settings.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_warmup_settings.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  );

DROP POLICY IF EXISTS mailbox_health_manage ON public.mailbox_health;
CREATE POLICY mailbox_health_manage ON public.mailbox_health
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role,'operator'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_health.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role,'operator'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_health.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  );

DROP POLICY IF EXISTS mailbox_rotation_manage ON public.mailbox_rotation_state;
CREATE POLICY mailbox_rotation_manage ON public.mailbox_rotation_state
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role,'operator'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_rotation_state.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role,'operator'::app_role])
    AND EXISTS (SELECT 1 FROM public.mailboxes m WHERE m.id = mailbox_rotation_state.mailbox_id AND is_workspace_member_or_admin(auth.uid(), m.workspace_id))
  );

DROP POLICY IF EXISTS picklist_options_manage ON public.global_picklist_options;
CREATE POLICY picklist_options_manage ON public.global_picklist_options
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    AND EXISTS (SELECT 1 FROM public.global_picklists gp WHERE gp.id = global_picklist_options.picklist_id AND gp.workspace_id IN (SELECT user_workspace_ids()))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    AND EXISTS (SELECT 1 FROM public.global_picklists gp WHERE gp.id = global_picklist_options.picklist_id AND gp.workspace_id IN (SELECT user_workspace_ids()))
  );

-- Sequences: owner OR creator OR (admin/manager of same workspace)
DROP POLICY IF EXISTS sequences_manage ON public.sequences;
CREATE POLICY sequences_manage ON public.sequences
  FOR ALL TO authenticated
  USING (
    is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid() OR created_by = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    )
  )
  WITH CHECK (
    is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND (
      owner_id = auth.uid() OR created_by = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS steps_manage ON public.sequence_steps;
CREATE POLICY steps_manage ON public.sequence_steps
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_steps.sequence_id
      AND is_workspace_member_or_admin(auth.uid(), s.workspace_id)
      AND (s.owner_id = auth.uid() OR s.created_by = auth.uid()
           OR has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_steps.sequence_id
      AND is_workspace_member_or_admin(auth.uid(), s.workspace_id)
      AND (s.owner_id = auth.uid() OR s.created_by = auth.uid()
           OR has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]))
  ));

DROP POLICY IF EXISTS enrollments_manage ON public.sequence_enrollments;
CREATE POLICY enrollments_manage ON public.sequence_enrollments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_enrollments.sequence_id
      AND is_workspace_member_or_admin(auth.uid(), s.workspace_id)
      AND (sequence_enrollments.enrolled_by = auth.uid()
           OR has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_enrollments.sequence_id
      AND is_workspace_member_or_admin(auth.uid(), s.workspace_id)
  ));

-- Campaign steps DELETE — gate by campaign workspace
DROP POLICY IF EXISTS campaign_steps_delete ON public.campaign_steps;
CREATE POLICY campaign_steps_delete ON public.campaign_steps
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_steps.campaign_id
      AND is_workspace_member_or_admin(auth.uid(), c.workspace_id)
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
  ));

DROP POLICY IF EXISTS campaign_enrollments_delete ON public.campaign_enrollments;
CREATE POLICY campaign_enrollments_delete ON public.campaign_enrollments
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_enrollments.campaign_id
      AND is_workspace_member_or_admin(auth.uid(), c.workspace_id)
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
  ));

DROP POLICY IF EXISTS linkedin_message_templates_delete ON public.linkedin_message_templates;
CREATE POLICY linkedin_message_templates_delete ON public.linkedin_message_templates
  FOR DELETE TO authenticated
  USING (
    is_workspace_member_or_admin(auth.uid(), workspace_id)
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lock down EXECUTE on internal-only SECURITY DEFINER functions
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.assert_email_allowed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_allowed(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_classify_inbox_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.classify_inbound_message(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_campaign_options() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_daily_send_count(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_mailbox_readiness(uuid) FROM PUBLIC, anon;

-- Helpers callable by signed-in app code stay available to authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member_or_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_for_user(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(uuid, activity_type, text, uuid, uuid, uuid, text, uuid, text, jsonb, uuid) TO authenticated;