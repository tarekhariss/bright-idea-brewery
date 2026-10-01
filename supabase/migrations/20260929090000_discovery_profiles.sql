-- discovery_profiles — the searchable profile pool
--
-- NOT YET APPLIED. Additive only: one new table, no changes to existing objects.
--
-- This is the layer a "search all of Saudi Arabia" screen queries. It holds
-- licensed profile data — name, title, company, location — and deliberately does
-- NOT hold email or phone. Those are resolved on demand by a waterfall call and
-- written into `contacts`, which is what turns a rented profile into an owned
-- record.
--
-- WHY IT IS SEPARATE FROM contacts
--
--   Licensing. Licensed data carries different redistribution rights from data
--   you gathered yourself. Mixing them destroys the ability to answer "may we
--   export this to a client?" — see the rights columns below.
--
--   Provenance. contacts is campaign data with verification and bounce history
--   against ~1.2M rows. This pool is tens of millions of rows nobody has
--   contacted. Same shape, completely different meaning.
--
--   Refresh. The pool is replaced wholesale from vendor drops. contacts must
--   never be overwritten by a vendor refresh.
--
-- DENORMALISATION IS DELIBERATE
--
--   company_industry and employee_count are company attributes, stored on the
--   person row. At this scale a join from 40M profiles to a company table costs
--   far more than the duplication, and industry + size are two of the four
--   filters every search uses. This table is a read-optimised search index, not
--   a normalised model.

create table if not exists public.discovery_profiles (
  id                      uuid primary key default gen_random_uuid(),

  -- Identity. linkedin_url is the join key to the waterfall and the dedup key
  -- against contacts.
  linkedin_url            text,
  normalized_linkedin_url text,
  full_name               text,
  first_name              text,
  last_name               text,

  -- Role. raw_title is what the vendor supplied; the rest is derived by
  -- lib/title-ontology so "CEO" and "Chief Executive Officer" filter alike.
  raw_title               text,
  canonical_title         text,
  seniority               text,
  seniority_rank          smallint not null default 0,
  department              text,

  -- Company, denormalised (see header)
  company_name            text,
  company_domain          text,
  company_industry        text,
  employee_count          integer,
  employee_range          text,

  -- Location. country_code is ISO-2 so filters do not depend on spelling.
  country_code            text,
  country                 text,
  region                  text,
  city                    text,

  -- Provenance and rights (spec §55). Without these the pool cannot be used
  -- safely for client-facing work.
  source                  text not null,
  source_dataset_version  text,
  license_internal_use    boolean not null default true,
  license_client_use      boolean not null default false,
  license_export_allowed  boolean not null default false,
  license_redistribution  boolean not null default false,

  -- Reveal state. Set once the waterfall has resolved this person into contacts,
  -- so the same profile is never paid for twice and the UI can show "already
  -- in your database".
  revealed_contact_id     uuid references public.contacts(id) on delete set null,
  revealed_at             timestamptz,

  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),

  constraint discovery_profiles_seniority_check check (
    seniority is null or seniority in (
      'board','founder','c_suite','vp','director','head',
      'manager','senior','mid','entry','intern','unknown'
    )
  )
);

comment on table public.discovery_profiles is
  'Licensed searchable profile pool. Holds no email or phone: those are resolved on demand and written to contacts. Kept separate from contacts for licensing, provenance and refresh reasons.';
comment on column public.discovery_profiles.seniority_rank is
  'Ordered rank from lib/title-ontology, so "VP and above" is a single comparison.';
comment on column public.discovery_profiles.license_client_use is
  'False by default. Surfacing a licensed profile to a client is redistribution under most vendor contracts.';

-- ============================================================
-- Indexes — shaped to the four filters every search uses
-- ============================================================
-- The dominant query is:
--   country_code = ? AND company_industry = ? AND employee_count BETWEEN ? AND ?
--   AND seniority_rank >= ?
--
-- country first in every composite: it is the most selective filter in this
-- product and is present in essentially every search.

create index if not exists idx_dp_country_seniority
  on public.discovery_profiles (country_code, seniority_rank desc);

create index if not exists idx_dp_country_industry_seniority
  on public.discovery_profiles (country_code, company_industry, seniority_rank desc);

create index if not exists idx_dp_country_size
  on public.discovery_profiles (country_code, employee_count);

create index if not exists idx_dp_department
  on public.discovery_profiles (country_code, department, seniority_rank desc);

-- Company rollups: "which companies in Riyadh have no CFO" needs this.
create index if not exists idx_dp_company_domain
  on public.discovery_profiles (company_domain)
  where company_domain is not null;

-- Dedup against contacts, and the waterfall join key.
create index if not exists idx_dp_normalized_linkedin
  on public.discovery_profiles (normalized_linkedin_url)
  where normalized_linkedin_url is not null;

-- Free-text fallback for names and companies. Trigram, matching the pattern
-- already used on contacts.
create index if not exists idx_dp_full_name_trgm
  on public.discovery_profiles using gin (full_name extensions.gin_trgm_ops);
create index if not exists idx_dp_company_name_trgm
  on public.discovery_profiles using gin (company_name extensions.gin_trgm_ops);
create index if not exists idx_dp_raw_title_trgm
  on public.discovery_profiles using gin (raw_title extensions.gin_trgm_ops);

-- Unrevealed profiles are the working set for a reveal queue.
create index if not exists idx_dp_unrevealed
  on public.discovery_profiles (country_code, seniority_rank desc)
  where revealed_contact_id is null;

-- ============================================================
-- Row Level Security
-- ============================================================
-- The pool is not workspace-scoped: it is a shared licensed asset, and every
-- authenticated user searches the same rows. That is the opposite of contacts
-- and is the reason this is a separate table rather than a column on it.
--
-- Read is granted to authenticated. Writes are service-role only: the pool is
-- populated by the bulk loader, never by a client.
alter table public.discovery_profiles enable row level security;

drop policy if exists dp_read_authenticated on public.discovery_profiles;
create policy dp_read_authenticated on public.discovery_profiles
  for select to authenticated
  using (true);  -- intentional: a shared pool with no tenant dimension to scope by

comment on policy dp_read_authenticated on public.discovery_profiles is
  'Deliberately unscoped. This table holds licensed third-party profiles with no email or phone and no workspace ownership, so there is no tenant boundary to enforce. Revealed contact details live in contacts, which IS workspace-scoped.';

revoke all on table public.discovery_profiles from anon, authenticated;
grant select on table public.discovery_profiles to authenticated;
grant all on table public.discovery_profiles to service_role;
