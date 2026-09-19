# Current System Audit — TLBG Prospect Intelligence

**Date:** 2026-09-19
**Audited ref:** branch `fix/search-correctness-and-scale` (6 commits ahead of `main`, working tree clean)
**Method:** static inspection of source, migrations and generated types. **No live database connection was used.**

## Reading this document

Two caveats apply throughout, and they matter:

1. **Database facts are derived from migration files and `src/integrations/supabase/types.ts`, not from the live database.** Migrations are cumulative history; a later migration may supersede an earlier one. Anything marked *requires live verification* should be confirmed with SQL before you act on it.
2. **The audited branch is ahead of `main`.** Six commits — search-filter correctness, estimated counts, the lead-quality gate, candidate-based dedup, the company domain key, and the normalizer extraction — exist here but are **not deployed**. Findings affected by this are marked **[UNMERGED]**.

Status vocabulary used: FULLY BUILT · PARTIALLY BUILT · BASIC · UI ONLY · BACKEND ONLY · MOCKED · NOT IMPLEMENTED · UNKNOWN.

---

## 1. High-level system overview

### What it is

A private, single-tenant-per-workspace **B2B prospecting and outbound platform**. It combines a contact/company database, an email verification engine, CSV ingestion at volume, list building, email and LinkedIn outbound sequencing, and a CRM layer (deals, opportunities, tasks, inbox).

It is not a public SaaS. **Signup is disabled** — `src/pages/Signup.tsx` contains only a redirect with the comment *"Signup is disabled — private platform"*, and an `allowed_emails` allowlist table plus `assert_email_allowed` / `is_email_allowed` database functions gate access. Users are provisioned, not self-served.

### Architecture

```
Browser (React SPA, Vite)
  │
  │  supabase-js → PostgREST (direct table access, RLS-enforced)
  │  supabase-js → RPC (~180 Postgres functions)
  │  fetch       → 21 Deno Edge Functions
  ▼
Supabase (self-owned, paid plan — NOT Lovable Cloud)
  ├── Postgres: ~170 tables, 3 views, ~180 functions, 49 triggers, 706 policies
  ├── pg_cron: 2 scheduled jobs
  ├── Storage: CSV originals for import/export round-tripping
  └── Auth: email/password
  ▲
  │  x-worker-secret
External SMTP verification worker  (separate repo: tarekhariss/tlbg-verifier-worker)
```

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript (strict), React Router, TanStack Query, TanStack Virtual |
| UI | Tailwind + shadcn/ui (Radix), lucide icons, recharts, sonner |
| Data access | `@supabase/supabase-js` v2 — **the browser talks to PostgREST directly**; there is no bespoke API tier |
| Backend | 21 Supabase Edge Functions (Deno) + ~180 Postgres functions |
| Database | Postgres via Supabase (own paid project) |
| Auth | Supabase Auth, email/password only |
| Build | Vite; single bundle, 2.85 MB (739 KB gzipped) |
| Testing | Vitest — **141 tests, all added on the unmerged branch.** `main` has 1 example test. |

**Architecturally the most important fact:** business logic lives in two places — Postgres functions and Edge Functions — while the frontend queries tables directly through PostgREST. There is no API layer enforcing invariants. **Row Level Security is the only thing standing between a logged-in browser and the entire dataset.** That makes the RLS findings in §12 and `TECHNICAL_DEBT.md` the highest-stakes items in this audit.

### Third-party services actually called

Only four external hosts appear in the entire backend:

| Host | Purpose | Status |
|---|---|---|
| `api.unipile.com` | LinkedIn automation | Present in code |
| `api.phantombuster.com` | LinkedIn scraping | Present in code |
| `api.heyreach.io` | LinkedIn outreach | Present in code |
| `ai.gateway.lovable.dev` | LLM calls (AI summaries, reply classification) | Present in code |

There is **no** Apollo, Instantly, ZeroBounce, Stripe, HubSpot, Salesforce, Slack or Clearbit API integration. See `INTEGRATIONS_AUDIT.md` for the evidence, including why those names appear in the codebase without being integrations.

---

## 2. Frontend audit

**167 routes** declared in `src/App.tsx`. 121 page components under `src/pages/`. 23 component directories. 39 hooks.

### Route families

| Family | Routes | Assessment |
|---|---|---|
| Records (contacts, companies, lists, imports) | ~14 | **FULLY BUILT** — the mature core |
| Search / prospecting | 6 | **FULLY BUILT** |
| Verification | 30 | **PARTIALLY BUILT** — deepest subsystem; engine adapter may be unconfigured |
| Engage (email campaigns, sequences, inbox) | 13 | **PARTIALLY BUILT** |
| LinkedIn | 12 | **PARTIALLY BUILT** |
| CRM | 16 | **PARTIALLY BUILT** |
| Deals | 4 | **BASIC** |
| Tools | 8 | **PARTIALLY BUILT** |
| Settings | 54 | **35 are explicit placeholders** |
| Admin | 3 | **BASIC** |
| Auth | 4 | **FULLY BUILT** (signup deliberately disabled) |

### Settings — quantified

`src/pages/settings/SettingsPages.tsx` defines a `GenericSettings` component and uses it **35 times**. Its own docstring is candid:

> *"honest placeholder for Settings pages that are visible in navigation but not yet wired to a real backend… exposes no fake save buttons."*

