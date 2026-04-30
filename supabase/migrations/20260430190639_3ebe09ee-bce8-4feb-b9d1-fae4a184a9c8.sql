-- Fix workspace creation: auto-generate a unique slug from the workspace name.
-- The workspaces.slug column is NOT NULL UNIQUE but the RPC was inserting NULL.

CREATE OR REPLACE FUNCTION public.generate_workspace_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_n int := 0;
BEGIN
  v_base := regexp_replace(lower(coalesce(p_name,'workspace')), '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  IF v_base IS NULL OR v_base = '' THEN v_base := 'workspace'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;
  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_for_user(p_name text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws public.workspaces%ROWTYPE;
  v_slug text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to create a workspace for another user';
  END IF;

  v_slug := public.generate_workspace_slug(p_name);

  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (btrim(p_name), v_slug, p_user_id)
  RETURNING * INTO v_ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws.id, p_user_id, 'admin');

  INSERT INTO public.user_workspace_preferences (user_id, active_workspace_id)
  VALUES (p_user_id, v_ws.id)
  ON CONFLICT (user_id)
  DO UPDATE SET active_workspace_id = EXCLUDED.active_workspace_id, updated_at = now();

  INSERT INTO public.profiles (id, email)
  VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id))
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('id', v_ws.id, 'name', v_ws.name, 'slug', v_ws.slug);
END;
$$;