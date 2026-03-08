-- ============================================================
-- Real Email Sending Foundation — Consolidated Migration
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

CREATE POLICY "Authenticated users can read daily counts"
  ON public.sending_daily_counts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated manage daily counts"
  ON public.sending_daily_counts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

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

-- 5. Add mailbox_id to message_queue payload convenience column
ALTER TABLE public.message_queue ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL;

-- 6. Function to atomically increment daily send count and check limit
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
    -- Rolled past the limit, undo
    UPDATE sending_daily_counts
    SET count = count - 1
    WHERE mailbox_id = p_mailbox_id AND send_date = CURRENT_DATE;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 7. Function to get mailbox readiness status
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

  -- Connection check
  IF v_mb.connection_status != 'active' THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Mailbox connection is ' || v_mb.connection_status);
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

  -- Domain check
  IF v_mb.domain_id IS NOT NULL THEN
    SELECT * INTO v_domain FROM sending_domains WHERE id = v_mb.domain_id;
    IF FOUND AND v_domain.status != 'verified' THEN
      v_ready := false;
      v_issues := array_append(v_issues, 'Linked domain is not verified (' || v_domain.status || ')');
    END IF;
  ELSE
    v_issues := array_append(v_issues, 'No domain linked (recommended)');
  END IF;

  -- Daily count check
  SELECT COALESCE(count, 0) INTO v_daily_count
  FROM sending_daily_counts
  WHERE mailbox_id = p_mailbox_id AND send_date = CURRENT_DATE;

  IF v_daily_count >= v_mb.daily_sending_limit THEN
    v_ready := false;
    v_issues := array_append(v_issues, 'Daily sending limit reached (' || v_daily_count || '/' || v_mb.daily_sending_limit || ')');
  END IF;

  RETURN jsonb_build_object(
    'ready', v_ready,
    'issues', v_issues,
    'mailbox_id', p_mailbox_id,
    'email', v_mb.email,
    'connection_status', v_mb.connection_status,
    'daily_limit', v_mb.daily_sending_limit,
    'sent_today', v_daily_count,
    'domain_status', COALESCE(v_domain.status, 'none'),
    'smtp_configured', (v_mb.smtp_host IS NOT NULL AND v_mb.smtp_host != '')
  );
END;
$$;