Each renders a "not active yet" empty state with no save actions. **This is good practice, not deception** — but it means roughly two-thirds of the Settings tree is navigation scaffolding. Real settings pages: Profile, Provider Connections, Deliverability (7 sub-pages), Field Mappings, Imports/Exports, Custom Fields, Pipeline Stages, Global Picklists, Goals, System Activity Log.

### Key pages verified as genuinely functional

| Page | Route | Backend | Status |
|---|---|---|---|
| Dashboard | `/` | 15 real aggregate queries over `contacts`, `companies`, `lists`, `import_jobs` | **FULLY BUILT** (perf risk — §27) |
| Contacts | `/contacts` | `contacts` + embedded `companies` | **FULLY BUILT** |
| Contact Detail | `/contacts/:id` | `contacts`, activity, lists, history | **FULLY BUILT** |
| Companies | `/companies` | `companies` | **FULLY BUILT** |
| Prospect Search | `/search/prospect` | `use-prospect-search` — server-side filters, pagination, sorting | **FULLY BUILT** |
| Lists / List Detail | `/lists`, `/lists/:id` | `lists`, `list_contacts` | **FULLY BUILT** |
| Import Wizard | `/imports/new` | CSV → `import_job_rows` → `run-import-job` | **FULLY BUILT** |
| Import Job Detail | `/imports/:id` | `import_jobs`, `import_job_rows` | **FULLY BUILT** |
| Data Health | `/data-health` | 19 real aggregate queries | **FULLY BUILT** (perf risk) |
| Export | dialog + `/tools/exports` | `export_jobs` → `run-export-job` | **FULLY BUILT** |
| Verification Jobs | `/verification/jobs` | `verification_jobs`, `verification_results` | **PARTIALLY BUILT** |
| Admin Dashboard | `/admin` | cross-workspace KPI rollups | **BASIC** |
| Login / Reset | `/login`, `/reset-password` | Supabase Auth | **FULLY BUILT** |
| Signup | `/signup` | — | **Intentionally disabled** |

**No mock data was found anywhere in `src/`.** Searches for `mockData`, `MOCK_`, `fakeData`, `dummyData`, `sampleData`, `hardcoded` returned zero matches. Every dashboard number traced back to a real query. This is unusual and to the codebase's credit.

---

## 3. Contact system — **FULLY BUILT**

### Schema

`public.contacts` — **85 columns**. Primary key `id uuid`. Foreign keys: `workspace_id → workspaces`, `company_id → companies` (ON DELETE SET NULL), `owner_id`/`created_by`/`merged_by → auth.users`, `merged_into_contact_id → contacts` (self-reference).

Columns by purpose:

- **Identity:** `first_name`, `last_name`, `email`, `secondary_email`, `tertiary_email`, `personal_email`, `linkedin_url`, `external_contact_id`
- **Generated/normalized:** `normalized_email`, `normalized_name`, `normalized_linkedin_url`, `email_normalized` — see the warning in `DATABASE_AUDIT.md`
- **Role:** `job_title`, `seniority_level`, `department`, `headline`, `persona`, `years_experience`, `current_role_start_date`
- **Company link:** `company_id`, `company_name_raw`
- **Phones (6):** `phone`, `work_direct_phone`, `mobile_phone`, `corporate_phone`, `home_phone`, `other_phone` + `phone_status`
- **Location:** `country`, `city`, `state`, `address`, `postal_code`, `timezone`
- **Verification (12):** `email_validity_status`, `email_canonical_status`, `email_confidence`, `email_is_catch_all`, `email_is_disposable`, `email_is_free_email`, `email_is_role_based`, `email_is_syntax_invalid`, `email_is_mx_missing`, `email_is_temporary_failure`, `email_status_source`, `email_status_verified_at`, `email_status_updated_at`, `last_verified_at`
- **Provenance (8):** `source`, `source_file`, `import_tag`, `external_source`, `primary_email_source`, `secondary_email_source`, `tertiary_email_source`, `enrichment_source`
- **Freshness:** `updated_at`, `last_verified_at`, `last_enriched_at`, `last_contacted_at`
- **Merge:** `merged_into`, `merged_into_contact_id`, `merged_at`, `merged_by`
- **Scoring:** `data_quality_score`, `email_confidence`
- **Lifecycle:** `lifecycle_status`, `outreach_status`, `do_not_contact`
- **Rich/JSON:** `enrichment_data`, `custom_fields`, `work_history`, `education`, `skills[]`, `languages[]`, `notes`

### Capabilities

| Capability | Status | Notes |
|---|---|---|
| Search (name/email/company) | **FULLY BUILT** | Server-side, trigram-indexed ILIKE |
| Advanced filtering | **FULLY BUILT** | Nested AND/OR groups, 17 operators, include/exclude |
| Sorting | **FULLY BUILT** | Server-side, indexed on `updated_at`/`created_at` |
| Pagination | **PARTIALLY BUILT** | Offset-based (`.range()`) — degrades on deep pages |
| Detail page | **FULLY BUILT** | |
| Bulk selection | **FULLY BUILT** | Includes "select all matching" mode |
| Bulk actions | **FULLY BUILT** | `BulkActionsBar.tsx`, `/tools/bulk-update` |
| Create / edit | **FULLY BUILT** | |
| Delete | **FULLY BUILT** | RLS-restricted to admin/manager |
| Soft merge (archive) | **FULLY BUILT** | `merged_into` — canonical records preserved |
| Notes | **BASIC** | Free-text `notes` column, not threaded |
| Tags | **BACKEND ONLY** | `tags` + `contact_tags` tables exist; minimal UI |
| List membership | **FULLY BUILT** | |
| Import history | **FULLY BUILT** | `import_tag`, `source_file`, `import_job_id` in field history |
| Export history | **FULLY BUILT** | `export_jobs` |
| Field-level history | **FULLY BUILT** | `contact_field_history` — see §20 |
| Activity history | **PARTIALLY BUILT** | See §20 |

