# Sprint 0D/0E — Validation of the Six Correctness Fixes

**Branch:** `fix/search-correctness-and-scale` (6 commits, never pushed — `origin/main` is at `8ce5226`)
**Test baseline:** 141 tests, 8 files, **all passing** (re-run 2026-09-19)
**Recommendation:** merge 4 of 6 immediately; gate 2 behind the scale test in Part 2.

---

# Part 1 — Commit-by-commit validation

## Verdict table

| # | Commit | Risk | Migration | Merge now? |
|---|---|---|---|---|
| 1 | `cd4ef21` list filters + search escaping | Low | None | **Yes** |
| 2 | `d48a7d4` estimated counts | Low | None | **Yes** |
| 3 | `2da99a7` lead quality gate + `jobId` fix | **Split** | None | **Yes** — but see 3b |
| 4 | `d8cd605` candidate-based dedup | **Medium** | None | **Gate on scale test** |
| 5 | `a971065` company domain key | **Medium** | None | **Gate on scale test** |
| 6 | `7339e41` normalizer extraction | Low | None | **Yes** |

**No commit contains a migration.** No schema change, no generated-column rewrite, no data migration. All six are application-code only. That materially lowers merge risk and makes rollback trivial.

---

## 1. `cd4ef21` — List filters beyond 1,000 + search escaping

### Bug A — list filters silently truncated

`resolveListFilters()` fetched `list_contacts` with **no `.limit()`**, so PostgREST's default 1,000-row cap applied silently. The resolved IDs were then sent back as a client-side `IN` array.

Any list with more than 1,000 members filtered against a **truncated membership set**. No error, no warning — wrong rows returned as if correct.

Exclusions failed harder: every UUID was inlined into the request URL. ~1,000 UUIDs ≈ 37 KB of URL, exceeding header limits → HTTP 414, request dies.

### Bug B — search was injectable

Six call sites interpolated raw user input into PostgREST filter strings, where `,` `.` `(` `)` are **structural**:

```js
query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
```

Typing `Smith, John` did not merely fail to match — the comma split the filter and **injected an additional condition**. RLS still bounded what could be read, but results were manipulable and ordinary punctuation produced wrong answers.

### Fix

- List membership pushed into SQL via aliased resource embeds: `!inner` semi-join for includes, left embed + `is.null` anti-join for excludes. Only list IDs travel in the URL, so request size and correctness stop depending on list size.
- `lib/postgrest-filter.ts` — central escaping using PostgREST's documented double-quote mechanism; `*` wildcards survive quoting. Applied to all six call sites.

### Tests — 33

- `postgrest-filter.test.ts` (17): commas, dots, parentheses, embedded quotes, backslashes, empty strings, null, and an explicit injection-neutralisation case
- `list-filters.test.ts` (11): embed shapes, alias distinctness, and that **no contact IDs are ever inlined**
- `list-filters.integration.test.ts` (5): asserts the **URL the real supabase-js client emits** — embed syntax confirmed, not assumed

### Production impact

**Positive and immediate.** Any client audience built from a list over 1,000 members has been wrong. Post-merge, list-filtered results change — **this is the fix, not a regression.** Expect audience sizes to grow.

### Rollback

`git revert cd4ef21`. No state to unwind.

---

## 2. `d48a7d4` — Estimated counts

### Bug

`count: "exact"` runs a full `COUNT(*)` over the filtered set as a second round trip, **on every keystroke** (300 ms debounce). Invisible at 10k rows; at 1.2M it dominates response time.

### Fix

Prospect search switched to `count: "estimated"` — planner estimate above a threshold, exact below. `isEstimatedCount` exposed so the UI renders `~1.2M` instead of a precise-looking figure that shifts between refreshes.

### Tests — 7

`format-count.test.ts`: exact rendering below threshold, abbreviation above, and an explicit assertion that an estimate never renders as an exact-looking number.

### Production impact

**User-visible.** Prospect search totals above 1,000 become approximate and display with `~`. Narrow searches are unchanged. **Only prospect search** — the other 91 exact-count sites are untouched (see `PERFORMANCE_BASELINE.md`).

### Rollback

`git revert d48a7d4`.

---

## 3. `2da99a7` — Lead quality gate **and** the `jobId` fix

