
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

  IF v_owner_id IS NULL AND v_contact_id IS NOT NULL THEN
    SELECT owner_id INTO v_contact_owner FROM public.contacts WHERE id = v_contact_id;
    v_owner_id := v_contact_owner;
  END IF;
  IF v_owner_id IS NULL AND v_company_id IS NOT NULL THEN
    SELECT owner_id INTO v_company_owner FROM public.companies WHERE id = v_company_id;
    v_owner_id := v_company_owner;
  END IF;
  IF v_owner_id IS NULL THEN v_owner_id := v_caller; END IF;

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

  INSERT INTO public.opportunity_status_history
    (workspace_id, opportunity_id, to_status, to_stage_id, reason, changed_by)
  VALUES (v_workspace_id, v_opp_id, v_status, v_stage_id, CASE WHEN v_created THEN 'created' ELSE 'updated' END, v_caller);

  IF v_note IS NOT NULL AND length(v_note) > 0 THEN
    INSERT INTO public.opportunity_notes (workspace_id, opportunity_id, author_id, body)
    VALUES (v_workspace_id, v_opp_id, v_caller, v_note);
  END IF;

  IF v_task_title IS NOT NULL THEN
    BEGIN
      INSERT INTO public.tasks (workspace_id, title, task_type, status, priority, due_date, assigned_to, owner_id, contact_id, company_id, created_by)
      VALUES (v_workspace_id, v_task_title, 'todo', 'pending', 'normal', v_task_due, v_owner_id, v_owner_id, v_contact_id, v_company_id, v_caller);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF v_create_deal THEN
    INSERT INTO public.deals (workspace_id, name, amount, contact_id, company_id, owner_id, pipeline_id, stage_id, created_by, source)
    VALUES (v_workspace_id, COALESCE(v_deal_name, COALESCE(v_title,'New Opportunity')), v_deal_value, v_contact_id, v_company_id, v_owner_id, v_pipeline_id, v_stage_id, v_caller, 'crm_push')
    RETURNING id INTO v_deal_id;
    UPDATE public.opportunities SET deal_id = v_deal_id WHERE id = v_opp_id;
  END IF;

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
