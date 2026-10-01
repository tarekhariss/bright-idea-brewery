# Integrations & Backend Functions Audit

**Date:** 2026-09-19
**Method:** static inspection. Runtime configuration (API keys, adapter rows, worker deployment) **cannot be determined from source** and is marked *requires live verification*.

---

## Part 1 — Email verification (the most important subsystem)

### Where the code lives

| Component | Location |
|---|---|
| Worker-facing API | `supabase/functions/verification-worker-api/index.ts` (451 lines) |
| Job claiming / result recording | ~40 Postgres functions |
| Data model | `verification_results` (94 cols), `verification_cache` (37 cols), + ~20 supporting tables |
| Historical ingestion | `import-historical-verifications`, `ingest-verification-upload` |
| Export | `export-verification-results` |
| Admin UI | **30 routes** under `/verification/*` |
| **The actual SMTP engine** | **A separate repository** — `tarekhariss/tlbg-verifier-worker`, described as *"Standalone SMTP email verification worker for the TLBG outbound platform"* |

### Is verification internal or external?

**Internal — self-hosted.** There is no third-party verification API. The platform performs its own SMTP probing via an external worker process that lives outside this repository. The file header states it plainly: *"External email verification engine API. Worker actions authenticate via x-worker-secret. Dashboard/admin reads via JWT."*

This is a strategic asset: it means no per-verification vendor cost and no third-party rate limit.

### How it works

```
Worker process (separate repo)
   │  POST /verification-worker-api/claim     (x-worker-secret)
   │    → claim_verification_batch(limit ≤ 200)   atomic claim, sets claimed_by_worker
   │  ... performs MX lookup + SMTP probe ...
   │  POST /verification-worker-api/submit
   │    → record_verification_result()
   │       ├─ writes verification_results
   │       ├─ updates verification_cache
   │       ├─ recomputes contact email_* columns (trigger)
   │       └─ schedules next recheck
   ▼
Postgres  ── pg_cron every minute ──► sweep_due_rechecks(500)
```

**Worker endpoints** (13, all secret-authenticated): `claim`, `submit`, `retry`, `bounce`, `heartbeat`, `dead-letter`, `quota`, `fail`, `recheck`, `intelligence`, `decide`, `recovery-claim`, `recovery-submit`.

Dashboard/admin reads on the same function authenticate by JWT instead. Secret mismatches are logged with diagnostic context (not the secret).

### Feature checklist

| Capability | Status | Evidence |
|---|---|---|
| Trigger endpoint | **YES** | `verification-worker-api`, `enqueue_verification_job()` |
| Statuses returned | **YES** | `email_validity` enum: `unknown`, `valid`, `invalid`, `catch_all`, `disposable`, `role_based`; plus `verification_results.status`, `current_status`, `historical_status`, `unknown_subclass` |
| Results stored | **YES** | `verification_results` (94 cols) + `verification_cache` |
| Verification timestamps | **YES** | `verified_at`, `last_verified_at`, `last_seen_valid_at`, `status_changed_at`, `next_recheck_at`, `last_attempt_at` |
| Confidence scores | **YES** | `confidence`, `confidence_breakdown` jsonb, `unknown_confidence`, `ai_confidence`, `engine_consensus_score`, `historical_outcome_score`, `trust_score`, `safe_to_send_score` |
| Bulk verification | **YES** | `verification_jobs`, batch claiming up to 200 |
| Automatic verification | **PARTIAL** | Cron re-verifies *decayed* results automatically. Whether new imports auto-enqueue **requires live verification** |
| Caching | **YES** | `verification_cache` with `cached_until`, `hit_count`, `from_cache`, `reuse_kind` |
| Re-checking | **YES** | `recheck_required`, `next_recheck_at`, `recheck_attempts`, `compute_recheck_required()`, `schedule_recheck()`, `sweep_due_rechecks()` cron |
| Catch-all | **YES — sophisticated** | `is_catch_all`, `catch_all_probability`, `compute_catch_all_probability()`, dedicated `/verification/catch-all` page |
| Disposable detection | **YES** | `is_disposable`, `contacts.email_is_disposable` |
| Role-based detection | **YES** | `is_role_based`, `contacts.email_is_role_based` |
| Syntax / domain / MX checks | **YES** | `email_is_syntax_invalid`, `email_is_mx_missing`, `mx_record`, `mx_status`, `mx_provider` |
| Greylisting | **YES** | `greylisting_detected`, `greylisting_events` |
| TLS / SMTP transcript | **YES** | `tls_supported`, `smtp_code`, `smtp_banner`, `smtp_response`, `smtp_result` |
| Usage limits | **YES** | `verification_quotas`, `consume_verification_quota()`, `/verification/quotas` |
| Admin UI | **YES — extensive** | 30 routes |
| Connected to imports | **YES** | `import-historical-verifications`, `ingest-verification-upload` |
| Connected to exports | **YES** | `export-verification-results` preserves original CSV layout |
| Dead-letter handling | **YES** | `verification_dead_letter`, `verification_recovery_queue` |
| Multi-engine consensus | **YES** | `primary_engine`, `fallback_engine`, `engine_conflict`, `engine_consensus_score`, `decide_verification_strategy()` |
| Learning loop | **YES** | `smtp_learning`, `provider_behavior`, `domain_intelligence`, `confidence_learning`, `bounce_intelligence` |

