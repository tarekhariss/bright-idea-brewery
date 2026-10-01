# Database Audit — TLBG Prospect Intelligence

**Date:** 2026-09-19
**Source:** `supabase/migrations/*.sql` (114 files), `supabase/*.sql`, `src/integrations/supabase/types.ts`
**Not used:** a live database connection. Migrations are cumulative; later ones supersede earlier ones. Items marked *requires live verification* cannot be settled from files.

---

## 1. Inventory at a glance

| Object | Count |
|---|---|
| Tables | ~170 |
| Views | 3 (`email_queue_health_v`, `linkedin_campaign_stats_v`, `linkedin_queue_health_v`) |
| Materialized views | 0 found |
| Functions / RPCs | ~180 |
| Triggers | 49 |
| Enums | 40+ |
| `CREATE INDEX` statements | 329 |
| RLS policies | 706 |
| pg_cron jobs | 2 scheduled + 1 dedupe loop |
| Storage buckets | Used for import/export CSV originals |
| Extensions | `pg_cron`, `pg_net`, `pg_trgm` |

---

## 2. Tables by domain

### Core data (the asset)

| Table | Purpose | Key columns | Relationships |
|---|---|---|---|
| `contacts` | The prospect database, ~1.2M rows | 85 cols — identity, 6 phones, 12 verification, 8 provenance, merge, scoring | → `workspaces`, `companies`, `auth.users`; self-ref `merged_into_contact_id` |
| `companies` | Company records | 66 cols — firmographics, funding, tech, hierarchy | → `workspaces`; self-ref `parent_company_id` |
| `lists` | Static + dynamic lists | `name`, `filter_criteria` jsonb, `is_dynamic` | → `workspaces` |
| `list_contacts` | Membership | PK `(list_id, contact_id)` | → `lists`, `contacts` (CASCADE) |
| `tags`, `contact_tags`, `company_tags` | Tagging | | Backend only — little UI |
| `custom_fields`, `global_picklists`, `global_picklist_options` | User-defined fields | | Settings-managed |
| `saved_searches`, `saved_views` | Persisted filters/views | `filter_definition` jsonb | |

### Import / export

| Table | Purpose |
|---|---|
| `import_jobs` | 31 cols — parent/child batching (`parent_job_id`, `batch_index`, `batch_total`), 12 outcome counters, `settings`, `error_summary` jsonb |
| `import_job_rows` | Per-row staging: `raw_data`, `normalized_data`, `status`, `error_message`, `duplicate_match_reason`, `review_required`, resolved `contact_id`/`company_id` |
| `import_quarantine_rows` | Rows held back from processing |
| `imported_datasets` | Dataset-level registry |
| `historical_imports` | Historical verification dataset imports |
| `export_jobs` | 20 cols — `export_type`, `filter_definition`, `selected_ids`, `selected_columns`, progress, `file_url` |
| `export_templates` | Reusable column sets |

### Verification (the deepest subsystem)

| Table | Purpose |
|---|---|
| `verification_results` | **94 columns.** SMTP transcript (`smtp_code`, `smtp_banner`, `smtp_response`, `tls_supported`, `greylisting_detected`), MX data, catch-all probability, engine consensus/conflict, confidence + breakdown, risk scores, recheck scheduling, recovery passes, dead-letter flag, worker claim |
| `verification_cache` | 37 cols — reuse layer with `trust_score`, `safe_to_send_score`, `freshness_state`, `age_in_days`, `hit_count`, `campaign_safety_tier`, `estimated_bounce_probability` |
| `verification_jobs` | Batch jobs |
| `verification_workers` | External worker registry + heartbeat |
| `verification_engines` | Engine registry: `kind`, `version`, `is_active`, `priority`, `config`, `last_heartbeat_at` |
| `verification_engine_runs` | Per-engine execution records |
| `verification_quotas` | Usage limits |
| `verification_events`, `verification_audit_log` | Event + audit trail |
| `verification_dead_letter`, `verification_recovery_queue` | Failure handling |
| `verification_quality_logs`, `verification_status_map` | Quality tracking, status normalization |
| `email_status_history` | Status transitions with dedupe key |
| `prospect_verification_history` | Per-contact verification history |
| `domain_intelligence`, `domain_reputation`, `domain_send_limits` | Domain-level learning |
| `provider_behavior`, `provider_behavior_rules`, `provider_behavior_logs`, `provider_profiles` | ESP behaviour learning |
| `smtp_learning`, `smtp_patterns`, `smtp_session_log` | SMTP pattern learning |
| `bounce_intelligence`, `bounce_feedback`, `email_bounces`, `email_reputation_history` | Bounce learning |
| `greylisting_events`, `confidence_learning`, `unknown_reason_stats` | Edge-case learning |

