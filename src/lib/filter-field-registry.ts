/**
 * Registry of all filterable fields for contacts and companies.
 * Organized by Apollo-style categories for the filter panel.
 */
import { type FilterFieldMeta } from "./advanced-filter-types";
export type { FilterFieldMeta };

// ─── Contact Fields ──────────────────────────────────────────
export const CONTACT_FILTER_FIELDS: FilterFieldMeta[] = [
  // Person Info
  { key: "first_name", label: "First Name", type: "text", table: "contacts", category: "Person Info" },
  { key: "last_name", label: "Last Name", type: "text", table: "contacts", category: "Person Info" },
  { key: "job_title", label: "Job Titles", type: "text", table: "contacts", category: "Person Info" },
  { key: "seniority_level", label: "Seniority", type: "text", table: "contacts", category: "Person Info" },
  { key: "department", label: "Department", type: "text", table: "contacts", category: "Person Info" },
  { key: "headline", label: "Headline", type: "text", table: "contacts", category: "Person Info" },
  { key: "persona", label: "Persona", type: "text", table: "contacts", category: "Person Info" },
  { key: "years_experience", label: "Total Years of Experience", type: "number", table: "contacts", category: "Person Info" },
  { key: "current_role_start_date", label: "Time in Current Role", type: "date", table: "contacts", category: "Person Info" },
  { key: "job_change_date", label: "Job Change", type: "date", table: "contacts", category: "Person Info" },
  { key: "timezone", label: "Time Zone", type: "text", table: "contacts", category: "Person Info" },
  { key: "languages", label: "Languages", type: "array", table: "contacts", category: "Person Info" },
  { key: "skills", label: "Skills", type: "array", table: "contacts", category: "Person Info" },

  // Contact Details
  { key: "email", label: "Email", type: "text", table: "contacts", category: "Contact Details" },
  { key: "personal_email", label: "Personal Email", type: "text", table: "contacts", category: "Contact Details" },
  { key: "secondary_email", label: "Secondary Email", type: "text", table: "contacts", category: "Contact Details" },
  { key: "phone", label: "Phone", type: "text", table: "contacts", category: "Contact Details" },
  { key: "mobile_phone", label: "Mobile Phone", type: "text", table: "contacts", category: "Contact Details" },
  { key: "work_direct_phone", label: "Direct Phone", type: "text", table: "contacts", category: "Contact Details" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text", table: "contacts", category: "Contact Details" },
  { key: "twitter_url", label: "Twitter URL", type: "text", table: "contacts", category: "Contact Details" },

  // Company Info (on contact)
  { key: "company_name_raw", label: "Company", type: "text", table: "contacts", category: "Company Info" },
  { key: "company_id", label: "Company (linked)", type: "text", table: "contacts", category: "Company Info" },

  // Email Status
  {
    key: "email_validity_status", label: "Email Status", type: "enum", table: "contacts", category: "Email Status",
    options: [
      { value: "valid", label: "Valid" },
      { value: "invalid", label: "Invalid" },
      { value: "catch_all", label: "Catch-All" },
      { value: "unknown", label: "Unknown" },
      { value: "risky", label: "Risky" },
    ],
  },
  { key: "email_confidence", label: "Email Confidence", type: "number", table: "contacts", category: "Email Status" },
  {
    key: "phone_status", label: "Phone Status", type: "enum", table: "contacts", category: "Email Status",
    options: [
      { value: "verified", label: "Verified" },
      { value: "invalid", label: "Invalid" },
      { value: "unknown", label: "Unknown" },
      { value: "do_not_call", label: "Do Not Call" },
    ],
  },

  // Email Verification Memory (v2) — canonical, modifiers, provenance
  {
    key: "email_canonical_status", label: "Verification Status (v2)", type: "enum", table: "contacts", category: "Email Verification (v2)",
    options: [
      { value: "valid", label: "Valid" },
      { value: "valid_catch_all", label: "Catch-all" },
      { value: "risky", label: "Risky" },
      { value: "unknown", label: "Unknown" },
      { value: "invalid", label: "Invalid" },
      { value: "bounced", label: "Bounced" },
      { value: "suppressed", label: "Suppressed" },
      { value: "unverified", label: "Unverified" },
    ],
  },
  { key: "email_is_role_based",       label: "Role-based Email",       type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_disposable",       label: "Disposable Email",       type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_free_email",       label: "Free-email Provider",    type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_catch_all",        label: "Catch-all Domain",       type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_syntax_invalid",   label: "Syntax Invalid",         type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_mx_missing",       label: "MX Missing",             type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_is_temporary_failure",label: "Temporary Failure",      type: "boolean", table: "contacts", category: "Email Verification (v2)" },
  { key: "email_status_source",       label: "Verification Source",    type: "text",    table: "contacts", category: "Email Verification (v2)" },
  { key: "email_status_verified_at",  label: "Last Verified Date",     type: "date",    table: "contacts", category: "Email Verification (v2)" },

  // Lifecycle & Outreach
  {
    key: "lifecycle_status", label: "Lifecycle Stage", type: "enum", table: "contacts", category: "Lifecycle & Outreach",
    options: [
      { value: "new", label: "New" },
      { value: "researching", label: "Researching" },
      { value: "qualified", label: "Qualified" },
      { value: "nurturing", label: "Nurturing" },
      { value: "engaged", label: "Engaged" },
      { value: "converted", label: "Converted" },
      { value: "churned", label: "Churned" },
      { value: "archived", label: "Archived" },
    ],
  },
  {
    key: "outreach_status", label: "Outreach Status", type: "enum", table: "contacts", category: "Lifecycle & Outreach",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_sequence", label: "In Sequence" },
      { value: "replied", label: "Replied" },
      { value: "bounced", label: "Bounced" },
      { value: "opted_out", label: "Opted Out" },
      { value: "meeting_booked", label: "Meeting Booked" },
    ],
  },
  { key: "do_not_contact", label: "Do Not Contact", type: "boolean", table: "contacts", category: "Lifecycle & Outreach" },
  { key: "last_contacted_at", label: "Last Contacted", type: "date", table: "contacts", category: "Lifecycle & Outreach" },

  // Location
  { key: "country", label: "Country", type: "text", table: "contacts", category: "Location" },
  { key: "city", label: "City", type: "text", table: "contacts", category: "Location" },
  { key: "state", label: "State", type: "text", table: "contacts", category: "Location" },

  // Created Source
  { key: "source", label: "Source", type: "text", table: "contacts", category: "Created Source" },
  { key: "source_file", label: "CSV Import Source", type: "text", table: "contacts", category: "Created Source" },
  { key: "import_tag", label: "Import Tag", type: "text", table: "contacts", category: "Created Source" },
  { key: "enrichment_source", label: "Enrichment Source", type: "text", table: "contacts", category: "Created Source" },
  { key: "created_at", label: "Contact Created Date", type: "date", table: "contacts", category: "Created Source" },
  { key: "updated_at", label: "Updated Date", type: "date", table: "contacts", category: "Created Source" },

  // Quality & Scores
  { key: "data_quality_score", label: "Data Quality Score", type: "number", table: "contacts", category: "Scores" },

  // Ownership
  { key: "owner_id", label: "Owner", type: "text", table: "contacts", category: "Ownership" },
];

