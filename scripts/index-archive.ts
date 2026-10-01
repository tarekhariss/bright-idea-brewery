#!/usr/bin/env -S npx tsx
/**
 * Inventories a lead export archive: what do we actually own?
 *
 * Export archives overlap heavily. The same person is pulled into a US file, a
 * regional file and three campaign-specific files, so the sum of row counts is
 * not a count of people — it can overstate by several times. "We have 1.2M
 * leads" is a claim about files, not about contacts, until something dedupes
 * them.
 *
 * This answers two questions that come BEFORE "where do we buy more":
 *
 *   How many distinct people are in here, and how do they break down by
 *   country, industry, company size and seniority?
 *
 *   Which filter combinations are thin? That is where buying or crawling is
 *   actually worth money, as opposed to re-buying people already owned.
 *
 * It also emits the deduped set as NDJSON, so the archive becomes one clean
 * file ready for load-discovery-profiles.ts the moment a database is reachable.
 *
 * IDENTITY
 *
 *   LinkedIn URL, then email, then name + company domain. A person with a
 *   LinkedIn URL in one export and only an email in another is counted twice —
 *   unavoidable without a resolution pass, and over-counting is the honest
 *   direction to err when the number is used to decide what to buy.
 *
 * Memory is the dedup set only; records are never accumulated.
 *
 *   npx tsx scripts/index-archive.ts --files-from files.txt
 *   npx tsx scripts/index-archive.ts --files-from files.txt --out unique.ndjson
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { csvObjects } from "../src/lib/csv-records";
import { isUsableProfile, mapProfile, type DiscoveryProfileRow } from "../src/lib/profile-mapper";
import { normalizeEmail, GENERIC_EMAIL_HOSTS } from "../src/lib/import-normalizers";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

function die(message: string): never {
  console.error(`\nREFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

const filesFrom = flag("files-from");
const singleFile = flag("file");
const outPath = flag("out");
const limit = Number(flag("limit") ?? 0);

const files: string[] = [];
if (filesFrom) {
  if (!existsSync(filesFrom)) die(`${filesFrom} not found`);
  for (const line of readFileSync(filesFrom, "utf8").split("\n")) {
    const t = line.trim();
    if (t) files.push(t);
  }
} else if (singleFile) {
  files.push(singleFile);
} else {
  die("one of --files-from <list> or --file <path> is required");
}

// ── Counters ─────────────────────────────────────────────────

const stats = {
  files: 0,
  unreadable: 0,
  rows: 0,
  unique: 0,
  duplicates: 0,
  unusable: 0,
  withEmail: 0,
  withLinkedIn: 0,
  withDomain: 0,
  withTitle: 0,
  withIndustry: 0,
  withSize: 0,
};

const byCountry = new Map<string, number>();
const byIndustry = new Map<string, number>();
const bySeniority = new Map<string, number>();
const bySizeBand = new Map<string, number>();
const byCountrySeniority = new Map<string, number>();
const rejectReasons = new Map<string, number>();

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** Identity keys already seen. Strings, not hashes: exact beats compact here. */
const seen = new Set<string>();

const SIZE_BANDS: Array<[number, number, string]> = [
  [1, 10, "1-10"],
  [11, 50, "11-50"],
  [51, 200, "51-200"],
  [201, 500, "201-500"],
  [501, 1000, "501-1000"],
  [1001, 5000, "1001-5000"],
  [5001, 10000, "5001-10000"],
  [10001, Number.MAX_SAFE_INTEGER, "10000+"],
];

const sizeBand = (n: number | null): string => {
  if (n === null) return "unknown";
  for (const [lo, hi, label] of SIZE_BANDS) if (n >= lo && n <= hi) return label;
  return "unknown";
};

/**
 * Dedup key, strongest identity first.
 *
 * Returns null when a row carries no identity at all, which is counted
 * separately rather than treated as a person.
 */
function identity(row: DiscoveryProfileRow, email: string | null): string | null {
  if (row.normalized_linkedin_url) return `li:${row.normalized_linkedin_url}`;
  if (email) return `em:${email}`;
  if (row.full_name && row.company_domain) {
    return `nd:${row.full_name.toLowerCase()}|${row.company_domain}`;
  }
  if (row.full_name && row.company_name) {
    return `nc:${row.full_name.toLowerCase()}|${row.company_name.toLowerCase()}`;
  }
  return null;
}

let out: ReturnType<typeof createWriteStream> | null = null;
if (outPath) out = createWriteStream(outPath, { encoding: "utf8" });

