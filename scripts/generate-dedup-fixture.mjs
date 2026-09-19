#!/usr/bin/env node
/**
 * Dedup scale fixture generator.
 *
 * Builds a known-answer CSV and a manifest for validating duplicate detection
 * against a realistic dataset. It is **strictly read-only**: it runs SELECTs,
 * writes two local files, and never inserts, updates or merges anything.
 *
 * SAFETY INTERLOCKS — it refuses to run unless all of these hold:
 *   1. public.environment_marker exists and says STAGING
 *   2. The URL is not the production project ref
 *   3. --i-understand-this-is-staging is passed explicitly
 *
 * The clone must be quarantined first — see docs/STAGING_CLONE_QUARANTINE.md.
 * A clone still holds live SMTP and LinkedIn credentials.
 *
 * No production contact ids are hardcoded. Candidates are discovered from
 * whatever the staging database happens to contain, so the same script works
 * against any restore.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/generate-dedup-fixture.mjs --i-understand-this-is-staging
 *
 * Outputs (in ./fixtures, git-ignored):
 *   dedup-fixture.csv       — import this with import_mode: 'review'
 *   dedup-manifest.json     — expected result for every row
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "fixtures");

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRODUCTION_REF = "agpusorxpklxbjhdmqzd";
const CONFIRMED = process.argv.includes("--i-understand-this-is-staging");
/** How many filler rows to pad with, so batching and self-continuation are exercised. */
const PAD_ROWS = Number(process.env.FIXTURE_PAD_ROWS ?? 5000);

function die(message) {
  console.error(`\nREFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

async function rest(path, params = {}) {
  const url = new URL(`${URL_}/rest/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Interlocks ───────────────────────────────────────────────
if (!URL_ || !KEY) die("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
if (!CONFIRMED) die("Pass --i-understand-this-is-staging to confirm the target is a quarantined clone.");
if (URL_.includes(PRODUCTION_REF)) die(`SUPABASE_URL points at the production project (${PRODUCTION_REF}).`);

let marker;
try {
  marker = await rest("environment_marker", { select: "environment,quarantined_at", limit: "1" });
} catch {
  die("public.environment_marker is missing. Complete docs/STAGING_CLONE_QUARANTINE.md first.");
}
if (!marker?.[0] || !String(marker[0].environment).toUpperCase().includes("STAGING")) {
  die(`environment_marker does not identify a staging clone (found: ${marker?.[0]?.environment ?? "none"}).`);
}
console.log(`Target confirmed: ${marker[0].environment}\n`);

// ── Candidate discovery ──────────────────────────────────────
const CONTACT_COLS =
  "id,first_name,last_name,email,linkedin_url,external_contact_id,company_id,company_name_raw,job_title,phone,merged_into,created_at";

/** Canonical contacts with an email, from the START of the id ordering. */
async function earlyContacts(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "is.null", email: "not.is.null",
    order: "id.asc", limit: String(n),
  });
}

/**
 * Canonical contacts from the END of the id ordering.
 *
 * This is the case that matters most. The old dedup preloaded contacts with
 * `order by id` and stopped at 500,000 — so records at the far end of that
 * ordering were invisible and got duplicated. These rows prove the ceiling is
 * gone.
 */
async function lateContacts(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "is.null", email: "not.is.null",
    order: "id.desc", limit: String(n),
  });
}

async function withLinkedIn(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "is.null", linkedin_url: "not.is.null",
    order: "id.desc", limit: String(n),
  });
}

async function withExternalId(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "is.null", external_contact_id: "not.is.null",
    order: "id.desc", limit: String(n),
  });
}

async function withCompany(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "is.null", company_id: "not.is.null",
    email: "not.is.null", order: "id.desc", limit: String(n),
  });
}

async function mergedContacts(n) {
  return rest("contacts", {
    select: CONTACT_COLS, merged_into: "not.is.null", email: "not.is.null",
    order: "id.desc", limit: String(n),
  });
}

async function companyFor(id) {
  if (!id) return null;
  const rows = await rest("companies", { select: "id,name,domain,normalized_domain,normalized_name", id: `eq.${id}`, limit: "1" });
  return rows?.[0] ?? null;
}

async function totalContacts() {
  const res = await fetch(`${URL_}/rest/v1/contacts?select=id&merged_into=is.null`, {
    method: "HEAD",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
  });
  const range = res.headers.get("content-range") ?? "";
  return Number(range.split("/")[1] ?? 0);
}

// ── Case construction ────────────────────────────────────────
const rows = [];
const manifest = [];
let seq = 0;

/**
 * @param caseId      e.g. "01"
 * @param description what the case is testing
 * @param source      the contact this row was derived from, or null
 * @param input       the CSV row
 * @param expected    expected match type and safety behaviour
 */
