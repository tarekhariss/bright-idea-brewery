
-- ============================================================
-- LINKEDIN OUTREACH PHASE 1
-- Sender Profiles + Action Queue + Settings backbone
-- ============================================================

-- ---- 1. Extend linkedin_action_type enum with all sequence step types ----
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='linkedin_action_type'::regtype AND enumlabel='inmail') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'inmail';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='linkedin_action_type'::regtype AND enumlabel='like_post') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'like_post';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='linkedin_action_type'::regtype AND enumlabel='comment_post') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'comment_post';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='linkedin_action_type'::regtype AND enumlabel='endorse_skills') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'endorse_skills';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='linkedin_action_type'::regtype AND enumlabel='withdraw_request') THEN
    ALTER TYPE linkedin_action_type ADD VALUE 'withdraw_request';
  END IF;
END $$;

-- ---- 2. Extend linkedin_accounts (sender profile) ----
ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS daily_inmail_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS daily_like_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS daily_comment_limit integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS daily_endorse_limit integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS daily_withdraw_limit integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS min_action_delay_seconds integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS max_action_delay_seconds integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS smart_limits_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warmup_level integer NOT NULL DEFAULT 1, -- 1..5
  ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 100, -- 0..100
  ADD COLUMN IF NOT EXISTS proxy_label text,
  ADD COLUMN IF NOT EXISTS schedule_days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS market_median_connects integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS market_median_messages integer NOT NULL DEFAULT 60;

-- ---- 3. linkedin_action_queue: add workspace_id + retry/error/priority ----
ALTER TABLE public.linkedin_action_queue
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.linkedin_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill workspace_id from linkedin_accounts
UPDATE public.linkedin_action_queue q
SET workspace_id = a.workspace_id
FROM public.linkedin_accounts a
WHERE q.linkedin_account_id = a.id AND q.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_li_queue_ws_status ON public.linkedin_action_queue(workspace_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_li_queue_account ON public.linkedin_action_queue(linkedin_account_id, status);
CREATE INDEX IF NOT EXISTS idx_li_queue_campaign ON public.linkedin_action_queue(campaign_id);

-- Add status enum values if not present
DO $$
DECLARE v_typname text;
BEGIN
  SELECT t.typname INTO v_typname
  FROM pg_type t JOIN pg_attribute a ON a.atttypid = t.oid
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relname='linkedin_action_queue' AND a.attname='status' AND t.typtype='e';

  IF v_typname IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid=v_typname::regtype AND enumlabel='blocked') THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', v_typname, 'blocked');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid=v_typname::regtype AND enumlabel='paused') THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', v_typname, 'paused');
    END IF;
  END IF;
END $$;

-- RLS for linkedin_action_queue
ALTER TABLE public.linkedin_action_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_queue_select ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_insert ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_update ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_delete ON public.linkedin_action_queue;
CREATE POLICY li_queue_select ON public.linkedin_action_queue FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_insert ON public.linkedin_action_queue FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_update ON public.linkedin_action_queue FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_delete ON public.linkedin_action_queue FOR DELETE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));

-- Auto-fill workspace_id from account
CREATE OR REPLACE FUNCTION public.tg_li_queue_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.linkedin_account_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_accounts WHERE id = NEW.linkedin_account_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_li_queue_workspace ON public.linkedin_action_queue;
CREATE TRIGGER trg_li_queue_workspace BEFORE INSERT ON public.linkedin_action_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_li_queue_set_workspace();

-- ---- 4. linkedin_action_history: add workspace_id + details ----
ALTER TABLE public.linkedin_action_history
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.linkedin_action_history h
SET workspace_id = a.workspace_id
FROM public.linkedin_accounts a
WHERE h.linkedin_account_id = a.id AND h.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_li_history_ws ON public.linkedin_action_history(workspace_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_li_history_account ON public.linkedin_action_history(linkedin_account_id, executed_at DESC);

ALTER TABLE public.linkedin_action_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_hist_select ON public.linkedin_action_history;
DROP POLICY IF EXISTS li_hist_insert ON public.linkedin_action_history;
CREATE POLICY li_hist_select ON public.linkedin_action_history FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_hist_insert ON public.linkedin_action_history FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member_or_admin(auth.uid(), workspace_id));

CREATE OR REPLACE FUNCTION public.tg_li_history_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.linkedin_account_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_accounts WHERE id = NEW.linkedin_account_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_li_history_workspace ON public.linkedin_action_history;
CREATE TRIGGER trg_li_history_workspace BEFORE INSERT ON public.linkedin_action_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_li_history_set_workspace();

-- ---- 5. linkedin_contact_state (LinkedIn-only fields per contact) ----
CREATE TABLE IF NOT EXISTS public.linkedin_contact_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  connection_status text NOT NULL DEFAULT 'not_connected', -- not_connected|invited|connected|withdrawn|declined|blocked
  last_li_activity_at timestamptz,
  last_li_action_type text,
  last_enriched_at timestamptz,
  inbox_status text, -- new|approaching|engaging|replied|replied_positive|replied_negative|opportunity|not_interested|unresponsive|bad_timing|do_not_contact|bad_data
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_li_cstate_ws ON public.linkedin_contact_state(workspace_id);
CREATE INDEX IF NOT EXISTS idx_li_cstate_contact ON public.linkedin_contact_state(contact_id);

ALTER TABLE public.linkedin_contact_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS li_cstate_all ON public.linkedin_contact_state;
CREATE POLICY li_cstate_select ON public.linkedin_contact_state FOR SELECT TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_cstate_insert ON public.linkedin_contact_state FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_cstate_update ON public.linkedin_contact_state FOR UPDATE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_cstate_delete ON public.linkedin_contact_state FOR DELETE TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ---- 6. LinkedIn-scoped settings tables ----

-- Webhooks
CREATE TABLE IF NOT EXISTS public.linkedin_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  secret text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.linkedin_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_webhooks_all ON public.linkedin_webhooks FOR ALL TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- API Keys (workspace-scoped, hashed values stored)
CREATE TABLE IF NOT EXISTS public.linkedin_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}',
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.linkedin_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_apikeys_all ON public.linkedin_api_keys FOR ALL TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- LinkedIn search filter presets
CREATE TABLE IF NOT EXISTS public.linkedin_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.linkedin_filter_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_filters_all ON public.linkedin_filter_presets FOR ALL TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- Stoplist (do-not-contact) entries scoped to LinkedIn outreach
CREATE TABLE IF NOT EXISTS public.linkedin_stoplist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'linkedin_url', -- linkedin_url|email|domain|company_name|keyword
  match_value text NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, match_type, match_value)
);
ALTER TABLE public.linkedin_stoplist ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_stoplist_all ON public.linkedin_stoplist FOR ALL TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));

-- LLM integrations (for AI personalization)
CREATE TABLE IF NOT EXISTS public.linkedin_llm_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'lovable_ai', -- lovable_ai|openai|anthropic|custom
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  is_default boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.linkedin_llm_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY li_llm_all ON public.linkedin_llm_integrations FOR ALL TO authenticated
  USING (is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member_or_admin(auth.uid(), workspace_id));
