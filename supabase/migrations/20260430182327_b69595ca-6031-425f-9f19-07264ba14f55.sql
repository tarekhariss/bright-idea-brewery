-- Extend campaigns table with Schedule + Options fields scoped per campaign
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS sending_window_id uuid REFERENCES public.sending_windows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS active_days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  ADD COLUMN IF NOT EXISTS send_start_hour integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS send_end_hour integer NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS track_opens boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_clicks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stop_on_click boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_optimization boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS bcc text;