### Suppression / safety

`suppression_list`, `contact_suppression`, `domain_suppression`, `linkedin_stoplist`, plus `contacts.do_not_contact`.

### Outbound — email

`campaigns`, `campaign_contacts`, `campaign_steps`, `campaign_step_executions`, `campaign_enrollments`, `campaign_mailboxes`, `campaign_mailbox_pool`, `campaign_linkedin_accounts`, `campaign_stats`, `campaign_performance_metrics`, `campaign_attribution`, `campaign_tags`, `sequences`, `sequence_steps`, `sequence_enrollments`, `sequence_safety_rules`, `emails`, `email_templates`, `email_variants`, `email_events`, `email_history`, `email_providers`, `mailboxes`, `mailbox_health`, `mailbox_performance_metrics`, `mailbox_rotation_state`, `mailbox_warmup_settings`, `sending_domains`, `sending_windows`, `sending_daily_counts`, `esp_routing_rules`, `message_queue`, `inbox_threads`, `inbox_messages`, `personalization_variables`.

### Outbound — LinkedIn

24 `linkedin_*` tables: accounts, account health, campaigns, campaign leads/senders/steps, action queue, action history, contact state, inbox threads/messages, message templates/variants, performance metrics, safety rules, stoplist, tasks, webhooks, worker runs, workflow nodes/edges, filter presets, execution adapters, LLM integrations, API keys.

### CRM

`deals`, `deal_contacts`, `deal_stage_history`, `opportunities`, `opportunity_contacts`, `opportunity_notes`, `opportunity_status_history`, `pipelines`, `pipeline_stages`, `tasks`, `meetings`, `calls`, `activities`, `crm_settings`, `crm_review_queue`, `crm_job_runs`, `crm_bulk_push_jobs`, `crm_bulk_push_job_rows`.

### Dedup / merge

`duplicate_groups`, `duplicate_candidates`, `merge_history`, `contact_merge_events`, `contact_conflicts`.

### History / audit

`contact_field_history`, `contact_activity_log`, `company_activity_log`, `system_activity_log`, `login_audit_log`, `verification_audit_log`, `email_status_history`, `worker_activity_logs`.

### Identity / tenancy

`workspaces`, `workspace_members`, `user_workspace_preferences`, `profiles`, `user_roles`, `platform_admins`, `allowed_emails`, `platform_settings`.

### Admin rollups

`admin_platform_kpis`, `admin_workspace_summaries`, `admin_campaign_summaries`, `admin_linkedin_summaries`, `admin_mailbox_summaries`, `admin_activity_feed`, `workspace_kpis`, `contact_funnel_metrics`, `contact_insights`, `company_insights`, `goals`.

### AI / research

`ai_prompt_templates`, `generated_content`, `prospect_research_profiles`, `prospect_research_sources`.

---

## 3. Enums (40+)

Notable: `app_role` (admin/manager/operator/viewer), `email_validity` (unknown/valid/invalid/catch_all/disposable/role_based), `lifecycle_status` (8 values), `outreach_status` (7), `phone_status` (4), `import_status` (7), `import_row_status` (6), `export_status` (5), `export_type` (5), `activity_type` (**29 values** — the richest), `merge_status`, `duplicate_group_status`, `quarantine_status`, `campaign_*` (5 enums), `linkedin_*` (7 enums), `deal_status`, `meeting_status`, `call_outcome`, `domain_status`, `dns_record_status`, `historical_import_status`, `classification_source`, `attribution_type`.

---

## 4. Indexing

329 `CREATE INDEX` statements. Strategy is deliberate and mostly correct:

- **Trigram GIN** (`gin_trgm_ops`) on `contacts.email`, `first_name`, `last_name`, `company_name_raw`, `normalized_name`, `companies.name`, `domain`, `normalized_domain` — correctly matched to the `ILIKE '%term%'` search shape. This is the detail most teams get wrong; it is right here.
- **Foreign keys explicitly indexed** (`contacts.company_id`, `owner_id`) — Postgres does not do this automatically, and the migration comments show awareness.
- **Compound indexes** for real query shapes: `(lifecycle_status, updated_at DESC)`, `(outreach_status, updated_at DESC)`, `(owner_id, lifecycle_status)`.
- **Partial index** on `do_not_contact WHERE do_not_contact = true` — cheap and correct.
- **Sort columns**: `updated_at DESC`, `created_at DESC`.
- **`list_contacts` indexed both directions** plus composite `(contact_id, list_id)`.
- Identity columns indexed: `normalized_email`, `normalized_linkedin_url`, `external_contact_id`, `linkedin_url`, `job_change_date`.

