import { useState, useMemo } from "react";
import {
  Inbox, Search, Star, Archive, Send, CheckCircle2, Clock, MailOpen, Filter, Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useMailboxes } from "@/hooks/use-deliverability";
import { useCampaigns } from "@/hooks/use-campaigns";
import {
  useInboxThreads, useInboxThreadMessages,
  useUpdateThreadCategory, useUpdateThreadStatus,
  CATEGORY_META, PRIMARY_CATEGORIES, type ReplyCategory,
} from "@/hooks/use-inbox-classification";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const statusColor: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  snoozed: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export default function UniboxPage() {
  const [view, setView] = useState<"primary" | "others">("primary");
  const { data: threads, isLoading } = useInboxThreads(view);
  const { data: mailboxes } = useMailboxes();
  const { data: campaigns } = useCampaigns();
  const updateCategory = useUpdateThreadCategory();
  const updateStatus = useUpdateThreadStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<ReplyCategory | "all">("all");
  const [mailboxFilter, setMailboxFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const filtered = useMemo(() => {
    return (threads ?? []).filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (mailboxFilter !== "all" && t.mailbox_id !== mailboxFilter) return false;
      if (campaignFilter !== "all" && t.campaign_id !== campaignFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.toLowerCase();
        const subj = (t.subject ?? "").toLowerCase();
        const email = (t.contacts?.email ?? "").toLowerCase();
        if (!name.includes(q) && !subj.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [threads, statusFilter, categoryFilter, mailboxFilter, campaignFilter, search]);

  const selected = useMemo(
    () => filtered.find((t: any) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );
  const { data: messages } = useInboxThreadMessages(selected?.id ?? null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, snoozed: 0, closed: 0, all: threads?.length ?? 0 };
    (threads ?? []).forEach((t: any) => {
      if (t.status === "open") c.open++;
      else if (t.status === "snoozed") c.snoozed++;
      else if (t.status === "closed" || t.status === "archived") c.closed++;
    });
    return c;
  }, [threads]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    (threads ?? []).forEach((t: any) => { c[t.category] = (c[t.category] ?? 0) + 1; });
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
              Smart reply classification for outbound campaigns
            </p>
          </div>
        </div>
        <Tabs value={view} onValueChange={(v) => { setView(v as any); setSelectedId(null); setCategoryFilter("all"); }}>
          <TabsList className="h-8">
            <TabsTrigger value="primary" className="h-7 text-xs">Primary</TabsTrigger>
            <TabsTrigger value="others" className="h-7 text-xs">Others</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card/50 px-6 py-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={mailboxFilter} onValueChange={setMailboxFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="All mailboxes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mailboxes</SelectItem>
            {(mailboxes ?? []).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view === "primary" && (
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="All campaigns" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {(campaigns ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Category chips (Primary view only) */}
      {view === "primary" && (
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-card/30 px-6 py-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
              categoryFilter === "all" ? "bg-foreground text-background" : "bg-card hover:bg-muted"
            )}
          >
            All <span className="ml-1 opacity-70">{threads?.length ?? 0}</span>
          </button>
          {PRIMARY_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                categoryFilter === c ? CATEGORY_META[c].tone : "bg-card hover:bg-muted text-muted-foreground"
              )}
            >
              {CATEGORY_META[c].label} <span className="ml-1 opacity-70">{categoryCounts[c] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Body: 3-pane */}
      <div className="flex min-h-0 flex-1">
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
        <div className="w-[360px] shrink-0 overflow-y-auto border-r bg-background">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <Inbox className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {view === "primary"
                  ? "Replies from your campaign leads will appear here."
                  : "Bounces, newsletters and non-campaign mail land here."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((t: any) => {
                const isActive = selected?.id === t.id;
                const name = `${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.trim()
                  || t.contacts?.email || "Unknown";
                const cat = (t.category ?? "unknown") as ReplyCategory;
                const meta = CATEGORY_META[cat];
                const isManual = t.classification_source === "manual";
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
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge className={cn("h-4 border px-1.5 text-[9px] font-medium", meta.tone)}>
                          {meta.label}{isManual && " ✦"}
                        </Badge>
                        {t.campaigns?.name && (
                          <span className="truncate text-[10px] text-muted-foreground">· {t.campaigns.name}</span>
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {`${selected.contacts?.first_name ?? ""} ${selected.contacts?.last_name ?? ""}`.trim() || selected.contacts?.email || "Unknown"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selected.contacts?.email ?? "—"}
                    {selected.contacts?.company_name_raw && <> · {selected.contacts.company_name_raw}</>}
                    {selected.campaigns?.name && <> · Campaign: {selected.campaigns.name}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Manual classification override */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        <Tag className="h-3 w-3" />
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px]", CATEGORY_META[(selected.category ?? "unknown") as ReplyCategory].tone)}>
                          {CATEGORY_META[(selected.category ?? "unknown") as ReplyCategory].label}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Set classification
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(Object.keys(CATEGORY_META) as ReplyCategory[]).map((c) => (
                        <DropdownMenuItem
                          key={c}
                          onClick={() => updateCategory.mutate({ threadId: selected.id, category: c })}
                          className="text-xs"
                        >
                          <span className={cn("mr-2 h-2 w-2 rounded-full", CATEGORY_META[c].tone)} />
                          {CATEGORY_META[c].label}
                          {selected.category === c && <CheckCircle2 className="ml-auto h-3 w-3" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Status actions */}
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    title={selected.status === "snoozed" ? "Unsnooze" : "Snooze"}
                    onClick={() => updateStatus.mutate({ threadId: selected.id, status: selected.status === "snoozed" ? "open" : "snoozed" })}
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    title={selected.status === "closed" ? "Reopen" : "Close"}
                    onClick={() => updateStatus.mutate({ threadId: selected.id, status: selected.status === "closed" ? "open" : "closed" })}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Star">
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 border-b bg-card/40 px-5 py-1.5 text-[10px] text-muted-foreground">
                <Badge className={cn("h-4 px-1.5 text-[9px]", statusColor[selected.status])}>{selected.status}</Badge>
                <span>
                  Source: <span className="font-medium capitalize">{selected.classification_source}</span>
                </span>
                {selected.classification_confidence != null && (
                  <span>· Confidence: {(Number(selected.classification_confidence) * 100).toFixed(0)}%</span>
                )}
                {selected.classified_at && (
                  <span>· Classified {formatDistanceToNow(new Date(selected.classified_at), { addSuffix: true })}</span>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(messages ?? []).length === 0 ? (
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">
                      No messages synced yet. Once mailbox sync is connected, the full conversation timeline will appear here.
                    </p>
                  </Card>
                ) : (
                  (messages ?? []).map((m: any) => (
                    <Card
                      key={m.id}
                      className={cn(
                        "p-4",
                        m.direction === "outbound" && "ml-12 bg-primary/5"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] capitalize">{m.direction}</Badge>
                          <p className="text-xs font-medium">{m.from_address || "—"}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {m.timestamp ? format(new Date(m.timestamp), "MMM d, h:mm a") : "—"}
                        </span>
                      </div>
                      {m.subject && <p className="mb-1 text-xs font-medium">{m.subject}</p>}
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {m.body_text || (m.body_html ? "(HTML message)" : "(no body)")}
                      </p>
                    </Card>
                  ))
                )}
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
                      Sending will be enabled when mailbox sync is active.
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
