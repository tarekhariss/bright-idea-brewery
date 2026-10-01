#!/usr/bin/env -S npx tsx
/**
 * Mines per-domain email patterns out of existing contacts.
 *
 * This is the run that turns ~1.2M contacts into an asset that generates new
 * addresses. Every contact with a name, a company email and a verification
 * outcome is one observation about how its domain builds addresses. Aggregated,
 * they say `acme.com` uses `first.last` — and from then on any person
 * discovered at Acme can be resolved to a candidate address and verified,
 * rather than bought.
 *
 * TWO MODES
 *
 *   Default is ANALYSE. It mines, reports what was learnable, and writes
 *   nothing. This is the mode that answers the only question that matters
 *   before building anything on top: for how many of our domains can we
 *   actually generate a confident address?
 *
 *   With --confirm-write it upserts into domain_email_patterns. Writes go to
 *   that table ONLY; this script contains no statement that touches contacts.
 *
 * TWO SOURCES
 *
 *   --file   an NDJSON or CSV export of contacts. Needs no database access,
 *            which is why it is the default path while read-only credentials
 *            are still outstanding.
 *   --from-db  streams contacts directly. SELECT only in analyse mode.
 *
 * Memory is flat in the number of contacts and grows only with the number of
 * distinct domains: observations are folded into per-domain scores as they
 * arrive and never retained, so the input needs no sorting.
 *
 *   npx tsx scripts/mine-email-patterns.ts --file contacts.ndjson
 *   npx tsx scripts/mine-email-patterns.ts --file contacts.ndjson --min-confidence 70
 *   npx tsx scripts/mine-email-patterns.ts --from-db --confirm-write --env .env.loader
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import {
  addObservation,
  createEvidence,
  finalizeDomainPattern,
  type DomainEvidence,
  type DomainPatternProfile,
  type EmailEvidenceStatus,
  type EmailPattern,
} from "../src/lib/email-patterns";
import { GENERIC_EMAIL_HOSTS } from "../src/lib/import-normalizers";
import { csvObjects } from "../src/lib/csv-records";

const MINER_VERSION = "1.0.0";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const filePaths = args.reduce<string[]>((acc, a, i) => {
  if (a === "--file" && args[i + 1] && !args[i + 1].startsWith("--")) acc.push(args[i + 1]);
  return acc;
}, []);
// A whole export archive is thousands of files, far more than a command line
// holds, so a list file is the practical input for a full run.
const filesFrom = flag("files-from");
if (filesFrom) {
  if (!existsSync(filesFrom)) die(`${filesFrom} not found`);
  // Each entry is trimmed, so splitting on the newline alone also clears CR.
  for (const line of readFileSync(filesFrom, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed) filePaths.push(trimmed);
  }
}
const filePath = filePaths[0] ?? null;
const fromDb = has("from-db");
const envPath = flag("env") ?? ".env.loader";
const write = has("confirm-write");
const limit = Number(flag("limit") ?? 0);
const minConfidence = Number(flag("min-confidence") ?? 0);
const reportPath = flag("out");

function die(message: string): never {
  console.error(`\nREFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

if (filePaths.length === 0 && !fromDb) die("one of --file <path> or --from-db is required");
if (filePaths.length > 0 && fromDb) die("--file and --from-db are mutually exclusive");
for (const f of filePaths) if (!existsSync(f)) die(`${f} not found`);

// ── Contact row → observation ────────────────────────────────

/**
 * Maps whatever `email_canonical_status` a row carries onto the engine's
 * evidence scale. An unrecognised value becomes `unverified` rather than being
 * assumed good: a status we do not understand is not evidence.
 */
const STATUS_MAP: Record<string, EmailEvidenceStatus> = {
  valid: "valid",
  valid_catch_all: "valid_catch_all",
  risky: "risky",
  unknown: "unknown",
  invalid: "invalid",
  bounced: "bounced",
  suppressed: "suppressed",
  unverified: "unverified",
};

const truthy = (v: unknown) => v === true || v === "true" || v === "t" || v === 1 || v === "1";