### Architectural weaknesses / risks

1. **The engine may not be configured.** `src/pages/tools/VerificationPage.tsx` renders: *"The verification engine adapter is not configured. Cached results are returned instantly and new emails will queue, but live SMTP verification will only begin once your external worker (e.g. AfterShip email-verifier or truemail-go) is connected."* Whether a worker is currently deployed and heartbeating **requires live verification** — check `verification_engines.last_heartbeat_at` and `verification_workers`.
2. **Single shared secret.** All 13 worker actions authenticate with one `VERIFICATION_WORKER_SECRET`. No per-worker credentials, no rotation mechanism visible, no request signing.
3. **The engine lives in another repository**, so this codebase cannot be audited for actual SMTP correctness, timeout handling or IP reputation management.
4. **No explicit JWT config.** `supabase/config.toml` contains only `project_id` — no `[functions.*]` blocks. All functions inherit `verify_jwt = true`, which means the external worker must also present a Supabase anon key alongside its secret. **Requires live verification** that the worker is actually reachable.
5. **`verification_results` at 94 columns** mixes probe data, scoring, scheduling, recovery and worker bookkeeping in one table. It works, but it is a wide row to maintain and index.
6. **Deliverability depends on sending IP reputation** of wherever the worker runs — not visible here.

### Verdict

**FULLY BUILT as a platform. Operational status UNKNOWN.** The data model, learning loops, scheduling, quota system and admin surface are of commercial quality — genuinely comparable to paid verification products. The one thing that cannot be confirmed from source is whether an engine is currently connected and verifying.

---

## Part 2 — Third-party integrations

### Actually integrated

Only four external hosts appear anywhere in the backend.

| Provider | Purpose | Where | Credentials | Status |
|---|---|---|---|---|
| **Unipile** | LinkedIn messaging/connection API | `process-linkedin-queue` case `"unipile"`, base `https://api.unipile.com` | `linkedin_execution_adapters.config` (DB) | **PARTIALLY BUILT** — adapter pattern implemented; active use requires live verification |
| **HeyReach** | LinkedIn outreach | `process-linkedin-queue` case `"heyreach"`, base `https://api.heyreach.io` | `linkedin_execution_adapters.config` | **PARTIALLY BUILT** |
| **PhantomBuster** | LinkedIn automation | `process-linkedin-queue` case `"phantombuster"`, `POST /api/v2/agents/launch` | `linkedin_execution_adapters.config` | **PARTIALLY BUILT** |
| **Lovable AI Gateway** | LLM calls | `crm-ai-summary`, `crm-detect-replies`, `https://ai.gateway.lovable.dev` | Edge function env | **PARTIALLY BUILT** |

LinkedIn execution uses a clean **adapter pattern** — `linkedin_execution_adapters` with `provider`, `config`, and a `"webhook"` fallback — plus `linkedin_has_active_adapter()` so the UI can tell whether anything is connected. `LinkedinExecutionAdapterSection.tsx` presents them as selectable options with help text. Good design; whether any adapter row exists in production is unknown from source.

### NOT integrated — and why the names appear anyway

