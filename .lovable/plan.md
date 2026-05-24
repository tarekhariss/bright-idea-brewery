# Historical Intelligence Learning System

Build a learning layer on top of the existing verification engine so imported EmailListVerify datasets continuously improve future verification, cache, retry, and safety decisions. Plus rebuild the export pipeline so exports always preserve the user's uploaded columns with `verification_status` prepended.

This plan is split into 5 phases that ship independently.

---

## Phase 1 — Data foundation (DB migration)

### New / extended tables

**`email_history`** (per-email longitudinal record)
- email, email_normalized, domain, source, source_dataset_id, original_status, original_reason, original_provider, original_verification_date, imported_at, historical_only, age_in_days, freshness_state, raw_payload jsonb, workspace_id, created_at

**`imported_datasets`**
- id, workspace_id, source ('EmailListVerify' default), filename, file_type (csv/xlsx/txt/zip), row_count, mapping jsonb, status, uploaded_by, uploaded_at, finished_at, stats jsonb

**Extend `verification_cache`**
- + source, imported_at, historical_only, imported_dataset_id, original_status, original_reason, original_provider, original_verification_date, age_in_days, freshness_state, trust_score, recheck_required, last_transition

**Extend `domain_intelligence`**
- + repeated_ok_count, repeated_bad_count, transition_ok_to_bad, transition_unknown_to_ok, reputation_score, bounce_rate_estimate, last_evaluated_at, trend_30d, trend_90d

**`provider_behavior`** (Google Workspace, Microsoft365, Proofpoint, Mimecast, Yahoo, Barracuda, Cloudflare Email, custom)
- provider_key, greylist_rate, timeout_rate, throttle_rate, avg_recovery_minutes, recommended_retry_interval_s, recommended_timeout_ms, stability_score, sample_count, last_evaluated_at

**`smtp_learning`** — per provider+response_code: count, success_after_retry, avg_retry_delay, recommended_strategy
**`confidence_learning`** — per (provider, original_status, age_bucket): observed_match_rate, sample_count, suggested_confidence
**`bounce_learning`** — per domain+provider: bounce_count, hard_bounce_count, soft_bounce_count, predicted_bounce_probability

### Freshness classifier (SQL function)
```
fresh    age < 30
aging    30..90
stale    90..180
expired  >= 180
```
Recomputed nightly via pg_cron + on insert via trigger.

### RLS
All new tables workspace-scoped via `is_workspace_member_or_admin`; learning aggregates readable by workspace members, writable only by service role / edge functions.

---

## Phase 2 — Import pipeline (CSV / XLSX / TXT, zip in v2)

Edge function `import-historical-verifications` (already exists) — expanded:

1. Accept upload reference + mapping (email, verification_status, result, date_verified, reason, confidence, provider, domain, source_file, tags, campaign).
2. Parse CSV (papaparse), XLSX (sheetjs), TXT (newline-delimited). Zip in Phase 5.
3. Create `imported_datasets` row, stream rows in batches of 1k.
4. For every row:
   - Normalize email + domain.
   - Compute `age_in_days` from `original_verification_date`, derive `freshness_state`.
   - Insert into `email_history`.
   - Upsert `verification_cache` only when row is **not** expired AND status maps cleanly; mark `historical_only=true`, `recheck_required=true` for Unknown/Risky/Catch-all/low-confidence/stale.
   - Increment aggregates: `domain_intelligence`, `provider_behavior`, `confidence_learning`, `bounce_learning`, `smtp_learning`.
5. Emit `dataset_imported` activity + stats (counts per status, per freshness, per provider).

UI: extend Historical Imports page with a mapping wizard (auto-detect EmailListVerify columns), preview first 20 rows, and per-dataset detail page showing stats.

---

## Phase 3 — Learning loop & decision engine

Edge function `historical-intelligence-recompute` (cron, every 15 min) updates aggregates:

