DO $$
DECLARE
  v_user_id uuid;
  v_ws_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email='info@theleadsbridge.com';
  SELECT id INTO v_ws_id FROM public.workspaces WHERE slug='tlbg' LIMIT 1;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws_id, v_user_id, 'admin')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_workspace_preferences (user_id, active_workspace_id)
  VALUES (v_user_id, v_ws_id)
  ON CONFLICT (user_id) DO UPDATE SET active_workspace_id = EXCLUDED.active_workspace_id;
END $$;