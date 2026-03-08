-- ============================================================
-- Migration 1: Workspace Architecture + CRM Core (Deals, Meetings)
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. WORKSPACES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    logo_url text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'operator',
    invited_by uuid REFERENCES auth.users(id),
    joined_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(_user_id uuid, _workspace_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1
$$;

-- Workspace RLS policies (uses security definer functions)
CREATE POLICY "Members can read own workspace"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Admins can manage workspace"
  ON public.workspaces FOR ALL TO authenticated
  USING (public.workspace_role(auth.uid(), id) IN ('admin', 'manager'));

-- Workspace members RLS
CREATE POLICY "Members can read workspace members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager'));

-- ============================================================
-- 3. ADD workspace_id TO EXISTING TABLES
-- ============================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.custom_fields ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.global_picklists ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Indexes for workspace isolation
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_companies_workspace ON companies (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON tags (workspace_id);
CREATE INDEX IF NOT EXISTS idx_lists_workspace ON lists (workspace_id);
CREATE INDEX IF NOT EXISTS idx_sequences_workspace ON sequences (workspace_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace ON import_jobs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_workspace ON saved_views (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_workspace ON pipeline_stages (workspace_id);

-- ============================================================
-- 4. DEALS TABLE
-- ============================================================
DO $$ BEGIN CREATE TYPE public.deal_status AS ENUM ('open', 'won', 'lost', 'abandoned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status public.deal_status NOT NULL DEFAULT 'open',
    pipeline_id uuid,
    stage_id uuid,
    amount numeric,
    currency text DEFAULT 'USD',
    probability integer DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date date,
    actual_close_date date,
    weighted_value numeric GENERATED ALWAYS AS (COALESCE(amount, 0) * COALESCE(probability, 0) / 100.0) STORED,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES auth.users(id),
    forecast_category text CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed', 'omitted')),
    loss_reason text,
    win_reason text,
    notes text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}',
    source text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read deals" ON public.deals FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage deals" ON public.deals FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id)
    AND (owner_id = auth.uid() OR created_by = auth.uid()
         OR public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager')));

CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals (workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals (status);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals (pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals (owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals (expected_close_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_deals_forecast ON deals (forecast_category, status);

-- ============================================================
-- 5. MEETINGS TABLE
-- ============================================================
DO $$ BEGIN CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.meetings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    meeting_type text DEFAULT 'general' CHECK (meeting_type IN ('general', 'discovery', 'demo', 'follow_up', 'negotiation', 'onboarding')),
    status public.meeting_status NOT NULL DEFAULT 'scheduled',
    location text,
    meeting_url text,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    duration_minutes integer GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time - start_time)) / 60) STORED,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
    organizer_id uuid REFERENCES auth.users(id),
    attendee_ids uuid[] DEFAULT '{}',
    external_attendees jsonb DEFAULT '[]'::jsonb,
    agenda text,
    notes text,
    outcome text,
    next_steps text,
    owner_id uuid REFERENCES auth.users(id),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read meetings" ON public.meetings FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage meetings" ON public.meetings FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id)
    AND (owner_id = auth.uid() OR organizer_id = auth.uid() OR created_by = auth.uid()
         OR public.workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager')));

CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings (contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company ON meetings (company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_deal ON meetings (deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings (start_time, status);
CREATE INDEX IF NOT EXISTS idx_meetings_owner ON meetings (owner_id);

-- ============================================================
-- 6. DEAL CONTACTS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_contacts (
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    role text DEFAULT 'participant',
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (deal_id, contact_id)
);

ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read deal contacts" ON public.deal_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage deal contacts" ON public.deal_contacts FOR ALL TO authenticated USING (true);

-- ============================================================
-- 7. ENRICHMENT FIELDS (add missing to contacts & companies)
-- ============================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS personal_email text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS twitter_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS languages text[];
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS education jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS work_history jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS skills text[];
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS enrichment_source text;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS founded_year integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_type text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS headquarters text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS stock_ticker text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS parent_company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS sic_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS naics_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS specialties text[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS enrichment_source text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
