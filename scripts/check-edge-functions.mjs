#!/usr/bin/env node
/**
 * Type-checks every Supabase Edge Function with Deno.
 *
 * Edge functions are Deno with URL imports, so `tsc` never sees them. Nothing
 * type-checked them until this check existed, and two production bugs were
 * found the first time it ran — both compile-time detectable, both swallowed by
 * catch blocks and surfaced as ordinary data errors:
 *
 *   run-import-job passed `jobId` where the variable in scope was `job_id`,
 *   throwing ReferenceError on every enrichment for 83 days.
 *
 *   process-linkedin-queue called .catch() on a PostgrestFilterBuilder, which
 *   is thenable but has no .catch — TypeError inside an error handler, aborting
 *   the queue loop after actions were already claimed.
 *
 * BASELINE POLICY
 *
 * The baseline records EXACT diagnostics — function, TS code, and the message
 * with volatile parts normalised — not counts and not filename patterns. A
 * count-based baseline lets one error be silently swapped for another; a
 * pattern-based one hides whole categories.
 *
 * The check fails when:
 *   - a diagnostic appears that is not baselined          (new error)
 *   - a baselined diagnostic is no longer produced        (fixed — shrink it)
 *   - a baselined diagnostic's message changes materially (moved/altered)
 *
 * The baseline is currently EMPTY and should stay that way. Anything that
 * would add to it is a decision, made explicitly with --update-baseline, not a
 * side effect of a failing build.
 *
 *   node scripts/check-edge-functions.mjs
 *   node scripts/check-edge-functions.mjs --update-baseline
 */
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const functionsDir = join(root, "supabase", "functions");
const baselinePath = join(root, "scripts", "edge-function-baseline.json");

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : {};

const updating = process.argv.includes("--update-baseline");

/**
 * Normalise a diagnostic message so cosmetic churn does not cause false
 * failures, while a material change still does.
 *
 * Deliberately conservative: only absolute paths, line/column references and
 * quoted identifiers that carry positions are normalised. Type names and the
 * substance of the message are preserved, because a change there IS material.
 */
function normalizeMessage(message) {
  return message
    .replace(/file:\/\/\/[^\s'"]+/g, "<file>")
    .replace(/\b\d+:\d+\b/g, "<pos>")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse `deno check` output into structured diagnostics. */
function parseDiagnostics(output) {
  const clean = output.replace(/\[[0-9;]*m/g, "");
  const found = [];
  for (const line of clean.split("\n")) {
    const m = line.match(/^(TS\d+) \[ERROR\]: (.+)$/);
    if (m) found.push({ code: m[1], message: normalizeMessage(m[2]) });
  }
  return found;
}

const key = (d) => `${d.code} ${d.message}`;

/** --only=<name> restricts the run to one function. Used by the gate regression
 *  test so it does not re-check all 21 on every assertion. */
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyName = onlyArg ? onlyArg.slice("--only=".length) : null;
const functions = readdirSync(functionsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name)
  .filter((name) => existsSync(join(functionsDir, name, "index.ts")))
  .filter((name) => !onlyName || name === onlyName)
  .sort();

const results = {};
let newErrors = 0;
let fixedErrors = 0;

for (const name of functions) {
  const entry = join(functionsDir, name, "index.ts");
  let output = "";
  let failed = false;
  try {
    execFileSync("npx", ["--yes", "deno@2", "check", entry], {
      stdio: "pipe",
      encoding: "utf8",
      shell: process.platform === "win32",
    });
  } catch (err) {
    failed = true;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  const diagnostics = parseDiagnostics(output);

  // The exit code is the source of truth, not the parser.
  //
  // Deno reports a SyntaxError as `error: SyntaxError: …`, not as
  // `TSxxxx [ERROR]:`. An earlier version of this script parsed only the
  // latter, so a file that did not even parse was reported CLEAN and the whole
  // gate exited 0. Anything that makes deno fail but produces no recognised
  // diagnostic is surfaced here rather than silently passing.
  if (failed && diagnostics.length === 0) {
    const detail = output.replace(/\[[0-9;]*m/g, "").split("\n")
      .find((l) => l.trim().startsWith("error:")) ?? "deno check failed with no parseable diagnostic";
    diagnostics.push({ code: "DENO_FAIL", message: normalizeMessage(detail) });
  }
  results[name] = diagnostics;

  // Tolerate the older count-based baseline format: it carries no diagnostic
  // detail, so treat it as empty and let the run report what is actually there.
  const recorded = baseline[name];
  const expected = Array.isArray(recorded) ? recorded : [];
  if (recorded !== undefined && !Array.isArray(recorded)) {
    console.warn(`legacy      ${name}: count-based baseline ignored — re-run with --update-baseline`);
  }
  const expectedKeys = new Set(expected.map(key));
  const actualKeys = new Set(diagnostics.map(key));

  const unexpected = diagnostics.filter((d) => !expectedKeys.has(key(d)));
  const missing = expected.filter((d) => !actualKeys.has(key(d)));

  if (unexpected.length > 0) {
    newErrors += unexpected.length;
    console.error(`NEW ERROR   ${name}`);
    for (const d of unexpected) console.error(`            ${d.code}: ${d.message.slice(0, 150)}`);
  }
  if (missing.length > 0) {
    fixedErrors += missing.length;
    console.log(`FIXED       ${name} — ${missing.length} baselined diagnostic(s) no longer occur`);
    for (const d of missing) console.log(`            ${d.code}: ${d.message.slice(0, 150)}`);
  }
  if (unexpected.length === 0 && missing.length === 0) {
    console.log(diagnostics.length === 0 ? `clean       ${name}` : `known       ${name}: ${diagnostics.length} baselined`);
  }
}

if (updating) {
  const next = Object.fromEntries(
    Object.entries(results).filter(([, ds]) => ds.length > 0),
  );
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  const total = Object.values(next).reduce((n, ds) => n + ds.length, 0);
  console.log(`\nBaseline written: ${Object.keys(next).length} function(s), ${total} diagnostic(s).`);
  if (total > 0) {
    console.log("Baselining an error is a decision. Prefer fixing it.");
  }
  process.exit(0);
}

const total = Object.values(results).reduce((n, ds) => n + ds.length, 0);
console.log(`\n${functions.length} functions checked, ${total} diagnostic(s), ${Object.keys(baseline).length} baselined function(s).`);

if (newErrors > 0) {
  console.error(`\n${newErrors} new type error(s). Fix them, or baseline them deliberately with --update-baseline.`);
  process.exit(1);
}
if (fixedErrors > 0) {
  console.error(`\n${fixedErrors} baselined diagnostic(s) no longer occur. Run --update-baseline to lock the gain in.`);
  process.exit(1);
}
process.exit(0);
