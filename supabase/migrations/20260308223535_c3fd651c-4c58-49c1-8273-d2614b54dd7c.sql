
-- Research status enum
CREATE TYPE public.research_status AS ENUM ('pending', 'completed', 'failed');

-- Research source type
CREATE TYPE public.research_source_type AS ENUM ('website', 'linkedin', 'manual', 'crm', 'notes');

-- AI prompt type
CREATE TYPE public.ai_prompt_type AS ENUM ('research', 'email_personalization', 'linkedin_message', 'summary');

-- Generated content type
CREATE TYPE public.generated_content_type AS ENUM ('email_subject', 'email_body', 'linkedin_message', 'summary');

-- Generation status
CREATE TYPE public.generation_status AS ENUM ('pending', 'generating', 'completed', 'failed');

-- ── 1. Prospect Research Profiles ──
CREATE TABLE public.prospect_research_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  research_status public.research_status NOT NULL DEFAULT 'pending',
  summary text,
  pain_points text,
  value_props text,
  recent_signals text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_research_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prp_select" ON public.prospect_research_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "prp_insert" ON public.prospect_research_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prp_update" ON public.prospect_research_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "prp_delete" ON public.prospect_research_profiles FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 2. Prospect Research Sources ──
CREATE TABLE public.prospect_research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_profile_id uuid NOT NULL REFERENCES public.prospect_research_profiles(id) ON DELETE CASCADE,
  source_type public.research_source_type NOT NULL DEFAULT 'manual',
  source_title text,
  source_url text,
  source_content text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_research_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prs_select" ON public.prospect_research_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "prs_insert" ON public.prospect_research_sources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prs_delete" ON public.prospect_research_sources FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 3. Personalization Variables ──
CREATE TABLE public.personalization_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  variable_key text NOT NULL,
  variable_value text,
  confidence_score integer DEFAULT 0,
  source text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.personalization_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_select" ON public.personalization_variables FOR SELECT TO authenticated USING (true);
CREATE POLICY "pv_insert" ON public.personalization_variables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pv_update" ON public.personalization_variables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pv_delete" ON public.personalization_variables FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 4. AI Prompt Templates ──
CREATE TABLE public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt_type public.ai_prompt_type NOT NULL DEFAULT 'research',
  system_prompt text,
  user_prompt_template text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apt_select" ON public.ai_prompt_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "apt_manage" ON public.ai_prompt_templates FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 5. Generated Content ──
CREATE TABLE public.generated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  content_type public.generated_content_type NOT NULL,
  generated_text text,
  generation_status public.generation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gc_select" ON public.generated_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "gc_insert" ON public.generated_content FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gc_update" ON public.generated_content FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gc_delete" ON public.generated_content FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- ── 6. Contact Insights ──
CREATE TABLE public.contact_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE UNIQUE,
  fit_score integer DEFAULT 0,
  personalization_score integer DEFAULT 0,
  readiness_score integer DEFAULT 0,
  last_scored_at timestamptz DEFAULT now()
);
ALTER TABLE public.contact_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci_select" ON public.contact_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_insert" ON public.contact_insights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ci_update" ON public.contact_insights FOR UPDATE TO authenticated USING (true);

-- ── 7. Company Insights ──
CREATE TABLE public.company_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  fit_score integer DEFAULT 0,
  industry_score integer DEFAULT 0,
  outreach_priority_score integer DEFAULT 0,
  last_scored_at timestamptz DEFAULT now()
);
ALTER TABLE public.company_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coi_select" ON public.company_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "coi_insert" ON public.company_insights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "coi_update" ON public.company_insights FOR UPDATE TO authenticated USING (true);