---

## 4. Company system — **separate, properly normalized entity**

`public.companies` — **66 columns**, own primary key, referenced by `contacts.company_id`. Not embedded, not partial.

Fields present: `name`, `domain`, `normalized_domain`, `normalized_name`, `website`, `industry`, `employee_count`, `employee_count_by_department`, `employee_range`, `revenue_range`, `annual_revenue`, `total_funding`, `latest_funding`, `latest_funding_amount`, `last_raised_at`, `funding_stage`, `founded_year`, `company_type`, `headquarters`, full address block, `company_linkedin_url`, `twitter_url`, `facebook_url`, `technologies[]`, `keywords[]`, `specialties[]`, `market_segments[]`, `territories[]`, `sic_code`, `naics_code`, `stock_ticker`, `headcount_growth_pct`, `retail_location_count`, `parent_company_id` (self-reference — corporate hierarchy), `signals`, `news_summary`, `logo_url`, `data_quality_score`, `last_verified_at`, `last_enriched_at`, merge columns.

Companies have their own list page, detail page, search, filters, and a dedicated dedup path (`dedupe_companies_by_domain`, `run-company-dedupe`). **Domain-first identity** is the design, which is correct.

Company enrichment *fields* are comprehensive; company enrichment *logic* is not implemented (§17).

---

## 6. CSV import system — **FULLY BUILT, with a client-side ceiling**

### Pipeline

```
Browser: file picked → parsed client-side → column mapping (auto-suggested)
  → 20-row preview → split into 10,000-row child jobs
  → original CSV uploaded to Storage
  → rows inserted into import_job_rows in UPLOAD_BATCH_SIZE chunks
Edge:   run-import-job → 250 rows/batch, max 4 batches per invocation,
        25s wall-clock cap, self-reinvokes until done
  → normalize → dedup → classify → insert/enrich → update row statuses
  → finalize_import_parent → company dedupe post-pass
```

| Aspect | Finding |
|---|---|
| File types | **CSV only.** `accept=".csv"`, extension check rejects everything else. `xlsx` is a dependency but used for export, not import. |
| Max file size | **100 MB**, enforced client-side (`ImportWizard.tsx:145`) |
| Column mapping | **FULLY BUILT** — auto-suggestion via alias dictionary in `csv-utils.ts` (including Apollo/vendor header aliases), manual override, column exclusion |
| Preview | **FULLY BUILT** — first 20 rows, normalized |
| Validation | **FULLY BUILT** — per-field type validation, `isEmptyLike` null-marker handling, invalid-value capture |
| Dedup on import | **FULLY BUILT** — see §9 |
| Update existing | **FULLY BUILT** — `enrich` mode is the default |
| Error handling | **FULLY BUILT** — per-row status, error messages, `import_quarantine_rows`, `repair-import-staging`, `import-watchdog` |
| Background processing | **FULLY BUILT** — self-continuing edge function |
| Batch size | 10,000 rows per child job; 250 rows per processing batch |
| Progress tracking | **FULLY BUILT** — 12 counters on `import_jobs` |
| Import history | **FULLY BUILT** |
| Failure recovery | **FULLY BUILT** — resume from counters, retry sub-batches, watchdog |

### Is it safe for very large datasets?

**Partially.** The server side is well engineered — batching, self-continuation, CPU-budget awareness, watchdog recovery, parent/child job splitting. That part would handle a million rows.

The **client side is the ceiling**. The browser parses the entire CSV into memory, normalizes it, splits it, and inserts every staged row over HTTP from the tab. For a 1M-row file that means the whole dataset resident in browser memory and hundreds of thousands of rows uploaded from a page the user must not close. The 100 MB cap is the de-facto limit, and 1M contact rows will typically exceed it.

**Practical verdict:** comfortable to roughly 100k–200k rows per file. Beyond that, split files manually. A server-side ingestion path (upload to Storage, parse in a worker) is the missing piece — listed in §31 ADD.

**[UNMERGED]** The dedup step inside `run-import-job` had a hard 500,000-row ceiling on the records it loaded for comparison; past it, duplicates were invisible. Fixed on this branch, not on `main`.

---

## 7. Export system — **FULLY BUILT**

| Capability | Status |
|---|---|
| CSV export | **FULLY BUILT** |
| Selected records | **FULLY BUILT** (`selected_ids`) |
| Export all / filtered | **FULLY BUILT** (`filter_definition` persisted on the job) |
| Column selection | **FULLY BUILT** (`selected_columns`, `export_templates`) |
| Export from list / saved search | **FULLY BUILT** (`export_type` enum: filtered, selected, list, saved_search, full) |
| Background generation | **FULLY BUILT** — `run-export-job`, 5,000-row batches, progress on `export_jobs` |
| Export history | **FULLY BUILT** — `/tools/exports` |
| Verification-aware export | **FULLY BUILT** — `export-verification-results` preserves the user's original uploaded CSV layout |
| Large exports | **Good** — batched server-side, file written to Storage |

Export is architecturally healthier than import: the heavy work is server-side.

---

