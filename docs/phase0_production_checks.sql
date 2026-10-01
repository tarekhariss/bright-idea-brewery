-- Phase 0 — Production Reality Checks
-- READ ONLY. Every statement is a SELECT. Nothing is created, altered or deleted.
-- Run in the Supabase SQL editor and paste the output back.
--
-- Covers Phase 0 items 4–15. Items 1–3 (git state) are answered from the repo.
-- No secret VALUES are selected anywhere — only presence, status and timestamps.

-- ============================================================
-- 1. Real row counts for key tables (exact, may take a moment)
-- ============================================================
select 'contacts' as t, count(*) from public.contacts
union all select 'contacts_canonical', count(*) from public.contacts where merged_into is null
union all select 'companies', count(*) from public.companies
union all select 'companies_canonical', count(*) from public.companies where merged_into is null
union all select 'lists', count(*) from public.lists
union all select 'list_contacts', count(*) from public.list_contacts
union all select 'import_jobs', count(*) from public.import_jobs
union all select 'import_job_rows', count(*) from public.import_job_rows
union all select 'verification_results', count(*) from public.verification_results
union all select 'verification_cache', count(*) from public.verification_cache
union all select 'email_history', count(*) from public.email_history
union all select 'contact_field_history', count(*) from public.contact_field_history
union all select 'workspaces', count(*) from public.workspaces
union all select 'workspace_members', count(*) from public.workspace_members
order by 1;

-- ============================================================
-- 2. Email coverage and verification state (the core KPI)
-- ============================================================
select
  count(*)                                                as total_contacts,
  count(email)                                            as with_email,
  count(*) filter (where email_validity_status = 'valid')  as valid,
  count(*) filter (where email_validity_status = 'invalid') as invalid,
  count(*) filter (where email_validity_status = 'catch_all') as catch_all,
  count(*) filter (where email_validity_status = 'unknown') as unknown,
  count(*) filter (where last_verified_at is null and email is not null) as never_verified,
  count(*) filter (where last_verified_at < now() - interval '90 days') as stale_over_90d,
  count(*) filter (where do_not_contact) as do_not_contact
from public.contacts
where merged_into is null;

-- ============================================================
-- 3. VERIFICATION ENGINE HEARTBEAT  (Phase 0 item 6)
-- ============================================================
select name, kind, version, is_active, priority,
       last_heartbeat_at,
       now() - last_heartbeat_at as since_heartbeat,
       case
         when last_heartbeat_at is null then 'NEVER CONNECTED'
         when last_heartbeat_at > now() - interval '5 minutes' then 'ACTIVE'
         when last_heartbeat_at > now() - interval '1 day' then 'RECENTLY ACTIVE'
         else 'IDLE'
       end as verdict
from public.verification_engines
order by priority;

-- ============================================================
-- 4. VERIFICATION WORKERS HEARTBEAT  (Phase 0 item 7)
-- ============================================================
select * from public.verification_workers order by 1 limit 50;

-- ============================================================
-- 5. IS THE WORKER ACTUALLY PROCESSING?  (Phase 0 item 14)
-- ============================================================
select
  count(*) filter (where created_at > now() - interval '24 hours') as results_24h,
  count(*) filter (where created_at > now() - interval '7 days')   as results_7d,
  count(*) filter (where verified_at  > now() - interval '24 hours') as verified_24h,
  count(*) filter (where claimed_by_worker is not null and verified_at is null) as claimed_unfinished,
  count(*) filter (where dead_letter)                              as dead_lettered,
  max(created_at) as newest_result,
  max(verified_at) as newest_verification
from public.verification_results;

-- Queue depth: work waiting vs work done
select status, count(*), min(created_at) as oldest, max(created_at) as newest
from public.verification_results
group by status order by 2 desc;

-- ============================================================
-- 6. ACTIVE CRON JOBS  (Phase 0 items 8, 13)
-- ============================================================
select jobid, schedule, command, nodename, active
from cron.job
order by jobid;

-- Recent cron outcomes — did they actually run, and succeed?
select j.jobid, j.schedule, left(j.command, 60) as command,
       r.status, r.start_time, r.end_time, left(coalesce(r.return_message,''), 120) as message
from cron.job j
left join lateral (
  select * from cron.job_run_details d
  where d.jobid = j.jobid order by d.start_time desc limit 3
) r on true
order by j.jobid, r.start_time desc;

-- ============================================================
-- 7. LIVE RLS AUDIT  (Phase 0 item 5) — THE PRIORITY CHECK
-- ============================================================
-- 7a. Any table with RLS switched off = readable by anyone with the anon key
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 7b. Anything reachable by the anon (unauthenticated) role
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and 'anon' = any(roles)
order by tablename;