**This commit does two unrelated things and should be understood as two changes.**

### 3a — The `jobId` ReferenceError (the critical half)

```js
p_import_job_id: jobId,   // not in scope — the variable is job_id
```

In Deno this throws `ReferenceError` on every call. It sits inside a `try`, so the error was swallowed and the row was marked `enrich_exception: jobId is not defined`.

`enrich` is the **default** import mode. Every duplicate row that should have enriched an existing contact instead failed — **continuously from 2026-06-27 to 2026-09-18, 83 days**, with no intervening commits to that file.

**This is a one-token fix with no behavioural risk and the largest positive impact of the six.** See `IMPORT_RECOVERY_PLAN.md`.

### 3b — The lead quality gate (the half needing a decision)

Adds name↔email coherence scoring. `John Johnstone <patrickwhite@acme.com>` scores 5/100 and is rejected.

**Enabled by default** (`qualityConfig.enabled !== false`) with `rejectBelow: 25`, `reviewBelow: 70`.

**This changes import behaviour on the next run.** Rows that previously imported will now be rejected or sent to review. 55 tests cover the false-rejection cases that matter (nicknames, diacritics, non-Western name orders, role mailboxes, aliases), and missing data never rejects — but the thresholds have **never been calibrated against your actual vendor files.**

**Recommendation:** merge with `lead_quality.enabled = false` as the initial default, run one import with it observing-only, read `error_summary.lead_quality.tally`, then enable. The gate records its verdict breakdown per job specifically so this can be judged before trusting it.

### Tests — 56

`email-name-match.test.ts` (55) + `shared-modules.test.ts` (1, drift guard).

### Rollback

Whole commit: `git revert 2da99a7` — but this restores the `jobId` bug. **Preferred:** disable the gate via job settings, keep the fix.

---

## 4. `d8cd605` — Dedup independent of table size ⚠ **gate this**

### Bug

Every invocation preloaded **all** contacts and companies in scope into memory — paged 5,000 at a time to a hard ceiling of **500,000** — before processing a single row.

At 1.2M contacts this failed three ways at once:

1. **The 500,000 ceiling is silent.** Contacts beyond it were invisible to dedup, so imports created duplicates of records already held.
2. Half a million contact objects exceeds an edge function's memory budget.
3. The function re-invokes itself near the CPU limit, so **the whole preload repeated every invocation** — frequently consuming the entire time budget before reaching any rows.

### Fix

Each batch fetches only the records its own 250 rows could match, via `.in()` lookups on generated, indexed columns. Cost becomes proportional to batch size rather than table size.

`buildContactIndex`, `buildCompanyIndex` and `checkDuplicatesAdvanced` are **untouched** — matching semantics are identical; only the working set changed, and the queries deliberately fetch a superset of what those indexes key on.

### Why this needs gating

**It changes how dedup queries real data, and I could not execute it against your database.** The correctness argument is sound and type-checked, but it rests on an assumption: that stored values match what the candidate queries look for. Three generated columns were found to violate exactly that assumption (commit 5). There may be a fourth I did not find.

**Specific residual risk:** phone matching. There is no `normalized_phone` column, so the query looks for both the normalized and raw forms. Contacts created outside the import path may store a third spelling and be missed. Phone is the weakest signal (confidence 55 → review only), so the blast radius is small — but it is a known gap.

### Tests

**None directly.** This is the gap. The change is inside a Deno edge function that cannot be imported under Vitest (module-level `Deno.serve`). Validation must be empirical — Part 2.

### Rollback

`git revert d8cd605` restores the preload, including its 500k blindness. No state to unwind.

---

## 5. `a971065` — Company domain key ⚠ **gate this**

### Bug

`companies.normalized_domain` is `lower(coalesce(domain,''))` — it lowercases and nothing else. `normalizeDomain()` strips scheme, `www.` and path. The index preferred the column when non-empty, so a company stored as `www.acme.com` was keyed under that while lookups asked for `acme.com`. **Never matched. Duplicate company created.**

Domain is the strongest company identity signal, making this the costliest of the normalisation mismatches. The same class affected company *names* (`acme inc` vs `acme`) in commit 4's file.

### Fix

