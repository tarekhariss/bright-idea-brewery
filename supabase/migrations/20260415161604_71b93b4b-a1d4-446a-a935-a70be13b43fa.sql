-- Drop existing insert policy
DROP POLICY IF EXISTS "import_jobs_insert" ON public.import_jobs;

-- Create a more permissive insert policy: workspace member OR own record without workspace
CREATE POLICY "import_jobs_insert" ON public.import_jobs
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    workspace_id IS NULL
    OR is_workspace_member(auth.uid(), workspace_id)
  )
);

-- Also update SELECT policy to allow users to see their own jobs even without workspace
DROP POLICY IF EXISTS "import_jobs_select" ON public.import_jobs;
CREATE POLICY "import_jobs_select" ON public.import_jobs
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member_or_admin(auth.uid(), workspace_id)
);

-- Also update UPDATE policy
DROP POLICY IF EXISTS "import_jobs_update" ON public.import_jobs;
CREATE POLICY "import_jobs_update" ON public.import_jobs
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member(auth.uid(), workspace_id)
);