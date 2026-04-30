import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Megaphone, Plus, MoreHorizontal, Play, Pause, Archive,
  Loader2, Search, Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign } from "@/hooks/use-campaigns";
import { cn } from "@/lib/utils";

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-muted text-muted-foreground border-border", label: "Draft" },
    active: { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", label: "Active" },
    paused: { cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", label: "Paused" },
    completed: { cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", label: "Completed" },
  };
  const m = map[s] || map.draft;
  return <Badge className={cn("text-[10px] font-medium", m.cls)}>{m.label}</Badge>;
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLimit, setNewLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    return (campaigns ?? []).filter((c: any) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, tab, search]);

  const counts = useMemo(() => {
    const c = { all: campaigns?.length ?? 0, active: 0, paused: 0, draft: 0, completed: 0 };
    (campaigns ?? []).forEach((x: any) => { (c as any)[x.status] = ((c as any)[x.status] || 0) + 1; });
    return c;
  }, [campaigns]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCampaign.mutateAsync({ name: newName.trim(), daily_limit: newLimit });
    setAddOpen(false);
    setNewName("");
    setNewLimit(50);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Campaigns</h1>
            <p className="text-xs text-muted-foreground">Create and manage outbound campaigns</p>
          </div>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Campaign
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b bg-card/50 px-6 py-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 gap-1.5 text-xs">All <span className="text-[10px] text-muted-foreground">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="active" className="h-7 gap-1.5 text-xs">Active <span className="text-[10px] text-muted-foreground">{counts.active}</span></TabsTrigger>
            <TabsTrigger value="paused" className="h-7 gap-1.5 text-xs">Paused <span className="text-[10px] text-muted-foreground">{counts.paused}</span></TabsTrigger>
            <TabsTrigger value="draft" className="h-7 gap-1.5 text-xs">Draft <span className="text-[10px] text-muted-foreground">{counts.draft}</span></TabsTrigger>
            <TabsTrigger value="completed" className="h-7 gap-1.5 text-xs">Completed <span className="text-[10px] text-muted-foreground">{counts.completed}</span></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Megaphone className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-medium">
              {search || tab !== "all" ? "No matching campaigns" : "No campaigns yet"}
            </h3>
            <p className="mt-1.5 max-w-md text-center text-xs text-muted-foreground">
              {search || tab !== "all"
                ? "Try clearing your filters."
                : "Create your first outbound campaign to start reaching prospects at scale."}
            </p>
            {!search && tab === "all" && (
              <Button size="sm" className="mt-5 h-8 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Campaign
              </Button>
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-[180px]">Progress</TableHead>
                  <TableHead className="text-xs text-right">Sent</TableHead>
                  <TableHead className="text-xs text-right">Opens</TableHead>
                  <TableHead className="text-xs text-right">Replies</TableHead>
                  <TableHead className="text-xs text-right">Opportunities</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => {
                  const stats = c.campaign_stats?.[0] ?? {};
                  const sent = stats.emails_sent ?? 0;
                  const total = stats.total_contacts ?? stats.contacts_total ?? 0;
                  const progress = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                  const opportunities = stats.meetings ?? stats.opportunities ?? 0;
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/engage/campaigns/${c.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Megaphone className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.daily_limit}/day limit
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="w-9 text-right text-[10px] text-muted-foreground tabular-nums">
                            {progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{sent.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{(stats.opens ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{(stats.replies ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                          <Target className="h-3 w-3 text-emerald-600" />
                          {opportunities.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {c.status === "draft" && (
                              <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>
                                <Play className="mr-2 h-3.5 w-3.5" /> Activate
                              </DropdownMenuItem>
                            )}
                            {c.status === "active" && (
                              <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "paused" })}>
                                <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                              </DropdownMenuItem>
                            )}
                            {c.status === "paused" && (
                              <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>
                                <Play className="mr-2 h-3.5 w-3.5" /> Resume
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteCampaign.mutate(c.id)}
                            >
                              <Archive className="mr-2 h-3.5 w-3.5" /> Delete
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

      {/* New Campaign Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New Campaign</DialogTitle>
            <DialogDescription className="text-sm">Create a new outbound campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Q1 Outreach"
                className="mt-1 h-9 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Daily Sending Limit</Label>
              <Input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(parseInt(e.target.value) || 50)}
                className="mt-1 h-9 w-32 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
