# CI Gate

## The command

```bash
npm ci && npm run check
```

`npm run check` runs four phases in order and **stops at the first failure**, so the output names the phase that broke:

| Phase | Command | Catches |
|---|---|---|
| 1. Frontend types | `npm run typecheck` | `tsc --noEmit` over `src/` |
| 2. Shared-module drift | `npm run check:shared` | A mirrored `_shared/` copy diverging from its `src/lib/` source |
| 3. Edge function types | `npm run check:functions` | `deno check` over all 21 functions — **nothing else type-checks these** |
| 4. Tests | `npm run test` | 270 Vitest tests |

Runtime is roughly 90 seconds, most of it phase 3 fetching remote types.

## Exit codes

Non-zero on any failure. Nothing is swallowed:

- Phases are chained with `&&`, so a failure short-circuits the rest
- `check-edge-functions.mjs` exits 1 on a regression **and** on an unrecorded improvement, so gains get locked into the baseline instead of drifting back
- `sync-shared-modules.mjs --check` exits 1 and names each drifting module
- Vitest exits non-zero on any failing test

## Why phase 3 exists

Edge functions are Deno with URL imports, so `tsc` never saw them. Nothing type-checked them until this sprint. Two production bugs were found the first time it ran, both compile-time detectable, both swallowed by `catch` blocks and surfaced as ordinary data errors:

- `run-import-job` passed `jobId` where the variable in scope was `job_id` — `ReferenceError` on every enrichment for **83 days**
- `process-linkedin-queue` called `.catch()` on a `PostgrestFilterBuilder`, which is thenable but has no `.catch` — `TypeError` thrown inside an error handler, aborting the queue loop after actions were already claimed

It has since caught four scope errors in new code before they reached a commit.

## The baseline file

`scripts/edge-function-baseline.json` records pre-existing errors so the gate passes today:

```json
{
  "run-import-job": 2,
  "send-email": 1
}
```

`run-import-job` ×2 are cosmetic `SupabaseClient` generic mismatches from the esm.sh types. `send-email` ×1 is the CC limitation, documented rather than silent.

**The baseline is meant to shrink.** It started at 6 functions / 8 errors. Lower it with:

```bash
node scripts/check-edge-functions.mjs --update-baseline
```

Never raise it to make a failing build green — the check exists precisely to stop that.

## GitHub Actions (proposed, not created)

```yaml
name: check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - uses: denoland/setup-deno@v1
        with: { deno-version: v2.x }
      - run: npm ci
      - run: npm run check
```

Pinning Deno in the workflow avoids `npx --yes deno@2` re-resolving on every run.

## Making it mandatory

Once the workflow is green on `main`, require the `check` status in branch protection. Until then it is a convention, not a gate — and conventions are what let a `ReferenceError` live for 83 days.