function addCase(caseId, description, source, input, expected) {
  const ref = `FIXTURE-${caseId}-${String(++seq).padStart(4, "0")}`;
  rows.push({ ...input, import_tag: ref });
  manifest.push({
    case: caseId,
    description,
    fixture_ref: ref,
    source_contact_id: source?.id ?? null,
    source_email: source?.email ?? null,
    expected_match_type: expected.matchType,
    expected_confidence: expected.confidence ?? null,
    expected_canonical_contact: expected.canonical ?? source?.id ?? null,
    expected_safety_behavior: expected.safety,
    input: { ...input },
    notes: expected.notes ?? null,
  });
}

const jitterName = (s) => (s ?? "").trim();

console.log("Discovering candidates…");
const total = await totalContacts();
const [early, late, li, ext, withCo, merged] = await Promise.all([
  earlyContacts(3), lateContacts(3), withLinkedIn(2), withExternalId(2), withCompany(4), mergedContacts(2),
]);

console.log(`  canonical contacts in clone: ${total.toLocaleString()}`);
for (const [label, arr] of [["early", early], ["late", late], ["linkedin", li], ["external_id", ext], ["with_company", withCo], ["merged", merged]]) {
  console.log(`  ${label}: ${arr.length} candidate(s)`);
}

const missing = [];
const need = (arr, label, n = 1) => { if (arr.length < n) missing.push(`${label} (need ${n}, found ${arr.length})`); };
need(early, "early contacts");
need(late, "late contacts");
need(li, "contacts with linkedin_url");
need(ext, "contacts with external_contact_id");
need(withCo, "contacts with a company", 2);
need(merged, "soft-merged contacts");
if (missing.length) {
  console.warn(`\nWARNING — cases will be skipped, the clone lacks:\n  ${missing.join("\n  ")}\n`);
}

// 01 — exact email, early in the dataset
if (early[0]) addCase("01", "Exact email duplicate, early in id ordering", early[0], {
  first_name: jitterName(early[0].first_name), last_name: jitterName(early[0].last_name),
  email: early[0].email, company_name_raw: early[0].company_name_raw ?? "",
  job_title: early[0].job_title ?? "",
}, { matchType: "exact_duplicate", confidence: 100, safety: "MAY_AUTO_MERGE" });

// 02 — exact email, beyond the old 500k boundary. THE case.
if (late[0]) addCase("02", "Exact email duplicate beyond the old 500,000 preload ceiling", late[0], {
  first_name: jitterName(late[0].first_name), last_name: jitterName(late[0].last_name),
  email: late[0].email, company_name_raw: late[0].company_name_raw ?? "",
  job_title: late[0].job_title ?? "",
}, {
  matchType: "exact_duplicate", confidence: 100, safety: "MAY_AUTO_MERGE",
  notes: "GATE: a miss here means the fix is ineffective. This row was invisible to the old preload.",
});

// 03 — exact LinkedIn, different email
if (li[0]) addCase("03", "Exact LinkedIn URL, different email address", li[0], {
  first_name: jitterName(li[0].first_name), last_name: jitterName(li[0].last_name),
  email: `fixture.li.${seq}@fixture-domain.invalid`,
  linkedin_url: li[0].linkedin_url, company_name_raw: li[0].company_name_raw ?? "",
}, { matchType: "exact_duplicate", confidence: 95, safety: "MAY_AUTO_MERGE" });

// 04 — external contact id
if (ext[0]) addCase("04", "External contact ID match", ext[0], {
  first_name: jitterName(ext[0].first_name), last_name: jitterName(ext[0].last_name),
  email: `fixture.ext.${seq}@fixture-domain.invalid`,
  external_contact_id: ext[0].external_contact_id,
}, { matchType: "exact_duplicate", confidence: 95, safety: "MAY_AUTO_MERGE" });

// 05 / 06 — name + company domain, name + company name
const co0 = await companyFor(withCo[0]?.company_id);
if (withCo[0] && co0?.domain) addCase("05", "Same person via name + company domain", withCo[0], {
  first_name: jitterName(withCo[0].first_name), last_name: jitterName(withCo[0].last_name),
  email: `fixture.dom.${seq}@${co0.domain}`, domain: co0.domain,
}, { matchType: "likely_duplicate", confidence: 80, safety: "REVIEW_REQUIRED" });

if (withCo[1] && co0) {
  const co1 = await companyFor(withCo[1].company_id);
  if (co1?.name) addCase("06", "Same person via name + company name", withCo[1], {
    first_name: jitterName(withCo[1].first_name), last_name: jitterName(withCo[1].last_name),
    email: `fixture.nam.${seq}@fixture-domain.invalid`, company_name_raw: co1.name,
  }, { matchType: "likely_duplicate", confidence: 70, safety: "REVIEW_REQUIRED" });
}

