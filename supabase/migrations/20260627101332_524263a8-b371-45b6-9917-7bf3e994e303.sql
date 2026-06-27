
-- 1. Counters on import_jobs
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS inserted_new integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_existing integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enriched_existing integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_linked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_duplicate integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conflict_rows integer NOT NULL DEFAULT 0;

-- 2. Enrichment helper. Called per duplicate row when import_mode='enrich' or 'review'.
-- Returns jsonb summary {enriched: text[], conflicts: text[], updated: boolean}.
-- Safety: never overwrites non-empty existing fields; logs every change.
CREATE OR REPLACE FUNCTION public.enrich_contact_from_import(
  p_contact_id uuid,
  p_workspace_id uuid,
  p_actor uuid,
  p_import_job_id uuid,
  p_row_number integer,
  p_fields jsonb,
  p_contact_custom jsonb DEFAULT '{}'::jsonb,
  p_record_conflicts boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_key text;
  v_new text;
  v_old text;
  v_patch jsonb := '{}'::jsonb;
  v_enriched text[] := ARRAY[]::text[];
  v_conflicts text[] := ARRAY[]::text[];
  v_merged_custom jsonb;
  v_custom_changed boolean := false;
  v_allowed text[] := ARRAY[
    'first_name','last_name','email','secondary_email','tertiary_email','personal_email',
    'job_title','seniority_level','department','headline','bio','persona','linkedin_url',
    'twitter_url','facebook_url','github_url','photo_url','years_experience',
    'phone','work_direct_phone','mobile_phone','corporate_phone','home_phone','other_phone',
    'country','city','state','address','postal_code','timezone','company_name_raw'
  ];
BEGIN
  SELECT * INTO v_existing FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('enriched', ARRAY[]::text[], 'conflicts', ARRAY[]::text[], 'updated', false, 'error', 'contact_not_found');
  END IF;

  -- Heal NULL workspace_id from import workspace
  IF v_existing.workspace_id IS NULL AND p_workspace_id IS NOT NULL THEN
    v_patch := v_patch || jsonb_build_object('workspace_id', p_workspace_id::text);
  END IF;

  -- Walk every supplied scalar field
  FOR v_key IN SELECT jsonb_object_keys(p_fields) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN CONTINUE; END IF;
    v_new := NULLIF(btrim(COALESCE(p_fields ->> v_key, '')), '');
    IF v_new IS NULL THEN CONTINUE; END IF;

    EXECUTE format('SELECT ($1).%I::text', v_key) USING v_existing INTO v_old;
    v_old := NULLIF(btrim(COALESCE(v_old, '')), '');

    IF v_old IS NULL THEN
      -- Fill blank → enrich
      v_patch := v_patch || jsonb_build_object(v_key, v_new);
      v_enriched := v_enriched || v_key;
      INSERT INTO public.contact_field_history(
        contact_id, field_name, old_value, new_value, change_type, changed_by, source, metadata
      ) VALUES (
        p_contact_id, v_key, NULL, to_jsonb(v_new), 'enriched_from_import', p_actor, 'import',
        jsonb_build_object('import_job_id', p_import_job_id, 'row_number', p_row_number)
      );
    ELSIF lower(v_old) <> lower(v_new) THEN
      -- True conflict
      v_conflicts := v_conflicts || v_key;
      IF p_record_conflicts THEN
        INSERT INTO public.contact_conflicts(
          contact_id, workspace_id, field_name, existing_value, incoming_value,
          source, status, detected_by, metadata
        ) VALUES (
          p_contact_id, COALESCE(v_existing.workspace_id, p_workspace_id), v_key,
          to_jsonb(v_old), to_jsonb(v_new), 'import', 'pending', p_actor,
          jsonb_build_object('import_job_id', p_import_job_id, 'row_number', p_row_number)
        );
      END IF;
    END IF;
  END LOOP;

  -- Custom fields: only add keys the existing record doesn't have
  IF p_contact_custom IS NOT NULL AND jsonb_typeof(p_contact_custom) = 'object' AND p_contact_custom <> '{}'::jsonb THEN
    v_merged_custom := COALESCE(v_existing.custom_fields, '{}'::jsonb);
    FOR v_key IN SELECT jsonb_object_keys(p_contact_custom) LOOP
      IF NOT (v_merged_custom ? v_key) THEN
        v_merged_custom := v_merged_custom || jsonb_build_object(v_key, p_contact_custom -> v_key);
        v_custom_changed := true;
        INSERT INTO public.contact_field_history(
          contact_id, field_name, old_value, new_value, change_type, changed_by, source, metadata
        ) VALUES (
          p_contact_id, 'custom_fields.' || v_key, NULL, p_contact_custom -> v_key,
          'enriched_from_import', p_actor, 'import',
          jsonb_build_object('import_job_id', p_import_job_id, 'row_number', p_row_number)
        );
      END IF;
    END LOOP;
    IF v_custom_changed THEN
      v_patch := v_patch || jsonb_build_object('custom_fields', v_merged_custom);
    END IF;
  END IF;

  IF v_patch <> '{}'::jsonb THEN
    -- Apply patch via dynamic SQL constructed key-by-key to keep types intact
    DECLARE
      v_sets text := '';
      v_k text;
      v_first boolean := true;
    BEGIN
      FOR v_k IN SELECT jsonb_object_keys(v_patch) LOOP
        IF v_k = 'custom_fields' THEN
          v_sets := v_sets || CASE WHEN v_first THEN '' ELSE ', ' END ||
                    format('custom_fields = %L::jsonb', (v_patch ->> 'custom_fields'));
        ELSIF v_k = 'workspace_id' THEN
          v_sets := v_sets || CASE WHEN v_first THEN '' ELSE ', ' END ||
                    format('workspace_id = %L::uuid', (v_patch ->> 'workspace_id'));
        ELSE
          v_sets := v_sets || CASE WHEN v_first THEN '' ELSE ', ' END ||
                    format('%I = %L', v_k, (v_patch ->> v_k));
        END IF;
        v_first := false;
      END LOOP;
      IF length(v_sets) > 0 THEN
        EXECUTE 'UPDATE public.contacts SET ' || v_sets || ', updated_at = now() WHERE id = $1'
          USING p_contact_id;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'enriched', v_enriched,
    'conflicts', v_conflicts,
    'updated', v_patch <> '{}'::jsonb,
    'custom_changed', v_custom_changed
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.enrich_contact_from_import(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enrich_contact_from_import(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,boolean) FROM PUBLIC, anon, authenticated;
