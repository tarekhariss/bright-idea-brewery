# Technical Debt, Performance & Security Audit

**Date:** 2026-09-19
**Context:** ~1.2M contacts in production, used daily to build client campaign audiences.
**Nothing in this document has been changed.** It is a report.

---

## 1. Performance risks at 1.2M contacts

### 1.1 Exact result counts — the dominant cost

**94 occurrences of `count: "exact"` across 24 files.** PostgREST translates this into a full `COUNT(*)` over the filtered set — a second round trip, on top of the data query.

| Page | Exact counts fired | When |
|---|---|---|
| `DataHealth.tsx` | 19 | Page load |
| `Dashboard.tsx` | 15 | Page load — the landing page |
| `search/DataEnrichment.tsx` | 13 | Page load |
| `verification/OperationsDashboardPage.tsx` | 6 | Page load |
| `search/ProspectEnrich.tsx` | 6 | Page load |
| `tools/BulkUpdatePage.tsx` | 5 | Page load |
| `ImportJobDetail.tsx` | 4 | Page load |
| `verification/ApiManagementPage.tsx` | 3 | Page load |

Opening the dashboard issues **15 full table scans** over 1.2M rows. Unlike an index scan, this cost grows linearly with the table and cannot be indexed away.

**[UNMERGED]** Prospect search was switched to `count: "estimated"` on `fix/search-correctness-and-scale` — planner estimate above a threshold, exact below. The other 94 sites are untouched.

### 1.2 Offset pagination

`use-prospect-search.ts` and the table views use `.range(from, to)` → SQL `OFFSET`. Postgres must walk and discard every skipped row. Page 200 at 25/page means scanning 5,000 rows to return 25; the cost is linear in page depth. Sorting by `updated_at DESC` helps the index but not the discard.

**Fix direction (not applied):** keyset/cursor pagination on `(updated_at, id)`.

### 1.3 Import is bounded by the browser

`ImportWizard.tsx` parses the entire CSV **client-side**, normalizes it, splits it into 10,000-row child jobs, and inserts every staged row over HTTP from the tab. The 100 MB file cap is enforced in the browser.

At 1M rows this means: the full dataset resident in browser memory, hundreds of thousands of `import_job_rows` inserts issued from a page the user must keep open, and a hard stop at 100 MB — which 1M contact rows typically exceed.

**Practical ceiling: roughly 100k–200k rows per file.** The server side would handle far more.

### 1.4 Dedup loading — **[UNMERGED]**, was severe

Until the unmerged branch, `run-import-job` preloaded **every** contact and company in scope into memory before processing a single row — paged 5,000 at a time, capped at **500,000**.

At 1.2M contacts that failed three ways simultaneously: (a) contacts beyond the 500k ceiling were invisible to dedup, so imports created duplicates of records already held; (b) 500k contact objects exceeds an edge function's memory budget; (c) the function re-invokes itself near the CPU limit, so the whole preload was repeated **every invocation**, often consuming the entire time budget before reaching any rows.

On `main` this is still live.

### 1.5 Unbounded frontend queries

26 `from("contacts")` call sites are not count queries. 45 files use `.limit()`. The gap is worth an audit — any list query without an explicit limit inherits PostgREST's default 1,000-row cap, which **silently truncates rather than erroring**.

That exact failure mode was confirmed in list filtering: `resolveListFilters` fetched `list_contacts` with no limit, so any list over 1,000 members filtered against a truncated set and produced wrong audiences with no error. **[UNMERGED]** fixed.

### 1.6 Bundle size

One chunk, **2.85 MB / 739 KB gzipped**, no code splitting, across a 167-route application. Every user downloads the LinkedIn module, the CRM, and 30 verification pages to view a contact list. Vite warns about this on every build.

### 1.7 Wide SELECTs

Prospect search selects ~50 columns per contact row — including `bio`, `skills`, `custom_fields`, `work_history` — plus an embedded companies join, for a **table view** that displays maybe 12 of them.

### 1.8 Missing indexes — none identified

329 `CREATE INDEX` statements with correct trigram GIN coverage, explicit FK indexes, sensible compound indexes and a partial index on `do_not_contact`. **Indexing is a strength, not a risk.** The performance problems are query-shape problems, not missing-index problems.

