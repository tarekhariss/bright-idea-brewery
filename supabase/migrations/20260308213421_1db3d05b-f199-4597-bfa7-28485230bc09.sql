
-- ENUMS
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_status AS ENUM ('pending', 'mapping', 'validating', 'processing', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_row_status AS ENUM ('pending', 'success', 'error', 'skipped', 'duplicate', 'review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lifecycle_status AS ENUM ('new', 'researching', 'qualified', 'nurturing', 'engaged', 'converted', 'churned', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outreach_status AS ENUM ('not_contacted', 'queued', 'contacted', 'replied', 'bounced', 'opted_out', 'unresponsive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.email_validity AS ENUM ('unknown', 'valid', 'invalid', 'catch_all', 'disposable', 'role_based'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sequence_status AS ENUM ('draft', 'active', 'paused', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.enrollment_status AS ENUM ('active', 'paused', 'completed', 'bounced', 'replied', 'opted_out', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.email_status AS ENUM ('draft', 'queued', 'processing', 'sent_mock', 'sent', 'failed', 'bounced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_outcome AS ENUM ('no_answer', 'voicemail', 'connected', 'interested', 'not_interested', 'callback', 'wrong_number'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.queue_item_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.domain_status AS ENUM ('pending', 'verified', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dns_record_status AS ENUM ('pending', 'pass', 'fail'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mailbox_provider_type AS ENUM ('google', 'microsoft', 'smtp', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.connection_status AS ENUM ('active', 'disconnected', 'warming', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.warmup_status AS ENUM ('off', 'active', 'paused', 'complete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sending_health AS ENUM ('unknown', 'good', 'warning', 'poor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.deal_status AS ENUM ('open', 'won', 'lost', 'abandoned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM ('email_sent', 'email_opened', 'email_clicked', 'email_replied', 'email_bounced', 'call_made', 'call_received', 'meeting_scheduled', 'meeting_completed', 'meeting_cancelled', 'task_created', 'task_completed', 'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost', 'note_added', 'contact_created', 'contact_updated', 'contact_merged', 'company_created', 'company_updated', 'sequence_enrolled', 'sequence_completed', 'sequence_replied', 'list_added', 'list_removed', 'field_changed', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, full_name text, avatar_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(user_id, role));
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ROLE HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

-- WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, logo_url text, settings jsonb DEFAULT '{}'::jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL DEFAULT 'operator', invited_by uuid REFERENCES auth.users(id), joined_at timestamptz DEFAULT now(), UNIQUE(workspace_id, user_id));
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id) $$;
CREATE OR REPLACE FUNCTION public.workspace_role(_user_id uuid, _workspace_id uuid) RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id LIMIT 1 $$;

CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE TO authenticated USING (public.workspace_role(auth.uid(), id) IN ('admin', 'manager')) WITH CHECK (public.workspace_role(auth.uid(), id) IN ('admin', 'manager'));
CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE TO authenticated USING (public.workspace_role(auth.uid(), id) = 'admin');

CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "wm_insert" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager') OR (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id)));
CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager')) WITH CHECK (public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager'));
CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager'));

-- COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, normalized_name text GENERATED ALWAYS AS (lower(trim(name))) STORED, domain text, industry text, employee_count integer, employee_range text, revenue_range text, country text, city text, state text, linkedin_url text, website text, description text, logo_url text, company_name_for_emails text, company_phone text, company_linkedin_url text, facebook_url text, twitter_url text, company_address text, company_city text, company_state text, company_country text, annual_revenue numeric, total_funding numeric, latest_funding text, latest_funding_amount numeric, last_raised_at timestamptz, technologies text[], keywords text[], external_account_id text, enrichment_data jsonb, notes text, data_quality_score integer, last_verified_at timestamptz, owner_id uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), founded_year integer, company_type text, headquarters text, postal_code text, timezone text, stock_ticker text, parent_company_id uuid REFERENCES public.companies(id), sic_code text, naics_code text, specialties text[], last_enriched_at timestamptz, enrichment_source text, custom_fields jsonb DEFAULT '{}'::jsonb);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_delete" ON public.companies FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, first_name text, last_name text, email text, secondary_email text, tertiary_email text, email_confidence integer, primary_email_source text, secondary_email_source text, tertiary_email_source text, phone text, work_direct_phone text, mobile_phone text, corporate_phone text, home_phone text, other_phone text, job_title text, seniority_level text, department text, linkedin_url text, country text, city text, state text, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, company_name_raw text, lifecycle_status public.lifecycle_status NOT NULL DEFAULT 'new', outreach_status public.outreach_status NOT NULL DEFAULT 'not_contacted', do_not_contact boolean NOT NULL DEFAULT false, email_validity_status public.email_validity NOT NULL DEFAULT 'unknown', owner_id uuid REFERENCES auth.users(id), data_quality_score integer, last_verified_at timestamptz, last_contacted_at timestamptz, source text, source_file text, external_source text, external_contact_id text, notes text, enrichment_data jsonb, custom_fields jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), personal_email text, twitter_url text, facebook_url text, github_url text, address text, postal_code text, timezone text, languages text[], headline text, bio text, photo_url text, years_experience integer, education jsonb, work_history jsonb, skills text[], last_enriched_at timestamptz, enrichment_source text);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- TAGS
CREATE TABLE IF NOT EXISTS public.tags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, color text, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now());
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_all" ON public.tags FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.contact_tags (contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY (contact_id, tag_id));
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_tags_all" ON public.contact_tags FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.company_tags (company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY (company_id, tag_id));
ALTER TABLE public.company_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_tags_all" ON public.company_tags FOR ALL TO authenticated USING (true);

