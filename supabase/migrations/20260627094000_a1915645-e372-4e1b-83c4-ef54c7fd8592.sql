
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

  -- Step 1: Mark loser merged FIRST so it leaves the partial unique indexes
  UPDATE public.contacts SET
    merged_into            = p_survivor_id,
    merged_into_contact_id = p_survivor_id,
    merged_at              = now(),
    merged_by              = p_actor,
    lifecycle_status       = 'archived',
    updated_at             = now()
  WHERE id = p_loser_id;

  -- Step 2: If survivor had no workspace, inherit
  IF v_survivor.workspace_id IS NULL AND v_workspace IS NOT NULL THEN
    UPDATE public.contacts SET workspace_id = v_workspace WHERE id = p_survivor_id;
  END IF;

  -- Step 3: Re-parent dependents
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

  -- Step 4: Fill blanks, log conflicts
  FOREACH v_field IN ARRAY v_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_s_val, v_l_val USING v_survivor, v_loser;
    IF v_l_val IS NULL OR v_l_val = '' THEN CONTINUE; END IF;
    IF v_s_val IS NULL OR v_s_val = '' THEN
      BEGIN
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
      EXCEPTION WHEN unique_violation THEN
        -- couldn't fill due to uniqueness; record as conflict instead
        IF v_workspace IS NOT NULL THEN
          INSERT INTO public.contact_conflicts(
            workspace_id, contact_id, field_name, existing_value, incoming_value, source, status)
          VALUES (v_workspace, p_survivor_id, v_field, to_jsonb(v_s_val), to_jsonb(v_l_val),
                  'soft_merge_unique:'||COALESCE(p_loser_id::text,''), 'pending')
          ON CONFLICT DO NOTHING;
        END IF;
      END;
    ELSIF v_s_val <> v_l_val THEN
      IF v_workspace IS NOT NULL THEN
        INSERT INTO public.contact_conflicts(
          workspace_id, contact_id, field_name, existing_value, incoming_value, source, status)
        VALUES (v_workspace, p_survivor_id, v_field, to_jsonb(v_s_val), to_jsonb(v_l_val),
                'soft_merge:'||COALESCE(p_loser_id::text,''), 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
      v_field_actions := v_field_actions || jsonb_build_object(
        'field', v_field, 'action', 'conflict_queued', 'kept', v_s_val, 'incoming', v_l_val);
    END IF;
  END LOOP;

  IF v_survivor.company_id IS NULL AND v_loser.company_id IS NOT NULL THEN
    UPDATE public.contacts SET company_id = v_loser.company_id WHERE id = p_survivor_id;
  END IF;

  UPDATE public.contacts s SET
    custom_fields = COALESCE(v_loser.custom_fields,'{}'::jsonb) || COALESCE(s.custom_fields,'{}'::jsonb),
    updated_at = now()
  WHERE s.id = p_survivor_id;

  IF v_workspace IS NOT NULL THEN
    INSERT INTO public.contact_merge_events(
      workspace_id, surviving_contact_id, merged_contact_id,
      match_rule, reason, field_actions, performed_by)
    VALUES (v_workspace, p_survivor_id, p_loser_id,
            p_match_rule, 'soft_dedupe', v_field_actions, p_actor);
  END IF;
END;
$function$;

-- Also update the chunk pickers to consider BOTH merge markers as "merged"
CREATE OR REPLACE FUNCTION public.dedupe_contacts_by_email_chunk(
  p_limit int DEFAULT 50, p_actor uuid DEFAULT NULL
) RETURNS TABLE(groups_processed int, contacts_merged int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_group record; v_winner uuid; v_loser uuid;
  v_groups int := 0; v_merged int := 0;
BEGIN
  FOR v_group IN
    SELECT normalized_email
    FROM public.contacts
    WHERE merged_into_contact_id IS NULL AND merged_into IS NULL
      AND normalized_email IS NOT NULL AND normalized_email <> ''
    GROUP BY normalized_email
    HAVING count(*) > 1
    LIMIT p_limit
  LOOP
    SELECT id INTO v_winner FROM public.contacts c
    WHERE c.normalized_email = v_group.normalized_email
      AND c.merged_into_contact_id IS NULL AND c.merged_into IS NULL
    ORDER BY
      (c.email_validity_status = 'valid')::int DESC,
      (c.workspace_id IS NOT NULL)::int DESC,
      (
        (c.first_name IS NOT NULL AND c.first_name <> '')::int +
        (c.last_name  IS NOT NULL AND c.last_name  <> '')::int +
        (c.phone      IS NOT NULL AND c.phone      <> '')::int +
        (c.job_title  IS NOT NULL AND c.job_title  <> '')::int +
        (c.linkedin_url IS NOT NULL AND c.linkedin_url <> '')::int +
        (c.company_id IS NOT NULL)::int +
        (c.country    IS NOT NULL AND c.country <> '')::int +
        (c.city       IS NOT NULL AND c.city <> '')::int
      ) DESC,
      (SELECT count(*) FROM public.list_contacts lc WHERE lc.contact_id = c.id) DESC,
      c.created_at ASC
    LIMIT 1;
    IF v_winner IS NULL THEN CONTINUE; END IF;
    FOR v_loser IN
      SELECT id FROM public.contacts
      WHERE normalized_email = v_group.normalized_email
        AND merged_into_contact_id IS NULL AND merged_into IS NULL
        AND id <> v_winner
    LOOP
      BEGIN
        PERFORM public.soft_merge_contacts(v_winner, v_loser, p_actor, 'email_exact');
        v_merged := v_merged + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'merge failed survivor=% loser=% err=%', v_winner, v_loser, SQLERRM;
      END;
    END LOOP;
    v_groups := v_groups + 1;
  END LOOP;
  RETURN QUERY SELECT v_groups, v_merged;
END;
$function$;
