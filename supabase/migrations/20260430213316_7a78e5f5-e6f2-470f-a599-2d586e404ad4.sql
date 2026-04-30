
-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.linkedin_node_type AS ENUM (
    'start','visit_profile','connect_request','wait_for_connection',
    'message','inmail','like_post','comment_post','endorse_skills',
    'withdraw_request','time_delay','manual_task','end'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.linkedin_edge_condition AS ENUM (
    'default','connected','not_connected','accepted','declined','timeout',
    'replied','no_reply','opened','not_opened','success','failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.linkedin_variant_strategy AS ENUM ('even_then_winner','even','weighted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.linkedin_variant_metric AS ENUM ('reply_rate','acceptance_rate','positive_reply');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- linkedin_campaigns: extra config columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.linkedin_campaigns
  ADD COLUMN IF NOT EXISTS variant_rotation public.linkedin_variant_strategy NOT NULL DEFAULT 'even_then_winner',
  ADD COLUMN IF NOT EXISTS variant_winning_metric public.linkedin_variant_metric NOT NULL DEFAULT 'reply_rate',
  ADD COLUMN IF NOT EXISTS variant_min_sends_per_variant integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS creation_step text NOT NULL DEFAULT 'build';

-- ─────────────────────────────────────────────────────────────
-- Workflow nodes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.linkedin_workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  node_type public.linkedin_node_type NOT NULL,
  label text,

  -- Generic config (interpreted per node_type)
  delay_amount integer,
  delay_unit text CHECK (delay_unit IS NULL OR delay_unit IN ('minutes','hours','days')),
  wait_timeout_days integer,            -- for wait_for_connection
  withdraw_after_days integer,          -- for withdraw_request
  message_body text,
  message_subject text,                 -- for inmail
  connection_note text,
  skip_note_if_too_long boolean DEFAULT true,
  send_always boolean DEFAULT false,    -- send even if not connected
  task_title text,
  task_description text,
  attachments jsonb DEFAULT '[]'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,     -- escape hatch
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_li_wf_nodes_campaign ON public.linkedin_workflow_nodes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_li_wf_nodes_workspace ON public.linkedin_workflow_nodes(workspace_id);

CREATE OR REPLACE FUNCTION public.tg_li_wf_node_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_li_wf_node_set_workspace ON public.linkedin_workflow_nodes;
CREATE TRIGGER tg_li_wf_node_set_workspace
BEFORE INSERT OR UPDATE ON public.linkedin_workflow_nodes
FOR EACH ROW EXECUTE FUNCTION public.tg_li_wf_node_set_workspace();

ALTER TABLE public.linkedin_workflow_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "li_wf_nodes_select" ON public.linkedin_workflow_nodes
  FOR SELECT USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_nodes_insert" ON public.linkedin_workflow_nodes
  FOR INSERT WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_nodes_update" ON public.linkedin_workflow_nodes
  FOR UPDATE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_nodes_delete" ON public.linkedin_workflow_nodes
  FOR DELETE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ─────────────────────────────────────────────────────────────
-- Workflow edges
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.linkedin_workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.linkedin_workflow_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.linkedin_workflow_nodes(id) ON DELETE CASCADE,
  condition public.linkedin_edge_condition NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, condition)
);

CREATE INDEX IF NOT EXISTS idx_li_wf_edges_campaign ON public.linkedin_workflow_edges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_li_wf_edges_from ON public.linkedin_workflow_edges(from_node_id);

CREATE OR REPLACE FUNCTION public.tg_li_wf_edge_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_li_wf_edge_set_workspace ON public.linkedin_workflow_edges;
CREATE TRIGGER tg_li_wf_edge_set_workspace
BEFORE INSERT OR UPDATE ON public.linkedin_workflow_edges
FOR EACH ROW EXECUTE FUNCTION public.tg_li_wf_edge_set_workspace();

ALTER TABLE public.linkedin_workflow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_wf_edges_select" ON public.linkedin_workflow_edges
  FOR SELECT USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_edges_insert" ON public.linkedin_workflow_edges
  FOR INSERT WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_edges_update" ON public.linkedin_workflow_edges
  FOR UPDATE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_wf_edges_delete" ON public.linkedin_workflow_edges
  FOR DELETE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ─────────────────────────────────────────────────────────────
