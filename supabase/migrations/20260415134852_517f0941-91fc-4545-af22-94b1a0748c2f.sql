
-- ============================================================
-- Saved Searches table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    entity_type text NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company')),
    filter_definition jsonb NOT NULL DEFAULT '{"logic":"and","groups":[]}'::jsonb,
    is_pinned boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Workspace members can read all saved searches in their workspace
CREATE POLICY "Workspace members can view saved searches"
  ON public.saved_searches FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Users can create saved searches in their workspace
CREATE POLICY "Workspace members can create saved searches"
  ON public.saved_searches FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND created_by = auth.uid());

-- Users can update their own, admins/managers can update any
CREATE POLICY "Users can update own or admins any saved search"
  ON public.saved_searches FOR UPDATE TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[])
    )
  );

-- Users can delete their own, admins/managers can delete any
CREATE POLICY "Users can delete own or admins any saved search"
  ON public.saved_searches FOR DELETE TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      created_by = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[])
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_workspace ON saved_searches (workspace_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_by ON saved_searches (created_by);
CREATE INDEX IF NOT EXISTS idx_saved_searches_pinned ON saved_searches (workspace_id, is_pinned) WHERE is_pinned = true;

-- Timestamp trigger
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
