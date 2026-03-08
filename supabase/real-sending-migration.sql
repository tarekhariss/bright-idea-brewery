-- ============================================================
-- Real Email Sending Foundation — Consolidated Migration (Revised)
-- ============================================================

-- 1. Add mailbox_id to emails table for mailbox routing
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON public.emails(mailbox_id);

-- 2. Sending daily counts — track per-mailbox daily volume
CREATE TABLE IF NOT EXISTS public.sending_daily_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  send_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(mailbox_id, send_date)
);

ALTER TABLE public.sending_daily_counts ENABLE ROW LEVEL SECURITY;

-- Only admin/manager/operator can read daily counts
CREATE POLICY "Operational roles can read daily counts"
  ON public.sending_daily_counts FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[])
  );

-- Only admin/manager/operator can insert
CREATE POLICY "Operational roles can insert daily counts"
  ON public.sending_daily_counts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[])
  );

-- Only admin/manager/operator can update
CREATE POLICY "Operational roles can update daily counts"
  ON public.sending_daily_counts FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[])
  );

-- Only admin can delete daily counts
CREATE POLICY "Admin can delete daily counts"
  ON public.sending_daily_counts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 3. Better indexes on message_queue for queue processing
CREATE INDEX IF NOT EXISTS idx_message_queue_pending
  ON public.message_queue(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_message_queue_type_status
  ON public.message_queue(queue_type, status);

-- 4. Index on sequence_enrollments for step processing
CREATE INDEX IF NOT EXISTS idx_enrollments_next_step
  ON public.sequence_enrollments(next_step_at)
  WHERE status = 'active';

-- 5. Add mailbox_id to message_queue convenience column
ALTER TABLE public.message_queue ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL;

-- 6. Function to atomically increment daily send count and check limit
-- Uses SECURITY DEFINER to bypass RLS (called from edge functions via service_role)
CREATE OR REPLACE FUNCTION public.increment_daily_send_count(
  p_mailbox_id uuid,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO sending_daily_counts (mailbox_id, send_date, count)
  VALUES (p_mailbox_id, CURRENT_DATE, 1)
  ON CONFLICT (mailbox_id, send_date)
  DO UPDATE SET count = sending_daily_counts.count + 1
  RETURNING count INTO v_count;

  IF v_count > p_limit THEN
    UPDATE sending_daily_counts
    SET count = count - 1
    WHERE mailbox_id = p_mailbox_id AND send_date = CURRENT_DATE;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 7. Function to get mailbox readiness status
-- Checks against actual enum values:
--   mailboxes.connection_status: 'active' | 'disconnected' | 'warming' | 'error'
--   sending_domains.status:      'pending' | 'verified' | 'failed'
CREATE OR REPLACE FUNCTION public.check_mailbox_readiness(p_mailbox_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mb record;
  v_domain record;
  v_daily_count integer;
  v_issues text[] := '{}';
  v_ready boolean := true;
BEGIN
  SELECT * INTO v_mb FROM mailboxes WHERE id = p_mailbox_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'issues', ARRAY['Mailbox not found']);
  END IF;

  -- Connection check: only 'active' is ready; 'warming' is informational but not send-ready
  IF v_mb.connection_status = 'disconnected' OR v_mb.connection_status = 'error' THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Mailbox connection is ' || v_mb.connection_status::text);
  ELSIF v_mb.connection_status = 'warming' THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Mailbox is still warming up — not yet ready to send');
  ELSIF v_mb.connection_status != 'active' THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Mailbox connection status is unexpected: ' || v_mb.connection_status::text);
  END IF;

  -- SMTP host check
  IF v_mb.smtp_host IS NULL OR v_mb.smtp_host = '' THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'No SMTP host configured');
  END IF;

  -- Daily limit check
  IF v_mb.daily_sending_limit <= 0 THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'No daily sending limit configured');
  END IF;

  -- Domain check: only 'verified' is acceptable
  IF v_mb.domain_id IS NOT NULL THEN
    SELECT * INTO v_domain FROM sending_domains WHERE id = v_mb.domain_id;
    IF NOT FOUND THEN
      v_ready := false;
      v_issues := array_append(v_issues, 'Linked domain not found in sending_domains');
    ELSIF v_domain.status = 'pending' THEN
      v_ready := false;
      v_issues := array_append(v_issues, 'Linked domain DNS verification is still pending');
    ELSIF v_domain.status = 'failed' THEN
      v_ready := false;
      v_issues := array_append(v_issues, 'Linked domain DNS verification failed');
    ELSIF v_domain.status != 'verified' THEN
      v_ready := false;
      v_issues := array_append(v_issues, 'Linked domain status is unexpected: ' || v_domain.status::text);
    END IF;
  ELSE
    v_issues := array_append(v_issues, 'No domain linked (recommended for deliverability)');
  END IF;

  -- Daily count check
  SELECT COALESCE(sdc.count, 0) INTO v_daily_count
  FROM sending_daily_counts sdc
  WHERE sdc.mailbox_id = p_mailbox_id AND sdc.send_date = CURRENT_DATE;

  IF NOT FOUND THEN
    v_daily_count := 0;
  END IF;

  IF v_daily_count >= v_mb.daily_sending_limit THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Daily sending limit reached (' || v_daily_count || '/' || v_mb.daily_sending_limit || ')');
  END IF;

  RETURN jsonb_build_object(
    'ready', v_ready,
    'issues', v_issues,
    'mailbox_id', p_mailbox_id,
    'email', v_mb.email,
    'connection_status', v_mb.connection_status::text,
    'daily_limit', v_mb.daily_sending_limit,
    'sent_today', COALESCE(v_daily_count, 0),
    'domain_id', v_mb.domain_id,
    'domain_status', COALESCE(v_domain.status::text, 'none'),
    'smtp_configured', (v_mb.smtp_host IS NOT NULL AND v_mb.smtp_host != '')
  );
END;
$$;
