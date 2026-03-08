import { useState } from "react";
import {
  Inbox, Plus, CheckCircle2, XCircle, Clock, Mail,
  MoreHorizontal, ExternalLink, Power, Loader2, Link,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface Mailbox {
  id: string;
  email: string;
  provider: "google" | "microsoft" | "smtp" | "other";
  domain: string;
  status: "active" | "disconnected" | "warming";
  warmup_status: "active" | "paused" | "complete" | "off";
  sending_health: "good" | "warning" | "poor" | "unknown";
  connected_at: string;
  created_at: string;
}

const providerLabel: Record<string, string> = { google: "Google", microsoft: "Microsoft", smtp: "SMTP/IMAP", other: "Other" };

const statusBadge = (s: string) => {
  if (s === "active") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>;
  if (s === "warming") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warming</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Disconnected</Badge>;
};

const healthBadge = (h: string) => {
  if (h === "good") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Good</Badge>;
  if (h === "warning") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warning</Badge>;
  if (h === "poor") return <Badge variant="destructive" className="text-[10px]">Poor</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Unknown</Badge>;
};

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "link">("manual");
  const [newEmail, setNewEmail] = useState("");
  const [newProvider, setNewProvider] = useState<string>("smtp");
  const [adding, setAdding] = useState(false);
  const [detailMb, setDetailMb] = useState<Mailbox | null>(null);

  const handleAdd = () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    const parts = newEmail.split("@");
    const mb: Mailbox = {
      id: crypto.randomUUID(),
      email: newEmail.trim().toLowerCase(),
      provider: newProvider as any,
      domain: parts[1] || "",
      status: "active",
      warmup_status: "off",
      sending_health: "unknown",
      connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setMailboxes((prev) => [...prev, mb]);
      setAddOpen(false);
      setNewEmail("");
      setNewProvider("smtp");
      setAdding(false);
    }, 600);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mailboxes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Connect and manage mailboxes for outbound email sending.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setAddMode("link"); setAddOpen(true); }}>
            <Link className="h-3.5 w-3.5" /> Link Mailbox
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setAddMode("manual"); setAddOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Mailbox
          </Button>
        </div>
      </div>

      {mailboxes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No mailboxes connected</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Connect your first mailbox to start sending emails through sequences and manual outreach.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <Button size="sm" className="text-xs gap-1.5" onClick={() => { setAddMode("manual"); setAddOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add Mailbox
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { setAddMode("link"); setAddOpen(true); }}>
                <Link className="h-3.5 w-3.5" /> Link via OAuth
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mailbox</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">Domain</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Warmup</TableHead>
                <TableHead className="text-xs">Sending Health</TableHead>
                <TableHead className="text-xs">Connected</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mb) => (
                <TableRow key={mb.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailMb(mb)}>
                  <TableCell className="text-sm font-medium">{mb.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{providerLabel[mb.provider]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{mb.domain}</TableCell>
                  <TableCell>{statusBadge(mb.status)}</TableCell>
                  <TableCell>
                    <Badge variant={mb.warmup_status !== "off" ? "default" : "secondary"} className="text-[10px] capitalize">
                      {mb.warmup_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{healthBadge(mb.sending_health)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(mb.connected_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailMb(mb); }}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => {
                          e.stopPropagation();
                          setMailboxes((p) => p.map((x) => x.id === mb.id ? { ...x, status: "disconnected" as const } : x));
                        }}>
                          <Power className="h-3.5 w-3.5 mr-2" /> Disable
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

      {/* Add Mailbox Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{addMode === "link" ? "Link Mailbox" : "Add Mailbox"}</DialogTitle>
            <DialogDescription className="text-sm">
              {addMode === "link"
                ? "Connect your Google or Microsoft mailbox with OAuth."
                : "Connect a mailbox via SMTP/IMAP credentials."}
            </DialogDescription>
          </DialogHeader>
          {addMode === "link" ? (
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 text-sm">
                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold">G</div>
                Connect Google Workspace
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12 text-sm">
                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold">M</div>
                Connect Microsoft 365
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">OAuth connection will be configured in a future update.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Email Address</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@company.com" className="mt-1 h-9 text-sm" autoFocus />
              </div>
              <div>
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP/IMAP</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="microsoft">Microsoft</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">SMTP credentials will be configured in settings after adding the mailbox.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            {addMode === "manual" && (
              <Button size="sm" onClick={handleAdd} disabled={!newEmail.trim() || adding}>
                {adding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Add Mailbox
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailMb} onOpenChange={() => setDetailMb(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{detailMb?.email}</DialogTitle>
            <DialogDescription className="text-sm">Mailbox configuration and health</DialogDescription>
          </DialogHeader>
          {detailMb && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Provider</p>
                  <p className="text-sm font-medium mt-0.5">{providerLabel[detailMb.provider]}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Domain</p>
                  <p className="text-sm font-medium mt-0.5">{detailMb.domain}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                  <div className="mt-1">{statusBadge(detailMb.status)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sending Health</p>
                  <div className="mt-1">{healthBadge(detailMb.sending_health)}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailMb(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
