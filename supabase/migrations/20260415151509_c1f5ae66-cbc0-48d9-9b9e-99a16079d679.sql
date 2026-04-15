
-- Atomic workspace creation function (bypasses RLS race condition)
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_name text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ws record;
BEGIN
  -- Create the workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (p_name, p_user_id)
  RETURNING * INTO v_ws;

  -- Add user as admin member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws.id, p_user_id, 'admin');

  -- Set as active workspace
  INSERT INTO public.user_workspace_preferences (user_id, active_workspace_id)
  VALUES (p_user_id, v_ws.id)
  ON CONFLICT (user_id) DO UPDATE SET active_workspace_id = v_ws.id, updated_at = now();

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email)
  VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id))
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('id', v_ws.id, 'name', v_ws.name);
END;
$$;
