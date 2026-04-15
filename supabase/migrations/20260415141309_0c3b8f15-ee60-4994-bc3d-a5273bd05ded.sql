
-- ============================================================
-- EXPORT ENGINE
-- ============================================================

-- Export job status enum
CREATE TYPE public.export_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE public.export_type AS ENUM ('filtered', 'selected', 'list', 'saved_search', 'full');

-- Export jobs table
CREATE TABLE public.export_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
  export_type public.export_type NOT NULL DEFAULT 'filtered',
  status public.export_status NOT NULL DEFAULT 'pending',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  file_url TEXT,
  file_name TEXT NOT NULL,
  filter_definition JSONB,
  selected_ids TEXT[],
  selected_columns TEXT[] NOT NULL DEFAULT '{}',
  template_id UUID,
  source_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace export jobs"
  ON public.export_jobs FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace export jobs"
  ON public.export_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update workspace export jobs"
  ON public.export_jobs FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete workspace export jobs"
  ON public.export_jobs FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_export_jobs_workspace ON public.export_jobs(workspace_id);
CREATE INDEX idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX idx_export_jobs_created_by ON public.export_jobs(created_by);

-- Export templates table
CREATE TABLE public.export_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
  columns TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace export templates"
  ON public.export_templates FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace export templates"
  ON public.export_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update workspace export templates"
  ON public.export_templates FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete workspace export templates"
  ON public.export_templates FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_export_templates_workspace ON public.export_templates(workspace_id);

-- ============================================================
-- DEDUPLICATION + MERGE ENGINE
-- ============================================================

CREATE TYPE public.duplicate_group_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE public.merge_status AS ENUM ('candidate', 'merged', 'kept_separate', 'skipped');

-- Duplicate groups table
CREATE TABLE public.duplicate_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
  status public.duplicate_group_status NOT NULL DEFAULT 'pending',
  record_count INTEGER NOT NULL DEFAULT 0,
  primary_record_id UUID,
  confidence_score NUMERIC DEFAULT 0,
  match_rules TEXT[] NOT NULL DEFAULT '{}',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace duplicate groups"
  ON public.duplicate_groups FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace duplicate groups"
  ON public.duplicate_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update workspace duplicate groups"
  ON public.duplicate_groups FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete workspace duplicate groups"
  ON public.duplicate_groups FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_duplicate_groups_workspace ON public.duplicate_groups(workspace_id);
CREATE INDEX idx_duplicate_groups_status ON public.duplicate_groups(status);
CREATE INDEX idx_duplicate_groups_entity ON public.duplicate_groups(entity_type);

-- Duplicate candidates table
CREATE TABLE public.duplicate_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.duplicate_groups(id) ON DELETE CASCADE NOT NULL,
  record_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
  match_score NUMERIC DEFAULT 0,
  match_reasons TEXT[] NOT NULL DEFAULT '{}',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  merge_status public.merge_status NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view duplicate candidates via group"
  ON public.duplicate_candidates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.duplicate_groups g
    WHERE g.id = group_id AND public.is_workspace_member(auth.uid(), g.workspace_id)
  ));

CREATE POLICY "Members can create duplicate candidates via group"
  ON public.duplicate_candidates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.duplicate_groups g
    WHERE g.id = group_id AND public.is_workspace_member(auth.uid(), g.workspace_id)
  ));

CREATE POLICY "Members can update duplicate candidates via group"
  ON public.duplicate_candidates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.duplicate_groups g
    WHERE g.id = group_id AND public.is_workspace_member(auth.uid(), g.workspace_id)
  ));

CREATE POLICY "Members can delete duplicate candidates via group"
  ON public.duplicate_candidates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.duplicate_groups g
    WHERE g.id = group_id AND public.is_workspace_member(auth.uid(), g.workspace_id)
  ));

CREATE INDEX idx_duplicate_candidates_group ON public.duplicate_candidates(group_id);
CREATE INDEX idx_duplicate_candidates_record ON public.duplicate_candidates(record_id);

-- Merge history table
CREATE TABLE public.merge_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
  surviving_record_id UUID NOT NULL,
  merged_record_ids UUID[] NOT NULL DEFAULT '{}',
  field_selections JSONB NOT NULL DEFAULT '{}',
  merge_summary JSONB,
  duplicate_group_id UUID REFERENCES public.duplicate_groups(id) ON DELETE SET NULL,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace merge history"
  ON public.merge_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create workspace merge history"
  ON public.merge_history FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_merge_history_workspace ON public.merge_history(workspace_id);
CREATE INDEX idx_merge_history_surviving ON public.merge_history(surviving_record_id);

-- Add triggers for updated_at
CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_export_templates_updated_at BEFORE UPDATE ON public.export_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_duplicate_groups_updated_at BEFORE UPDATE ON public.duplicate_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
