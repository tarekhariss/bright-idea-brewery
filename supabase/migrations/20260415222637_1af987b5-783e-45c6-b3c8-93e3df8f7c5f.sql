
-- Helper: returns workspace IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

-- ---- tags ----
DROP POLICY IF EXISTS "tags_all" ON public.tags;
CREATE POLICY "tags_workspace" ON public.tags FOR ALL TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- campaign_attribution ----
DROP POLICY IF EXISTS "ca_insert" ON public.campaign_attribution;
DROP POLICY IF EXISTS "ca_update" ON public.campaign_attribution;
CREATE POLICY "ca_insert_ws" ON public.campaign_attribution FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "ca_update_ws" ON public.campaign_attribution FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- contact_funnel_metrics ----
DROP POLICY IF EXISTS "cfm_insert" ON public.contact_funnel_metrics;
DROP POLICY IF EXISTS "cfm_update" ON public.contact_funnel_metrics;
CREATE POLICY "cfm_insert_ws" ON public.contact_funnel_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "cfm_update_ws" ON public.contact_funnel_metrics FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- contact_suppression ----
DROP POLICY IF EXISTS "contact_suppression_insert" ON public.contact_suppression;
CREATE POLICY "contact_suppression_insert_ws" ON public.contact_suppression FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- domain_suppression ----
DROP POLICY IF EXISTS "domain_suppression_insert" ON public.domain_suppression;
CREATE POLICY "domain_suppression_insert_ws" ON public.domain_suppression FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- email_templates ----
DROP POLICY IF EXISTS "email_templates_insert" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_update" ON public.email_templates;
CREATE POLICY "email_templates_insert_ws" ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "email_templates_update_ws" ON public.email_templates FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- generated_content ----
DROP POLICY IF EXISTS "gc_insert" ON public.generated_content;
DROP POLICY IF EXISTS "gc_update" ON public.generated_content;
CREATE POLICY "gc_insert_ws" ON public.generated_content FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "gc_update_ws" ON public.generated_content FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- inbox_threads ----
DROP POLICY IF EXISTS "inbox_threads_insert" ON public.inbox_threads;
DROP POLICY IF EXISTS "inbox_threads_update" ON public.inbox_threads;
CREATE POLICY "inbox_threads_insert_ws" ON public.inbox_threads FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "inbox_threads_update_ws" ON public.inbox_threads FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- linkedin_message_templates ----
DROP POLICY IF EXISTS "linkedin_message_templates_insert" ON public.linkedin_message_templates;
DROP POLICY IF EXISTS "linkedin_message_templates_update" ON public.linkedin_message_templates;
CREATE POLICY "linkedin_message_templates_insert_ws" ON public.linkedin_message_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "linkedin_message_templates_update_ws" ON public.linkedin_message_templates FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- meetings ----
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
CREATE POLICY "meetings_insert_ws" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "meetings_update_ws" ON public.meetings FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- personalization_variables ----
DROP POLICY IF EXISTS "pv_insert" ON public.personalization_variables;
DROP POLICY IF EXISTS "pv_update" ON public.personalization_variables;
CREATE POLICY "pv_insert_ws" ON public.personalization_variables FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "pv_update_ws" ON public.personalization_variables FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- prospect_research_profiles ----
DROP POLICY IF EXISTS "prp_insert" ON public.prospect_research_profiles;
DROP POLICY IF EXISTS "prp_update" ON public.prospect_research_profiles;
CREATE POLICY "prp_insert_ws" ON public.prospect_research_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "prp_update_ws" ON public.prospect_research_profiles FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- campaign_contacts (via campaigns.workspace_id) ----
DROP POLICY IF EXISTS "campaign_contacts_insert" ON public.campaign_contacts;
DROP POLICY IF EXISTS "campaign_contacts_update" ON public.campaign_contacts;
DROP POLICY IF EXISTS "campaign_contacts_delete" ON public.campaign_contacts;
CREATE POLICY "cc_insert_ws" ON public.campaign_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_contacts.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));
CREATE POLICY "cc_update_ws" ON public.campaign_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_contacts.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));
CREATE POLICY "cc_delete_ws" ON public.campaign_contacts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_contacts.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- campaign_enrollments ----
DROP POLICY IF EXISTS "campaign_enrollments_insert" ON public.campaign_enrollments;
DROP POLICY IF EXISTS "campaign_enrollments_update" ON public.campaign_enrollments;
CREATE POLICY "ce_insert_ws" ON public.campaign_enrollments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_enrollments.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));
CREATE POLICY "ce_update_ws" ON public.campaign_enrollments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_enrollments.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- campaign_linkedin_accounts ----
DROP POLICY IF EXISTS "campaign_linkedin_accounts_insert" ON public.campaign_linkedin_accounts;
CREATE POLICY "cla_insert_ws" ON public.campaign_linkedin_accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_linkedin_accounts.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- campaign_mailboxes ----
DROP POLICY IF EXISTS "campaign_mailboxes_insert" ON public.campaign_mailboxes;
DROP POLICY IF EXISTS "campaign_mailboxes_delete" ON public.campaign_mailboxes;
CREATE POLICY "cm_insert_ws" ON public.campaign_mailboxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_mailboxes.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));
CREATE POLICY "cm_delete_ws" ON public.campaign_mailboxes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_mailboxes.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- campaign_steps ----
DROP POLICY IF EXISTS "campaign_steps_insert" ON public.campaign_steps;
DROP POLICY IF EXISTS "campaign_steps_update" ON public.campaign_steps;
CREATE POLICY "cs_insert_ws" ON public.campaign_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_steps.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));
CREATE POLICY "cs_update_ws" ON public.campaign_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_steps.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- campaign_step_executions ----
DROP POLICY IF EXISTS "campaign_step_executions_insert" ON public.campaign_step_executions;
DROP POLICY IF EXISTS "campaign_step_executions_update" ON public.campaign_step_executions;
CREATE POLICY "cse_insert_ws" ON public.campaign_step_executions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = campaign_step_executions.enrollment_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)
  ));
