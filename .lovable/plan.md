# Email Intelligence & Deliverability Platform

This is a very large scope. To ship it safely without breaking the live verification system (worker, /claim, /submit, campaign safety, 978-row queue, Railway engine), I'll deliver in **4 phases**. Each phase is independently usable. I'll start Phase 1 on approval; subsequent phases follow without re-asking unless you want to change direction.

Nothing existing gets removed. The current `verification_jobs`, `verification_results`, `verification-worker-api`, Railway worker, VPS engine, and `/verification` UI all stay and get **extended**.

---

## Phase 1 — Intelligence schema + historical importer + freshness engine

**New tables (workspace-scoped, RLS):**
- `email_history` — per-email longitudinal record (one row per email, append-only events linked).
- `verification_events` — every state change (verified, bounced, replied, opened, sent).
- `historical_imports` — admin uploads of EmailListVerify/legacy exports, with column mapping.
- `provider_behavior` — per-provider metrics (gmail, outlook, gsuite, zoho, custom, etc.).
- `smtp_patterns` — learned SMTP response → outcome mapping per provider.
- `verification_quality_logs` — per-job quality mode, retry counts, unknown-recovery success.
- `worker_activity_logs` — heartbeat history, throughput, errors, version.
- `bounce_intelligence` — aggregated bounce reasons per domain/provider/pattern.
- `domain_intelligence` — extends `domain_reputation` with deliverability_score, mx_health, freshness, learning signals.

**Extended columns on `verification_results`:**
`historical_status`, `current_status`, `status_changed_at`, `last_verified_at`, `last_seen_valid_at`, `last_bounce_at`, `last_campaign_sent_at`, `last_reply_at`, `last_open_at`, `confidence_decay_score`, `deliverability_score`, `risk_level`, `freshness_label`, `recheck_required`, `provider_type`, `verification_source`, `verification_quality`, `domain_reputation_score`, `smtp_result`, `mx_status`, `verification_reason`, `greylisting_detected`, `catch_all_probability`, `bounce_risk_score`.

**Extended statuses (enum additions):** `ok`, `ok_for_all`, `email_disabled`, `invalid_syntax`, `dead_server`, `invalid_mx`, `antispam_system`, `smtp_protocol`, `spamtrap`, `greylisted`, `temporary_failure`, `provider_blocked`. Existing statuses preserved; mappings provided.

**Freshness engine (SQL functions + nightly cron):**
- `compute_freshness(_email)` → `fresh|aging|stale|expired` based on `last_verified_at`.
- `compute_decay(_email)` → confidence × age curve.
- `compute_recheck_required(_email)` → boolean + reason.
- pg_cron nightly: refresh freshness labels, decay scores, recheck flags across all verified rows.

**Historical Dataset Importer (admin only):**
- New page `/verification/imports/historical` with CSV/XLSX wizard.
- Column mapper: email, status, confidence, result, reason, date, source, disposable, role_based, catch_all, domain, mx, bounce, smtp_response, provider, verification_quality + custom.
- Imports go to `historical_imports` + populate `email_history`, `domain_intelligence`, `provider_behavior`, `smtp_patterns`, `bounce_intelligence` — but mark `verification_source = 'historical'` and never as `live`. Campaign safety treats them as intelligence-only past 90 days.
- Edge function `import-historical-verifications` for chunked processing of large files (>50k rows).

---

## Phase 2 — Engine extensions: quality modes, unknown recovery, learning loop

**Worker API extensions (`verification-worker-api`):**
- Accept new `/submit` fields: `smtp_result`, `mx_status`, `provider_type`, `greylisting_detected`, `catch_all_probability`, `bounce_risk_score`, `verification_reason`, `verification_quality`, all extended statuses.
- New `/recheck` endpoint for unknown-recovery retries with adaptive backoff.
- `/quality-mode` accepts `standard` or `high` per job.

**VPS engine (`external/verifier-worker/engine/main.go`):**
- High-quality mode: 3 retries with provider-aware backoff (gmail 30s/2m/10m, outlook 60s/5m/15m, others adaptive), greylisting detection (450/451), antispam detection, dead-server detection, spamtrap heuristics.
- Provider detection from MX records → writes `provider_type`.
- SMTP response parser → maps to extended statuses + learns patterns into `smtp_patterns`.

**Worker (`external/verifier-worker/worker.mjs`):**
- Reads `verification_quality` per job, applies correct engine mode.
- Posts learning signals to `/submit-learning` for `smtp_patterns`, `provider_behavior`, `bounce_intelligence`.

**Continuous learning RPCs:**
- `record_smtp_pattern(_provider, _response, _outcome)` — updates pattern confidence.
- `record_bounce_outcome(_email, _smtp_code, _category)` — feeds bounce_intelligence + email_history.
- `record_engagement(_email, _event)` — when campaign emails get reply/open, update `last_reply_at`/`last_open_at` and bump deliverability_score.

