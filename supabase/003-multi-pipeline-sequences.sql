-- ============================================================
-- Migration 3: Multi-Pipeline + Enhanced Sequences
-- Run in Supabase SQL Editor AFTER 002
-- ============================================================

-- ============================================================
-- 1. PIPELINES (parent table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, entity_type, name)
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pipelines"
  ON public.pipelines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can manage pipelines"
  ON public.pipelines FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_pipelines_workspace_entity ON pipelines (workspace_id, entity_type);

-- ============================================================
-- 2. UPGRADE pipeline_stages
-- ============================================================
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS default_probability integer DEFAULT 0 CHECK (default_probability >= 0 AND default_probability <= 100);
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS forecast_category text CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed', 'omitted'));
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS rotting_days integer;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages (pipeline_id, display_order);

-- ============================================================
-- 3. FK constraints on deals
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deals_pipeline_id_fkey' AND table_name = 'deals'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_pipeline_id_fkey
      FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deals_stage_id_fkey' AND table_name = 'deals'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_stage_id_fkey
      FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. DEAL STAGE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    from_stage_id uuid REFERENCES public.pipeline_stages(id),
    to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now(),
    duration_in_prev_stage interval
);

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read stage history" ON public.deal_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert stage history" ON public.deal_stage_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal ON deal_stage_history (deal_id, changed_at DESC);

-- ============================================================
-- 5. ENHANCED SEQUENCE STEPS
-- ============================================================
ALTER TABLE public.sequence_steps DROP CONSTRAINT IF EXISTS sequence_steps_step_type_check;
ALTER TABLE public.sequence_steps ADD CONSTRAINT sequence_steps_step_type_check
  CHECK (step_type IN ('email', 'call', 'task', 'linkedin', 'delay', 'sms'));

ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS linkedin_action text CHECK (linkedin_action IN ('connect', 'message', 'view_profile', 'endorse', 'interact'));
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS linkedin_message text;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS sms_body text;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS variable_template jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS conditions jsonb;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS ab_variant text CHECK (ab_variant IN ('A', 'B', 'C'));

-- ============================================================
-- 6. SEQUENCE-LEVEL ENHANCEMENTS
-- ============================================================
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS exit_conditions jsonb DEFAULT '{"on_reply": true, "on_bounce": true, "on_meeting_booked": false}'::jsonb;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS shared_with uuid[];

-- ============================================================
-- 7. ENROLLMENT ENHANCEMENTS
-- ============================================================
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS exit_reason text;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