-- Message variants
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.linkedin_message_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.linkedin_workflow_nodes(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'A',
  body text NOT NULL DEFAULT '',
  subject text,
  weight integer NOT NULL DEFAULT 1,
  sends_count integer NOT NULL DEFAULT 0,
  replies_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  positive_count integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_li_variants_node ON public.linkedin_message_variants(node_id);
CREATE INDEX IF NOT EXISTS idx_li_variants_campaign ON public.linkedin_message_variants(campaign_id);

CREATE OR REPLACE FUNCTION public.tg_li_variant_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_li_variant_set_workspace ON public.linkedin_message_variants;
CREATE TRIGGER tg_li_variant_set_workspace
BEFORE INSERT OR UPDATE ON public.linkedin_message_variants
FOR EACH ROW EXECUTE FUNCTION public.tg_li_variant_set_workspace();

ALTER TABLE public.linkedin_message_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_variants_select" ON public.linkedin_message_variants
  FOR SELECT USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_variants_insert" ON public.linkedin_message_variants
  FOR INSERT WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_variants_update" ON public.linkedin_message_variants
  FOR UPDATE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_variants_delete" ON public.linkedin_message_variants
  FOR DELETE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ─────────────────────────────────────────────────────────────
-- Campaign senders (many-to-many)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.linkedin_campaign_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.linkedin_campaigns(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, linkedin_account_id)
);

CREATE INDEX IF NOT EXISTS idx_li_camp_senders_campaign ON public.linkedin_campaign_senders(campaign_id);

CREATE OR REPLACE FUNCTION public.tg_li_camp_sender_set_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.linkedin_campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_li_camp_sender_set_workspace ON public.linkedin_campaign_senders;
CREATE TRIGGER tg_li_camp_sender_set_workspace
BEFORE INSERT OR UPDATE ON public.linkedin_campaign_senders
FOR EACH ROW EXECUTE FUNCTION public.tg_li_camp_sender_set_workspace();

ALTER TABLE public.linkedin_campaign_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_camp_senders_select" ON public.linkedin_campaign_senders
  FOR SELECT USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_camp_senders_insert" ON public.linkedin_campaign_senders
  FOR INSERT WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_camp_senders_update" ON public.linkedin_campaign_senders
  FOR UPDATE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY "li_camp_senders_delete" ON public.linkedin_campaign_senders
  FOR DELETE USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- ─────────────────────────────────────────────────────────────
-- linkedin_campaign_leads: graph-aware columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.linkedin_campaign_leads
  ADD COLUMN IF NOT EXISTS current_node_id uuid REFERENCES public.linkedin_workflow_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_branch_condition public.linkedin_edge_condition,
  ADD COLUMN IF NOT EXISTS assigned_sender_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL;

