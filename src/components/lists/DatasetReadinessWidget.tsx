import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Gauge } from "lucide-react";

function gradeLabel(score: number) {
  if (score >= 80) return { label: "Ready", variant: "default" as const };
  if (score >= 60) return { label: "Needs verification", variant: "secondary" as const };
  if (score >= 30) return { label: "Risky", variant: "outline" as const };
  return { label: "Not ready", variant: "destructive" as const };
}

export function DatasetReadinessWidget({ listId }: { listId: string }) {
  const { workspaceId } = useAuth();
  const { enabled: v2 } = useIntelligenceV2();

  const { data, isLoading } = useQuery({
    queryKey: ["dataset-readiness", workspaceId, listId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("compute_dataset_readiness", {
        p_workspace_id: workspaceId, p_list_id: listId, p_saved_search_id: null,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId && !!listId && v2,
  });

  if (!v2) return null;
  if (isLoading) return <Card><CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing readiness…</CardContent></Card>;
  if (!data || data.total === 0) {
    return <Card><CardContent className="p-4 text-xs text-muted-foreground flex items-center gap-2"><Gauge className="h-3.5 w-3.5" /> Not enough data yet</CardContent></Card>;
  }

  const g = gradeLabel(data.score ?? 0);
  const fixes: string[] = [];
  if ((data.unverified ?? 0) > 0) fixes.push(`Verify ${data.unverified.toLocaleString()} unverified emails`);
  if ((data.invalid ?? 0) + (data.bounced ?? 0) > 0) fixes.push(`Remove ${((data.invalid ?? 0) + (data.bounced ?? 0)).toLocaleString()} invalid/bounced contacts`);
  if ((data.missing_company ?? 0) > 0) fixes.push(`${data.missing_company.toLocaleString()} contacts have no company`);
  if ((data.suppressed ?? 0) > 0) fixes.push(`${data.suppressed.toLocaleString()} suppressed contacts`);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Dataset readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{data.score}</span>
            <Badge variant={g.variant} className="text-[10px]">{g.label}</Badge>
          </div>
        </div>
        <Progress value={data.score} className="h-1.5" />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
          {[
            ["total", "Total"], ["valid", "Valid"], ["catch_all", "Catch-all"], ["risky", "Risky"],
            ["unknown", "Unknown"], ["invalid", "Invalid"], ["bounced", "Bounced"], ["suppressed", "Suppressed"],
            ["unverified", "Unverified"], ["missing_company", "No company"],
          ].map(([k, label]) => (
            <div key={k} className="rounded border p-1.5">
              <p className="text-muted-foreground">{label}</p>
              <p className="font-medium tabular-nums">{Number(data[k] ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
        {data.quarantined_pending > 0 && (
          <p className="text-[11px] text-amber-700">{data.quarantined_pending} quarantined row(s) pending review (workspace-wide). Excluded from this score.</p>
        )}
        {fixes.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            <p className="font-medium mb-1">Recommended fixes</p>
            <ul className="list-disc list-inside space-y-0.5">{fixes.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
