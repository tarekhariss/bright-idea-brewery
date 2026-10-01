-- system_error_events — operational error aggregation
--
-- Additive only: one new table, one new function, no changes to existing
-- objects, no data migration.
--
-- Why a dedicated table rather than reusing an existing log:
--   system_activity_log and verification_audit_log are actor-centric audits
--   (who did what, from which IP). Machine failures have neither.
--   worker_activity_logs is verification-worker telemetry, scoped to one
--   subsystem. crm_job_runs is a per-run CRM record.
--   All four are append-per-event. This table holds one row per DISTINCT error
--   and increments it, because the signal that matters is a new error class
--   appearing — not volume. The ReferenceError that disabled import enrichment
--   ran at a steady, unremarkable rate for 83 days.

-- ============================================================
-- Table
-- ============================================================
create table if not exists public.system_error_events (
  id                uuid primary key default gen_random_uuid(),

  -- Aggregation key. Stable across occurrences of the same underlying fault;
  -- see public.error_fingerprint().
  fingerprint       text not null,

  -- Where it came from
  source            text not null,
  component         text not null,
  operation         text,
  severity          text not null default 'error',

  -- What it relates to. All nullable: a cron failure has no workspace, and a
  -- startup failure has no job. job_id/entity_id are text so non-uuid
  -- identifiers (queue keys, provider ids) do not need a second column.
  workspace_id      uuid references public.workspaces(id) on delete cascade,
  job_id            text,
  entity_id         text,

  -- What happened
  message           text not null,
  error_code        text,
  metadata          jsonb not null default '{}'::jsonb,

  -- Aggregation window
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  occurrence_count  bigint not null default 1,

  -- Lifecycle
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),

  constraint system_error_events_fingerprint_key unique (fingerprint),
  constraint system_error_events_severity_check
    check (severity in ('debug', 'info', 'warning', 'error', 'critical')),
  constraint system_error_events_occurrence_positive
    check (occurrence_count > 0)
);

comment on table public.system_error_events is
  'One row per distinct operational error. Occurrences increment rather than insert, so a new row appearing is itself the alert.';
comment on column public.system_error_events.fingerprint is
  'Stable hash of source/component/operation/error_code and the normalised message. Excludes timestamps, uuids and long digit runs.';
comment on column public.system_error_events.metadata is
  'Diagnostic fields only. Secrets are stripped before writing; never store request payloads wholesale.';

-- ============================================================
-- Indexes
-- ============================================================
create unique index if not exists idx_see_fingerprint
  on public.system_error_events (fingerprint);

create index if not exists idx_see_last_seen
  on public.system_error_events (last_seen_at desc);

-- The default operational view: unresolved, most recent first.
create index if not exists idx_see_unresolved
  on public.system_error_events (last_seen_at desc)
  where resolved_at is null;

create index if not exists idx_see_component
  on public.system_error_events (component, last_seen_at desc);

create index if not exists idx_see_severity
  on public.system_error_events (severity, last_seen_at desc);

create index if not exists idx_see_resolved_at
  on public.system_error_events (resolved_at);

create index if not exists idx_see_workspace
  on public.system_error_events (workspace_id)
  where workspace_id is not null;

-- ============================================================
-- Row Level Security
-- ============================================================
-- Infrastructure errors carry stack traces and internal identifiers. Workspace
-- members deliberately get NO read access: a tenant should not see another
-- tenant's failures, nor our internals. Platform admins only.
-- Writes happen through the service role, which bypasses RLS; there is
-- intentionally no insert/update policy for authenticated users.
alter table public.system_error_events enable row level security;

drop policy if exists see_read_platform_admin on public.system_error_events;
create policy see_read_platform_admin on public.system_error_events
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Deliberately NO update policy for authenticated.
--
-- RLS decides which ROWS a role may touch, not which COLUMNS. A broad admin
-- UPDATE would let a platform admin rewrite fingerprint, occurrence_count,
-- first_seen_at or message — corrupting the aggregation this table exists to
-- provide, and doing so without any record that it happened. Resolution goes
-- through resolve_system_error_event() below, which can only set resolved_at.

-- Table privileges are set explicitly rather than inherited from Supabase's
-- default grants, which hand ALL on public tables to anon and authenticated.
-- RLS would still gate reads, but relying on that alone leaves INSERT, UPDATE
-- and DELETE one forgotten policy away from being reachable.
revoke all on table public.system_error_events from anon, authenticated;
grant select on table public.system_error_events to authenticated;  -- narrowed further by RLS
grant all on table public.system_error_events to service_role;

