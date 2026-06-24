
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON public.activities(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_company_id ON public.calls(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_attribution_company_id ON public.campaign_attribution(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_activity_log_company_id ON public.company_activity_log(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_bulk_push_job_rows_company_id ON public.crm_bulk_push_job_rows(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_review_queue_company_id ON public.crm_review_queue(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_company_id ON public.emails(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_content_company_id ON public.generated_content(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_job_rows_company_id ON public.import_job_rows(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_company_id ON public.meetings(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personalization_variables_company_id ON public.personalization_variables(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_research_profiles_company_id ON public.prospect_research_profiles(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id) WHERE company_id IS NOT NULL;
