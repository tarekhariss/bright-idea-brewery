/**
 * Workspace context hook — provides active workspace_id to the entire app.
 * Loads from user_workspace_preferences, auto-selects first available workspace.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaceId: string | null;
  workspaces: Workspace[];
  loading: boolean;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
}

export const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  workspaceId: null,
  workspaces: [],
  loading: true,
  switchWorkspace: async () => {},
  createWorkspace: async () => null,
});

export const useWorkspace = () => useContext(WorkspaceContext);

export function useWorkspaceProvider() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get user's workspace memberships
    const { data: memberships } = await (supabase as any)
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name, owner_id, created_at)")
      .eq("user_id", user.id);

    const wsList: Workspace[] = (memberships ?? [])
      .map((m: any) => m.workspaces)
      .filter(Boolean);

    setWorkspaces(wsList);

    if (wsList.length === 0) {
      setLoading(false);
      return;
    }

    // Get saved preference
    const { data: pref } = await (supabase as any)
      .from("user_workspace_preferences")
      .select("active_workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const activeId = pref?.active_workspace_id;
    const active = wsList.find((w) => w.id === activeId) ?? wsList[0];
    setWorkspace(active);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const switchWorkspace = useCallback(async (id: string) => {
    if (!user) return;
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    setWorkspace(ws);

    await (supabase as any)
      .from("user_workspace_preferences")
      .upsert({ user_id: user.id, active_workspace_id: id }, { onConflict: "user_id" });
  }, [user, workspaces]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!user) return null;
    const { data: ws, error } = await (supabase as any)
      .from("workspaces")
      .insert({ name, owner_id: user.id })
      .select()
      .single();
    if (error || !ws) return null;

    // Add creator as admin member
    await (supabase as any)
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: user.id, role: "admin" });

    // Set as active
    await (supabase as any)
      .from("user_workspace_preferences")
      .upsert({ user_id: user.id, active_workspace_id: ws.id }, { onConflict: "user_id" });

    // Add profile if not exists
    await (supabase as any)
      .from("profiles")
      .upsert({ id: user.id, email: user.email }, { onConflict: "id" });

    setWorkspaces((prev) => [...prev, ws]);
    setWorkspace(ws);
    return ws;
  }, [user]);

  return {
    workspace,
    workspaceId: workspace?.id ?? null,
    workspaces,
    loading,
    switchWorkspace,
    createWorkspace,
  };
}
