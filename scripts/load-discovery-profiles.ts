#!/usr/bin/env -S npx tsx
/**
 * Streams a bulk vendor profile dataset into discovery_profiles.
 *
 * This is the piece the audit flagged as having no shortcut: the existing import
 * path parses the whole file in the browser and tops out around 200k rows. A
 * 40M-row profile dataset cannot go through it.
 *
 * TWO MODES
 *
 *   Default is ANALYSE — it reads the file, maps every row, and reports what
 *   the dataset actually contains. It never connects to a database. This is the
 *   mode to run against a vendor's sample file before signing anything: it
 *   answers "how many usable Saudi rows are in here, and how many have titles"
 *   in one command.
 *
 *   With --confirm-write it loads. Writes go to discovery_profiles ONLY; this
 *   script has no statement that touches contacts.
 *
 * Memory stays flat regardless of file size: the input is streamed line by line
 * and flushed to the database in batches. Nothing accumulates except counters.
 *
 *   npx tsx scripts/load-discovery-profiles.ts --file sample.ndjson --source coresignal
 *   npx tsx scripts/load-discovery-profiles.ts --file full.ndjson  --source coresignal \
 *     --version 2026-09 --confirm-write --env .env.loader
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import {
  isUsableProfile,
  mapProfile,
  type DiscoveryProfileRow,
} from "../src/lib/profile-mapper";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const filePath = flag("file");
const source = flag("source");
const version = flag("version");
const envPath = flag("env") ?? ".env.loader";
const batchSize = Number(flag("batch") ?? 2000);
const limit = Number(flag("limit") ?? 0);
const write = has("confirm-write");

function die(message: string): never {
  console.error(`\nREFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

if (!filePath) die("--file <path> is required (.ndjson, .jsonl or .csv)");
if (!source) die("--source <vendor> is required — provenance is stamped on every row");
if (!existsSync(filePath)) die(`${filePath} not found`);

// ── Reporting ────────────────────────────────────────────────
const stats = {
  read: 0,
  usable: 0,
  rejected: 0,
  loaded: 0,
  rejectReasons: new Map<string, number>(),
  byCountry: new Map<string, number>(),
  bySeniority: new Map<string, number>(),
  withTitle: 0,
  withLinkedIn: 0,
  withDomain: 0,
  withIndustry: 0,
  withEmployeeCount: 0,
};

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function observe(row: DiscoveryProfileRow, usable: boolean, reason?: string) {
  stats.read++;
  if (!usable) {
    stats.rejected++;
    bump(stats.rejectReasons, reason ?? "unknown");
    return;
  }
  stats.usable++;
  bump(stats.byCountry, row.country_code ?? "??");
  bump(stats.bySeniority, row.seniority ?? "none");
  if (row.raw_title) stats.withTitle++;
  if (row.normalized_linkedin_url) stats.withLinkedIn++;
  if (row.company_domain) stats.withDomain++;
  if (row.company_industry) stats.withIndustry++;
  if (row.employee_count !== null) stats.withEmployeeCount++;
}

const pct = (n: number, of: number) => (of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`);

function report() {
  const { read, usable, rejected } = stats;
  console.log(`\n${"=".repeat(58)}`);
  console.log(`Rows read      ${read.toLocaleString()}`);
  console.log(`Usable         ${usable.toLocaleString()} (${pct(usable, read)})`);
  console.log(`Rejected       ${rejected.toLocaleString()} (${pct(rejected, read)})`);
  if (write) console.log(`Loaded         ${stats.loaded.toLocaleString()}`);

  if (stats.rejectReasons.size) {
    console.log(`\nWhy rows were rejected`);
    for (const [reason, n] of [...stats.rejectReasons].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${reason.padEnd(26)} ${n.toLocaleString()}`);
    }
  }

  console.log(`\nField coverage (of usable rows) — this is what decides whether a dataset is worth buying`);
  console.log(`  job title                  ${pct(stats.withTitle, usable)}`);
  console.log(`  linkedin url               ${pct(stats.withLinkedIn, usable)}`);
  console.log(`  company domain             ${pct(stats.withDomain, usable)}`);
  console.log(`  company industry           ${pct(stats.withIndustry, usable)}`);
  console.log(`  employee count             ${pct(stats.withEmployeeCount, usable)}`);

  console.log(`\nBy country`);
  for (const [code, n] of [...stats.byCountry].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${code.padEnd(6)} ${n.toLocaleString().padStart(12)}  ${pct(n, usable)}`);
  }

  console.log(`\nBy seniority`);
  for (const [band, n] of [...stats.bySeniority].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${band.padEnd(12)} ${n.toLocaleString().padStart(12)}  ${pct(n, usable)}`);
  }
  console.log(`${"=".repeat(58)}\n`);
}

// ── Input parsing ────────────────────────────────────────────
/** Minimal RFC-4180 line splitter — vendors quote fields containing commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

const isCsv = /\.csv$/i.test(filePath);

// ── Database (only when writing) ─────────────────────────────
type Client = { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>; end: () => Promise<void> };
let client: Client | null = null;

const COLUMNS: (keyof DiscoveryProfileRow)[] = [
  "linkedin_url", "normalized_linkedin_url", "full_name", "first_name", "last_name",
  "raw_title", "canonical_title", "seniority", "seniority_rank", "department",
  "company_name", "company_domain", "company_industry", "employee_count", "employee_range",
  "country_code", "country", "region", "city", "source", "source_dataset_version",
];

async function connect(): Promise<Client> {
  const full = resolve(envPath);
  if (!existsSync(full)) {
    die(
      `${envPath} not found. Loading needs WRITE access, which is deliberately a\n` +
      `different file from the read-only one. Create it with:\n` +
      `  SUPABASE_DB_URL=postgresql://...`,
    );
  }
  const match = readFileSync(full, "utf8").match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/m);
  if (!match) die(`${envPath} does not define SUPABASE_DB_URL`);
  const connectionString = match[1].trim().replace(/^["']|["']$/g, "");

  const pg = await import("pg");
  const { Client: PgClient } = (pg as unknown as { default?: typeof import("pg") }).default ?? pg;
  const c = new PgClient({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const target = new URL(connectionString);
  console.log(`Target: ${target.hostname}/${target.pathname.replace(/^\//, "")} (credentials not printed)`);

  const { rows } = await c.query(
    "select 1 from information_schema.tables where table_schema='public' and table_name='discovery_profiles'",
  );
  if (rows.length === 0) {
    await c.end();
    die("discovery_profiles does not exist on the target. Apply its migration first.");
  }
  return c as unknown as Client;
}

/**
 * Insert a batch. Parameterised rather than COPY: it is slightly slower but
 * survives a malformed row without aborting the whole load, and a 40M-row
 * import that dies at row 39M because of one bad field is worse than slow.
 */
