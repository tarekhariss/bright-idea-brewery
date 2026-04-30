
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS delay_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.mailboxes
  ADD COLUMN IF NOT EXISTS last_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_send_eligible_at timestamptz;

CREATE TABLE IF NOT EXISTS public.campaign_mailbox_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, mailbox_id)
);
CREATE INDEX IF NOT EXISTS idx_cmp_campaign ON public.campaign_mailbox_pool(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cmp_workspace ON public.campaign_mailbox_pool(workspace_id);

ALTER TABLE public.campaign_mailbox_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cmp_select ON public.campaign_mailbox_pool;
CREATE POLICY cmp_select ON public.campaign_mailbox_pool FOR SELECT
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS cmp_write ON public.campaign_mailbox_pool;
CREATE POLICY cmp_write ON public.campaign_mailbox_pool FOR ALL
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE OR REPLACE FUNCTION public.tg_cmp_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cmp_set_workspace ON public.campaign_mailbox_pool;
CREATE TRIGGER trg_cmp_set_workspace BEFORE INSERT ON public.campaign_mailbox_pool
  FOR EACH ROW EXECUTE FUNCTION public.tg_cmp_set_workspace();

CREATE OR REPLACE FUNCTION public.pick_campaign_mailbox(_campaign_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mailbox uuid;
BEGIN
  SELECT mb.id INTO v_mailbox
    FROM public.campaign_mailbox_pool p
    JOIN public.mailboxes mb ON mb.id = p.mailbox_id
    LEFT JOIN public.sending_daily_counts sdc
      ON sdc.mailbox_id = mb.id AND sdc.send_date = CURRENT_DATE
   WHERE p.campaign_id = _campaign_id
     AND p.is_active = true
     AND mb.connection_status = 'active'
     AND COALESCE(sdc.count, 0) < mb.daily_sending_limit
     AND (mb.next_send_eligible_at IS NULL OR mb.next_send_eligible_at <= now())
   ORDER BY COALESCE(sdc.count, 0) ASC, COALESCE(mb.last_send_at, 'epoch'::timestamptz) ASC, random()
   LIMIT 1;
  RETURN v_mailbox;
END $$;

CREATE OR REPLACE FUNCTION public.is_sending_window_open(_window_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_w record; v_now_h numeric; v_dow int;
BEGIN
  IF _window_id IS NULL THEN RETURN true; END IF;
  SELECT * INTO v_w FROM public.sending_windows WHERE id = _window_id;
  IF NOT FOUND OR COALESCE(v_w.is_active, true) = false THEN RETURN true; END IF;
  v_now_h := EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(v_w.timezone,'UTC')))
           + EXTRACT(MINUTE FROM (now() AT TIME ZONE COALESCE(v_w.timezone,'UTC')))/60.0;
  v_dow := EXTRACT(DOW FROM (now() AT TIME ZONE COALESCE(v_w.timezone,'UTC')))::int;
  IF COALESCE(v_w.weekdays_only, false) AND v_dow NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  IF v_w.start_hour IS NULL OR v_w.end_hour IS NULL THEN RETURN true; END IF;
  RETURN v_now_h >= v_w.start_hour AND v_now_h < v_w.end_hour;
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_should_stop_for_reply(_enrollment_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_en record; v_camp record; v_replied boolean := false;
BEGIN
  SELECT e.*, s.campaign_id INTO v_en
    FROM public.sequence_enrollments e
    LEFT JOIN public.sequences s ON s.id = e.sequence_id
   WHERE e.id = _enrollment_id;
  IF NOT FOUND OR v_en.campaign_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_camp FROM public.campaigns WHERE id = v_en.campaign_id;
  IF NOT FOUND OR COALESCE(v_camp.stop_on_reply, true) = false THEN RETURN false; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.inbox_threads t
     WHERE t.contact_id = v_en.contact_id
       AND (t.campaign_id = v_en.campaign_id OR t.campaign_id IS NULL)
       AND t.message_count > 0
       AND COALESCE(t.category::text,'') NOT IN ('bounce','auto_reply')
       AND t.last_message_at >= v_en.enrolled_at
  ) INTO v_replied;
  RETURN v_replied;
END $$;

CREATE OR REPLACE VIEW public.email_queue_health_v AS
  SELECT
    mb.workspace_id,
    COUNT(*) FILTER (WHERE mq.status = 'pending')::int AS waiting,
    COUNT(*) FILTER (WHERE mq.status = 'processing')::int AS in_flight,
    COUNT(*) FILTER (WHERE mq.status = 'failed')::int AS failed,
    COUNT(*) FILTER (WHERE mq.status = 'completed' AND mq.completed_at >= now() - interval '24 hours')::int AS completed_24h,
    MIN(mq.scheduled_for) FILTER (WHERE mq.status = 'pending') AS oldest_pending_at
  FROM public.message_queue mq
  LEFT JOIN public.mailboxes mb ON mb.id = mq.mailbox_id
  WHERE mq.queue_type = 'email'
  GROUP BY mb.workspace_id;
