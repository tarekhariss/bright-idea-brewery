UPDATE public.verification_results
   SET verified_at = NULL,
       processing_started_at = NULL,
       last_attempt_at = NULL,
       error_message = NULL,
       dead_letter = false,
       from_cache = false
 WHERE job_id = 'b052fb43-0faa-486a-837a-d3b66d7e844d';

UPDATE public.verification_jobs
   SET status = 'pending',
       processed_count = 0,
       valid_count = 0,
       invalid_count = 0,
       risky_count = 0,
       unknown_count = 0,
       started_at = NULL,
       completed_at = NULL,
       updated_at = now()
 WHERE id = 'b052fb43-0faa-486a-837a-d3b66d7e844d';