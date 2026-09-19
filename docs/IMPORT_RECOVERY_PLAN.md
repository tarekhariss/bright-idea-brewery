# Sprint 0F — Import Enrichment Bug: Blast Radius & Recovery Plan

**Status:** analysis complete from source and git; **row-level quantification requires the live database.**
**Nothing has been replayed.** This document ends at a plan awaiting approval.

---

## 1. The bug

```js
// supabase/functions/run-import-job/index.ts — enrichment pass
const { data, error } = await supabase.rpc("enrich_contact_from_import", {
  p_contact_id: req.contactId,
  p_workspace_id: job.workspace_id,
  p_actor: userId,
  p_import_job_id: jobId,        // ← not in scope. The variable is job_id.
  ...
});
```

`jobId` is declared nowhere in that scope — it is a parameter of a *different* function (`updateRowStatuses`, line 442). In Deno, referencing an undeclared identifier throws `ReferenceError` while evaluating the argument object, **before the RPC is ever called**.

The call sits inside a `try`, and the catch does this:

```js
} catch (e: any) {
  req.rowUpdate.status = "error";
  req.rowUpdate.error_message = `enrich_exception: ${e?.message ?? String(e)}`;
}
```

So the error was **swallowed**, the row marked `error`, and the import continued. No alert, no failed job — just a quietly rising error count.

## 2. Timeline — established from git

| Event | Commit | Date | Evidence |
|---|---|---|---|
| Bug introduced | `d4bb7c5` "Changes" | **2026-06-27 10:14 UTC** | `git log -S"p_import_job_id: jobId"` |
| Bug fixed | `2da99a7` | **2026-09-18 12:36 +03:00** | Same search |
| **Duration live** | | **83 days (11.9 weeks)** | |
| Intervening changes to the file | **None** | | No commits touched `run-import-job` between those dates |

The fix is **on the unmerged branch only**. On `main` the bug is **still live today**.

## 3. What was actually lost

`enrich` is the **default import mode** (`settings.import_mode` defaults to `'enrich'`). The affected path is the one taken when an imported row **matches a contact you already have**.

**Not affected:**
- New contacts — `create_new` does not touch this code path
- Duplicate detection itself — matching ran correctly; only the enrichment call failed
- Contact data already in the database — nothing was overwritten or deleted

**Affected:** every duplicate row that should have **filled in missing fields** on an existing contact. For 83 days, re-importing a list to enrich existing records did nothing except mark rows as errors.

**Secondary effects:**
1. `error_rows` inflated on every affected job — import success rates looked worse than reality
2. `contact_field_history` has **no rows** from these attempts, so the history is silent about them too
3. Rows in `review`/`conflict` states were not reached, so genuine conflicts went unrecorded

## 4. Quantification queries

These are in `docs/phase0_production_checks.sql` §10. Reproduced here for the recovery decision.

```sql
-- 4.1 Total blast radius
select count(*)                        as affected_rows,
       count(distinct import_job_id)   as affected_jobs,
       min(created_at)                 as first_occurrence,
       max(created_at)                 as last_occurrence
from public.import_job_rows
where error_message like 'enrich_exception%';
```

```sql
-- 4.2 Per job, with workspace attribution
select j.id, j.workspace_id, j.file_name, j.created_at,
       j.total_rows, j.error_rows, j.success_rows,
       count(r.id) as enrich_exception_rows
from public.import_jobs j
join public.import_job_rows r on r.import_job_id = j.id
where r.error_message like 'enrich_exception%'
group by j.id, j.workspace_id, j.file_name, j.created_at,
         j.total_rows, j.error_rows, j.success_rows
order by enrich_exception_rows desc;
```

```sql
-- 4.3 Per workspace — who is affected
select w.name as workspace, count(r.id) as affected_rows,
       count(distinct j.id) as affected_jobs
from public.import_job_rows r
join public.import_jobs j on j.id = r.import_job_id
join public.workspaces w on w.id = j.workspace_id
where r.error_message like 'enrich_exception%'
group by w.name order by 2 desc;
```

```sql
-- 4.4 Which contacts were denied enrichment (replay targets)
select distinct r.contact_id, c.email, c.first_name, c.last_name,
       c.updated_at, c.last_enriched_at
from public.import_job_rows r
join public.contacts c on c.id = r.contact_id
where r.error_message like 'enrich_exception%'
  and r.contact_id is not null
limit 100;
```