## 8. Search and filtering — **FULLY BUILT, server-side**

All filtering runs **server-side** through PostgREST. No client-side dataset filtering was found.

**Filterable fields** are declared in `src/lib/filter-field-registry.ts`, organised into Apollo-style categories: name, email, job title, seniority, department, persona, company name, domain, industry, employee count/range, revenue, funding stage, country/city/state, technologies, keywords, LinkedIn, email validity status, phone status, lifecycle status, outreach status, data quality score, do-not-contact, source, source file, import tag, created/updated/last-contacted/last-verified/job-change dates, list membership, custom fields.

**Operators:** eq, neq, contains, not_contains, starts_with, ends_with, in, not_in, gt, gte, lt, lte, between, is_empty, is_not_empty, is_true, is_false — with nested AND/OR groups and include/exclude semantics.

| Aspect | Finding |
|---|---|
| Execution | Server-side |
| Text search | Trigram GIN indexes (`gin_trgm_ops`) on the ILIKE columns — correctly done |
| Pagination | Offset (`.range()`) — **degrades with depth** |
| Total counts | `count: "exact"` — full COUNT(\*) per query. **[UNMERGED]** changed to `estimated` for prospect search only |
| Indexes | 329 `CREATE INDEX` statements; compound indexes for common sort+filter combinations |
| Million-record readiness | **Filtering yes, counting and deep pagination no** — see `TECHNICAL_DEBT.md` §27 |

---

## 9. Deduplication — **FULLY BUILT** (see `DATABASE_AUDIT.md` for detail)

Summary: import-time dedup with a confidence ladder (exact email 100 → LinkedIn 95 → external ID 95 → name+domain 80 → name+company 70 → phone 55), plus background dedup RPCs for contacts and companies, a manual review queue, and soft merges that preserve history.

**Duplicate prevention on manual creation is weaker than on import** — the import path runs the full matcher; the UI create path does not run an equivalent check.

---

## 10. Lists — **FULLY BUILT**

`lists` (9 cols): `name`, `description`, `filter_criteria` jsonb, `is_dynamic` boolean, `workspace_id`, audit columns.
`list_contacts`: composite PK `(list_id, contact_id)`, `added_at`, `added_by`. Indexed both directions plus a composite `(contact_id, list_id)`.

| Capability | Status |
|---|---|
| Create / rename / delete | **FULLY BUILT** |
| Archive | **NOT IMPLEMENTED** (delete only) |
| Add / remove contacts | **FULLY BUILT** |
| Bulk add from selection | **FULLY BUILT** |
| Static lists | **FULLY BUILT** |
| Dynamic lists | **PARTIALLY BUILT** — `is_dynamic` + `filter_criteria` + `DynamicListBuilder.tsx` with live preview count; membership is evaluated at query time, there is no materialization or scheduled refresh |
| List export | **FULLY BUILT** |
| List search / filter | **FULLY BUILT** |
| List health scoring | **BACKEND ONLY** — `compute_list_health`, `/verification/list-quality` |

**[UNMERGED]** Include/exclude list filters silently truncated at 1,000 members (PostgREST default row cap) and exclusions above a few thousand failed on URL length. Both fixed on this branch. **On `main` this bug is live** — list-filtered audiences above 1,000 members have been wrong.

---

## 11. Clients / workspaces — **FULLY BUILT**

The model is **workspaces**, not clients/accounts/projects.

- `workspaces` — `name`, `slug`, `settings` jsonb, `intelligence_v2` flag, `logo_url`
- `workspace_members` — `(workspace_id, user_id, role, invited_by, joined_at)`
- `user_workspace_preferences` — per-user per-workspace UI state
- `platform_admins` — cross-workspace superusers

| Question | Answer |
|---|---|
| Can a contact belong to multiple workspaces? | **No.** `contacts.workspace_id` is a single FK. |
| Are contacts duplicated per workspace? | **Yes, necessarily** — the same person imported into two workspaces is two rows. |
| Are lists workspace-specific? | **Yes** |
| Are users workspace-specific? | **No** — users are global, membership is many-to-many via `workspace_members` |
| Is there client-level isolation? | **Yes, via RLS** — `is_workspace_member()` appears in 409 policy definitions |
| Does RLS exist? | **Yes** — 706 policies |

**Notable deviation:** prospect search is deliberately **account-wide**, not workspace-scoped. `applyAccountScope()` queries across every workspace the user can access, with a documented rationale. Imports match this scope for dedup. This is a deliberate product decision, but it means "workspace" is a partitioning device rather than a hard client boundary for search.

---

## 12. Authentication and roles — **FULLY BUILT**

| Aspect | Finding |
|---|---|
| Provider | Supabase Auth |
| Login | Email + password (`signInWithPassword`) — **only method**; no OAuth, no magic link, no SSO |
| Signup | **Disabled.** Page redirects to login; `allowed_emails` allowlist + `assert_email_allowed`/`is_email_allowed` gate provisioning |
| Password reset | **FULLY BUILT** (`resetPasswordForEmail` + `updateUser`) |
| Session | Supabase default; `previewAuthStorage.ts` provides isolated storage for preview environments |
| Login auditing | **FULLY BUILT** — `login_audit_log` + `record_login_attempt()` |
| Profiles | `profiles` table, auto-created by `handle_new_user()` trigger |
| Roles | `app_role` enum: **admin, manager, operator, viewer**, stored in `user_roles` (global) and `workspace_members.role` (per-workspace) |
| Platform admin | Separate `platform_admins` table + `is_platform_admin()` |
| Route guards | `ProtectedRoute.tsx`, `AdminRoute.tsx` |

