import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Plus, Loader2, AlertTriangle, Users, MessageSquare, UserPlus, Reply, Calendar, MoreHorizontal, Trash2, Play, Pause } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLinkedinCampaigns, useCreateLinkedinCampaign, useDeleteLinkedinCampaign, useUpdateLinkedinCampaign } from "@/hooks/use-linkedin-campaigns";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";
import { ConfigRequiredBanner } from "@/components/config";

export default function LinkedinCampaignsPage() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useLinkedinCampaigns();
  const { data: accounts } = useLinkedinAccounts();
  const createCampaign = useCreateLinkedinCampaign();
  const updateCampaign = useUpdateLinkedinCampaign();
  const deleteCampaign = useDeleteLinkedinCampaign();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState<string>("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const created = await createCampaign.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      linkedin_account_id: accountId || null,
    });
    setAddOpen(false); setName(""); setDescription(""); setAccountId("");
    navigate(`/linkedin/campaigns/${created.id}`);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      completed: "bg-sky-500/10 text-sky-600 border-sky-500/20",
      archived: "bg-muted text-muted-foreground",
    };
    return <Badge className={`text-[10px] capitalize ${map[status] || ""}`}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Drip-style multi-step LinkedIn outreach campaigns.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Campaign
        </Button>
      </div>

      <ConfigRequiredBanner capabilities={["linkedin"]} title="LinkedIn campaigns can't run yet" />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !campaigns?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No LinkedIn campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Create your first LinkedIn campaign to start building drip-style outreach flows.
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
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs"><Users className="h-3 w-3 inline mr-1" />Leads</TableHead>
                <TableHead className="text-xs"><UserPlus className="h-3 w-3 inline mr-1" />Sent</TableHead>
                <TableHead className="text-xs"><MessageSquare className="h-3 w-3 inline mr-1" />Msgs</TableHead>
                <TableHead className="text-xs"><Reply className="h-3 w-3 inline mr-1" />Replies</TableHead>
                <TableHead className="text-xs"><Calendar className="h-3 w-3 inline mr-1" />Meetings</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/linkedin/campaigns/${c.id}`)}>
                  <TableCell>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.description && <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">{c.description}</p>}
                  </TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-xs">{c.linkedin_accounts?.profile_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs">0</TableCell>
                  <TableCell className="text-xs">0</TableCell>
                  <TableCell className="text-xs">0</TableCell>
                  <TableCell className="text-xs">0</TableCell>
                  <TableCell className="text-xs">0</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status === "active" ? (
                          <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "paused" })}>
                            <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateCampaign.mutate({ id: c.id, status: "active" })}>
                            <Play className="h-3.5 w-3.5 mr-2" /> Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this campaign?")) deleteCampaign.mutate(c.id); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New LinkedIn Campaign</DialogTitle>
            <DialogDescription className="text-sm">Create a campaign — you can build the sequence and add leads next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 SDR Outreach" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="mt-1 text-sm min-h-[60px]" />
            </div>
            <div>
              <Label className="text-xs">LinkedIn Account</Label>
              <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Choose later" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose later</SelectItem>
                  {accounts?.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.profile_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
