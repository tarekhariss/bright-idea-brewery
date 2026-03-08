-- ============================================================
-- Performance indexes for large dataset optimization
-- Run this in your Supabase SQL editor
-- ============================================================

-- CONTACTS: Single-column indexes on frequently filtered/sorted fields
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_secondary_email ON contacts (secondary_email);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_url ON contacts (linkedin_url);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts (country);
CREATE INDEX IF NOT EXISTS idx_contacts_department ON contacts (department);
CREATE INDEX IF NOT EXISTS idx_contacts_seniority_level ON contacts (seniority_level);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_status ON contacts (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_status ON contacts (outreach_status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts (owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_data_quality_score ON contacts (data_quality_score);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts (updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted_at ON contacts (last_contacted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_external_contact_id ON contacts (external_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_do_not_contact ON contacts (do_not_contact) WHERE do_not_contact = true;

-- COMPANIES: Single-column indexes
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (domain);
CREATE INDEX IF NOT EXISTS idx_companies_linkedin_url ON companies (linkedin_url);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies (country);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies (owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_data_quality_score ON companies (data_quality_score);
CREATE INDEX IF NOT EXISTS idx_companies_external_account_id ON companies (external_account_id);
CREATE INDEX IF NOT EXISTS idx_companies_updated_at ON companies (updated_at);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies (created_at);

-- COMPOUND INDEXES for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_country_lifecycle ON contacts (country, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_company_lifecycle ON contacts (company_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_lifecycle ON contacts (owner_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_updated ON contacts (lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_updated ON contacts (outreach_status, updated_at DESC);

-- IMPORT JOB ROWS: indexes for review/status queries
CREATE INDEX IF NOT EXISTS idx_import_job_rows_status ON import_job_rows (status);
CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_id ON import_job_rows (import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_job_rows_review ON import_job_rows (review_required) WHERE review_required = true;

-- LIST CONTACTS: indexes for join queries
CREATE INDEX IF NOT EXISTS idx_list_contacts_list_id ON list_contacts (list_id);
CREATE INDEX IF NOT EXISTS idx_list_contacts_contact_id ON list_contacts (contact_id);

-- TRIGRAM indexes for fast ILIKE search (requires pg_trgm extension)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm ON contacts USING gin (first_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm ON contacts USING gin (last_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_company_name_raw_trgm ON contacts USING gin (company_name_raw gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);
