
-- 1) Fix mutable search_path
CREATE OR REPLACE FUNCTION public._company_field_score(c public.companies)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT (
    (c.industry IS NOT NULL)::int + (c.employee_count IS NOT NULL)::int +
    (c.revenue_range IS NOT NULL)::int + (c.annual_revenue IS NOT NULL)::int +
    (c.headquarters IS NOT NULL)::int + (c.linkedin_url IS NOT NULL)::int +
    (c.website IS NOT NULL)::int + (c.founded_year IS NOT NULL)::int +
    (c.description IS NOT NULL)::int + (c.country IS NOT NULL)::int +
    (c.city IS NOT NULL)::int + (c.technologies IS NOT NULL)::int +
    (c.custom_fields IS NOT NULL)::int
  )
$function$;

-- 2) activities: add admin/manager-only UPDATE & DELETE
CREATE POLICY activities_update ON public.activities
  FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
  WITH CHECK (workspace_id IS NOT NULL AND public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

CREATE POLICY activities_delete ON public.activities
  FOR DELETE TO authenticated
  USING (workspace_id IS NOT NULL AND public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

-- 3) bounce_feedback: explicit deny for client writes
CREATE POLICY bf_no_client_insert ON public.bounce_feedback
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY bf_no_client_update ON public.bounce_feedback
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY bf_no_client_delete ON public.bounce_feedback
  FOR DELETE TO authenticated USING (false);

-- 4) linkedin_webhooks: tighten to admin/manager
DROP POLICY IF EXISTS li_webhooks_select ON public.linkedin_webhooks;
CREATE POLICY li_webhooks_select ON public.linkedin_webhooks
  FOR SELECT TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

DROP POLICY IF EXISTS li_webhooks_update ON public.linkedin_webhooks;
CREATE POLICY li_webhooks_update ON public.linkedin_webhooks
  FOR UPDATE TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

DROP POLICY IF EXISTS li_webhooks_insert ON public.linkedin_webhooks;
CREATE POLICY li_webhooks_insert ON public.linkedin_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

-- 5) mailboxes: revoke credential columns from authenticated/anon
REVOKE SELECT (oauth_access_token, oauth_refresh_token, smtp_password_encrypted) ON public.mailboxes FROM authenticated;
REVOKE SELECT (oauth_access_token, oauth_refresh_token, smtp_password_encrypted) ON public.mailboxes FROM anon;

-- 6) Rewrite policies that use has_any_role to be workspace-scoped via workspace_role.
--    For each policy:
--      - extract the role array used in the first has_any_role(...) call
--      - replace every is_workspace_member_or_admin(auth.uid(), W) and
--        is_workspace_member(auth.uid(), W) with
--        (public.workspace_role(auth.uid(), W) = ANY(ARRAY[roles]))
--      - strip the now-redundant has_any_role(...) calls (and their AND glue)
--      - if any standalone has_any_role(...) remains (OR-branch case), bind it
--        to the table's `workspace_id` column.
DO $rewrite$
DECLARE
  r RECORD;
  role_arr text;
  new_qual text;
  new_chk text;
  cmd text;
  using_clause text;
  check_clause text;
  m text[];
BEGIN
  FOR r IN
    SELECT p.oid AS polid,
           p.polrelid::regclass::text AS tbl,
           p.polname,
           p.polcmd,
           COALESCE(pg_get_expr(p.polqual, p.polrelid), '') AS qual,
           COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') AS chk
    FROM pg_policy p
    WHERE p.polrelid::regclass::text NOT IN
            ('public.linkedin_webhooks')
      AND (pg_get_expr(p.polqual, p.polrelid) LIKE '%has_any_role%'
           OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%has_any_role%')
  LOOP
    -- pull the role array from the first has_any_role call in either clause
    m := regexp_match(r.qual || ' ' || r.chk,
                      'has_any_role\(\s*auth\.uid\(\)\s*,\s*(ARRAY\[[^\]]+\])\s*\)');
    IF m IS NULL THEN CONTINUE; END IF;
    role_arr := m[1];

    new_qual := r.qual;
    new_chk  := r.chk;

    -- substitute workspace_member predicates with the workspace_role check
    new_qual := regexp_replace(
      new_qual,
      'is_workspace_member_or_admin\(\s*auth\.uid\(\)\s*,\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\)',
      '(public.workspace_role(auth.uid(), \1) = ANY(' || role_arr || '))',
      'g'
    );
    new_qual := regexp_replace(
      new_qual,
      'is_workspace_member\(\s*auth\.uid\(\)\s*,\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\)',
      '(public.workspace_role(auth.uid(), \1) = ANY(' || role_arr || '))',
      'g'
    );
    new_chk := regexp_replace(
      new_chk,
      'is_workspace_member_or_admin\(\s*auth\.uid\(\)\s*,\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\)',
      '(public.workspace_role(auth.uid(), \1) = ANY(' || role_arr || '))',
      'g'
    );
    new_chk := regexp_replace(
      new_chk,
      'is_workspace_member\(\s*auth\.uid\(\)\s*,\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\)',
      '(public.workspace_role(auth.uid(), \1) = ANY(' || role_arr || '))',
      'g'
    );

    -- strip has_any_role and its AND-glue (both orderings)
    new_qual := regexp_replace(new_qual,
      'has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)\s+AND\s+', '', 'g');
    new_qual := regexp_replace(new_qual,
      '\s+AND\s+has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)', '', 'g');
    new_chk := regexp_replace(new_chk,
      'has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)\s+AND\s+', '', 'g');
    new_chk := regexp_replace(new_chk,
      '\s+AND\s+has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)', '', 'g');

    -- any remaining standalone has_any_role(...) (e.g., inside an OR) -> bind to own workspace_id column
    new_qual := regexp_replace(new_qual,
      'has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)',
      '(public.workspace_role(auth.uid(), workspace_id) = ANY(' || role_arr || '))',
      'g');
    new_chk := regexp_replace(new_chk,
      'has_any_role\(\s*auth\.uid\(\)\s*,\s*ARRAY\[[^\]]+\]\s*\)',
      '(public.workspace_role(auth.uid(), workspace_id) = ANY(' || role_arr || '))',
      'g');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.tbl);

    cmd := CASE r.polcmd
             WHEN 'r' THEN 'SELECT'
             WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE'
             WHEN '*' THEN 'ALL'
           END;

    using_clause := CASE WHEN new_qual <> '' THEN ' USING (' || new_qual || ')' ELSE '' END;
    check_clause := CASE WHEN new_chk  <> '' THEN ' WITH CHECK (' || new_chk  || ')' ELSE '' END;

    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated%s%s',
      r.polname, r.tbl, cmd, using_clause, check_clause
    );
  END LOOP;
END
$rewrite$;
