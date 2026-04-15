/**
 * Registry of all filterable fields for contacts and companies.
 * Used by the Advanced Filter Panel to render field pickers and operators.
 */
import type { FilterFieldMeta } from "./advanced-filter-types";

// ─── Contact Fields ──────────────────────────────────────────
export const CONTACT_FILTER_FIELDS: FilterFieldMeta[] = [
  // Identity
  { key: "first_name", label: "First Name", type: "text", table: "contacts", category: "Identity" },
  { key: "last_name", label: "Last Name", type: "text", table: "contacts", category: "Identity" },
  { key: "email", label: "Email", type: "text", table: "contacts", category: "Identity" },
  { key: "personal_email", label: "Personal Email", type: "text", table: "contacts", category: "Identity" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text", table: "contacts", category: "Identity" },

  // Job
  { key: "job_title", label: "Job Title", type: "text", table: "contacts", category: "Job" },
  { key: "seniority_level", label: "Seniority", type: "text", table: "contacts", category: "Job" },
  { key: "department", label: "Department", type: "text", table: "contacts", category: "Job" },
  { key: "headline", label: "Headline", type: "text", table: "contacts", category: "Job" },
  { key: "years_experience", label: "Years of Experience", type: "number", table: "contacts", category: "Job" },
  { key: "current_role_start_date", label: "Time in Current Role", type: "date", table: "contacts", category: "Job" },
  { key: "job_change_date", label: "Job Change Date", type: "date", table: "contacts", category: "Job" },
  { key: "persona", label: "Persona", type: "text", table: "contacts", category: "Job" },

  // Contact Info
  { key: "phone", label: "Phone", type: "text", table: "contacts", category: "Contact Info" },
  { key: "mobile_phone", label: "Mobile Phone", type: "text", table: "contacts", category: "Contact Info" },
  { key: "work_direct_phone", label: "Direct Phone", type: "text", table: "contacts", category: "Contact Info" },

  // Status
  {
    key: "email_validity_status", label: "Email Status", type: "enum", table: "contacts", category: "Status",
    options: [
      { value: "valid", label: "Valid" },
      { value: "invalid", label: "Invalid" },
      { value: "catch_all", label: "Catch-All" },
      { value: "unknown", label: "Unknown" },
      { value: "risky", label: "Risky" },
    ],
  },
  {
    key: "phone_status", label: "Phone Status", type: "enum", table: "contacts", category: "Status",
    options: [
      { value: "verified", label: "Verified" },
      { value: "invalid", label: "Invalid" },
      { value: "unknown", label: "Unknown" },
      { value: "do_not_call", label: "Do Not Call" },
    ],
  },
  {
    key: "lifecycle_status", label: "Lifecycle Stage", type: "enum", table: "contacts", category: "Status",
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
    key: "outreach_status", label: "Outreach Status", type: "enum", table: "contacts", category: "Status",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_sequence", label: "In Sequence" },
      { value: "replied", label: "Replied" },
      { value: "bounced", label: "Bounced" },
      { value: "opted_out", label: "Opted Out" },
      { value: "meeting_booked", label: "Meeting Booked" },
    ],
  },
  { key: "do_not_contact", label: "Do Not Contact", type: "boolean", table: "contacts", category: "Status" },

  // Location
  { key: "country", label: "Country", type: "text", table: "contacts", category: "Location" },
  { key: "city", label: "City", type: "text", table: "contacts", category: "Location" },
  { key: "state", label: "State", type: "text", table: "contacts", category: "Location" },
  { key: "timezone", label: "Timezone", type: "text", table: "contacts", category: "Location" },

  // Source & Enrichment
  { key: "source", label: "Source", type: "text", table: "contacts", category: "Source" },
  { key: "source_file", label: "CSV Import Source", type: "text", table: "contacts", category: "Source" },
  { key: "import_tag", label: "Import Tag", type: "text", table: "contacts", category: "Source" },
  { key: "enrichment_source", label: "Enrichment Source", type: "text", table: "contacts", category: "Source" },
  { key: "data_quality_score", label: "Data Quality Score", type: "number", table: "contacts", category: "Source" },

  // Ownership
  { key: "owner_id", label: "Owner", type: "text", table: "contacts", category: "Ownership" },
  { key: "company_id", label: "Company", type: "text", table: "contacts", category: "Ownership" },
  { key: "company_name_raw", label: "Company Name", type: "text", table: "contacts", category: "Ownership" },

  // Dates
  { key: "created_at", label: "Created Date", type: "date", table: "contacts", category: "Dates" },
  { key: "updated_at", label: "Updated Date", type: "date", table: "contacts", category: "Dates" },
  { key: "last_contacted_at", label: "Last Contacted", type: "date", table: "contacts", category: "Dates" },
  { key: "last_enriched_at", label: "Last Enriched", type: "date", table: "contacts", category: "Dates" },

  // Arrays
  { key: "languages", label: "Languages", type: "array", table: "contacts", category: "Profile" },
  { key: "skills", label: "Skills", type: "array", table: "contacts", category: "Profile" },
];

