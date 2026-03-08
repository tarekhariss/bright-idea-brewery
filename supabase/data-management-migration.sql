-- ============================================================
-- TLBG Prospect Intelligence — Data Management Tables
-- Paste this entire script into Supabase SQL Editor and Run
-- ============================================================

-- PREREQUISITES: Ensure these exist first (skip if already created)
-- create type public.app_role as enum ('admin', 'moderator', 'user');
-- create function public.has_role(...)
-- create function public.has_any_role(...)

-- ============================================================
-- 1. GLOBAL PICKLISTS (must come before custom_fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_picklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.global_picklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read picklists" ON public.global_picklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage picklists" ON public.global_picklists FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

-- 2. GLOBAL PICKLIST OPTIONS
CREATE TABLE IF NOT EXISTS public.global_picklist_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    picklist_id uuid NOT NULL REFERENCES public.global_picklists(id) ON DELETE CASCADE,
    label text NOT NULL,
    value text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    color text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(picklist_id, value)
);

ALTER TABLE public.global_picklist_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read picklist options" ON public.global_picklist_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage picklist options" ON public.global_picklist_options FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

-- ============================================================
-- 3. CUSTOM FIELDS (references global_picklists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    field_name text NOT NULL,
    field_label text NOT NULL,
    field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'picklist', 'multi_picklist', 'url', 'email', 'phone', 'textarea', 'currency')),
    picklist_id uuid REFERENCES public.global_picklists(id) ON DELETE SET NULL,
    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    default_value text,
    display_order integer DEFAULT 0,
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(entity_type, field_name)
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage custom fields" ON public.custom_fields FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

-- ============================================================
-- 4. PIPELINE STAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    pipeline_name text NOT NULL DEFAULT 'default',
    stage_name text NOT NULL,
    stage_key text NOT NULL,
    display_order integer DEFAULT 0,
    color text,
    description text,
    is_active boolean DEFAULT true,
    is_closed boolean DEFAULT false,
    is_won boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(entity_type, pipeline_name, stage_key)
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read pipeline stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage pipeline stages" ON public.pipeline_stages FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

-- ============================================================
-- 5. GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    goal_type text NOT NULL CHECK (goal_type IN ('contacts_created', 'emails_sent', 'calls_made', 'meetings_booked', 'deals_won', 'revenue', 'custom')),
    target_value numeric NOT NULL DEFAULT 0,
    current_value numeric NOT NULL DEFAULT 0,
    period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    assigned_to uuid REFERENCES auth.users(id),
    team_goal boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read goals" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage goals" ON public.goals FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

-- ============================================================
-- 6. SYSTEM ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    details jsonb,
    performed_by uuid REFERENCES auth.users(id),
    ip_address text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read system activity log" ON public.system_activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can insert activity" ON public.system_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_fields (entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_entity ON pipeline_stages (entity_type, pipeline_name, display_order);
CREATE INDEX IF NOT EXISTS idx_picklist_options_picklist ON global_picklist_options (picklist_id, display_order);
CREATE INDEX IF NOT EXISTS idx_goals_assigned ON goals (assigned_to, is_active);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals (period, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_system_activity_log_action ON system_activity_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_activity_log_entity ON system_activity_log (entity_type, entity_id);

-- ============================================================
-- 8. SEED DATA
-- ============================================================
INSERT INTO public.pipeline_stages (entity_type, pipeline_name, stage_name, stage_key, display_order, color) VALUES
  ('contact', 'default', 'New', 'new', 1, '#6366f1'),
  ('contact', 'default', 'Researching', 'researching', 2, '#8b5cf6'),
  ('contact', 'default', 'Qualified', 'qualified', 3, '#06b6d4'),
  ('contact', 'default', 'Nurturing', 'nurturing', 4, '#f59e0b'),
  ('contact', 'default', 'Engaged', 'engaged', 5, '#10b981'),
  ('contact', 'default', 'Converted', 'converted', 6, '#22c55e'),
  ('contact', 'default', 'Churned', 'churned', 7, '#ef4444'),
  ('contact', 'default', 'Archived', 'archived', 8, '#6b7280'),
  ('company', 'default', 'Prospect', 'prospect', 1, '#6366f1'),
  ('company', 'default', 'Qualifying', 'qualifying', 2, '#8b5cf6'),
  ('company', 'default', 'Active', 'active', 3, '#10b981'),
  ('company', 'default', 'Customer', 'customer', 4, '#22c55e'),
  ('company', 'default', 'Churned', 'churned', 5, '#ef4444'),
  ('deal', 'default', 'Discovery', 'discovery', 1, '#6366f1'),
  ('deal', 'default', 'Qualification', 'qualification', 2, '#8b5cf6'),
  ('deal', 'default', 'Proposal', 'proposal', 3, '#06b6d4'),
  ('deal', 'default', 'Negotiation', 'negotiation', 4, '#f59e0b'),
  ('deal', 'default', 'Closed Won', 'closed_won', 5, '#22c55e'),
  ('deal', 'default', 'Closed Lost', 'closed_lost', 6, '#ef4444')
ON CONFLICT DO NOTHING;

INSERT INTO public.global_picklists (name, description) VALUES
  ('Industry', 'Company industry classification'),
  ('Lead Source', 'How the contact was acquired'),
  ('Deal Close Reason', 'Reason for deal win/loss'),
  ('Department', 'Contact department within company'),
  ('Seniority Level', 'Contact seniority classification')
ON CONFLICT (name) DO NOTHING;
