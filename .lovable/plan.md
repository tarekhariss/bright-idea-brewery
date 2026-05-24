# Unknown Recovery Optimization

Goal: aggressively reduce the 64.2% unknown rate by turning the verification engine into a multi-stage, provider-aware recovery system with greylisting handling, SMTP session intelligence, and staged retry queues — fully integrated into the existing VPS worker, queue, scoring, and dashboard.

## Architecture (text diagram)

```
verification_results (pending)
        │
   ┌────▼─────┐
   │ Pass 1   │  fast standard verify (existing flow)
   └────┬─────┘
        │ unknown?
   ┌────▼─────┐    classify_unknown_reason()
   │ classify │──► smtp_session_log + verification_recovery_queue
   └────┬─────┘
        │
        ▼
verification_recovery_queue   (provider-aware scheduler)
  ├─ Pass 2: adaptive provider retry          (delay ~ provider_profile.retry_base)
  ├─ Pass 3: greylisting backoff              (1m → 5m → 15m → 30m)
  ├─ Pass 4: anti-spam recovery               (rotate HELO/from, longer wait)
  └─ Pass 5: extended timeout fallback        (high timeout, single-shot)
        │
        ▼
final status OR classified unknown
(likely_valid | likely_invalid | greylisted | provider_blocked | temporary_failure | high_risk_unknown)
```

## Database changes (single migration)

New tables:
- `provider_profiles` — seeded rows for microsoft365, google_workspace, yahoo, proofpoint, mimecast, barracuda, cloudflare_email, generic. Columns: mx_pattern[], banner_pattern[], smtp_timeout_ms, connect_timeout_ms, retry_base_seconds, retry_multiplier, max_concurrency, greylisting_strategy, helo_rotation bool, notes.
- `verification_recovery_queue` — result_id (FK), workspace_id, job_id, email, provider_key, pass_number (2..5), reason_code, attempt_count, next_attempt_at, last_smtp_code, last_smtp_message, state (queued|in_flight|done|exhausted), created_at, updated_at. Indexes on (state, next_attempt_at), (provider_key, state).
- `smtp_session_log` — result_id, email, provider_key, mx_host, banner, helo_used, response_code, response_text, latency_ms, tls_used, disconnect_reason, pass_number, captured_at. Partitionable later; for now plain table + retention via cron (30d).
- `greylisting_events` — domain, provider_key, detected_at, recovered_at, attempts, success bool. Used for analytics.
- `unknown_reason_stats` (materialized via cron) — provider_key, reason_code, day, count, recovery_rate.

Columns added to `verification_results`:
- `unknown_reason` text (timeout|antispam|dns_temp|conn_reset|smtp_disconnect|provider_throttle|greylisting|mailbox_busy|temp_reject|worker_timeout|ratelimit|tls_fail)
- `unknown_confidence` text (likely_valid|likely_invalid|temporary_failure|greylisted|provider_blocked|high_risk_unknown)
- `provider_key` text
- `recovery_passes` int default 1
- `last_recovery_at` timestamptz

Functions (SQL, all SECURITY DEFINER, search_path = public):
- `detect_provider(_mx text, _banner text) returns text` — pattern-match against provider_profiles, fallback `generic`.
- `classify_unknown_reason(_smtp_code int, _smtp_text text, _err text) returns text` — regex/code map.
- `classify_unknown_confidence(_reason text, _pass int, _provider text) returns text`.
- `enqueue_recovery(_result_id uuid, _reason text, _smtp_code int, _smtp_text text)` — picks next pass based on reason + history, computes `next_attempt_at` from provider_profile (greylisting uses 1/5/15/30m schedule).
- `claim_recovery_batch(_limit int, _provider_key text default null)` — atomic claim for worker, returns rows where state=queued and next_attempt_at<=now().
- `complete_recovery(_id uuid, _status text, _smtp_code int, _smtp_text text, _latency int)` — writes back to verification_results, may re-enqueue next pass or finalize.
- `recovery_metrics()` — JSON for ops dashboard.

Triggers:
- After UPDATE on `verification_results` when status flips to `unknown` on pass 1 → call `enqueue_recovery`. (Skip if `verification_mode='cache'`.)

Cron:
- `verification-recovery-tick` every minute → calls worker API `/recovery/tick` (drains due rows by handing them to active workers via existing claim path, or fires a lightweight recovery dispatch).
- `recovery-rollup` every 15 min → refresh `unknown_reason_stats`, expire `smtp_session_log` >30d.

Seed data: 8 provider_profiles rows with sensible defaults (M365 timeouts 30s, greylisting common; Google rare greylist, fast retries; Proofpoint/Mimecast aggressive antispam → longer backoff and HELO rotation; generic fallback).

## Edge function: verification-worker-api (extend existing)

