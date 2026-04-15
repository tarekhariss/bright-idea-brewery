import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/integrations/supabase/db-types";

interface Workspace {
  id: string;
  name: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  hasRole: (r: AppRole) => boolean;
  canEdit: boolean;
  canManage: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  // Workspace
  workspaceId: string | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  workspaceLoading: boolean;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  hasRole: () => false,
  canEdit: false,
  canManage: false,
  isAdmin: false,
  signOut: async () => {},
  workspaceId: null,
  workspace: null,
  workspaces: [],
  workspaceLoading: true,
  switchWorkspace: async () => {},
  createWorkspace: async () => null,
});

export const useAuth = () => useContext(AuthContext);

const ROLE_RANK: Record<AppRole, number> = { admin: 4, manager: 3, operator: 2, viewer: 1 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user) {
          fetchRole(session.user.id);
          fetchWorkspaces(session.user.id);
        } else {
          setRole(null);
          setWorkspace(null);
          setWorkspaces([]);
          setWorkspaceLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        fetchRole(session.user.id);
        fetchWorkspaces(session.user.id);
      } else {
        setWorkspaceLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId) as { data: { role: AppRole }[] | null };
    if (data && data.length > 0) {
      const best = data.reduce((a, b) => (ROLE_RANK[b.role] > ROLE_RANK[a.role] ? b : a));
      setRole(best.role);
    } else {
      setRole("operator");
    }
  }

  async function fetchWorkspaces(userId: string) {
    setWorkspaceLoading(true);
    try {
      const { data: memberships } = await (supabase as any)
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name)")
        .eq("user_id", userId);

      const wsList: Workspace[] = (memberships ?? [])
        .map((m: any) => m.workspaces)
        .filter(Boolean);

      setWorkspaces(wsList);

      if (wsList.length === 0) {
        setWorkspaceLoading(false);
        return;
      }

      // Get saved preference
      const { data: pref } = await (supabase as any)
        .from("user_workspace_preferences")
        .select("active_workspace_id")
        .eq("user_id", userId)
        .maybeSingle();

      const activeId = pref?.active_workspace_id;
      const active = wsList.find((w) => w.id === activeId) ?? wsList[0];
      setWorkspace(active);
    } catch (e) {
      console.error("Failed to load workspaces:", e);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  const switchWorkspace = async (id: string) => {
    const user = session?.user;
    if (!user) return;
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    setWorkspace(ws);
    await (supabase as any)
      .from("user_workspace_preferences")
      .upsert({ user_id: user.id, active_workspace_id: id }, { onConflict: "user_id" });
  };

  const createWorkspace = async (name: string): Promise<Workspace | null> => {
    const user = session?.user;
    if (!user) return null;
    const { data: ws, error } = await (supabase as any)
      .from("workspaces")
      .insert({ name, owner_id: user.id })
      .select()
      .single();
    if (error || !ws) return null;

    await (supabase as any)
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: user.id, role: "admin" });

    await (supabase as any)
      .from("user_workspace_preferences")
      .upsert({ user_id: user.id, active_workspace_id: ws.id }, { onConflict: "user_id" });

    const newWs = { id: ws.id, name: ws.name };
    setWorkspaces((prev) => [...prev, newWs]);
    setWorkspace(newWs);
    return newWs;
  };

  const hasRole = (r: AppRole) => {
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[r];
  };

  const user = session?.user ?? null;
  const canEdit = hasRole("operator");
  const canManage = hasRole("manager");
  const isAdmin = hasRole("admin");

  return (
    <AuthContext.Provider value={{
      session, user, loading, role, hasRole, canEdit, canManage, isAdmin,
      signOut: async () => { await supabase.auth.signOut(); },
      workspaceId: workspace?.id ?? null,
      workspace,
      workspaces,
      workspaceLoading,
      switchWorkspace,
      createWorkspace,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