-- LISTS
CREATE TABLE IF NOT EXISTS public.lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, description text, is_dynamic boolean NOT NULL DEFAULT false, filter_criteria jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lists_all" ON public.lists FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.list_contacts (list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE, contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE, added_at timestamptz DEFAULT now(), added_by uuid REFERENCES auth.users(id), PRIMARY KEY (list_id, contact_id));
ALTER TABLE public.list_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_contacts_all" ON public.list_contacts FOR ALL TO authenticated USING (true);

-- IMPORT JOBS
CREATE TABLE IF NOT EXISTS public.import_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, file_name text NOT NULL, file_url text, status public.import_status NOT NULL DEFAULT 'pending', total_rows integer NOT NULL DEFAULT 0, processed_rows integer NOT NULL DEFAULT 0, success_rows integer NOT NULL DEFAULT 0, error_rows integer NOT NULL DEFAULT 0, duplicate_rows integer NOT NULL DEFAULT 0, review_rows integer NOT NULL DEFAULT 0, column_mapping jsonb, settings jsonb, error_summary jsonb, started_at timestamptz, completed_at timestamptz, created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz DEFAULT now());
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_jobs_all" ON public.import_jobs FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.import_job_rows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE, row_number integer NOT NULL, raw_data jsonb NOT NULL, normalized_data jsonb, status public.import_row_status NOT NULL DEFAULT 'pending', error_message text, duplicate_match_reason text, action_taken text, review_required boolean NOT NULL DEFAULT false, contact_id uuid REFERENCES public.contacts(id), company_id uuid REFERENCES public.companies(id), created_at timestamptz DEFAULT now());
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_job_rows_all" ON public.import_job_rows FOR ALL TO authenticated USING (true);

-- SAVED VIEWS
CREATE TABLE IF NOT EXISTS public.saved_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company')), filters jsonb NOT NULL DEFAULT '{}'::jsonb, columns jsonb, sort_by text, sort_direction text NOT NULL DEFAULT 'asc' CHECK (sort_direction IN ('asc', 'desc')), is_default boolean NOT NULL DEFAULT false, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_views_all" ON public.saved_views FOR ALL TO authenticated USING (true);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.contact_activity_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE, action text NOT NULL, details jsonb, performed_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now());
ALTER TABLE public.contact_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_activity_log_all" ON public.contact_activity_log FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.company_activity_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, action text NOT NULL, details jsonb, performed_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now());
ALTER TABLE public.company_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_activity_log_all" ON public.company_activity_log FOR ALL TO authenticated USING (true);

-- GLOBAL PICKLISTS
CREATE TABLE IF NOT EXISTS public.global_picklists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL UNIQUE, description text, is_active boolean DEFAULT true, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.global_picklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "picklists_select" ON public.global_picklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "picklists_manage" ON public.global_picklists FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