New endpoints:
- `POST /recovery/claim` — body `{worker_id, limit, providers?}` → returns recovery rows + provider profile hints (timeouts, concurrency, helo strategy). Marks `state=in_flight`.
- `POST /recovery/submit` — body `{recovery_id, status, smtp_code, smtp_text, latency_ms, banner, mx_host, tls_used, helo_used, disconnect_reason}`. Writes `smtp_session_log`, classifies reason/confidence, calls `complete_recovery`. If still unknown and pass<5 → schedules next pass; if exhausted → finalizes `unknown_confidence`.
- `POST /recovery/tick` — internal (x-cron-secret). Wakes workers / no-op metrics update.
- `GET /recovery/metrics` — JSON: pass-level counts, provider breakdown, greylist recovery rate, top SMTP codes, reason breakdown, recovery throughput.

Existing `/claim` extended: also returns `provider_hint` field on each row (uses last-known provider for domain from `smtp_session_log` or `domain_intelligence`), and `recommended_timeout_ms` from provider_profile.

Existing `/submit` extended: when status=unknown, captures `smtp_code/text/latency/banner/mx/tls/helo` from worker payload, writes `smtp_session_log`, classifies `unknown_reason`, fires `enqueue_recovery` (the trigger also covers safety).

## VPS worker (`external/verifier-worker/worker.mjs`)

- Add recovery loop alongside main claim loop:
  - Every `RECOVERY_INTERVAL_MS` (default 15s), call `/recovery/claim` with current capacity.
  - For each item, apply `provider_hint` settings: per-provider `timeout`, `concurrency`, optional `helo` from rotation pool (env `SMTP_HELO_POOL` comma list, fallback to default).
  - Greylisting strategy: if reason=greylisting, use minimal verification mode (RCPT only, no VRFY), longer wait between commands.
  - Anti-spam (pass 4): rotate HELO, randomize from-email, longer connect timeout.
  - Pass 5: extended timeout (e.g. 60s).
  - Submit to `/recovery/submit` with full SMTP session data.
- Connection pooling: lightweight per-MX queue (`Map<mx_host, p-queue>`), drains serially per host respecting `per_domain_delay_ms` from provider_hint. Reuses Node `net`/`tls` sockets within a pool window (60s idle TTL).
- Reports new heartbeat field `recovery_in_flight` so ops dashboard can show it.
- `.env.example` updated with `RECOVERY_INTERVAL_MS`, `RECOVERY_CONCURRENCY`, `SMTP_HELO_POOL`, `SMTP_FROM_POOL`.

(Engine `engine/main.go` already returns enough metadata; we surface SMTP code/text via existing `aftership-email-verifier` `SMTP` block and pass through.)

## Frontend

Operations dashboard (`src/pages/verification/OperationsDashboardPage.tsx`) — extend with new panels (using existing kit + recharts):
- Unknown Reason Breakdown (pie + table) from `/recovery/metrics`.
- Provider Failure Breakdown (bar by provider_key).
- Greylisting Recovery (success rate gauge + trend line).
- Retry Success by Pass (stacked bar pass 2..5).
- Top SMTP Error Codes (table with count, recovery rate).
- Recovery Pipeline Live (counts: queued/in_flight/done/exhausted per pass).

New page `src/pages/verification/RecoveryPipelinePage.tsx` (registered route already exists in nav as Retry Pipeline) — full table of `verification_recovery_queue` with filters by provider, reason, pass; manual "force retry" / "abandon" actions (admin-only RPC).

JobDetailPage: add small "Recovery in progress" card when job has rows in recovery queue, showing how many unknowns are being recovered and projected final unknown rate.

Hook: `src/hooks/use-verification-platform.ts` — add `useRecoveryMetrics()`, `useRecoveryQueue(filters)` calling worker API edge function.

## Files to create / edit

Created:
- `supabase/migrations/<ts>_unknown_recovery.sql` (schema + functions + triggers + seed)
- `src/pages/verification/RecoveryPipelinePage.tsx`

Edited:
- `external/verifier-worker/worker.mjs` (recovery loop, pooling, provider-aware behavior)
- `external/verifier-worker/.env.example`
- `supabase/functions/verification-worker-api/index.ts` (new endpoints, classifier helpers, hints in /claim, capture in /submit)
- `src/pages/verification/OperationsDashboardPage.tsx` (new panels)
- `src/pages/verification/JobDetailPage.tsx` (recovery-in-progress card)
- `src/hooks/use-verification-platform.ts` (new hooks)
- `src/App.tsx` (register `/verification/recovery-pipeline` if not already pointing at a real page)
- A pg_cron schedule via `supabase--insert` for the tick + rollup.

## Out of scope (explicit)

- Engine binary changes (Go) — using existing AfterShip verifier responses; we only read more fields it already returns.
- Replacing Pass 1 logic — kept identical to preserve current dashboards.
- Editing `src/integrations/supabase/types.ts` (auto-generated).

## Risk notes

- Trigger-fired enqueue must be idempotent (unique on result_id + pass_number) to avoid double-queue from worker resubmits.
- Recovery loop must respect per-provider concurrency so we don't trip Microsoft 365 throttles.
- All new RPCs gated by `x-cron-secret` or workspace RLS as appropriate.
- Greylisting backoff caps at 30m; after pass 5 finalize as `unknown_confidence='greylisted'` (treated as risky, not invalid).

If you approve, I'll ship the migration first, wait for confirmation, then edit the worker + edge function + UI in one batch.