-- linkedin_action_queue: track which variant was used + node-aware
ALTER TABLE public.linkedin_action_queue
  ADD COLUMN IF NOT EXISTS workflow_node_id uuid REFERENCES public.linkedin_workflow_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.linkedin_message_variants(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- RPC: validate workflow
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_workflow_validate(_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start_count int;
  v_end_count int;
  v_node_count int;
  v_orphan_count int;
  v_errors text[] := '{}';
BEGIN
  SELECT COUNT(*) INTO v_node_count FROM public.linkedin_workflow_nodes WHERE campaign_id = _campaign_id;
  IF v_node_count = 0 THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Workflow is empty']);
  END IF;

  SELECT COUNT(*) INTO v_start_count
    FROM public.linkedin_workflow_nodes WHERE campaign_id = _campaign_id AND node_type = 'start';
  IF v_start_count <> 1 THEN
    v_errors := array_append(v_errors, 'Workflow must have exactly one Start node');
  END IF;

  SELECT COUNT(*) INTO v_end_count
    FROM public.linkedin_workflow_nodes WHERE campaign_id = _campaign_id AND node_type = 'end';
  IF v_end_count = 0 THEN
    v_errors := array_append(v_errors, 'Workflow must have at least one End node');
  END IF;

  -- Orphan: non-start node with no incoming edge
  SELECT COUNT(*) INTO v_orphan_count
    FROM public.linkedin_workflow_nodes n
    WHERE n.campaign_id = _campaign_id
      AND n.node_type <> 'start'
      AND NOT EXISTS (SELECT 1 FROM public.linkedin_workflow_edges e WHERE e.to_node_id = n.id);
  IF v_orphan_count > 0 THEN
    v_errors := array_append(v_errors, format('Found %s orphan node(s) with no incoming edge', v_orphan_count));
  END IF;

  RETURN jsonb_build_object('valid', array_length(v_errors,1) IS NULL, 'errors', v_errors);
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: pick next node by condition
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_workflow_next_node(_node_id uuid, _condition public.linkedin_edge_condition DEFAULT 'default')
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next uuid;
BEGIN
  SELECT to_node_id INTO v_next FROM public.linkedin_workflow_edges
   WHERE from_node_id = _node_id AND condition = _condition LIMIT 1;
  IF v_next IS NULL THEN
    SELECT to_node_id INTO v_next FROM public.linkedin_workflow_edges
     WHERE from_node_id = _node_id AND condition = 'default' LIMIT 1;
  END IF;
  RETURN v_next;
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: pick a variant for a node (even-then-winner)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_pick_variant(_node_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_camp record;
  v_variant_id uuid;
  v_min_sends int;
  v_max_sends int;
  v_winner uuid;
BEGIN
  SELECT c.* INTO v_camp
    FROM public.linkedin_campaigns c
    JOIN public.linkedin_workflow_nodes n ON n.campaign_id = c.id
   WHERE n.id = _node_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- If a winner is already locked, use it (only for even_then_winner)
  IF v_camp.variant_rotation = 'even_then_winner' THEN
    SELECT id INTO v_winner FROM public.linkedin_message_variants
     WHERE node_id = _node_id AND is_winner = true AND is_active = true LIMIT 1;
    IF v_winner IS NOT NULL THEN RETURN v_winner; END IF;
  END IF;

  -- Even rotation: pick the active variant with the fewest sends
  IF v_camp.variant_rotation IN ('even','even_then_winner') THEN
    SELECT id, sends_count INTO v_variant_id, v_min_sends
      FROM public.linkedin_message_variants
     WHERE node_id = _node_id AND is_active = true
     ORDER BY sends_count ASC, created_at ASC
     LIMIT 1;

    -- Check if all variants reached threshold → auto-pick winner by metric
    IF v_camp.variant_rotation = 'even_then_winner' AND v_variant_id IS NOT NULL THEN
      SELECT MIN(sends_count) INTO v_min_sends FROM public.linkedin_message_variants
        WHERE node_id = _node_id AND is_active = true;
      IF v_min_sends >= v_camp.variant_min_sends_per_variant THEN
        SELECT id INTO v_winner FROM public.linkedin_message_variants
          WHERE node_id = _node_id AND is_active = true
          ORDER BY (
            CASE v_camp.variant_winning_metric
              WHEN 'reply_rate' THEN CASE WHEN sends_count > 0 THEN replies_count::float/sends_count ELSE 0 END
              WHEN 'acceptance_rate' THEN CASE WHEN sends_count > 0 THEN accepted_count::float/sends_count ELSE 0 END
              WHEN 'positive_reply' THEN CASE WHEN sends_count > 0 THEN positive_count::float/sends_count ELSE 0 END
            END
          ) DESC, sends_count DESC LIMIT 1;
        IF v_winner IS NOT NULL THEN
          UPDATE public.linkedin_message_variants SET is_winner = true WHERE id = v_winner;
          RETURN v_winner;
        END IF;
      END IF;
    END IF;

    RETURN v_variant_id;
  END IF;

  -- Weighted: pick by weight
  SELECT id INTO v_variant_id FROM public.linkedin_message_variants
   WHERE node_id = _node_id AND is_active = true
   ORDER BY (random() * weight) DESC LIMIT 1;
  RETURN v_variant_id;
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: pick a sender for a campaign (round-robin by least used)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_pick_sender(_campaign_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender uuid;
BEGIN
  SELECT cs.linkedin_account_id INTO v_sender
    FROM public.linkedin_campaign_senders cs
    JOIN public.linkedin_accounts a ON a.id = cs.linkedin_account_id
   WHERE cs.campaign_id = _campaign_id
     AND cs.is_active = true
     AND COALESCE(a.is_active, true) = true
   ORDER BY (
     SELECT COUNT(*) FROM public.linkedin_action_queue q
      WHERE q.linkedin_account_id = cs.linkedin_account_id
        AND q.status IN ('pending','scheduled')
   ) ASC, random() LIMIT 1;

  -- Fallback to legacy single account
  IF v_sender IS NULL THEN
    SELECT linkedin_account_id INTO v_sender FROM public.linkedin_campaigns WHERE id = _campaign_id;
  END IF;
  RETURN v_sender;
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: graph-aware scheduler
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_schedule_next_action_v2(_lead_id uuid, _condition public.linkedin_edge_condition DEFAULT 'default')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead record;
  v_camp record;
  v_node record;
  v_next_id uuid;
  v_when timestamptz;
  v_queue_id uuid;
  v_task_id uuid;
  v_sender uuid;
  v_variant_id uuid;
  v_action_type text;
  v_payload jsonb;
BEGIN
  SELECT l.*, c.workspace_id AS ws, c.status AS campaign_status
    INTO v_lead
    FROM public.linkedin_campaign_leads l
    JOIN public.linkedin_campaigns c ON c.id = l.campaign_id
   WHERE l.id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  IF v_lead.status NOT IN ('queued','active') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'lead status ' || v_lead.status);
  END IF;
  IF v_lead.campaign_status NOT IN ('active','draft') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'campaign not active');
  END IF;
  IF public.linkedin_contact_on_stoplist(v_lead.ws, v_lead.contact_id) THEN
    UPDATE public.linkedin_campaign_leads SET status='removed', pause_reason='stoplist', updated_at=now() WHERE id=_lead_id;
    RETURN jsonb_build_object('skipped', true, 'reason', 'stoplist');
  END IF;

  -- Determine next node id
  IF v_lead.current_node_id IS NULL THEN
    SELECT id INTO v_next_id FROM public.linkedin_workflow_nodes
      WHERE campaign_id = v_lead.campaign_id AND node_type = 'start' LIMIT 1;
    IF v_next_id IS NULL THEN
      RETURN jsonb_build_object('skipped', true, 'reason', 'no start node');
    END IF;
    -- Move from start to its first successor
    v_next_id := public.linkedin_workflow_next_node(v_next_id, 'default');
  ELSE
    v_next_id := public.linkedin_workflow_next_node(v_lead.current_node_id, _condition);
  END IF;

  IF v_next_id IS NULL THEN
    UPDATE public.linkedin_campaign_leads SET status='completed', updated_at=now() WHERE id=_lead_id;
    RETURN jsonb_build_object('completed', true);
  END IF;

  SELECT * INTO v_node FROM public.linkedin_workflow_nodes WHERE id = v_next_id;
  IF v_node.node_type = 'end' THEN
    UPDATE public.linkedin_campaign_leads
       SET status='completed', current_node_id=v_next_id, updated_at=now()
     WHERE id=_lead_id;
    RETURN jsonb_build_object('completed', true);
  END IF;

  -- Compute scheduled time from delay config
  v_when := now();
  IF v_node.delay_amount IS NOT NULL AND v_node.delay_unit IS NOT NULL AND v_node.delay_amount > 0 THEN
    v_when := now() + (v_node.delay_amount || ' ' || v_node.delay_unit)::interval;
  END IF;

  -- Manual task
  IF v_node.node_type = 'manual_task' THEN
    INSERT INTO public.linkedin_tasks (workspace_id, contact_id, campaign_id, title, description, status, due_at)
    VALUES (v_lead.ws, v_lead.contact_id, v_lead.campaign_id,
            COALESCE(v_node.task_title,'LinkedIn task'), v_node.task_description, 'open', v_when)
    RETURNING id INTO v_task_id;

    UPDATE public.linkedin_campaign_leads
       SET current_node_id=v_next_id, next_action_at=v_when, status='active',
           last_branch_condition=_condition, updated_at=now()
     WHERE id=_lead_id;
    RETURN jsonb_build_object('scheduled', true, 'task_id', v_task_id, 'type','manual_task','at', v_when);
  END IF;

  -- Time delay node: just advance and schedule a no-op pulse
  IF v_node.node_type = 'time_delay' THEN
    UPDATE public.linkedin_campaign_leads
       SET current_node_id=v_next_id, next_action_at=v_when, status='active',
           last_branch_condition=_condition, updated_at=now()
     WHERE id=_lead_id;

    INSERT INTO public.linkedin_action_queue
      (linkedin_account_id, contact_id, campaign_id, workflow_node_id, action_type, status, scheduled_at, payload)
    VALUES (v_lead.assigned_sender_id, v_lead.contact_id, v_lead.campaign_id, v_next_id,
            'wait', 'scheduled', v_when, jsonb_build_object('lead_id',_lead_id,'pulse',true))
    RETURNING id INTO v_queue_id;
    RETURN jsonb_build_object('scheduled', true, 'queue_id', v_queue_id, 'type','time_delay','at', v_when);
  END IF;

  -- Wait for connection: create a pulse that the worker will use to check status and branch
  IF v_node.node_type = 'wait_for_connection' THEN
    v_when := now() + (COALESCE(v_node.wait_timeout_days, 7) || ' days')::interval;
    UPDATE public.linkedin_campaign_leads
       SET current_node_id=v_next_id, next_action_at=v_when, status='active',
           last_branch_condition=_condition, updated_at=now()
     WHERE id=_lead_id;

    INSERT INTO public.linkedin_action_queue
      (linkedin_account_id, contact_id, campaign_id, workflow_node_id, action_type, status, scheduled_at, payload)
    VALUES (v_lead.assigned_sender_id, v_lead.contact_id, v_lead.campaign_id, v_next_id,
            'wait', 'scheduled', v_when,
            jsonb_build_object('lead_id',_lead_id,'check','connection','timeout_days', COALESCE(v_node.wait_timeout_days,7)))
    RETURNING id INTO v_queue_id;
    RETURN jsonb_build_object('scheduled', true, 'queue_id', v_queue_id, 'type','wait_for_connection','at', v_when);
  END IF;

  -- Resolve sender
  v_sender := COALESCE(v_lead.assigned_sender_id, public.linkedin_pick_sender(v_lead.campaign_id));
  IF v_sender IS NULL THEN
    UPDATE public.linkedin_campaign_leads SET status='paused', pause_reason='no sender', updated_at=now() WHERE id=_lead_id;
    RETURN jsonb_build_object('skipped', true, 'reason', 'no active sender profile');
  END IF;

  -- Resolve variant for message-style nodes
  IF v_node.node_type IN ('message','inmail','connect_request','comment_post') THEN
    v_variant_id := public.linkedin_pick_variant(v_next_id);
  END IF;

  -- Map node_type → action_type
  v_action_type := CASE v_node.node_type
    WHEN 'visit_profile' THEN 'view_profile'
    WHEN 'connect_request' THEN 'connect_request'
    WHEN 'message' THEN 'message'
    WHEN 'inmail' THEN 'inmail'
    WHEN 'like_post' THEN 'like_post'
    WHEN 'comment_post' THEN 'comment_post'
    WHEN 'endorse_skills' THEN 'endorse_skills'
    WHEN 'withdraw_request' THEN 'withdraw_request'
    ELSE v_node.node_type::text
  END;

  v_payload := jsonb_build_object(
    'lead_id', _lead_id,
    'node_id', v_next_id,
    'node_type', v_node.node_type,
    'message_body', COALESCE((SELECT body FROM public.linkedin_message_variants WHERE id = v_variant_id), v_node.message_body),
    'message_subject', COALESCE((SELECT subject FROM public.linkedin_message_variants WHERE id = v_variant_id), v_node.message_subject),
    'connection_note', v_node.connection_note,
    'skip_note_if_too_long', COALESCE(v_node.skip_note_if_too_long, true),
    'send_always', COALESCE(v_node.send_always, false),
    'withdraw_after_days', v_node.withdraw_after_days
  );

  INSERT INTO public.linkedin_action_queue
    (linkedin_account_id, contact_id, campaign_id, workflow_node_id, variant_id, action_type, status, scheduled_at, payload)
  VALUES (v_sender, v_lead.contact_id, v_lead.campaign_id, v_next_id, v_variant_id,
          v_action_type::linkedin_action_type, 'scheduled', v_when, v_payload)
  RETURNING id INTO v_queue_id;

  -- Increment variant sends_count optimistically (worker can correct on failure if needed)
  IF v_variant_id IS NOT NULL THEN
    UPDATE public.linkedin_message_variants SET sends_count = sends_count + 1 WHERE id = v_variant_id;
  END IF;

  UPDATE public.linkedin_campaign_leads
     SET current_node_id=v_next_id, next_action_at=v_when, assigned_sender_id=v_sender,
         status='active', last_branch_condition=_condition, updated_at=now()
   WHERE id=_lead_id;

  RETURN jsonb_build_object('scheduled', true, 'queue_id', v_queue_id, 'type', v_node.node_type, 'at', v_when);
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: enroll leads (graph-aware)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_enroll_leads_v2(_campaign_id uuid, _contact_ids uuid[], _only_new boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_camp record; v_id uuid; v_lead_id uuid; v_added int := 0; v_skipped int := 0;
BEGIN
  SELECT * INTO v_camp FROM public.linkedin_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT public.is_workspace_member_or_admin(auth.uid(), v_camp.workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOREACH v_id IN ARRAY _contact_ids LOOP
    INSERT INTO public.linkedin_campaign_leads (workspace_id, campaign_id, contact_id, status, added_by)
    VALUES (v_camp.workspace_id, _campaign_id, v_id, 'queued', auth.uid())
    ON CONFLICT (campaign_id, contact_id) DO NOTHING
    RETURNING id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      v_added := v_added + 1;
      IF NOT _only_new THEN
        PERFORM public.linkedin_schedule_next_action_v2(v_lead_id, 'default');
      END IF;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped);
END $$;

-- ─────────────────────────────────────────────────────────────
-- RPC: launch campaign
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.linkedin_launch_campaign(_campaign_id uuid, _mode text DEFAULT 'enroll_existing')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_camp record;
  v_validation jsonb;
  v_sender_count int;
  v_lead_count int;
  v_lead record;
  v_re_enrolled int := 0;
BEGIN
  SELECT * INTO v_camp FROM public.linkedin_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT public.is_workspace_member_or_admin(auth.uid(), v_camp.workspace_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_validation := public.linkedin_workflow_validate(_campaign_id);
  IF (v_validation->>'valid')::boolean = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'validation', 'errors', v_validation->'errors');
  END IF;

  SELECT COUNT(*) INTO v_sender_count FROM public.linkedin_campaign_senders
   WHERE campaign_id = _campaign_id AND is_active = true;
  IF v_sender_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_senders');
  END IF;

  SELECT COUNT(*) INTO v_lead_count FROM public.linkedin_campaign_leads WHERE campaign_id = _campaign_id;
  IF v_lead_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_leads');
  END IF;

  UPDATE public.linkedin_campaigns
     SET status = 'active', creation_step = 'launch', updated_at = now()
   WHERE id = _campaign_id;

  IF _mode = 'enroll_existing' THEN
    FOR v_lead IN SELECT id FROM public.linkedin_campaign_leads
                   WHERE campaign_id = _campaign_id
                     AND status IN ('queued','paused')
                     AND current_node_id IS NULL LOOP
      PERFORM public.linkedin_schedule_next_action_v2(v_lead.id, 'default');
      v_re_enrolled := v_re_enrolled + 1;
    END LOOP;
  ELSIF _mode = 'restart_all' THEN
    -- Cancel pending queue and reset all leads
    UPDATE public.linkedin_action_queue SET status = 'cancelled', updated_at = now()
     WHERE campaign_id = _campaign_id AND status IN ('pending','scheduled','paused');
    UPDATE public.linkedin_campaign_leads
       SET current_node_id = NULL, last_branch_condition = NULL, status = 'queued', updated_at = now()
     WHERE campaign_id = _campaign_id;
    FOR v_lead IN SELECT id FROM public.linkedin_campaign_leads WHERE campaign_id = _campaign_id LOOP
      PERFORM public.linkedin_schedule_next_action_v2(v_lead.id, 'default');
      v_re_enrolled := v_re_enrolled + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'enrolled', v_re_enrolled, 'senders', v_sender_count, 'leads', v_lead_count);
END $$;
