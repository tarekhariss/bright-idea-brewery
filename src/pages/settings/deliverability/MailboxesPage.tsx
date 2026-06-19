import { useState } from "react";
import {
  Inbox, Plus, CheckCircle2, Mail, Shield, Send,
  MoreHorizontal, ExternalLink, Power, Loader2, RefreshCw,
  Server, Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useMailboxes, useCreateMailbox, useUpdateMailbox, useDeleteMailbox,
  useSendingDomains,
} from "@/hooks/use-deliverability";
import { useCheckReadiness, useSendTestEmail, useQueueHealth, useProcessQueue } from "@/hooks/use-email-admin";

const providerLabel: Record<string, string> = { google: "Google Workspace", microsoft: "Microsoft 365", smtp: "SMTP/IMAP", other: "Other" };
const providerIcon: Record<string, string> = { google: "G", microsoft: "M", smtp: "S", other: "?" };

const statusBadge = (s: string) => {
  if (s === "active") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>;
  if (s === "warming") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warming</Badge>;
  if (s === "error") return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Disconnected</Badge>;
};

const healthBadge = (h: string) => {
  if (h === "good") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Good</Badge>;
  if (h === "warning") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warning</Badge>;
  if (h === "poor") return <Badge variant="destructive" className="text-[10px]">Poor</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Unknown</Badge>;
};

const SMTP_PRESETS: Record<string, { host: string; port: number; imap_host: string; imap_port: number }> = {
  google: { host: "smtp.gmail.com", port: 587, imap_host: "imap.gmail.com", imap_port: 993 },
  microsoft: { host: "smtp.office365.com", port: 587, imap_host: "outlook.office365.com", imap_port: 993 },
  smtp: { host: "", port: 587, imap_host: "", imap_port: 993 },
  other: { host: "", port: 587, imap_host: "", imap_port: 993 },
};

