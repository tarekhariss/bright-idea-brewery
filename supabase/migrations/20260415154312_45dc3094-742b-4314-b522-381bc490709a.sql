CREATE OR REPLACE FUNCTION public.create_workspace_for_user(p_name text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ws public.workspaces%ROWTYPE;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to create a workspace for another user';
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (btrim(p_name), p_user_id)
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

  RETURN jsonb_build_object('id', v_ws.id, 'name', v_ws.name);
END;
$$;