---

## Phase 3 — Operations dashboard + intelligence UI

**Replace `DashboardPage` and add new pages under `/verification`:**
- **Operations Dashboard** — live processing, worker health pills, queue health, throughput (last 1h/24h/7d), accuracy trends, freshness mix, confidence heatmap, VPS engine health (CPU/latency from heartbeat metadata), SMTP failure top-10, retry success %, provider response trends, bounce trends.
- **Provider Intelligence** — per-provider table with sends, accept/reject rate, greylisting %, top SMTP responses, learned patterns count.
- **Domain Intelligence (upgrade)** — risk heatmap, deliverability_score column, freshness mix, recheck queue.
- **Bounce Intelligence (upgrade)** — categorized bounces, per-provider patterns, top failing domains.
- **Historical Imports** — list of imports, row counts, contribution to learning, rollback.
- **Verification Quality** — per-job mode, retry stats, unknown recovery success.
- **Freshness Monitor** — counts by label, recheck queue, scheduled re-verifications.

**Status analytics widget** (used on Job Detail + Dashboard): all 14 statuses with count, %, trend sparkline, confidence avg, freshness mix, "Reverify recommended" CTA.

**Live worker monitoring widgets** — heartbeat age, claimed/in-flight/last error, throughput sparkline. Already partially exists; extended with VPS metrics.

---

## Phase 4 — Smart exports + campaign safety upgrade

**Export engine (new edge function `export-verification-results`):**
- Reads original upload via `historical_imports.original_file_path` or `verification_jobs.source_file_path` (we'll start persisting these to Supabase Storage in Phase 1).
- Preserves all original columns + original row order + duplicate mapping.
- Prepends intelligence columns: status, confidence_score, deliverability_score, risk_level, freshness_label, verification_date, last_verified_at, domain_reputation, recheck_required, bounce_risk, provider_type, mx_status, smtp_result, historical_status, verification_reason.
- CSV + XLSX output (XLSX via `npm:exceljs`).
- Export modes: Safe to Send, Recommended, Simplified, All Emails, Custom Filters.
- Filter set: OK only, OK+OK_for_all, exclude catch-all/risky/disposable/spamtrap/role/stale/unknown, fresh only, high-confidence only, confidence threshold, provider/domain/freshness/bounce-risk filters.

**Export UI** — new `ExportDialog` on Job Detail with mode picker + custom filter panel + preview count.

**Campaign safety upgrade (`check_campaign_list_safety`):**
- Blocks on: hard-bounced (permanent suppression), invalid, disposable, suppressed, high bounce_risk_score, stale/expired without recheck, low confidence_decay_score.
- Warns on: catch-all, risky, role-based, unknown, risky provider, risky domain.
- Auto-triggers re-verification for stale rows before launch (uses existing worker pool, marked `verification_source = 'live'`).
- Hard-bounce → permanent suppression unless admin explicitly restores via new audit-logged action.

**Freshness labels rendered everywhere:** Fresh, Aging, Stale, Expired, Recheck Required, Recently Reverified, Safe to Send, High Risk, Low Confidence, Historical Match, Live Verified.

---

## Architecture & non-functional

- All changes additive — existing pages, hooks, and worker contract keep working through Phase 1–3. Phase 4 swaps the export UI.
- Storage bucket `verification-uploads` (private, RLS) for original CSVs so exports can reconstruct rows.
- `verification_source` enum: `live | historical | imported_legacy | api`.
- `freshness_label` enum: `fresh | aging | stale | expired | reverified`.
- `risk_level` enum: `low | medium | high | critical`.
- All new RPCs SECURITY DEFINER with `search_path = public`, RLS via `is_workspace_member_or_admin` or `is_platform_admin` for historical imports.
- No external API keys required. No new connectors.
- Hard-bounce permanent suppression governed by `suppression_list.reason = 'hard_bounce_permanent'` + admin-only restore RPC.

---

## What I will NOT do
- Will not break the current `claim_verification_batch` contract or the running 978-row queue.
- Will not change Railway worker secret or env names.
- Will not remove existing `/verification` pages — they get upgraded in place.
- Will not modify auth, payments, or unrelated modules.
- Will not implement live engagement-tracking integrations (Gmail/Outlook open/reply ingestion) beyond accepting RPC events — wiring to mailbox providers can be a follow-up.

---

## Delivery order on approval

1. **Phase 1** in next turn — full schema migration + Historical Importer page + freshness cron + extended statuses. ~1 large migration + ~6 new files.
2. **Phase 2** turn after — worker/engine extensions + learning RPCs. Touches `external/verifier-worker/*` + edge function.
3. **Phase 3** — Operations dashboard, Provider/Domain/Bounce upgrades, Freshness Monitor, Quality page.
4. **Phase 4** — Export engine + smart filters + campaign safety upgrade + hard-bounce suppression.

Approve to start Phase 1.