interface ContactRow {
  email?: unknown;
  normalized_email?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email_canonical_status?: unknown;
  email_is_catch_all?: unknown;
  email_is_role_based?: unknown;
  email_is_free_email?: unknown;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** The company domain for a row, or "" when it has none worth learning from. */
function rowDomain(row: ContactRow): string {
  const email = (str(row.normalized_email) || str(row.email)).toLowerCase();
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  const host = email.slice(at + 1);
  if (!host || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return "";
  if (GENERIC_EMAIL_HOSTS.has(host)) return "";
  return host;
}

// ── Reporting ────────────────────────────────────────────────

const stats = {
  rows: 0,
  usedRows: 0,
  skippedNoEmail: 0,
  skippedFreeMail: 0,
  skippedNoName: 0,
  malformed: 0,
  unreadableFiles: 0,
};

const evidenceByDomain = new Map<string, DomainEvidence>();

function ingest(row: ContactRow) {
  stats.rows++;

  const email = str(row.normalized_email) || str(row.email);
  if (!email || !email.includes("@")) {
    stats.skippedNoEmail++;
    return;
  }

  const domain = rowDomain(row);
  if (!domain) {
    stats.skippedFreeMail++;
    return;
  }

  const firstName = str(row.first_name);
  const lastName = str(row.last_name);
  if (!firstName && !lastName) {
    // Without a name there is nothing to compare the local part against.
    stats.skippedNoName++;
    return;
  }

  let evidence = evidenceByDomain.get(domain);
  if (!evidence) {
    evidence = createEvidence();
    evidenceByDomain.set(domain, evidence);
  }

  addObservation(evidence, {
    email,
    firstName,
    lastName,
    status: STATUS_MAP[str(row.email_canonical_status).toLowerCase()] ?? "unverified",
    isCatchAll: truthy(row.email_is_catch_all),
    isRoleBased: truthy(row.email_is_role_based),
    isFreeEmail: truthy(row.email_is_free_email),
  });
  stats.usedRows++;
}

const pct = (n: number, of: number) => (of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`);

function report(profiles: DomainPatternProfile[]) {
  const learned = profiles.filter((p) => p.verdict === "learned");
  const ambiguous = profiles.filter((p) => p.verdict === "ambiguous");
  const none = profiles.filter((p) => p.verdict === "insufficient_evidence");
  const confident = profiles.filter((p) => p.pattern && p.confidence >= 70);
  const usable = profiles.filter((p) => p.pattern && p.confidence >= minConfidence);

  const byPattern = new Map<EmailPattern, number>();
  for (const p of learned) {
    if (p.pattern) byPattern.set(p.pattern, (byPattern.get(p.pattern) ?? 0) + 1);
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`Contacts read        ${stats.rows.toLocaleString()}`);
  console.log(`  used as evidence   ${stats.usedRows.toLocaleString()} (${pct(stats.usedRows, stats.rows)})`);
  console.log(`  no usable email    ${stats.skippedNoEmail.toLocaleString()}`);
  console.log(`  free-mail host     ${stats.skippedFreeMail.toLocaleString()}`);
  console.log(`  no name to match   ${stats.skippedNoName.toLocaleString()}`);
  if (stats.malformed) console.log(`  unparseable        ${stats.malformed.toLocaleString()}`);
  if (stats.unreadableFiles) console.log(`  unreadable files   ${stats.unreadableFiles.toLocaleString()}`);

  console.log(`\nDomains seen         ${profiles.length.toLocaleString()}`);
  console.log(`  learned            ${learned.length.toLocaleString()} (${pct(learned.length, profiles.length)})`);
  console.log(`  ambiguous          ${ambiguous.length.toLocaleString()} (${pct(ambiguous.length, profiles.length)})`);
  console.log(`  nothing learnable  ${none.length.toLocaleString()} (${pct(none.length, profiles.length)})`);

  console.log(`\nThis is the number that decides whether generation is worth building on:`);
  console.log(`  confidence >= 70   ${confident.length.toLocaleString()} domain(s) (${pct(confident.length, profiles.length)})`);
  if (minConfidence > 0) {
    console.log(`  confidence >= ${minConfidence}   ${usable.length.toLocaleString()} domain(s) (${pct(usable.length, profiles.length)})`);
  }

  const catchAll = profiles.filter((p) => p.isCatchAll).length;
  const unconfirmed = profiles.filter((p) => p.pattern && p.confirmedObservations === 0).length;
  console.log(`\nWhy confidence is capped where it is`);
  console.log(`  catch-all domains  ${catchAll.toLocaleString()} (acceptance proves nothing there)`);
  console.log(`  never confirmed    ${unconfirmed.toLocaleString()} (pattern rests on unverified rows only)`);

  if (byPattern.size) {
    console.log(`\nLearned pattern distribution`);
    for (const [pattern, n] of [...byPattern].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pattern.padEnd(14)} ${n.toLocaleString().padStart(10)}  ${pct(n, learned.length)}`);
    }
  }

  const examples = [...confident]
    .sort((a, b) => b.confidence - a.confidence || b.observations - a.observations)
    .slice(0, 10);
  if (examples.length) {
    console.log(`\nHighest-confidence domains`);
    for (const p of examples) {
      console.log(`  ${p.domain.padEnd(32)} ${String(p.confidence).padStart(3)}  ${p.pattern}  (${p.observations} obs, ${p.confirmedObservations} confirmed)`);
    }
  }
  console.log(`${"=".repeat(64)}\n`);
}

