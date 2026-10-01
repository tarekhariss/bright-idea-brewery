#!/usr/bin/env -S npx tsx
/**
 * Ingests officers and directors of US public companies from SEC EDGAR.
 *
 * Free, official, and carries no terms-of-service risk: Forms 3, 4 and 5 are
 * mandatory public disclosures published by a government agency, and every
 * officer and director of every listed company appears in them by name and
 * title. This is the opposite end of the risk spectrum from scraping LinkedIn.
 *
 * WHAT IT PRODUCES
 *
 *   People:    name, title, seniority, the company they are an officer of.
 *   Companies: name, CIK, ticker, SIC industry, location.
 *
 * WHAT IT DOES NOT PRODUCE
 *
 *   No email, no phone, and — importantly — no company domain. EDGAR does not
 *   publish one. The profile is searchable without it, but an address cannot be
 *   generated until a domain is attached from elsewhere (the existing companies
 *   table, matched on name or ticker). The run reports how many companies are
 *   missing a domain so that gap is visible rather than discovered later.
 *
 * SEC FAIR ACCESS
 *
 *   The SEC requires every request to declare a real contact in the User-Agent
 *   and rejects the rest with 403. That contact is an operational decision, not
 *   something this script may invent, so it is required configuration and the
 *   script refuses to run without it:
 *
 *     EDGAR_USER_AGENT="Company Name your-contact@example.com"
 *
 *   Requests are additionally throttled below the SEC's published ceiling.
 *
 * THIS SCRIPT NEVER WRITES TO THE DATABASE
 *
 *   It fetches, parses, reports, and optionally emits NDJSON. Loading is the
 *   existing loader's job, so there is exactly one guarded write path into
 *   discovery_profiles rather than two that can drift:
 *
 *     npx tsx scripts/ingest-edgar.ts --max-companies 500 --out edgar.ndjson
 *     npx tsx scripts/load-discovery-profiles.ts --file edgar.ndjson --source sec_edgar
 *
 *   The loader's own analyse mode runs first by default, so the data is
 *   inspected twice before anything is persisted.
 *
 *   npx tsx scripts/ingest-edgar.ts --max-companies 25
 *   npx tsx scripts/ingest-edgar.ts --ticker AAPL,MSFT --out sample.ndjson
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  filingXmlUrl,
  isUsableOwner,
  normalizeCik,
  parseOwnershipForm,
  resolveEdgarLocation,
  type EdgarReportingOwner,
} from "../src/lib/edgar-ownership";
import { toCountryCode } from "../src/lib/profile-mapper";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const maxCompanies = Number(flag("max-companies") ?? 25);
const maxFilings = Number(flag("max-filings") ?? 4);
const envPath = flag("env") ?? ".env.loader";
const reportPath = flag("out");
const tickerFilter = flag("ticker");

function die(message: string): never {
  console.error(`\nREFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

// ── SEC contact, from the environment or the env file ─────────

function readUserAgent(): string {
  const fromEnv = process.env.EDGAR_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;

  const full = resolve(envPath);
  if (existsSync(full)) {
    const match = readFileSync(full, "utf8").match(/^\s*EDGAR_USER_AGENT\s*=\s*(.+)\s*$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }

  die(
    `the SEC requires a real contact in the User-Agent and returns 403 without one.\n` +
    `This is an operational decision, so it is not guessed here. Set it as an\n` +
    `environment variable or in ${envPath}:\n\n` +
    `  EDGAR_USER_AGENT="Your Company your-contact@example.com"\n`,
  );
}

const USER_AGENT = readUserAgent();
if (!/\S+@\S+\.\S+/.test(USER_AGENT)) {
  die(
    `EDGAR_USER_AGENT must contain a contact email address — the SEC rejects\n` +
    `requests without one. Got: ${USER_AGENT.replace(/\S+@\S+/, "<email>")}`,
  );
}

// ── Throttled fetch ──────────────────────────────────────────

/**
 * The SEC publishes a ceiling of 10 requests/second and blocks offenders at the
 * network edge. 8/s leaves headroom: being throttled costs far more than the
 * time saved, and a block affects the whole office IP rather than this script.
 */
const MIN_INTERVAL_MS = 125;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;

async function secFetch(url: string, attempt = 1): Promise<Response | null> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  requestCount++;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
      },
    });
  } catch (error) {
    if (attempt >= 3) {
      console.error(`  network error after 3 attempts: ${url}`);
      return null;
    }
    await sleep(500 * attempt);
    return secFetch(url, attempt + 1);
  }

  // 403 here means the User-Agent was rejected or we are rate limited. Backing
  // off and retrying the same way would just extend a block, so stop loudly.
  if (response.status === 403) {
    console.error(
      `\nSEC returned 403 for ${url}\n` +
      `Either the declared contact was rejected or the request rate was exceeded.\n` +
      `Wait ten minutes before retrying.\n`,
    );
    process.exit(1);
  }

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 3) return null;
    await sleep(1000 * attempt);
    return secFetch(url, attempt + 1);
  }

  return response.ok ? response : null;
}

