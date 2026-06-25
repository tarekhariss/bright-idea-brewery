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
  workspaceId: string | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  accessibleWorkspaceIds: string[];
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
    // Track which user we've already bootstrapped role+workspaces for so we
    // don't re-fetch (and flash the full-screen loader) when gotrue re-emits
    // SIGNED_IN on tab focus / token refresh.
    let bootstrappedUserId: string | null = null;

    const bootstrap = (userId: string) => {
      if (bootstrappedUserId === userId) return;
      bootstrappedUserId = userId;
      fetchRole(userId);
      fetchWorkspaces(userId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Always keep the session ref fresh so requests get the new access_token
        setSession(newSession);
        setLoading(false);

        // TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION fire on tab-focus and
        // periodic refresh. Re-fetching role + workspaces on those events causes
        // visible app churn (loading flashes, refetch storms). Only react to
        // actual sign-in / sign-out transitions, and dedupe SIGNED_IN events
        // for the same user (gotrue re-emits SIGNED_IN on tab visibility).
        if (event === "SIGNED_IN" && newSession?.user) {
          bootstrap(newSession.user.id);
        } else if (event === "SIGNED_OUT") {
          bootstrappedUserId = null;
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
        bootstrap(session.user.id);
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
        setWorkspace(null);
        setWorkspaceLoading(false);
        return;
      }

      const { data: pref } = await (supabase as any)
        .from("user_workspace_preferences")
        .select("active_workspace_id")
        .eq("user_id", userId)
        .maybeSingle();

      let active = wsList.find((w) => w.id === pref?.active_workspace_id) ?? null;

      // Safeguard: never land on an empty workspace when the user has access
      // to one with real data. Rank workspaces by contact count and prefer
      // a "TLBG"-named workspace with data.
      const counts: Record<string, number> = {};
      await Promise.all(
        wsList.map(async (w) => {
          const { count } = await (supabase as any)
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", w.id);
          counts[w.id] = count ?? 0;
        })
      );

      const activeHasData = active ? (counts[active.id] ?? 0) > 0 : false;
      if (!active || !activeHasData) {
        const tlbg = wsList.find((w) => /tlbg/i.test(w.name) && (counts[w.id] ?? 0) > 0);
        const byCount = [...wsList].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))[0];
        const fallback = tlbg ?? (byCount && (counts[byCount.id] ?? 0) > 0 ? byCount : null) ?? wsList[0];
        if (fallback && fallback.id !== active?.id) {
          active = fallback;
          await (supabase as any)
            .from("user_workspace_preferences")
            .upsert({ user_id: userId, active_workspace_id: fallback.id }, { onConflict: "user_id" });
        }
      }

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

    // Use atomic SECURITY DEFINER function so creation stays safe under RLS
    const { data, error } = await (supabase as any).rpc("create_workspace_for_user", {
      p_name: name,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Workspace creation failed:", error);
      throw new Error(error.message || "Failed to create workspace");
    }

    if (!data) return null;

    const newWs: Workspace = { id: data.id, name: data.name };
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
