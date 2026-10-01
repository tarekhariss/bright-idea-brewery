# Sprint 0G — Performance Baseline & Exact-Count Inventory

**Principle applied:** *do not optimize blindly.* This document measures what is measurable from source and specifies exactly what must be measured against the live database before any change.

**No optimization has been applied.** The estimated-count work from `d48a7d4` covers prospect search only.

---

## 1. Exact-count inventory — complete

**92 `count: "exact"` sites across the codebase.** Classified by the table each one queries:

### Expensive — 73 sites on large tables

| Table | Sites | Why it costs |
|---|---|---|
| `contacts` | **39** | ~1.2M rows. Each is a full `COUNT(*)` over the filtered set |
| `companies` | **18** | Large |
| `import_job_rows` | 7 | Grows without bound — one row per imported row, ever |
| `verification_results` | 6 | Large |
| `list_contacts` | 3 | Large join table |

### Cheap — 19 sites on bounded tables

`lists` (2), `verification_dead_letter` (2), `crm_review_queue`, `opportunities`, `crm_bulk_push_jobs`, `mailboxes`, `linkedin_accounts`, `sending_domains`, `import_jobs`, `tasks`, `bounce_feedback` (1 each), plus 6 where the table could not be resolved statically.

**These 19 should be left alone.** A `COUNT(*)` over a few hundred mailboxes is free, and making it an estimate would render a wrong number for no gain.

**This is the key finding for targeting:** the problem is not "92 exact counts", it is **57 counts on `contacts` and `companies`**, concentrated in four files.

---

## 2. The four hot spots

### 2.1 `Dashboard.tsx` — 15 counts, lines 97–111 · **the landing page**

Fires on every session start. All 15 run in parallel via `Promise.all`, so wall-clock is the slowest — but the database executes all 15.

| # | Query | Indexable? |
|---|---|---|
| 1 | `contacts` total | No — full count |
| 2 | `companies` total | No — full count |
| 3 | `lists` total | Cheap |
| 4 | `import_jobs` total | Cheap |
| 5 | `contacts` where `data_quality_score >= 70` | Yes — `idx_contacts_data_quality_score` |
| 6 | `contacts` where `data_quality_score < 40` | Yes |
| 7 | `contacts` where `do_not_contact = true` | Yes — **partial index**, cheap |
| 8 | `contacts` where `email is null` | No index on null email |
| 9 | `contacts` where `linkedin_url is null` | Partial |
| 10 | `companies` where `domain is null` | No |
| 11 | `import_job_rows` where review | Yes |
| 12–15 | `contacts`/`companies` `created_at >= d7/d30` | Yes — `idx_contacts_created_at DESC` |

### 2.2 `DataHealth.tsx` — 19 counts, lines 54–72

Worst single page. Twelve consecutive full-table counts on `contacts`, each with a different `is null` predicate:

```js
contacts total
contacts where email is null
contacts where linkedin_url is null
contacts where phone is null
contacts where job_title is null
contacts where company_id is null
contacts where owner_id is null
contacts where do_not_contact = true
contacts where data_quality_score < 40
contacts where data_quality_score >= 40 and < 70
contacts where data_quality_score >= 70
contacts where data_quality_score is null
companies total / domain null / industry null / country null / owner_id null
import_job_rows where review
contacts where updated_at < 30d
```

**`is null` predicates on unindexed columns cannot use an index** — every one is a sequential scan of 1.2M rows. Twelve of them.

**This page is a single aggregate query wearing nineteen queries' clothing.** See §4.1.

### 2.3 `search/DataEnrichment.tsx` — 13 counts

Same pattern: coverage gaps computed as separate counts.

### 2.4 `ProspectMetricsBar.tsx` (2), `Contacts.tsx:166`, `Companies.tsx:147`

List-view totals — these fire alongside every filter change and every keystroke on those pages.

---

## 3. What must be measured live — I have not measured these

**No latency figure in this document is from your database.** The statements below are structural predictions. Run these before changing anything:

```sql
-- 3.1 Actual cost of the Dashboard's heaviest query
explain (analyze, buffers, format text)
select count(*) from public.contacts where merged_into is null;

-- 3.2 The DataHealth pattern — is null on an unindexed column
explain (analyze, buffers)
select count(*) from public.contacts where email is null;

-- 3.3 A filtered count that SHOULD use an index
explain (analyze, buffers)
select count(*) from public.contacts where data_quality_score >= 70;

-- 3.4 The list-view count with workspace scope
explain (analyze, buffers)
select count(*) from public.contacts
where workspace_id = '<a real workspace id>' and merged_into is null;

-- 3.5 Deep pagination — the other half of the problem
explain (analyze, buffers)
select id, email, first_name, last_name from public.contacts
where merged_into is null
order by updated_at desc
offset 5000 limit 25;
```

**What to read in the output:** `Seq Scan` on `contacts` means no index is helping. Compare `actual time` against `rows`. In 3.5, `Rows Removed by Filter` shows exactly how much work `OFFSET` discards.