```sql
-- 4.5 Confirms the bug window matches git
select date_trunc('week', r.created_at) as week, count(*)
from public.import_job_rows r
where r.error_message like 'enrich_exception%'
group by 1 order by 1;
-- Expect: first bucket ≥ week of 2026-06-27, last ≤ week of 2026-09-18
```

```sql
-- 4.6 Sanity check — is enrichment working at all now?
select action_taken, status, count(*)
from public.import_job_rows
where created_at > now() - interval '120 days'
group by 1,2 order by 3 desc;
-- 'enriched_existing' should be ~absent during the window
```

## 5. Can the affected rows be safely replayed?

**Yes in principle**, and the design supports it — but only under conditions.

### Why replay is safe by construction

- `import_job_rows.raw_data` is **retained**, so the original CSV values still exist
- `enrich_contact_from_import()` is an **additive** enrichment: it fills missing fields, records conflicts rather than overwriting, and writes `contact_field_history`
- Re-running against a contact that now has the data produces `duplicate_linked` (a no-op), not a corruption
- The system already exposes a retry path — `ImportJobDetail.tsx` sets rows back to `status: 'pending'`

### Preconditions — all must hold

1. **`2da99a7` merged to `main` and deployed.** Replaying against the unfixed function reproduces the bug.
2. **The dedup commits (`d8cd605`, `a971065`) resolved first.** Replay re-runs matching; doing it on the old blind-past-500k logic would enrich against an incomplete picture and waste the opportunity.
3. **`contact_id` still resolves.** Some target contacts may since have been merged — replay must follow `merged_into` to the survivor.
4. **Source contacts still exist.** Deleted targets should be skipped, not recreated.

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Stale CSV data overwrites newer values | **Medium** | `enrich_contact_from_import` fills *missing* fields and records conflicts rather than overwriting — verify this is true by reading the function before replay |
| Replaying into merged contacts | Medium | Resolve `merged_into` first; skip unresolvable |
| Volume triggers re-verification storm | Medium | Replay in batches; watch the verification queue |
| Replay under the old dedup logic | **High** | Precondition 2 |
| Lead quality gate rejects previously-accepted rows | Medium | Keep `lead_quality.enabled = false` during replay |

## 6. Proposed recovery sequence — **not yet approved**

```
Step 1  Run §4 queries. Quantify.                          [read-only]
Step 2  Merge + deploy 2da99a7 (the jobId fix)             [no migration]
Step 3  Complete the dedup gate (SPRINT0_FIX_VALIDATION §2)
Step 4  Merge + deploy d8cd605 + a971065
Step 5  Read enrich_contact_from_import() and confirm it is
        additive and conflict-recording, not overwriting    [read-only]
Step 6  Pick ONE small affected job. Replay it. Inspect:
          - contact_field_history rows created
          - contacts updated
          - conflicts recorded
          - zero overwrites of newer data                   [reversible]
Step 7  On success, replay remaining jobs oldest-first,
        in batches, monitoring the verification queue
Step 8  Re-run §4.1 — affected_rows should approach zero
```

**Step 6 is the real gate.** One job, fully inspected, before anything at scale.

## 7. Decision required

Three things, once §4 has run:

1. **Is replay worth it?** If the blast radius is a few thousand rows across dormant workspaces, the cheaper answer may be to re-import those source files normally rather than build a replay path.
2. **Which workspaces first?** §4.3 orders by impact. Client-facing workspaces likely take priority.
3. **Should I read `enrich_contact_from_import()` now?** It is read-only and would confirm the "additive, not overwriting" assumption that Step 5 depends on — the assumption the whole plan rests on. I have not yet read it.

## 8. Preventing recurrence

The bug survived 83 days because **a swallowed exception looked like a data-quality problem.** Three cheap changes, none of which are Sprint 0 scope but all of which belong in the observability baseline:

1. **Alert on error-class novelty.** A new distinct `error_message` prefix appearing in `import_job_rows` should page someone. `enrich_exception: jobId is not defined` is unmistakable — nobody was looking.
2. **Deno type-check in CI.** `deno check supabase/functions/**/index.ts` would have caught this as `TS2552: Cannot find name 'jobId'` before it ever deployed. It is how I found it.
3. **Do not let catch blocks convert code defects into row-level data errors** without distinguishing them. A `ReferenceError` is not a bad row.

Item 2 is the highest value per minute of work in this entire sprint.