// ── Input: file ──────────────────────────────────────────────

async function readFromFile(path: string) {
  const isCsv = /\.csv$/i.test(path);
  const stream = createReadStream(path, { encoding: "utf8" });

  if (isCsv) {
    // Quote-aware: a record can span many physical lines, because vendor
    // exports carry descriptions containing newlines. Splitting on newlines
    // would shred those records into fragments that parse but hold the wrong
    // values in the wrong columns.
    for await (const row of csvObjects(stream)) {
      ingest(row as ContactRow);
      if (limit > 0 && stats.rows >= limit) break;
    }
    return;
  }

  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      ingest(JSON.parse(line) as ContactRow);
    } catch {
      stats.malformed++;
    }
    if (limit > 0 && stats.rows >= limit) break;
  }
}

// ── Input: database ──────────────────────────────────────────

type Client = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

async function connect(): Promise<Client> {
  const full = resolve(envPath);
  if (!existsSync(full)) {
    die(
      `${envPath} not found. Create it with:\n  SUPABASE_DB_URL=postgresql://...\n` +
      `A read-only role is sufficient unless --confirm-write is passed.`,
    );
  }
  const match = readFileSync(full, "utf8").match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/m);
  if (!match) die(`${envPath} does not define SUPABASE_DB_URL`);
  const connectionString = match[1].trim().replace(/^["']|["']$/g, "");

  const pg = await import("pg");
  const { Client: PgClient } = (pg as unknown as { default?: typeof import("pg") }).default ?? pg;
  const client = new PgClient({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const target = new URL(connectionString);
  console.log(`Target: ${target.hostname}${target.pathname} (credentials not printed)`);
  return client as unknown as Client;
}

const PAGE = 20_000;

/**
 * Page through contacts by id. Keyset rather than OFFSET: at 1.2M rows an
 * OFFSET scan re-reads everything it has already skipped, and the cost grows
 * with every page.
 */
async function readFromDb(client: Client) {
  let after = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { rows } = await client.query(
      `select id, email, normalized_email, first_name, last_name,
              email_canonical_status, email_is_catch_all,
              email_is_role_based, email_is_free_email
         from public.contacts
        where id > $1
          and merged_into is null
          and email is not null
        order by id
        limit ${PAGE}`,
      [after],
    );
    if (rows.length === 0) break;

    for (const row of rows) ingest(row as ContactRow);
    after = String(rows[rows.length - 1].id);

    if (stats.rows % 100_000 === 0) console.log(`  …${stats.rows.toLocaleString()} contacts read`);
    if (limit > 0 && stats.rows >= limit) break;
  }
}

// ── Output ───────────────────────────────────────────────────

/**
 * Upsert the mined profiles.
 *
 * A re-mine replaces a domain's row wholesale: evidence only ever grows, and a
 * pattern that used to hold but no longer does must be able to disappear. The
 * table's own CHECK rejects an incoherent (pattern, verdict) pair, so a miner
 * bug fails loudly here rather than generating addresses from a bad row.
 */
async function persist(client: Client, profiles: DomainPatternProfile[]) {
  const writable = profiles.filter((p) => p.verdict !== "not_applicable");
  let written = 0;

  for (let i = 0; i < writable.length; i += 500) {
    const batch = writable.slice(i, i + 500);
    const values: unknown[] = [];
    const tuples = batch.map((p, r) => {
      values.push(
        p.domain, p.pattern, p.confidence, p.verdict, p.observations,
        p.confirmedObservations, p.isCatchAll, p.runnerUp,
        JSON.stringify(p.distribution), p.reason, MINER_VERSION,
      );
      const base = r * 11;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9}::jsonb,$${base + 10},$${base + 11})`;
    });

    await client.query(
      `insert into public.domain_email_patterns
         (domain, pattern, confidence, verdict, observations,
          confirmed_observations, is_catch_all, runner_up,
          distribution, reason, miner_version)
       values ${tuples.join(",")}
       on conflict (domain) do update set
         pattern                = excluded.pattern,
         confidence             = excluded.confidence,
         verdict                = excluded.verdict,
         observations           = excluded.observations,
         confirmed_observations = excluded.confirmed_observations,
         is_catch_all           = excluded.is_catch_all,
         runner_up              = excluded.runner_up,
         distribution           = excluded.distribution,
         reason                 = excluded.reason,
         mined_at               = now(),
         miner_version          = excluded.miner_version`,
      values,
    );
    written += batch.length;
    if (written % 10_000 === 0) console.log(`  …${written.toLocaleString()} domains written`);
  }
  return written;
}

// ── Run ──────────────────────────────────────────────────────

console.log(`\n${write ? "MINING AND WRITING" : "MINING (analyse only, nothing will be written)"}`);
console.log(`Source: ${filePaths.length ? `${filePaths.length} file(s)` : "database"}`);
console.log(`Miner:  ${MINER_VERSION}\n`);

let client: Client | null = null;
try {
  if (fromDb) {
    client = await connect();
    await readFromDb(client);
  } else {
    // Several exports fold into one evidence set: a domain appearing in three
    // files has three files' worth of addresses to learn from, and splitting
    // them would understate every one of those domains.
    let fileIndex = 0;
    for (const f of filePaths) {
      fileIndex++;
      try {
        await readFromFile(f);
      } catch (error) {
        // One unreadable export must not abandon the other 6,787.
        stats.unreadableFiles++;
        console.error(`  ! ${f}: ${(error as Error).message}`);
      }
      if (fileIndex % 200 === 0 || fileIndex === filePaths.length) {
        console.log(
          `  …${fileIndex}/${filePaths.length} files, ` +
          `${stats.rows.toLocaleString()} rows, ${evidenceByDomain.size.toLocaleString()} domains`,
        );
      }
    }
  }

  const profiles = [...evidenceByDomain.entries()]
    .map(([domain, evidence]) => finalizeDomainPattern(domain, evidence));

  report(profiles);

  if (reportPath) {
    const keep = profiles.filter((p) => p.pattern && p.confidence >= minConfidence);
    writeFileSync(reportPath, keep.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
    console.log(`Wrote ${keep.length.toLocaleString()} profile(s) to ${reportPath}\n`);
  }

  if (write) {
    if (!client) client = await connect();
    const written = await persist(client, profiles);
    console.log(`Wrote ${written.toLocaleString()} domain(s) to domain_email_patterns.\n`);
  } else {
    console.log("Analysis only — nothing was written. Add --confirm-write to persist.\n");
  }
} finally {
  if (client) await client.end();
}