-- 7c. CROSS-WORKSPACE ACCESS: any logged-in user reads every workspace's rows
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and 'authenticated' = any(roles)
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- 7d. Summary count by table
select tablename, count(*) as permissive_policies
from pg_policies
where schemaname = 'public'
  and 'authenticated' = any(roles)
  and (qual = 'true' or with_check = 'true')
group by tablename order by 2 desc, 1;

-- ============================================================
-- 8. STORAGE RLS  (Phase 0 item 11)
-- ============================================================
select id, name, public, created_at from storage.buckets order by name;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ============================================================
-- 9. LINKEDIN ADAPTERS  (Phase 0 item 9)
-- ============================================================
-- Presence and status only — no credential values.
select id, provider, is_active, created_at, updated_at,
       (config ? 'api_key')  as has_api_key,
       (config ? 'base_url') as has_base_url,
       case when config is null or config = '{}'::jsonb then 'EMPTY' else 'POPULATED' end as config_state
from public.linkedin_execution_adapters
order by created_at desc;

select count(*) as linkedin_accounts,
       count(*) filter (where is_active) as active
from public.linkedin_accounts;

select status, count(*) from public.linkedin_action_queue group by status;

-- ============================================================
-- 10. IMPORT ENRICHMENT BUG BLAST RADIUS  (Phase 0 item 15)
-- ============================================================
-- Rows that failed because of the jobId ReferenceError.
select count(*) as enrich_exception_rows,
       min(created_at) as first_seen,
       max(created_at) as last_seen,
       count(distinct import_job_id) as jobs_affected
from public.import_job_rows
where error_message like 'enrich_exception%';

-- Is enrichment working at all? Distribution of import outcomes.
select action_taken, status, count(*)
from public.import_job_rows
group by action_taken, status
order by 3 desc limit 25;

-- Recent import jobs and their counters
select id, file_name, status, total_rows, success_rows, error_rows,
       duplicate_rows, review_rows, inserted_new, updated_existing,
       enriched_existing, duplicate_linked, conflict_rows, created_at
from public.import_jobs
order by created_at desc limit 10;

-- ============================================================
-- 11. GENERATED COLUMN DAMAGE ASSESSMENT
-- ============================================================
-- Confirms normalized_linkedin_url is useless (expect ~1 distinct value).
select count(*) as rows_with_linkedin,
       count(distinct normalized_linkedin_url) as distinct_normalized_values,
       count(distinct linkedin_url) as distinct_raw_values
from public.contacts
where linkedin_url is not null;

-- Companies whose stored domain still carries a prefix the matcher strips.
select count(*) filter (where normalized_domain like 'www.%')    as domain_with_www,
       count(*) filter (where normalized_domain like 'http%')    as domain_with_scheme,
       count(*) filter (where normalized_domain like '%/%')      as domain_with_path
from public.companies where normalized_domain is not null;

-- Companies whose name carries a legal suffix (the dedup miss).
select count(*) as companies_with_legal_suffix
from public.companies
where normalized_name ~* '\m(inc|llc|ltd|limited|corp|corporation|gmbh|plc|pty|pvt)\.?\s*$';

-- Potential duplicate companies the name mismatch would have created
select normalized_domain, count(*) as copies
from public.companies
where merged_into is null and normalized_domain is not null and normalized_domain <> ''
group by normalized_domain having count(*) > 1
order by 2 desc limit 25;

-- ============================================================
-- 12. HISTORY / PROVENANCE COVERAGE
-- ============================================================
select source, change_type, count(*)
from public.contact_field_history
group by source, change_type order by 3 desc limit 20;

select count(*) as contact_activity_log_rows from public.contact_activity_log;

select source, count(*) from public.contacts where merged_into is null
group by source order by 2 desc limit 15;

-- ============================================================
-- 13. EXTENSIONS + DB SIZE  (Phase 0 items 4, 10)
-- ============================================================
select extname, extversion from pg_extension order by extname;

select pg_size_pretty(pg_database_size(current_database())) as db_size;

select relname as table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
       n_live_tup as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 25;

-- ============================================================
-- 14. INDEX REALITY CHECK — which indexes actually exist and are used
-- ============================================================
select indexrelname as index_name, relname as table_name,
       idx_scan as times_used, pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where schemaname = 'public' and relname in ('contacts','companies','list_contacts','verification_results')
order by idx_scan asc
limit 40;   -- lowest first: unused indexes cost writes and buy nothing
