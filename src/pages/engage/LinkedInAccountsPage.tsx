import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Linkedin, Plus, Trash2, MoreHorizontal, Loader2,
  Wifi, WifiOff, Heart, MessageSquare, UserPlus, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  useLinkedinAccounts, useCreateLinkedinAccount, useUpdateLinkedinAccount, useDeleteLinkedinAccount,
} from "@/hooks/use-linkedin";

export default function LinkedInAccountsPage() {
  const { data: accounts, isLoading } = useLinkedinAccounts();
  const createAccount = useCreateLinkedinAccount();
  const updateAccount = useUpdateLinkedinAccount();
  const deleteAccount = useDeleteLinkedinAccount();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [connectLimit, setConnectLimit] = useState(20);
  const [messageLimit, setMessageLimit] = useState(50);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createAccount.mutateAsync({
      profile_name: name.trim(),
      profile_url: url.trim() || undefined,
      daily_connect_limit: connectLimit,
      daily_message_limit: messageLimit,
    });
    setAddOpen(false);
    setName(""); setUrl(""); setConnectLimit(20); setMessageLimit(50);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <Linkedin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Accounts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage LinkedIn profiles for multichannel outreach.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Account
        </Button>
      </div>

      {/* Summary Cards */}
      {!isLoading && accounts?.length ? (
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Accounts</p>
            <p className="text-2xl font-semibold mt-1">{accounts.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-600">{accounts.filter((a: any) => a.connection_status === "connected").length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connects Today</p>
            <p className="text-2xl font-semibold mt-1">{accounts.reduce((sum: number, a: any) => sum + (a.linkedin_account_health?.[0]?.connects_sent_today || 0), 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Messages Today</p>
            <p className="text-2xl font-semibold mt-1">{accounts.reduce((sum: number, a: any) => sum + (a.linkedin_account_health?.[0]?.messages_sent_today || 0), 0)}</p>
          </CardContent></Card>
        </div>
      ) : null}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !accounts?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Linkedin className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No LinkedIn accounts</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Add LinkedIn profiles to enable multichannel outreach in your campaigns.
            </p>
            <Button size="sm" className="mt-5 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Profile</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Health</TableHead>
                <TableHead className="text-xs">Connects Today</TableHead>
                <TableHead className="text-xs">Messages Today</TableHead>
                <TableHead className="text-xs">Daily Limits</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a: any) => {
                const health = a.linkedin_account_health?.[0];
                const healthScore = health?.health_score ?? 100;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{a.profile_name}</p>
                      {a.profile_url && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{a.profile_url}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${a.connection_status === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                        {a.connection_status === "connected" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                        {a.connection_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={healthScore} className="w-16 h-1.5" />
                        <span className={`text-xs font-medium ${healthScore >= 80 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-600" : "text-destructive"}`}>{healthScore}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{health?.connects_sent_today ?? 0} / {a.daily_connect_limit}</TableCell>
                    <TableCell className="text-xs">{health?.messages_sent_today ?? 0} / {a.daily_message_limit}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <UserPlus className="h-3 w-3 inline mr-0.5" />{a.daily_connect_limit} · <MessageSquare className="h-3 w-3 inline mr-0.5" />{a.daily_message_limit}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateAccount.mutate({
                            id: a.id,
                            connection_status: a.connection_status === "connected" ? "disconnected" : "connected"
                          })}>
                            {a.connection_status === "connected" ? "Disconnect" : "Connect"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteAccount.mutate(a.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add LinkedIn Account</DialogTitle>
            <DialogDescription className="text-sm">Add a LinkedIn profile for campaign outreach.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Profile Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Profile URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://linkedin.com/in/johndoe" className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Daily Connect Limit</Label>
                <Input type="number" value={connectLimit} onChange={(e) => setConnectLimit(parseInt(e.target.value) || 20)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Daily Message Limit</Label>
                <Input type="number" value={messageLimit} onChange={(e) => setMessageLimit(parseInt(e.target.value) || 50)} className="mt-1 h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || createAccount.isPending}>
              {createAccount.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