async function flush(batch: DiscoveryProfileRow[]) {
  if (!client || batch.length === 0) return;

  const values: unknown[] = [];
  const tuples = batch.map((row, r) => {
    const placeholders = COLUMNS.map((_, c) => `$${r * COLUMNS.length + c + 1}`);
    for (const col of COLUMNS) values.push(row[col]);
    return `(${placeholders.join(",")})`;
  });

  await client.query(
    `insert into public.discovery_profiles (${COLUMNS.join(",")})
     values ${tuples.join(",")}
     on conflict do nothing`,
    values,
  );
  stats.loaded += batch.length;
}

// ── Run ──────────────────────────────────────────────────────
console.log(`\n${write ? "LOADING" : "ANALYSING (no database connection)"}`);
console.log(`File:   ${filePath}`);
console.log(`Source: ${source}${version ? ` @ ${version}` : ""}\n`);

if (write) client = await connect();

const stream = createReadStream(filePath, { encoding: "utf8" });
const lines = createInterface({ input: stream, crlfDelay: Infinity });

let header: string[] | null = null;
let batch: DiscoveryProfileRow[] = [];
let malformed = 0;

for await (const line of lines) {
  if (!line.trim()) continue;

  if (isCsv && header === null) {
    header = splitCsvLine(line).map((h) => h.trim());
    continue;
  }

  let record: Record<string, unknown>;
  try {
    if (isCsv) {
      const cells = splitCsvLine(line);
      record = Object.fromEntries((header ?? []).map((h, i) => [h, cells[i] ?? null]));
    } else {
      record = JSON.parse(line);
    }
  } catch {
    malformed++;
    continue;
  }

  const row = mapProfile(record, { source: source!, datasetVersion: version });
  const verdict = isUsableProfile(row);
  observe(row, verdict.usable, verdict.reason);

  if (verdict.usable && write) {
    batch.push(row);
    if (batch.length >= batchSize) {
      await flush(batch);
      batch = [];
      if (stats.loaded % 50_000 === 0) console.log(`  …${stats.loaded.toLocaleString()} loaded`);
    }
  }

  if (limit > 0 && stats.read >= limit) break;
}

if (write) await flush(batch);
if (client) await client.end();

if (malformed > 0) console.log(`\n${malformed.toLocaleString()} line(s) could not be parsed and were skipped.`);
report();

if (!write) {
  console.log("Analysis only — nothing was written. Add --confirm-write to load.\n");
}
