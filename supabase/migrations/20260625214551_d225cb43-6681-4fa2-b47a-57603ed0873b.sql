CREATE OR REPLACE FUNCTION public.create_import_children_atomic(p_parent_id uuid, p_total_rows integer, p_batch_size integer DEFAULT 10000)
 RETURNS TABLE(child_id uuid, batch_index integer, batch_row_start integer, batch_row_end integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent record;
  v_batch_count int;
  i int;
  v_start int;
  v_end int;
  new_id uuid;
BEGIN
  SELECT * INTO parent FROM public.import_jobs WHERE id = p_parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent import job % not found', p_parent_id;
  END IF;

  IF parent.workspace_id IS NOT NULL THEN
    IF NOT public.is_workspace_member_or_admin(auth.uid(), parent.workspace_id) THEN
      RAISE EXCEPTION 'Not authorized for workspace %', parent.workspace_id;
    END IF;
  ELSE
    IF parent.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not authorized for parent job %', p_parent_id;
    END IF;
  END IF;

  v_batch_count := GREATEST(1, CEIL(p_total_rows::numeric / p_batch_size)::int);

  IF EXISTS (SELECT 1 FROM public.import_jobs WHERE parent_job_id = p_parent_id) THEN
    RETURN QUERY
      SELECT j.id, j.batch_index, j.batch_row_start, j.batch_row_end
      FROM public.import_jobs j
      WHERE j.parent_job_id = p_parent_id
      ORDER BY j.batch_index;
    RETURN;
  END IF;

  FOR i IN 1..v_batch_count LOOP
    v_start := (i - 1) * p_batch_size + 1;
    v_end := LEAST(i * p_batch_size, p_total_rows);

    INSERT INTO public.import_jobs (
      workspace_id, created_by, file_name, status,
      total_rows, processed_rows, success_rows, inserted_rows,
      error_rows, duplicate_rows, review_rows,
      column_mapping, settings,
      parent_job_id, batch_index, batch_total, batch_row_start, batch_row_end,
      started_at,
      error_summary
    ) VALUES (
      parent.workspace_id, parent.created_by,
      coalesce(parent.file_name, 'import') || ' [batch ' || i || '/' || v_batch_count || ']',
      'pending'::import_status,
      v_end - v_start + 1, 0, 0, 0, 0, 0, 0,
      parent.column_mapping, parent.settings,
      p_parent_id, i, v_batch_count, v_start, v_end,
      now(),
      jsonb_build_object('diagnostics', jsonb_build_object(
        'phase', 'awaiting_staging',
        'total_rows', v_end - v_start + 1,
        'uploaded_rows', 0,
        'last_progress_at', now()
      ))
    )
    RETURNING id INTO new_id;

    child_id := new_id;
    batch_index := i;
    batch_row_start := v_start;
    batch_row_end := v_end;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$function$;