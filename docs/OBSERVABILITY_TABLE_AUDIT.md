# Observability — Existing-Table Audit and Proposal

**Sprint 0H, 2026-09-20.** Existing logging tables were evaluated before proposing a new one, as instructed. **None fit.** Nothing below has been applied.

---

## 1. The candidates

| Table | Columns | Actual semantics | Verdict |
|---|---|---|---|
| `system_activity_log` | `action`, `entity_type`, `entity_id`, `performed_by`, `ip_address`, `details`, `created_at` | **Actor-centric audit** — who did what, from which IP | **No.** Machine failures have no actor and no IP. Using it means an audit-of-humans table mostly full of rows with a null human |
| `worker_activity_logs` | `worker_id`, `host`, `event_type`, `error_message`, `cpu_pct`, `mem_mb`, `in_flight`, `throughput`, `version`, `details` | **Verification worker telemetry** — a metrics stream for one subsystem | **Partly.** Genuinely the right source for *worker offline* detection, but it is per-worker metrics, not a cross-cutting error log |
| `verification_audit_log` | `action`, `actor_id`, `target_type`, `target_id`, `ip`, `metadata`, `workspace_id` | Actor-centric audit, scoped to verification | **No.** Same mismatch, narrower scope |
| `crm_job_runs` | `job_name`, `status`, `scanned`, `queued`, `auto_pushed`, `skipped`, `errors`, `error_message`, `duration_ms`, `ran_at`, `workspace_id` | **Per-run outcome record for CRM jobs** | **No.** Closest in spirit, but CRM-specific and one row per run |

## 2. Why none of them work

The requested shape needs three properties all four lack:

1. **Aggregation.** `first_seen_at` / `last_seen_at` / `occurrence_count` mean **one row per distinct error**, not one per occurrence. All four are append-per-event. This is the property that matters most: the `jobId` bug produced a steady, unremarkable rate for 83 days. Volume was never the signal — **a new error class appearing** was.
2. **A resolution lifecycle.** `resolved_at`. None of them have any notion of an error being dealt with.
3. **A cross-cutting taxonomy.** `severity` + `component` + `operation` spanning edge functions, cron, queues and imports. Each existing table is scoped to one subsystem.

**Recommendation: a dedicated table.** Reusing an audit log for machine errors would lose the aggregation that makes the data actionable, and would corrupt the meaning of a table that currently answers "who changed this?".

---

## 3. Proposed schema — NOT APPLIED

Deliberately kept **out of `supabase/migrations/`** so nothing applies it before review. Move it there when approved.

```sql
-- One row per DISTINCT error. Occurrences increment rather than insert, so a
-- new row appearing is itself the alert.

create type public.error_severity as enum ('debug','info','warning','error','critical');

create table if not exists public.system_error_events (
  id                uuid primary key default gen_random_uuid(),

  -- Where it came from
  source            text not null,        -- 'edge_function' | 'cron' | 'queue' | 'client'
  component         text not null,        -- 'run-import-job', 'process-linkedin-queue', ...
  operation         text,                 -- 'enrich_contact', 'claim_batch', ...
  severity          public.error_severity not null default 'error',

  -- What it relates to. All nullable: a cron failure has no workspace.
  workspace_id      uuid references public.workspaces(id) on delete cascade,
  job_id            uuid,
  entity_id         uuid,

  -- What happened
  message           text not null,
  error_code        text,                 -- 'ReferenceError', 'TypeError', SQLSTATE, ...
  metadata          jsonb not null default '{}'::jsonb,

  -- Aggregation: the point of the table
  fingerprint       text not null,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  occurrence_count  integer not null default 1,

  -- Lifecycle
  resolved_at       timestamptz,
  resolved_by       uuid references auth.users(id),

  constraint system_error_events_fingerprint_key unique (fingerprint)
);

create index if not exists idx_see_last_seen  on public.system_error_events (last_seen_at desc);
create index if not exists idx_see_unresolved on public.system_error_events (last_seen_at desc) where resolved_at is null;
create index if not exists idx_see_component  on public.system_error_events (component, last_seen_at desc);
create index if not exists idx_see_workspace  on public.system_error_events (workspace_id) where workspace_id is not null;

alter table public.system_error_events enable row level security;

-- Platform admins see everything; workspace members see only their own rows.
create policy see_read_admin on public.system_error_events
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

create policy see_read_workspace on public.system_error_events
  for select to authenticated
  using (workspace_id is not null and public.is_workspace_member(auth.uid(), workspace_id));

-- Written by edge functions through the service role only. No client insert policy.
```

