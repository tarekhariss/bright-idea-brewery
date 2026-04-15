
-- Drop dependent indexes first
DROP INDEX IF EXISTS public.idx_contacts_email_trgm;
DROP INDEX IF EXISTS public.idx_contacts_first_name_trgm;
DROP INDEX IF EXISTS public.idx_contacts_last_name_trgm;
DROP INDEX IF EXISTS public.idx_contacts_company_name_raw_trgm;
DROP INDEX IF EXISTS public.idx_contacts_normalized_name_trgm;
DROP INDEX IF EXISTS public.idx_companies_name_trgm;
DROP INDEX IF EXISTS public.idx_companies_domain_trgm;
DROP INDEX IF EXISTS public.idx_companies_normalized_domain_trgm;

-- Move extension
DROP EXTENSION IF EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate indexes using extensions schema operator class
CREATE INDEX idx_contacts_email_trgm ON public.contacts USING gin (email extensions.gin_trgm_ops);
CREATE INDEX idx_contacts_first_name_trgm ON public.contacts USING gin (first_name extensions.gin_trgm_ops);
CREATE INDEX idx_contacts_last_name_trgm ON public.contacts USING gin (last_name extensions.gin_trgm_ops);
CREATE INDEX idx_contacts_company_name_raw_trgm ON public.contacts USING gin (company_name_raw extensions.gin_trgm_ops);
CREATE INDEX idx_contacts_normalized_name_trgm ON public.contacts USING gin (normalized_name extensions.gin_trgm_ops);
CREATE INDEX idx_companies_name_trgm ON public.companies USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_companies_domain_trgm ON public.companies USING gin (domain extensions.gin_trgm_ops);
CREATE INDEX idx_companies_normalized_domain_trgm ON public.companies USING gin (normalized_domain extensions.gin_trgm_ops);
