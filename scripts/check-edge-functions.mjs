#!/usr/bin/env node
/**
 * Type-checks every Supabase Edge Function with Deno.
 *
 * Edge functions are not covered by `tsc` (they are Deno, with URL imports), so
 * until now nothing type-checked them. Two live production bugs were found this
 * way that had been running for months:
 *
 *   - run-import-job passed `jobId` where the variable in scope was `job_id`,
 *     throwing ReferenceError on every enrichment for 83 days. The error was
 *     swallowed by a catch and surfaced as a row-level data error.
 *   - process-linkedin-queue calls .catch() on a PostgrestFilterBuilder, which
 *     is thenable but has no .catch method — throwing TypeError inside an error
 *     handler and aborting the queue loop.
 *
 * Both are compile-time detectable. Neither was detectable at a glance.
 *
 * A baseline of known-failing functions is allowed so this can run in CI today
 * without first fixing every pre-existing error. The check fails when a function
 * NOT in the baseline has errors, or when a baselined function becomes clean
 * (meaning the baseline should shrink).
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

/** Functions with pre-existing type errors, and how many. Shrink this over time. */
const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : {};

const updating = process.argv.includes("--update-baseline");

const functions = readdirSync(functionsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name)
  .filter((name) => existsSync(join(functionsDir, name, "index.ts")))
  .sort();

const results = {};
let regressions = 0;
let improvements = 0;

for (const name of functions) {
  const entry = join(functionsDir, name, "index.ts");
  let output = "";
  try {
    execFileSync("npx", ["--yes", "deno@2", "check", entry], {
      stdio: "pipe",
      encoding: "utf8",
      shell: process.platform === "win32",
    });
  } catch (err) {
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  // Strip ANSI so the count is stable across terminals.
  const clean = output.replace(/\[[0-9;]*m/g, "");
  const count = (clean.match(/^TS\d+ \[ERROR\]/gm) ?? []).length;
  results[name] = count;

  const expected = baseline[name] ?? 0;
  if (count > expected) {
    regressions++;
    console.error(`REGRESSION  ${name}: ${count} error(s), baseline ${expected}`);
    for (const line of clean.split("\n").filter((l) => /^TS\d+ \[ERROR\]/.test(l))) {
      console.error(`            ${line.slice(0, 140)}`);
    }
  } else if (count < expected) {
    improvements++;
    console.log(`IMPROVED    ${name}: ${count} error(s), baseline ${expected} — lower the baseline`);
  } else if (count > 0) {
    console.log(`known       ${name}: ${count} error(s) (baselined)`);
  } else {
    console.log(`clean       ${name}`);
  }
}

if (updating) {
  const next = Object.fromEntries(Object.entries(results).filter(([, n]) => n > 0));
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nBaseline written: ${Object.keys(next).length} function(s) with known errors.`);
  process.exit(0);
}

const total = Object.values(results).reduce((a, b) => a + b, 0);
console.log(`\n${functions.length} functions checked, ${total} error(s) total.`);

if (regressions > 0) {
  console.error(`\n${regressions} function(s) got worse. Fix them, or run --update-baseline deliberately.`);
  process.exit(1);
}
if (improvements > 0) {
  console.error(`\n${improvements} function(s) improved. Run --update-baseline to lock the gain in.`);
  process.exit(1);
}
process.exit(0);
