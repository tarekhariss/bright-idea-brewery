import { useState, useMemo } from "react";
import { ListChecks, Loader2, Filter, ShieldAlert, Pause, Play, Trash2, RotateCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLinkedinActionQueue, useUpdateQueueAction, useDeleteQueueAction } from "@/hooks/use-linkedin-platform";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";
import { useLinkedinCampaigns } from "@/hooks/use-linkedin-campaigns";
import { ConfigRequiredBanner } from "@/components/config";

const STATUS_OPTIONS = ["pending", "scheduled", "in_progress", "completed", "failed", "blocked", "paused"];
const ACTION_OPTIONS = [
  "view_profile","connect_request","message","follow_up_message","inmail",
  "like_post","comment_post","endorse_skills","withdraw_request","manual_task","wait",
];

const statusColor = (s: string) => {
  switch (s) {
    case "completed": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "in_progress": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
    case "blocked": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    case "paused": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "scheduled": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function LinkedinActionQueuePage() {
  const [status, setStatus] = useState<string>("");
  const [actionType, setActionType] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");

  const { data: accounts } = useLinkedinAccounts();
  const { data: campaigns } = useLinkedinCampaigns();
  const { data: queue, isLoading } = useLinkedinActionQueue({
    status: status || undefined,
    actionType: actionType || undefined,
    accountId: accountId || undefined,
    campaignId: campaignId || undefined,
  });
  const update = useUpdateQueueAction();
  const remove = useDeleteQueueAction();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (queue || []).forEach((q: any) => { c[q.status] = (c[q.status] || 0) + 1; });
    return c;
  }, [queue]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><ListChecks className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Action Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scheduled, pending, and historical LinkedIn actions across all sender profiles.</p>
        </div>
      </div>

      <ConfigRequiredBanner capabilities={["linkedin"]} title="No active LinkedIn account — queue won't drain" />

      <div className="grid grid-cols-7 gap-3">
        {STATUS_OPTIONS.map(s => (
          <Card key={s}><CardContent className="pt-3 pb-3 px-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.replace("_"," ")}</p>
            <p className="text-xl font-semibold mt-0.5">{counts[s] ?? 0}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <div className="border-b p-3 flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={actionType || "all"} onValueChange={(v) => setActionType(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Action type" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All actions</SelectItem>{ACTION_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={accountId || "all"} onValueChange={(v) => setAccountId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Sender profile" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sender profiles</SelectItem>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.profile_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={campaignId || "all"} onValueChange={(v) => setCampaignId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Automation" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All automations</SelectItem>{(campaigns || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">{queue?.length ?? 0} actions</div>
        </div>
        {isLoading ? (
          <div className="p-3 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !queue?.length ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No queued actions match these filters.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Sender</TableHead>
                <TableHead className="text-xs">Automation</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Scheduled</TableHead>
                <TableHead className="text-xs">Retries</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="text-xs font-medium">{q.action_type}</TableCell>
                  <TableCell className="text-xs">{q.contacts ? `${q.contacts.first_name ?? ""} ${q.contacts.last_name ?? ""}`.trim() || "—" : "—"}</TableCell>
                  <TableCell className="text-xs">{q.linkedin_accounts?.profile_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{q.linkedin_campaigns?.name ?? "—"}</TableCell>
                  <TableCell><Badge className={`text-[10px] ${statusColor(q.status)}`}>{q.status}</Badge></TableCell>
                  <TableCell className="text-xs">{q.scheduled_at ? new Date(q.scheduled_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs">{q.retry_count ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {q.status === "paused" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => update.mutate({ id: q.id, status: "pending" })} title="Resume"><Play className="h-3.5 w-3.5" /></Button>
                      ) : ["pending","scheduled"].includes(q.status) ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => update.mutate({ id: q.id, status: "paused" })} title="Pause"><Pause className="h-3.5 w-3.5" /></Button>
                      ) : null}
                      {q.status === "failed" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => update.mutate({ id: q.id, status: "pending", error_message: null })} title="Retry"><RotateCw className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(q.id)} title="Remove">
                        {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