### RLS model

Four helper functions carry the isolation, by usage count across migrations:

| Helper | Uses | Protects |
|---|---|---|
| `is_workspace_member(uid, workspace_id)` | 409 | Tenant isolation — the primary boundary |
| `has_any_role(uid, roles[])` | 162 | Privileged operations (delete, admin reads) |
| `is_platform_admin(uid)` | 91 | Cross-workspace override |
| `user_workspace_ids(uid)` | 64 | Multi-workspace scoping |
| `workspace_role(uid, ws)` | 45 | Role within a workspace |

`contacts` is correctly scoped today: its March 2026 policies were `USING (true)`, but April 2026 migrations replaced them with `is_workspace_member_or_admin(auth.uid(), workspace_id)`.

**However — 96 tables have at least one `TO authenticated USING (true)` policy somewhere in migration history**, including `companies`, `campaigns`, `activities`, `contact_activity_log`, `campaign_contacts`, `list_contacts` and `import_jobs`. Some were superseded (a 2026-09-18 migration replaced 12 of them with role-gated reads). **Which remain live cannot be determined from files.** This is the single most important item to verify — query in `TECHNICAL_DEBT.md` §28.

---

## 18. Freshness / data age — **fields exist, semantics partially implemented**

Timestamp columns present on contacts: `updated_at`, `last_verified_at`, `last_enriched_at`, `last_contacted_at`. On companies: same set. On `verification_results`: `verified_at`, `last_verified_at`, `last_seen_valid_at`, `last_bounce_at`, `last_reply_at`, `last_open_at`, `last_campaign_sent_at`, `next_recheck_at`, `last_recovery_at`, `status_changed_at`.

**Does the system *understand* stale data, or are these just timestamps?** Split answer:

- **For email verification: yes, genuinely.** `compute_freshness()`, `compute_freshness_state()`, `compute_decay()`, `compute_recheck_required()`, `schedule_recheck()`, `sweep_due_rechecks()` (cron, every minute), plus `freshness_label`, `freshness_state`, `age_in_days`, `confidence_decay_score`, `recheck_required` and `next_recheck_at` columns. Verification data has a real lifecycle.
- **For contact and company data generally: no.** `last_enriched_at` is written only by CSV import. Nothing decays a job title, flags a stale company record, or triggers re-enrichment. These are timestamps, not freshness logic.

---

## 19. Job change monitoring — **NOT IMPLEMENTED**

Searched the entire codebase for employment change, job change, current company change, historical employment, previous company, and title change logic.

**What exists:** `contacts.job_change_date` (date), `contacts.work_history` (jsonb), `contacts.current_role_start_date`, an index `idx_contacts_job_change_date`, a CSV alias mapping ("job change date", "job changed", "last job change"), and a filter-registry entry making `job_change_date` filterable.

**What does not exist:** any code that detects a job change, compares current employer against a previous one, writes `work_history`, or monitors for changes. Every reference is either a column definition, a CSV import mapping, or a filter declaration.

**Verdict: NOT IMPLEMENTED.** The schema anticipates the feature; no logic backs it. `job_change_date` holds only whatever a vendor CSV supplied.

---

## 20. Contact history / audit log — **PARTIALLY BUILT**

| Table | Columns | Written by | Status |
|---|---|---|---|
| `contact_field_history` | `contact_id`, `field_name`, `previous_value`, `new_value`, `change_type`, `source`, `import_job_id`, `changed_by`, `changed_at`, `workspace_id` | 6 INSERT sites, all inside Postgres functions (notably `enrich_contact_from_import`) | **FULLY BUILT for the import path** |
| `contact_activity_log` | `contact_id`, `action`, `details`, `performed_by`, `created_at` | **0 INSERT sites in migrations**; referenced in 3 frontend files | **PARTIALLY BUILT** — read/written from app code only, not guaranteed |
| `activities` | typed via `activity_type` enum (29 values) | `log_activity()` function; used by CRM pages | **PARTIALLY BUILT** |
| `contact_merge_events`, `merge_history` | merge provenance | dedup RPCs | **FULLY BUILT** |
| `company_activity_log` | company-side equivalent | — | **UNKNOWN** |
| `system_activity_log` | platform events | viewer UI exists | **BASIC** |
| `verification_audit_log` | verification changes | verification subsystem | **FULLY BUILT** |
| `email_status_history` | email status transitions with dedupe key | trigger-backed | **FULLY BUILT** |

**Assessment:** field-level history with old/new values, source and responsible user genuinely exists — but it is populated by the **import/enrichment path specifically**, not by a universal trigger on `contacts`. A manual edit in the UI is not guaranteed to produce a history row. **Requires live verification:** query `contact_field_history` grouped by `source` to see which paths actually write.

---

## 21. Source / provenance tracking — **FULLY BUILT at contact level, partial at field level**

**Contact level — strong.** Eight dedicated columns: `source`, `source_file`, `import_tag`, `external_source`, `external_contact_id`, `enrichment_source`, plus `created_by` and `created_at`. Every import stamps `source`, `source_file` (the original filename) and `import_tag`.

**Field level — partial.** Three email-specific provenance columns exist (`primary_email_source`, `secondary_email_source`, `tertiary_email_source`), and `email_status_source` records where a verification verdict came from. `contact_field_history.source` + `.import_job_id` give per-change provenance for changes that flow through the import path.

