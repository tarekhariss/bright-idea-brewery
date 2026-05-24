## Diagnosis

The 978-email job finished in ~1s because `enqueue_verification_job` (migration `20260524181924`) **unconditionally reuses any non-expired `verification_cache` row** — for every email, regardless of:

- the job's `verification_quality` (fast / balanced / **high_accuracy**)
- the cached `status` (unknown / risky / catch-all are reused as-is)
- whether the cached row has SMTP/provider metadata

When all rows hit the cache, the function marks the job `completed` immediately. The worker never sees the job, so:
- `workers 0/0`, `avg latency 0ms`, `recovery 0`, `throughput` reflects DB insert speed
- cache hit % shows 0 because the UI reads a different field (`from_cache` is set on results, but the dashboard widget reads `cached_hit_count` from a stat that isn't surfaced)
- High Accuracy never triggers Pass 2–5 recovery

## Fix plan

### 1. Cache intelligence (DB)

Rewrite `enqueue_verification_job` so reuse depends on **status + confidence + quality + freshness + completeness**:

**Safe to reuse** (any quality mode):
- `valid` with `confidence >= 80` and `verified_at > now() - interval '30 days'`
- `invalid` with deterministic reason: `invalid_syntax`, `invalid_mx`, `dead_server`, `disposable`, `spamtrap`
- always reuse: `disposable`, `spamtrap`, `invalid_syntax`

**Never auto-reuse**:
- `unknown`, `risky`, `catch_all`, `ok_for_all`, `smtp_protocol`, `antispam`
- `confidence < 70`
- rows missing `mx_record` or `smtp_response`
- rows older than 30 days

**High Accuracy** additionally forces live re-verification for any non-`valid`/non-deterministic-invalid status, regardless of cache freshness — unless the caller passes `cache_policy = 'trusted'`.

New optional param `_cache_policy public.verification_cache_policy` with values:
- `trusted_cache` — current behavior (reuse anything fresh)
- `default` — rules above
- `recheck_weak` — reuse only deterministic invalid + high-conf valid; re-verify everything else
- `force_live` — skip cache entirely

### 2. Per-row execution trace

Add columns to `verification_results`:
- `result_source text` (`live_smtp` | `cache` | `history` | `recovery` | `syntax` | `mx_only`)
- `claimed_by_worker text`
- `worker_version text`
- `pass_number int` (1–5)
- `smtp_attempt_count int default 0`
- `recovery_attempt_count int default 0`
- `provider_detected text`
- `used_probe boolean default false`
- `finalization_reason text`
- `reuse_kind text` (`reused_from_cache` | `reused_from_history` | `reused_from_previous_job` | null)

Populate `result_source='cache'` + `reuse_kind` in the enqueue function when a cache hit is used. The worker populates the rest when it processes a row.

### 3. Job-level counters

Add to `verification_jobs`:
- `live_smtp_count int default 0`
- `recovery_count int default 0`
- `skipped_live_verification_count int default 0`
- `reused_from_cache_count int default 0`
- `reused_from_history_count int default 0`
- `cache_policy public.verification_cache_policy`

Backfill from existing `cached_hit_count` (→ `reused_from_cache_count`).

### 4. UI

**Upload dialog (`VerificationPage` upload flow)**: add a "Cache policy" select with the 4 options above (default = `default` for Balanced, `force_live` for High Accuracy).

**Job detail page (`JobDetailPage`)**:
- Show `cache_policy`, `live_smtp_count`, `recovery_count`, `reused_from_cache_count`, `skipped_live_verification_count`
- Fix metric labels: if `live_smtp_count == 0`, throughput/latency/worker tiles display "—  (all results reused from cache)" instead of `0ms` / `0/0`
- Per-row drawer/table: surface `result_source`, `pass_number`, `worker_version`, `provider_detected`, `finalization_reason`

### 5. Worker (`external/verifier-worker/worker.mjs`)

On every result it submits back, include: `result_source: 'live_smtp' | 'recovery'`, `pass_number`, `smtp_attempt_count`, `recovery_attempt_count`, `provider_detected`, `used_probe`, `finalization_reason`, `worker_version`. The `verification-worker-api` `submit` endpoint persists those into `verification_results`.

Bump worker to `1.3.0`.

### 6. Worker API

Extend `submit` payload schema in `supabase/functions/verification-worker-api/index.ts` to accept and persist the new trace fields, and increment the new job counters (`live_smtp_count`, `recovery_count`, etc.) atomically.

## Files changed

- new migration: schema + rewritten `enqueue_verification_job`
- `supabase/functions/verification-worker-api/index.ts` — accept trace fields, update counters
- `external/verifier-worker/worker.mjs` — emit trace fields, v1.3.0
- `src/pages/tools/VerificationPage.tsx` — cache policy selector in upload
- `src/pages/verification/JobDetailPage.tsx` (+ tool variant) — new metrics tiles, fixed labels, per-row trace
- `src/hooks/use-verification.ts` — pass `cache_policy` to RPC, expose new fields

## Out of scope (call out, not building now)

- Pass 2–5 recovery scheduling internals already exist in the worker; this plan only ensures HA rows actually reach the worker and that the trace surfaces what happened. If recovery scheduling itself is broken we'll address in a follow-up after we can see real worker trace data.
