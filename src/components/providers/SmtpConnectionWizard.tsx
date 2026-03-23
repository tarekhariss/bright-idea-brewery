import { useState } from "react";
import {
  Server, CheckCircle2, XCircle, Clock, Loader2,
  Plus, Trash2, RefreshCw, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  useProviderConnectionsByType, useCreateProviderConnection,
  useDeleteProviderConnection, useValidateProviderConnection,
} from "@/hooks/use-provider-connections";

const PRESETS: Record<string, { label: string; host: string; port: number }> = {
  mailgun: { label: "Mailgun", host: "smtp.mailgun.org", port: 587 },
  sendgrid: { label: "SendGrid", host: "smtp.sendgrid.net", port: 587 },
  ses: { label: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587 },
  custom: { label: "Custom SMTP", host: "", port: 587 },
};

interface Props { open: boolean; onClose: () => void; }

export function SmtpConnectionWizard({ open, onClose }: Props) {
  const { data: accounts } = useProviderConnectionsByType("smtp");
  const createConn = useCreateProviderConnection();
  const deleteConn = useDeleteProviderConnection();
  const validateConn = useValidateProviderConnection();
  const [addMode, setAddMode] = useState(false);

  const [preset, setPreset] = useState("custom");
  const [providerName, setProviderName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [username, setUsername] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [useTls, setUseTls] = useState(true);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS[key];
    if (p) {
      setSmtpHost(p.host);
      setSmtpPort(p.port);
      setProviderName(p.label);
    }
  };

  const resetForm = () => {
    setPreset("custom"); setProviderName(""); setSmtpHost(""); setSmtpPort(587);
    setUsername(""); setFromEmail(""); setFromName(""); setUseTls(true);
  };

  const handleAdd = async () => {
    if (!smtpHost.trim() || !fromEmail.trim()) {
      toast.error("SMTP host and from email are required");
      return;
    }
    await createConn.mutateAsync({
      workspace_id: "placeholder",
      provider_type: "smtp",
      display_name: providerName.trim() || smtpHost,
      account_email: fromEmail.trim(),
      connection_status: "pending",
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort,
      smtp_username: username.trim() || fromEmail.trim(),
      smtp_secure: useTls,
      from_email: fromEmail.trim(),
      from_name: fromName.trim() || undefined,
      daily_send_limit: 500,
    });
    setAddMode(false);
    resetForm();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      connected: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
      pending: { label: "Pending Test", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      invalid_credentials: { label: "Invalid", cls: "bg-destructive/10 text-destructive" },
      disconnected: { label: "Disconnected", cls: "bg-muted text-muted-foreground" },
    };
    const c = map[status] || map.pending;
    return <Badge className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setAddMode(false); resetForm(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">SMTP Providers</DialogTitle>
              <DialogDescription className="text-sm">Connect Mailgun, SendGrid, Amazon SES, or custom SMTP.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">Passwords stored securely</p>
              <p className="mt-0.5">SMTP passwords should be configured as secrets after adding the connection. The UI captures connection metadata only.</p>
            </div>
          </div>

          {accounts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs">From Email</TableHead>
                  <TableHead className="text-xs">SMTP Host</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Limit</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.display_name}</TableCell>
                    <TableCell className="text-xs">{a.from_email || a.account_email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.smtp_host}:{a.smtp_port}</TableCell>
                    <TableCell>{statusBadge(a.connection_status)}</TableCell>
                    <TableCell className="text-xs">{a.daily_send_limit}/day</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => validateConn.mutate(a.id)} disabled={validateConn.isPending}>
                          <RefreshCw className={`h-3.5 w-3.5 ${validateConn.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteConn.mutate(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !addMode ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No SMTP providers connected yet.</p>
            </div>
          ) : null}

          {addMode ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Add SMTP Provider</p>
                <Select value={preset} onValueChange={applyPreset}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESETS).map(([key, p]) => (
                      <SelectItem key={key} value={key} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Provider Name</Label>
                  <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="My SMTP" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">From Email</Label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="outbound@company.com" className="mt-1 h-8 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">From Name</Label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="John Smith" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="SMTP username" className="mt-1 h-8 text-sm" />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">SMTP Host</Label>
                  <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.provider.com" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)} className="mt-1 h-8 text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Use TLS/SSL</Label>
                  <p className="text-[10px] text-muted-foreground">Recommended for security</p>
                </div>
                <Switch checked={useTls} onCheckedChange={setUseTls} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { setAddMode(false); resetForm(); }}>Cancel</Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={handleAdd} disabled={!smtpHost.trim() || !fromEmail.trim() || createConn.isPending}>
                  {createConn.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Provider
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setAddMode(true)}>
              <Plus className="h-3.5 w-3.5" /> Add SMTP Provider
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
