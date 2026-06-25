
-- Atomic creation of all child import_jobs for a large parent import.
-- Prevents the "only 2 of 5 batches created" bug by inserting every shell
-- in a single transaction before the browser starts staging any rows.
CREATE OR REPLACE FUNCTION public.create_import_children_atomic(
  p_parent_id uuid,
  p_total_rows int,
  p_batch_size int DEFAULT 10000
)
RETURNS TABLE(child_id uuid, batch_index int, batch_row_start int, batch_row_end int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Permission gate: must be member of the workspace (or creator, for null workspace jobs)
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

  -- Idempotent: if children already exist, return them
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
      'pending'::import_job_status,
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

  -- Stamp parent with expected child count
  UPDATE public.import_jobs
  SET batch_total = v_batch_count,
      total_rows = p_total_rows
  WHERE id = p_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_import_children_atomic(uuid, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.create_import_children_atomic(uuid, int, int) TO authenticated;

-- View helper: aggregated child stats for a parent (used by UI integrity checks).
CREATE OR REPLACE FUNCTION public.get_import_parent_integrity(p_parent_id uuid)
RETURNS TABLE(
  expected_children int,
  actual_children int,
  completed_children int,
  failed_children int,
  total_rows_expected bigint,
  total_rows_staged bigint,
  total_rows_processed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT batch_total FROM public.import_jobs WHERE id = p_parent_id
  ),
  c AS (
    SELECT
      count(*)::int AS actual_children,
      count(*) FILTER (WHERE status = 'completed')::int AS completed_children,
      count(*) FILTER (WHERE status = 'failed')::int AS failed_children,
      coalesce(sum(total_rows), 0)::bigint AS total_rows_expected,
      coalesce(sum(processed_rows), 0)::bigint AS total_rows_processed
    FROM public.import_jobs
    WHERE parent_job_id = p_parent_id
  ),
  s AS (
    SELECT coalesce(count(r.id), 0)::bigint AS total_rows_staged
    FROM public.import_jobs j
    LEFT JOIN public.import_job_rows r ON r.import_job_id = j.id
    WHERE j.parent_job_id = p_parent_id
  )
  SELECT
    coalesce(p.batch_total, c.actual_children) AS expected_children,
    c.actual_children, c.completed_children, c.failed_children,
    c.total_rows_expected, s.total_rows_staged, c.total_rows_processed
  FROM p, c, s;
$$;

GRANT EXECUTE ON FUNCTION public.get_import_parent_integrity(uuid) TO authenticated;
