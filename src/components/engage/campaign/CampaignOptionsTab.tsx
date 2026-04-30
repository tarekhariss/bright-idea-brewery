import { useEffect, useMemo, useState } from "react";
import { AtSign, Settings, Eye, MousePointerClick, Zap, Reply, Save, Loader2, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useMailboxes } from "@/hooks/use-deliverability";
import { useLinkCampaignMailbox, useUnlinkCampaignMailbox } from "@/hooks/use-campaign-detail";

export function CampaignOptionsTab({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: mailboxes } = useMailboxes();
  const update = useUpdateCampaign();
  const linkMailbox = useLinkCampaignMailbox();
  const unlinkMailbox = useUnlinkCampaignMailbox();

  // Local form state
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnAutoReply, setStopOnAutoReply] = useState(true);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [stopOnClick, setStopOnClick] = useState(false);
  const [deliveryOptimization, setDeliveryOptimization] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [maxNewLeadsPerDay, setMaxNewLeadsPerDay] = useState(30);
  const [minWaitMinutes, setMinWaitMinutes] = useState(3);
  const [randomWaitMinutes, setRandomWaitMinutes] = useState(5);
  const [replyTo, setReplyTo] = useState("");
  const [bcc, setBcc] = useState("");
  const [addMailboxId, setAddMailboxId] = useState("");

  useEffect(() => {
    if (!campaign) return;
    const c: any = campaign;
    setStopOnReply(c.stop_on_reply ?? true);
    setStopOnAutoReply(c.stop_on_auto_reply ?? true);
    setTrackOpens(c.track_opens ?? true);
    setTrackClicks(c.track_clicks ?? true);
    setStopOnClick(c.stop_on_click ?? false);
    setDeliveryOptimization(c.delivery_optimization ?? true);
    setDailyLimit(c.daily_limit ?? 50);
    setMaxNewLeadsPerDay(c.max_new_leads_per_day ?? 30);
    setMinWaitMinutes(c.min_wait_minutes ?? 3);
    setRandomWaitMinutes(c.random_wait_minutes ?? 5);
    setReplyTo(c.reply_to ?? "");
    setBcc(c.bcc ?? "");
  }, [campaign]);

  const linkedIds = useMemo(
    () => (campaign?.campaign_mailboxes ?? []).map((cm: any) => cm.mailbox_id),
    [campaign]
  );
  const linkedMailboxes = useMemo(
    () => (mailboxes ?? []).filter((m: any) => linkedIds.includes(m.id)),
    [mailboxes, linkedIds]
  );
  const availableMailboxes = useMemo(
    () => (mailboxes ?? []).filter((m: any) => !linkedIds.includes(m.id)),
    [mailboxes, linkedIds]
  );

  const dirty = useMemo(() => {
    if (!campaign) return false;
    const c: any = campaign;
    return (
      (c.stop_on_reply ?? true) !== stopOnReply ||
      (c.stop_on_auto_reply ?? true) !== stopOnAutoReply ||
      (c.track_opens ?? true) !== trackOpens ||
      (c.track_clicks ?? true) !== trackClicks ||
      (c.stop_on_click ?? false) !== stopOnClick ||
      (c.delivery_optimization ?? true) !== deliveryOptimization ||
      (c.daily_limit ?? 50) !== dailyLimit ||
      (c.max_new_leads_per_day ?? 30) !== maxNewLeadsPerDay ||
      (c.min_wait_minutes ?? 3) !== minWaitMinutes ||
      (c.random_wait_minutes ?? 5) !== randomWaitMinutes ||
      (c.reply_to ?? "") !== replyTo ||
      (c.bcc ?? "") !== bcc
    );
  }, [campaign, stopOnReply, stopOnAutoReply, trackOpens, trackClicks, stopOnClick, deliveryOptimization, dailyLimit, maxNewLeadsPerDay, minWaitMinutes, randomWaitMinutes, replyTo, bcc]);

  const handleSave = () => {
    update.mutate({
      id: campaignId,
      stop_on_reply: stopOnReply,
      stop_on_auto_reply: stopOnAutoReply,
      track_opens: trackOpens,
      track_clicks: trackClicks,
      stop_on_click: stopOnClick,
      delivery_optimization: deliveryOptimization,
      daily_limit: dailyLimit,
      max_new_leads_per_day: maxNewLeadsPerDay,
      min_wait_minutes: minWaitMinutes,
      random_wait_minutes: randomWaitMinutes,
      reply_to: replyTo || null,
      bcc: bcc || null,
    } as any);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const ToggleRow = ({
    icon: Icon, label, description, value, onChange,
  }: { icon: any; label: string; description: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Email Accounts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold">Email Accounts</h3>
              <p className="text-[11px] text-muted-foreground">
                Mailboxes that will rotate while sending this campaign.
              </p>
            </div>
          </div>
        </div>

        {linkedMailboxes.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No mailboxes linked. Add one below to enable sending.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {linkedMailboxes.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {m.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{m.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.provider_type ?? "smtp"} · {m.daily_sending_limit ?? 100}/day
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {m.connection_status ?? "—"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => unlinkMailbox.mutate({ campaignId, mailboxId: m.id })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {availableMailboxes.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Select value={addMailboxId} onValueChange={setAddMailboxId}>
              <SelectTrigger className="h-8 max-w-xs text-xs"><SelectValue placeholder="Add mailbox..." /></SelectTrigger>
              <SelectContent>
                {availableMailboxes.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={!addMailboxId || linkMailbox.isPending}
              onClick={() => {
                linkMailbox.mutate({ campaignId, mailboxId: addMailboxId });
                setAddMailboxId("");
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Link
            </Button>
          </div>
        )}
      </Card>

      {/* Behavior */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Behavior</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Reply}
            label="Stop on reply"
            description="Pause sending to a lead when they reply."
            value={stopOnReply}
            onChange={setStopOnReply}
          />
          <ToggleRow
            icon={Reply}
            label="Stop on auto-reply"
            description="Treat out-of-office and bounce auto-replies as a stop signal."
            value={stopOnAutoReply}
            onChange={setStopOnAutoReply}
          />
          <ToggleRow
            icon={MousePointerClick}
            label="Stop on click"
            description="Pause sending when a lead clicks any link."
            value={stopOnClick}
            onChange={setStopOnClick}
          />
        </div>
      </Card>

      {/* Tracking */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Tracking</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Eye}
            label="Open tracking"
            description="Insert a 1×1 pixel to detect email opens."
            value={trackOpens}
            onChange={setTrackOpens}
          />
          <ToggleRow
            icon={MousePointerClick}
            label="Link click tracking"
            description="Rewrite links to track clicks per recipient."
            value={trackClicks}
            onChange={setTrackClicks}
          />
        </div>
      </Card>

      {/* Delivery */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Delivery & Limits</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Zap}
            label="Delivery optimization"
            description="Spread sends across mailboxes and add jitter for better deliverability."
            value={deliveryOptimization}
            onChange={setDeliveryOptimization}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Daily Sending Limit</Label>
            <Input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Max New Leads / Day</Label>
            <Input
              type="number"
              value={maxNewLeadsPerDay}
              onChange={(e) => setMaxNewLeadsPerDay(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Min Wait (minutes)</Label>
            <Input
              type="number"
              value={minWaitMinutes}
              onChange={(e) => setMinWaitMinutes(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Random Wait (minutes)</Label>
            <Input
              type="number"
              value={randomWaitMinutes}
              onChange={(e) => setRandomWaitMinutes(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Reply-to / BCC */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Headers</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Reply-To Email (optional)</Label>
            <Input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="replies@yourdomain.com"
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">BCC (optional)</Label>
            <Input
              type="email"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="crm@yourdomain.com"
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t bg-background/80 px-1 py-2 backdrop-blur">
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button size="sm" onClick={handleSave} disabled={!dirty || update.isPending} className="h-8 gap-1.5 text-xs">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Options
        </Button>
      </div>
    </div>
  );
}
