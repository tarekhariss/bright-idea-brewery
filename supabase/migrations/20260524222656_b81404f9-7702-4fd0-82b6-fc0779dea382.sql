ALTER TABLE public.imported_datasets
  ADD COLUMN IF NOT EXISTS auto_seed_prospects boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.prospect_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  domain text,
  status text NOT NULL,
  confidence numeric,
  trust_score numeric,
  freshness_state text,
  safe_to_send_score numeric,
  estimated_bounce_probability numeric,
  campaign_safety_tier text,
  provider text,
  source text,
  dataset_id uuid REFERENCES public.imported_datasets(id) ON DELETE SET NULL,
  verified_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvh_workspace_email
  ON public.prospect_verification_history(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_pvh_contact
  ON public.prospect_verification_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_pvh_dataset
  ON public.prospect_verification_history(dataset_id);
CREATE INDEX IF NOT EXISTS idx_pvh_workspace_created
  ON public.prospect_verification_history(workspace_id, created_at DESC);

ALTER TABLE public.prospect_verification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pvh workspace select" ON public.prospect_verification_history;
CREATE POLICY "pvh workspace select"
  ON public.prospect_verification_history FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "pvh workspace insert" ON public.prospect_verification_history;
CREATE POLICY "pvh workspace insert"
  ON public.prospect_verification_history FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "pvh workspace update" ON public.prospect_verification_history;
CREATE POLICY "pvh workspace update"
  ON public.prospect_verification_history FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "pvh workspace delete" ON public.prospect_verification_history;
CREATE POLICY "pvh workspace delete"
  ON public.prospect_verification_history FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));