### 1.9 N+1 queries

No systematic N+1 pattern found. The codebase uses PostgREST embedded resources (`companies(...)`) rather than per-row lookups.

---

## 2. Security audit

### 2.1 Clean

| Check | Result |
|---|---|
| Secrets in frontend source | **None found** |
| Service-role key in frontend | **None** — no `SERVICE_ROLE` reference anywhere in `src/` |
| Frontend env vars | Only `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL` — all three are designed to be public and ship in the JS bundle regardless |
| SQL injection | **Low risk** — PostgREST parameterises values; Postgres functions use typed parameters |
| RLS enabled | **Yes** — 706 policies; a live check on 2026-09-18 confirmed no public table has RLS disabled |
| Anonymous access | **None** — the same live check confirmed no policy grants anything to the `anon` role |

### 2.2 ⚠ Cross-workspace access between authenticated users — **highest-priority item**

**96 tables carry at least one `TO authenticated USING (true)` policy somewhere in migration history**, including `companies`, `campaigns`, `activities`, `campaign_contacts`, `contact_activity_log`, `list_contacts` and `import_jobs`.

Such a policy grants **every logged-in user access to every workspace's rows** in that table. `contacts` itself is correctly scoped (its permissive March policies were replaced in April with `is_workspace_member_or_admin`), and a 2026-09-18 migration replaced 12 more with role-gated reads — so this is known and being worked. **Which remain live cannot be determined from migration files.**

This matters most because **there is no API layer**: the browser is a direct database client and RLS is the only boundary. It matters more still because a `the-leads-bridge-group-client-portal` repository exists — if clients are ever given logins against this database, a permissive policy becomes a client-visible data leak.

```sql
-- Run this. Every row is a table any logged-in user can read across all workspaces.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and 'authenticated' = any(roles)
  and (qual = 'true' or with_check = 'true')
order by tablename;
```

### 2.3 Edge function authentication

`supabase/config.toml` contains **only `project_id`** — no `[functions.*]` blocks. All 21 functions inherit `verify_jwt = true`. This is the safe default, but it is implicit rather than chosen, and `verification-worker-api` is designed for an external worker authenticating by shared secret. That worker must therefore also present a Supabase key. **Requires live verification** that the intended auth path actually works.

### 2.4 Single shared worker secret

All 13 verification worker actions authenticate with one `VERIFICATION_WORKER_SECRET`. No per-worker credentials, no rotation mechanism, no request signing, no IP allowlist. Compromise grants full access to claim and submit verification results. Mitigating factor: mismatches are logged with diagnostic context, and the secret value is not logged.

### 2.5 Service-role usage in edge functions

Edge functions correctly use `SUPABASE_SERVICE_ROLE_KEY` server-side, which **bypasses RLS entirely**. This is normal and necessary, but it means every function is responsible for its own authorisation. `run-import-job` scopes by `accessibleWorkspaceIds`; a systematic review of the other 20 is warranted.

### 2.6 No inbound webhook endpoints

No unauthenticated webhook receivers exist — `linkedin_webhooks` is a table, not an endpoint. Nothing to exploit, but also nothing to receive bounce or reply data from an outbound tool.

### 2.7 Storage bucket policies

A migration comment reads *"bucket already exists; ensure RLS policies on storage.objects"* — phrased as a reminder rather than an assertion. Uploaded CSVs contain full contact datasets. **Requires live verification.**

---

## 3. Dead / unused code

**Do not delete anything listed here without checking** — some may be referenced dynamically.

| Item | Evidence | Assessment |
|---|---|---|
| `src/pages/Index.tsx` | 0 references across `src/`; `/` routes to Dashboard | **Likely dead** |
| `src/pages/tools/VerificationJobDetailPage.tsx` | 0 references | **Likely dead** — `/verification/jobs/:id` uses `verification/JobDetailPage.tsx` |
| `src/pages/verification/ComingSoonPage.tsx` | 0 references | **Likely dead** — superseded by `PageShell comingSoon` |
| `src/integrations/supabase/db-types.ts` (75 KB) | 18 files import it; `types.ts` (415 KB) is the generated file used by `client.ts` | **Duplicate type system** — two parallel definitions of the same schema |
| `contact_activity_log` | 0 INSERT sites in migrations; referenced in 3 frontend files | **Half-wired** — `activities` covers the same ground |
| 35 `GenericSettings` placeholder pages | Explicit, labelled, no save actions | **Intentional, not dead.** Keep the convention |
| `AIScoringPlaceholderPage`, `CrmComingSoon` | Referenced, render placeholders | **Intentional** |
| `contacts.normalized_linkedin_url` | Generated column that evaluates to `linkedin.com` for every row | **Dead weight with a cost** — storage plus index maintenance on every write, identifies nobody |
| `bun.lock` + `bun.lockb` + `package-lock.json` | Three lockfiles | **Ambiguous** — unclear which install path is authoritative |