`supabase/indexes.sql` is a curated, commented, idempotent set with a pre-flight instruction to check `pg_indexes` first.

---

## 5. ⚠ Generated columns that do not mean what they appear to

Three generated columns are defined in a way that makes them unusable — or dangerous — as identity keys. All three caused real dedup failures.

| Column | Definition | Problem |
|---|---|---|
| `contacts.normalized_linkedin_url` | `regexp_replace(lower(...), '[/?#].*$', '')` after stripping scheme/www | **Strips everything after the first slash.** Evaluates to the bare host `linkedin.com` for *every row in the table*. It cannot identify anybody. |
| `companies.normalized_domain` | `lower(coalesce(domain,''))` | Lowercases only — does **not** strip scheme, `www.` or path. A row stored as `www.acme.com` never matches a lookup for `acme.com`. |
| `companies.normalized_name` | `lower(trim(name))` | **Keeps legal suffixes.** Stores `acme inc` while application lookups strip to `acme` — so companies with Inc/Ltd/LLC/GmbH never matched by name. |

`contacts.normalized_email` (`NULLIF(lower(regexp_replace(coalesce(email,''),'\s','','g')),'')`) and `contacts.normalized_name` (`lower(first || ' ' || last)`) are sound.

**Rule that prevents recurrence:** never key an index on a `normalized_*` column directly — pass it through the matching application normalizer first.

**[UNMERGED]** The application-side fixes (`companyDomainKey`, `companyNameKey`, and not using `normalized_linkedin_url`) are on `fix/search-correctness-and-scale`. On `main` these mismatches are live. The **column definitions themselves are still wrong** on both branches; `normalized_linkedin_url` in particular costs storage and index maintenance on every write while identifying nobody.

---

## 6. Deduplication logic — where it lives

### Import-time (`supabase/functions/run-import-job/index.ts`)

`checkDuplicatesAdvanced()` runs a confidence ladder, first match wins:

| Signal | Confidence | Classification |
|---|---|---|
| Exact email (primary, secondary or tertiary) | 100 | `exact_duplicate` |
| Exact LinkedIn URL | 95 | `exact_duplicate` |
| External contact ID | 95 | `exact_duplicate` |
| Name + company domain | 80 | `likely_duplicate` |
| Name + company name | 70 | `likely_duplicate` |
| Phone (≥7 digits) | 55 | `review_required` |

Thresholds: ≥90 exact, ≥65 likely, below that review. Rows with neither email nor name are `invalid`.

Company matching is separate and **domain-first**: `normalized_domain` → `external_account_id` → company LinkedIn → normalized name.

Outcome is decided by `classifyRowAction()` against the job's `import_mode`:
- `enrich` (**default**) — fill missing fields on the existing contact via `enrich_contact_from_import()`, recording every change in `contact_field_history`; downgrades to `duplicate_linked` (nothing to add) or `conflict` (real value clash)
- `skip` — ignore the duplicate
- `review` — queue for a human

### Background (Postgres RPCs, chunked)

`dedupe_contacts_by_email_chunk`, `dedupe_contacts_by_linkedin_chunk`, `dedupe_companies_by_domain`, `dedupe_companies_by_domain_chunk`, `dedupe_companies_global_chunk`, `run_company_dedupe_tick`, `merge_duplicate_contacts_by_email`, `merge_company_pair`, `soft_merge_contacts`, `resolve_canonical_contact`, `resolve_contact_id`.

Driven by edge functions `run-dedup-scan` and `run-company-dedupe`, plus a **pg_cron dedupe loop** — each tick processes one bounded chunk with its own `statement_timeout` so a merge is never cancelled mid-operation. The migration comment is explicit that this runs independently of any user session.

### Manual review

`duplicate_groups`, `duplicate_candidates` + `/tools/duplicates` (`DuplicateReviewPage.tsx`, `use-deduplication.ts`).

### Historical preservation

Merges are **soft**: `merged_into` / `merged_into_contact_id`, `merged_at`, `merged_by`. Losing records are retained and excluded from queries via `.is("merged_into", null)`. `merge_history`, `contact_merge_events` and `contact_conflicts` record what happened and what clashed.

