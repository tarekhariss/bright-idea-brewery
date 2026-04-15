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
  first_name: ["first name", "first_name", "firstname", "given name"],
  last_name: ["last name", "last_name", "lastname", "surname", "family name"],
  email: ["email", "email address", "e-mail", "primary email", "person email"],
  secondary_email: ["secondary email", "email 2", "alternate email"],
  tertiary_email: ["tertiary email", "email 3"],
  personal_email: ["personal email", "personal e-mail"],
  job_title: ["title", "job title", "job_title", "position", "person title"],
  seniority_level: ["seniority", "seniority level", "level"],
  department: ["department", "dept"],
  headline: ["headline", "tagline"],
  bio: ["bio", "biography", "about"],
  persona: ["persona", "buyer persona", "icp"],
  linkedin_url: ["linkedin", "linkedin url", "person linkedin url", "linkedin profile"],
  twitter_url: ["twitter", "twitter url", "x url"],
  facebook_url: ["facebook", "facebook url"],
  github_url: ["github", "github url"],
  photo_url: ["photo", "photo url", "avatar", "profile photo"],
  years_experience: ["years experience", "experience years", "yoe"],
  skills: ["skills", "skill set"],
  languages: ["languages", "spoken languages"],
  job_change_date: ["job change date", "job changed"],
  current_role_start_date: ["role start date", "current role start"],
  phone: ["phone", "phone number", "direct phone"],
  work_direct_phone: ["work phone", "work direct phone", "office phone"],
  mobile_phone: ["mobile", "mobile phone", "cell", "cell phone"],
  corporate_phone: ["corporate phone", "company phone number"],
  country: ["country", "person country"],
  city: ["city", "person city"],
  state: ["state", "person state", "region"],
  address: ["address", "street address"],
  postal_code: ["postal code", "zip", "zip code", "postcode"],
  timezone: ["timezone", "time zone", "tz"],
  company_name_raw: ["company", "company name", "organization", "account name"],
  domain: ["domain", "company domain", "website domain"],
  website: ["website", "company website", "url"],
  industry: ["industry", "company industry"],
  employee_count: ["employees", "employee count", "number of employees", "# employees"],
  employee_range: ["employee range", "company size"],
  revenue_range: ["revenue range", "revenue"],
  annual_revenue: ["annual revenue", "yearly revenue"],
  total_funding: ["total funding", "funding"],
  latest_funding: ["latest funding round", "latest round"],
  latest_funding_amount: ["latest funding amount"],
  funding_stage: ["funding stage", "stage", "investment stage"],
  founded_year: ["founded", "founded year", "year founded"],
  company_type: ["company type", "org type"],
  headquarters: ["headquarters", "hq", "hq location"],
  technologies: ["technologies", "tech stack"],
  keywords: ["keywords", "tags"],
  specialties: ["specialties", "specialty"],
  market_segments: ["market segments", "segments"],
  territories: ["territories", "territory"],
  sic_code: ["sic code", "sic"],
  naics_code: ["naics code", "naics"],
  stock_ticker: ["ticker", "stock ticker", "stock symbol"],
  headcount_growth_pct: ["headcount growth", "growth rate", "employee growth"],
  external_source: ["source", "lead source", "data source"],
  external_contact_id: ["external id", "contact id", "person id", "apollo id"],
  external_account_id: ["account id", "company id", "external account id"],
};

export function autoMapColumns(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();
  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim().replace(/[_\-]/g, " ");
    for (const [fieldKey, hints] of Object.entries(AUTO_MAP_HINTS)) {
      if (usedFields.has(fieldKey)) continue;
      if (hints.some((h) => h === normalized)) {
        mapping[header] = fieldKey;
        usedFields.add(fieldKey);
        break;
      }
    }
  }
  return mapping;
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

export function normalizeRow(
  raw: Record<string, string>,
  mapping: Record<string, string>
): NormalizationResult {
  const normalized: Record<string, unknown> = {};
  const changes: NormalizationChange[] = [];

  function track(field: string, original: string, result: string, rule: string) {
    if (original !== result) {
      changes.push({ field, original, normalized: result, rule });
    }
    return result;
  }

  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const rawVal = raw[csvCol] ?? "";
    const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);

    // Whitespace trim
    let val = rawVal.trim();
    if (rawVal !== val && rawVal.length > 0) {
      changes.push({ field: fieldKey, original: rawVal, normalized: val, rule: "Whitespace trimmed" });
    }

    // Collapse internal whitespace
    const collapsed = val.replace(/\s+/g, " ");
    if (collapsed !== val) {
      changes.push({ field: fieldKey, original: val, normalized: collapsed, rule: "Whitespace collapsed" });
      val = collapsed;
    }

    // Empty to null
    if (isEmptyLike(val)) {
      normalized[fieldKey] = null;
      continue;
    }

    if (!field) { normalized[fieldKey] = val; continue; }

    // Field-specific normalization
    if (fieldKey === "email" || fieldKey === "secondary_email" || fieldKey === "tertiary_email") {
      val = track(fieldKey, val, normalizeEmail(val), "Email normalized");
    } else if (fieldKey === "linkedin_url") {
      val = track(fieldKey, val, normalizeLinkedIn(val), "LinkedIn URL standardized");
    } else if (fieldKey === "domain") {
      val = track(fieldKey, val, normalizeDomain(val), "Domain cleaned");
    } else if (fieldKey === "website") {
      val = track(fieldKey, val, normalizeWebsite(val), "Website standardized");
    } else if (fieldKey.includes("phone")) {
      val = track(fieldKey, val, normalizePhone(val), "Phone normalized");
    } else if (fieldKey === "company_name_raw") {
      // Keep original but also store a normalized version
      const normName = normalizeCompanyName(val);
      if (normName !== val.toLowerCase()) {
        changes.push({ field: fieldKey, original: val, normalized: normName, rule: "Company name standardized" });
      }
    } else if (fieldKey === "country" || fieldKey === "city" || fieldKey === "state" ||
               fieldKey === "company_city" || fieldKey === "company_state" || fieldKey === "company_country") {
      val = track(fieldKey, val, titleCase(val), "Location title-cased");
    }

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

  return { normalized, changes };
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
