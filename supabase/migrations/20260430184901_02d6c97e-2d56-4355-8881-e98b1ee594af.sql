
-- Extend mailboxes with sender profile + sending controls + custom tracking domain
ALTER TABLE public.mailboxes
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reply_to_email text,
  ADD COLUMN IF NOT EXISTS daily_campaign_limit integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_wait_seconds integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS slow_ramp_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_inbox_placement_test_limit integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_domain text,
  ADD COLUMN IF NOT EXISTS tracking_subdomain text DEFAULT 'track',
  ADD COLUMN IF NOT EXISTS tracking_cname_target text,
  ADD COLUMN IF NOT EXISTS tracking_cname_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_ssl_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz;

-- Extend warmup settings with extra Instantly-style controls
ALTER TABLE public.mailbox_warmup_settings
  ADD COLUMN IF NOT EXISTS warmup_filter_tag text,
  ADD COLUMN IF NOT EXISTS disable_slow_warmup boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS warm_custom_tracking_domain boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mark_important_rate numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS warmup_emails_sent_week integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warmup_emails_received_week integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_from_spam_week integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_chart jsonb DEFAULT '[]'::jsonb;
