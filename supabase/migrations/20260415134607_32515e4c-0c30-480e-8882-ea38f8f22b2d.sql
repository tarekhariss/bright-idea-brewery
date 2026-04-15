
-- ============================================================
-- Extend contacts with missing prospecting fields
-- ============================================================

-- Phone status enum
DO $$ BEGIN
  CREATE TYPE public.phone_status AS ENUM ('verified', 'invalid', 'unknown', 'do_not_call');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_status public.phone_status DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS job_change_date date,
  ADD COLUMN IF NOT EXISTS current_role_start_date date,
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS import_tag text;

-- ============================================================
-- Extend companies with missing prospecting fields
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS market_segments text[],
  ADD COLUMN IF NOT EXISTS territories text[],
  ADD COLUMN IF NOT EXISTS headcount_growth_pct numeric,
  ADD COLUMN IF NOT EXISTS funding_stage text,
  ADD COLUMN IF NOT EXISTS employee_count_by_department jsonb,
  ADD COLUMN IF NOT EXISTS signals jsonb,
  ADD COLUMN IF NOT EXISTS news_summary text,
  ADD COLUMN IF NOT EXISTS retail_location_count integer;

-- ============================================================
-- Indexes on new filter columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_phone_status ON contacts (phone_status);
CREATE INDEX IF NOT EXISTS idx_contacts_persona ON contacts (persona);
CREATE INDEX IF NOT EXISTS idx_contacts_job_change_date ON contacts (job_change_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_funding_stage ON companies (funding_stage);
CREATE INDEX IF NOT EXISTS idx_companies_headcount_growth ON companies (headcount_growth_pct);
