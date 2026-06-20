import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when the current workspace has intelligence_v2 enabled.
 * All MVP Intelligence Sprint features must check this before rendering.
 */
export function useIntelligenceV2(): { enabled: boolean; isLoading: boolean } {
  const { workspaceId } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-intelligence-v2", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return false;
      const { data, error } = await (supabase.from("workspaces") as any)
        .select("intelligence_v2")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) return false;
      return Boolean(data?.intelligence_v2);
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  return { enabled: Boolean(data), isLoading };
}