CREATE TABLE IF NOT EXISTS public.global_picklist_options (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), picklist_id uuid NOT NULL REFERENCES public.global_picklists(id) ON DELETE CASCADE, label text NOT NULL, value text NOT NULL, display_order integer DEFAULT 0, is_active boolean DEFAULT true, color text, created_at timestamptz DEFAULT now(), UNIQUE(picklist_id, value));
ALTER TABLE public.global_picklist_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "picklist_options_select" ON public.global_picklist_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "picklist_options_manage" ON public.global_picklist_options FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- CUSTOM FIELDS
CREATE TABLE IF NOT EXISTS public.custom_fields (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')), field_name text NOT NULL, field_label text NOT NULL, field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'picklist', 'multi_picklist', 'url', 'email', 'phone', 'textarea', 'currency')), picklist_id uuid REFERENCES public.global_picklists(id) ON DELETE SET NULL, is_required boolean DEFAULT false, is_active boolean DEFAULT true, default_value text, display_order integer DEFAULT 0, description text, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(entity_type, field_name));
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_fields_select" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_fields_manage" ON public.custom_fields FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- PIPELINE STAGES
CREATE TABLE IF NOT EXISTS public.pipeline_stages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, pipeline_id uuid, entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')), pipeline_name text NOT NULL DEFAULT 'default', stage_name text NOT NULL, stage_key text NOT NULL, display_order integer DEFAULT 0, color text, description text, is_active boolean DEFAULT true, is_closed boolean DEFAULT false, is_won boolean DEFAULT false, default_probability integer DEFAULT 0 CHECK (default_probability >= 0 AND default_probability <= 100), forecast_category text CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed', 'omitted')), rotting_days integer, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(entity_type, pipeline_name, stage_key));
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipeline_stages_manage" ON public.pipeline_stages FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- GOALS
CREATE TABLE IF NOT EXISTS public.goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, description text, goal_type text NOT NULL CHECK (goal_type IN ('contacts_created', 'emails_sent', 'calls_made', 'meetings_booked', 'deals_won', 'revenue', 'custom')), target_value numeric NOT NULL DEFAULT 0, current_value numeric NOT NULL DEFAULT 0, period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')), start_date date NOT NULL, end_date date NOT NULL, assigned_to uuid REFERENCES auth.users(id), team_goal boolean DEFAULT false, is_active boolean DEFAULT true, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "goals_manage" ON public.goals FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));
CREATE POLICY "goals_update_own" ON public.goals FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

-- SYSTEM ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.system_activity_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL, entity_type text, entity_id uuid, details jsonb, performed_by uuid REFERENCES auth.users(id), ip_address text, created_at timestamptz DEFAULT now());
ALTER TABLE public.system_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_log_select" ON public.system_activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "system_log_insert" ON public.system_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, value jsonb NOT NULL, updated_by uuid REFERENCES auth.users(id), updated_at timestamptz DEFAULT now());
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_select" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_manage" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DEALS
CREATE TABLE IF NOT EXISTS public.deals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, description text, status public.deal_status NOT NULL DEFAULT 'open', pipeline_id uuid, stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL, amount numeric, currency text DEFAULT 'USD', probability integer DEFAULT 0 CHECK (probability >= 0 AND probability <= 100), expected_close_date date, actual_close_date date, weighted_value numeric GENERATED ALWAYS AS (COALESCE(amount, 0) * COALESCE(probability, 0) / 100.0) STORED, contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, owner_id uuid REFERENCES auth.users(id), forecast_category text CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed', 'omitted')), loss_reason text, win_reason text, notes text, custom_fields jsonb DEFAULT '{}'::jsonb, tags text[] DEFAULT '{}', source text, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]) OR owner_id = auth.uid() OR created_by = auth.uid());

-- PIPELINES
CREATE TABLE IF NOT EXISTS public.pipelines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')), name text NOT NULL, description text, is_default boolean DEFAULT false, is_active boolean DEFAULT true, created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(workspace_id, entity_type, name));
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipelines_select" ON public.pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipelines_manage" ON public.pipelines FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- FK from pipeline_stages and deals to pipelines
DO $$ BEGIN ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.deals ADD CONSTRAINT deals_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DEAL CONTACTS
CREATE TABLE IF NOT EXISTS public.deal_contacts (deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE, contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE, role text DEFAULT 'participant', created_at timestamptz DEFAULT now(), PRIMARY KEY (deal_id, contact_id));
ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_contacts_all" ON public.deal_contacts FOR ALL TO authenticated USING (true);

-- DEAL STAGE HISTORY
CREATE TABLE IF NOT EXISTS public.deal_stage_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE, from_stage_id uuid REFERENCES public.pipeline_stages(id), to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id), changed_by uuid REFERENCES auth.users(id), changed_at timestamptz DEFAULT now(), duration_in_prev_stage interval);
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_stage_history_select" ON public.deal_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_stage_history_insert" ON public.deal_stage_history FOR INSERT TO authenticated WITH CHECK (true);