**Verdict:** provenance exists at contact level comprehensively, at field level for emails and for import-driven changes only. A manually edited phone number carries no provenance.

---

## 23. Dashboard and analytics — **FULLY BUILT, all real**

| Surface | Metrics | Real or mocked |
|---|---|---|
| `/` Dashboard | total contacts, companies, lists, imports; quality ≥70 and <40; do-not-contact; missing email; missing LinkedIn; companies missing domain; rows awaiting review; 7/30-day contact and company growth; 5 recent imports; top countries; top industries | **All real** — 15 `count: "exact"` queries |
| `/data-health` | 19 aggregate queries | **All real** |
| `/tools/analytics` | segment performance | Real (`get_segment_performance`) |
| `/admin` | cross-workspace KPIs: workspaces, contacts, companies, campaigns, emails sent, replies, meetings booked, deals, attributed revenue | Real (`admin_platform_kpis` and sibling rollups) |
| `/verification/*` dashboards | queue, workers, quotas, bounce/domain/provider intelligence | Real |
| `/engage/analytics`, `/linkedin/analytics` | campaign metrics | Real (`campaign_performance_metrics`, `linkedin_performance_metrics`) |
| `/intelligence/today` | daily command centre | Real (`get_daily_command_center`) |

**No mocked metrics found.** The cost is performance: Dashboard fires 15 exact counts and Data Health 19, all full COUNT(\*) over 1.2M rows, on page load.

---

## 24. Admin panel — **BASIC**

`/admin` — platform KPIs across all workspaces. `/admin/system-status`. `/admin/workspaces/:id`. Gated by `AdminRoute.tsx` + `is_platform_admin()`.

Verification has its own extensive admin surface: `/verification/admin`, `/verification/api` (API key management), `/verification/quotas`, `/verification/workers`, `/verification/engines`, `/verification/audit`, `/verification/dead-letter`, `/verification/operations`.

| Admin capability | Status |
|---|---|
| View workspaces + KPIs | **FULLY BUILT** |
| Workspace detail | **BASIC** |
| System status | **BASIC** |
| Verification API keys | **PARTIALLY BUILT** |
| Verification quotas | **PARTIALLY BUILT** |
| Worker monitoring | **PARTIALLY BUILT** |
| **User management (create/invite/disable/assign roles)** | **NOT IMPLEMENTED** — no UI found; provisioning is manual/SQL |
| Credits / billing | **UI ONLY** — placeholder settings pages |
| Provider configuration | **PARTIALLY BUILT** |

**Biggest admin gap: there is no user management UI.** For a platform with roles, an allowlist and multiple workspaces, onboarding a teammate currently requires direct database access.

---

## 25. Data scoring — **PARTIALLY BUILT**

| Score | Where | Status |
|---|---|---|
| `contacts.data_quality_score` / `companies.data_quality_score` | integer column, filterable, drives Dashboard "quality" tiles | **Column exists; no calculation function found in migrations.** Populated by import or left null. **Requires live verification** |
| `contacts.email_confidence` | integer | Import-supplied |
| `verification_results.confidence` + `confidence_breakdown` | jsonb breakdown | **FULLY BUILT** |
| `ai_confidence`, `ai_risk_score` | verification | **PARTIALLY BUILT** |
| `bounce_risk_score`, `deliverability_score` | `compute_deliverability_score()` | **FULLY BUILT** |
| `domain_reputation_score`, `compute_domain_risk()` | domain intelligence | **FULLY BUILT** |
| `provider_reputation_score`, `compute_provider_reputation()` | provider intelligence | **FULLY BUILT** |
| `catch_all_probability`, `compute_catch_all_probability()` | catch-all detection | **FULLY BUILT** |
| `confidence_decay_score`, `compute_decay()` | freshness decay | **FULLY BUILT** |
| `engine_consensus_score`, `historical_outcome_score`, `trust_score`, `safe_to_send_score` | verification cache | **FULLY BUILT** |
| `compute_account_heat_score()` | CRM account heat | **PARTIALLY BUILT** |
| `compute_list_health()` | list quality | **FULLY BUILT** |
| **`lead_score` / `contact_score`** | — | **NOT IMPLEMENTED** |

**Pattern:** scoring is sophisticated *inside the verification subsystem* and essentially absent for contact/lead quality generally. `data_quality_score` is used as though it were computed, but no computing function exists in the migrations — worth confirming against the live database.

---

## 26. Suppression / do-not-contact — **FULLY BUILT**

| Mechanism | Table / column | Status |
|---|---|---|
| Contact-level DNC | `contacts.do_not_contact` boolean + partial index | **FULLY BUILT** |
| Contact suppression | `contact_suppression` | **FULLY BUILT** |
| Domain suppression | `domain_suppression` | **FULLY BUILT** |
| Global suppression list | `suppression_list` | **FULLY BUILT** |
| Bounce tracking | `email_bounces`, `bounce_feedback`, `bounce_intelligence`, `record_bounce()`, `ingest_bounce_feedback()` | **FULLY BUILT** |
| Unsubscribe | `outreach_status = 'opted_out'`, `campaign_contact_status = 'opted_out'` | **FULLY BUILT** |
| Invalid-email suppression | `email_validity_status`, `check_email_send_eligibility()`, `email_status_allowed_for_mode()` | **FULLY BUILT** |
| LinkedIn stoplist | `linkedin_stoplist`, `linkedin_contact_on_stoplist()` | **FULLY BUILT** |
| Pre-send safety gates | `check_campaign_list_safety()`, `enforce_campaign_safety_on_activation()`, `trg_guard_campaign_enrollment_email_status` | **FULLY BUILT** |
| Soft delete | `merged_into` (archive rather than destroy) | **FULLY BUILT** |
| UI | `/verification/suppression`, `/settings/workspace/deliverability/suppression` | **FULLY BUILT** |

