-- ============================================================
-- TLBG Prospect Intelligence — Deduplicated Index Set
-- Run in Supabase SQL Editor
--
-- BEFORE RUNNING: Verify existing indexes with:
--   SELECT indexname, tablename, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
--
-- Remove any lines below that duplicate what's already there.
-- ============================================================

-- ============================================================
-- 1. CONTACTS — Foreign keys & high-selectivity filter columns
-- ============================================================
-- FK columns (PostgreSQL does NOT auto-index these)
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts (owner_id);

-- Dedup/lookup columns (skip if UNIQUE index already exists on email)
-- CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_external_contact_id ON contacts (external_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_url ON contacts (linkedin_url);

-- High-value filter columns used in advanced filters + analytics
CREATE INDEX IF NOT EXISTS idx_contacts_data_quality_score ON contacts (data_quality_score);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts (country);

-- Partial index — very cheap, only indexes true rows
CREATE INDEX IF NOT EXISTS idx_contacts_do_not_contact ON contacts (do_not_contact) WHERE do_not_contact = true;

-- Sort columns (updated_at is the default sort for all table views)
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at DESC);

-- ============================================================
-- 2. CONTACTS — Compound indexes for common query patterns
-- ============================================================
-- Default table view: sorted by updated_at with lifecycle filter
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_updated ON contacts (lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_updated ON contacts (outreach_status, updated_at DESC);

-- Dashboard/analytics: owner + lifecycle combo
CREATE INDEX IF NOT EXISTS idx_contacts_owner_lifecycle ON contacts (owner_id, lifecycle_status);

-- ============================================================
-- 3. COMPANIES — Foreign keys & filter columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies (owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_external_account_id ON companies (external_account_id);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies (country);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);
CREATE INDEX IF NOT EXISTS idx_companies_updated_at ON companies (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_data_quality_score ON companies (data_quality_score);

-- ============================================================
-- 4. IMPORT JOB ROWS — Critical for import processing
-- ============================================================
-- FK (not auto-indexed)
CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_id ON import_job_rows (import_job_id);

-- Status filtering (review queue, error rows)
CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_status ON import_job_rows (import_job_id, status);

-- Partial index for review queue dashboard
CREATE INDEX IF NOT EXISTS idx_import_job_rows_review ON import_job_rows (import_job_id)
  WHERE review_required = true AND status = 'review';

-- ============================================================
-- 5. LIST CONTACTS — Join table (no auto-indexes on FKs)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_list_contacts_list_id ON list_contacts (list_id);
CREATE INDEX IF NOT EXISTS idx_list_contacts_contact_id ON list_contacts (contact_id);

-- ============================================================
-- 6. TRIGRAM indexes for ILIKE search at scale
--    Enable pg_trgm first, then uncomment.
--    These are essential for 100K+ rows with free-text search.
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
--
-- Only index the 4 columns actually used in search .or() clauses:
-- CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm ON contacts USING gin (first_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm ON contacts USING gin (last_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_contacts_company_name_raw_trgm ON contacts USING gin (company_name_raw gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_companies_domain_trgm ON companies USING gin (domain gin_trgm_ops);

-- ============================================================
-- REMOVED (vs original file) — reasons:
--
-- idx_contacts_secondary_email  → rarely filtered, low value
-- idx_contacts_department       → low cardinality, bloat
-- idx_contacts_seniority_level  → low cardinality, bloat
-- idx_contacts_lifecycle_status → covered by compound idx_contacts_lifecycle_updated
-- idx_contacts_outreach_status  → covered by compound idx_contacts_outreach_updated
-- idx_contacts_last_contacted_at → rarely sorted standalone
-- idx_companies_linkedin_url    → rarely filtered
-- idx_companies_created_at      → updated_at covers sort needs
-- idx_contacts_country_lifecycle → country + lifecycle combo too niche
-- idx_contacts_company_lifecycle → company_id + lifecycle too niche
-- idx_import_job_rows_status    → replaced by compound (job_id, status)
-- ============================================================
