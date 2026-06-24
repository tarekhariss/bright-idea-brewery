-- Point user to the real TLBG workspace instead of empty "My Workspace"
INSERT INTO public.user_workspace_preferences (user_id, active_workspace_id)
VALUES ('8a2e8f3a-3a2a-419c-9f6c-73d6262c2fda', '461b9c23-16d9-43f7-b533-6ff13486cf81')
ON CONFLICT (user_id) DO UPDATE SET active_workspace_id = EXCLUDED.active_workspace_id, updated_at = now();