**No `USING (true)` anywhere** — per the RLS convention this sprint is trying to establish.

### Secrets

`metadata` must never carry credentials. The shared reporting helper strips keys matching `/key|secret|token|password|authorization|api[_-]?key/i` **before** writing. That belongs in the helper, not at each call site, so it cannot be forgotten.

---

## 4. Proposed recording function — NOT APPLIED

```sql
create or replace function public.record_error_event(
  p_source text,
  p_component text,
  p_operation text,
  p_severity public.error_severity,
  p_message text,
  p_error_code text default null,
  p_workspace_id uuid default null,
  p_job_id uuid default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fingerprint text;
  v_id uuid;
begin
  -- Normalise the message so the same error carrying different ids aggregates
  -- into one row: strip uuids and long digit runs.
  v_fingerprint := md5(
    coalesce(p_component, '') || '|' ||
    coalesce(p_operation, '') || '|' ||
    coalesce(p_error_code, '') || '|' ||
    regexp_replace(
      regexp_replace(
        coalesce(p_message, ''),
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'UUID', 'gi'
      ),
      '\d{3,}', 'N', 'g'
    )
  );

  insert into public.system_error_events as e (
    source, component, operation, severity, workspace_id, job_id, entity_id,
    message, error_code, metadata, fingerprint
  ) values (
    p_source, p_component, p_operation, p_severity, p_workspace_id, p_job_id,
    p_entity_id, p_message, p_error_code, p_metadata, v_fingerprint
  )
  on conflict (fingerprint) do update
    set last_seen_at     = now(),
        occurrence_count = e.occurrence_count + 1,
        resolved_at      = null,   -- it came back; it is not resolved
        metadata         = excluded.metadata
  returning id into v_id;

  return v_id;
end
$fn$;
```

Reopening on recurrence is deliberate: an error marked resolved that happens again is not resolved.

---

## 5. Health signals — six of seven need no new table

| Signal | Source | Condition |
|---|---|---|
| Verification worker offline | `verification_engines.last_heartbeat_at`, `verification_workers` | no heartbeat within N minutes |
| Stalled import | `import_jobs` | `status='processing'` and `updated_at < now() - interval '1 hour'` |
| Stalled export | `export_jobs` | same shape |
| Stuck LinkedIn actions | `linkedin_action_queue` | claimed or pending with `scheduled_for` well past |
| Stuck email queue | `message_queue` | pending past `scheduled_for`, or `attempts >= max_attempts` |
| Cron not executing | `cron.job_run_details` | no successful run inside the schedule window |
| **Repeated edge function errors** | **`system_error_events`** | rising `occurrence_count`, or a **new** `fingerprint` |

**Only the last requires the new table.** The other six are queries over data you already have — which is exactly why the health *view* should wait for the Phase 0 SQL output. Setting thresholds before seeing real values would be guessing at what "healthy" looks like.

---

## 6. Sequencing

1. Phase 0 SQL → real values for the six existing signals ← **blocked on you**
2. Apply `system_error_events` + `record_error_event` ← **needs approval**
3. Shared `reportError` helper in `_shared/`, with secret-stripping, adopted by edge functions
4. Health view covering all seven signals
5. Admin UI

Steps 1–3 are the minimum for Sprint 0. Step 5 is explicitly out of scope.
