
CREATE OR REPLACE FUNCTION public.soft_merge_contacts(
  p_survivor_id uuid, p_loser_id uuid, p_actor uuid, p_match_rule text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace uuid;
  v_survivor  public.contacts%ROWTYPE;
  v_loser     public.contacts%ROWTYPE;
  v_field     text;
  v_s_val     text;
  v_l_val     text;
  v_fields    text[] := ARRAY[
    'first_name','last_name','email','secondary_email','tertiary_email',
    'phone','work_direct_phone','mobile_phone','corporate_phone','home_phone','other_phone',
    'job_title','seniority_level','department','linkedin_url',
    'country','city','state','company_name_raw'
  ];
  v_field_actions jsonb := '[]'::jsonb;
BEGIN
  IF p_survivor_id = p_loser_id THEN RETURN; END IF;
  SELECT * INTO v_survivor FROM public.contacts WHERE id = p_survivor_id;
  IF v_survivor.id IS NULL THEN RAISE EXCEPTION 'Survivor not found %', p_survivor_id; END IF;
  SELECT * INTO v_loser FROM public.contacts WHERE id = p_loser_id;
  IF v_loser.id IS NULL THEN RAISE EXCEPTION 'Loser not found %', p_loser_id; END IF;
  v_workspace := COALESCE(v_survivor.workspace_id, v_loser.workspace_id);

  -- If survivor had no workspace, inherit from loser so future RLS works
  IF v_survivor.workspace_id IS NULL AND v_workspace IS NOT NULL THEN
    UPDATE public.contacts SET workspace_id = v_workspace WHERE id = p_survivor_id;
  END IF;

  UPDATE public.list_contacts SET contact_id = p_survivor_id
    WHERE contact_id = p_loser_id
      AND NOT EXISTS (SELECT 1 FROM public.list_contacts lc2
        WHERE lc2.list_id = list_contacts.list_id AND lc2.contact_id = p_survivor_id);
  DELETE FROM public.list_contacts WHERE contact_id = p_loser_id;

  UPDATE public.contact_tags SET contact_id = p_survivor_id
    WHERE contact_id = p_loser_id
      AND NOT EXISTS (SELECT 1 FROM public.contact_tags ct2
        WHERE ct2.tag_id = contact_tags.tag_id AND ct2.contact_id = p_survivor_id);
  DELETE FROM public.contact_tags WHERE contact_id = p_loser_id;

  UPDATE public.activities              SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.campaign_contacts       SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.campaign_enrollments    SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.tasks                   SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.emails                  SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.calls                   SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.meetings                SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.contact_activity_log    SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.contact_outreach_history SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;

  UPDATE public.deal_contacts SET contact_id = p_survivor_id
    WHERE contact_id = p_loser_id
      AND NOT EXISTS (SELECT 1 FROM public.deal_contacts dc2
        WHERE dc2.deal_id = deal_contacts.deal_id AND dc2.contact_id = p_survivor_id);
  DELETE FROM public.deal_contacts WHERE contact_id = p_loser_id;

  UPDATE public.opportunity_contacts SET contact_id = p_survivor_id
    WHERE contact_id = p_loser_id
      AND NOT EXISTS (SELECT 1 FROM public.opportunity_contacts oc2
        WHERE oc2.opportunity_id = opportunity_contacts.opportunity_id AND oc2.contact_id = p_survivor_id);
  DELETE FROM public.opportunity_contacts WHERE contact_id = p_loser_id;

  FOREACH v_field IN ARRAY v_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_s_val, v_l_val USING v_survivor, v_loser;
    IF v_l_val IS NULL OR v_l_val = '' THEN CONTINUE; END IF;
    IF v_s_val IS NULL OR v_s_val = '' THEN
      EXECUTE format('UPDATE public.contacts SET %I = $1 WHERE id = $2', v_field)
        USING v_l_val, p_survivor_id;
      IF v_workspace IS NOT NULL THEN
        INSERT INTO public.contact_field_history(
          workspace_id, contact_id, field_name, previous_value, new_value,
          change_type, source, changed_by)
        VALUES (v_workspace, p_survivor_id, v_field, NULL, to_jsonb(v_l_val),
                'enriched_from_merge', p_match_rule, p_actor);
      END IF;
      v_field_actions := v_field_actions || jsonb_build_object(
        'field', v_field, 'action', 'filled_from_loser', 'value', v_l_val);
    ELSIF v_s_val <> v_l_val THEN
      IF v_workspace IS NOT NULL THEN
        INSERT INTO public.contact_conflicts(
          workspace_id, contact_id, field_name, existing_value, incoming_value,
          source, status)
        VALUES (v_workspace, p_survivor_id, v_field, to_jsonb(v_s_val), to_jsonb(v_l_val),
                'soft_merge:'||COALESCE(p_loser_id::text,''), 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
      v_field_actions := v_field_actions || jsonb_build_object(
        'field', v_field, 'action', 'conflict_queued',
        'kept', v_s_val, 'incoming', v_l_val);
    END IF;
  END LOOP;

  IF v_survivor.company_id IS NULL AND v_loser.company_id IS NOT NULL THEN
    UPDATE public.contacts SET company_id = v_loser.company_id WHERE id = p_survivor_id;
    v_field_actions := v_field_actions || jsonb_build_object(
      'field','company_id','action','filled_from_loser','value', v_loser.company_id::text);
  END IF;

  UPDATE public.contacts s SET
    custom_fields = COALESCE(v_loser.custom_fields,'{}'::jsonb) || COALESCE(s.custom_fields,'{}'::jsonb),
    updated_at = now()
  WHERE s.id = p_survivor_id;

  UPDATE public.contacts SET
    merged_into_contact_id = p_survivor_id,
    merged_at = now(),
    merged_by = p_actor,
    lifecycle_status = 'archived',
    updated_at = now()
  WHERE id = p_loser_id;

  IF v_workspace IS NOT NULL THEN
    INSERT INTO public.contact_merge_events(
      workspace_id, surviving_contact_id, merged_contact_id,
      match_rule, reason, field_actions, performed_by)
    VALUES (v_workspace, p_survivor_id, p_loser_id,
            p_match_rule, 'soft_dedupe', v_field_actions, p_actor);
  END IF;
END;
$function$;