**No feature-flag system found.** `workspaces.intelligence_v2` is the only flag-like column.

---

## 4. Known live bugs (status by branch)

| Bug | Impact | `main` | Branch |
|---|---|---|---|
| `jobId` vs `job_id` in enrichment RPC | `ReferenceError` swallowed by catch — **all** enrichment in the default import mode failed from 27 Jun 2026 | **LIVE** | Fixed |
| List filters truncate at 1,000 members | Wrong campaign audiences, silently | **LIVE** | Fixed |
| List exclusions >~3,000 members | HTTP 414, request fails | **LIVE** | Fixed |
| Company name dedup (Inc/Ltd/LLC) | Index keyed `acme inc`, lookup asked `acme` — never matched, duplicates created | **LIVE** | Fixed |
| Company domain dedup (`www.` prefix) | Same class, on the strongest company key | **LIVE** | Fixed |
| Dedup blind past 500,000 contacts | Duplicates created against 1.2M table | **LIVE** | Fixed |
| Search breaks on commas | `Smith, John` injects a filter condition | **LIVE** | Fixed |
| `normalized_linkedin_url` generated wrong | Column unusable | **LIVE** | **LIVE** (schema unchanged) |

**The branch fixes are unvalidated against production data.** Commits 1–3 and 6 were verified with 141 tests; the dedup changes (4–5) alter how queries hit real data and need an import run against a copy of production before merge.

---

## 5. Top 10 technical risks, ranked

1. **Permissive RLS on up to 96 tables.** With no API layer, RLS is the only boundary. Unresolved, and a client portal repository exists.
2. **Six silent-corruption bugs live on `main`.** They produce wrong answers, not errors — so nobody notices. Campaign audiences built from lists over 1,000 members have been wrong.
3. **Import ceiling is the browser.** ~200k rows per file against a 1.2M-row ambition.
4. **94 exact counts** — 15 of them on the landing page, each a full scan of 1.2M rows.
5. **Verification engine status unknown.** The most valuable subsystem may not have a worker connected. Confirm `verification_engines.last_heartbeat_at`.
6. **No test coverage on `main`.** 141 tests exist only on the unmerged branch; `main` has one example test protecting ~66k lines.
7. **`run-import-job` is 1,652 lines** under a 25-second CPU budget, carrying the system's most business-critical logic.
8. **Single shared worker secret**, no rotation, no per-worker identity.
9. **No observability.** No error tracking, no APM, no alerting. Failures surface as user reports.
10. **Two sources of truth for business logic** — ~180 Postgres functions and 21 edge functions, with no stated boundary, plus a duplicate type system.

---

## 6. What should be improved first

In order, by ratio of risk reduced to effort spent:

1. **Run the RLS query in §2.2.** Ten minutes. Determines whether you have a data isolation problem.
2. **Validate and merge the six branch fixes.** They stop active data corruption.
3. **Confirm the verification engine is connected.** One query against `verification_engines` / `verification_workers`.
4. **Measure the blast radius of the enrichment bug** — `select count(*) from import_job_rows where error_message like 'enrich_exception%'`. Those rows never enriched and can be re-imported now.
5. **Finish the estimated-count rollout** to Dashboard and Data Health — the largest single latency win available.
6. **Move CSV ingestion server-side.** This is what unblocks the 1M-row ambition.
7. **Add error tracking.** You cannot operate a daily-use platform on user reports.
8. **Keyset pagination** for deep result sets.
9. **Drop or redefine `normalized_linkedin_url`.** It costs writes and identifies nobody.
10. **Build the user management UI.** Provisioning a teammate currently requires SQL.