| Name | Appears in | What it actually is |
|---|---|---|
| **Instantly** | 4 files | The English adverb (*"Cached results are returned **instantly**"*) and a design comment (*"Email sequence worker — **Instantly-style**"*) describing their own worker. **No API, no webhook, no client.** |
| **Apollo** | 6 files | CSV column-mapping aliases (`"apollo id"`, `"apollo contact id"`, `"apollo company id"`) and *"Apollo-style categories"* for the filter panel layout. They import Apollo CSV **exports**; there is no API connection. |
| **ZeroBounce / MillionVerifier / EmailListVerify** | 5 files | CSV **export formats** parsed by `import-historical-verifications` (*"Ingests EmailListVerify / ZeroBounce / MillionVerifier exports"*). File ingestion, not API integration. |
| **NeverBounce** | 3 files | Same — format name only. |
| **Calendly** | 2 files | String reference only |
| **OpenAI / Anthropic** | 2 files each | Referenced as model-provider names routed through the Lovable AI gateway, not as direct SDK integrations |
| **Stripe, HubSpot, Salesforce, Slack, Clearbit, Smartlead, Lemlist** | 0 files | Absent entirely |

---

## Part 3 — Instantly integration

# NOT IMPLEMENTED

Checked explicitly and exhaustively:

| Aspect | Finding |
|---|---|
| API connection | **None.** No `instantly.ai` host anywhere |
| Authentication | **None** |
| Campaign fetching | **None** |
| Lead syncing | **None** |
| Webhooks | **None.** No inbound webhook endpoint for any outbound tool |
| Bounce data | Bounce infrastructure exists (`email_bounces`, `bounce_feedback`, `ingest_bounce_feedback()`) but **nothing feeds it from Instantly** |
| Replies | Reply detection exists (`crm-detect-replies`) but reads **internal** inbox tables |
| Interested status | Reply classification exists (`classify_reply_text`, `classify_inbound_message`) for internal data only |
| Unsubscribes | `outreach_status = 'opted_out'` exists; no Instantly feed |
| Verification data | No exchange |
| Campaign analytics | `campaign_performance_metrics` is populated from internal sending only |

**Important nuance:** the *receiving* side is largely built. `ingest_bounce_feedback()`, `record_bounce()`, `record_engagement()`, `classify_inbound_message()` and the suppression tables are all waiting for data. What is missing is **the connector** — an authenticated client plus a webhook endpoint. That makes this a relatively contained piece of work rather than a greenfield feature.

---

## Part 4 — Enrichment

# NOT IMPLEMENTED

Verification and enrichment are distinct, and only verification exists.

- **Verification** = *is this email address deliverable?* → **fully built** (Part 1)
- **Enrichment** = *find or update facts about this person/company* → **absent**

| Capability | Status |
|---|---|
| Enrichment providers | **NOT IMPLEMENTED** — no enrichment API called anywhere |
| Person enrichment | **NOT IMPLEMENTED** |
| Company enrichment | **NOT IMPLEMENTED** |
| Email discovery | **NOT IMPLEMENTED** — the system verifies emails it already has; it cannot find new ones |
| Phone discovery | **NOT IMPLEMENTED** — 6 phone columns, all CSV-populated |
| Job title updates | **NOT IMPLEMENTED** |
| LinkedIn enrichment | **NOT IMPLEMENTED** |
| Company data updates | **NOT IMPLEMENTED** |
| Automatic enrichment | **NOT IMPLEMENTED** |
| Bulk enrichment | **UI ONLY** — `/search/data-enrichment` and `/search/prospect-enrich` pages exist |
| Cost tracking | **NOT IMPLEMENTED** — no credit ledger; billing settings are placeholders |

**What exists is the schema, not the function.** `contacts.enrichment_data` jsonb, `enrichment_source`, `last_enriched_at`; `companies` equivalents; `prospect_research_profiles`, `prospect_research_sources`, `generated_content`, `ai_prompt_templates`. A codebase-wide search for writers of `last_enriched_at` / `enrichment_source` returns **only `filter-field-registry.ts`** — a filter declaration. Nothing populates these fields except CSV import.

The AI tables serve *research/personalisation* (drafting copy), not data enrichment.

---

## Part 5 — Edge functions (21)

All are Deno, all inherit `verify_jwt = true` (no per-function config).

