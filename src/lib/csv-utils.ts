/**
 * CSV parsing, normalization, and duplicate detection engine.
 * Designed for large-scale import pipelines with production-grade identity matching.
 */

// ─── CSV Parsing ────────────────────────────────────────────────────────────────

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: string[];
}

export function parseCSVText(text: string, maxRows?: number): ParsedCSV {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0, errors: ["File is empty"] };

  const headers = parseCSVLine(lines[0]);
  if (headers.length === 0) return { headers: [], rows: [], totalRows: 0, errors: ["No headers detected"] };

  const totalRows = lines.length - 1;
  const limit = maxRows != null ? Math.min(maxRows, totalRows) : totalRows;
  const rows: Record<string, string>[] = [];
  for (let i = 1; i <= limit; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      errors.push(`Row ${i}: expected ${headers.length} columns, got ${values.length}`);
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows, totalRows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else current += char;
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { result.push(current.trim()); current = ""; }
      else current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Mappable fields ────────────────────────────────────────────────────────────

export interface MappableField {
  key: string;
  label: string;
  group: string;
  type: "string" | "number" | "array" | "date";
}

export const MAPPABLE_FIELDS: MappableField[] = [
  // Contact Identity
  { key: "first_name", label: "First Name", group: "Contact", type: "string" },
  { key: "last_name", label: "Last Name", group: "Contact", type: "string" },
  { key: "email", label: "Email", group: "Contact", type: "string" },
  { key: "secondary_email", label: "Secondary Email", group: "Contact", type: "string" },
  { key: "tertiary_email", label: "Tertiary Email", group: "Contact", type: "string" },
  { key: "personal_email", label: "Personal Email", group: "Contact", type: "string" },
  { key: "job_title", label: "Job Title", group: "Contact", type: "string" },
  { key: "seniority_level", label: "Seniority Level", group: "Contact", type: "string" },
  { key: "department", label: "Department", group: "Contact", type: "string" },
  { key: "headline", label: "Headline", group: "Contact", type: "string" },
  { key: "bio", label: "Bio", group: "Contact", type: "string" },
  { key: "persona", label: "Persona", group: "Contact", type: "string" },
  { key: "linkedin_url", label: "LinkedIn URL", group: "Contact", type: "string" },
  { key: "twitter_url", label: "Twitter URL", group: "Contact", type: "string" },
  { key: "facebook_url", label: "Facebook URL", group: "Contact", type: "string" },
  { key: "github_url", label: "GitHub URL", group: "Contact", type: "string" },
  { key: "photo_url", label: "Photo URL", group: "Contact", type: "string" },
  { key: "years_experience", label: "Years Experience", group: "Contact", type: "number" },
  { key: "skills", label: "Skills", group: "Contact", type: "array" },
  { key: "languages", label: "Languages", group: "Contact", type: "array" },
  { key: "job_change_date", label: "Job Change Date", group: "Contact", type: "date" },
  { key: "current_role_start_date", label: "Current Role Start Date", group: "Contact", type: "date" },
  // Phone
  { key: "phone", label: "Phone", group: "Phone", type: "string" },
  { key: "work_direct_phone", label: "Work Direct Phone", group: "Phone", type: "string" },
  { key: "mobile_phone", label: "Mobile Phone", group: "Phone", type: "string" },
  { key: "corporate_phone", label: "Corporate Phone", group: "Phone", type: "string" },
  { key: "home_phone", label: "Home Phone", group: "Phone", type: "string" },
  { key: "other_phone", label: "Other Phone", group: "Phone", type: "string" },
  // Location
  { key: "country", label: "Country", group: "Location", type: "string" },
  { key: "city", label: "City", group: "Location", type: "string" },
  { key: "state", label: "State", group: "Location", type: "string" },
  { key: "address", label: "Address", group: "Location", type: "string" },
  { key: "postal_code", label: "Postal Code", group: "Location", type: "string" },
  { key: "timezone", label: "Timezone", group: "Location", type: "string" },
  // Company
  { key: "company_name_raw", label: "Company Name", group: "Company", type: "string" },
  { key: "domain", label: "Domain", group: "Company", type: "string" },
  { key: "website", label: "Website", group: "Company", type: "string" },
  { key: "industry", label: "Industry", group: "Company", type: "string" },
  { key: "employee_count", label: "Employee Count", group: "Company", type: "number" },
  { key: "employee_range", label: "Employee Range", group: "Company", type: "string" },
  { key: "revenue_range", label: "Revenue Range", group: "Company", type: "string" },
  { key: "company_address", label: "Company Address", group: "Company", type: "string" },
  { key: "company_city", label: "Company City", group: "Company", type: "string" },
  { key: "company_state", label: "Company State", group: "Company", type: "string" },
  { key: "company_country", label: "Company Country", group: "Company", type: "string" },
  { key: "company_phone", label: "Company Phone", group: "Company", type: "string" },
  { key: "company_linkedin_url", label: "Company LinkedIn URL", group: "Company", type: "string" },
  { key: "annual_revenue", label: "Annual Revenue", group: "Company", type: "number" },
  { key: "total_funding", label: "Total Funding", group: "Company", type: "number" },
  { key: "latest_funding", label: "Latest Funding", group: "Company", type: "string" },
  { key: "latest_funding_amount", label: "Latest Funding Amount", group: "Company", type: "number" },
  { key: "last_raised_at", label: "Last Raised At", group: "Company", type: "date" },
  { key: "funding_stage", label: "Funding Stage", group: "Company", type: "string" },
  { key: "founded_year", label: "Founded Year", group: "Company", type: "number" },
  { key: "company_type", label: "Company Type", group: "Company", type: "string" },
  { key: "headquarters", label: "Headquarters", group: "Company", type: "string" },
  { key: "technologies", label: "Technologies", group: "Company", type: "array" },
  { key: "keywords", label: "Keywords", group: "Company", type: "array" },
  { key: "specialties", label: "Specialties", group: "Company", type: "array" },
  { key: "market_segments", label: "Market Segments", group: "Company", type: "array" },
  { key: "territories", label: "Territories", group: "Company", type: "array" },
  { key: "sic_code", label: "SIC Code", group: "Company", type: "string" },
  { key: "naics_code", label: "NAICS Code", group: "Company", type: "string" },
  { key: "stock_ticker", label: "Stock Ticker", group: "Company", type: "string" },
  { key: "headcount_growth_pct", label: "Headcount Growth %", group: "Company", type: "number" },
  // External
  { key: "external_source", label: "External Source", group: "External", type: "string" },
  { key: "external_contact_id", label: "External Contact ID", group: "External", type: "string" },
  { key: "external_account_id", label: "External Account ID", group: "External", type: "string" },
];

// ─── Auto-mapping heuristics ────────────────────────────────────────────────────

const AUTO_MAP_HINTS: Record<string, string[]> = {
  first_name: ["first name", "firstname", "given name", "fname", "person first name", "contact first name"],
  last_name: ["last name", "lastname", "surname", "family name", "lname", "person last name", "contact last name"],
  email: ["email", "email address", "primary email", "work email", "business email", "person email", "contact email", "email1"],
  secondary_email: ["secondary email", "email 2", "email2", "alternate email", "alt email", "other email"],
  tertiary_email: ["tertiary email", "email 3", "email3"],
  personal_email: ["personal email", "private email", "home email"],
  job_title: ["title", "job title", "position", "person title", "current title", "role", "job role"],
  seniority_level: ["seniority", "seniority level", "level", "career level"],
  department: ["department", "dept", "function", "team"],
  headline: ["headline", "tagline", "linkedin headline"],
  bio: ["bio", "biography", "about", "summary"],
  persona: ["persona", "buyer persona", "icp", "ideal customer profile"],
  linkedin_url: ["linkedin", "linkedin url", "person linkedin url", "linkedin profile", "linkedin profile url", "contact linkedin url", "lead linkedin"],
  twitter_url: ["twitter", "twitter url", "x url", "twitter handle"],
  facebook_url: ["facebook", "facebook url"],
  github_url: ["github", "github url"],
  photo_url: ["photo", "photo url", "avatar", "profile photo", "profile picture"],
  years_experience: ["years experience", "experience years", "yoe", "years of experience"],
  skills: ["skills", "skill set"],
  languages: ["languages", "spoken languages"],
  job_change_date: ["job change date", "job changed", "last job change"],
  current_role_start_date: ["role start date", "current role start", "started current role"],
  phone: ["phone", "phone number", "direct phone", "primary phone", "telephone", "tel"],
  work_direct_phone: ["work phone", "work direct phone", "office phone", "direct dial"],
  mobile_phone: ["mobile", "mobile phone", "cell", "cell phone", "cellphone"],
  corporate_phone: ["corporate phone", "company phone number", "main phone"],
  country: ["country", "person country", "contact country"],
  city: ["city", "person city", "contact city"],
  state: ["state", "person state", "region", "province"],
  address: ["address", "street address", "street"],
  postal_code: ["postal code", "zip", "zip code", "postcode"],
  timezone: ["timezone", "time zone", "tz"],
  company_name_raw: ["company", "company name", "organization", "organisation", "account name", "employer"],
  domain: ["domain", "company domain", "website domain", "primary domain", "email domain"],
  website: ["website", "company website", "url", "organization website", "company url", "company website url"],
  industry: ["industry", "company industry", "vertical"],
  employee_count: ["employees", "employee count", "number of employees", "headcount", "num employees"],
  employee_range: ["employee range", "company size", "size", "employee size"],
  revenue_range: ["revenue range", "revenue"],
  annual_revenue: ["annual revenue", "yearly revenue"],
  total_funding: ["total funding", "funding", "total raised"],
  latest_funding: ["latest funding round", "latest round", "last funding round"],
  latest_funding_amount: ["latest funding amount", "last funding amount"],
  funding_stage: ["funding stage", "stage", "investment stage"],
  founded_year: ["founded", "founded year", "year founded"],
  company_type: ["company type", "org type", "organization type"],
  headquarters: ["headquarters", "hq", "hq location", "company hq"],
  technologies: ["technologies", "tech stack", "technology stack"],
  keywords: ["keywords", "tags", "company keywords"],
  specialties: ["specialties", "specialty"],
  market_segments: ["market segments", "segments"],
  territories: ["territories", "territory"],
  sic_code: ["sic code", "sic"],
  naics_code: ["naics code", "naics"],
  stock_ticker: ["ticker", "stock ticker", "stock symbol"],
  headcount_growth_pct: ["headcount growth", "growth rate", "employee growth"],
  company_linkedin_url: ["company linkedin", "company linkedin url", "company linkedin profile", "organization linkedin", "org linkedin", "linkedin company url"],
  company_address: ["company address", "company street", "organization address"],
  company_city: ["company city", "organization city"],
  company_state: ["company state", "organization state"],
  company_country: ["company country", "organization country"],
  company_phone: ["company phone", "organization phone"],
  external_source: ["source", "lead source", "data source", "origin"],
  external_contact_id: ["external id", "contact id", "person id", "apollo id", "apollo contact id"],
  external_account_id: ["account id", "company id", "external account id", "apollo company id"],
};

function tokenize(header: string): string {
  return header.toLowerCase().trim()
    .replace(/[_\-\/\\.]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface AutoMapResult {
  field: string;
  confidence: number; // 0-100
  reason: "exact" | "alias" | "token-superset" | "contains";
}

/** Suggest a mapped field for a single CSV header. */
export function suggestFieldForHeader(header: string, claimed: Set<string> = new Set()): AutoMapResult | null {
  const norm = tokenize(header);
  if (!norm) return null;
  const tokens = new Set(norm.split(" "));

  for (const [fieldKey, hints] of Object.entries(AUTO_MAP_HINTS)) {
    if (claimed.has(fieldKey)) continue;
    if (norm === fieldKey.replace(/_/g, " ")) return { field: fieldKey, confidence: 100, reason: "exact" };
    if (hints.some((h) => h === norm)) return { field: fieldKey, confidence: 98, reason: "alias" };
  }
  for (const [fieldKey, hints] of Object.entries(AUTO_MAP_HINTS)) {
    if (claimed.has(fieldKey)) continue;
    for (const h of hints) {
      const htoks = h.split(" ");
      if (htoks.length >= 2 && htoks.every((t) => tokens.has(t))) {
        return { field: fieldKey, confidence: 85, reason: "token-superset" };
      }
    }
  }
  // Fallback: substring match — but only on word boundaries (so "email" does NOT
  // claim "Company Name for Emails") AND only for multi-token hints (so a single
  // generic word can't outrank a more specific header).
  for (const [fieldKey, hints] of Object.entries(AUTO_MAP_HINTS)) {
    if (claimed.has(fieldKey)) continue;
    for (const h of hints) {
      if (h.length < 5) continue;
      if (!h.includes(" ")) continue; // skip single-word hints in this pass
      const re = new RegExp(`(^|\\s)${h.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\s|$)`);
      if (re.test(norm)) {
        return { field: fieldKey, confidence: 70, reason: "contains" };
      }
    }
  }
  return null;
}

export function autoMapColumns(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<string>();
  for (const header of csvHeaders) {
    const m = suggestFieldForHeader(header, claimed);
    if (m) { mapping[header] = m.field; claimed.add(m.field); }
  }
  return mapping;
}

// ─── Per-field validators (used to gate normalization) ──────────────────────────

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

export const FIELD_VALIDATORS: Record<string, (v: string) => boolean> = {
  email: (v) => EMAIL_RE.test(v.trim()),
  secondary_email: (v) => EMAIL_RE.test(v.trim()),
  tertiary_email: (v) => EMAIL_RE.test(v.trim()),
  personal_email: (v) => EMAIL_RE.test(v.trim()),
  linkedin_url: (v) => /linkedin\.com\/(in|pub|company)\//i.test(v) || /^[a-z0-9][a-z0-9-]{2,}$/i.test(v.trim()),
  company_linkedin_url: (v) => /linkedin\.com\/(company|school)\//i.test(v),
  website: (v) => URL_RE.test(v.trim().replace(/\s+/g, "")),
  domain: (v) => DOMAIN_RE.test(v.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]),
  phone: (v) => (v.match(/\d/g)?.length ?? 0) >= 7,
  mobile_phone: (v) => (v.match(/\d/g)?.length ?? 0) >= 7,
  work_direct_phone: (v) => (v.match(/\d/g)?.length ?? 0) >= 7,
  corporate_phone: (v) => (v.match(/\d/g)?.length ?? 0) >= 7,
  company_phone: (v) => (v.match(/\d/g)?.length ?? 0) >= 7,
  // For company names: only flag obviously-bad values (very long or contains sentence punctuation that suggests free-text)
  // Reject only obviously non-name values: very long text, sentence terminators (! ?),
  // or > 20 whitespace-separated tokens (i.e. a description, not a name).
  company_name_raw: (v) => {
    const t = v.trim();
    return t.length <= 120 && !/[!?]$/.test(t) && t.split(/\s+/).length <= 20;
  },

};

export function isValidForField(fieldKey: string, value: string): boolean {
  if (!value || !value.trim()) return true; // empty is OK — handled separately
  const fn = FIELD_VALIDATORS[fieldKey];
  return fn ? fn(value) : true;
}

// ─── Advanced Normalization ─────────────────────────────────────────────────────

export interface NormalizationChange {
  field: string;
  original: string;
  normalized: string;
  rule: string;
}

export interface NormalizationResult {
  normalized: Record<string, unknown>;
  changes: NormalizationChange[];
}

/** Normalize empty/null-like strings */
function isEmptyLike(v: string): boolean {
  const lower = v.trim().toLowerCase();
  return lower === "" || lower === "n/a" || lower === "na" || lower === "null" ||
    lower === "undefined" || lower === "none" || lower === "-" || lower === "--" ||
    lower === "not available" || lower === "not provided" || lower === "#n/a";
}

/** Normalize email: lowercase, trim, remove mailto: */
function normalizeEmail(val: string): string {
  return val.toLowerCase().trim().replace(/^mailto:/i, "").replace(/\s+/g, "");
}

/** Normalize LinkedIn URL to canonical form */
function normalizeLinkedIn(val: string): string {
  let url = val.trim();
  // Remove query params and fragments
  url = url.split("?")[0].split("#")[0];
  // Strip protocol and www
  url = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  // Ensure starts with linkedin.com
  if (!url.startsWith("linkedin.com")) {
    // Try to find linkedin.com in the string
    const idx = url.indexOf("linkedin.com");
    if (idx >= 0) url = url.substring(idx);
    else url = "linkedin.com/in/" + url;
  }
  return "https://www." + url;
}

/** Normalize domain: strip protocol, www, trailing slash, lowercase */
function normalizeDomain(val: string): string {
  let d = val.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  d = d.split("/")[0]; // Only keep domain part
  d = d.split("?")[0];
  return d;
}

/** Normalize website URL */
function normalizeWebsite(val: string): string {
  let url = val.trim().toLowerCase();
  if (!url.startsWith("http")) url = "https://" + url;
  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  return url;
}

/** Normalize phone: keep digits and leading + only */
function normalizePhone(val: string): string {
  const trimmed = val.trim();
  // Keep + if it's the first character, then only digits
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? "+" + digits : digits;
}

/** Normalize company name for matching: lowercase, strip legal suffixes, collapse whitespace */
export function normalizeCompanyName(val: string): string {
  let name = val.trim().toLowerCase();
  // Remove common legal suffixes
  name = name.replace(/\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|sas|sarl|bv|nv|pty\.?\s*ltd\.?|pvt\.?\s*ltd\.?)\s*\.?\s*$/gi, "");
  // Collapse whitespace
  name = name.replace(/\s+/g, " ").trim();
  // Remove trailing punctuation
  name = name.replace(/[,.\-]+$/, "").trim();
  return name;
}

/** Title case for location fields */
function titleCase(val: string): string {
  return val.trim().replace(/\s+/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Decide whether an unmapped CSV header should be stored on the contact's
 * custom_fields or the company's custom_fields. Conservative: defaults to
 * contact-scope when unsure.
 */
export function classifyCustomFieldScope(header: string): "contact" | "company" {
  const h = header.toLowerCase().trim().replace(/[_\-\/\\.]+/g, " ").replace(/\s+/g, " ");
  // Strong company prefixes
  if (/^(company|organization|organisation|org|account|employer|firm|business)\b/.test(h)) return "company";
  // Strong contact prefixes — keep contact-scope explicit
  if (/^(contact|person|lead|prospect|recipient|attendee)\b/.test(h)) return "contact";
  // Common company-side topical words anywhere in header
  if (/\b(employees|headcount|revenue|funding|founded|industry|sic|naics|ticker|hq|headquarters|domain|website|technologies|tech stack|specialties|segments|territories|name for emails)\b/.test(h)) return "company";
  return "contact";
}

export function normalizeRow(
  raw: Record<string, string>,
  mapping: Record<string, string>,
  excluded: Set<string> = new Set()
): NormalizationResult {
  const normalized: Record<string, unknown> = {};
  const changes: NormalizationChange[] = [];
  const contactCustom: Record<string, string> = {};
  const companyCustom: Record<string, string> = {};
  const originals: Record<string, string> = {};
  const invalidFields: Record<string, string> = {};

  // 1) Preserve EVERY unmapped (and not user-excluded) column as a custom field,
  //    routed by header semantics. Nothing is silently dropped.
  for (const [csvCol, rawVal] of Object.entries(raw)) {
    if (mapping[csvCol]) continue;
    if (excluded.has(csvCol)) continue;
    const trimmed = (rawVal ?? "").trim();
    if (!trimmed || isEmptyLike(trimmed)) continue;
    const scope = classifyCustomFieldScope(csvCol);
    if (scope === "company") companyCustom[csvCol] = trimmed;
    else contactCustom[csvCol] = trimmed;
  }



  // 2) Process each mapped column
  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const rawVal = raw[csvCol] ?? "";
    const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);

    let val = rawVal.trim().replace(/\s+/g, " ");
    if (isEmptyLike(val)) { normalized[fieldKey] = null; continue; }

    originals[fieldKey] = rawVal;

    if (!field) { normalized[fieldKey] = val; continue; }

    // Validate first — if invalid for this field type, do NOT apply field-specific
    // normalization (avoids turning "bakery and confectionery ingredients" into a
    // "normalized email"). Record as invalid so the UI can warn.
    if (!isValidForField(fieldKey, val)) {
      invalidFields[fieldKey] = val;
      // Still preserve the raw value in _invalid_values for auditing, but don't write
      // a garbage normalized value into the standard column.
      normalized[fieldKey] = null;
      continue;
    }

    let next = val;
    let rule: string | null = null;

    if (fieldKey === "email" || fieldKey === "secondary_email" || fieldKey === "tertiary_email" || fieldKey === "personal_email") {
      next = normalizeEmail(val); rule = "Email normalized";
    } else if (fieldKey === "linkedin_url" || fieldKey === "company_linkedin_url") {
      next = normalizeLinkedIn(val); rule = "LinkedIn URL standardized";
    } else if (fieldKey === "domain") {
      next = normalizeDomain(val); rule = "Domain cleaned";
    } else if (fieldKey === "website") {
      next = normalizeWebsite(val); rule = "Website standardized";
    } else if (fieldKey.includes("phone")) {
      next = normalizePhone(val); rule = "Phone normalized";
    } else if (fieldKey === "company_name_raw") {
      const normName = normalizeCompanyName(val);
      // Only record a change when the cleaned form actually differs in a meaningful way.
      if (normName && normName !== val.toLowerCase()) {
        changes.push({ field: fieldKey, original: val, normalized: normName, rule: "Company name standardized" });
      }
      // Keep the original-cased name in the standard column.
    } else if (fieldKey === "country" || fieldKey === "city" || fieldKey === "state" ||
               fieldKey === "company_city" || fieldKey === "company_state" || fieldKey === "company_country") {
      next = titleCase(val); rule = "Location title-cased";
    }

    if (rule && next !== val) {
      changes.push({ field: fieldKey, original: val, normalized: next, rule });
    }
    val = next;

    // Type casting
    if (field.type === "number") {
      const num = Number(String(val).replace(/[,$\s]/g, ""));
      normalized[fieldKey] = isNaN(num) ? null : num;
      continue;
    }
    if (field.type === "array" && typeof val === "string") {
      normalized[fieldKey] = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      continue;
    }

    normalized[fieldKey] = val;
  }

  if (Object.keys(contactCustom).length > 0) normalized._contact_custom_fields = contactCustom;
  if (Object.keys(companyCustom).length > 0) normalized._company_custom_fields = companyCustom;
  if (Object.keys(originals).length > 0) normalized._original_values = originals;
  if (Object.keys(invalidFields).length > 0) normalized._invalid_values = invalidFields;


  return { normalized, changes };
}

// ─── Column-level analysis for the import preview ───────────────────────────────

export interface ColumnAnalysis {
  csvColumn: string;
  mappedField: string | null;
  fieldLabel: string | null;
  confidence: number | null;
  storedAs: "standard_field" | "contact_custom" | "company_custom" | "empty" | "excluded";
  sampleOriginal: string[];
  sampleNormalized: string[];
  changedRows: number;
  invalidRows: number;
  warning: string | null;
}

export function analyzeColumns(
  parsed: ParsedCSV,
  mapping: Record<string, string>,
  sampleSize = 50,
  excluded: Set<string> = new Set()
): ColumnAnalysis[] {
  const rows = parsed.rows.slice(0, sampleSize);
  return parsed.headers.map((header) => {
    const fieldKey = mapping[header] || null;
    const field = fieldKey ? MAPPABLE_FIELDS.find((f) => f.key === fieldKey) : undefined;
    const claimedReuse = new Set<string>(Object.values(mapping).filter((v) => v && v !== fieldKey));
    const suggestion = !fieldKey ? suggestFieldForHeader(header, claimedReuse) : null;

    const sampleOriginal: string[] = [];
    const sampleNormalized: string[] = [];
    let changedRows = 0;
    let invalidRows = 0;
    let nonEmpty = 0;

    for (const row of rows) {
      const rawVal = (row[header] ?? "").trim();
      if (!rawVal || isEmptyLike(rawVal)) continue;
      nonEmpty++;
      if (sampleOriginal.length < 3) sampleOriginal.push(rawVal);

      if (!fieldKey) continue;

      if (!isValidForField(fieldKey, rawVal)) {
        invalidRows++;
        continue;
      }
      const single = normalizeRow({ [header]: rawVal }, { [header]: fieldKey });
      const out = single.normalized[fieldKey];
      const outStr = out == null ? "" : Array.isArray(out) ? out.join(", ") : String(out);
      if (outStr && outStr !== rawVal) {
        changedRows++;
        if (sampleNormalized.length < 3) sampleNormalized.push(outStr);
      }
    }

    let warning: string | null = null;
    if (fieldKey && nonEmpty > 0 && invalidRows / nonEmpty >= 0.5) {
      warning = `This column does not look like ${field?.label ?? fieldKey} data — ${invalidRows} of ${nonEmpty} sampled values failed validation.`;
    }

    // Stored-as resolution: user exclusion wins, then standard mapping,
    // then custom-field destination by header scope, finally "empty" only
    // when the column truly has no values to import.
    let storedAs: ColumnAnalysis["storedAs"];
    if (excluded.has(header)) storedAs = "excluded";
    else if (fieldKey) storedAs = "standard_field";
    else if (nonEmpty === 0) storedAs = "empty";
    else storedAs = classifyCustomFieldScope(header) === "company" ? "company_custom" : "contact_custom";

    return {
      csvColumn: header,
      mappedField: fieldKey,
      fieldLabel: field?.label ?? null,
      confidence: fieldKey ? (suggestion?.confidence ?? null) : null,
      storedAs,
      sampleOriginal,
      sampleNormalized,
      changedRows,
      invalidRows,
      warning,
    };
  });
}


// ─── Advanced Duplicate Detection ───────────────────────────────────────────────

export type DuplicateStrategy =
  | "skip"
  | "update_missing"
  | "flag_review"
  | "review_company_conflicts"
  | "create_if_no_strong_match";

export type DuplicateClassification = "new" | "exact_duplicate" | "likely_duplicate" | "review_required" | "invalid";

export interface DuplicateDetail {
  rowIndex: number;
  classification: DuplicateClassification;
  matchType: string | null;
  matchedContactId: string | null;
  matchedCompanyId: string | null;
  confidence: number; // 0-100
  reason: string | null;
}

export interface DuplicateCheckResult {
  new: number;
  exactDuplicate: number;
  likelyDuplicate: number;
  reviewRequired: number;
  invalid: number;
  details: DuplicateDetail[];
}

export interface ExistingContact {
  id: string;
  email: string | null;
  secondary_email: string | null;
  tertiary_email: string | null;
  linkedin_url: string | null;
  external_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name_raw: string | null;
  phone: string | null;
  domain?: string | null;
}

export interface ExistingCompany {
  id: string;
  domain: string | null;
  normalized_name: string;
  external_account_id: string | null;
  website: string | null;
}

/** Build lookup indices for fast duplicate checks */
export function buildContactIndex(contacts: ExistingContact[]) {
  const emailMap = new Map<string, ExistingContact>();
  const linkedinMap = new Map<string, ExistingContact>();
  const extIdMap = new Map<string, ExistingContact>();
  const phoneMap = new Map<string, ExistingContact>();
  const nameCompanyMap = new Map<string, ExistingContact>();

  for (const c of contacts) {
    if (c.email) emailMap.set(c.email.toLowerCase(), c);
    if (c.secondary_email) emailMap.set(c.secondary_email.toLowerCase(), c);
    if (c.tertiary_email) emailMap.set(c.tertiary_email.toLowerCase(), c);
    if (c.linkedin_url) linkedinMap.set(normalizeLinkedIn(c.linkedin_url), c);
    if (c.external_contact_id) extIdMap.set(c.external_contact_id, c);
    if (c.phone) phoneMap.set(normalizePhone(c.phone), c);

    // Name+company composite key
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().trim();
    const companyKey = c.company_name_raw ? normalizeCompanyName(c.company_name_raw) : "";
    if (fullName && companyKey) {
      nameCompanyMap.set(`${fullName}|${companyKey}`, c);
    }
  }

  return { emailMap, linkedinMap, extIdMap, phoneMap, nameCompanyMap };
}

export function buildCompanyIndex(companies: ExistingCompany[]) {
  const domainMap = new Map<string, ExistingCompany>();
  const extIdMap = new Map<string, ExistingCompany>();
  const nameMap = new Map<string, ExistingCompany>();

  for (const c of companies) {
    if (c.domain) domainMap.set(normalizeDomain(c.domain), c);
    if (c.external_account_id) extIdMap.set(c.external_account_id, c);
    if (c.normalized_name) nameMap.set(c.normalized_name.toLowerCase(), c);
    if (c.website) domainMap.set(normalizeDomain(c.website), c);
  }

  return { domainMap, extIdMap, nameMap };
}

/** Multi-layer duplicate detection with priority matching */
export function checkDuplicatesAdvanced(
  rows: Record<string, unknown>[],
  contactIndex: ReturnType<typeof buildContactIndex>,
  companyIndex: ReturnType<typeof buildCompanyIndex>
): DuplicateCheckResult {
  let newCount = 0, exactCount = 0, likelyCount = 0, reviewCount = 0, invalidCount = 0;
  const details: DuplicateDetail[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string | null | undefined>;
    const email = String(row.email ?? "").toLowerCase().trim();
    const secEmail = String(row.secondary_email ?? "").toLowerCase().trim();
    const terEmail = String(row.tertiary_email ?? "").toLowerCase().trim();
    const linkedin = row.linkedin_url ? normalizeLinkedIn(String(row.linkedin_url)) : "";
    const extId = String(row.external_contact_id ?? "").trim();
    const phone = row.phone ? normalizePhone(String(row.phone)) : "";
    const firstName = String(row.first_name ?? "").toLowerCase().trim();
    const lastName = String(row.last_name ?? "").toLowerCase().trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const companyRaw = String(row.company_name_raw ?? "").trim();
    const companyNorm = companyRaw ? normalizeCompanyName(companyRaw) : "";
    const domain = row.domain ? normalizeDomain(String(row.domain)) : "";
    const extAccountId = String(row.external_account_id ?? "").trim();

    // Invalid check
    if (!email && !secEmail && !firstName && !lastName) {
      invalidCount++;
      details.push({ rowIndex: i, classification: "invalid", matchType: null, matchedContactId: null, matchedCompanyId: null, confidence: 0, reason: "Missing email and name" });
      continue;
    }

    // Priority 1: Exact email match (highest confidence)
    const allEmails = [email, secEmail, terEmail].filter(Boolean);
    let match: ExistingContact | undefined;
    let matchType = "";
    let confidence = 0;

    for (const e of allEmails) {
      const found = contactIndex.emailMap.get(e);
      if (found) { match = found; matchType = `Exact email: ${e}`; confidence = 100; break; }
    }

    // Priority 2: LinkedIn match
    if (!match && linkedin) {
      const found = contactIndex.linkedinMap.get(linkedin);
      if (found) { match = found; matchType = "Exact LinkedIn URL"; confidence = 95; }
    }

    // Priority 3: External contact ID
    if (!match && extId) {
      const found = contactIndex.extIdMap.get(extId);
      if (found) { match = found; matchType = `External ID: ${extId}`; confidence = 95; }
    }

    // Priority 4: Same name + same company domain
    if (!match && fullName && domain) {
      const companyMatch = companyIndex.domainMap.get(domain);
      if (companyMatch) {
        const nameKey = `${fullName}|${companyMatch.normalized_name.toLowerCase()}`;
        const found = contactIndex.nameCompanyMap.get(nameKey);
        if (found) { match = found; matchType = "Name + company domain match"; confidence = 80; }
      }
    }

    // Priority 5: Same name + same normalized company name
    if (!match && fullName && companyNorm) {
      const nameKey = `${fullName}|${companyNorm}`;
      const found = contactIndex.nameCompanyMap.get(nameKey);
      if (found) { match = found; matchType = "Name + company name match"; confidence = 70; }
    }

    // Priority 6: Phone match (lower confidence)
    if (!match && phone && phone.length >= 7) {
      const found = contactIndex.phoneMap.get(phone);
      if (found) { match = found; matchType = "Phone number match"; confidence = 55; }
    }

    // Company-level matching
    let companyMatch: ExistingCompany | undefined;
    let companyMatchType = "";
    if (domain) {
      companyMatch = companyIndex.domainMap.get(domain);
      if (companyMatch) companyMatchType = "Domain match";
    }
    if (!companyMatch && extAccountId) {
      companyMatch = companyIndex.extIdMap.get(extAccountId);
      if (companyMatch) companyMatchType = "External account ID match";
    }
    if (!companyMatch && companyNorm) {
      companyMatch = companyIndex.nameMap.get(companyNorm);
      if (companyMatch) companyMatchType = "Normalized name match";
    }

    // Classify
    if (match) {
      if (confidence >= 90) {
        exactCount++;
        details.push({
          rowIndex: i,
          classification: "exact_duplicate",
          matchType: matchType + (companyMatchType ? ` | Company: ${companyMatchType}` : ""),
          matchedContactId: match.id,
          matchedCompanyId: companyMatch?.id ?? null,
          confidence,
          reason: matchType,
        });
      } else if (confidence >= 65) {
        likelyCount++;
        details.push({
          rowIndex: i,
          classification: "likely_duplicate",
          matchType,
          matchedContactId: match.id,
          matchedCompanyId: companyMatch?.id ?? null,
          confidence,
          reason: matchType,
        });
      } else {
        reviewCount++;
        details.push({
          rowIndex: i,
          classification: "review_required",
          matchType,
          matchedContactId: match.id,
          matchedCompanyId: companyMatch?.id ?? null,
          confidence,
          reason: matchType,
        });
      }
    } else {
      newCount++;
      details.push({
        rowIndex: i,
        classification: "new",
        matchType: companyMatchType || null,
        matchedContactId: null,
        matchedCompanyId: companyMatch?.id ?? null,
        confidence: 0,
        reason: null,
      });
    }
  }

  return { new: newCount, exactDuplicate: exactCount, likelyDuplicate: likelyCount, reviewRequired: reviewCount, invalid: invalidCount, details };
}

// ─── Import Settings Types ──────────────────────────────────────────────────────

export interface ImportSettings {
  duplicate_strategy: DuplicateStrategy;
  skip_exact_duplicates: boolean;
  update_missing_fields: boolean;
  review_likely_duplicates: boolean;
  review_company_conflicts: boolean;
  create_if_no_strong_match: boolean;
  unmapped_columns: string[];
  import_tag: string;
  source: string;
  list_id: string | null;
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  duplicate_strategy: "flag_review",
  skip_exact_duplicates: true,
  update_missing_fields: false,
  review_likely_duplicates: true,
  review_company_conflicts: true,
  create_if_no_strong_match: true,
  unmapped_columns: [],
  import_tag: "",
  source: "csv_import",
  list_id: null,
};

/** Map duplicate classification to row status based on import settings */
export function classifyRowAction(
  classification: DuplicateClassification,
  settings: ImportSettings
): { status: string; action: string | null; reviewRequired: boolean } {
  switch (classification) {
    case "invalid":
      return { status: "error", action: null, reviewRequired: false };

    case "exact_duplicate":
      if (settings.skip_exact_duplicates) return { status: "skipped", action: "skipped_exact_duplicate", reviewRequired: false };
      if (settings.update_missing_fields) return { status: "success", action: "update_missing_fields", reviewRequired: false };
      return { status: "review", action: "exact_duplicate_flagged", reviewRequired: true };

    case "likely_duplicate":
      if (settings.review_likely_duplicates) return { status: "review", action: "likely_duplicate_flagged", reviewRequired: true };
      if (settings.update_missing_fields) return { status: "success", action: "update_missing_fields", reviewRequired: false };
      return { status: "review", action: "likely_duplicate_flagged", reviewRequired: true };

    case "review_required":
      return { status: "review", action: "low_confidence_match", reviewRequired: true };

    case "new":
    default:
      return { status: "success", action: "create_new", reviewRequired: false };
  }
}

// ─── Review Action Types ────────────────────────────────────────────────────────

export type ReviewAction = "create_new" | "link_existing" | "update_existing" | "skip" | "review_later";

export interface ReviewResolution {
  rowId: string;
  action: ReviewAction;
  selectedFields?: Record<string, "imported" | "existing">;
}

// ─── Activity Log Helpers ───────────────────────────────────────────────────────

export interface ActivityLogEntry {
  action: string;
  details: Record<string, unknown>;
}

export function buildActivityLog(
  action: string,
  importJobId: string,
  rowNumber: number,
  extras: Record<string, unknown> = {}
): ActivityLogEntry {
  return {
    action,
    details: {
      import_job_id: importJobId,
      row_number: rowNumber,
      timestamp: new Date().toISOString(),
      ...extras,
    },
  };
}

// ─── Data Quality Score ─────────────────────────────────────────────────────────

export function calculateDataQualityScore(data: Record<string, unknown>): number {
  let score = 0;
  const maxScore = 100;
  const fields = [
    { key: "email", weight: 20 },
    { key: "first_name", weight: 10 },
    { key: "last_name", weight: 10 },
    { key: "job_title", weight: 8 },
    { key: "company_name_raw", weight: 8 },
    { key: "linkedin_url", weight: 7 },
    { key: "phone", weight: 7 },
    { key: "country", weight: 5 },
    { key: "city", weight: 5 },
    { key: "domain", weight: 5 },
    { key: "department", weight: 5 },
    { key: "seniority_level", weight: 5 },
    { key: "industry", weight: 5 },
  ];

  for (const f of fields) {
    const val = data[f.key];
    if (val !== null && val !== undefined && val !== "") {
      score += f.weight;
    }
  }

  return Math.min(score, maxScore);
}