export default function MailboxesPage() {
  const { data: mailboxes, isLoading } = useMailboxes();
  const { data: domains } = useSendingDomains();
  const createMailbox = useCreateMailbox();
  const updateMailbox = useUpdateMailbox();
  const deleteMailbox = useDeleteMailbox();

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const detailMb = mailboxes?.find((m) => m.id === detailId) || null;

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newProvider, setNewProvider] = useState("smtp");
  const [newSmtpHost, setNewSmtpHost] = useState("");
  const [newSmtpPort, setNewSmtpPort] = useState(587);
  const [newSmtpUser, setNewSmtpUser] = useState("");
  const [newImapHost, setNewImapHost] = useState("");
  const [newImapPort, setNewImapPort] = useState(993);
  const [newUseTls, setNewUseTls] = useState(true);
  const [newDomainId, setNewDomainId] = useState("");

  const applyPreset = (provider: string) => {
    setNewProvider(provider);
    const p = SMTP_PRESETS[provider] || SMTP_PRESETS.smtp;
    setNewSmtpHost(p.host);
    setNewSmtpPort(p.port);
    setNewImapHost(p.imap_host);
    setNewImapPort(p.imap_port);
  };

  const resetForm = () => {
    setNewEmail(""); setNewDisplayName(""); setNewProvider("smtp");
    setNewSmtpHost(""); setNewSmtpPort(587); setNewSmtpUser("");
    setNewImapHost(""); setNewImapPort(993); setNewUseTls(true); setNewDomainId("");
  };

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    if (!newSmtpHost.trim()) { toast.error("SMTP host is required"); return; }
    await createMailbox.mutateAsync({
      email: newEmail.trim().toLowerCase(),
      display_name: newDisplayName.trim() || newEmail.split("@")[0],
      provider_type: newProvider as any,
      domain_id: newDomainId || null,
      smtp_host: newSmtpHost.trim(),
      smtp_port: newSmtpPort,
      smtp_username: newSmtpUser.trim() || newEmail.trim().toLowerCase(),
      smtp_secure: newUseTls,
      imap_host: newImapHost.trim() || null,
      imap_port: newImapPort,
      imap_username: newSmtpUser.trim() || newEmail.trim().toLowerCase(),
      imap_secure: newUseTls,
      connection_status: "active",
    });
    setAddOpen(false);
    resetForm();
  };

  const checkReadiness = useCheckReadiness();
  const sendTestEmail = useSendTestEmail();
  const queueHealth = useQueueHealth();
  const processQueue = useProcessQueue();
  const [readinessData, setReadinessData] = useState<any>(null);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState<string | null>(null);

  const testConnection = async (id: string) => {
    toast.info("Checking mailbox readiness...");
    const data = await checkReadiness.mutateAsync(id);
    setReadinessData(data);
    if (data.ready) {
      updateMailbox.mutate({ id, connection_status: "active", sending_health: "good", last_checked_at: new Date().toISOString() });
      toast.success("Mailbox ready ✓");
    } else {
      toast.warning("Mailbox has issues — check readiness details");
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <ConfigRequiredBanner capabilities={["domains"]} title="Add a sending domain before connecting mailboxes" />
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
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Mailbox
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !mailboxes?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No mailboxes connected</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Connect your first mailbox via SMTP to start sending through sequences and manual outreach.
            </p>
            <Button size="sm" className="mt-5 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Mailbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mailbox</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Warmup</TableHead>
                <TableHead className="text-xs">Health</TableHead>
                <TableHead className="text-xs">Sent Today</TableHead>
                <TableHead className="text-xs">Limit</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mb) => (
                <TableRow key={mb.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(mb.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                        {providerIcon[mb.provider_type]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{mb.email}</p>
                        {mb.display_name && <p className="text-[10px] text-muted-foreground">{mb.display_name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{providerLabel[mb.provider_type]}</TableCell>
                  <TableCell>{statusBadge(mb.connection_status)}</TableCell>
                  <TableCell>
                    <Badge variant={mb.warmup_enabled ? "default" : "secondary"} className="text-[10px] capitalize">
                      {mb.warmup_enabled ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell>{healthBadge(mb.sending_health)}</TableCell>
                  <TableCell className="text-xs">{mb.emails_sent_today}</TableCell>
                  <TableCell className="text-xs">{mb.daily_sending_limit}/day</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailId(mb.id); }}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); testConnection(mb.id); }}>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Test Connection
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMailbox.mutate(mb.id); }}>
                          <Power className="h-3.5 w-3.5 mr-2" /> Remove
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
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Add Mailbox</DialogTitle>
            <DialogDescription className="text-sm">Connect a mailbox via SMTP/IMAP to send and track emails.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email Address</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@company.com" className="mt-1 h-9 text-sm" autoFocus />
              </div>
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="John Smith" className="mt-1 h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={applyPreset}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Workspace</SelectItem>
                    <SelectItem value="microsoft">Microsoft 365</SelectItem>
                    <SelectItem value="smtp">Custom SMTP/IMAP</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Linked Domain</Label>
                <Select value={newDomainId} onValueChange={setNewDomainId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {domains?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.domain_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-3"><Server className="h-3.5 w-3.5" /> SMTP Configuration (Outgoing)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">SMTP Host</Label>
                  <Input value={newSmtpHost} onChange={(e) => setNewSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={newSmtpPort} onChange={(e) => setNewSmtpPort(parseInt(e.target.value) || 587)} className="mt-1 h-8 text-sm" />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">SMTP Username</Label>
                <Input value={newSmtpUser} onChange={(e) => setNewSmtpUser(e.target.value)} placeholder="your@email.com" className="mt-1 h-8 text-sm" />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-3"><Mail className="h-3.5 w-3.5" /> IMAP Configuration (Reply Tracking)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">IMAP Host</Label>
                  <Input value={newImapHost} onChange={(e) => setNewImapHost(e.target.value)} placeholder="imap.gmail.com" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={newImapPort} onChange={(e) => setNewImapPort(parseInt(e.target.value) || 993)} className="mt-1 h-8 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Use TLS/SSL</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Encrypt connection (recommended)</p>
              </div>
              <Switch checked={newUseTls} onCheckedChange={setNewUseTls} />
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-medium">SMTP passwords are stored securely</p>
                <p className="mt-0.5 text-amber-700">
                  Passwords/app passwords should be configured as Supabase secrets (not stored in database columns). 
                  The UI captures connection metadata only. Configure <code>SMTP_PASS_[mailbox_id]</code> as a secret after adding.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newEmail.trim() || !newSmtpHost.trim() || createMailbox.isPending}>
              {createMailbox.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Connect Mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mailbox Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                {providerIcon[detailMb?.provider_type || "smtp"]}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base">{detailMb?.email}</DialogTitle>
                <DialogDescription className="text-sm">{providerLabel[detailMb?.provider_type || "smtp"]} — {detailMb?.display_name}</DialogDescription>
              </div>
              {detailMb && statusBadge(detailMb.connection_status)}
            </div>
          </DialogHeader>
          {detailMb && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="h-8">
                <TabsTrigger value="overview" className="text-xs h-7">Overview</TabsTrigger>
                <TabsTrigger value="smtp" className="text-xs h-7">SMTP/IMAP</TabsTrigger>
                <TabsTrigger value="warmup" className="text-xs h-7">Warmup</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs h-7">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-semibold">{detailMb.emails_sent_today}</p>
                    <p className="text-[10px] text-muted-foreground">Sent Today</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-semibold">{detailMb.daily_sending_limit}</p>
                    <p className="text-[10px] text-muted-foreground">Daily Limit</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="mt-0.5">{statusBadge(detailMb.connection_status)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Connection</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="mt-0.5">{healthBadge(detailMb.sending_health)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Health</p>
                  </div>
                </div>
                {detailMb.last_checked_at && (
                  <p className="text-[10px] text-muted-foreground">Last checked: {format(new Date(detailMb.last_checked_at), "MMM d, yyyy HH:mm")}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => testConnection(detailMb.id)}>
                    <RefreshCw className="h-3 w-3" /> Check Readiness
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setTestDialogOpen(detailMb.id)}>
                    <Mail className="h-3 w-3" /> Send Test Email
                  </Button>
                </div>

                {readinessData && (
                  <div className="rounded-lg border p-3 space-y-2 mt-3">
                    <div className="flex items-center gap-2">
                      {readinessData.ready ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-xs font-medium">{readinessData.ready ? "Ready to send" : "Issues found"}</span>
                    </div>
                    {readinessData.issues?.length > 0 && (
                      <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        {readinessData.issues.map((issue: string, i: number) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <span className="text-muted-foreground">Sent today: {readinessData.sent_today ?? 0}</span>
                      <span className="text-muted-foreground">Limit: {readinessData.daily_limit ?? 0}</span>
                    </div>
                  </div>
                )}

                {/* Queue Health Summary */}
                {queueHealth.data && (
                  <div className="rounded-lg bg-muted/50 p-3 mt-3">
                    <p className="text-xs font-medium mb-2">Email Queue Health</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-sm font-semibold">{queueHealth.data.pending}</p>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{queueHealth.data.processing}</p>
                        <p className="text-[10px] text-muted-foreground">Processing</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{queueHealth.data.failed}</p>
                        <p className="text-[10px] text-muted-foreground">Failed</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{queueHealth.data.completed}</p>
                        <p className="text-[10px] text-muted-foreground">Completed</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 mt-2 w-full" onClick={() => processQueue.mutate()} disabled={processQueue.isPending}>
                      {processQueue.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Process Queue Now
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="smtp" className="space-y-4">
                <p className="text-xs font-semibold">SMTP (Outgoing)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Host</p>
                    <p className="text-sm font-medium">{detailMb.smtp_host || "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Port</p>
                    <p className="text-sm font-medium">{detailMb.smtp_port}</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Username</p>
                  <p className="text-sm font-medium">{detailMb.smtp_username || "—"}</p>
                </div>
                <Separator />
                <p className="text-xs font-semibold">IMAP (Reply Tracking)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Host</p>
                    <p className="text-sm font-medium">{detailMb.imap_host || "Not configured"}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Port</p>
                    <p className="text-sm font-medium">{detailMb.imap_port}</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">TLS/SSL</p>
                  <p className="text-sm font-medium">{detailMb.smtp_secure ? "Enabled" : "Disabled"}</p>
                </div>
              </TabsContent>

              <TabsContent value="warmup" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Enable Warmup</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Gradually ramp sending volume to build reputation</p>
                  </div>
                  <Switch
                    checked={detailMb.warmup_enabled}
                    onCheckedChange={(v) => updateMailbox.mutate({ id: detailMb.id, warmup_enabled: v, warmup_progress: v ? 0 : detailMb.warmup_progress })}
                  />
                </div>
                {detailMb.warmup_enabled && (
                  <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{detailMb.warmup_progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${detailMb.warmup_progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Full ramp-up typically takes 2-4 weeks.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Daily Sending Limit</Label>
                  <Input
                    type="number" min={1}
                    defaultValue={detailMb.daily_sending_limit}
                    className="mt-1.5 h-9 text-sm w-32"
                    onBlur={(e) => updateMailbox.mutate({ id: detailMb.id, daily_sending_limit: parseInt(e.target.value) || 50 })}
                  />
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Display Name</Label>
                  <Input
                    defaultValue={detailMb.display_name || ""}
                    className="mt-1.5 h-9 text-sm"
                    onBlur={(e) => updateMailbox.mutate({ id: detailMb.id, display_name: e.target.value })}
                  />
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Linked Domain</Label>
                  <Select
                    defaultValue={detailMb.domain_id || ""}
                    onValueChange={(v) => updateMailbox.mutate({ id: detailMb.id, domain_id: v || null })}
                  >
                    <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {domains?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.domain_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Notes</Label>
                  <Textarea
                    defaultValue={detailMb.notes || ""}
                    className="mt-1.5 text-sm" rows={2}
                    placeholder="Internal notes..."
                    onBlur={(e) => updateMailbox.mutate({ id: detailMb.id, notes: e.target.value })}
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={!!testDialogOpen} onOpenChange={() => { setTestDialogOpen(null); setTestEmailAddr(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Send Test Email</DialogTitle>
            <DialogDescription className="text-sm">Send a test email to verify this mailbox can deliver messages.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Recipient Email</Label>
            <Input
              value={testEmailAddr}
              onChange={(e) => setTestEmailAddr(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 h-9 text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setTestDialogOpen(null); setTestEmailAddr(""); }}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (testDialogOpen && testEmailAddr.trim()) {
                  sendTestEmail.mutate({ mailboxId: testDialogOpen, toAddress: testEmailAddr.trim() });
                  setTestDialogOpen(null);
                  setTestEmailAddr("");
                }
              }}
              disabled={!testEmailAddr.trim() || sendTestEmail.isPending}
            >
              {sendTestEmail.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
