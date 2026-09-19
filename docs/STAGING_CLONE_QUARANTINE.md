# Staging Clone Quarantine — Mandatory Pre-Use Checklist

**Purpose:** a restored production clone contains **real prospect data and real credentials**. Until every item below is verified, that clone can email real people, send real LinkedIn connection requests, and burn real API credits — from what everyone assumes is a sandbox.

**This checklist is blocking.** Do not run the dedup fixture, or any import, until §8 passes.

The verification queries are the point. A checklist that is only prose gets ticked without being checked.

---

## 0. Before restoring

| ✅ | Item |
|---|---|
| ☐ | The staging project is a **separate Supabase project**, not a schema inside production |
| ☐ | Its project ref is recorded here: `________________` (and is **not** `agpusorxpklxbjhdmqzd`) |
| ☐ | Nobody has production and staging credentials loaded in the same shell session |

**Confirm you are not connected to production before running anything else:**

```sql
select current_database(),
       current_setting('app.settings.project_ref', true) as project_ref,
       inet_server_addr() as host;
```

---

## 1. Outbound email — highest risk

A clone carries live SMTP credentials. One campaign processor tick emails real prospects.

| ✅ | Item |
|---|---|
| ☐ | Production SMTP credentials removed or replaced with unroutable values |
| ☐ | `SMTP_PASS_*` secrets **not** copied into the staging project |
| ☐ | All mailboxes disabled |
| ☐ | Email queue drained or paused |

```sql
-- Mailboxes that could still send. Expect ZERO rows.
select id, email, connection_status, provider_type
from public.mailboxes
where connection_status = 'active';

-- Neutralise them.
update public.mailboxes
set connection_status = 'disconnected',
    smtp_host = 'blackhole.invalid',
    smtp_username = 'quarantined';

-- Queued messages that would go out on the next tick. Expect ZERO.
select status, count(*) from public.message_queue
where status in ('pending','processing') group by status;

update public.message_queue set status = 'cancelled'
where status in ('pending','processing');

-- Emails not yet terminal.
select status, count(*) from public.emails
where status in ('queued','processing','draft') group by status;

update public.emails set status = 'failed',
  error_message = 'QUARANTINED: staging clone'
where status in ('queued','processing');
```

---

## 2. Campaign and sequence processors

| ✅ | Item |
|---|---|
| ☐ | All campaigns paused |
| ☐ | Sequence enrollments halted |
| ☐ | Sending windows closed |

```sql
-- Expect ZERO active campaigns.
select id, name, status from public.campaigns where status = 'active';
update public.campaigns set status = 'paused' where status = 'active';

select status, count(*) from public.sequence_enrollments
where status in ('active','paused') group by status;
update public.sequence_enrollments set status = 'stopped' where status = 'active';

-- Belt and braces: make every sending window closed.
update public.sending_windows set is_active = false where is_active = true;

-- Daily send limits to zero, so anything that slips through is refused.
update public.domain_send_limits set daily_limit = 0;
```

---

## 3. LinkedIn execution

Unipile, HeyReach and PhantomBuster act on **real LinkedIn accounts**. A stray connection request cannot be recalled and can get an account restricted.

| ✅ | Item |
|---|---|
| ☐ | All execution adapters deactivated |
| ☐ | Provider API keys removed from adapter config |
| ☐ | LinkedIn accounts deactivated |
| ☐ | Action queue drained |

```sql
-- Expect ZERO active adapters.
select id, provider, is_active,
       (config ? 'api_key') as has_api_key
from public.linkedin_execution_adapters
where is_active = true;

update public.linkedin_execution_adapters
set is_active = false, config = '{}'::jsonb;

select count(*) from public.linkedin_accounts where is_active = true;
update public.linkedin_accounts set is_active = false;

select status, count(*) from public.linkedin_action_queue
where status in ('pending','scheduled') group by status;

update public.linkedin_action_queue set status = 'failed'
where status in ('pending','scheduled');
```

---

## 4. Verification workers

The SMTP verifier makes **real connections to real mail servers** from whatever IP the worker runs on. Running it from staging risks the reputation of that IP.

| ✅ | Item |
|---|---|
| ☐ | `VERIFICATION_WORKER_SECRET` **not** copied to staging (or rotated to a staging-only value) |
| ☐ | No worker process is pointed at the staging URL |
| ☐ | Engines deactivated |
| ☐ | Verification queue drained |

```sql
select name, kind, is_active, last_heartbeat_at
from public.verification_engines;

update public.verification_engines set is_active = false;

-- Anything a worker could claim. Expect ZERO after the update.
select status, count(*) from public.verification_results
where status in ('pending','processing') group by status;

update public.verification_results set status = 'cancelled'
where status in ('pending','processing');
```

---

## 5. Cron

`pg_cron` schedules are **restored with the database**. They start firing immediately.

| ✅ | Item |
|---|---|
| ☐ | Every cron job reviewed |
| ☐ | Jobs causing outbound action disabled |
| ☐ | Decision recorded for each job |

