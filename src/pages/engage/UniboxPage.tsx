import { useState, useMemo } from "react";
import {
  Inbox, Search, User, Star, Archive, Reply, Send, Loader2,
  CheckCircle2, Clock, MailOpen, Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInboxThreads } from "@/hooks/use-outbound-config";
import { useMailboxes } from "@/hooks/use-deliverability";
import { useCampaigns } from "@/hooks/use-campaigns";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const statusColor: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  snoozed: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export default function UniboxPage() {
  const { data: threads, isLoading } = useInboxThreads();
  const { data: mailboxes } = useMailboxes();
  const { data: campaigns } = useCampaigns();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [mailboxFilter, setMailboxFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const filtered = useMemo(() => {
    return (threads ?? []).filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (mailboxFilter !== "all" && t.mailbox_id !== mailboxFilter) return false;
      if (campaignFilter !== "all" && t.campaign_id !== campaignFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.toLowerCase();
        const subj = (t.subject ?? "").toLowerCase();
        if (!name.includes(q) && !subj.includes(q)) return false;
      }
      return true;
    });
  }, [threads, statusFilter, mailboxFilter, campaignFilter, search]);

  const selected = useMemo(
    () => filtered.find((t: any) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const counts = useMemo(() => {
    const c = { open: 0, snoozed: 0, closed: 0, all: threads?.length ?? 0 };
    (threads ?? []).forEach((t: any) => {
      if (t.status === "open") c.open++;
      else if (t.status === "snoozed") c.snoozed++;
      else if (t.status === "closed" || t.status === "archived") c.closed++;
    });
    return c;
  }, [threads]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Unibox</h1>
            <p className="text-xs text-muted-foreground">
              Unified inbox across all campaigns and email accounts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            {counts.open} open
          </Badge>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b bg-card/50 px-6 py-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={mailboxFilter} onValueChange={setMailboxFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All mailboxes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mailboxes</SelectItem>
            {(mailboxes ?? []).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {(campaigns ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body: 3-pane */}
      <div className="flex flex-1 min-h-0">
        {/* Status rail */}
        <div className="w-44 shrink-0 border-r bg-card/30 p-2">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} orientation="vertical">
            <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 bg-transparent p-0">
              {[
                { v: "open", label: "Open", icon: MailOpen, count: counts.open },
                { v: "snoozed", label: "Snoozed", icon: Clock, count: counts.snoozed },
                { v: "closed", label: "Closed", icon: CheckCircle2, count: counts.closed },
                { v: "all", label: "All", icon: Filter, count: counts.all },
              ].map((it) => (
                <TabsTrigger
                  key={it.v}
                  value={it.v}
                  className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <it.icon className="h-3.5 w-3.5" />
                    {it.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{it.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Thread list */}
        <div className="w-[340px] shrink-0 overflow-y-auto border-r bg-background">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <Inbox className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Replies from your campaigns will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((t: any) => {
                const isActive = selected?.id === t.id;
                const name = `${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.trim() || t.contacts?.email || "Unknown";
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                      isActive && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium">{name}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {t.last_message_at ? formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false }) : "—"}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{t.subject || "No subject"}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0", statusColor[t.status])}>{t.status}</Badge>
                        {t.message_count > 0 && (
                          <span className="text-[10px] text-muted-foreground">{t.message_count} msg</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Conversation panel */}
        <div className="flex flex-1 flex-col bg-muted/20">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b bg-card px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {`${selected.contacts?.first_name ?? ""} ${selected.contacts?.last_name ?? ""}`.trim() || "Unknown"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.contacts?.email ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Star className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Clock className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Archive className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium">{selected.subject || "No subject"}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {selected.last_message_at ? format(new Date(selected.last_message_at), "MMM d, yyyy h:mm a") : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Conversation timeline will appear here once message sync is enabled. This is a structural placeholder for the unified inbox.
                  </p>
                </Card>
              </div>

              <div className="border-t bg-card p-4">
                <div className="rounded-md border bg-background">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-[80px] resize-none border-0 text-sm focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between border-t px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">
                      Sending will be enabled when mailboxes are connected.
                    </p>
                    <Button size="sm" disabled className="h-8 gap-1.5 text-xs">
                      <Send className="h-3 w-3" /> Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
