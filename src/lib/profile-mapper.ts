/**
 * Vendor profile record → discovery_profiles row.
 *
 * Bulk profile datasets arrive in whatever shape the vendor chose. Coresignal,
 * People Data Labs and a CSV export of the same data disagree about field names,
 * country spellings and how company size is expressed. This maps all of them
 * onto one row shape, so the loader stays a dumb pipe and the interesting logic
 * is testable without a database.
 *
 * Everything here is pure. No I/O, no database, no network.
 */

import { normalizeTitle } from "./title-ontology";

export interface DiscoveryProfileRow {
  linkedin_url: string | null;
  normalized_linkedin_url: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  raw_title: string | null;
  canonical_title: string | null;
  seniority: string | null;
  seniority_rank: number;
  department: string | null;
  company_name: string | null;
  company_domain: string | null;
  company_industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  country_code: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  source: string;
  source_dataset_version: string | null;
}

/** Field aliases, in priority order. First populated match wins. */
const ALIASES: Record<string, string[]> = {
  linkedin_url: ["linkedin_url", "linkedin", "linkedin_profile_url", "profile_url", "url", "canonical_url", "member_url"],
  full_name: ["full_name", "name", "fullname", "member_name"],
  first_name: ["first_name", "firstname", "given_name"],
  last_name: ["last_name", "lastname", "family_name", "surname"],
  // `raw_title` first so our own exports round-trip: scripts/ingest-edgar.ts
  // emits this schema, and without the alias its titles would be silently
  // dropped on re-import.
  raw_title: ["raw_title", "title", "job_title", "position", "headline", "current_title", "active_experience_title"],
  company_name: ["company_name", "company", "organization", "organization_name", "employer", "active_experience_company_name"],
  company_domain: ["company_domain", "domain", "website", "company_website", "organization_domain"],
  company_industry: ["company_industry", "industry", "organization_industry", "company_industries"],
  // "employees_count" is Apollo's spelling, which is what the real export
  // archive uses; without it every size filter sees null across 9GB of data.
  employee_count: ["employee_count", "employees_count", "employees", "company_size", "organization_employee_count", "company_employees_count", "num_employees", "headcount"],
  employee_range: ["employee_range", "employees_range", "company_size_range", "size_range"],
  country: ["country", "country_name", "location_country", "company_country"],
  country_code: ["country_code", "country_iso", "location_country_code"],
  region: ["region", "state", "location_region", "admin_area"],
  city: ["city", "location_city", "locality", "town"],
};

/**
 * Country spellings → ISO-2.
 *
 * Gulf entries are exhaustive on purpose: these are the markets that matter
 * here, and vendor data spells them inconsistently. "KSA" in particular is
 * common in regional datasets and absent from most country libraries.
 */
const COUNTRY_CODES: Record<string, string> = {
  // Gulf and wider MENA
  "saudi arabia": "SA", "saudi": "SA", ksa: "SA", "kingdom of saudi arabia": "SA", sa: "SA", sau: "SA",
  "united arab emirates": "AE", uae: "AE", emirates: "AE", ae: "AE", are: "AE",
  qatar: "QA", qa: "QA", qat: "QA",
  kuwait: "KW", kw: "KW", kwt: "KW",
  bahrain: "BH", bh: "BH", bhr: "BH",
  oman: "OM", om: "OM", omn: "OM",
  egypt: "EG", eg: "EG", egy: "EG",
  jordan: "JO", jo: "JO", jor: "JO",
  lebanon: "LB", lb: "LB", lbn: "LB",
  iraq: "IQ", iq: "IQ", irq: "IQ",
  // Common non-MENA, so mixed datasets do not fall through
  "united states": "US", usa: "US", us: "US", "united states of america": "US",
  "united kingdom": "GB", uk: "GB", gb: "GB", britain: "GB", england: "GB",
  india: "IN", in: "IN", ind: "IN",
  pakistan: "PK", pk: "PK",
  germany: "DE", de: "DE", deu: "DE",
  france: "FR", fr: "FR", fra: "FR",
  turkey: "TR", turkiye: "TR", tr: "TR",
};

/** Canonical display names for the codes we care most about. */
const COUNTRY_NAMES: Record<string, string> = {
  SA: "Saudi Arabia", AE: "United Arab Emirates", QA: "Qatar", KW: "Kuwait",
  BH: "Bahrain", OM: "Oman", EG: "Egypt", JO: "Jordan", LB: "Lebanon", IQ: "Iraq",
  US: "United States", GB: "United Kingdom", IN: "India", PK: "Pakistan",
  DE: "Germany", FR: "France", TR: "Turkey",
};

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  // Vendor exports spell "no value" a dozen ways.
  if (["n/a", "na", "null", "none", "undefined", "-", "unknown", "#n/a"].includes(lower)) return null;
  return s;
};

