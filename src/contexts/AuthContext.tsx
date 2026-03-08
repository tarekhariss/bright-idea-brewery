import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/integrations/supabase/db-types";

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
});

export const useAuth = () => useContext(AuthContext);

const ROLE_RANK: Record<AppRole, number> = { admin: 4, manager: 3, operator: 2, viewer: 1 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user) {
          // Fire and forget role fetch
          fetchRole(session.user.id);
        } else {
          setRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) fetchRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (data && data.length > 0) {
      // Pick highest role
      const best = data.reduce((a, b) => (ROLE_RANK[b.role as AppRole] > ROLE_RANK[a.role as AppRole] ? b : a));
      setRole(best.role as AppRole);
    } else {
      // Default to operator if no role assigned
      setRole("operator");
    }
  }

  const hasRole = (r: AppRole) => {
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[r];
  };

  const user = session?.user ?? null;
  const canEdit = hasRole("operator");
  const canManage = hasRole("manager");
  const isAdmin = hasRole("admin");

  return (
    <AuthContext.Provider value={{ session, user, loading, role, hasRole, canEdit, canManage, isAdmin, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </AuthContext.Provider>
  );
}
