
-- ============================================================
-- 1. SEQUENCE_STEPS: workspace_id + campaign_id, backfill, NOT NULL, RLS
-- ============================================================
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Backfill workspace_id from parent sequence
UPDATE public.sequence_steps ss
SET workspace_id = s.workspace_id
FROM public.sequences s
WHERE ss.sequence_id = s.id AND ss.workspace_id IS NULL;

-- Delete any orphan steps without a parent sequence (defensive)
DELETE FROM public.sequence_steps WHERE sequence_id IS NULL;

-- Make sequence_id NOT NULL
ALTER TABLE public.sequence_steps ALTER COLUMN sequence_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sequence_steps_workspace ON public.sequence_steps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_campaign ON public.sequence_steps(campaign_id);

-- Trigger to auto-fill workspace_id from parent sequence on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.tg_sequence_step_set_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.sequence_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.sequences WHERE id = NEW.sequence_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sequence_steps_set_workspace ON public.sequence_steps;
CREATE TRIGGER sequence_steps_set_workspace
  BEFORE INSERT OR UPDATE ON public.sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.tg_sequence_step_set_workspace();

-- Tighten RLS: must be member of the workspace that owns the parent sequence
DROP POLICY IF EXISTS "steps_manage" ON public.sequence_steps;
DROP POLICY IF EXISTS sequence_steps_select ON public.sequence_steps;
DROP POLICY IF EXISTS sequence_steps_manage ON public.sequence_steps;

CREATE POLICY sequence_steps_select ON public.sequence_steps
  FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE POLICY sequence_steps_manage ON public.sequence_steps
  FOR ALL TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ============================================================
-- 2. INBOX_MESSAGES classification trigger (was missing!)
-- ============================================================
DROP TRIGGER IF EXISTS inbox_messages_classify ON public.inbox_messages;
CREATE TRIGGER inbox_messages_classify
  AFTER INSERT ON public.inbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_classify_inbox_message();

-- ============================================================
-- 3. Extend classifier to update contact lifecycle/outreach status
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_classify_inbox_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.reply_category;
  v_thread record;
  v_effective_cat public.reply_category;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  v_cat := public.classify_inbound_message(NEW.subject, COALESCE(NEW.body_text, NEW.body_html));

  SELECT * INTO v_thread FROM public.inbox_threads WHERE id = NEW.thread_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Manual override wins: don't overwrite user_category
  IF v_thread.user_category IS NULL THEN
    UPDATE public.inbox_threads
    SET category = v_cat,
        classification_source = 'rule',
        classification_confidence = 0.6,
        classified_at = now(),
        is_primary = (campaign_id IS NOT NULL AND v_cat NOT IN ('bounce','auto_reply')),
        last_message_at = NEW.timestamp,
        message_count = COALESCE(message_count,0) + 1,
        updated_at = now()
    WHERE id = NEW.thread_id;
    v_effective_cat := v_cat;
  ELSE
    UPDATE public.inbox_threads
    SET last_message_at = NEW.timestamp,
        message_count = COALESCE(message_count,0) + 1,
        updated_at = now()
    WHERE id = NEW.thread_id;
    v_effective_cat := v_thread.user_category;
  END IF;

  -- Update contact status to reflect reply
  IF v_thread.contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET outreach_status = CASE
          WHEN v_effective_cat = 'bounce' THEN 'bounced'::outreach_status
          WHEN v_effective_cat = 'not_interested' THEN 'opted_out'::outreach_status
          WHEN v_effective_cat IN ('interested','meeting_booked','meeting_completed','won','lead') THEN 'replied'::outreach_status
          ELSE outreach_status
        END,
        lifecycle_status = CASE
          WHEN v_effective_cat IN ('interested','meeting_booked','meeting_completed') AND lifecycle_status IN ('new','researching','nurturing') THEN 'engaged'::lifecycle_status
          WHEN v_effective_cat = 'won' THEN 'converted'::lifecycle_status
          WHEN v_effective_cat = 'not_interested' THEN 'churned'::lifecycle_status
          ELSE lifecycle_status
        END,
        updated_at = now()
    WHERE id = v_thread.contact_id;
  END IF;

  -- Update campaign enrollment based on campaign options
  IF v_thread.campaign_id IS NOT NULL AND v_thread.contact_id IS NOT NULL THEN
    IF v_effective_cat IN ('not_interested','meeting_booked','won') THEN
      UPDATE public.campaign_enrollments
      SET status = CASE
            WHEN v_effective_cat = 'not_interested' THEN 'unsubscribed'
            WHEN v_effective_cat = 'meeting_booked' THEN 'replied'
            WHEN v_effective_cat = 'won' THEN 'completed'
          END::campaign_enrollment_status,
          updated_at = now()
      WHERE campaign_id = v_thread.campaign_id
        AND contact_id = v_thread.contact_id
        AND status NOT IN ('completed','unsubscribed','bounced');
    ELSIF v_effective_cat = 'auto_reply' AND EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = v_thread.campaign_id AND c.stop_on_auto_reply = true
    ) THEN
      UPDATE public.campaign_enrollments
      SET status = 'paused'::campaign_enrollment_status, updated_at = now()
      WHERE campaign_id = v_thread.campaign_id
        AND contact_id = v_thread.contact_id
        AND status = 'active';
    ELSIF v_effective_cat IN ('interested','lead','meeting_booked','meeting_completed','won')
          AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = v_thread.campaign_id AND c.stop_on_reply = true) THEN
      UPDATE public.campaign_enrollments
      SET status = 'replied'::campaign_enrollment_status, updated_at = now()
      WHERE campaign_id = v_thread.campaign_id
        AND contact_id = v_thread.contact_id
        AND status = 'active';
    END IF;

    -- stop_company_on_reply: pause all enrollments for the same company
    IF v_effective_cat IN ('interested','not_interested','meeting_booked','won')
       AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = v_thread.campaign_id AND c.stop_company_on_reply = true) THEN
      UPDATE public.campaign_enrollments ce
      SET status = 'paused'::campaign_enrollment_status, updated_at = now()
      FROM public.contacts c2
      WHERE ce.contact_id = c2.id
        AND ce.campaign_id = v_thread.campaign_id
        AND ce.status = 'active'
        AND c2.company_id = (SELECT company_id FROM public.contacts WHERE id = v_thread.contact_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_classify_inbox_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sequence_step_set_workspace() FROM anon, authenticated;