// ─── Company Fields ──────────────────────────────────────────
export const COMPANY_FILTER_FIELDS: FilterFieldMeta[] = [
  // Identity
  { key: "name", label: "Company Name", type: "text", table: "companies", category: "Identity" },
  { key: "domain", label: "Domain", type: "text", table: "companies", category: "Identity" },
  { key: "website", label: "Website", type: "text", table: "companies", category: "Identity" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text", table: "companies", category: "Identity" },

  // Firmographic
  { key: "industry", label: "Industry", type: "text", table: "companies", category: "Firmographic" },
  { key: "company_type", label: "Company Type", type: "text", table: "companies", category: "Firmographic" },
  { key: "employee_count", label: "Employee Count", type: "number", table: "companies", category: "Firmographic" },
  { key: "employee_range", label: "Employee Range", type: "text", table: "companies", category: "Firmographic" },
  { key: "headcount_growth_pct", label: "Headcount Growth %", type: "number", table: "companies", category: "Firmographic" },
  { key: "revenue_range", label: "Revenue Range", type: "text", table: "companies", category: "Firmographic" },
  { key: "annual_revenue", label: "Annual Revenue", type: "number", table: "companies", category: "Firmographic" },
  { key: "founded_year", label: "Founded Year", type: "number", table: "companies", category: "Firmographic" },
  { key: "sic_code", label: "SIC Code", type: "text", table: "companies", category: "Firmographic" },
  { key: "naics_code", label: "NAICS Code", type: "text", table: "companies", category: "Firmographic" },

  // Funding
  { key: "funding_stage", label: "Funding Stage", type: "text", table: "companies", category: "Funding" },
  { key: "total_funding", label: "Total Funding", type: "number", table: "companies", category: "Funding" },
  { key: "latest_funding_amount", label: "Latest Funding Amount", type: "number", table: "companies", category: "Funding" },
  { key: "latest_funding", label: "Latest Funding Round", type: "text", table: "companies", category: "Funding" },
  { key: "last_raised_at", label: "Last Raised Date", type: "date", table: "companies", category: "Funding" },

  // Location
  { key: "country", label: "Country", type: "text", table: "companies", category: "Location" },
  { key: "city", label: "City", type: "text", table: "companies", category: "Location" },
  { key: "state", label: "State", type: "text", table: "companies", category: "Location" },
  { key: "headquarters", label: "Headquarters", type: "text", table: "companies", category: "Location" },

  // Tech & Signals
  { key: "technologies", label: "Technologies", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "keywords", label: "Keywords", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "specialties", label: "Specialties", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "market_segments", label: "Market Segments", type: "array", table: "companies", category: "Tech & Signals" },
  { key: "territories", label: "Territories", type: "array", table: "companies", category: "Tech & Signals" },

  // Ownership
  { key: "owner_id", label: "Owner", type: "text", table: "companies", category: "Ownership" },
  { key: "parent_company_id", label: "Parent Company", type: "text", table: "companies", category: "Ownership" },

  // Dates
  { key: "created_at", label: "Created Date", type: "date", table: "companies", category: "Dates" },
  { key: "updated_at", label: "Updated Date", type: "date", table: "companies", category: "Dates" },

  // Quality
  { key: "data_quality_score", label: "Data Quality Score", type: "number", table: "companies", category: "Quality" },
  { key: "enrichment_source", label: "Enrichment Source", type: "text", table: "companies", category: "Quality" },
];

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
