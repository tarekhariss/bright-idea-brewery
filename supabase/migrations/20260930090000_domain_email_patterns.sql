-- domain_email_patterns — learned addressing convention per company domain
--
-- NOT YET APPLIED. Additive only: one new table, no changes to existing objects.
--
-- This is the asset that replaces paying per contact. Given a domain's learned
-- pattern, a person discovered anywhere (registry filing, team page, job post)
-- can be turned into a candidate address and verified — instead of bought.
--
-- The patterns are mined from `contacts`, which already carries real
-- verification outcomes across ~1.2M rows. That is a better starting corpus
-- than a vendor's, because the evidence is our own delivery history rather than
-- someone else's guess.
--
-- NOTHING HERE IS DERIVED AT QUERY TIME
--
--   The engine lives in src/lib/email-patterns.ts and runs in the miner. This
--   table stores its output. Re-deriving a pattern inside a query would mean
--   reimplementing the ontology in SQL and letting the two drift, which is
--   exactly the class of bug the title ontology was written to avoid.
--
-- WHY confidence AND observation COUNTS ARE BOTH STORED
--
--   confidence alone cannot be audited. When a generated address bounces, the
--   question is "what did we know when we generated it" — and that needs the
--   evidence counts and the reason string, not just the score.

create table if not exists public.domain_email_patterns (
  domain                  text primary key,

  -- The learned template id, e.g. 'first.last'. Null when the evidence did not
  -- support one: a domain we have looked at and failed to learn is a different
  -- and useful fact from a domain we have never looked at, which is simply absent.
  pattern                 text,

  -- 0-100, from the engine. Hard-capped when the domain is catch-all or when
  -- nothing there has ever been confirmed deliverable, so a high number here
  -- always means real verified agreement.
  confidence              smallint not null default 0,

  -- 'learned' | 'ambiguous' | 'insufficient_evidence' | 'not_applicable'
  verdict                 text not null,

  -- Audit trail. Without these, a bounce cannot be explained after the fact.
  observations            integer not null default 0,
  confirmed_observations  integer not null default 0,
  is_catch_all            boolean not null default false,
  runner_up               text,

  -- Full weighted score per candidate template, as returned by the engine.
  -- Kept as jsonb because its shape is the engine's business, not the schema's.
  distribution            jsonb,

  -- Human-readable justification. Shown next to a generated address so an
  -- operator can see why we believed it before spending a verification credit.
  reason                  text,

  -- Provenance of the mining run, so a bad run can be identified and re-mined.
  mined_at                timestamptz not null default now(),
  miner_version           text,

  constraint domain_email_patterns_confidence_range
    check (confidence between 0 and 100),
  constraint domain_email_patterns_verdict_check
    check (verdict in ('learned', 'ambiguous', 'insufficient_evidence', 'not_applicable')),
  -- A pattern without a supporting verdict, or a confident verdict without a
  -- pattern, would be a miner bug. Reject it at the boundary rather than
  -- generating addresses from an incoherent row.
  constraint domain_email_patterns_pattern_requires_verdict
    check (
      (pattern is not null and verdict in ('learned', 'ambiguous'))
      or (pattern is null and verdict in ('insufficient_evidence', 'not_applicable'))
    )
);

comment on table public.domain_email_patterns is
  'Learned per-domain email addressing conventions, mined from verified contacts. Input to candidate address generation: lets a discovered person be resolved to an address we verify ourselves instead of one we buy.';
comment on column public.domain_email_patterns.confidence is
  '0-100. Capped at 50 when no address at the domain was ever confirmed deliverable, and at 60 on a catch-all domain where acceptance proves nothing. A high value therefore always reflects verified agreement, never row volume.';
comment on column public.domain_email_patterns.pattern is
  'Null with verdict insufficient_evidence means we looked and could not learn one. An absent row means we have not looked.';
comment on column public.domain_email_patterns.distribution is
  'Weighted support per candidate template from the engine, including evidence against. The audit trail for why a generated address was chosen.';

-- ============================================================
-- Indexes
-- ============================================================
-- The dominant read is a single-domain lookup during generation, which the
-- primary key already serves. These support the operational queries: which
-- domains are worth generating against, and which need re-mining.

create index if not exists idx_dep_confident
  on public.domain_email_patterns (confidence desc)
  where pattern is not null;

create index if not exists idx_dep_verdict
  on public.domain_email_patterns (verdict);

-- Re-mining sweeps pick the stalest rows first.
create index if not exists idx_dep_mined_at
  on public.domain_email_patterns (mined_at);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Like discovery_profiles, this is a shared derived asset with no tenant
-- dimension: a domain's addressing convention is a property of that company,
-- not of a workspace. Every authenticated user reads the same rows.
--
-- Writes are service-role only. Patterns are produced by the miner from
-- verified evidence; a client must never be able to assert one, because a
-- forged high-confidence pattern would send generated mail to addresses
-- nobody verified.
alter table public.domain_email_patterns enable row level security;

drop policy if exists dep_read_authenticated on public.domain_email_patterns;
create policy dep_read_authenticated on public.domain_email_patterns
  for select to authenticated
  using (true);  -- intentional: shared derived data, no tenant dimension to scope by

comment on policy dep_read_authenticated on public.domain_email_patterns is
  'Deliberately unscoped. A company''s email convention is a property of that company and contains no personal data — only a template id such as ''first.last''. The contacts it was mined from remain workspace-scoped.';

revoke all on table public.domain_email_patterns from anon, authenticated;
grant select on table public.domain_email_patterns to authenticated;
grant all on table public.domain_email_patterns to service_role;
