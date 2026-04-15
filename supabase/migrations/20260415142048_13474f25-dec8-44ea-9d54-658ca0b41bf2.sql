
-- Enable trigram extension for ILIKE search at scale
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalized search columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS normalized_name text
  GENERATED ALWAYS AS (lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) STORED;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS normalized_domain text
  GENERATED ALWAYS AS (lower(coalesce(domain,''))) STORED;

-- Trigram indexes for ILIKE search (critical for 100K+ rows)
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm ON contacts USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm ON contacts USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_company_name_raw_trgm ON contacts USING gin (company_name_raw gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_name_trgm ON contacts USING gin (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_domain_trgm ON companies USING gin (domain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain_trgm ON companies USING gin (normalized_domain gin_trgm_ops);

-- B-tree index on normalized columns for prefix/exact match
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_name ON contacts (normalized_name);
CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain ON companies (normalized_domain);

-- Compound indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_updated ON contacts (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_workspace_updated ON companies (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_lifecycle ON contacts (workspace_id, lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_outreach ON contacts (workspace_id, outreach_status, updated_at DESC);

-- List membership indexes (critical for include/exclude list filtering)
CREATE INDEX IF NOT EXISTS idx_list_contacts_contact_list ON list_contacts (contact_id, list_id);
