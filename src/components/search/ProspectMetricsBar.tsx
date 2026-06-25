import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityType } from "@/hooks/use-prospect-search";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

interface MetricProps {
  label: string;
  value: number | null;
  loading: boolean;
  active?: boolean;
}

function Metric({ label, value, loading, active }: MetricProps) {
  return (
    <button className={`flex flex-col items-center px-4 py-1.5 rounded transition-colors ${active ? "bg-primary/10" : "hover:bg-muted"}`}>
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-10 mt-0.5" />
      ) : (
        <span className="text-sm font-semibold leading-tight">{formatCompact(value ?? 0)}</span>
      )}
    </button>
  );
}

function applyOwnerFilter(query: any, accessibleWorkspaceIds: string[], userId: string) {
  if (accessibleWorkspaceIds.length > 0) return query.in("workspace_id", accessibleWorkspaceIds);
  return query.is("workspace_id", null).eq("created_by", userId);
}

interface ProspectMetricsBarProps {
  entityType: EntityType;
  filteredCount: number;
  filteredLoading: boolean;
}

export function ProspectMetricsBar({ entityType, filteredCount, filteredLoading }: ProspectMetricsBarProps) {
  const { accessibleWorkspaceIds, user } = useAuth();
  const table = entityType === "contact" ? "contacts" : "companies";
  const userId = user?.id;
  const wsKey = accessibleWorkspaceIds.slice().sort().join(",");

  const { data: globalCount, isLoading: globalLoading } = useQuery({
    queryKey: ["prospect-metrics-global", table, wsKey, userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = (supabase as any).from(table).select("*", { count: "exact", head: true });
      q = applyOwnerFilter(q, accessibleWorkspaceIds, userId!);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: netNewCount, isLoading: netNewLoading } = useQuery({
    queryKey: ["prospect-metrics-netnew", table, wsKey, userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      let q = (supabase as any).from(table).select("*", { count: "exact", head: true });
      q = applyOwnerFilter(q, accessibleWorkspaceIds, userId!);
      q = q.gte("created_at", since.toISOString());
      const { count } = await q;
      return count ?? 0;
    },
  });


  const { data: savedCount, isLoading: savedLoading } = useQuery({
    queryKey: ["prospect-metrics-saved", table, workspaceId, userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const joinTable = entityType === "contact" ? "contact_tags" : "company_tags";
      const idCol = entityType === "contact" ? "contact_id" : "company_id";
      const { data } = await (supabase as any)
        .from(joinTable)
        .select(idCol)
        .limit(50000);
      const uniqueIds = new Set((data ?? []).map((r: any) => r[idCol]));
      return uniqueIds.size;
    },
  });

  return (
    <div className="flex items-center gap-1 border-b border-border px-2 py-1">
      <Metric label="Total" value={globalCount ?? null} loading={globalLoading} active />
      <Metric label="Net New" value={netNewCount ?? null} loading={netNewLoading} />
      <Metric label="Saved" value={savedCount ?? null} loading={savedLoading} />
    </div>
  );
}
