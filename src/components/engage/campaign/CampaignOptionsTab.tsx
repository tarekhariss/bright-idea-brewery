import { useEffect, useMemo, useState } from "react";
import {
  AtSign, Settings, Eye, MousePointerClick, Zap, Reply, Save, Loader2, Plus, X,
  Tag as TagIcon, User, Shuffle, Building2, ShieldAlert, Mail, Server, Sparkles, Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useMailboxes } from "@/hooks/use-deliverability";
import {
  useLinkCampaignMailbox, useUnlinkCampaignMailbox,
  useCampaignTags, useWorkspaceTags, useAddCampaignTag, useRemoveCampaignTag,
  useWorkspaceMembers, useEspRoutingRules,
} from "@/hooks/use-campaign-detail";

const AB_METRICS = [
  { value: "reply_rate", label: "Reply rate" },
  { value: "open_rate", label: "Open rate" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "positive_reply", label: "Positive reply" },
];

export function CampaignOptionsTab({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: mailboxes } = useMailboxes();
  const { data: campaignTags } = useCampaignTags(campaignId);
  const { data: workspaceTags } = useWorkspaceTags();
  const { data: members } = useWorkspaceMembers();
  const { data: espRules } = useEspRoutingRules();
  const update = useUpdateCampaign();
  const linkMailbox = useLinkCampaignMailbox();
  const unlinkMailbox = useUnlinkCampaignMailbox();
  const addTag = useAddCampaignTag();
  const removeTag = useRemoveCampaignTag();

  // ─── Form state ───
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnAutoReply, setStopOnAutoReply] = useState(false);
  const [stopCompanyOnReply, setStopCompanyOnReply] = useState(false);
  const [stopOnClick, setStopOnClick] = useState(false);

  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [deliveryOptimization, setDeliveryOptimization] = useState(true);

  const [dailyLimit, setDailyLimit] = useState(50);
  const [maxNewLeadsPerDay, setMaxNewLeadsPerDay] = useState(30);
  const [minWaitMinutes, setMinWaitMinutes] = useState(3);
  const [randomWaitMinutes, setRandomWaitMinutes] = useState(5);
  const [prioritizeNewLeads, setPrioritizeNewLeads] = useState(true);

  const [autoOptimizeAb, setAutoOptimizeAb] = useState(false);
  const [abMetric, setAbMetric] = useState("reply_rate");

  const [providerMatching, setProviderMatching] = useState(false);
  const [useEspRouting, setUseEspRouting] = useState(false);

  const [insertUnsubHeader, setInsertUnsubHeader] = useState(true);
  const [allowRiskyEmails, setAllowRiskyEmails] = useState(false);

  const [ownerId, setOwnerId] = useState<string>("");
  const [replyTo, setReplyTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showHeaders, setShowHeaders] = useState(false);

  const [limitPerCompany, setLimitPerCompany] = useState(false);
  const [maxPerCompanyPerDay, setMaxPerCompanyPerDay] = useState(1);
  const [overrideDomainLimiter, setOverrideDomainLimiter] = useState(false);
  const [campaignDomainLimit, setCampaignDomainLimit] = useState<number | "">("");

  const [addMailboxId, setAddMailboxId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [pickTagId, setPickTagId] = useState("");

  useEffect(() => {
    if (!campaign) return;
    const c: any = campaign;
    setStopOnReply(c.stop_on_reply ?? true);
    setStopOnAutoReply(c.stop_on_auto_reply ?? false);
    setStopCompanyOnReply(c.stop_company_on_reply ?? false);
    setStopOnClick(c.stop_on_click ?? false);
    setTrackOpens(c.track_opens ?? true);
    setTrackClicks(c.track_clicks ?? true);
    setDeliveryOptimization(c.delivery_optimization ?? true);
    setDailyLimit(c.daily_limit ?? 50);
    setMaxNewLeadsPerDay(c.max_new_leads_per_day ?? 30);
    setMinWaitMinutes(c.min_wait_minutes ?? 3);
    setRandomWaitMinutes(c.random_wait_minutes ?? 5);
    setPrioritizeNewLeads(c.prioritize_new_leads ?? true);
    setAutoOptimizeAb(c.auto_optimize_ab ?? false);
    setAbMetric(c.ab_winning_metric ?? "reply_rate");
    setProviderMatching(c.provider_matching ?? false);
    setUseEspRouting(c.use_esp_routing ?? false);
    setInsertUnsubHeader(c.insert_unsubscribe_header ?? true);
    setAllowRiskyEmails(c.allow_risky_emails ?? false);
    setOwnerId(c.owner_id ?? "");
    setReplyTo(c.reply_to ?? "");
    setCc(c.cc ?? "");
    setBcc(c.bcc ?? "");
    setLimitPerCompany(c.limit_emails_per_company ?? false);
    setMaxPerCompanyPerDay(c.max_emails_per_company_per_day ?? 1);
    setOverrideDomainLimiter(c.override_domain_limiter ?? false);
    setCampaignDomainLimit(c.campaign_domain_limit ?? "");
    if (c.cc || c.bcc || c.reply_to) setShowHeaders(true);
  }, [campaign]);

  // Delivery optimization disables open tracking
  useEffect(() => {
    if (deliveryOptimization && trackOpens) setTrackOpens(false);
  }, [deliveryOptimization]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkedIds: string[] = useMemo(
    () => ((campaign as any)?.campaign_mailboxes ?? []).map((cm: any) => cm.mailbox_id),
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
      (c.stop_on_auto_reply ?? false) !== stopOnAutoReply ||
      (c.stop_company_on_reply ?? false) !== stopCompanyOnReply ||
      (c.stop_on_click ?? false) !== stopOnClick ||
      (c.track_opens ?? true) !== trackOpens ||
      (c.track_clicks ?? true) !== trackClicks ||
      (c.delivery_optimization ?? true) !== deliveryOptimization ||
      (c.daily_limit ?? 50) !== dailyLimit ||
      (c.max_new_leads_per_day ?? 30) !== maxNewLeadsPerDay ||
      (c.min_wait_minutes ?? 3) !== minWaitMinutes ||
      (c.random_wait_minutes ?? 5) !== randomWaitMinutes ||
      (c.prioritize_new_leads ?? true) !== prioritizeNewLeads ||
      (c.auto_optimize_ab ?? false) !== autoOptimizeAb ||
      (c.ab_winning_metric ?? "reply_rate") !== abMetric ||
      (c.provider_matching ?? false) !== providerMatching ||
      (c.use_esp_routing ?? false) !== useEspRouting ||
      (c.insert_unsubscribe_header ?? true) !== insertUnsubHeader ||
      (c.allow_risky_emails ?? false) !== allowRiskyEmails ||
      (c.owner_id ?? "") !== ownerId ||
      (c.reply_to ?? "") !== replyTo ||
      (c.cc ?? "") !== cc ||
      (c.bcc ?? "") !== bcc ||
      (c.limit_emails_per_company ?? false) !== limitPerCompany ||
      (c.max_emails_per_company_per_day ?? 1) !== maxPerCompanyPerDay ||
      (c.override_domain_limiter ?? false) !== overrideDomainLimiter ||
      (c.campaign_domain_limit ?? "") !== campaignDomainLimit
    );
  }, [
    campaign, stopOnReply, stopOnAutoReply, stopCompanyOnReply, stopOnClick,
    trackOpens, trackClicks, deliveryOptimization, dailyLimit, maxNewLeadsPerDay,
    minWaitMinutes, randomWaitMinutes, prioritizeNewLeads, autoOptimizeAb, abMetric,
    providerMatching, useEspRouting, insertUnsubHeader, allowRiskyEmails, ownerId,
    replyTo, cc, bcc, limitPerCompany, maxPerCompanyPerDay, overrideDomainLimiter, campaignDomainLimit,
  ]);

  const handleSave = () => {
    update.mutate({
      id: campaignId,
      stop_on_reply: stopOnReply,
      stop_on_auto_reply: stopOnAutoReply,
      stop_company_on_reply: stopCompanyOnReply,
      stop_on_click: stopOnClick,
      track_opens: trackOpens,
      track_clicks: trackClicks,
      delivery_optimization: deliveryOptimization,
      daily_limit: dailyLimit,
      max_new_leads_per_day: maxNewLeadsPerDay,
      min_wait_minutes: minWaitMinutes,
      random_wait_minutes: randomWaitMinutes,
      prioritize_new_leads: prioritizeNewLeads,
      auto_optimize_ab: autoOptimizeAb,
      ab_winning_metric: abMetric,
      provider_matching: providerMatching,
      use_esp_routing: useEspRouting,
      insert_unsubscribe_header: insertUnsubHeader,
      allow_risky_emails: allowRiskyEmails,
      owner_id: ownerId || null,
      reply_to: replyTo || null,
      cc: cc || null,
      bcc: bcc || null,
      limit_emails_per_company: limitPerCompany,
      max_emails_per_company_per_day: maxPerCompanyPerDay,
      override_domain_limiter: overrideDomainLimiter,
      campaign_domain_limit: campaignDomainLimit === "" ? null : Number(campaignDomainLimit),
    } as any);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const ToggleRow = ({
    icon: Icon, label, description, value, onChange, disabled, badge,
  }: {
    icon: any; label: string; description: string;
    value: boolean; onChange: (v: boolean) => void;
    disabled?: boolean; badge?: string;
  }) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium">{label}</p>
            {badge && <Badge variant="outline" className="h-4 px-1 text-[9px]">{badge}</Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );

  const PendingNote = ({ text }: { text: string }) => (
    <div className="mt-2 flex items-start gap-1.5 rounded-md border border-dashed bg-muted/30 px-2.5 py-1.5">
      <Lock className="mt-0.5 h-3 w-3 text-muted-foreground" />
      <p className="text-[10px] text-muted-foreground">{text}</p>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Email Accounts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold">Accounts to use</h3>
              <p className="text-[11px] text-muted-foreground">
                Mailboxes that will rotate while sending this campaign.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">{linkedMailboxes.length} linked</Badge>
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
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
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
              size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
              disabled={!addMailboxId || linkMailbox.isPending}
              onClick={() => { linkMailbox.mutate({ campaignId, mailboxId: addMailboxId }); setAddMailboxId(""); }}
            >
              <Plus className="h-3.5 w-3.5" /> Link
            </Button>
          </div>
        )}
      </Card>

      {/* Owner & Tags */}
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">CRM Owner</h3>
            </div>
            <Select value={ownerId || "none"} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(members ?? []).map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profiles?.full_name || m.profiles?.email || m.user_id} · {m.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Owner is responsible for replies, attribution, and reporting.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Custom Tags</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(campaignTags ?? []).map((ct: any) => (
                <Badge key={ct.tag_id} variant="secondary" className="gap-1 text-[10px]">
                  {ct.tags?.name}
                  <button
                    onClick={() => removeTag.mutate({ campaignId, tagId: ct.tag_id })}
                    className="ml-0.5 rounded-sm hover:bg-background/50"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {(!campaignTags || campaignTags.length === 0) && (
                <p className="text-[11px] text-muted-foreground">No tags.</p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Select value={pickTagId} onValueChange={(v) => {
                setPickTagId("");
                addTag.mutate({ campaignId, tagId: v });
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add existing tag..." /></SelectTrigger>
                <SelectContent>
                  {(workspaceTags ?? [])
                    .filter((t: any) => !(campaignTags ?? []).some((ct: any) => ct.tag_id === t.id))
                    .map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag"
                className="h-8 max-w-[140px] text-xs"
              />
              <Button
                size="sm" variant="outline" className="h-8 px-2 text-xs"
                disabled={!newTagName.trim() || addTag.isPending}
                onClick={() => { addTag.mutate({ campaignId, newName: newTagName.trim() }); setNewTagName(""); }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Behavior / Stop conditions */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Reply className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Stop conditions</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Reply}
            label="Stop sending on reply"
            description="Pause sending to a lead when they reply."
            value={stopOnReply}
            onChange={setStopOnReply}
          />
          <ToggleRow
            icon={Mail}
            label="Stop on auto-reply"
            description="Treat out-of-office and auto-replies as a stop signal."
            value={stopOnAutoReply}
            onChange={setStopOnAutoReply}
          />
          <ToggleRow
            icon={Building2}
            label="Stop campaign for company on reply"
            description="If anyone at a company replies, stop sending to all leads at that company."
            value={stopCompanyOnReply}
            onChange={setStopCompanyOnReply}
          />
          <ToggleRow
            icon={MousePointerClick}
            label="Stop on click"
            description="Pause sending when a lead clicks any link."
            value={stopOnClick}
            onChange={setStopOnClick}
            disabled={!trackClicks}
            badge={!trackClicks ? "Needs link tracking" : undefined}
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
            value={trackOpens && !deliveryOptimization}
            onChange={setTrackOpens}
            disabled={deliveryOptimization}
            badge={deliveryOptimization ? "Disabled by Delivery Optimization" : undefined}
          />
          <ToggleRow
            icon={MousePointerClick}
            label="Link tracking"
            description="Rewrite links to track clicks per recipient."
            value={trackClicks}
            onChange={setTrackClicks}
          />
          <ToggleRow
            icon={Zap}
            label="Delivery Optimization"
            description="Maximize inbox placement. Automatically disables open tracking."
            value={deliveryOptimization}
            onChange={(v) => { setDeliveryOptimization(v); if (v) setTrackOpens(false); }}
          />
        </div>
        <PendingNote text="Tracking pixels and link rewriting will activate once a verified sending domain is configured." />
      </Card>

      {/* Sending pattern */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sending pattern</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Daily Limit (campaign)</Label>
            <Input type="number" min={0} value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Max new leads per day</Label>
            <Input type="number" min={0} value={maxNewLeadsPerDay}
              onChange={(e) => setMaxNewLeadsPerDay(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Min time gap between emails (min)</Label>
            <Input type="number" min={0} value={minWaitMinutes}
              onChange={(e) => setMinWaitMinutes(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Random additional time (min)</Label>
            <Input type="number" min={0} value={randomWaitMinutes}
              onChange={(e) => setRandomWaitMinutes(parseInt(e.target.value) || 0)}
              className="mt-1 h-9 text-sm" />
          </div>
        </div>
        <Separator className="my-3" />
        <ToggleRow
          icon={Sparkles}
          label="Prioritize new leads"
          description="Send to fresh leads first before continuing follow-up steps."
          value={prioritizeNewLeads}
          onChange={setPrioritizeNewLeads}
        />
      </Card>

      {/* A/Z Testing */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Auto-optimize A/Z testing</h3>
        </div>
        <ToggleRow
          icon={Sparkles}
          label="Enable auto-optimization"
          description="Automatically shift volume to the winning variant."
          value={autoOptimizeAb}
          onChange={setAutoOptimizeAb}
        />
        <div className="mt-2">
          <Label className="text-xs">Winning metric</Label>
          <Select value={abMetric} onValueChange={setAbMetric} disabled={!autoOptimizeAb}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AB_METRICS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PendingNote text="Variant rotation will activate once multi-variant sequences are enabled." />
      </Card>

      {/* Provider matching & ESP routing */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Provider matching & ESP routing</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Server}
            label="Provider matching"
            description="Prefer sending mailboxes whose provider matches the recipient's (Google → Google, Microsoft → Microsoft)."
            value={providerMatching}
            onChange={setProviderMatching}
          />
          <ToggleRow
            icon={Server}
            label="Use ESP routing rules"
            description={`Use the workspace's ESP routing table (${(espRules ?? []).length} active rules) to pick the best mailbox.`}
            value={useEspRouting}
            onChange={setUseEspRouting}
          />
        </div>
        {(espRules ?? []).length === 0 && useEspRouting && (
          <PendingNote text="No ESP routing rules configured for this workspace yet. Add rules in Deliverability → ESP Routing." />
        )}
      </Card>

      {/* Safety & deliverability */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Safety & advanced deliverability</h3>
        </div>
        <div className="divide-y">
          <ToggleRow
            icon={Mail}
            label="Insert unsubscribe link header"
            description="Add the List-Unsubscribe header. Strongly recommended for inbox placement."
            value={insertUnsubHeader}
            onChange={setInsertUnsubHeader}
          />
          <ToggleRow
            icon={ShieldAlert}
            label="Allow risky emails"
            description="Send to addresses flagged as catch-all, role-based, or unverified."
            value={allowRiskyEmails}
            onChange={setAllowRiskyEmails}
          />
          <ToggleRow
            icon={Building2}
            label="Limit emails per company"
            description="Cap how many emails this campaign sends to leads at the same company per day."
            value={limitPerCompany}
            onChange={setLimitPerCompany}
          />
        </div>
        {limitPerCompany && (
          <div className="mt-2 max-w-xs">
            <Label className="text-xs">Max emails per company / day</Label>
            <Input type="number" min={1} value={maxPerCompanyPerDay}
              onChange={(e) => setMaxPerCompanyPerDay(parseInt(e.target.value) || 1)}
              className="mt-1 h-9 text-sm" />
          </div>
        )}
        <Separator className="my-3" />
        <ToggleRow
          icon={Server}
          label="Override workspace domain limiter"
          description="Use a campaign-specific recipient-domain daily cap instead of the workspace default."
          value={overrideDomainLimiter}
          onChange={setOverrideDomainLimiter}
        />
        {overrideDomainLimiter && (
          <div className="mt-2 max-w-xs">
            <Label className="text-xs">Per recipient-domain limit / day</Label>
            <Input type="number" min={0} value={campaignDomainLimit}
              onChange={(e) => setCampaignDomainLimit(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
              placeholder="e.g. 25"
              className="mt-1 h-9 text-sm" />
          </div>
        )}
      </Card>

      {/* Headers */}
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setShowHeaders((s) => !s)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">CC / BCC / Reply-To</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">{showHeaders ? "Hide" : "Expand"}</span>
        </button>
        {showHeaders && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">Reply-To</Label>
              <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)}
                placeholder="replies@yourdomain.com" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CC</Label>
              <Input type="email" value={cc} onChange={(e) => setCc(e.target.value)}
                placeholder="manager@yourdomain.com" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">BCC</Label>
              <Input type="email" value={bcc} onChange={(e) => setBcc(e.target.value)}
                placeholder="crm@yourdomain.com" className="mt-1 h-9 text-sm" />
            </div>
          </div>
        )}
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