One definition — `companyDomainKey()` — used by the index, the cross-batch cache and newly created companies alike. Candidate lookup also queries the unstripped variants so rows already stored with a prefix remain reachable.

### Why this needs gating

Same reason as commit 4: it changes matching against real stored data. **Expected effect is that dedup starts matching things it previously missed** — which means merges that did not happen before will now happen.

**That is the intended fix, but it is a one-way operation on production data.** A soft merge is reversible (`merged_into`), but at volume, reversing is painful.

### Tests — 44

`import-normalizers.test.ts` covers the normalisers and pins each SQL/JS divergence with stand-ins for the generated columns. It does **not** test the live matching path.

### Rollback

`git revert a971065`. Merges already performed are **not** undone by the revert — they are soft and reversible via `merged_into`, but require a deliberate un-merge.

---

## 6. `7339e41` — Normalizer extraction

### Bug (structural)

The functions deciding whether two records are the same person lived inside a 1,652-line edge function with no tests. The same bug class appeared **four times**.

### Fix

Canonical implementation in `src/lib/import-normalizers.ts`, mirrored into `supabase/functions/_shared/` by `scripts/sync-shared-modules.mjs`, with a Vitest guard that fails on drift. Copies are verbatim — behaviour is unchanged by construction.

### Tests — 44 + 1 drift guard

The drift guard was **verified to actually fail**: tampering with the shared copy failed both the script and the test; restoring returned it to green.

### Production impact

**None expected** — pure refactor with verbatim copies.

### Rollback

`git revert 7339e41`.

---

# Part 2 — Sprint 0E: Dedup production-scale validation plan

The two gated commits need empirical proof. **This plan does not modify production.**

## Environment options, in order of preference

| Option | Safety | Fidelity |
|---|---|---|
| **A. Supabase branch / restored clone** | Highest — production untouched | Full |
| **B. Dedicated test workspace in production** | Good — RLS + `workspace_id` scope the blast radius | High |
| **C. Production, `import_mode: 'review'`** | Acceptable — nothing merges without human approval | Full |

**Recommendation: A if a clone exists, otherwise C.** Option C is genuinely safe because `review` mode writes no merges — every duplicate lands in the review queue for inspection.

## Test fixture — 7 cases, ~5,000 rows

Build a CSV containing known-answer rows:

| # | Case | Construction | Expected |
|---|---|---|---|
| 1 | Exact email duplicate | Copy an existing contact's email | `exact_duplicate`, conf 100 |
| 2 | LinkedIn duplicate | Existing LinkedIn URL, different email | `exact_duplicate`, conf 95 |
| 3 | Name + domain duplicate | Existing name, email at same company domain | `likely_duplicate`, conf 80 |
| 4 | Company duplicate — **www prefix** | Company whose stored `normalized_domain` starts `www.` | **Must match** — this is commit 5's whole point |
| 5 | Company duplicate — **legal suffix** | `Acme Inc` where stored name is `acme inc` | **Must match** |
| 6 | Merged contact | Email of a contact with `merged_into` set | Resolves to the **survivor**, not the archived row |
| 7 | **Beyond the 500k boundary** | Contact with the highest `id` in `order by id` — previously invisible | **Must match.** The single most important case |
| 8 | Genuine new contact | Fabricated, no match possible | `new` — guards against over-matching |

Query to find case 7's subject:

```sql
select id, email, first_name, last_name
from public.contacts
where merged_into is null and email is not null
order by id desc limit 5;
```

Pad to ~5,000 rows with genuine new contacts so batching, self-continuation and timing are exercised realistically.

## Measurements

From `import_jobs.error_summary.timings` and the counters:

| Metric | Where | Pass criterion |
|---|---|---|
| Detection accuracy | Per-row `duplicate_match_reason` | **8/8 correct.** Case 7 is the gate |
| `candidate_lookup_ms` | `error_summary.timings` | Small and **flat across batches** — a rising trend means it still scales with table size |
| Batch duration | Timings | No batch near the 25s cap |
| Errors | `error_rows`, `import_job_rows.status='error'` | **Zero** new error classes |
| `duplicate_rows` | Job counters | **Higher** than a comparable pre-fix import — that is the fix working |
| Memory | Edge function logs | No `WORKER_RESOURCE_LIMIT` |

## Comparison baseline

