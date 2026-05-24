# Phase 2 — Email Intelligence Engine

Builds on Phase 1 schema (provider_behavior, smtp_patterns, domain_intelligence, bounce_intelligence, email_history, verification_events, freshness/decay functions).

## 1. Scoring Engine (SQL)

New migration adding SECURITY DEFINER functions:

- `compute_deliverability_score(_result_id uuid)` → writes `deliverability_score`, `confidence_decay_score`, `bounce_risk_score`, `risk_level` on `verification_results`.
- `compute_provider_reputation(_provider text)` → updates `provider_behavior.reputation_score` from success/bounce/greylist rates.
- `compute_domain_reputation_v2(_domain text)` → extends `compute_domain_risk` with engagement + freshness signals, writes `domain_intelligence`.
- `compute_catch_all_probability(_domain text)` → uses `smtp_patterns` accept-all rates.
- `score_inputs` weights: SMTP status 35%, history 20%, freshness 15%, provider rep 10%, domain rep 10%, bounce history 5%, engagement 5%.
- Trigger `tg_verification_result_score` on insert/update of status fields → recomputes scores + risk_level + freshness_label.

## 2. Smart Verification Decision Layer

`decide_verification_strategy(_workspace_id, _email)` returns jsonb:
```
{ strategy: 'cache'|'light'|'full'|'high_quality', reason, cached_result_id }
```
Used by `verification-worker-api` `/claim` (already exists) — extend to set `verification_quality` on the claimed row and pass `quality_mode` to worker.

Also exposed as edge function `verification-decide` for the live single-email checker (pre-check before enqueuing).

## 3. Unknown Recovery Engine

`schedule_recheck(_result_id, _reason)` SQL function:
- Maps reasons (`greylisted`, `temporary_failure`, `antispam_system`, `smtp_protocol`, `unknown`) → backoff windows (1m, 5m, 15m, 1h, 6h) using provider-aware multipliers from `provider_behavior.avg_retry_delay_seconds`.
- Sets `recheck_required=true`, `next_recheck_at`, increments `retry_count`.
- pg_cron job `verification-recheck-sweeper` every minute → re-queues due rows by clearing `verified_at` so worker re-claims them.

## 4. Worker Intelligence

Extend `supabase/functions/verification-worker-api/index.ts`:
- `/claim` now also returns `quality_mode`, `provider_hint`, `domain_concurrency_cap` per row (from `provider_behavior`).
- `/submit` records `smtp_patterns` row, calls `record_smtp_pattern`, `record_engagement` where applicable, triggers scoring recompute.
- `/fail` calls `schedule_recheck` for transient classes; otherwise dead-letters.
- `/heartbeat` updates `verification_workers` + `worker_activity_logs` (throughput, success rate, quality).
- New `/intelligence` GET returns provider+domain throttling hints for the worker to self-tune concurrency.

No worker secret / Railway env changes.

## 5. Export Intelligence Engine

New edge function `export-verification-results`:
- Modes: `safe_to_send`, `recommended`, `simplified`, `all`, `custom`.
- Filters use `deliverability_score`, `bounce_risk_score`, `risk_level`, `freshness_label`, `recheck_required` (not raw status alone).
- Streams CSV or XLSX; preserves original CSV columns by joining with `historical_imports.source_file_url`.
- Prepends intelligence columns: `intel_status, deliverability_score, confidence, bounce_risk, risk_level, freshness, provider, domain_reputation, recommendation`.

## 6. Campaign Safety Layer

Extend `check_email_send_eligibility` to also block:
- `deliverability_score < 40`
- `bounce_risk_score > 70`
- `risk_level IN ('high','critical')`
- `freshness_label IN ('stale','expired')` unless reverified
- domain on `domain_intelligence` blocklist (`is_blocked=true`)
Returns reasons + recommended `revalidate` action.

## 7. Domain Intelligence Dashboard (UI)

New page `src/pages/verification/DomainIntelligencePage.tsx` (+ route, nav entry):
- Domain search/list with health, deliverability trend (Recharts line), bounce trend, freshness distribution donut, catch-all %, provider mix, reverification cadence, last 50 events table.
- Reads from `domain_intelligence`, `verification_events`, `bounce_intelligence`, `provider_behavior`.

## 8. Operations Dashboard (UI)

New page `src/pages/verification/OperationsDashboardPage.tsx` (+ route, nav):
- Live worker cards (heartbeat, throughput, success%, quality) from `verification_workers` + `worker_activity_logs`.
- Queue throughput + verification speed (last 60 min sparkline).
- Retry monitoring (pending rechecks, dead-letter count).
- Provider failure + greylisting panel from `smtp_patterns` aggregated last 24h.
- SMTP intelligence metrics + verification quality metrics.
- 5s polling via React Query.

## 9. Continuous Learning Loop

- Triggers on `verification_events` insert → bump `provider_behavior` + `domain_intelligence` aggregates.
- pg_cron `intelligence-rollup` every 5 min → recompute provider/domain reputations + decay scores via `refresh_email_freshness_batch`.
- Existing `record_smtp_pattern`, `record_bounce_outcome`, `record_engagement` already feed this — wire them from worker submit/fail.

## Technical notes

- All new SQL is additive, SECURITY DEFINER, `search_path=public`, RLS unchanged (workspace member or platform admin).
- No new secrets, connectors, or Railway env vars.
- Worker contract stays backward compatible — new fields are optional.
- Export edge function deploys with `verify_jwt = false` (uses internal x-cron-secret OR session token forwarded by client invoke).
- Files touched:
  - `supabase/migrations/<ts>_intelligence_phase_2.sql` (scoring, decision, recheck, learning triggers, cron)
  - `supabase/functions/verification-worker-api/index.ts` (extend)
  - `supabase/functions/verification-decide/index.ts` (new)
  - `supabase/functions/export-verification-results/index.ts` (new)
  - `src/pages/verification/OperationsDashboardPage.tsx` (new)
  - `src/pages/verification/DomainIntelligencePage.tsx` (new)
  - `src/components/verification/VerificationLayout.tsx` (nav)
  - `src/App.tsx` (routes)

Shipping in one pass; UI uses existing design tokens, Recharts, shadcn cards/tabs.