- **Trust scoring per email**: repeated OK across ≥2 historical rows + fresh → trust_score up; repeated dead/invalid/spamtrap/disposable → trust down + bounce risk up.
- **Transitions**:
  - historical Unknown → later OK ⇒ feed `provider_behavior.recommended_retry_interval_s`, `avg_recovery_minutes`.
  - historical OK → later bounce/dead ⇒ shorten that domain's cache TTL, raise `recheck_required`.
- **Provider stability**: rolling 30/90d greylist/timeout/throttle rates per provider.
- **Confidence model** (`confidence_learning`) recomputes match-rate buckets used by the verifier worker.

Verifier worker (existing `external/verifier-worker/worker.mjs`) consumes these as **hints only** — never blindly trusts. Update its cache-lookup to honor `recheck_required`, freshness_state, and provider stability score.

### Outputs surfaced per email
- `safe_to_send_score` (0..100)
- `estimated_bounce_probability`
- `campaign_safety_tier` (safe / caution / risky / block)
- `warmup_recommendation`
- `recheck_urgency`

Exposed via `verification_cache` columns + a `get_email_intelligence(email)` SQL function.

---

## Phase 4 — Dashboards

New routes under `/verification/intelligence`:
- **Domain reputation trends** (top domains, OK%, bounce%, 30d delta)
- **Provider stability trends** (greylist/throttle/timeout per provider, 30d)
- **Recovery success trends** (Unknown→OK rate over time)
- **Bounce trends** + historical OK→bounce transitions table
- **Stale-data decay** (freshness distribution across cache + history)
- **Dataset detail** (per import: rows, status mix, providers, contribution to learning)

Built with existing chart kit, server-side aggregated via new SQL views.

---

## Phase 5 — Export rebuild (CRITICAL FIX)

Rewrite `supabase/functions/export-verification-results`:

### Contract
- Input: job_id, format ('csv' | 'xlsx'), filter ('safe_to_send' | 'recommended' | 'all' | 'custom'), custom_filter, include_intelligence (bool).
- Load the job's **original uploaded file/columns** from storage (preserved at upload time — fix the upload step to persist the raw header + row order to `verification_jobs.original_columns jsonb` and rows to `verification_job_rows.raw_row jsonb`).
- For each contact: output `verification_status` as the **first column**, then the original columns in original order, then (optional) intelligence columns: confidence_score, deliverability_score, bounce_risk, provider_detected, freshness_state, last_verified_at, verification_reason, unknown_subclass, safe_to_send_score.
- Never drop rows. Rows without a result get `verification_status=Unknown`.
- CSV via streaming csv-stringify, XLSX via sheetjs `aoa_to_sheet` preserving column order.
- Filters operate **on rows**, not on columns — original structure is always intact.

### Upload fix (precondition for export fix)
- `VerificationPage` upload → store raw CSV/XLSX to storage bucket `verification-uploads`.
- Persist `original_columns` + ordered `raw_row` per contact row.
- Backfill not attempted for old jobs (they keep current best-effort export).

---

## Technical notes

- Mapping wizard reuses existing `ImportReviewPanel` patterns.
- All new edge functions: CORS via `npm:@supabase/supabase-js@2/cors`, JWT validated in code, internal calls via `x-cron-secret`.
- Recompute jobs scheduled via `pg_cron` + `net.http_post` (inserted via `supabase--insert`, not migration).
- Storage bucket `verification-uploads` (private) with workspace-scoped RLS on `storage.objects`.
- No new external API keys required; everything runs on Lovable Cloud.

---

## Suggested rollout order

1. Phase 5 export fix + upload preservation (unblocks immediate pain).
2. Phase 1 schema.
3. Phase 2 import pipeline + mapping UI.
4. Phase 3 learning loop + worker integration.
5. Phase 4 dashboards.
6. Zip-import support (v2).

Shall I start with Phase 5 (export fix) and Phase 1 (schema) in the first build?