function observe(record: Record<string, string>) {
  stats.rows++;

  const row = mapProfile(record, { source: "archive", datasetVersion: null });

  const rawEmail = record.email ?? record.work_email ?? "";
  const email = rawEmail ? normalizeEmail(rawEmail) || null : null;
  const corporateEmail =
    email && email.includes("@") && !GENERIC_EMAIL_HOSTS.has(email.split("@")[1]) ? email : null;

  const key = identity(row, email);
  if (key === null) {
    stats.unusable++;
    bump(rejectReasons, "no_identity");
    return;
  }
  if (seen.has(key)) {
    stats.duplicates++;
    return;
  }

  const verdict = isUsableProfile(row);
  if (!verdict.usable) {
    // Still counted as seen, so the same unusable person is not re-counted
    // from six other exports.
    seen.add(key);
    stats.unusable++;
    bump(rejectReasons, verdict.reason ?? "unknown");
    return;
  }

  seen.add(key);
  stats.unique++;

  if (email) stats.withEmail++;
  if (row.normalized_linkedin_url) stats.withLinkedIn++;
  if (row.company_domain || corporateEmail) stats.withDomain++;
  if (row.raw_title) stats.withTitle++;
  if (row.company_industry) stats.withIndustry++;
  if (row.employee_count !== null) stats.withSize++;

  const country = row.country_code ?? "??";
  const seniority = row.seniority ?? "unknown";
  bump(byCountry, country);
  bump(bySeniority, seniority);
  bump(bySizeBand, sizeBand(row.employee_count));
  if (row.company_industry) bump(byIndustry, row.company_industry.toLowerCase());
  bump(byCountrySeniority, `${country}|${seniority}`);

  if (out) {
    // Domain falls back to the corporate email's host, which is what makes a
    // row usable by the pattern engine later.
    const domain = row.company_domain ?? (corporateEmail ? corporateEmail.split("@")[1] : null);
    out.write(JSON.stringify({ ...row, company_domain: domain, email }) + "\n");
  }
}

// ── Report ───────────────────────────────────────────────────

const pct = (n: number, of: number) => (of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`);
const num = (n: number) => n.toLocaleString();

function table(title: string, m: Map<string, number>, total: number, top = 15) {
  if (m.size === 0) return;
  console.log(`\n${title}`);
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    console.log(`  ${k.padEnd(28)} ${num(n).padStart(12)}  ${pct(n, total)}`);
  }
  if (m.size > top) console.log(`  … and ${num(m.size - top)} more`);
}

function report() {
  const totalSeen = stats.rows;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Files read             ${num(stats.files)}`);
  if (stats.unreadable) console.log(`  unreadable           ${num(stats.unreadable)}`);
  console.log(`Rows across all files  ${num(totalSeen)}`);
  console.log(`  duplicates           ${num(stats.duplicates)} (${pct(stats.duplicates, totalSeen)})`);
  console.log(`  unusable             ${num(stats.unusable)} (${pct(stats.unusable, totalSeen)})`);
  console.log(``);
  console.log(`DISTINCT PEOPLE        ${num(stats.unique)}`);
  console.log(`  this is the real size of the archive, not the row count`);

  if (rejectReasons.size) {
    console.log(`\nWhy rows were unusable`);
    for (const [r, n] of [...rejectReasons].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${r.padEnd(28)} ${num(n)}`);
    }
  }

  console.log(`\nField coverage (of distinct people)`);
  for (const [label, n] of [
    ["email", stats.withEmail],
    ["company domain", stats.withDomain],
    ["job title", stats.withTitle],
    ["industry", stats.withIndustry],
    ["employee count", stats.withSize],
    ["linkedin url", stats.withLinkedIn],
  ] as const) {
    console.log(`  ${label.padEnd(28)} ${num(n).padStart(12)}  ${pct(n, stats.unique)}`);
  }

  table("By country", byCountry, stats.unique, 20);
  table("By seniority", bySeniority, stats.unique, 12);
  table("By company size", bySizeBand, stats.unique, 10);
  table("By industry", byIndustry, stats.unique, 20);

  // The combination that decides whether a search can actually be served.
  console.log(`\nDecision-makers by country (VP and above)`);
  const senior = new Set(["board", "founder", "c_suite", "vp"]);
  const seniorByCountry = new Map<string, number>();
  for (const [key, n] of byCountrySeniority) {
    const [country, band] = key.split("|");
    if (senior.has(band)) seniorByCountry.set(country, (seniorByCountry.get(country) ?? 0) + n);
  }
  table("", seniorByCountry, stats.unique, 15);

  console.log(`${"=".repeat(70)}\n`);
}

// ── Run ──────────────────────────────────────────────────────

console.log(`\nINDEXING ARCHIVE (read-only, no database)`);
console.log(`Files: ${num(files.length)}\n`);

const startedAt = Date.now();

for (const path of files) {
  stats.files++;
  try {
    for await (const record of csvObjects(createReadStream(path, { encoding: "utf8" }))) {
      observe(record);
      if (limit > 0 && stats.rows >= limit) break;
    }
  } catch (error) {
    // One unreadable export must not abandon the rest of the archive.
    stats.unreadable++;
    console.error(`  ! ${path}: ${(error as Error).message}`);
  }

  if (stats.files % 25 === 0 || stats.files === files.length) {
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(
      `  …${stats.files}/${files.length} files · ${num(stats.rows)} rows · ` +
      `${num(stats.unique)} distinct · ${mins}m`,
    );
  }
  if (limit > 0 && stats.rows >= limit) break;
}

if (out) {
  out.end();
  console.log(`\nWrote ${num(stats.unique)} distinct profile(s) to ${outPath}`);
}

report();
console.log("Read-only — nothing was written to any database.\n");