```sql
-- 3.6 Are the indexes we think exist actually being used?
select indexrelname, relname, idx_scan as times_used,
       pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where schemaname='public' and relname in ('contacts','companies')
order by idx_scan asc;
-- idx_scan = 0 after months of uptime means the index costs writes and buys nothing
```

```sql
-- 3.7 Slowest statements overall (if pg_stat_statements is enabled)
select calls, round(mean_exec_time::numeric,1) as avg_ms,
       round(total_exec_time::numeric) as total_ms, left(query, 120) as query
from pg_stat_statements
order by total_exec_time desc limit 25;
```

§3.7 is the single most valuable query here — it reports what is *actually* slow rather than what looks slow.

---

## 4. Recommended fixes — ranked by value, none applied

### 4.1 Collapse DataHealth's 19 counts into one aggregate ★ highest value

Twelve sequential scans become one. Postgres computes all predicates in a single pass:

```sql
create or replace function public.get_data_health(p_workspace_ids uuid[])
returns json language sql stable as $$
  select json_build_object(
    'total',              count(*),
    'missing_email',      count(*) filter (where email is null),
    'missing_linkedin',   count(*) filter (where linkedin_url is null),
    'missing_phone',      count(*) filter (where phone is null),
    'missing_title',      count(*) filter (where job_title is null),
    'missing_company',    count(*) filter (where company_id is null),
    'missing_owner',      count(*) filter (where owner_id is null),
    'do_not_contact',     count(*) filter (where do_not_contact),
    'quality_low',        count(*) filter (where data_quality_score < 40),
    'quality_mid',        count(*) filter (where data_quality_score >= 40 and data_quality_score < 70),
    'quality_high',       count(*) filter (where data_quality_score >= 70),
    'quality_null',       count(*) filter (where data_quality_score is null),
    'stale_30d',          count(*) filter (where updated_at < now() - interval '30 days')
  )
  from public.contacts
  where merged_into is null and workspace_id = any(p_workspace_ids);
$$;
```

**Effect:** 12 scans → 1. Roughly a 12× reduction in database work for that page.
**Risk:** low — additive function, no schema change, frontend switches to one RPC.
**Caveat:** this is still one full scan. For a page refreshed rarely, that is acceptable. If not, §4.2.

### 4.2 Materialize the health/dashboard rollup

The schema already has `workspace_kpis`, `contact_funnel_metrics` and `admin_platform_kpis` — **the pattern exists.** Populate a rollup on a cron tick (pg_cron is already installed and running) and have the page read pre-computed rows.

**Effect:** page load becomes a single indexed row read.
**Trade-off:** numbers are as fresh as the tick. For a data-health overview, a 5-minute lag is immaterial.
**Risk:** medium — new table + cron job. **Out of Sprint 0 scope** (adds a scheduled job); propose for Sprint 3.

### 4.3 Extend estimated counts to the remaining list views

Apply the `d48a7d4` pattern to `Contacts.tsx:166`, `Companies.tsx:147` and `ProspectMetricsBar`.

**Effect:** removes a full count from every filter change and keystroke on the two highest-traffic list pages.
**Risk:** low — `format-count.ts` and its 7 tests already exist; `isEstimatedCount` plumbing is proven in prospect search.
**Caveat:** the UI must show `~`. Shipping estimates that *look* exact is worse than exact counts.

### 4.4 Keyset pagination

`OFFSET 5000` makes Postgres walk and discard 5,000 rows. Replace with a cursor on `(updated_at, id)`:

```sql
where (updated_at, id) < (:last_updated_at, :last_id)
order by updated_at desc, id desc limit 25
```

**Effect:** constant cost regardless of depth.
**Risk:** **medium — this is a UI contract change.** Page numbers stop existing; navigation becomes next/previous. Requires a product decision, not just a code change.
**Recommendation:** measure §3.5 first. If users rarely go beyond page 10, this is not urgent.

### 4.5 Do not add indexes yet

329 indexes already exist with correct trigram coverage. §3.6 will likely show **unused** indexes costing write throughput on a write-heavy import path.

**The next index change should probably be a removal, not an addition** — and only with `idx_scan` evidence.

---

## 5. Sprint 0 scope recommendation

| Item | In Sprint 0? | Why |
|---|---|---|
| Run §3 measurements | **Yes** | Blocked on database access |
| §4.1 DataHealth aggregate | **Yes** | Largest win, lowest risk, additive |
| §4.3 Estimated counts on list views | **Yes** | Pattern proven, tests exist |
| §4.2 Materialized rollups | No | Adds cron — Sprint 3 |
| §4.4 Keyset pagination | No | UI contract change — needs product input |
| §4.5 Index changes | No | Needs `idx_scan` evidence first |

**Exit criterion for 0G:** §3 measurements captured, §4.1 and §4.3 implemented with before/after numbers from the same queries. Without the before/after, we would be guessing that we improved something.
