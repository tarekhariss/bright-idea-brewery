# Sprint 0H — Observability Baseline

**Principle:** do not overbuild. Use existing infrastructure. Ship the smallest thing that would have caught the bugs we actually had.

---

## 1. The test case for any observability proposal

Two real bugs ran in production for months. Both were **compile-time detectable**. Neither triggered an alert, because both were swallowed by `catch` blocks and surfaced as ordinary data errors.

| Bug | Live for | Why nobody noticed |
|---|---|---|
| `run-import-job` passed `jobId` where `job_id` was in scope → `ReferenceError` on every enrichment | **83 days** | Caught by a `try/catch` that wrote `enrich_exception: …` into a row's `error_message`. Looked like bad vendor data |
| `process-linkedin-queue` calls `.catch()` on a `PostgrestFilterBuilder` (thenable, but has no `.catch`) → `TypeError` **inside an error handler**, aborting the queue loop after actions are already claimed | Unknown | Only fires when a LinkedIn action fails — the path nobody watches |

**Any observability plan that would not have caught these is the wrong plan.** An APM dashboard would not have. A type-check in CI would have caught both, in seconds, before deploy.

That is why the implemented baseline starts with static checks rather than runtime monitoring.

---

## 2. Implemented in Sprint 0

### 2.1 Edge function type checking ✅

`scripts/check-edge-functions.mjs` — runs `deno check` over all 21 edge functions. **Nothing type-checked them before**: they are Deno with URL imports, so `tsc` never saw them.

Results on first run:

| | |
|---|---|
| Functions checked | 21 |
| Clean | **15** |
| With errors | **6** (8 errors total) |

A baseline file (`scripts/edge-function-baseline.json`) records the pre-existing errors so the check passes today. It fails when a function **gets worse**, and also when one **gets better** — prompting you to lock the improvement in. The baseline is meant to shrink.

### 2.2 Unified verification gate ✅

```bash
npm run check
```

Runs, in order: `typecheck` (tsc) → `check:shared` (shared-module drift) → `check:functions` (Deno) → `test` (141 tests). **Currently passes end to end.**

Individually: `npm run typecheck`, `npm run check:shared`, `npm run check:functions`, `npm run test`.

**This is the CI gate.** It takes ~90 seconds and would have prevented both bugs above.

### 2.3 Shared-module drift guard ✅ (pre-existing, now in the gate)

Verified to genuinely fail: tampering with the mirrored copy fails both the script and the test; restoring returns it to green.

---

## 3. New bugs surfaced by the type check

These were **found by 2.1** and are **not fixed** — Sprint 0D was scoped to the six existing commits. Listed for your decision.

| Function | Error | Assessed impact |
|---|---|---|
| `process-linkedin-queue:340` | `.catch()` on a `PostgrestFilterBuilder` | **HIGH.** `TypeError` thrown inside the per-row `catch`, so it escapes that handler and aborts the loop. Actions are claimed at line 183 *before* the loop, so already-claimed actions go unprocessed **and** the failure is never recorded. A single failing action can stall the queue |
| `export-verification-results:96` | `mode === "all"` where `mode` is `"safe_to_send" \| "recommended" \| "custom"` — **always false** | **MEDIUM.** The branch is unreachable. Records without a verification result are always excluded from exports. If an "export everything" mode was intended, it does not work |
| `send-email` | `'cc' does not exist in type 'SendConfig'` | **MEDIUM.** CC recipients are silently dropped by the SMTP library |
| `crm-detect-replies` | `'skipped' is specified more than once, so this usage will be overwritten` | **LOW.** A counter is overwritten by a later spread — reply-detection stats are wrong |
| `import-historical-verifications` | Right operand of `??` unreachable | **LOW.** Dead fallback |
| `run-import-job` ×2 | `SupabaseClient` generic mismatch from esm.sh types | **NONE.** Cosmetic, but it masks real errors in the noisiest file |

**Recommendation:** fix `process-linkedin-queue` in Sprint 0 — it is a one-line change (`await` the RPC inside a `try`, or drop the `.catch()`), it is the same bug class we just spent a sprint on, and it can stall a production queue. The rest can wait for Sprint 1.

---

## 4. Proposed, not implemented

### 4.1 CI wiring — **highest remaining value**

`npm run check` exists but nothing runs it automatically. A GitHub Actions workflow on push/PR turns it from a command someone remembers into a gate nobody can bypass.

**Effort:** ~20 lines of YAML. **Risk:** none. **Recommend for Sprint 0 completion.**

### 4.2 Error-class novelty alerting

The `jobId` bug was visible in the database the whole time — `error_message` began with a string that had never appeared before. Nobody was looking.

```sql
-- New error classes in the last 24h that never appeared before
with recent as (
  select distinct split_part(error_message, ':', 1) as cls
  from public.import_job_rows
  where created_at > now() - interval '24 hours' and error_message is not null
), historical as (
  select distinct split_part(error_message, ':', 1) as cls
  from public.import_job_rows
  where created_at <= now() - interval '24 hours' and error_message is not null
)
select r.cls as new_error_class from recent r
left join historical h using (cls) where h.cls is null;
```

**A new error class appearing is the signal.** Volume is not — the bug produced a steady, unremarkable rate for 83 days.

### 4.3 System health view

The schema already has the ingredients: `verification_engines.last_heartbeat_at`, `verification_workers`, `cron.job_run_details`, `message_queue` depth, `import_jobs.status`, `verification_dead_letter`.

Proposal: a single read-only SQL **view** (additive migration, no data change) that any admin page can select from:

```
verification_engine_heartbeat    ACTIVE | IDLE | NEVER
verification_queue_depth         n pending, oldest age
verification_dead_letter_count   n
cron_last_run / cron_last_status per job
message_queue_depth              by queue_type
stalled_imports                  processing > 1h
recent_export_failures           24h
```

**Defer to after Sprint 0A.** Building a health view before knowing what is healthy is backwards — the Phase 0 SQL answers that first, and its output should shape what the view surfaces.

### 4.4 External error tracking (Sentry or equivalent)

**Why it is needed:** edge functions currently log to `console.log`. Supabase retains function logs for a limited window and has no alerting. When `process-linkedin-queue` throws its `TypeError` tonight, nobody finds out.

**Why it is not enough on its own:** neither of our two real bugs would have paged anyone — both were caught by `try/catch` and never reached an uncaught handler. Error tracking complements the static gate; it does not replace it.

**Proposed shape — isolated behind an abstraction, as instructed:**

```ts
// supabase/functions/_shared/telemetry.ts
export function reportError(err, context): void   // no-op unless DSN is set
export function reportEvent(name, data): void
```

One module, one env var, every function importing the same interface. Swapping vendors touches one file. If no DSN is configured it is a no-op, so nothing breaks in local or preview.

**Recommend deferring the vendor choice** until 4.1 and 4.2 are in place — they are free and catch more of what has actually hurt you.

---

## 5. Recommended Sprint 0 completion

| # | Item | Effort | Status |
|---|---|---|---|
| 1 | Edge function type check | done | ✅ |
| 2 | `npm run check` gate | done | ✅ |
| 3 | Fix `process-linkedin-queue` `.catch()` | ~1 line | **Awaiting your decision** |
| 4 | CI workflow running `npm run check` | ~20 lines | Proposed |
| 5 | Error-class novelty query into the health SQL | small | Proposed |
| 6 | System health view | medium | **After 0A** |
| 7 | External error tracking | medium | Sprint 1 |

**What is deliberately excluded:** APM, distributed tracing, custom metrics pipelines, log aggregation. None would have caught the bugs we had, and all would cost more than they return at this stage.
