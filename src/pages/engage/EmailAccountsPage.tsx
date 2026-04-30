import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AtSign, Plus, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle,
  Activity, Settings as SettingsIcon, Trash2, Pause, Play, Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMailboxes, useDeleteMailbox, useUpdateMailbox } from "@/hooks/use-deliverability";
import { EmailAccountDetailDrawer } from "@/components/engage/EmailAccountDetailDrawer";
import { cn } from "@/lib/utils";

const statusInfo: Record<string, { label: string; icon: any; cls: string }> = {
  active: { label: "Active", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  paused: { label: "Paused", icon: Pause, cls: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  warming: { label: "Warming", icon: Activity, cls: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  error: { label: "Error", icon: XCircle, cls: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  disconnected: { label: "Disconnected", icon: AlertTriangle, cls: "text-muted-foreground bg-muted" },
};

export default function EmailAccountsPage() {
  const navigate = useNavigate();
  const { data: mailboxes, isLoading } = useMailboxes();
  const deleteMailbox = useDeleteMailbox();
  const updateMailbox = useUpdateMailbox();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (mailboxes ?? []).find((m: any) => m.id === selectedId) ?? null;

  const filtered = (mailboxes ?? []).filter((m: any) =>
    !search || m.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totals = (mailboxes ?? []).reduce(
    (acc: any, m: any) => {
      acc.total++;
      const s = m.connection_status || "disconnected";
      acc[s] = (acc[s] || 0) + 1;
      acc.dailyLimit += m.daily_sending_limit || 0;
      return acc;
    },
    { total: 0, dailyLimit: 0 }
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <AtSign className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Email Accounts</h1>
            <p className="text-xs text-muted-foreground">
              Connected mailboxes used for outbound campaigns
            </p>
          </div>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => navigate("/settings/provider-connections")}>
          <Plus className="h-3.5 w-3.5" /> Connect Account
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 border-b bg-card/30 px-6 py-3">
        {[
          { label: "Total Accounts", value: totals.total, icon: AtSign },
          { label: "Active", value: totals.active || 0, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Warming", value: totals.warming || 0, icon: Activity, color: "text-blue-600" },
          { label: "Daily Capacity", value: totals.dailyLimit, icon: Mail },
        ].map((k) => (
          <Card key={k.label} className="flex items-center gap-3 p-3">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-muted", k.color)}>
              <k.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="text-base font-semibold leading-tight">{k.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-card/50 px-6 py-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="h-8 max-w-xs text-xs"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <AtSign className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-medium">No email accounts connected</h3>
            <p className="mt-1.5 max-w-md text-center text-xs text-muted-foreground">
              Connect at least one mailbox to start sending outbound campaigns.
            </p>
            <Button size="sm" className="mt-5 h-8 gap-1.5 text-xs" onClick={() => navigate("/settings/provider-connections")}>
              <Plus className="h-3.5 w-3.5" /> Connect Account
            </Button>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Owner / Tags</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Sent Today</TableHead>
                  <TableHead className="text-xs">Warmup</TableHead>
                  <TableHead className="text-xs">Health</TableHead>
                  <TableHead className="text-xs">Domain</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => {
                  const status = statusInfo[m.connection_status || "disconnected"] || statusInfo.disconnected;
                  const Icon = status.icon;
                  const used = m.emails_sent_today || 0;
                  const limit = m.daily_campaign_limit || m.daily_sending_limit || 100;
                  const pct = Math.min(100, Math.round((used / limit) * 100));
                  const health = m.health_score ?? 100;
                  const tags: string[] = m.tags || [];
                  return (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedId(m.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                            {m.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{m.email}</p>
                            <p className="text-[10px] text-muted-foreground">{m.sender_name || m.from_name || m.display_name || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tags.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : (
                            tags.slice(0, 3).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1 text-[10px]", status.cls)}>
                          <Icon className="h-2.5 w-2.5" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {used}/{limit}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.warmup_enabled ? (
                          <Badge className="gap-1 border-orange-500/20 bg-orange-500/10 text-[10px] text-orange-700">
                            <Activity className="h-2.5 w-2.5" /> {m.warmup_progress ?? 0}%
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Off</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            health >= 80 ? "text-emerald-600" : health >= 50 ? "text-amber-600" : "text-rose-600"
                          )}
                        >
                          {health}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.sending_domains?.domain_name || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.connection_status === "active" ? (
                              <DropdownMenuItem onClick={() => updateMailbox.mutate({ id: m.id, connection_status: "paused" } as any)}>
                                <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateMailbox.mutate({ id: m.id, connection_status: "active" } as any)}>
                                <Play className="mr-2 h-3.5 w-3.5" /> Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setSelectedId(m.id)}>
                              <SettingsIcon className="mr-2 h-3.5 w-3.5" /> Configure
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMailbox.mutate(m.id)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Disconnect
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <EmailAccountDetailDrawer
        mailbox={selected}
        open={!!selectedId}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
      />
    </div>
  );
}