Run the **same fixture twice** — once on `main`, once on the branch — into the same test workspace. Differences are then attributable to the change rather than to the data.

Expected delta: cases 4, 5 and 7 fail on `main` and pass on the branch.

## Go / no-go

**GO** — all 8 cases correct, `candidate_lookup_ms` flat, zero new errors, no memory failures.

**NO-GO** — case 7 fails (fix ineffective), any false positive on case 8 (over-matching — worse than under-matching, it merges distinct people), `candidate_lookup_ms` grows per batch, or new error classes appear.

**A false positive on case 8 is the one result that should stop the merge outright.** Missing a duplicate costs a duplicate row. Merging two different people destroys data.

---

# Part 3 — Merge sequence

```
1. Push branch, open PR                              (no production effect)
2. Merge cd4ef21, d48a7d4, 7339e41                   (low risk, immediate benefit)
3. Merge 2da99a7 with lead_quality.enabled = false   (captures the jobId fix)
4. Run one import; read error_summary.lead_quality   (calibrate thresholds)
5. Run the Part 2 fixture on main vs branch          (the gate)
6. On GO: merge d8cd605 + a971065 together           (they are interdependent)
7. Re-run the fixture on main to confirm             (post-merge verification)
8. Enable lead_quality once thresholds are calibrated
```

Steps 2 and 3 can proceed **today** — they stop active data corruption, carry no migration, and revert cleanly. Steps 5–6 need the fixture and an environment decision from you.

---

# Part 4 — Bugs found by the edge-function type checker (Sprint 0, added 2026-09-20)

These were **not** among the original six. They were surfaced by
`scripts/check-edge-functions.mjs`, which type-checks all 21 edge functions —
something nothing had ever done, because they are Deno with URL imports and
`tsc` never saw them.

**Baseline movement:** 6 functions with 8 errors → **2 functions with 3 errors.**

## 4.1 `process-linkedin-queue` — queue poison pill ✅ FIXED

### The bug

```js
await supabase.rpc("linkedin_record_action_result", { ... }).catch(() => {});
```

`supabase.rpc()` returns a `PostgrestFilterBuilder`. It is **thenable** — it
implements `then` — but it has **no `.catch` method**. Calling `.catch()` on it
throws `TypeError: ... .catch is not a function`.

That call sits inside the per-row `catch (rowErr)` handler. A throw from inside a
catch block is **not** caught by that same block, so it escapes the loop entirely.

### Why it mattered

Actions are claimed atomically at line 183, **before** the loop:

```js
const { data: batch } = await supabase.rpc("linkedin_claim_due_actions", { _limit: MAX_BATCH });
```

So when any single action threw:

1. The per-row handler ran
2. It tried to record the failure
3. The `TypeError` escaped the handler
4. **The loop aborted**
5. Every action already claimed further down the batch went unprocessed **and** unrecorded
6. The failure of the original action was never recorded either

One failing action could stall the rest of the batch — a poison pill.

### A second defect the type error masked

PostgREST **does not reject** on a database error; it *resolves* with
`{ data, error }`. So even a correctly written `.catch()` would never have fired
for a failed RPC. The failure would have sat silently in the resolved value.

### The fix

`src/lib/safe-rpc.ts` — `settleRpc()` awaits inside try/catch, treats a returned
`error` payload as a failure, and **never throws**. Mirrored into
`supabase/functions/_shared/` by the existing sync script and covered by the
drift guard.

The call site becomes:

```js
await settleRpc(
  supabase.rpc("linkedin_record_action_result", { ... }),
  (reason) => console.error(`[process-linkedin-queue] could not record failure for action ${action.id}: ${reason}`),
);
```

Scope: one import, one call site replaced. The queue is otherwise untouched.

### Tests — 16, in `src/lib/safe-rpc.test.ts`

Reproduces the original failure and proves the fix:

- a builder-like thenable has no `.catch`
- calling `.catch()` on it throws `TypeError`
- **that throw escapes a surrounding catch block** — the bug, reproduced exactly
- `settleRpc` contains rejections, resolved `error` payloads, bare strings, null
- it never throws, and survives a reporter that itself throws
- **Batch simulation, 5 actions with the 3rd failing:**
  - BEFORE: the old pattern aborts the batch (`rejects.toThrow(TypeError)`)
  - AFTER: all 5 processed, in order
  - AFTER: the failure is recorded
  - AFTER: counters correct (4 succeeded, 1 failed, sum = batch size)
  - AFTER: processing continues even when recording *also* fails — nothing recorded, nothing stranded
  - AFTER: 5 consecutive failures do not compound