/** First populated alias, case- and separator-insensitive on the key. */
function pick(record: Record<string, unknown>, field: string): string | null {
  const lookup = new Map<string, unknown>();
  for (const [k, v] of Object.entries(record)) {
    lookup.set(k.toLowerCase().replace(/[\s-]/g, "_"), v);
  }
  for (const alias of ALIASES[field] ?? [field]) {
    const hit = clean(lookup.get(alias));
    if (hit !== null) return hit;
  }
  return null;
}

/** ISO-2 country code from any spelling. */
export function toCountryCode(value: string | null): string | null {
  if (!value) return null;
  const key = value.toLowerCase().trim().replace(/\./g, "");
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];
  // Already a bare ISO-2 we do not have a name for.
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return null;
}

/**
 * A numeric employee count usable in a range filter.
 *
 * Vendors express size as a number, a band ("51-200"), or an open band ("10001+").
 * A band is reduced to its midpoint so `BETWEEN` works; the original string is
 * kept separately for display, because "51-200" is more honest than "125".
 */
export function toEmployeeCount(explicit: string | null, range: string | null): number | null {
  // A band must not go through the explicit path: stripping non-digits from
  // "201-500" yields 201500, which is not a plausible headcount and silently
  // breaks every size filter. Vendors put bands in size fields routinely.
  const looksLikeBand = (v: string) => /[-–—+]|\bto\b/i.test(v);

  const direct = explicit && !looksLikeBand(explicit)
    ? Number(String(explicit).replace(/[^0-9.]/g, ""))
    : NaN;
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const band = range ?? explicit;
  if (!band) return null;

  const numbers = String(band).match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [];
  if (numbers.length === 0) return null;
  if (numbers.length === 1) {
    // "10001+" or "5000 employees" — an open band's floor is the best estimate.
    return numbers[0];
  }
  return Math.round((numbers[0] + numbers[1]) / 2);
}

/** Canonical LinkedIn profile URL, matching the convention used on contacts. */
export function normalizeLinkedInUrl(value: string | null): string | null {
  if (!value) return null;
  let url = value.trim().toLowerCase().split("?")[0].split("#")[0];
  url = url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  if (!url.includes("linkedin.com")) return null;
  url = url.slice(url.indexOf("linkedin.com"));
  return `https://www.${url}`;
}

/** Bare registrable domain from a domain or website value. */
export function toDomain(value: string | null): string | null {
  if (!value) return null;
  const d = value.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) ? d : null;
}

function splitName(full: string | null): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts[parts.length - 1] };
}

export interface MapOptions {
  source: string;
  datasetVersion?: string | null;
}

/**
 * Map one vendor record. Always returns a row — filtering is the loader's job,
 * via `isUsableProfile`, so the loader can count what it rejected and why.
 */
export function mapProfile(
  record: Record<string, unknown>,
  options: MapOptions,
): DiscoveryProfileRow {
  const linkedin = pick(record, "linkedin_url");
  const fullName = pick(record, "full_name");
  const first = pick(record, "first_name");
  const last = pick(record, "last_name");
  const derived = splitName(fullName);

  const rawTitle = pick(record, "raw_title");
  const title = normalizeTitle(rawTitle);

  const countryRaw = pick(record, "country");
  const codeRaw = pick(record, "country_code");
  const code = toCountryCode(codeRaw) ?? toCountryCode(countryRaw);

  return {
    linkedin_url: linkedin,
    normalized_linkedin_url: normalizeLinkedInUrl(linkedin),
    full_name: fullName ?? ([first, last].filter(Boolean).join(" ") || null),
    first_name: first ?? derived.first,
    last_name: last ?? derived.last,

    raw_title: rawTitle,
    canonical_title: rawTitle ? title.canonicalTitle : null,
    seniority: rawTitle ? title.seniority : null,
    seniority_rank: rawTitle ? title.seniorityRank : 0,
    department: rawTitle ? title.department : null,

    company_name: pick(record, "company_name"),
    company_domain: toDomain(pick(record, "company_domain")),
    company_industry: pick(record, "company_industry"),
    employee_count: toEmployeeCount(pick(record, "employee_count"), pick(record, "employee_range")),
    employee_range: pick(record, "employee_range"),

    country_code: code,
    country: code ? (COUNTRY_NAMES[code] ?? countryRaw) : countryRaw,
    region: pick(record, "region"),
    city: pick(record, "city"),

    source: options.source,
    source_dataset_version: options.datasetVersion ?? null,
  };
}

/**
 * Is this row worth storing?
 *
 * A profile with no name, or with neither a LinkedIn URL nor a company, cannot
 * be revealed later — the waterfall needs an identity to resolve from. Storing
 * it inflates the headline count and nothing else, which is precisely the
 * dishonesty we are trying not to replicate.
 */
export function isUsableProfile(row: DiscoveryProfileRow): { usable: boolean; reason?: string } {
  if (!row.full_name && !row.first_name) return { usable: false, reason: "no_name" };
  if (!row.normalized_linkedin_url && !row.company_domain && !row.company_name) {
    return { usable: false, reason: "no_resolvable_identity" };
  }
  if (!row.country_code) return { usable: false, reason: "no_country" };
  return { usable: true };
}
