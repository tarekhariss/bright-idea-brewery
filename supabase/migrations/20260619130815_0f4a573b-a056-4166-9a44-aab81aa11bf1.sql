
-- ============================================================
-- CRM Phase 1 — Opportunities & related objects
-- ============================================================

-- 1. ENUMS -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.opportunity_status AS ENUM (
    'interested','qualified','meeting_requested','meeting_booked',
    'proposal_rfq','won','lost','not_fit','bad_timing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.opportunity_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.opportunity_source_channel AS ENUM (
    'email_reply','linkedin_reply','meeting_booked','manual_push',
    'rfq','prospect_search','list','import','api'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. opportunities --------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  status public.opportunity_status NOT NULL DEFAULT 'interested',
  priority public.opportunity_priority NOT NULL DEFAULT 'normal',
  source_channel public.opportunity_source_channel NOT NULL DEFAULT 'manual_push',
  source_campaign_type text CHECK (source_campaign_type IS NULL OR source_campaign_type IN ('email','linkedin')),
  source_campaign_id uuid,
  source_thread_type text CHECK (source_thread_type IS NULL OR source_thread_type IN ('email','linkedin')),
  source_thread_id uuid,
  source_message_id uuid,
  title text,
  intent_signal text,
  next_action_at timestamptz,
  last_activity_at timestamptz DEFAULT now(),
  stale_after_days integer DEFAULT 14,
  icp_fit_score integer,
  risk_flags jsonb DEFAULT '{}'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  ai_next_best_action text,
  ai_generated_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opp_requires_subject CHECK (contact_id IS NOT NULL OR company_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS opportunities_workspace_idx ON public.opportunities(workspace_id);
CREATE INDEX IF NOT EXISTS opportunities_owner_idx ON public.opportunities(workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS opportunities_status_idx ON public.opportunities(workspace_id, status);
CREATE INDEX IF NOT EXISTS opportunities_stage_idx ON public.opportunities(workspace_id, stage_id);
CREATE INDEX IF NOT EXISTS opportunities_contact_idx ON public.opportunities(contact_id);
CREATE INDEX IF NOT EXISTS opportunities_company_idx ON public.opportunities(company_id);
CREATE INDEX IF NOT EXISTS opportunities_deal_idx ON public.opportunities(deal_id);
CREATE INDEX IF NOT EXISTS opportunities_last_activity_idx ON public.opportunities(workspace_id, last_activity_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_thread_dedupe_idx
  ON public.opportunities(workspace_id, contact_id, source_thread_id)
  WHERE contact_id IS NOT NULL AND source_thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_company_thread_dedupe_idx
  ON public.opportunities(workspace_id, company_id, source_thread_id)
  WHERE contact_id IS NULL AND company_id IS NOT NULL AND source_thread_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunities_select ON public.opportunities FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY opportunities_insert ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY opportunities_update ON public.opportunities FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY opportunities_delete ON public.opportunities FOR DELETE TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'));

-- 3. opportunity_contacts -------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text,
  is_primary boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, contact_id)
);
CREATE INDEX IF NOT EXISTS opportunity_contacts_opp_idx ON public.opportunity_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS opportunity_contacts_contact_idx ON public.opportunity_contacts(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_contacts TO authenticated;
GRANT ALL ON public.opportunity_contacts TO service_role;
ALTER TABLE public.opportunity_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY oc_select ON public.opportunity_contacts FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY oc_insert ON public.opportunity_contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY oc_update ON public.opportunity_contacts FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY oc_delete ON public.opportunity_contacts FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- 4. opportunity_notes ----------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunity_notes_opp_idx ON public.opportunity_notes(opportunity_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_notes TO authenticated;
GRANT ALL ON public.opportunity_notes TO service_role;
ALTER TABLE public.opportunity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY on_select ON public.opportunity_notes FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY on_insert ON public.opportunity_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND author_id = auth.uid());
CREATE POLICY on_update ON public.opportunity_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY on_delete ON public.opportunity_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'));

-- 5. opportunity_status_history -------------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_status public.opportunity_status,
  to_status public.opportunity_status NOT NULL,
  from_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opp_history_opp_idx ON public.opportunity_status_history(opportunity_id, changed_at DESC);

GRANT SELECT, INSERT ON public.opportunity_status_history TO authenticated;
GRANT ALL ON public.opportunity_status_history TO service_role;
ALTER TABLE public.opportunity_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY osh_select ON public.opportunity_status_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY osh_insert ON public.opportunity_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- 6. crm_settings ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  default_pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  default_stale_days integer NOT NULL DEFAULT 14,
  auto_create_deal_on_proposal boolean NOT NULL DEFAULT false,
  hide_closed_in_active_views boolean NOT NULL DEFAULT true,
  auto_detect_positive_replies boolean NOT NULL DEFAULT false,
  positive_reply_confidence_threshold numeric NOT NULL DEFAULT 0.80,
  default_owner_strategy text NOT NULL DEFAULT 'smart_fallback',
  ai_prompt_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_settings TO authenticated;
GRANT ALL ON public.crm_settings TO service_role;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_settings_select ON public.crm_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY crm_settings_upsert ON public.crm_settings FOR INSERT TO authenticated
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'));
CREATE POLICY crm_settings_update ON public.crm_settings FOR UPDATE TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'))
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) IN ('admin','manager'));

-- 7. updated_at triggers --------------------------------------
CREATE OR REPLACE FUNCTION public._opp_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public._opp_touch_updated_at();
DROP TRIGGER IF EXISTS trg_opp_notes_updated_at ON public.opportunity_notes;
CREATE TRIGGER trg_opp_notes_updated_at BEFORE UPDATE ON public.opportunity_notes
  FOR EACH ROW EXECUTE FUNCTION public._opp_touch_updated_at();
DROP TRIGGER IF EXISTS trg_crm_settings_updated_at ON public.crm_settings;
CREATE TRIGGER trg_crm_settings_updated_at BEFORE UPDATE ON public.crm_settings
  FOR EACH ROW EXECUTE FUNCTION public._opp_touch_updated_at();

-- 8. Seed default CRM pipeline per workspace ------------------
CREATE OR REPLACE FUNCTION public.ensure_crm_pipeline(_workspace_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pid uuid;
  v_created_by uuid;
BEGIN
  SELECT id INTO v_pid FROM public.pipelines
    WHERE workspace_id = _workspace_id AND entity_type = 'opportunity'
    ORDER BY is_default DESC, created_at ASC LIMIT 1;
  IF v_pid IS NOT NULL THEN RETURN v_pid; END IF;

  SELECT user_id INTO v_created_by FROM public.workspace_members
    WHERE workspace_id = _workspace_id ORDER BY joined_at ASC LIMIT 1;

  INSERT INTO public.pipelines (workspace_id, entity_type, name, description, is_default, is_active, created_by)
  VALUES (_workspace_id, 'opportunity', 'CRM Opportunities', 'Default CRM opportunity pipeline', true, true, v_created_by)
  RETURNING id INTO v_pid;

  INSERT INTO public.pipeline_stages
    (workspace_id, pipeline_id, entity_type, pipeline_name, stage_name, stage_key, display_order, color, is_closed, is_won, default_probability, created_by)
  VALUES
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'New',              'new',              10, '#94a3b8', false, false, 10,  v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Qualified',        'qualified',        20, '#60a5fa', false, false, 25,  v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Meeting Booked',   'meeting_booked',   30, '#a78bfa', false, false, 40,  v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Proposal / RFQ',   'proposal_rfq',     40, '#f59e0b', false, false, 60,  v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Won',              'won',              50, '#10b981', true,  true,  100, v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Lost',             'lost',             60, '#ef4444', true,  false, 0,   v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Not a Fit',        'not_fit',          70, '#64748b', true,  false, 0,   v_created_by),
    (_workspace_id, v_pid, 'opportunity', 'CRM Opportunities', 'Bad Timing',       'bad_timing',       80, '#9ca3af', true,  false, 0,   v_created_by);

  INSERT INTO public.crm_settings (workspace_id, default_pipeline_id)
    VALUES (_workspace_id, v_pid)
    ON CONFLICT (workspace_id) DO UPDATE SET default_pipeline_id = EXCLUDED.default_pipeline_id;

  RETURN v_pid;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_crm_pipeline(uuid) TO authenticated, service_role;

-- 9. push_to_crm RPC ------------------------------------------
CREATE OR REPLACE FUNCTION public.push_to_crm(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace_id uuid := (payload->>'workspace_id')::uuid;
  v_contact_id   uuid := NULLIF(payload->>'contact_id','')::uuid;
  v_company_id   uuid := NULLIF(payload->>'company_id','')::uuid;
  v_thread_id    uuid := NULLIF(payload->>'source_thread_id','')::uuid;
  v_thread_type  text := NULLIF(payload->>'source_thread_type','');
  v_campaign_id  uuid := NULLIF(payload->>'source_campaign_id','')::uuid;
  v_campaign_typ text := NULLIF(payload->>'source_campaign_type','');
  v_message_id   uuid := NULLIF(payload->>'source_message_id','')::uuid;
  v_source       public.opportunity_source_channel := COALESCE(NULLIF(payload->>'source_channel','')::public.opportunity_source_channel, 'manual_push');
  v_status       public.opportunity_status := COALESCE(NULLIF(payload->>'status','')::public.opportunity_status, 'interested');
  v_priority     public.opportunity_priority := COALESCE(NULLIF(payload->>'priority','')::public.opportunity_priority, 'normal');
  v_owner_id     uuid := NULLIF(payload->>'owner_id','')::uuid;
  v_stage_id     uuid := NULLIF(payload->>'stage_id','')::uuid;
  v_pipeline_id  uuid := NULLIF(payload->>'pipeline_id','')::uuid;
  v_title        text := NULLIF(payload->>'title','');
  v_note         text := NULLIF(payload->>'note','');
  v_force_new    boolean := COALESCE((payload->>'force_create_new')::boolean, false);
  v_create_deal  boolean := COALESCE((payload->'deal'->>'create')::boolean, false);
  v_deal_value   numeric := NULLIF(payload->'deal'->>'value','')::numeric;
  v_deal_name    text := NULLIF(payload->'deal'->>'name','');
  v_task_title   text := NULLIF(payload->'next_task'->>'title','');
  v_task_due     timestamptz := NULLIF(payload->'next_task'->>'due_at','')::timestamptz;
  v_caller       uuid := auth.uid();
  v_opp_id       uuid;
  v_existing     uuid;
  v_created      boolean := false;
  v_default_pipeline uuid;
  v_deal_id      uuid;
  v_company_owner uuid;
  v_contact_owner uuid;
BEGIN
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'workspace_id required'; END IF;
  IF NOT public.is_workspace_member(v_caller, v_workspace_id) THEN
    RAISE EXCEPTION 'not a member of workspace %', v_workspace_id;
  END IF;
  IF v_contact_id IS NULL AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'contact_id or company_id required';
  END IF;

  -- Smart owner fallback: contact owner → company owner → caller
  IF v_owner_id IS NULL AND v_contact_id IS NOT NULL THEN
    SELECT owner_id INTO v_contact_owner FROM public.contacts WHERE id = v_contact_id;
    v_owner_id := v_contact_owner;
  END IF;
  IF v_owner_id IS NULL AND v_company_id IS NOT NULL THEN
    SELECT owner_id INTO v_company_owner FROM public.companies WHERE id = v_company_id;
    v_owner_id := v_company_owner;
  END IF;
  IF v_owner_id IS NULL THEN v_owner_id := v_caller; END IF;

  -- Pipeline default
  IF v_pipeline_id IS NULL THEN
    SELECT default_pipeline_id INTO v_default_pipeline FROM public.crm_settings WHERE workspace_id = v_workspace_id;
    IF v_default_pipeline IS NULL THEN
      v_default_pipeline := public.ensure_crm_pipeline(v_workspace_id);
    END IF;
    v_pipeline_id := v_default_pipeline;
  END IF;
  IF v_stage_id IS NULL THEN
    SELECT id INTO v_stage_id FROM public.pipeline_stages
      WHERE pipeline_id = v_pipeline_id AND is_active IS NOT FALSE
      ORDER BY display_order ASC LIMIT 1;
  END IF;

  -- Dedupe (skip if force_new)
  IF NOT v_force_new THEN
    IF v_contact_id IS NOT NULL AND v_thread_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id AND source_thread_id = v_thread_id
        LIMIT 1;
    END IF;
    IF v_existing IS NULL AND v_contact_id IS NOT NULL AND v_campaign_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id AND source_campaign_id = v_campaign_id
          AND status NOT IN ('won','lost','not_fit','bad_timing')
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_existing IS NULL AND v_contact_id IS NOT NULL THEN
      SELECT id INTO v_existing FROM public.opportunities
        WHERE workspace_id = v_workspace_id AND contact_id = v_contact_id
          AND status NOT IN ('won','lost','not_fit','bad_timing')
          AND created_at > now() - interval '30 days'
        ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;

  IF v_existing IS NOT NULL THEN
    v_opp_id := v_existing;
    UPDATE public.opportunities SET
      status = v_status,
      priority = v_priority,
      owner_id = COALESCE(v_owner_id, owner_id),
      stage_id = COALESCE(v_stage_id, stage_id),
      last_activity_at = now()
    WHERE id = v_opp_id;
  ELSE
    INSERT INTO public.opportunities (
      workspace_id, owner_id, contact_id, company_id,
      pipeline_id, stage_id, status, priority, source_channel,
      source_campaign_type, source_campaign_id, source_thread_type, source_thread_id, source_message_id,
      title, created_by, last_activity_at
    ) VALUES (
      v_workspace_id, v_owner_id, v_contact_id, v_company_id,
      v_pipeline_id, v_stage_id, v_status, v_priority, v_source,
      v_campaign_typ, v_campaign_id, v_thread_type, v_thread_id, v_message_id,
      v_title, v_caller, now()
    ) RETURNING id INTO v_opp_id;
    v_created := true;

    IF v_contact_id IS NOT NULL THEN
      INSERT INTO public.opportunity_contacts (workspace_id, opportunity_id, contact_id, is_primary, added_by)
      VALUES (v_workspace_id, v_opp_id, v_contact_id, true, v_caller)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Status history
  INSERT INTO public.opportunity_status_history
    (workspace_id, opportunity_id, to_status, to_stage_id, reason, changed_by)
  VALUES (v_workspace_id, v_opp_id, v_status, v_stage_id, CASE WHEN v_created THEN 'created' ELSE 'updated' END, v_caller);

  -- Note
  IF v_note IS NOT NULL AND length(v_note) > 0 THEN
    INSERT INTO public.opportunity_notes (workspace_id, opportunity_id, author_id, body)
    VALUES (v_workspace_id, v_opp_id, v_caller, v_note);
  END IF;

  -- Task
  IF v_task_title IS NOT NULL THEN
    BEGIN
      INSERT INTO public.tasks (workspace_id, title, due_at, assigned_to, contact_id, company_id, created_by, status)
      VALUES (v_workspace_id, v_task_title, v_task_due, v_owner_id, v_contact_id, v_company_id, v_caller, 'pending');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Optional deal
  IF v_create_deal THEN
    INSERT INTO public.deals (workspace_id, name, amount, contact_id, company_id, owner_id, pipeline_id, stage_id, created_by, source)
    VALUES (v_workspace_id, COALESCE(v_deal_name, COALESCE(v_title,'New Opportunity')), v_deal_value, v_contact_id, v_company_id, v_owner_id, v_pipeline_id, v_stage_id, v_caller, 'crm_push')
    RETURNING id INTO v_deal_id;
    UPDATE public.opportunities SET deal_id = v_deal_id WHERE id = v_opp_id;
  END IF;

  -- Activity
  BEGIN
    PERFORM public.log_activity(
      v_workspace_id,
      'note_added'::public.activity_type,
      CASE WHEN v_created THEN 'Opportunity created' ELSE 'Opportunity updated' END,
      v_contact_id, v_company_id, v_deal_id,
      'opportunity', v_opp_id,
      COALESCE(v_note, 'Pushed to CRM'),
      jsonb_build_object('opportunity_id', v_opp_id, 'source_channel', v_source, 'status', v_status),
      v_caller
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('opportunity_id', v_opp_id, 'created', v_created, 'deal_id', v_deal_id);
END $$;

GRANT EXECUTE ON FUNCTION public.push_to_crm(jsonb) TO authenticated;

-- 10. transition_opportunity RPC ------------------------------
CREATE OR REPLACE FUNCTION public.transition_opportunity(
  _opportunity_id uuid,
  _new_stage_id uuid DEFAULT NULL,
  _new_status public.opportunity_status DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace_id uuid;
  v_from_status public.opportunity_status;
  v_from_stage uuid;
BEGIN
  SELECT workspace_id, status, stage_id INTO v_workspace_id, v_from_status, v_from_stage
    FROM public.opportunities WHERE id = _opportunity_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'opportunity not found'; END IF;
  IF NOT public.is_workspace_member(auth.uid(), v_workspace_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  UPDATE public.opportunities SET
    stage_id = COALESCE(_new_stage_id, stage_id),
    status   = COALESCE(_new_status,   status),
    last_activity_at = now(),
    closed_at = CASE WHEN COALESCE(_new_status, status) IN ('won','lost','not_fit','bad_timing') AND closed_at IS NULL THEN now() ELSE closed_at END,
    close_reason = CASE WHEN COALESCE(_new_status, status) IN ('won','lost','not_fit','bad_timing') THEN COALESCE(_reason, close_reason) ELSE close_reason END
  WHERE id = _opportunity_id;

  INSERT INTO public.opportunity_status_history
    (workspace_id, opportunity_id, from_status, to_status, from_stage_id, to_stage_id, reason, changed_by)
  VALUES (v_workspace_id, _opportunity_id, v_from_status, COALESCE(_new_status, v_from_status), v_from_stage, COALESCE(_new_stage_id, v_from_stage), _reason, auth.uid());
END $$;
GRANT EXECUTE ON FUNCTION public.transition_opportunity(uuid, uuid, public.opportunity_status, text) TO authenticated;

-- 11. assign_opportunity RPC ----------------------------------
CREATE OR REPLACE FUNCTION public.assign_opportunity(_opportunity_id uuid, _owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.opportunities WHERE id = _opportunity_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'opportunity not found'; END IF;
  IF NOT public.is_workspace_member(auth.uid(), v_workspace_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;
  IF _owner_id IS NOT NULL AND NOT public.is_workspace_member(_owner_id, v_workspace_id) THEN
    RAISE EXCEPTION 'new owner is not a workspace member';
  END IF;
  UPDATE public.opportunities SET owner_id = _owner_id, last_activity_at = now() WHERE id = _opportunity_id;
END $$;
GRANT EXECUTE ON FUNCTION public.assign_opportunity(uuid, uuid) TO authenticated;