-- MEETINGS
CREATE TABLE IF NOT EXISTS public.meetings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, title text NOT NULL, description text, meeting_type text DEFAULT 'general' CHECK (meeting_type IN ('general', 'discovery', 'demo', 'follow_up', 'negotiation', 'onboarding')), status public.meeting_status NOT NULL DEFAULT 'scheduled', location text, meeting_url text, start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, duration_minutes integer GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time - start_time)) / 60) STORED, contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL, organizer_id uuid REFERENCES auth.users(id), attendee_ids uuid[] DEFAULT '{}', external_attendees jsonb DEFAULT '[]'::jsonb, agenda text, notes text, outcome text, next_steps text, owner_id uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]) OR owner_id = auth.uid() OR created_by = auth.uid());

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, activity_type public.activity_type NOT NULL, contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL, source_type text, source_id uuid, title text NOT NULL, description text, metadata jsonb DEFAULT '{}'::jsonb, performed_by uuid REFERENCES auth.users(id), occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz DEFAULT now());
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_activity(p_workspace_id uuid, p_activity_type public.activity_type, p_title text, p_contact_id uuid DEFAULT NULL, p_company_id uuid DEFAULT NULL, p_deal_id uuid DEFAULT NULL, p_source_type text DEFAULT NULL, p_source_id uuid DEFAULT NULL, p_description text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_performed_by uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_id uuid; BEGIN INSERT INTO public.activities (workspace_id, activity_type, title, contact_id, company_id, deal_id, source_type, source_id, description, metadata, performed_by) VALUES (p_workspace_id, p_activity_type, p_title, p_contact_id, p_company_id, p_deal_id, p_source_type, p_source_id, p_description, p_metadata, COALESCE(p_performed_by, auth.uid())) RETURNING id INTO v_id; RETURN v_id; END; $$;

-- SEQUENCES
CREATE TABLE IF NOT EXISTS public.sequences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, name text NOT NULL, description text, status public.sequence_status NOT NULL DEFAULT 'draft', owner_id uuid REFERENCES auth.users(id), schedule_config jsonb DEFAULT '{"send_days":["mon","tue","wed","thu","fri"],"send_start_hour":9,"send_end_hour":17,"timezone":"UTC"}'::jsonb, max_enrollments integer, exit_conditions jsonb DEFAULT '{"on_reply": true, "on_bounce": true, "on_meeting_booked": false}'::jsonb, tags text[] DEFAULT '{}', shared_with uuid[], created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_select" ON public.sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "sequences_manage" ON public.sequences FOR ALL TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

CREATE TABLE IF NOT EXISTS public.sequence_steps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE, step_order integer NOT NULL, step_type text NOT NULL CHECK (step_type IN ('email', 'call', 'task', 'linkedin', 'delay', 'sms')), label text NOT NULL DEFAULT 'New step', delay_days integer NOT NULL DEFAULT 0, delay_hours integer NOT NULL DEFAULT 0, email_subject text, email_body text, task_instructions text, call_instructions text, linkedin_action text CHECK (linkedin_action IN ('connect', 'message', 'view_profile', 'endorse', 'interact')), linkedin_message text, sms_body text, variable_template jsonb DEFAULT '{}'::jsonb, conditions jsonb, ab_variant text CHECK (ab_variant IN ('A', 'B', 'C')), is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(sequence_id, step_order));
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steps_select" ON public.sequence_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "steps_manage" ON public.sequence_steps FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.sequences s WHERE s.id = sequence_id AND (s.owner_id = auth.uid() OR s.created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]))));