async function secJson<T>(url: string): Promise<T | null> {
  const response = await secFetch(url);
  if (!response) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// ── Shapes of the SEC responses we read ──────────────────────

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface Submissions {
  cik: string;
  name: string;
  tickers?: string[];
  sic?: string;
  sicDescription?: string;
  addresses?: {
    business?: { city?: string | null; stateOrCountry?: string | null; country?: string | null };
  };
  filings?: {
    recent?: {
      accessionNumber?: string[];
      form?: string[];
      primaryDocument?: string[];
      filingDate?: string[];
    };
  };
}

// ── Collected output ─────────────────────────────────────────

interface EdgarPerson {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  raw_title: string | null;
  canonical_title: string | null;
  seniority: string | null;
  seniority_rank: number;
  department: string | null;
  company_name: string | null;
  company_cik: string | null;
  company_ticker: string | null;
  company_industry: string | null;
  company_domain: null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  person_cik: string | null;
  /** The filing period this role was reported for — used to keep the latest. */
  period_of_report: string | null;
  is_director: boolean;
  is_officer: boolean;
  source: "sec_edgar";
  source_dataset_version: string;
}

const stats = {
  companies: 0,
  companiesWithFilings: 0,
  filingsFetched: 0,
  filingsUnparseable: 0,
  ownersSeen: 0,
  usable: 0,
  rolesSuperseded: 0,
  rejected: new Map<string, number>(),
};

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** Deduped by person CIK + company CIK: one row per role, not per filing. */
const people = new Map<string, EdgarPerson>();

/**
 * Identity of a person-at-a-company. Falls back to the raw name when EDGAR
 * omitted the owner CIK, which is rare but would otherwise collapse every
 * unidentified owner at a company into one row.
 */
const key = (
  owner: EdgarReportingOwner,
  company: { cik: string },
) => `${owner.cik ?? owner.rawName}|${company.cik}`;

function collect(
  owner: EdgarReportingOwner,
  company: { name: string; cik: string; ticker: string | null; industry: string | null },
  location: { code: string | null; region: string | null; city: string | null },
  periodOfReport: string | null,
) {
  stats.ownersSeen++;

  const verdict = isUsableOwner(owner);
  if (!verdict.usable) {
    bump(stats.rejected, verdict.reason ?? "unknown");
    return;
  }

  // One row per person per company, holding their most recent role.
  //
  // People are promoted: the same CIK appears as VP in a 2024 filing and as CFO
  // in a 2026 one. Keeping whichever filing happened to arrive first would store
  // a stale title, and a pool that calls a CFO a VP is worse than one that omits
  // them. Comparing the reported period is explicit rather than relying on the
  // submissions API returning filings newest-first.
  const existing = people.get(key(owner, company));
  if (existing && (existing.period_of_report ?? "") >= (periodOfReport ?? "")) return;
  if (existing) stats.rolesSuperseded++;

  const title = owner.normalizedTitle;
  people.set(key(owner, company), {
    full_name: [owner.firstName, owner.lastName].filter(Boolean).join(" "),
    first_name: owner.firstName,
    last_name: owner.lastName,
    raw_title: owner.resolvedTitle,
    canonical_title: title?.canonicalTitle ?? null,
    seniority: title?.seniority ?? null,
    seniority_rank: title?.seniorityRank ?? 0,
    department: title?.department ?? null,
    company_name: company.name,
    company_cik: company.cik,
    company_ticker: company.ticker,
    company_industry: company.industry,
    company_domain: null,
    country_code: location.code,
    region: location.region,
    city: location.city,
    person_cik: owner.cik,
    period_of_report: periodOfReport,
    is_director: owner.isDirector,
    is_officer: owner.isOfficer,
    source: "sec_edgar",
    source_dataset_version: new Date().toISOString().slice(0, 7),
  });

  if (!existing) stats.usable++;
}

// ── Reporting ────────────────────────────────────────────────

const pct = (n: number, of: number) => (of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`);

function report() {
  const bySeniority = new Map<string, number>();
  const byCountry = new Map<string, number>();
  for (const person of people.values()) {
    bump(bySeniority, person.seniority ?? "unknown");
    bump(byCountry, person.country_code ?? "??");
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`SEC requests made      ${requestCount.toLocaleString()}`);
  console.log(`Companies examined     ${stats.companies.toLocaleString()}`);
  console.log(`  with 3/4/5 filings   ${stats.companiesWithFilings.toLocaleString()}`);
  console.log(`Filings parsed         ${stats.filingsFetched.toLocaleString()}`);
  if (stats.filingsUnparseable) {
    console.log(`  unparseable          ${stats.filingsUnparseable.toLocaleString()}`);
  }

  console.log(`\nReporting owners seen  ${stats.ownersSeen.toLocaleString()}`);
  console.log(`  usable people        ${stats.usable.toLocaleString()} (${pct(stats.usable, stats.ownersSeen)})`);
  console.log(`  distinct rows        ${people.size.toLocaleString()}`);
  if (stats.rolesSuperseded) {
    console.log(`  stale roles replaced ${stats.rolesSuperseded.toLocaleString()} (promotions)`);
  }

  if (stats.rejected.size) {
    console.log(`\nWhy owners were rejected`);
    for (const [reason, n] of [...stats.rejected].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${reason.padEnd(20)} ${n.toLocaleString()}`);
    }
  }

  if (bySeniority.size) {
    console.log(`\nBy seniority`);
    for (const [band, n] of [...bySeniority].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${band.padEnd(12)} ${n.toLocaleString().padStart(8)}  ${pct(n, people.size)}`);
    }
  }

  if (byCountry.size) {
    console.log(`\nBy country`);
    for (const [code, n] of [...byCountry].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${code.padEnd(6)} ${n.toLocaleString().padStart(8)}  ${pct(n, people.size)}`);
    }
  }

  // The gap that decides whether these profiles can be revealed.
  console.log(`\nEDGAR publishes no company domain, so none of these rows can have an`);
  console.log(`address generated until a domain is attached from elsewhere. Distinct`);
  console.log(`companies needing a domain: ${new Set([...people.values()].map((p) => p.company_cik)).size.toLocaleString()}`);
  console.log(`${"=".repeat(64)}\n`);
}

