
-- ============================================================
-- 1. Fix allowed_emails: drop anon SELECT
-- ============================================================
DROP POLICY IF EXISTS "allowed_emails_select_anon" ON public.allowed_emails;

-- Keep authenticated SELECT but restrict to platform admins
DROP POLICY IF EXISTS "allowed_emails_select_auth" ON public.allowed_emails;
CREATE POLICY "allowed_emails_select_auth" ON public.allowed_emails
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 2. Tables with direct workspace_id — scope SELECT
-- ============================================================

-- emails
DROP POLICY IF EXISTS "emails_select" ON public.emails;
CREATE POLICY "emails_select" ON public.emails
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- meetings
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- email_templates
DROP POLICY IF EXISTS "email_templates_select" ON public.email_templates;
CREATE POLICY "email_templates_select" ON public.email_templates
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- campaign_performance_metrics
DROP POLICY IF EXISTS "cpm_select" ON public.campaign_performance_metrics;
CREATE POLICY "cpm_select" ON public.campaign_performance_metrics
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- contact_funnel_metrics
DROP POLICY IF EXISTS "cfm_select" ON public.contact_funnel_metrics;
CREATE POLICY "cfm_select" ON public.contact_funnel_metrics
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- domain_suppression
DROP POLICY IF EXISTS "domain_suppression_select" ON public.domain_suppression;
CREATE POLICY "domain_suppression_select" ON public.domain_suppression
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- goals
DROP POLICY IF EXISTS "goals_select" ON public.goals;
CREATE POLICY "goals_select" ON public.goals
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- workspace_kpis
DROP POLICY IF EXISTS "wk_select" ON public.workspace_kpis;
CREATE POLICY "wk_select" ON public.workspace_kpis
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- personalization_variables
DROP POLICY IF EXISTS "pv_select" ON public.personalization_variables;
CREATE POLICY "pv_select" ON public.personalization_variables
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- linkedin_performance_metrics
DROP POLICY IF EXISTS "lpm_select" ON public.linkedin_performance_metrics;
CREATE POLICY "lpm_select" ON public.linkedin_performance_metrics
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- sending_windows
DROP POLICY IF EXISTS "sending_windows_select" ON public.sending_windows;
CREATE POLICY "sending_windows_select" ON public.sending_windows
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- esp_routing_rules
DROP POLICY IF EXISTS "esp_routing_select" ON public.esp_routing_rules;
CREATE POLICY "esp_routing_select" ON public.esp_routing_rules
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- linkedin_safety_rules
DROP POLICY IF EXISTS "linkedin_safety_rules_select" ON public.linkedin_safety_rules;
CREATE POLICY "linkedin_safety_rules_select" ON public.linkedin_safety_rules
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- sequence_safety_rules
DROP POLICY IF EXISTS "sequence_safety_rules_select" ON public.sequence_safety_rules;
CREATE POLICY "sequence_safety_rules_select" ON public.sequence_safety_rules
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- domain_send_limits
DROP POLICY IF EXISTS "domain_send_limits_select" ON public.domain_send_limits;
CREATE POLICY "domain_send_limits_select" ON public.domain_send_limits
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- pipeline_stages
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- mailbox_performance_metrics (has workspace_id)
DROP POLICY IF EXISTS "mpm_select" ON public.mailbox_performance_metrics;
CREATE POLICY "mpm_select" ON public.mailbox_performance_metrics
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

-- ============================================================
-- 3. Child tables — scope SELECT via parent join
-- ============================================================

-- email_events → emails
DROP POLICY IF EXISTS "email_events_select" ON public.email_events;
CREATE POLICY "email_events_select" ON public.email_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.emails e
    WHERE e.id = email_events.email_id
      AND e.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- email_bounces → emails
DROP POLICY IF EXISTS "email_bounces_select" ON public.email_bounces;
CREATE POLICY "email_bounces_select" ON public.email_bounces
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.emails e
    WHERE e.id = email_bounces.email_id
      AND e.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- email_variants → email_templates
DROP POLICY IF EXISTS "email_variants_select" ON public.email_variants;
CREATE POLICY "email_variants_select" ON public.email_variants
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.email_templates et
    WHERE et.id = email_variants.template_id
      AND et.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- inbox_messages → inbox_threads
DROP POLICY IF EXISTS "inbox_messages_select" ON public.inbox_messages;
CREATE POLICY "inbox_messages_select" ON public.inbox_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inbox_threads it
    WHERE it.id = inbox_messages.thread_id
      AND it.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- sequence_steps → sequences
DROP POLICY IF EXISTS "steps_select" ON public.sequence_steps;
CREATE POLICY "steps_select" ON public.sequence_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_steps.sequence_id
      AND s.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- sequence_enrollments → sequences
DROP POLICY IF EXISTS "enrollments_select" ON public.sequence_enrollments;
CREATE POLICY "enrollments_select" ON public.sequence_enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sequences s
    WHERE s.id = sequence_enrollments.sequence_id
      AND s.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_contacts → campaigns