CREATE TABLE IF NOT EXISTS public.sequence_enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE, contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE, status public.enrollment_status NOT NULL DEFAULT 'active', current_step_order integer NOT NULL DEFAULT 1, next_step_at timestamptz, enrolled_by uuid REFERENCES auth.users(id), enrolled_at timestamptz DEFAULT now(), completed_at timestamptz, paused_at timestamptz, exit_reason text, last_activity_at timestamptz, metadata jsonb DEFAULT '{}'::jsonb, updated_at timestamptz DEFAULT now(), UNIQUE(sequence_id, contact_id));
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_select" ON public.sequence_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrollments_manage" ON public.sequence_enrollments FOR ALL TO authenticated USING (enrolled_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- DELIVERABILITY
CREATE TABLE IF NOT EXISTS public.sending_domains (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain_name text NOT NULL UNIQUE, status public.domain_status NOT NULL DEFAULT 'pending', spf_status public.dns_record_status NOT NULL DEFAULT 'pending', dkim_status public.dns_record_status NOT NULL DEFAULT 'pending', dmarc_status public.dns_record_status NOT NULL DEFAULT 'pending', warmup_enabled boolean DEFAULT false, warmup_progress integer DEFAULT 0, daily_sending_limit integer DEFAULT 50, sending_health public.sending_health DEFAULT 'unknown', verification_details jsonb, notes text, owner_id uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.sending_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domains_select" ON public.sending_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "domains_manage" ON public.sending_domains FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

CREATE TABLE IF NOT EXISTS public.mailboxes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, display_name text, domain_id uuid REFERENCES public.sending_domains(id) ON DELETE SET NULL, provider_type public.mailbox_provider_type DEFAULT 'smtp', smtp_host text, smtp_port integer DEFAULT 587, smtp_username text, smtp_secure boolean DEFAULT true, imap_host text, imap_port integer DEFAULT 993, imap_username text, imap_secure boolean DEFAULT true, connection_status public.connection_status DEFAULT 'disconnected', warmup_enabled boolean DEFAULT false, warmup_progress integer DEFAULT 0, sending_health public.sending_health DEFAULT 'unknown', daily_sending_limit integer DEFAULT 50, emails_sent_today integer DEFAULT 0, last_checked_at timestamptz, notes text, owner_id uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mailboxes_select" ON public.mailboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "mailboxes_manage" ON public.mailboxes FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- EMAILS
CREATE TABLE IF NOT EXISTS public.emails (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL DEFAULT '', body_html text, body_text text, from_address text, to_address text NOT NULL, cc text, bcc text, status public.email_status NOT NULL DEFAULT 'draft', contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL, sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL, enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL, mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL, owner_id uuid REFERENCES auth.users(id), scheduled_at timestamptz, sent_at timestamptz, opened_at timestamptz, clicked_at timestamptz, replied_at timestamptz, bounced_at timestamptz, error_message text, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emails_select" ON public.emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "emails_manage" ON public.emails FOR ALL TO authenticated USING (owner_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

CREATE TABLE IF NOT EXISTS public.email_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_id uuid NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE, event_type text NOT NULL CHECK (event_type IN ('queued','processing','sent','sent_mock','delivered','opened','clicked','replied','bounced','failed','unsubscribed')), details jsonb, created_at timestamptz DEFAULT now());
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_events_select" ON public.email_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_events_insert" ON public.email_events FOR INSERT TO authenticated WITH CHECK (true);

-- TASKS
CREATE TABLE IF NOT EXISTS public.tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, task_type text NOT NULL DEFAULT 'general' CHECK (task_type IN ('general','call','email','follow_up','linkedin','custom')), status public.task_status NOT NULL DEFAULT 'pending', priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')), due_date timestamptz, completed_at timestamptz, contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL, sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL, enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL, owner_id uuid REFERENCES auth.users(id), assigned_to uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_manage" ON public.tasks FOR ALL TO authenticated USING (owner_id = auth.uid() OR assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- CALLS
CREATE TABLE IF NOT EXISTS public.calls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')), outcome public.call_outcome, duration_seconds integer, notes text, phone_number text, scheduled_at timestamptz, started_at timestamptz, ended_at timestamptz, contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL, sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL, enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL, owner_id uuid REFERENCES auth.users(id), created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "calls_manage" ON public.calls FOR ALL TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- MESSAGE QUEUE
CREATE TABLE IF NOT EXISTS public.message_queue (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), queue_type text NOT NULL CHECK (queue_type IN ('email','task','call','webhook')), status public.queue_item_status NOT NULL DEFAULT 'pending', priority integer NOT NULL DEFAULT 0, payload jsonb NOT NULL, reference_id uuid, reference_type text, sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL, enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL, mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL, scheduled_for timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3, last_error text, created_at timestamptz DEFAULT now());
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_select" ON public.message_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "queue_manage" ON public.message_queue FOR ALL TO authenticated USING (true);

-- SENDING DAILY COUNTS
CREATE TABLE IF NOT EXISTS public.sending_daily_counts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE, send_date date NOT NULL DEFAULT CURRENT_DATE, count integer NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(), UNIQUE(mailbox_id, send_date));
ALTER TABLE public.sending_daily_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_counts_select" ON public.sending_daily_counts FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]));
CREATE POLICY "daily_counts_insert" ON public.sending_daily_counts FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]));
CREATE POLICY "daily_counts_update" ON public.sending_daily_counts FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]));
CREATE POLICY "daily_counts_delete" ON public.sending_daily_counts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.increment_daily_send_count(p_mailbox_id uuid, p_limit integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_count integer; BEGIN INSERT INTO sending_daily_counts (mailbox_id, send_date, count) VALUES (p_mailbox_id, CURRENT_DATE, 1) ON CONFLICT (mailbox_id, send_date) DO UPDATE SET count = sending_daily_counts.count + 1 RETURNING count INTO v_count; IF v_count > p_limit THEN UPDATE sending_daily_counts SET count = count - 1 WHERE mailbox_id = p_mailbox_id AND send_date = CURRENT_DATE; RETURN false; END IF; RETURN true; END; $$;

CREATE OR REPLACE FUNCTION public.check_mailbox_readiness(p_mailbox_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_mb record; v_domain record; v_daily_count integer; v_issues text[] := '{}'; v_ready boolean := true; BEGIN SELECT * INTO v_mb FROM mailboxes WHERE id = p_mailbox_id; IF NOT FOUND THEN RETURN jsonb_build_object('ready', false, 'issues', ARRAY['Mailbox not found']); END IF; IF v_mb.connection_status != 'active' THEN v_ready := false; v_issues := array_append(v_issues, 'Connection: ' || v_mb.connection_status::text); END IF; IF v_mb.smtp_host IS NULL OR v_mb.smtp_host = '' THEN v_ready := false; v_issues := array_append(v_issues, 'No SMTP host'); END IF; IF v_mb.domain_id IS NOT NULL THEN SELECT * INTO v_domain FROM sending_domains WHERE id = v_mb.domain_id; IF FOUND AND v_domain.status != 'verified' THEN v_ready := false; v_issues := array_append(v_issues, 'Domain not verified'); END IF; END IF; SELECT COALESCE(sdc.count, 0) INTO v_daily_count FROM sending_daily_counts sdc WHERE sdc.mailbox_id = p_mailbox_id AND sdc.send_date = CURRENT_DATE; IF NOT FOUND THEN v_daily_count := 0; END IF; IF v_daily_count >= v_mb.daily_sending_limit THEN v_ready := false; v_issues := array_append(v_issues, 'Daily limit reached'); END IF; RETURN jsonb_build_object('ready', v_ready, 'issues', v_issues, 'mailbox_id', p_mailbox_id, 'email', v_mb.email); END; $$;

-- TIMESTAMP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILE AUTO-CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN INSERT INTO public.profiles (id, email, full_name, avatar_url) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED DATA
INSERT INTO public.pipeline_stages (entity_type, pipeline_name, stage_name, stage_key, display_order, color) VALUES ('contact', 'default', 'New', 'new', 1, '#6366f1'), ('contact', 'default', 'Researching', 'researching', 2, '#8b5cf6'), ('contact', 'default', 'Qualified', 'qualified', 3, '#06b6d4'), ('contact', 'default', 'Nurturing', 'nurturing', 4, '#f59e0b'), ('contact', 'default', 'Engaged', 'engaged', 5, '#10b981'), ('contact', 'default', 'Converted', 'converted', 6, '#22c55e'), ('contact', 'default', 'Churned', 'churned', 7, '#ef4444'), ('contact', 'default', 'Archived', 'archived', 8, '#6b7280'), ('company', 'default', 'Prospect', 'prospect', 1, '#6366f1'), ('company', 'default', 'Qualifying', 'qualifying', 2, '#8b5cf6'), ('company', 'default', 'Active', 'active', 3, '#10b981'), ('company', 'default', 'Customer', 'customer', 4, '#22c55e'), ('company', 'default', 'Churned', 'churned', 5, '#ef4444'), ('deal', 'default', 'Discovery', 'discovery', 1, '#6366f1'), ('deal', 'default', 'Qualification', 'qualification', 2, '#8b5cf6'), ('deal', 'default', 'Proposal', 'proposal', 3, '#06b6d4'), ('deal', 'default', 'Negotiation', 'negotiation', 4, '#f59e0b'), ('deal', 'default', 'Closed Won', 'closed_won', 5, '#22c55e'), ('deal', 'default', 'Closed Lost', 'closed_lost', 6, '#ef4444') ON CONFLICT DO NOTHING;

INSERT INTO public.global_picklists (name, description) VALUES ('Industry', 'Company industry classification'), ('Lead Source', 'How the contact was acquired'), ('Deal Close Reason', 'Reason for deal win/loss'), ('Department', 'Contact department within company'), ('Seniority Level', 'Contact seniority classification') ON CONFLICT (name) DO NOTHING;
