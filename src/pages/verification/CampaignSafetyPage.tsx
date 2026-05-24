import { PageContainer, SectionHeader, KpiCard, EmptyState } from "@/components/verification/kit";
import { useCampaignSafety } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const sb = supabase as any;

export default function CampaignSafetyPage() {
  const { workspaceId } = useAuth();
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns_simple", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("campaigns").select("id, name, status").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: safety, isLoading } = useCampaignSafety(campaignId);
  const blockReasons = (safety?.warnings ?? []).filter((w: string) => w.startsWith("blocked:"));
  const reviewReasons = (safety?.warnings ?? []).filter((w: string) => !w.startsWith("blocked:"));
  const isBlocked = !!safety?.blocked;

  return (
    <PageContainer>
      <SectionHeader title="Campaign Safety" subtitle="Pre-launch verification gate. Invalid/disposable/suppressed are hard-blocked. Catch-all/unknown/risky require manual approval." />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Inspect campaign:</span>
          <Select value={campaignId ?? ""} onValueChange={setCampaignId}>
            <SelectTrigger className="w-80"><SelectValue placeholder="Pick a campaign…" /></SelectTrigger>
            <SelectContent>
              {campaigns.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name} — {c.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!campaignId ? (
        <EmptyState icon={ShieldCheck} title="Choose a campaign" description="Pick a campaign to run the safety check." />
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Computing…</div>
      ) : safety ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Enrolled" value={safety.total ?? 0} icon={ShieldCheck} />
            <KpiCard label="Invalid" value={safety.invalid ?? 0} accent="rose" />
            <KpiCard label="Disposable" value={safety.disposable ?? 0} accent="rose" />
            <KpiCard label="Suppressed" value={safety.suppressed ?? 0} accent="amber" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Unknown" value={safety.unknown ?? 0} accent="sky" />
            <KpiCard label="Risk score" value={safety.risk_score ?? "—"} accent={isBlocked ? "rose" : "default"} />
            <KpiCard label="Decision" value={isBlocked ? "BLOCKED" : "OK"} accent={isBlocked ? "rose" : "emerald"} />
            <KpiCard label="Warnings" value={(safety.warnings ?? []).length} accent="amber" />
          </div>

          {(blockReasons.length > 0 || reviewReasons.length > 0) && (
            <Card className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {isBlocked ? <ShieldAlert className="h-4 w-4 text-rose-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {isBlocked ? "Hard blocks" : "Requires manual review"}
              </h3>
              <ul className="space-y-1 text-sm">
                {blockReasons.map((w: string, i: number) => (
                  <li key={i} className="text-rose-500">• {w.replace(/^blocked:/, "")}</li>
                ))}
                {reviewReasons.map((w: string, i: number) => (
                  <li key={i} className="text-amber-500">• {w}</li>
                ))}
              </ul>
              {!isBlocked && reviewReasons.length > 0 && (
                <Button size="sm" className="mt-3" disabled>Approve & launch (gated in campaign UI)</Button>
              )}
            </Card>
          )}
        </>
      ) : null}
    </PageContainer>
  );
}