CREATE POLICY "cse_update_ws" ON public.campaign_step_executions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = campaign_step_executions.enrollment_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)
  ));

-- ---- company_activity_log ----
DROP POLICY IF EXISTS "company_activity_log_all" ON public.company_activity_log;
CREATE POLICY "cal_all_ws" ON public.company_activity_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_activity_log.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_activity_log.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)));

-- ---- company_insights ----
DROP POLICY IF EXISTS "coi_insert" ON public.company_insights;
DROP POLICY IF EXISTS "coi_update" ON public.company_insights;
CREATE POLICY "coi_insert_ws" ON public.company_insights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_insights.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)));
CREATE POLICY "coi_update_ws" ON public.company_insights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_insights.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)));

-- ---- company_tags ----
DROP POLICY IF EXISTS "company_tags_all" ON public.company_tags;
CREATE POLICY "ctags_all_ws" ON public.company_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_tags.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies co WHERE co.id = company_tags.company_id AND public.is_workspace_member_or_admin(auth.uid(), co.workspace_id)));

-- ---- contact_activity_log ----
DROP POLICY IF EXISTS "contact_activity_log_all" ON public.contact_activity_log;
CREATE POLICY "ctal_all_ws" ON public.contact_activity_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_activity_log.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_activity_log.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));

-- ---- contact_insights ----
DROP POLICY IF EXISTS "ci_insert" ON public.contact_insights;
DROP POLICY IF EXISTS "ci_update" ON public.contact_insights;
CREATE POLICY "ci_insert_ws" ON public.contact_insights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_insights.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));
CREATE POLICY "ci_update_ws" ON public.contact_insights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_insights.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));

-- ---- contact_outreach_history ----
DROP POLICY IF EXISTS "contact_outreach_history_insert" ON public.contact_outreach_history;
DROP POLICY IF EXISTS "contact_outreach_history_update" ON public.contact_outreach_history;
CREATE POLICY "coh_insert_ws" ON public.contact_outreach_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_outreach_history.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));
CREATE POLICY "coh_update_ws" ON public.contact_outreach_history FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_outreach_history.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));

-- ---- contact_tags ----
DROP POLICY IF EXISTS "contact_tags_all" ON public.contact_tags;
CREATE POLICY "ctags_ct_all_ws" ON public.contact_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_tags.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = contact_tags.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));

-- ---- deal_contacts ----
DROP POLICY IF EXISTS "deal_contacts_all" ON public.deal_contacts;
CREATE POLICY "dc_all_ws" ON public.deal_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_contacts.deal_id AND public.is_workspace_member_or_admin(auth.uid(), d.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_contacts.deal_id AND public.is_workspace_member_or_admin(auth.uid(), d.workspace_id)));

