-- get_data_health() — collapse the Data Health page's 19 scans into 3
--
-- NOT YET APPLIED. Additive only: one new function, no schema change, no data
-- change. The page continues to work unchanged until it is switched over.
--
-- The page currently issues 19 separate `count: "exact"` queries, 13 of them
-- full scans of contacts with different `is null` predicates. An `is null` on an
-- unindexed column cannot use an index, so each one walks the whole table.
--
-- Postgres evaluates all predicates of a FILTER aggregate in a single pass, so
-- 13 contacts scans become 1, 5 companies scans become 1, and import_job_rows
-- keeps its own. Three scans instead of nineteen.
--
-- SECURITY INVOKER is deliberate: the page relies entirely on RLS for scoping
-- and passes no workspace filter. Running as invoker keeps that behaviour
-- identical. A SECURITY DEFINER version would silently widen what each user
-- sees, which is a data-isolation change disguised as a performance fix.
--
-- The predicates below mirror the page exactly, INCLUDING the absence of a
-- `merged_into is null` filter. Today's totals count merged records; adding
-- that filter here would change every number on the page while claiming to be
-- an optimisation. If those totals should exclude merged rows, that is a
-- separate, deliberate change.

create or replace function public.get_data_health(
  p_stale_before timestamptz default (now() - interval '30 days')
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'contacts', (
      select jsonb_build_object(
        'total',            count(*),
        'missing_email',    count(*) filter (where email is null),
        'missing_linkedin', count(*) filter (where linkedin_url is null),
        'missing_phone',    count(*) filter (where phone is null),
        'missing_title',    count(*) filter (where job_title is null),
        'missing_company',  count(*) filter (where company_id is null),
        'missing_owner',    count(*) filter (where owner_id is null),
        'do_not_contact',   count(*) filter (where do_not_contact),
        'quality_low',      count(*) filter (where data_quality_score < 40),
        'quality_med',      count(*) filter (where data_quality_score >= 40 and data_quality_score < 70),
        'quality_high',     count(*) filter (where data_quality_score >= 70),
        'quality_unscored', count(*) filter (where data_quality_score is null),
        'stale',            count(*) filter (where updated_at < p_stale_before)
      )
      from public.contacts
    ),
    'companies', (
      select jsonb_build_object(
        'total',            count(*),
        'missing_domain',   count(*) filter (where domain is null),
        'missing_industry', count(*) filter (where industry is null),
        'missing_country',  count(*) filter (where country is null),
        'missing_owner',    count(*) filter (where owner_id is null)
      )
      from public.companies
    ),
    'review_rows', (
      select count(*)
      from public.import_job_rows
      where review_required and status = 'review'
    )
  );
$$;

comment on function public.get_data_health is
  'Data Health page aggregate. Three table scans instead of nineteen. SECURITY INVOKER so RLS scoping is unchanged; predicates mirror the page exactly, including counting merged records.';

-- Read-only aggregate over data the caller can already see through RLS.
revoke all on function public.get_data_health(timestamptz) from public, anon;
grant execute on function public.get_data_health(timestamptz) to authenticated, service_role;
