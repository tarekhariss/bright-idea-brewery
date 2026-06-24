CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_status_rownum
  ON public.import_job_rows (import_job_id, row_number)
  WHERE status = 'pending';