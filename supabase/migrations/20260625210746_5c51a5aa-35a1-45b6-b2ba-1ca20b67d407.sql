
-- 1. import_job_rows: grant workspace admins/managers read access
CREATE POLICY ijr_admin_read ON public.import_job_rows
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.import_jobs ij
  WHERE ij.id = import_job_rows.import_job_id
    AND workspace_role(auth.uid(), ij.workspace_id) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
));

-- 2. linkedin_execution_adapters: restrict SELECT to admin/manager only
DROP POLICY IF EXISTS li_exec_adapters_read ON public.linkedin_execution_adapters;
CREATE POLICY li_exec_adapters_read ON public.linkedin_execution_adapters
FOR SELECT TO authenticated
USING (
  is_workspace_member_or_admin(auth.uid(), workspace_id)
  AND workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- 3. linkedin_webhooks: hide secret column from authenticated clients
REVOKE SELECT ON public.linkedin_webhooks FROM authenticated;
GRANT SELECT (id, workspace_id, name, url, events, is_active, created_by, created_at, updated_at)
  ON public.linkedin_webhooks TO authenticated;
GRANT ALL ON public.linkedin_webhooks TO service_role;

-- 4. mailboxes: hide encrypted credential columns from authenticated clients
REVOKE SELECT ON public.mailboxes FROM authenticated;
GRANT SELECT (
  id, email, display_name, domain_id, provider_type,
  smtp_host, smtp_port, smtp_username, smtp_secure,
  imap_host, imap_port, imap_username, imap_secure,
  connection_status, warmup_enabled, warmup_progress, sending_health,
  daily_sending_limit, emails_sent_today, last_checked_at, notes,
  owner_id, created_by, created_at, updated_at, provider_id,
  oauth_expires_at, workspace_id, first_name, last_name, sender_name,
  signature, tags, reply_to_email, daily_campaign_limit, min_wait_seconds,
  slow_ramp_enabled, daily_inbox_placement_test_limit, tracking_domain,
  tracking_subdomain, tracking_cname_target, tracking_cname_verified,
  tracking_ssl_verified, tracking_last_checked_at, warmup_started_at,
  last_send_at, next_send_eligible_at
) ON public.mailboxes TO authenticated;
GRANT ALL ON public.mailboxes TO service_role;
