import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Megaphone, Plus, MoreHorizontal, Play, Pause, Archive,
  Mail, Users, BarChart3, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign } from "@/hooks/use-campaigns";

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-muted text-muted-foreground", label: "Draft" },
    active: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Active" },
    paused: { cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Paused" },
    completed: { cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Completed" },
  };
  const m = map[s] || map.draft;
  return <Badge className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
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

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCampaign.mutateAsync({ name: newName.trim(), daily_limit: newLimit });
    setAddOpen(false);
    setNewName("");
    setNewLimit(50);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and manage outbound email campaigns.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !campaigns?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Create your first outbound campaign to start reaching prospects at scale.
            </p>
            <Button size="sm" className="mt-5 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Campaign</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Daily Limit</TableHead>
                <TableHead className="text-xs">Sent</TableHead>
                <TableHead className="text-xs">Replies</TableHead>
                <TableHead className="text-xs">Meetings</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const stats = c.campaign_stats?.[0];
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.description && <p className="text-[10px] text-muted-foreground">{c.description}</p>}
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs">{c.daily_limit}/day</TableCell>
                    <TableCell className="text-xs">{stats?.emails_sent ?? 0}</TableCell>
                    <TableCell className="text-xs">{stats?.replies ?? 0}</TableCell>
                    <TableCell className="text-xs">{stats?.meetings ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.status === "draft" && (
                            <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Activate
                            </DropdownMenuItem>
                          )}
                          {c.status === "active" && (
                            <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "paused" })}>
                              <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                            </DropdownMenuItem>
                          )}
                          {c.status === "paused" && (
                            <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteCampaign.mutate(c.id)}>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Delete
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New Campaign</DialogTitle>
            <DialogDescription className="text-sm">Create a new outbound campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Q1 Outreach" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Daily Sending Limit</Label>
              <Input type="number" value={newLimit} onChange={(e) => setNewLimit(parseInt(e.target.value) || 50)} className="mt-1 h-9 text-sm w-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