```sql
-- Review every job before disabling; some are harmless and useful in staging.
select jobid, jobname, schedule, command, active from cron.job order by jobid;

-- Disable all, then re-enable deliberately.
update cron.job set active = false;

-- Known jobs and the expected call:
--   verification-recheck-sweeper    -> leave DISABLED (drives verification)
--   verification-intelligence-rollup-> safe to enable (read/aggregate only)
--   company dedupe loop             -> leave DISABLED until the fixture run
```

**The dedupe loop must stay disabled during fixture setup** — otherwise it merges the fixture contacts before the test observes them.

---

## 6. External credentials, webhooks and notifications

| ✅ | Item |
|---|---|
| ☐ | Lovable AI gateway key removed or replaced |
| ☐ | Any webhook target pointing at a production or third-party URL disabled |
| ☐ | Notification destinations removed |
| ☐ | Provider connections deactivated |

```sql
select id, provider_type, connection_status, last_sync_at
from public.provider_connections where connection_status = 'active';

update public.provider_connections
set connection_status = 'disconnected', token_status = 'revoked';

-- Webhook targets that would fire outward.
select * from public.linkedin_webhooks;
```

**Edge function secrets:** staging must have its **own** values. Verify in the Supabase dashboard that none of these were copied: `SMTP_PASS_*`, `VERIFICATION_WORKER_SECRET`, `CRON_SECRET`, `LOVABLE_API_KEY`, and any provider API key. **Do not paste secret values into this document.**

---

## 7. Storage and authentication

| ✅ | Item |
|---|---|
| ☐ | Storage buckets reviewed — they hold uploaded CSVs of real contacts |
| ☐ | Bucket RLS confirmed non-public |
| ☐ | Auth review: who can sign into staging |
| ☐ | Password reset emails cannot reach real users |

```sql
select id, name, public from storage.buckets;
-- Any bucket with public = true on a clone is a data leak.

select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- How many real user accounts came across?
select count(*) as auth_users from auth.users;
```

**Supabase Auth sends real password-reset and invite emails.** Disable email auth in the staging project's Auth settings, or point SMTP at a sink, before anyone touches the login page.

---

## 8. Final gate — run this and read every row

One query, every risk. **Every row must read `SAFE`.**

```sql
with checks as (
  select 'active mailboxes'        as check_name, count(*) as n from public.mailboxes where connection_status = 'active'
  union all select 'active campaigns',            count(*) from public.campaigns where status = 'active'
  union all select 'active sequence enrollments', count(*) from public.sequence_enrollments where status = 'active'
  union all select 'pending message_queue',       count(*) from public.message_queue where status in ('pending','processing')
  union all select 'queued emails',               count(*) from public.emails where status in ('queued','processing')
  union all select 'active linkedin adapters',    count(*) from public.linkedin_execution_adapters where is_active = true
  union all select 'active linkedin accounts',    count(*) from public.linkedin_accounts where is_active = true
  union all select 'pending linkedin actions',    count(*) from public.linkedin_action_queue where status in ('pending','scheduled')
  union all select 'active verification engines', count(*) from public.verification_engines where is_active = true
  union all select 'claimable verifications',     count(*) from public.verification_results where status in ('pending','processing')
  union all select 'active cron jobs',            count(*) from cron.job where active = true
  union all select 'active provider connections', count(*) from public.provider_connections where connection_status = 'active'
  union all select 'public storage buckets',      count(*) from storage.buckets where public = true
  union all select 'open sending windows',        count(*) from public.sending_windows where is_active = true
)
select check_name, n,
       case when n = 0 then 'SAFE' else 'BLOCKED — resolve before proceeding' end as verdict
from checks
order by n desc, check_name;
```

| ✅ | Item |
|---|---|
| ☐ | Every row above reads `SAFE` |
| ☐ | Output pasted into the run record below |

---

## 9. Labelling

| ✅ | Item |
|---|---|
| ☐ | Staging project renamed so the dashboard makes it obvious |
| ☐ | A marker row exists so any connected tool can tell where it is |

```sql
create table if not exists public.environment_marker (
  id boolean primary key default true,
  environment text not null,
  quarantined_at timestamptz not null default now(),
  constraint environment_marker_singleton check (id)
);

insert into public.environment_marker (environment)
values ('STAGING — QUARANTINED CLONE, NO OUTBOUND')
on conflict (id) do update
set environment = excluded.environment, quarantined_at = now();

select * from public.environment_marker;
```

The fixture generator refuses to run unless this row exists and says `STAGING`.

---

## 10. Run record

| Field | Value |
|---|---|
| Clone restored from | |
| Restored at | |
| Staging project ref | |
| Quarantine completed by | |
| Quarantine completed at | |
| §8 output all SAFE | ☐ yes |
| Contacts row count | |
| Fixture run planned for | |

---

## 11. Teardown

| ✅ | Item |
|---|---|
| ☐ | Fixture results exported before deletion |
| ☐ | Staging project **deleted**, not left dormant — a dormant clone with real contact data is a standing risk |
| ☐ | Any staging-only secrets revoked |
