# Error Event Retention — Policy Proposal

**Not implemented. No cron.** This documents the configuration point and the reasoning, for approval.

## The principle

An error store accumulates whatever someone put in `metadata` at 2am, is long-lived, readable by every platform admin, and nobody curates it. The sanitiser bounds what can land there, but bounded is not the same as forever.

**Three lifetimes, decided independently:**

| What | Retain | Why |
|---|---|---|
| **Diagnostic metadata** (`metadata` jsonb) | **30 days** | The only part that can carry incidental personal or business data. Its debugging value decays fast — nobody investigates last quarter's payload. |
| **Error identity** (`fingerprint`, `source`, `component`, `operation`, `severity`, `error_code`, `message`, `occurrence_count`, `first_seen_at`, `last_seen_at`) | **Indefinite while unresolved; 2 years once resolved** | This *is* the intelligence. "This fault first appeared 14 months ago and has happened 9,000 times" is the sentence that makes the table worth having, and it costs a few hundred bytes. |
| **Resolved rows** | **Purge after 2 years** | Historical only. |

## The point that matters

> **Metadata expiry must be independent of `resolved_at`.**

An unresolved error is not a licence to keep its payload forever. The `jobId` bug went unresolved for 83 days precisely because nobody looked at it — under a resolution-coupled policy, its metadata would have been retained *because* it was being ignored. That is backwards.

So: **metadata ages out on its own clock**, whether or not the error has been dealt with. The row survives; the payload does not.

## Proposed configuration

Values, not code — kept somewhere editable rather than compiled in:

```json
{
  "metadata_retention_days": 30,
  "resolved_event_retention_days": 730,
  "unresolved_event_retention_days": null,
  "purge_batch_size": 5000
}
```

`unresolved_event_retention_days: null` means never. Making that explicit and configurable is deliberate — a future decision to cap it should be a config change someone argues for, not a silent default.

`platform_settings` already exists and is the natural home. Failing that, function parameters with these defaults.

## Proposed operations — for review, not application

```sql
-- 1. Age out metadata while keeping the error identity and its counters.
--    Runs on last_seen_at, NOT resolved_at.
update public.system_error_events
   set metadata = '{}'::jsonb
 where metadata <> '{}'::jsonb
   and last_seen_at < now() - make_interval(days => :metadata_retention_days);

-- 2. Purge long-resolved rows.
delete from public.system_error_events
 where resolved_at is not null
   and resolved_at < now() - make_interval(days => :resolved_event_retention_days);
```

Both are batchable via `ctid` if the table ever grows enough to matter. It should not: one row per *distinct* error is a small number, which is the whole design.

## What is deliberately NOT proposed

- **No aggressive deletion cron.** You asked for none, and the right cadence depends on volumes nobody has measured. Daily is the obvious starting point once there is data to look at.
- **No archival tier.** Premature — the table is small by construction.
- **No metadata purge on write.** Tempting, but it would destroy the debugging window that justifies collecting metadata at all.

## Open question for you

Does 30 days match how long a real investigation stays open here? If incidents routinely take longer to get to, 30 days deletes the evidence just as someone needs it. That is a business-rhythm question rather than a technical one, and I would rather ask than pick.
