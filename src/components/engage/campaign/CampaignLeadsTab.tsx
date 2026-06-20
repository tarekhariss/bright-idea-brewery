import { useMemo, useState } from "react";
import {
  Search, MoreHorizontal, Play, Pause, UserPlus, Mail, AtSign,
  Loader2, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCampaignLeads } from "@/hooks/use-campaign-detail";
import { useEnrollContacts, useUpdateEnrollment } from "@/hooks/use-campaign-workflow";
import { useCampaign } from "@/hooks/use-campaigns";
import { useMailboxes } from "@/hooks/use-deliverability";
import { EmailTargetingModeCard } from "./EmailTargetingModeCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Derive a UX-friendly status (sent / opened / replied / completed / pending / stopped)
function deriveLeadStatus(e: any): "pending" | "sent" | "opened" | "replied" | "completed" | "stopped" {
  if (e.status === "stopped") return "stopped";
  if (e.status === "completed") return "completed";
  if (e.status === "replied") return "replied";
  if (e.status === "opened") return "opened";
  // active enrollments that have executed at least one step are "sent"
  if (e.status === "active" && e.last_step_executed_at) return "sent";
  return "pending";
}

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  opened: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  replied: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  completed: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  stopped: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
};

export function CampaignLeadsTab({ campaignId }: { campaignId: string }) {
  const { data: campaign } = useCampaign(campaignId);
  const { data: leads, isLoading } = useCampaignLeads(campaignId);
  const { data: mailboxes } = useMailboxes();
  const enrollContacts = useEnrollContacts();
  const updateEnrollment = useUpdateEnrollment();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollIds, setEnrollIds] = useState("");

  // Resolve a single mailbox label for "email provider" column.
  // If campaign has linked mailboxes, show first; otherwise none.
  const linkedMailbox = useMemo(() => {
    const linkIds = (campaign?.campaign_mailboxes ?? []).map((cm: any) => cm.mailbox_id);
    if (!linkIds.length || !mailboxes) return null;
    return mailboxes.find((m: any) => linkIds.includes(m.id)) ?? null;
  }, [campaign, mailboxes]);

  const enriched = useMemo(() => {
    return (leads ?? []).map((e: any) => ({
      ...e,
      derivedStatus: deriveLeadStatus(e),
    }));
  }, [leads]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enriched.length, pending: 0, sent: 0, opened: 0, replied: 0, completed: 0, stopped: 0 };
    enriched.forEach((e) => { c[e.derivedStatus] = (c[e.derivedStatus] || 0) + 1; });
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((e: any) => {
      if (statusFilter !== "all" && e.derivedStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const c = e.contacts ?? {};
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        const email = (c.email ?? "").toLowerCase();
        const company = (c.companies?.name ?? c.company_name_raw ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !company.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, statusFilter, search]);

  const idList = useMemo(
    () => enrollIds.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean),
    [enrollIds]
  );

  const { data: targetingPreview } = useQuery({
    queryKey: ["targeting-preview", campaignId, idList],
    enabled: enrollOpen && idList.length > 0 && idList.length <= 2000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_campaign_targeting" as any, {
        p_campaign_id: campaignId, p_contact_ids: idList,
      } as any);
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const handleEnroll = async () => {
    if (!idList.length) return;
    await enrollContacts.mutateAsync({ campaignId, contactIds: idList });
    setEnrollOpen(false);
    setEnrollIds("");
  };

  return (
    <div className="space-y-3">
      <EmailTargetingModeCard campaignId={campaignId} />
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-8">
            {[
              { v: "all", label: "All" },
              { v: "pending", label: "Pending" },
              { v: "sent", label: "Sent" },
              { v: "opened", label: "Opened" },
              { v: "replied", label: "Replied" },
              { v: "completed", label: "Completed" },
              { v: "stopped", label: "Stopped" },
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="h-7 gap-1.5 text-xs">
                {t.label}
                <span className="text-[10px] text-muted-foreground">{counts[t.v] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setEnrollOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add Leads
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">
            {search || statusFilter !== "all" ? "No matching leads" : "No leads in this campaign"}
          </p>
          <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Try changing your filters."
              : "Add leads to start the outbound workflow."}
          </p>
          {!search && statusFilter === "all" && (
            <Button size="sm" className="mt-4 h-8 gap-1.5 text-xs" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add Leads
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">Email Provider</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Step</TableHead>
                <TableHead className="text-xs">Last Activity</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e: any) => {
                const c = e.contacts ?? {};
                const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
                const company = c.companies?.name ?? c.company_name_raw ?? "—";
                const stepLabel = e.campaign_steps
                  ? `Step ${e.campaign_steps.step_order}`
                  : "—";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                          {(c.first_name?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
                        </div>
                        <span className="text-xs font-medium">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{company}</TableCell>
                    <TableCell>
                      {linkedMailbox ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <AtSign className="h-3 w-3 text-muted-foreground" />
                          {linkedMailbox.email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] capitalize", statusStyles[e.derivedStatus])}>
                        {e.derivedStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{stepLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.last_step_executed_at
                        ? format(new Date(e.last_step_executed_at), "MMM d, h:mm a")
                        : format(new Date(e.created_at), "MMM d")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PushToCrmButton
                          size="sm"
                          variant="ghost"
                          label="CRM"
                          className="h-7 px-2 text-[11px]"
                          contactId={c.id ?? null}
                          companyId={c.companies?.id ?? null}
                          sourceCampaignId={campaignId}
                          sourceCampaignType="email"
                          sourceChannel="email_reply"
                          defaultStatus={e.derivedStatus === "replied" ? "interested" : "interested"}
                        />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {e.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => updateEnrollment.mutate({ id: e.id, campaignId, status: "active" })}
                            >
                              <Play className="mr-2 h-3.5 w-3.5" /> Activate
                            </DropdownMenuItem>
                          )}
                          {e.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => updateEnrollment.mutate({ id: e.id, campaignId, status: "stopped" })}
                            >
                              <Pause className="mr-2 h-3.5 w-3.5" /> Stop
                            </DropdownMenuItem>
                          )}
                          {e.status === "stopped" && (
                            <DropdownMenuItem
                              onClick={() => updateEnrollment.mutate({ id: e.id, campaignId, status: "active" })}
                            >
                              <Play className="mr-2 h-3.5 w-3.5" /> Resume
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Leads</DialogTitle>
            <DialogDescription className="text-sm">
              Paste contact IDs (one per line, comma or space separated). For visual selection, use Prospect Search → select contacts → Campaign.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Contact IDs</Label>
            <Textarea
              value={enrollIds}
              onChange={(e) => setEnrollIds(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={6}
              placeholder="paste contact UUIDs..."
            />
          </div>
          {targetingPreview && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">Targeting preview · mode: <Badge variant="outline" className="ml-1 text-[10px]">{(targetingPreview as any).mode}</Badge></span>
                <span className="tabular-nums">
                  <span className="text-emerald-500 font-semibold">{(targetingPreview as any).included}</span> included ·
                  <span className="text-rose-500 font-semibold ml-1">{Number((targetingPreview as any).total) - Number((targetingPreview as any).included)}</span> blocked
                </span>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {(["disposable","invalid","bounced","suppressed","unverified","catch_all","risky","unknown"] as const).map(k => {
                  const v = Number((targetingPreview as any)[`blocked_${k}`] ?? 0);
                  if (!v) return null;
                  return <Badge key={k} variant="outline" className="text-[10px]">{k}: {v}</Badge>;
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEnroll} disabled={enrollContacts.isPending}>
              {enrollContacts.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
