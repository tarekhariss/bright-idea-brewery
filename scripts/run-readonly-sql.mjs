#!/usr/bin/env node
/**
 * Runs a read-only SQL file against Postgres, with read-only enforced by the
 * SERVER rather than by inspection.
 *
 * Three independent guards, because "I checked the file" is not a safety
 * mechanism:
 *
 *   1. Static scan — the file is rejected if it contains any write or DDL
 *      keyword at statement position.
 *   2. Session is opened with default_transaction_read_only = on.
 *   3. Every statement runs inside an explicit READ ONLY transaction.
 *
 * Guards 2 and 3 mean the database itself refuses a write. If this script is
 * ever pointed at a file that slips something past guard 1, Postgres raises
 * "cannot execute INSERT in a read-only transaction" and nothing happens.
 *
 * The connection string is read from an environment file and is NEVER printed,
 * logged, or included in output. Only the host and database name are echoed, so
 * you can confirm the target.
 *
 *   node scripts/run-readonly-sql.mjs docs/phase0_production_checks.sql
 *   node scripts/run-readonly-sql.mjs <file> --env .env.readonly --out results.md
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const sqlPath = args.find((a) => !a.startsWith("--"));
const envPath = valueOf("--env") ?? ".env.readonly";
const outPath = valueOf("--out") ?? null;

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function die(msg) {
  console.error(`\nREFUSING TO RUN: ${msg}\n`);
  process.exit(1);
}

if (!sqlPath) die("usage: node scripts/run-readonly-sql.mjs <file.sql> [--env .env.readonly] [--out results.md]");

const fullSqlPath = resolve(root, sqlPath);
if (!existsSync(fullSqlPath)) die(`${sqlPath} not found`);

// ── Guard 1: static scan ─────────────────────────────────────
const sql = readFileSync(fullSqlPath, "utf8");
const FORBIDDEN =
  /^[\s]*(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|vacuum|reindex|refresh|comment|do|begin|commit|set\s+role|select\s+.*\binto\b)/im;

const offending = sql
  .split("\n")
  .map((line, i) => ({ line: line.trim(), n: i + 1 }))
  .filter(({ line }) => line && !line.startsWith("--"))
  .find(({ line }) => FORBIDDEN.test(line));

if (offending) {
  die(`${sqlPath}:${offending.n} is not read-only:\n  ${offending.line.slice(0, 120)}`);
}
console.log(`Static scan: ${sqlPath} contains no write or DDL statements.`);

// ── Connection ───────────────────────────────────────────────
const fullEnvPath = resolve(root, envPath);
if (!existsSync(fullEnvPath)) {
  die(
    `${envPath} not found.\n` +
    `Create it with a single line:\n` +
    `  SUPABASE_DB_URL=postgresql://...\n` +
    `It is git-ignored. Its contents are never printed by this script.`,
  );
}

const envText = readFileSync(fullEnvPath, "utf8");
const match = envText.match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/m);
if (!match) die(`${envPath} does not define SUPABASE_DB_URL`);
const connectionString = match[1].trim().replace(/^["']|["']$/g, "");

let target;
try {
  const u = new URL(connectionString);
  target = { host: u.hostname, port: u.port || "5432", database: u.pathname.replace(/^\//, "") };
} catch {
  die("SUPABASE_DB_URL is not a valid connection URI");
}
console.log(`Target: ${target.host}:${target.port}/${target.database}`);
console.log("(credentials read but never printed)\n");

// ── Connect ──────────────────────────────────────────────────
let pg;
try {
  pg = await import("pg");
} catch {
  die("the `pg` package is not installed. Run:  npm i -D pg");
}

const { Client } = pg.default ?? pg;
const client = new Client({
  connectionString,
  // Supabase requires TLS; the pooler presents a certificate chain Node does
  // not bundle, so verification is relaxed for this inspection-only path.
  ssl: { rejectUnauthorized: false },
  // Guard 2: the session itself cannot write.
  options: "-c default_transaction_read_only=on",
  statement_timeout: 120_000,
});

await client.connect();

// Prove the guard is actually in force before running anything.
const { rows: guard } = await client.query("show default_transaction_read_only");
if (guard[0]?.default_transaction_read_only !== "on") {
  await client.end();
  die("the server did not apply default_transaction_read_only=on — aborting");
}
console.log("Server confirms session is READ ONLY.\n");

// ── Split into statements ────────────────────────────────────
// Naive but adequate: this file is plain SELECTs with no dollar-quoting.
const statements = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const out = [];
const log = (line = "") => {
  console.log(line);
  out.push(line);
};

log(`# Phase 0 results`);
log(`Target: ${target.host}/${target.database}`);
log(`Run at: ${new Date().toISOString()}`);
log();

let failures = 0;
for (const [i, statement] of statements.entries()) {
  const label = statement.replace(/\s+/g, " ").slice(0, 90);
  log(`## [${i + 1}/${statements.length}] ${label}…`);
  try {
    // Guard 3: explicit read-only transaction per statement.
    await client.query("begin transaction read only");
    const res = await client.query(statement);
    await client.query("commit");

    if (!res.rows || res.rows.length === 0) {
      log("_(no rows)_");
    } else {
      const cols = Object.keys(res.rows[0]);
      log("");
      log(`| ${cols.join(" | ")} |`);
      log(`|${cols.map(() => "---").join("|")}|`);
      for (const row of res.rows.slice(0, 200)) {
        log(`| ${cols.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
      }
      if (res.rows.length > 200) log(`_…${res.rows.length - 200} more rows_`);
    }
  } catch (err) {
    failures++;
    await client.query("rollback").catch(() => {});
    log(`**ERROR:** ${err.message}`);
  }
  log();
}

await client.end();

if (outPath) {
  writeFileSync(resolve(root, outPath), out.join("\n"));
  console.log(`\nWritten to ${outPath}`);
}
console.log(`\n${statements.length} statement(s), ${failures} error(s). Nothing was written to the database.`);