-- ============================================================
-- Fingerprinting
-- ============================================================
-- Normalises away everything that would make each occurrence unique, so the
-- same fault aggregates: uuids, long digit runs, quoted literals, hex addresses
-- and ISO timestamps.
create or replace function public.error_fingerprint(
  p_source text,
  p_component text,
  p_operation text,
  p_error_code text,
  p_message text
) returns text
language sql
immutable
set search_path = public
as $$
  select md5(
    coalesce(p_source, '')    || '|' ||
    coalesce(p_component, '') || '|' ||
    coalesce(p_operation, '') || '|' ||
    coalesce(p_error_code, '') || '|' ||
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(p_message, '')),
            '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'uuid', 'g'
          ),
          '\d{4}-\d{2}-\d{2}t?[\d:.]*z?', 'ts', 'g'
        ),
        '0x[0-9a-f]+|\m\d{3,}\M', 'n', 'g'
      ),
      '''[^'']*''|"[^"]*"', 'lit', 'g'
    )
  );
$$;

-- ============================================================
-- Recording
-- ============================================================
-- Upserts on fingerprint. Recurrence reopens a resolved error, because an error
-- that happens again is not resolved.
create or replace function public.record_error_event(
  p_source text,
  p_component text,
  p_message text,
  p_operation text default null,
  p_severity text default 'error',
  p_workspace_id uuid default null,
  p_job_id text default null,
  p_entity_id text default null,
  p_error_code text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fingerprint text;
  v_severity    text;
  v_id          uuid;
begin
  -- Never let a bad severity reject the write; an unrecordable error is worse
  -- than a mislabelled one.
  v_severity := case
    when p_severity in ('debug', 'info', 'warning', 'error', 'critical') then p_severity
    else 'error'
  end;

  v_fingerprint := public.error_fingerprint(
    p_source, p_component, p_operation, p_error_code, p_message
  );

  insert into public.system_error_events as e (
    fingerprint, source, component, operation, severity,
    workspace_id, job_id, entity_id, message, error_code, metadata
  ) values (
    v_fingerprint, p_source, p_component, p_operation, v_severity,
    p_workspace_id, p_job_id, p_entity_id, p_message, p_error_code,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (fingerprint) do update
    set last_seen_at     = now(),
        occurrence_count = e.occurrence_count + 1,
        resolved_at      = null,
        severity         = excluded.severity,
        workspace_id     = coalesce(excluded.workspace_id, e.workspace_id),
        job_id           = coalesce(excluded.job_id, e.job_id),
        entity_id        = coalesce(excluded.entity_id, e.entity_id),
        metadata         = excluded.metadata
  returning e.id into v_id;

  return v_id;
end;
$$;

comment on function public.record_error_event is
  'Records an operational error, aggregating by fingerprint. Callers must never let a failure here fail the operation being reported on.';

-- Only the service role writes.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so the revoke
-- below is what actually restricts this. But revoking from PUBLIC also removes
-- it from any role without its own grant — including service_role, depending on
-- how default privileges are configured. The explicit grant afterwards is not
-- redundant: without it, every telemetry write could fail with "permission
-- denied for function", and recordErrorEvent swallows that by design (logs
-- locally, returns false). The result would be an observability system that
-- passes every test and silently records nothing in production.
revoke all on function public.record_error_event(
  text, text, text, text, text, uuid, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.record_error_event(
  text, text, text, text, text, uuid, text, text, text, jsonb
) to service_role;

-- error_fingerprint is a pure hash over its arguments — no data access, no side
-- effects — so it keeps the default grant. It is only reachable through
-- record_error_event in practice.

-- ============================================================
-- Resolution — the only mutation a platform admin may perform
-- ============================================================
-- Narrow by construction: it can set or clear resolved_at and nothing else.
-- There is no code path here that touches fingerprint, occurrence_count,
-- first_seen_at, message or metadata, so no amount of caller creativity can
-- rewrite the aggregation.
--
-- It also cannot create rows: it updates an existing id or reports not_found.
-- A privileged RPC that could insert would let an admin fabricate error
-- history, which is exactly what an audit-adjacent table must not allow.
create or replace function public.resolve_system_error_event(
  p_id uuid,
  p_resolved boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $resolve$
declare
  v_found boolean;
begin
  if not public.is_platform_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;

  update public.system_error_events
     set resolved_at = case when p_resolved then now() else null end
   where id = p_id;

  get diagnostics v_found = row_count;

  if v_found = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'resolved', p_resolved);
end;
$resolve$;

comment on function public.resolve_system_error_event is
  'Sets or clears resolved_at on one error event. The only mutation available to a platform admin; cannot alter aggregation fields and cannot create rows.';

revoke all on function public.resolve_system_error_event(uuid, boolean) from public, anon;
grant execute on function public.resolve_system_error_event(uuid, boolean) to authenticated;
-- Authorisation is enforced inside the function via is_platform_admin(), so a
-- non-admin authenticated caller gets {ok:false, reason:'not_authorised'}
-- rather than a privilege error. The grant is intentional; the check is real.