// ── Run ──────────────────────────────────────────────────────

console.log(`\nINGESTING FROM SEC EDGAR (this script never writes to the database)`);
console.log(`Contact declared to SEC: ${USER_AGENT.replace(/(\S+)@(\S+)/, "<contact>@$2")}`);
console.log(`Companies: up to ${maxCompanies}, filings each: up to ${maxFilings}\n`);

const tickers = await secJson<Record<string, TickerEntry>>(
  "https://www.sec.gov/files/company_tickers.json",
);
if (!tickers) die("could not fetch the company ticker index from the SEC");

let universe = Object.values(tickers);
console.log(`Company universe: ${universe.length.toLocaleString()} listed companies`);

if (tickerFilter) {
  const wanted = new Set(tickerFilter.toUpperCase().split(",").map((t) => t.trim()));
  universe = universe.filter((c) => wanted.has(c.ticker.toUpperCase()));
  console.log(`Filtered to ${universe.length} by --ticker`);
}

universe = universe.slice(0, maxCompanies);

for (const entry of universe) {
  const cik = normalizeCik(String(entry.cik_str));
  if (!cik) continue;
  stats.companies++;

  const subs = await secJson<Submissions>(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!subs) continue;

  const recent = subs.filings?.recent;
  if (!recent?.form?.length) continue;

  const location = resolveEdgarLocation(subs.addresses?.business, toCountryCode);
  const company = {
    name: subs.name,
    cik,
    ticker: subs.tickers?.[0] ?? entry.ticker ?? null,
    industry: subs.sicDescription ?? null,
  };

  const indices: number[] = [];
  for (let i = 0; i < recent.form.length && indices.length < maxFilings; i++) {
    if (["3", "4", "5"].includes((recent.form[i] ?? "").trim())) indices.push(i);
  }
  if (indices.length === 0) continue;
  stats.companiesWithFilings++;

  for (const i of indices) {
    const url = filingXmlUrl(cik, recent.accessionNumber?.[i] ?? "", recent.primaryDocument?.[i] ?? "");
    if (!url) continue;

    const response = await secFetch(url);
    if (!response) continue;

    const filing = parseOwnershipForm(await response.text());
    if (!filing) {
      stats.filingsUnparseable++;
      continue;
    }
    stats.filingsFetched++;

    for (const owner of filing.owners) {
      collect(
        owner,
        company,
        {
          code: location.countryCode,
          region: location.region,
          city: subs.addresses?.business?.city ?? null,
        },
        filing.periodOfReport,
      );
    }
  }

  if (stats.companies % 25 === 0) {
    console.log(`  …${stats.companies} companies, ${people.size} people`);
  }
}

report();

if (reportPath) {
  writeFileSync(reportPath, [...people.values()].map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
  console.log(`Wrote ${people.size.toLocaleString()} person record(s) to ${reportPath}\n`);
}

if (!reportPath) {
  console.log("Pass --out <file.ndjson> to emit these records for the loader.\n");
} else {
  console.log(
    `Next: npx tsx scripts/load-discovery-profiles.ts --file ${reportPath} --source sec_edgar\n`,
  );
}
