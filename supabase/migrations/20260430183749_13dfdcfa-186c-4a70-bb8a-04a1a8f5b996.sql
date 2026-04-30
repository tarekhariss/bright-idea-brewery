-- Enum for reply categories
DO $$ BEGIN
  CREATE TYPE public.reply_category AS ENUM (
    'lead','interested','not_interested','meeting_booked','meeting_completed',
    'won','auto_reply','bounce','neutral','unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum for classification source
DO $$ BEGIN
  CREATE TYPE public.classification_source AS ENUM ('rule','ai','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.inbox_threads
  ADD COLUMN IF NOT EXISTS category public.reply_category NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS user_category public.reply_category,
  ADD COLUMN IF NOT EXISTS classification_source public.classification_source NOT NULL DEFAULT 'rule',
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inbox_threads_category ON public.inbox_threads(category);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_primary ON public.inbox_threads(is_primary, status);

-- Classifier: rule-based, returns a category from subject+body
CREATE OR REPLACE FUNCTION public.classify_inbound_message(p_subject text, p_body text)
RETURNS public.reply_category
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text := lower(coalesce(p_subject,'') || ' ' || coalesce(p_body,''));
BEGIN
  -- Auto-reply / out of office
  IF s ~ '(out of office|out-of-office|on vacation|on holiday|automatic reply|auto[- ]?reply|i am away|currently away|will be back|away from)' THEN
    RETURN 'auto_reply';
  END IF;

  -- Bounce / delivery failure
  IF s ~ '(undeliverable|delivery failed|delivery status notification|mailer-daemon|address not found|mailbox full|user unknown|550 5\.|recipient address rejected)' THEN
    RETURN 'bounce';
  END IF;

  -- Won
  IF s ~ '(signed the contract|sent payment|invoice paid|deal closed|let''s move forward with the contract|we will purchase|purchase order)' THEN
    RETURN 'won';
  END IF;

  -- Meeting completed
  IF s ~ '(thanks for the (call|meeting|demo)|enjoyed our (call|meeting|demo)|great (call|meeting|chat)|after our call|following up on our (call|meeting))' THEN
    RETURN 'meeting_completed';
  END IF;

  -- Meeting booked
  IF s ~ '(let''s schedule|book a (call|meeting|demo)|happy to chat|set up a (call|meeting)|put time on (my|the) calendar|calendar invite|calendly|chili piper|book.*time|scheduled for|confirmed for)' THEN
    RETURN 'meeting_booked';
  END IF;

  -- Not interested
  IF s ~ '(not interested|no thanks|please remove|unsubscribe|do not contact|stop emailing|take me off|no thank you|we''re all set|not a fit|wrong person)' THEN
    RETURN 'not_interested';
  END IF;

  -- Interested / lead
  IF s ~ '(interested|tell me more|more information|sounds good|sounds interesting|love to learn|would like to know more|send me|share more|happy to learn|curious about|how does (it|this) work)' THEN
    RETURN 'interested';
  END IF;

  IF s ~ '(who handles|forward(ed|ing)? this to|right person|connect you with|introduce you to|loop in|cc''ing)' THEN
    RETURN 'lead';
  END IF;

  RETURN 'neutral';
END;
$$;

-- Trigger function: classify on new inbound message
CREATE OR REPLACE FUNCTION public.tg_classify_inbox_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.reply_category;
  v_thread record;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  v_cat := public.classify_inbound_message(NEW.subject, COALESCE(NEW.body_text, NEW.body_html));

  SELECT * INTO v_thread FROM public.inbox_threads WHERE id = NEW.thread_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Only auto-update when there's no manual override
  IF v_thread.user_category IS NULL THEN
    UPDATE public.inbox_threads
    SET category = v_cat,
        classification_source = 'rule',
        classification_confidence = 0.6,
        classified_at = now(),
        is_primary = (campaign_id IS NOT NULL AND v_cat NOT IN ('bounce','auto_reply')),
        last_message_at = NEW.timestamp,
        message_count = message_count + 1,
        updated_at = now()
    WHERE id = NEW.thread_id;
  ELSE
    UPDATE public.inbox_threads
    SET last_message_at = NEW.timestamp,
        message_count = message_count + 1,
        updated_at = now()
    WHERE id = NEW.thread_id;
  END IF;

  -- Auto-update campaign enrollment when applicable
  IF v_thread.campaign_id IS NOT NULL AND v_thread.contact_id IS NOT NULL THEN
    IF v_cat IN ('not_interested','meeting_booked','won') THEN
      UPDATE public.campaign_enrollments
      SET status = CASE
            WHEN v_cat = 'not_interested' THEN 'unsubscribed'
            WHEN v_cat = 'meeting_booked' THEN 'replied'
            WHEN v_cat = 'won' THEN 'completed'
          END::campaign_enrollment_status,
          updated_at = now()
      WHERE campaign_id = v_thread.campaign_id
        AND contact_id = v_thread.contact_id
        AND status NOT IN ('completed','unsubscribed','bounced');
    ELSIF v_cat = 'auto_reply' AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = v_thread.campaign_id AND c.stop_on_auto_reply = true
    ) THEN
      UPDATE public.campaign_enrollments
      SET status = 'paused'::campaign_enrollment_status, updated_at = now()
      WHERE campaign_id = v_thread.campaign_id
        AND contact_id = v_thread.contact_id
        AND status = 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_inbox_message ON public.inbox_messages;
CREATE TRIGGER trg_classify_inbox_message
AFTER INSERT ON public.inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_classify_inbox_message();

-- Backfill existing threads
WITH latest AS (
  SELECT DISTINCT ON (thread_id) thread_id, subject, body_text, body_html, timestamp
  FROM public.inbox_messages
  WHERE direction = 'inbound'
  ORDER BY thread_id, timestamp DESC
)
UPDATE public.inbox_threads t
SET category = public.classify_inbound_message(l.subject, COALESCE(l.body_text, l.body_html)),
    classification_source = 'rule',
    classified_at = now(),
    is_primary = (t.campaign_id IS NOT NULL)
FROM latest l
WHERE l.thread_id = t.id
  AND t.user_category IS NULL;

UPDATE public.inbox_threads
SET is_primary = (campaign_id IS NOT NULL AND category NOT IN ('bounce','auto_reply'))
WHERE classified_at IS NULL OR is_primary IS NULL;