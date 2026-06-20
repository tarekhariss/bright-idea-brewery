/**
 * Campaign email-targeting mode card (Phase 1A — intelligence_v2).
 * Lets users choose Strict / Balanced / Aggressive. The DB trigger enforces
 * the rule server-side so the UI is informational + persistent only.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, Save } from "lucide-react";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";

const MODES = [
  { value: "strict",     label: "Strict",     desc: "Only valid emails.",                              Icon: ShieldCheck, tone: "text-emerald-500" },
  { value: "balanced",   label: "Balanced",   desc: "Valid and verified catch-all.",                   Icon: ShieldAlert, tone: "text-amber-500" },
  { value: "aggressive", label: "Aggressive", desc: "Valid, catch-all, risky and unknown (high risk).", Icon: AlertTriangle, tone: "text-rose-500" },
];

const BLOCK_LIST = ["invalid", "bounced", "suppressed", "unverified", "disposable"];

export function EmailTargetingModeCard({ campaignId }: { campaignId: string }) {
  const { data: campaign } = useCampaign(campaignId);
  const update = useUpdateCampaign();
  const current = (campaign as any)?.email_targeting_mode ?? "strict";
  const [mode, setMode] = useState<string>(current);
  useEffect(() => { setMode(current); }, [current]);

  const dirty = mode !== current;
  const meta = MODES.find(m => m.value === mode)!;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <meta.Icon className={`h-4 w-4 ${meta.tone}`} />
            <h3 className="text-sm font-semibold">Email targeting guardrails</h3>
            <Badge variant="outline" className="text-[10px]">Intelligence v2</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enforced server-side at enrollment. Contacts that don't match the mode are blocked from this campaign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>
                  <div className="flex items-center gap-2">
                    <m.Icon className={`h-3.5 w-3.5 ${m.tone}`} />
                    <span>{m.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dirty && (
            <Button size="sm" className="h-8" disabled={update.isPending} onClick={() => update.mutate({ id: campaignId, email_targeting_mode: mode } as any)}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Save</>}
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{meta.desc}</div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Always blocked:</span>
        {BLOCK_LIST.map(b => (
          <Badge key={b} variant="outline" className="text-[10px] bg-rose-500/5 text-rose-500 border-rose-500/30">{b}</Badge>
        ))}
      </div>
    </Card>
  );
}
