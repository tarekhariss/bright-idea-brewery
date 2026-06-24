
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_index int,
  ADD COLUMN IF NOT EXISTS batch_total int,
  ADD COLUMN IF NOT EXISTS batch_row_start int,
  ADD COLUMN IF NOT EXISTS batch_row_end int;

CREATE INDEX IF NOT EXISTS idx_import_jobs_parent ON public.import_jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_import_parent_rollup(p_parent uuid)
RETURNS TABLE(
  total_batches int,
  completed_batches int,
  failed_batches int,
  processing_batches int,
  pending_batches int,
  total_rows bigint,
  processed_rows bigint,
  inserted_rows bigint,
  duplicate_rows bigint,
  error_rows bigint,
  review_rows bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*)::int                                                              AS total_batches,
    count(*) FILTER (WHERE status = 'completed')::int                          AS completed_batches,
    count(*) FILTER (WHERE status = 'failed')::int                             AS failed_batches,
    count(*) FILTER (WHERE status IN ('processing','validating','mapping'))::int AS processing_batches,
    count(*) FILTER (WHERE status = 'pending')::int                            AS pending_batches,
    COALESCE(sum(total_rows), 0)                                               AS total_rows,
    COALESCE(sum(processed_rows), 0)                                           AS processed_rows,
    COALESCE(sum(inserted_rows), 0)                                            AS inserted_rows,
    COALESCE(sum(duplicate_rows), 0)                                           AS duplicate_rows,
    COALESCE(sum(error_rows), 0)                                               AS error_rows,
    COALESCE(sum(review_rows), 0)                                              AS review_rows
  FROM public.import_jobs
  WHERE parent_job_id = p_parent;
$$;

GRANT EXECUTE ON FUNCTION public.get_import_parent_rollup(uuid) TO authenticated, service_role;