### Gaps

- **Manual contact creation does not run the matcher.** A duplicate typed into the UI is not caught the way an imported one is.
- Phone matching relies on stored phones already being normalized — true for import-created rows, not guaranteed for others.
- **[UNMERGED]** Import dedup previously loaded at most 500,000 existing contacts into memory; beyond that, records were invisible to dedup and duplicates were created. Fixed on this branch.

---

## 7. Background processing

### pg_cron

| Job | Schedule | Work |
|---|---|---|
| `verification-recheck-sweeper` | every minute | `sweep_due_rechecks(500)` — re-verifies emails whose freshness has decayed |
| `verification-intelligence-rollup` | every 5 minutes | `intelligence_rollup()` — aggregates domain/provider/bounce intelligence |
| Company dedupe loop | per migration comment | one bounded chunk per tick |

**Only two named scheduled jobs for a system of this size.** Campaign sending, sequence stepping, LinkedIn queue processing and import continuation are all driven by edge-function invocation rather than cron.

### Self-continuing edge functions

`run-import-job` is the reference pattern: `MAX_WALL_CLOCK_MS = 25_000`, `MAX_BATCHES_PER_INVOCATION = 4`, and it re-invokes itself before hitting the Deno CPU limit. `MAX_RETRIES = 2`, `RETRY_SUB_BATCH = 50`. The comment explains the constraint is **CPU time, not wall clock** — a subtlety many teams miss.

### Queues

`message_queue` (email), `linkedin_action_queue` (+ `linkedin_claim_due_actions` for atomic claiming), `verification_recovery_queue`, `verification_dead_letter`, `crm_bulk_push_jobs` / `_job_rows`, `crm_review_queue`, `import_quarantine_rows`.

### Failure handling

- **Retries:** sub-batch retry on insert failure; `retry_count`, `recheck_attempts`, `recovery_attempt_count`, `attempt_count` on verification results
- **Dead letter:** `verification_dead_letter` + `/verification/dead-letter`
- **Watchdog:** `import-watchdog` edge function; `recover_stuck_verification_jobs()`
- **Repair:** `repair-import-staging`
- **Idempotency:** `try_claim_parent_finalize()` for atomic parent finalization under concurrent child completions
- **Rate limiting:** `domain_send_limits`, `sending_daily_counts`, `increment_daily_send_count()`, `is_sending_window_open()`, `linkedin_account_remaining_capacity()`, `consume_verification_quota()`
- **Concurrency:** worker claiming (`claim_verification_batch`, `claimed_by_worker`), `worker_heartbeat()`

This is mature operational engineering — notably stronger than the rest of the system.

---

## 8. Storage buckets

Used for CSV originals: the import wizard uploads the source file so exports can reproduce the user's original column layout (`export-verification-results` relies on this). A migration comment notes *"bucket already exists; ensure RLS policies on storage.objects"* — **requires live verification** that those policies are in place.

---

## 9. Row Level Security

706 policies. Isolation rests on five helpers:

| Helper | Uses |
|---|---|
| `is_workspace_member(uid, ws)` | 409 |
| `has_any_role(uid, roles[])` | 162 |
| `is_platform_admin(uid)` | 91 |
| `user_workspace_ids(uid)` | 64 |
| `workspace_role(uid, ws)` | 45 |

`contacts` is correctly scoped: March 2026 policies were `USING (true)`; April 2026 migrations replaced them with `is_workspace_member_or_admin(auth.uid(), workspace_id)` for select and `is_workspace_member` for insert/update, with delete restricted to admin/manager.

**96 tables carry at least one `TO authenticated USING (true)` policy somewhere in migration history** — including `companies`, `campaigns`, `activities`, `campaign_contacts`, `contact_activity_log`, `list_contacts`, `import_jobs`. A 2026-09-18 migration replaced 12 such policies with role-gated reads, proving the issue is known and being worked. **Which remain live cannot be determined from migration files.**

A live check on 2026-09-18 confirmed **no policy grants anything to the `anon` role** and **no public table has RLS disabled** — so nothing is exposed to an unauthenticated visitor. The open question is strictly cross-workspace access between *authenticated* users.

### Verification query

```sql
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and 'authenticated' = any(roles)
  and (qual = 'true' or with_check = 'true')
order by tablename;
```

Every row returned is a table any logged-in user can read across every workspace.