| Function | Lines | Purpose | Tables touched | Auth | Used by UI |
|---|---|---|---|---|---|
| `run-import-job` | 1,652 | CSV import: normalize → dedup → insert/enrich. Self-continuing | `import_jobs`, `import_job_rows`, `contacts`, `companies`, `contact_field_history`, `list_contacts` | JWT | **Yes** |
| `import-historical-verifications` | 1,040 | Ingest ZeroBounce/MillionVerifier/EmailListVerify exports | `historical_imports`, `verification_cache`, `imported_datasets` | JWT | **Yes** |
| `verification-worker-api` | 451 | 13-action worker API + admin reads | `verification_*` | **Worker secret** / JWT | **Yes** (admin) |
| `process-linkedin-queue` | 364 | Execute LinkedIn actions via Unipile/HeyReach/PhantomBuster | `linkedin_action_queue`, `linkedin_action_history` | JWT | **Yes** |
| `export-verification-results` | 353 | Export preserving original CSV layout | `verification_results`, Storage | JWT | **Yes** |
| `process-sequence-steps` | 337 | Email sequence worker ("Instantly-style") | `sequence_enrollments`, `sequence_steps`, `message_queue` | JWT | **Yes** |
| `send-email` | 314 | Send via configured mailbox | `emails`, `mailboxes`, `email_events` | JWT | **Yes** |
| `ingest-verification-upload` | 309 | "Email Verification Memory" ingestion | `verification_cache`, `imported_datasets` | JWT | **Yes** |
| `repair-import-staging` | 292 | Repair broken import staging | `import_job_rows`, `import_quarantine_rows` | JWT | Admin |
| `email-admin-tools` | 258 | Email admin utilities | email tables | JWT | Admin |
| `process-email-queue` | 252 | Drain the outbound queue | `message_queue`, `emails` | JWT | Background |
| `crm-detect-replies` | 229 | Reply detection + classification (**AI gateway**) | `inbox_threads`, `inbox_messages` | JWT | **Yes** |
| `crm-ai-summary` | 215 | AI account/opportunity summaries (**AI gateway**) | `opportunities`, `generated_content` | JWT | **Yes** |
| `run-export-job` | 196 | Background export, 5,000-row batches | `export_jobs`, `contacts`/`companies`, Storage | JWT | **Yes** |
| `run-background-jobs` | 194 | Generic job dispatcher | various | JWT | Background |
| `verify-domain-dns` | 179 | SPF/DKIM/DMARC checks | `sending_domains` | JWT | **Yes** |
| `run-dedup-scan` | 170 | Contact dedup scan | `duplicate_groups`, `duplicate_candidates` | JWT | **Yes** |
| `crm-bulk-push-runner` | 150 | Bulk CRM push | `crm_bulk_push_jobs`, `_job_rows` | JWT | **Yes** |
| `run-company-dedupe` | 123 | Company dedupe by domain | `companies`, `merge_history` | JWT | **Yes** |
| `import-watchdog` | 115 | Detect and recover stalled imports | `import_jobs` | JWT | Background |
| `crm-stale-sweeper` | 113 | Age out stale CRM records | `opportunities`, `crm_review_queue` | JWT | Background |

### Issues worth noting

1. **`run-import-job` is 1,652 lines** in one file, operating under a 25-second CPU budget. It contains two pre-existing TypeScript errors (`SupabaseClient` generic mismatches from the esm.sh types) — harmless, but they mask new errors. A third error, `jobId` used where `job_id` was in scope, was a live `ReferenceError` breaking **all** enrichment in the default import mode from 27 June 2026 until fixed on the unmerged branch.
2. **No per-function JWT configuration.** Worth an explicit `[functions.verification-worker-api] verify_jwt = false` decision rather than relying on the default.
3. **No rate limiting on the worker API** beyond quota accounting.
4. **`run-background-jobs` is a generic dispatcher** — what it actually dispatches requires live verification.
5. **AI gateway dependency.** `crm-ai-summary` and `crm-detect-replies` depend on `ai.gateway.lovable.dev`. Given the stated goal of vendor independence, this is a Lovable-hosted dependency inside your own Supabase functions.

---

## Part 6 — Integration readiness summary

| Integration | Status |
|---|---|
| Email verification engine | **FULLY BUILT** (external worker, own repo) — operational status unknown |
| LinkedIn (Unipile / HeyReach / PhantomBuster) | **PARTIALLY BUILT** — adapter pattern ready |
| AI (via Lovable gateway) | **PARTIALLY BUILT** |
| Instantly | **NOT IMPLEMENTED** |
| Apollo | **NOT IMPLEMENTED** (CSV import only) |
| Any enrichment provider | **NOT IMPLEMENTED** |
| Any ESP (SendGrid/Postmark/SES) | **NOT IMPLEMENTED** — sending goes through configured mailboxes |
| Stripe / billing | **NOT IMPLEMENTED** |
| CRM (HubSpot/Salesforce) | **NOT IMPLEMENTED** — `push_to_crm()` exists but targets the internal CRM |
| Slack / Calendly / Google / Webhooks in | **NOT IMPLEMENTED** |
