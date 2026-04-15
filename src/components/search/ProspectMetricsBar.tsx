import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Database, Users, UserPlus, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityType } from "@/hooks/use-prospect-search";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  loading: boolean;
  accent?: boolean;
}

function MetricCard({ icon, label, value, loading, accent }: MetricCardProps) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg border border-border bg-card min-w-[150px]">
      <div className={`flex items-center justify-center h-8 w-8 rounded-md ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-5 w-12 mb-0.5" />
        ) : (
          <p className="text-base font-semibold leading-tight">{(value ?? 0).toLocaleString()}</p>
        )}
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

interface ProspectMetricsBarProps {
  entityType: EntityType;
  filteredCount: number;
  filteredLoading: boolean;
}

export function ProspectMetricsBar({ entityType, filteredCount, filteredLoading }: ProspectMetricsBarProps) {
  const { workspaceId } = useAuth();
  const table = entityType === "contact" ? "contacts" : "companies";

  const { data: globalCount, isLoading: globalLoading } = useQuery({
    queryKey: ["prospect-metrics-global", table, workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      return count ?? 0;
    },
  });

  const { data: netNewCount, isLoading: netNewLoading } = useQuery({
    queryKey: ["prospect-metrics-netnew", table, workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count } = await (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", since.toISOString());
      return count ?? 0;
    },
  });

  const { data: taggedCount, isLoading: taggedLoading } = useQuery({
    queryKey: ["prospect-metrics-tagged", table, workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const joinTable = entityType === "contact" ? "contact_tags" : "company_tags";
      const idCol = entityType === "contact" ? "contact_id" : "company_id";
      const { data } = await (supabase as any)
        .from(joinTable)
        .select(idCol, { count: "exact", head: false })
        .limit(50000);
      const uniqueIds = new Set((data ?? []).map((r: any) => r[idCol]));
      return uniqueIds.size;
    },
  });

  const hasFilters = filteredCount !== (globalCount ?? 0);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border overflow-x-auto">
      <MetricCard
        icon={<Database className="h-4 w-4" />}
        label="Total in Database"
        value={globalCount ?? null}
        loading={globalLoading}
        accent
      />
      {hasFilters && (
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Filtered Results"
          value={filteredCount}
          loading={filteredLoading}
        />
      )}
      <MetricCard
        icon={<UserPlus className="h-4 w-4" />}
        label="Net New (7d)"
        value={netNewCount ?? null}
        loading={netNewLoading}
      />
      <MetricCard
        icon={<Tag className="h-4 w-4" />}
        label="Tagged"
        value={taggedCount ?? null}
        loading={taggedLoading}
      />
    </div>
  );
}
