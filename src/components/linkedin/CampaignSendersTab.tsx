import { Plus, Trash2, Power, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaignSenders, useAddCampaignSender, useToggleCampaignSender, useRemoveCampaignSender } from "@/hooks/use-linkedin-workflow";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";
import { useState } from "react";

export function CampaignSendersTab({ campaignId }: { campaignId: string }) {
  const { data: senders = [], isLoading } = useCampaignSenders(campaignId);
  const { data: accounts = [] } = useLinkedinAccounts();
  const add = useAddCampaignSender();
  const toggle = useToggleCampaignSender();
  const remove = useRemoveCampaignSender();
  const [pending, setPending] = useState<string>("");

  const usedIds = new Set(senders.map((s: any) => s.linkedin_account_id));
  const available = (accounts as any[]).filter((a) => !usedIds.has(a.id));

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{senders.length} sender profile{senders.length === 1 ? "" : "s"} attached</p>
        <div className="flex gap-2">
          <Select value={pending} onValueChange={setPending}>
            <SelectTrigger className="h-9 w-[260px] text-sm"><SelectValue placeholder="Select a sender profile…" /></SelectTrigger>
            <SelectContent>
              {available.length === 0 && <div className="p-2 text-xs text-muted-foreground">No available profiles</div>}
              {available.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.profile_name || a.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!pending || add.isPending} onClick={async () => { await add.mutateAsync({ campaign_id: campaignId, linkedin_account_id: pending }); setPending(""); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Attach
          </Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : senders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Users className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No senders yet. Attach at least one to launch the campaign.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {senders.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 text-xs font-semibold">
                  {(s.linkedin_accounts?.profile_name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.linkedin_accounts?.profile_name || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.linkedin_accounts?.connection_status === "connected"
                      ? <span className="text-emerald-600">● Connected</span>
                      : <span className="text-amber-600">● {s.linkedin_accounts?.connection_status || "Not connected"}</span>}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{s.is_active ? "Active" : "Paused"}</Badge>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggle.mutate({ id: s.id, campaign_id: campaignId, is_active: v })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate({ id: s.id, campaign_id: campaignId })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