This is one of the strongest areas of the system — suppression is enforced at the database level by triggers and functions, not just in application code.

---

## 30. Existing features summary

| FEATURE | STATUS | QUALITY | LOCATION | NOTES |
|---|---|---|---|---|
| Contact database | FULLY BUILT | Good | `contacts` (85 cols) + `/contacts` | ~1.2M rows |
| Company database | FULLY BUILT | Good | `companies` (66 cols) + `/companies` | Properly normalized, domain-first |
| Prospect search | FULLY BUILT | Good | `use-prospect-search` + `/search/prospect` | Server-side, trigram-indexed |
| Advanced filtering | FULLY BUILT | Good | `advanced-filter-engine.ts` | Nested AND/OR, 17 operators |
| Pagination | PARTIALLY BUILT | Weak | `.range()` | Offset-based, degrades with depth |
| Result counts | PARTIALLY BUILT | Weak | `count: "exact"` ×94 | Full COUNT(\*) per query |
| CSV import | FULLY BUILT | Good (server) / Weak (client) | `ImportWizard` + `run-import-job` | 100 MB cap, browser-side parse |
| Import dedup | FULLY BUILT | Good | `run-import-job` | 6-signal confidence ladder |
| Background dedup | FULLY BUILT | Good | dedup RPCs + `run-dedup-scan` | Chunked, cron-friendly |
| Duplicate review | FULLY BUILT | Good | `/tools/duplicates` | Manual merge with history |
| Export | FULLY BUILT | Good | `run-export-job` + `/tools/exports` | Batched, background |
| Lists (static) | FULLY BUILT | Good | `lists`, `list_contacts` | |
| Lists (dynamic) | PARTIALLY BUILT | Fair | `is_dynamic` + `filter_criteria` | Query-time only, no refresh |
| Email verification | FULLY BUILT (platform) | Strong | 30 routes + `verification_*` tables | Engine adapter config UNKNOWN |
| Verification freshness/recheck | FULLY BUILT | Strong | `sweep_due_rechecks` cron | |
| Suppression / DNC | FULLY BUILT | Strong | Multiple tables + DB triggers | |
| Workspaces + RLS | FULLY BUILT | Good | 706 policies | 96 tables need live RLS check |
| Auth | FULLY BUILT | Good | Supabase Auth | Password only; signup disabled |
| User management UI | NOT IMPLEMENTED | — | — | Manual provisioning |
| Field history | PARTIALLY BUILT | Fair | `contact_field_history` | Import path only |
| Activity log | PARTIALLY BUILT | Fair | `activities`, `contact_activity_log` | Inconsistent writers |
| Provenance (contact) | FULLY BUILT | Good | 8 source columns | |
| Provenance (field) | PARTIALLY BUILT | Fair | email sources only | |
| Dashboard / analytics | FULLY BUILT | Good | Real queries throughout | Perf cost |
| Email sequencing | PARTIALLY BUILT | Fair | `/engage/*`, `process-sequence-steps` | Needs live verification |
| LinkedIn outbound | PARTIALLY BUILT | Fair | `/linkedin/*`, 3 provider APIs | Needs live verification |
| CRM (deals/opps/tasks) | PARTIALLY BUILT | Fair | `/crm/*`, `/deals/*` | |
| Deliverability | PARTIALLY BUILT | Fair | `/settings/.../deliverability`, `verify-domain-dns` | |
| Admin panel | BASIC | Fair | `/admin` | KPIs only |
| Settings | UI ONLY (35 of 54) | — | `SettingsPages.tsx` | Honest placeholders |
| Data quality score | UNKNOWN | — | `data_quality_score` | No calc function found |
| Enrichment | NOT IMPLEMENTED | — | — | Fields only; see §17 |
| Job change monitoring | NOT IMPLEMENTED | — | — | Fields only |
| Lead scoring | NOT IMPLEMENTED | — | — | |
| Instantly integration | NOT IMPLEMENTED | — | — | See `INTEGRATIONS_AUDIT.md` |
| Apollo integration | NOT IMPLEMENTED | — | — | CSV aliases only |
| Billing / credits | UI ONLY | — | Placeholder pages | |
| List archive | NOT IMPLEMENTED | — | — | Delete only |
| Tags UI | BACKEND ONLY | — | `tags`, `contact_tags` | |

---

## 31. Keep / Improve / Refactor / Add

### KEEP — strong, do not rebuild

1. **Email verification subsystem.** 94-column results model, catch-all probability, engine consensus, decay/recheck scheduling, dead-letter queue, worker claiming, quota accounting. This is the most valuable asset in the codebase.
2. **Suppression and send-safety.** Enforced by database triggers and functions, not application code. Correct by construction.
3. **Workspace RLS architecture.** `is_workspace_member` used consistently in 409 places.
4. **Export pipeline.** Batched, background, template-aware, original-layout preserving.
5. **Advanced filter engine.** Nested groups, include/exclude, 17 operators, field registry.
6. **Trigram search indexing.** Correctly matched to the ILIKE query shape.
7. **`useConfigStatus` honesty pattern.** Real capability checks instead of fake success paths.
8. **The "honest placeholder" convention** in Settings. Keep doing this.
9. **Company normalization.** Domain-first identity with corporate hierarchy support.
10. **Import job recovery machinery.** Watchdog, quarantine, repair, parent/child rollup.

