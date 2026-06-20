import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2 } from "lucide-react";

const pct = (v: number | null | undefined) => v == null ? "—" : `${Math.round(v * 100)}%`;

export function SegmentPerformanceCard({ listId }: { listId: string }) {
  const { workspaceId } = useAuth();
  const { enabled: v2 } = useIntelligenceV2();
  const { data, isLoading } = useQuery({
    queryKey: ["segment-perf", workspaceId, listId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_segment_performance", {
        p_workspace_id: workspaceId, p_list_id: listId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId && !!listId && v2,
  });

  if (!v2) return null;
  if (isLoading) return <Card><CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing performance…</CardContent></Card>;
  if (!data || data.insufficient_data) {
    return <Card><CardContent className="p-4 text-xs text-muted-foreground flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Not enough data yet</CardContent></Card>;
  }

  const grade = data.grade as string;
  const gradeColor = grade === "A" ? "default" : grade === "B" ? "secondary" : grade === "C" ? "outline" : "destructive";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Segment performance</span>
          </div>
          <Badge variant={gradeColor as any} className="text-[10px]">Grade {grade}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <Stat label="Contacts" value={Number(data.total).toLocaleString()} />
          <Stat label="Valid rate" value={pct(data.valid_rate)} />
          <Stat label="Risky rate" value={pct(data.risky_rate)} />
          <Stat label="Invalid rate" value={pct(data.invalid_rate)} />
          <Stat label="Bounce rate" value={pct(data.bounce_rate)} />
          <Stat label="Threads" value={Number(data.threads).toLocaleString()} />
          <Stat label="Positive reply rate" value={data.positive_reply_rate == null ? "Not enough data" : pct(data.positive_reply_rate)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
