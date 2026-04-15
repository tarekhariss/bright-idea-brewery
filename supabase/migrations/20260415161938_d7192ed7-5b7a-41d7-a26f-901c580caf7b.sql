-- Contacts: allow personal/no-workspace records as long as the user is the creator
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    workspace_id IS NULL
    OR is_workspace_member(auth.uid(), workspace_id)
  )
);

DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member_or_admin(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
CREATE POLICY "contacts_update" ON public.contacts
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member(auth.uid(), workspace_id)
)
WITH CHECK (
  created_by = auth.uid()
  OR is_workspace_member(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
CREATE POLICY "contacts_delete" ON public.contacts
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member(auth.uid(), workspace_id)
  )
);

-- Companies: same pattern for no-workspace ownership
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    workspace_id IS NULL
    OR is_workspace_member(auth.uid(), workspace_id)
  )
);

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member_or_admin(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR is_workspace_member(auth.uid(), workspace_id)
)
WITH CHECK (
  created_by = auth.uid()
  OR is_workspace_member(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "companies_delete" ON public.companies;
CREATE POLICY "companies_delete" ON public.companies
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role])
    AND is_workspace_member(auth.uid(), workspace_id)
  )
);