### IMPROVE — works, needs enhancement

1. **Result counting** — finish the `estimated` rollout beyond prospect search (94 `exact` counts remain).
2. **Pagination** — offset-based; needs keyset for deep result sets.
3. **Dynamic lists** — evaluated at query time only; no materialization, refresh or membership snapshot.
4. **Activity log** — `contact_activity_log` has no guaranteed writer; unify with `activities`.
5. **Field-level history** — only the import path writes; a universal trigger would make it trustworthy.
6. **`data_quality_score`** — consumed as though computed; needs a real calculation.
7. **Admin panel** — add user management, invitations, role assignment.
8. **Tags** — backend exists, UI does not.
9. **Import client-side ceiling** — move parsing and staging server-side.
10. **Bundle size** — one 2.85 MB chunk, no code splitting, on a 167-route app.

### REFACTOR — architecturally problematic

1. **RLS permissiveness.** 96 tables carry `TO authenticated USING (true)` somewhere in history. Needs a live audit and a consistent policy convention.
2. **`const db = () => supabase as any`** — discards the 12,530-line generated type file exactly where queries are most complex.
3. **`run-import-job` is 1,652 lines** in a single file with a 25-second CPU budget.
4. **Two sources of truth for business logic** — ~180 Postgres functions and 21 Edge Functions, with no clear boundary.
5. **SQL generated columns vs JS normalizers.** Fixed on the unmerged branch; the *pattern* (trusting a `normalized_*` column) remains a trap elsewhere.
6. **No API layer.** The browser is a direct database client; every invariant rests on RLS.
7. **Route sprawl.** 167 routes, 35 placeholders — navigation implies far more product than exists.
8. **Edge function auth.** `config.toml` contains only `project_id`; no explicit per-function JWT policy.

### ADD — does not exist

1. Server-side CSV ingestion for files beyond ~200k rows
2. Job change / employment change detection
3. Contact and company enrichment (any provider)
4. Lead scoring / ICP fit scoring
5. User management and invitation UI
6. Email-sending integration with a real ESP or sequencer
7. Reply/bounce webhook ingestion from an outbound tool
8. Data freshness policy for contact data (not just verification)
9. Keyset pagination
10. Saved-search change alerts / monitoring
11. Field-level provenance beyond email
12. API access for customers (the verification API surface is admin-only)
13. Observability — error tracking, query performance monitoring
14. Automated test coverage on `main` (141 tests exist only on the unmerged branch)

---

## 32. System maturity scorecard

| Category | Score | Rationale |
|---|---|---|
| Contact database | **8/10** | 85 well-chosen columns, normalized, merge-aware, provenance-rich. Loses points for no field-level provenance beyond email. |
| Database architecture | **7/10** | ~170 tables, 180 functions, 49 triggers — genuinely sophisticated. Penalised for generated-column/normalizer mismatches and RLS inconsistency. |
| Search | **7/10** | Correct trigram indexing, server-side, rich operators. Held back by exact counts and offset pagination. |
| Filtering | **8/10** | Nested AND/OR, 17 operators, include/exclude, custom fields. Among the best-built parts. |
| Import | **6/10** | Excellent server pipeline; browser-bound ingestion caps it well below the dataset size. |
| Export | **8/10** | Batched, background, templated, original-layout aware. |
| Deduplication | **7/10** | Six-signal ladder, background RPCs, review queue, soft merges. **[UNMERGED]** fixes lift this from ~4. |
| Email verification | **9/10** | The standout. Depth here rivals commercial verification products. Docked only because engine configuration is unconfirmed. |
| Enrichment | **1/10** | Fields and filters exist; no logic, no provider. |
| Data freshness | **5/10** | Excellent for verification, absent for contact data. |
| Job monitoring | **0/10** | Not implemented. |
| Provenance | **7/10** | Strong at contact level, partial at field level. |
| History | **5/10** | Field history real but import-path-only; activity log has no guaranteed writer. |
| Lists | **7/10** | Solid static lists; dynamic lists unmaterialized. **[UNMERGED]** fixes the 1,000-row truncation. |
| Workspaces | **7/10** | Correct model, consistent helpers. Docked for unverified permissive policies. |
| Integrations | **3/10** | Three LinkedIn providers and an AI gateway. No ESP, no enrichment, no CRM, no sequencer. |
| Background processing | **7/10** | Self-continuing functions, watchdog, quarantine, cron sweeps. Only 2 cron jobs for a system this size. |
| Scalability | **5/10** | Schema and indexes are ready for millions; counting, pagination and browser-side import are not. |
| Security | **5/10** | No secrets in frontend, no service-role leakage, RLS everywhere — but 96 tables with permissive policies in history is unresolved. |
| Observability | **3/10** | `console.log`, job diagnostics, audit tables. No error tracking, no APM, no alerting. |
| Admin tooling | **4/10** | Verification admin is strong; platform admin is KPIs only, with no user management. |

**Weighted overall: ~6/10.** A genuinely substantial system with one world-class subsystem (verification), a solid data core, and real gaps in enrichment, monitoring, and operational tooling.
