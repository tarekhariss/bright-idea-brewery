import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Loader2 } from "lucide-react";

const TIER_VARIANT: Record<string, any> = { hot: "destructive", warm: "default", cool: "secondary", cold: "outline" };

export function AccountHeatScoreCard({ companyId }: { companyId: string }) {
  const { workspaceId } = useAuth();
  const { enabled: v2 } = useIntelligenceV2();
  const { data, isLoading } = useQuery({
    queryKey: ["account-heat", workspaceId, companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("compute_account_heat_score", {
        p_workspace_id: workspaceId, p_company_id: companyId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId && !!companyId && v2,
  });

  if (!v2) return null;
  if (isLoading) return <Card><CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing heat score…</CardContent></Card>;
  if (!data || data.insufficient_data) {
    return <Card><CardContent className="p-4 text-xs text-muted-foreground flex items-center gap-2"><Flame className="h-3.5 w-3.5" /> Not enough data yet</CardContent></Card>;
  }

  const inp = data.inputs ?? {};
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Account heat score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{data.score}</span>
            <Badge variant={TIER_VARIANT[data.tier] ?? "outline"} className="text-[10px] capitalize">{data.tier}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Row label="Total contacts" value={inp.total_contacts} />
          <Row label="Valid emails" value={`${inp.valid_emails} (${Math.round((inp.valid_email_ratio ?? 0) * 100)}%)`} />
          <Row label="Seniority contacts" value={inp.seniority_count} />
          <Row label="Open opportunity" value={inp.has_open_opportunity ? "Yes" : "No"} />
          <Row label="Positive reply" value={inp.has_positive_reply ? "Yes" : "No"} />
          <Row label="Recent activity (14d)" value={inp.recent_activity_14d ? "Yes" : "No"} />
          <Row label="Bounce/suppression risk" value={inp.bounce_or_suppression_count} />
        </div>
        <p className="text-[10px] text-muted-foreground">Score is rule-based and fully explainable. No model predictions.</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