### Codebase scan

Searched for `.catch()` on Supabase builders across `src/` and
`supabase/functions/`. **Exactly one genuine occurrence** — the one fixed.

`src/pages/ImportJobDetail.tsx:80` uses
`supabase.functions.invoke(...).catch(...)`, which returns a **real Promise**.
Valid, not a bug, **not modified**.

## 4.2 `export-verification-results` — NOT a bug ✅ dead code cleaned

**Correction to the earlier assessment in `OBSERVABILITY_PLAN.md`**, which
claimed unverified records were always excluded from exports. That was wrong.

`Mode` is declared `"safe_to_send" | "recommended" | "all" | "custom"` — it
**does** include `"all"`, `"all"` is handled at line 95, and `"all"` is the
**default** (line 212). Unverified records are exported by default, as intended.

TypeScript narrowed `mode` after line 95 (if it were `"all"` we would have
returned), making line 96's `mode === "all"` provably false. Dead code that
happened to return the correct answer.

Replaced with an explicit `return false` and a comment. **Behaviour identical.**

## 4.3 `crm-detect-replies` — user-visible wrong status ✅ FIXED

```js
const stats = { scanned: 0, classified: 0, queued: 0, auto_pushed: 0, skipped: 0, errors: 0 };
...
return { skipped: true, reason: "auto_detect_disabled", ...stats };
```

`stats.skipped` is a **counter** of skipped messages. Spreading it after
`skipped: true` overwrote the boolean with a number. Two user-visible failures in
`CrmReviewQueue.tsx:64`, which reads `if (r?.skipped)`:

1. **Workspace with auto-detect disabled** → `skipped: 0` → falsy → shows
   "Scanned 0, queued 0, auto-pushed 0" instead of "Auto-detection is disabled"
2. **Successful run that skipped ≥1 message** → `skipped: 3` → truthy → shows
   "Auto-detection is disabled" **even though it ran**

Fixed by disambiguating the flag from the counter:

```js
return { ...stats, auto_detect_disabled: true, reason: "auto_detect_disabled" };
```

Consumer updated to read `r?.auto_detect_disabled`. No regression risk: the
boolean never reached the caller, so nothing could have depended on it.

## 4.4 `import-historical-verifications` — dead fallback ✅ removed

`(existing?.learning_signals ?? {}) ?? {}` — the inner `?? {}` already guarantees
non-nullish, so the outer was unreachable. Removed. **Behaviour identical.**

## 4.5 `send-email` — CC and BCC silently dropped ⚠ **NOT FIXED — decision required**

### Confirmed, with library evidence

`deno.land/x/smtp@v0.7.0` declares:

```ts
interface SendConfig { to: string; from: string; subject: string; content: string; html?: string; }
```

No `cc`, no `bcc`. And `send()` issues `RCPT TO:` **only** for `config.to`, and
writes only `Subject`, `From`, `To` and `Date` headers.

CC and BCC recipients therefore receive **nothing** — no header, no delivery.

### It is exposed to users

`CampaignOptionsTab.tsx:637` renders a CC input, saved to the campaign and
persisted to `emails.cc`. Users can set CC today and it is discarded at send time.

### Why it is not fixed here

The library cannot do it. A real fix means one of:

| Option | Risk |
|---|---|
| **A.** Swap to a maintained SMTP library (e.g. `denomailer`) supporting cc/bcc | **Medium** — changes the production send path |
| **B.** Hand-roll additional `RCPT TO` commands | High — requires reimplementing library internals |
| **C.** Remove CC/BCC from the UI until supported | None — but removes a feature users may be relying on |

Swapping the SMTP library on a live sending path is beyond "smallest possible
change" in a sprint whose purpose is establishing trust in the foundation.
**Escalated for decision.**

Note: `send()` also takes `to` as a single parsed address, so multiple primary
recipients are likely affected by the same limitation. Not investigated further.