DROP POLICY IF EXISTS "campaign_contacts_select" ON public.campaign_contacts;
CREATE POLICY "campaign_contacts_select" ON public.campaign_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_contacts.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_enrollments → campaigns
DROP POLICY IF EXISTS "campaign_enrollments_select" ON public.campaign_enrollments;
CREATE POLICY "campaign_enrollments_select" ON public.campaign_enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_enrollments.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_steps → campaigns
DROP POLICY IF EXISTS "campaign_steps_select" ON public.campaign_steps;
CREATE POLICY "campaign_steps_select" ON public.campaign_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_steps.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_step_executions → campaign_enrollments → campaigns
DROP POLICY IF EXISTS "campaign_step_executions_select" ON public.campaign_step_executions;
CREATE POLICY "campaign_step_executions_select" ON public.campaign_step_executions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = campaign_step_executions.enrollment_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_linkedin_accounts → campaigns
DROP POLICY IF EXISTS "campaign_linkedin_accounts_select" ON public.campaign_linkedin_accounts;
CREATE POLICY "campaign_linkedin_accounts_select" ON public.campaign_linkedin_accounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_linkedin_accounts.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- campaign_stats → campaigns
DROP POLICY IF EXISTS "campaign_stats_select" ON public.campaign_stats;
CREATE POLICY "campaign_stats_select" ON public.campaign_stats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_stats.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- contact_outreach_history → contacts
DROP POLICY IF EXISTS "contact_outreach_history_select" ON public.contact_outreach_history;
CREATE POLICY "contact_outreach_history_select" ON public.contact_outreach_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts ct
    WHERE ct.id = contact_outreach_history.contact_id
      AND (ct.workspace_id IN (SELECT public.user_workspace_ids())
           OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))
  ));

-- contact_insights → contacts
DROP POLICY IF EXISTS "ci_select" ON public.contact_insights;
CREATE POLICY "ci_select" ON public.contact_insights
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts ct
    WHERE ct.id = contact_insights.contact_id
      AND (ct.workspace_id IN (SELECT public.user_workspace_ids())
           OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))
  ));

-- company_insights → companies
DROP POLICY IF EXISTS "coi_select" ON public.company_insights;
CREATE POLICY "coi_select" ON public.company_insights
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies co
    WHERE co.id = company_insights.company_id
      AND (co.workspace_id IN (SELECT public.user_workspace_ids())
           OR (co.workspace_id IS NULL AND co.created_by = auth.uid()))
  ));

-- deal_stage_history → deals
DROP POLICY IF EXISTS "deal_stage_history_select" ON public.deal_stage_history;
CREATE POLICY "deal_stage_history_select" ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_stage_history.deal_id
      AND d.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- linkedin_action_history → campaigns
DROP POLICY IF EXISTS "linkedin_action_history_select" ON public.linkedin_action_history;
CREATE POLICY "linkedin_action_history_select" ON public.linkedin_action_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = linkedin_action_history.campaign_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- message_queue → campaign_enrollments → campaigns
DROP POLICY IF EXISTS "queue_select" ON public.message_queue;
CREATE POLICY "queue_select" ON public.message_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = message_queue.enrollment_id
      AND c.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- mailbox_health → mailboxes
DROP POLICY IF EXISTS "mailbox_health_select" ON public.mailbox_health;
CREATE POLICY "mailbox_health_select" ON public.mailbox_health
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes m
    WHERE m.id = mailbox_health.mailbox_id
      AND m.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- mailbox_warmup_settings → mailboxes
DROP POLICY IF EXISTS "warmup_settings_select" ON public.mailbox_warmup_settings;
CREATE POLICY "warmup_settings_select" ON public.mailbox_warmup_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes m
    WHERE m.id = mailbox_warmup_settings.mailbox_id
      AND m.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- mailbox_rotation_state → mailboxes
DROP POLICY IF EXISTS "mailbox_rotation_select" ON public.mailbox_rotation_state;
CREATE POLICY "mailbox_rotation_select" ON public.mailbox_rotation_state
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes m
    WHERE m.id = mailbox_rotation_state.mailbox_id
      AND m.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- linkedin_account_health → linkedin_accounts
DROP POLICY IF EXISTS "linkedin_account_health_select" ON public.linkedin_account_health;
CREATE POLICY "linkedin_account_health_select" ON public.linkedin_account_health
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.linkedin_accounts la
    WHERE la.id = linkedin_account_health.account_id
      AND la.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- global_picklist_options → global_picklists
DROP POLICY IF EXISTS "picklist_options_select" ON public.global_picklist_options;
CREATE POLICY "picklist_options_select" ON public.global_picklist_options
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.global_picklists gp
    WHERE gp.id = global_picklist_options.picklist_id
      AND gp.workspace_id IN (SELECT public.user_workspace_ids())
  ));

-- ============================================================
-- 4. Global config tables — restrict to platform admins
-- ============================================================

DROP POLICY IF EXISTS "platform_settings_select" ON public.platform_settings;
CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "email_providers_select" ON public.email_providers;
CREATE POLICY "email_providers_select" ON public.email_providers
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