-- ---- deal_stage_history ----
DROP POLICY IF EXISTS "deal_stage_history_insert" ON public.deal_stage_history;
CREATE POLICY "dsh_insert_ws" ON public.deal_stage_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_stage_history.deal_id AND public.is_workspace_member_or_admin(auth.uid(), d.workspace_id)));

-- ---- email_bounces ----
DROP POLICY IF EXISTS "email_bounces_insert" ON public.email_bounces;
CREATE POLICY "eb_insert_ws" ON public.email_bounces FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.emails e WHERE e.id = email_bounces.email_id AND public.is_workspace_member_or_admin(auth.uid(), e.workspace_id)));

-- ---- email_events ----
DROP POLICY IF EXISTS "email_events_insert" ON public.email_events;
CREATE POLICY "ee_insert_ws" ON public.email_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.emails e WHERE e.id = email_events.email_id AND public.is_workspace_member_or_admin(auth.uid(), e.workspace_id)));

-- ---- email_variants ----
DROP POLICY IF EXISTS "email_variants_insert" ON public.email_variants;
DROP POLICY IF EXISTS "email_variants_update" ON public.email_variants;
CREATE POLICY "ev_insert_ws" ON public.email_variants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.email_templates et WHERE et.id = email_variants.template_id AND public.is_workspace_member_or_admin(auth.uid(), et.workspace_id)));
CREATE POLICY "ev_update_ws" ON public.email_variants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.email_templates et WHERE et.id = email_variants.template_id AND public.is_workspace_member_or_admin(auth.uid(), et.workspace_id)));

-- ---- import_job_rows ----
DROP POLICY IF EXISTS "import_job_rows_all" ON public.import_job_rows;
CREATE POLICY "ijr_all_owner" ON public.import_job_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_jobs ij WHERE ij.id = import_job_rows.import_job_id AND ij.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_jobs ij WHERE ij.id = import_job_rows.import_job_id AND ij.created_by = auth.uid()));

-- ---- inbox_messages ----
DROP POLICY IF EXISTS "inbox_messages_insert" ON public.inbox_messages;
CREATE POLICY "im_insert_ws" ON public.inbox_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.inbox_threads it WHERE it.id = inbox_messages.thread_id AND public.is_workspace_member_or_admin(auth.uid(), it.workspace_id)));

-- ---- linkedin_action_history ----
DROP POLICY IF EXISTS "linkedin_action_history_insert" ON public.linkedin_action_history;
CREATE POLICY "lah_insert_ws" ON public.linkedin_action_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = linkedin_action_history.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

-- ---- linkedin_action_queue ----
DROP POLICY IF EXISTS "linkedin_action_queue_insert" ON public.linkedin_action_queue;
DROP POLICY IF EXISTS "linkedin_action_queue_update" ON public.linkedin_action_queue;
CREATE POLICY "laq_insert_ws" ON public.linkedin_action_queue FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = linkedin_action_queue.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));
CREATE POLICY "laq_update_ws" ON public.linkedin_action_queue FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = linkedin_action_queue.contact_id AND (public.is_workspace_member_or_admin(auth.uid(), ct.workspace_id) OR (ct.workspace_id IS NULL AND ct.created_by = auth.uid()))));

-- ---- list_contacts ----
DROP POLICY IF EXISTS "list_contacts_all" ON public.list_contacts;
CREATE POLICY "lc_all_ws" ON public.list_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_contacts.list_id AND public.is_workspace_member_or_admin(auth.uid(), l.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_contacts.list_id AND public.is_workspace_member_or_admin(auth.uid(), l.workspace_id)));

-- ---- message_queue ----
DROP POLICY IF EXISTS "queue_manage" ON public.message_queue;
CREATE POLICY "mq_all_ws" ON public.message_queue FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = message_queue.enrollment_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaign_enrollments ce
    JOIN public.campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = message_queue.enrollment_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)
  ));

-- ---- prospect_research_sources ----
DROP POLICY IF EXISTS "prs_insert" ON public.prospect_research_sources;
CREATE POLICY "prs_insert_ws" ON public.prospect_research_sources FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospect_research_profiles prp WHERE prp.id = prospect_research_sources.research_profile_id AND public.is_workspace_member_or_admin(auth.uid(), prp.workspace_id)));

-- ---- system_activity_log ----
DROP POLICY IF EXISTS "system_log_insert" ON public.system_activity_log;
CREATE POLICY "sal_insert_owner" ON public.system_activity_log FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- login_audit_log INSERT policies intentionally kept open for audit logging
