-- ============================================================
-- Migration 2: Unified Activity Timeline
-- Run in Supabase SQL Editor AFTER 001
-- ============================================================

DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM (
  'email_sent', 'email_opened', 'email_clicked', 'email_replied', 'email_bounced',
  'call_made', 'call_received',
  'meeting_scheduled', 'meeting_completed', 'meeting_cancelled',
  'task_created', 'task_completed',
  'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost',
  'note_added',
  'contact_created', 'contact_updated', 'contact_merged',
  'company_created', 'company_updated',
  'sequence_enrolled', 'sequence_completed', 'sequence_replied',
  'list_added', 'list_removed',
  'field_changed',
  'custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    activity_type public.activity_type NOT NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
    source_type text,
    source_id uuid,
    title text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    performed_by uuid REFERENCES auth.users(id),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON public.activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert activities"
  ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage activities"
  ON public.activities FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_contact_time ON activities (contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_company_time ON activities (company_id, occurred_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deal_time ON activities (deal_id, occurred_at DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_workspace_time ON activities (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities (activity_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_performer ON activities (performed_by, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_source ON activities (source_type, source_id) WHERE source_id IS NOT NULL;

-- Helper function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_workspace_id uuid,
  p_activity_type public.activity_type,
  p_title text,
  p_contact_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_deal_id uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_performed_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.activities (
    workspace_id, activity_type, title,
    contact_id, company_id, deal_id,
    source_type, source_id,
    description, metadata, performed_by
  ) VALUES (
    p_workspace_id, p_activity_type, p_title,
    p_contact_id, p_company_id, p_deal_id,
    p_source_type, p_source_id,
    p_description, p_metadata, COALESCE(p_performed_by, auth.uid())
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
