DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_job_rows_import_job_id_row_number_key'
      AND conrelid = 'public.import_job_rows'::regclass
  ) THEN
    ALTER TABLE public.import_job_rows
      ADD CONSTRAINT import_job_rows_import_job_id_row_number_key UNIQUE (import_job_id, row_number);
  END IF;
END $$;