// ─── Company Fields ──────────────────────────────────────────
export const COMPANY_FILTER_FIELDS: FilterFieldMeta[] = [
  // Company Info
  { key: "name", label: "Company Name", type: "text", table: "companies", category: "Company Info" },
  { key: "domain", label: "Domain", type: "text", table: "companies", category: "Company Info" },
  { key: "website", label: "Website", type: "text", table: "companies", category: "Company Info" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text", table: "companies", category: "Company Info" },
  { key: "company_type", label: "Company Type", type: "text", table: "companies", category: "Company Info" },
  { key: "description", label: "Description", type: "text", table: "companies", category: "Company Info" },

  // Firmographic
  { key: "industry", label: "Industry", type: "text", table: "companies", category: "Firmographic" },
  { key: "employee_count", label: "# Employees", type: "number", table: "companies", category: "Firmographic" },
  { key: "employee_range", label: "Employee Range", type: "text", table: "companies", category: "Firmographic" },
  { key: "headcount_growth_pct", label: "Headcount Growth", type: "number", table: "companies", category: "Firmographic" },
  { key: "revenue_range", label: "Revenue Range", type: "text", table: "companies", category: "Firmographic" },
  { key: "annual_revenue", label: "Annual Revenue", type: "number", table: "companies", category: "Firmographic" },
  { key: "founded_year", label: "Founded Year", type: "number", table: "companies", category: "Firmographic" },
  { key: "retail_location_count", label: "Retail Locations", type: "number", table: "companies", category: "Firmographic" },
  { key: "sic_code", label: "SIC Code", type: "text", table: "companies", category: "Firmographic" },
  { key: "naics_code", label: "NAICS Code", type: "text", table: "companies", category: "Firmographic" },

  // Funding
  { key: "funding_stage", label: "Funding Stage", type: "text", table: "companies", category: "Funding" },
  { key: "total_funding", label: "Total Funding", type: "number", table: "companies", category: "Funding" },
  { key: "latest_funding_amount", label: "Latest Funding Amount", type: "number", table: "companies", category: "Funding" },
  { key: "latest_funding", label: "Latest Funding Round", type: "text", table: "companies", category: "Funding" },
  { key: "last_raised_at", label: "Last Raised Date", type: "date", table: "companies", category: "Funding" },

  // Tech & Signals
  { key: "technologies", label: "Technologies", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "keywords", label: "Industry & Keywords", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "specialties", label: "Specialties", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "market_segments", label: "Market Segments", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "territories", label: "Territories", type: "array", table: "companies", category: "Tech & Signals" },

  // Location
  { key: "country", label: "Country", type: "text", table: "companies", category: "Location" },
  { key: "city", label: "City", type: "text", table: "companies", category: "Location" },
  { key: "state", label: "State", type: "text", table: "companies", category: "Location" },
  { key: "headquarters", label: "Headquarters", type: "text", table: "companies", category: "Location" },

  // Created Source
  { key: "created_at", label: "Created Date", type: "date", table: "companies", category: "Created Source" },
  { key: "updated_at", label: "Updated Date", type: "date", table: "companies", category: "Created Source" },

  // Ownership
  { key: "owner_id", label: "Owner", type: "text", table: "companies", category: "Ownership" },
  { key: "parent_company_id", label: "Parent Company", type: "text", table: "companies", category: "Ownership" },

  // Quality
  { key: "data_quality_score", label: "Data Quality Score", type: "number", table: "companies", category: "Scores" },
  { key: "enrichment_source", label: "Enrichment Source", type: "text", table: "companies", category: "Scores" },
];

// Pinned filter keys (shown at top for quick access)
export const PINNED_CONTACT_FILTERS = [
  "job_title", "seniority_level", "company_name_raw", "email_validity_status",
  "lifecycle_status", "country", "industry",
];

export const PINNED_COMPANY_FILTERS = [
  "name", "domain", "industry", "employee_count", "funding_stage", "country",
];

export function getPinnedFilters(entity: "contact" | "company"): string[] {
  return entity === "contact" ? PINNED_CONTACT_FILTERS : PINNED_COMPANY_FILTERS;
}

export function getFieldsForEntity(entity: "contact" | "company"): FilterFieldMeta[] {
  return entity === "contact" ? CONTACT_FILTER_FIELDS : COMPANY_FILTER_FIELDS;
}

export function getFieldMeta(entity: "contact" | "company", key: string): FilterFieldMeta | undefined {
  return getFieldsForEntity(entity).find((f) => f.key === key);
}

export function getCategories(entity: "contact" | "company"): string[] {
  const fields = getFieldsForEntity(entity);
  return [...new Set(fields.map((f) => f.category))];
}
