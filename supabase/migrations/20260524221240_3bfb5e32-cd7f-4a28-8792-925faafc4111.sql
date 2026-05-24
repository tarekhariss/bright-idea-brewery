
-- 1. Freshness classifier
CREATE OR REPLACE FUNCTION public.compute_freshness_state(_verified_at timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _verified_at IS NULL THEN 'unknown'
    WHEN _verified_at > now() - interval '30 days'  THEN 'fresh'
    WHEN _verified_at > now() - interval '90 days'  THEN 'aging'
    WHEN _verified_at > now() - interval '180 days' THEN 'stale'
    ELSE 'expired'
  END
$$;

-- 2. imported_datasets
CREATE TABLE IF NOT EXISTS public.imported_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'EmailListVerify',
  filename text,
  file_type text CHECK (file_type IN ('csv','xlsx','txt','zip')),
  storage_path text,
  row_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_imported_datasets_ws ON public.imported_datasets(workspace_id, uploaded_at DESC);
ALTER TABLE public.imported_datasets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS imp_select ON public.imported_datasets;
CREATE POLICY imp_select ON public.imported_datasets FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS imp_insert ON public.imported_datasets;
CREATE POLICY imp_insert ON public.imported_datasets FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS imp_update ON public.imported_datasets;
CREATE POLICY imp_update ON public.imported_datasets FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
DROP POLICY IF EXISTS imp_delete ON public.imported_datasets;
CREATE POLICY imp_delete ON public.imported_datasets FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'manager'::app_role])
         AND public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- 3. confidence_learning
CREATE TABLE IF NOT EXISTS public.confidence_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  original_status text NOT NULL,
  age_bucket text NOT NULL CHECK (age_bucket IN ('fresh','aging','stale','expired')),
  sample_count integer NOT NULL DEFAULT 0,
  match_count integer NOT NULL DEFAULT 0,
  suggested_confidence numeric(5,2) NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, original_status, age_bucket)
);
ALTER TABLE public.confidence_learning ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cl_select ON public.confidence_learning;
CREATE POLICY cl_select ON public.confidence_learning FOR SELECT TO authenticated USING (true);
-- writes from service role only (no INSERT/UPDATE policies => locked for users)

-- 4. smtp_learning
CREATE TABLE IF NOT EXISTS public.smtp_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  smtp_code integer,
  response_pattern text,
  total_count integer NOT NULL DEFAULT 0,
  success_after_retry integer NOT NULL DEFAULT 0,
  avg_retry_delay_s integer NOT NULL DEFAULT 60,
  recommended_strategy text,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, smtp_code, response_pattern)
);
ALTER TABLE public.smtp_learning ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sl_select ON public.smtp_learning;
CREATE POLICY sl_select ON public.smtp_learning FOR SELECT TO authenticated USING (true);

-- 5. Extend verification_cache (idempotent)
ALTER TABLE public.verification_cache
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS historical_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_dataset_id uuid,
  ADD COLUMN IF NOT EXISTS original_status text,
  ADD COLUMN IF NOT EXISTS original_reason text,
  ADD COLUMN IF NOT EXISTS original_provider text,
  ADD COLUMN IF NOT EXISTS original_verification_date timestamptz,
  ADD COLUMN IF NOT EXISTS age_in_days integer,
  ADD COLUMN IF NOT EXISTS freshness_state text,
  ADD COLUMN IF NOT EXISTS trust_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS recheck_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_transition text,
  ADD COLUMN IF NOT EXISTS safe_to_send_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS estimated_bounce_probability numeric(5,2),
  ADD COLUMN IF NOT EXISTS campaign_safety_tier text;

CREATE INDEX IF NOT EXISTS idx_vcache_freshness ON public.verification_cache(freshness_state);
CREATE INDEX IF NOT EXISTS idx_vcache_recheck ON public.verification_cache(recheck_required) WHERE recheck_required = true;
CREATE INDEX IF NOT EXISTS idx_vcache_dataset ON public.verification_cache(imported_dataset_id) WHERE imported_dataset_id IS NOT NULL;

-- 6. Extend verification_jobs (idempotent)
ALTER TABLE public.verification_jobs
  ADD COLUMN IF NOT EXISTS original_columns_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS uploaded_file_path text;

-- 7. Storage bucket already exists; ensure RLS policies on storage.objects
DROP POLICY IF EXISTS "verification_uploads_read" ON storage.objects;
CREATE POLICY "verification_uploads_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-uploads'
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.workspace_id::text = (storage.foldername(name))[1]
      )
    )
  );
DROP POLICY IF EXISTS "verification_uploads_insert" ON storage.objects;
CREATE POLICY "verification_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-uploads'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id::text = (storage.foldername(name))[1]
    )
  );
DROP POLICY IF EXISTS "verification_uploads_delete" ON storage.objects;
CREATE POLICY "verification_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-uploads'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.role IN ('admin','manager')
    )
  );
