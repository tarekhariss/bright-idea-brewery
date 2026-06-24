CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_status
  ON public.import_job_rows (import_job_id, status);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_row
  ON public.import_job_rows (import_job_id, row_number);