// 07 — soft-merged contact: must resolve to the SURVIVOR
if (merged[0]) addCase("07", "Email of a soft-merged contact", merged[0], {
  first_name: jitterName(merged[0].first_name), last_name: jitterName(merged[0].last_name),
  email: merged[0].email,
}, {
  matchType: "exact_duplicate", confidence: 100,
  canonical: merged[0].merged_into,
  safety: "MAY_AUTO_MERGE",
  notes: "Must resolve to merged_into (the survivor), never to the archived row.",
});

// 08 — completely new. Control against over-matching.
addCase("08", "Completely new person — control", null, {
  first_name: "Fixturea", last_name: "Zzyxqvton",
  email: `fixture.new.${Date.now()}@fixture-domain.invalid`,
  company_name_raw: "Fixture Control Holdings Zzyx",
}, { matchType: "new", safety: "MUST_CREATE_NEW" });

// 09 — same name, DIFFERENT company. Must not merge.
if (late[1]) addCase("09", "Same name at a different company — common-name trap", late[1], {
  first_name: jitterName(late[1].first_name), last_name: jitterName(late[1].last_name),
  email: `fixture.samename.${seq}@unrelated-fixture.invalid`,
  company_name_raw: "Unrelated Fixture Company Qqxz",
}, {
  matchType: "new_or_review", safety: "MUST_NOT_AUTO_MERGE",
  notes: "STOP CONDITION: an automatic merge here means distinct people are being combined.",
});

// 10 — same company, DIFFERENT person. Must not merge.
if (withCo[2]) {
  const co2 = await companyFor(withCo[2].company_id);
  addCase("10", "Same company, different person", withCo[2], {
    first_name: "Qventro", last_name: "Blimforth",
    email: `fixture.samecompany.${seq}@${co2?.domain ?? "fixture-domain.invalid"}`,
    company_name_raw: co2?.name ?? withCo[2].company_name_raw ?? "",
  }, {
    matchType: "new", safety: "MUST_NOT_AUTO_MERGE",
    notes: "STOP CONDITION: a shared employer is not identity.",
  });
}

// 11 — same person, changed title. Should match and enrich.
if (late[2]) addCase("11", "Same person with a changed job title", late[2], {
  first_name: jitterName(late[2].first_name), last_name: jitterName(late[2].last_name),
  email: late[2].email, job_title: "Chief Fixture Officer",
}, {
  matchType: "exact_duplicate", confidence: 100, safety: "MAY_AUTO_MERGE",
  notes: "Should enrich, and record a title conflict rather than overwriting silently.",
});

// 12 — changed employer AND changed email: weak evidence only.
if (early[1]) addCase("12", "Changed employer and changed email — weak evidence only", early[1], {
  first_name: jitterName(early[1].first_name), last_name: jitterName(early[1].last_name),
  email: `fixture.moved.${seq}@new-employer-fixture.invalid`,
  company_name_raw: "New Employer Fixture Ltd Qqxz",
}, {
  matchType: "new_or_review", safety: "MUST_NOT_AUTO_MERGE",
  notes: "STOP CONDITION: name alone must never be enough to merge across employers.",
});

// ── Padding ──────────────────────────────────────────────────
// Filler exercises batching, self-continuation and timing realistically. Every
// row is obviously synthetic and must create a new contact.
for (let i = 0; i < PAD_ROWS; i++) {
  rows.push({
    first_name: `Padfirst${i}`, last_name: `Padlast${i}`,
    email: `fixture.pad.${i}.${Date.now()}@fixture-padding.invalid`,
    company_name_raw: `Fixture Padding Co ${i % 250}`,
    job_title: "Padding Analyst",
    import_tag: "FIXTURE-PAD",
  });
}

// ── Output ───────────────────────────────────────────────────
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const headers = [
  "first_name", "last_name", "email", "linkedin_url", "external_contact_id",
  "company_name_raw", "domain", "job_title", "import_tag",
];
const esc = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");

writeFileSync(join(OUT_DIR, "dedup-fixture.csv"), csv);
writeFileSync(join(OUT_DIR, "dedup-manifest.json"), JSON.stringify({
  generated_at: new Date().toISOString(),
  environment: marker[0].environment,
  clone_contact_count: total,
  fixture_rows: rows.length,
  known_answer_cases: manifest.length,
  padding_rows: PAD_ROWS,
  stop_conditions: manifest.filter((m) => m.expected_safety_behavior === "MUST_NOT_AUTO_MERGE").map((m) => m.fixture_ref),
  cases: manifest,
}, null, 2));

console.log(`\n${manifest.length} known-answer cases + ${PAD_ROWS} padding rows`);
if (missing.length) console.log(`${12 - manifest.length} case(s) skipped — see the warning above.`);
console.log(`\n  fixtures/dedup-fixture.csv`);
console.log(`  fixtures/dedup-manifest.json`);
console.log(`\nImport with import_mode: 'review' so nothing merges automatically.`);
console.log(`Case 02 is the gate. Any MUST_NOT_AUTO_MERGE case that merges is a STOP.\n`);
