/**
 * CSV parsing and normalization utilities for the Import Center.
 * Designed for large files — uses streaming-friendly patterns.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: string[];
}

export function parseCSVText(text: string, maxPreviewRows = 500): ParsedCSV {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ["File is empty"] };
  }

  const headers = parseCSVLine(lines[0]);
  if (headers.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ["No headers detected"] };
  }

  const totalRows = lines.length - 1;
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length && i <= maxPreviewRows; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      errors.push(`Row ${i}: expected ${headers.length} columns, got ${values.length}`);
      // Still include with padding/truncating
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
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
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Mappable fields ───────────────────────────────────────────────────────────

export interface MappableField {
  key: string;
  label: string;
  group: string;
  type: "string" | "number" | "array" | "date";
}

export const MAPPABLE_FIELDS: MappableField[] = [
  // Contact core
  { key: "first_name", label: "First Name", group: "Contact", type: "string" },
  { key: "last_name", label: "Last Name", group: "Contact", type: "string" },
  { key: "email", label: "Email", group: "Contact", type: "string" },
  { key: "secondary_email", label: "Secondary Email", group: "Contact", type: "string" },
  { key: "tertiary_email", label: "Tertiary Email", group: "Contact", type: "string" },
  { key: "job_title", label: "Job Title", group: "Contact", type: "string" },
  { key: "seniority_level", label: "Seniority Level", group: "Contact", type: "string" },
  { key: "department", label: "Department", group: "Contact", type: "string" },
  { key: "linkedin_url", label: "LinkedIn URL", group: "Contact", type: "string" },
  // Phones
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
  { key: "annual_revenue", label: "Annual Revenue", group: "Company", type: "number" },
  { key: "total_funding", label: "Total Funding", group: "Company", type: "number" },
  { key: "latest_funding", label: "Latest Funding", group: "Company", type: "string" },
  { key: "latest_funding_amount", label: "Latest Funding Amount", group: "Company", type: "number" },
  { key: "last_raised_at", label: "Last Raised At", group: "Company", type: "date" },
  { key: "technologies", label: "Technologies", group: "Company", type: "array" },
  { key: "keywords", label: "Keywords", group: "Company", type: "array" },
  // External IDs
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
  job_title: ["title", "job title", "job_title", "position", "person title"],
  seniority_level: ["seniority", "seniority level", "level"],
  department: ["department", "dept"],
  linkedin_url: ["linkedin", "linkedin url", "person linkedin url", "linkedin profile"],
  phone: ["phone", "phone number", "direct phone"],
  work_direct_phone: ["work phone", "work direct phone", "office phone"],
  mobile_phone: ["mobile", "mobile phone", "cell", "cell phone"],
  corporate_phone: ["corporate phone", "company phone number"],
  country: ["country", "person country"],
  city: ["city", "person city"],
  state: ["state", "person state", "region"],
  company_name_raw: ["company", "company name", "organization", "account name"],
  domain: ["domain", "company domain", "website domain"],
  website: ["website", "company website", "url"],
  industry: ["industry", "company industry"],
  employee_count: ["employees", "employee count", "number of employees", "# employees"],
  employee_range: ["employee range", "company size"],
  revenue_range: ["revenue range", "revenue"],
  annual_revenue: ["annual revenue", "yearly revenue"],
  total_funding: ["total funding", "funding"],
  technologies: ["technologies", "tech stack"],
  keywords: ["keywords", "tags"],
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

// ─── Normalization ──────────────────────────────────────────────────────────────

export interface NormalizationResult {
  normalized: Record<string, unknown>;
  changes: { field: string; original: string; normalized: string; rule: string }[];
}

export function normalizeRow(
  raw: Record<string, string>,
  mapping: Record<string, string>
): NormalizationResult {
  const normalized: Record<string, unknown> = {};
  const changes: NormalizationResult["changes"] = [];

  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const rawVal = raw[csvCol] ?? "";
    const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);
    if (!field) {
      normalized[fieldKey] = rawVal;
      continue;
    }

    let val: unknown = rawVal;

    // Whitespace trimming
    if (typeof val === "string" && val !== val.trim()) {
      changes.push({ field: fieldKey, original: val, normalized: val.trim(), rule: "Whitespace trimmed" });
      val = (val as string).trim();
    }

    // Empty to null
    if (val === "" || val === "N/A" || val === "n/a" || val === "null" || val === "undefined") {
      val = null;
    }

    if (val && typeof val === "string") {
      let strVal = val as string;
      // Email normalization
      if (fieldKey.includes("email")) {
        const lower = strVal.toLowerCase();
        if (lower !== strVal) {
          changes.push({ field: fieldKey, original: strVal, normalized: lower, rule: "Email lowercased" });
        }
        strVal = lower;
      }

      // LinkedIn cleanup
      if (fieldKey === "linkedin_url") {
        let cleaned = strVal.replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/i, "https://www.");
        if (!cleaned.startsWith("http")) cleaned = "https://www." + cleaned;
        if (cleaned !== strVal) {
          changes.push({ field: fieldKey, original: strVal, normalized: cleaned, rule: "LinkedIn URL standardized" });
        }
        strVal = cleaned;
      }

      // Domain cleanup
      if (fieldKey === "domain") {
        let cleaned = strVal.toLowerCase().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
        if (cleaned !== strVal) {
          changes.push({ field: fieldKey, original: strVal, normalized: cleaned, rule: "Domain cleaned" });
        }
        strVal = cleaned;
      }

      // Phone cleanup
      if (fieldKey.includes("phone")) {
        const cleaned = strVal.replace(/[^\d+\-() ]/g, "");
        if (cleaned !== strVal) {
          changes.push({ field: fieldKey, original: strVal, normalized: cleaned, rule: "Phone characters cleaned" });
        }
        strVal = cleaned;
      }
      val = strVal;
    }

    // Type casting
    if (field.type === "number" && val !== null) {
      const num = Number(String(val).replace(/[,$]/g, ""));
      val = isNaN(num) ? null : num;
    }
    if (field.type === "array" && typeof val === "string" && val) {
      val = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    }

    normalized[fieldKey] = val;
  }

  return { normalized, changes };
}

// ─── Duplicate detection ────────────────────────────────────────────────────────

export type DuplicateStrategy = "skip" | "update_missing" | "flag_review";

export interface DuplicateCheckResult {
  likelyNew: number;
  likelyDuplicate: number;
  likelyReview: number;
  invalid: number;
  details: {
    rowIndex: number;
    reason: string | null;
    status: "new" | "duplicate" | "review" | "invalid";
  }[];
}

export function checkDuplicatesLocal(
  rows: Record<string, unknown>[],
  existingEmails: Set<string>,
  existingLinkedins: Set<string>,
  existingExtIds: Set<string>
): DuplicateCheckResult {
  let likelyNew = 0;
  let likelyDuplicate = 0;
  let likelyReview = 0;
  let invalid = 0;
  const details: DuplicateCheckResult["details"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const email = String(row.email ?? "").toLowerCase().trim();
    const linkedin = String(row.linkedin_url ?? "").toLowerCase().trim();
    const extId = String(row.external_contact_id ?? "").trim();

    // Invalid check — no email and no name
    if (!email && !row.first_name && !row.last_name) {
      invalid++;
      details.push({ rowIndex: i, reason: "Missing email and name", status: "invalid" });
      continue;
    }

    // Exact email match
    if (email && existingEmails.has(email)) {
      likelyDuplicate++;
      details.push({ rowIndex: i, reason: `Email match: ${email}`, status: "duplicate" });
      continue;
    }

    // LinkedIn match
    if (linkedin && existingLinkedins.has(linkedin)) {
      likelyDuplicate++;
      details.push({ rowIndex: i, reason: `LinkedIn match`, status: "duplicate" });
      continue;
    }

    // External ID match
    if (extId && existingExtIds.has(extId)) {
      likelyDuplicate++;
      details.push({ rowIndex: i, reason: `External ID match: ${extId}`, status: "duplicate" });
      continue;
    }

    likelyNew++;
    details.push({ rowIndex: i, reason: null, status: "new" });
  }

  return { likelyNew, likelyDuplicate, likelyReview, invalid, details };
}
