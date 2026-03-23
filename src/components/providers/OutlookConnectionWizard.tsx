import { useState } from "react";
import {
  Mail, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2,
  Plus, Trash2, RefreshCw, Shield,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  useProviderConnectionsByType, useCreateProviderConnection,
  useDeleteProviderConnection, useValidateProviderConnection,
} from "@/hooks/use-provider-connections";

interface Props { open: boolean; onClose: () => void; }

export function OutlookConnectionWizard({ open, onClose }: Props) {
  const { data: accounts } = useProviderConnectionsByType("microsoft");
  const createConn = useCreateProviderConnection();
  const deleteConn = useDeleteProviderConnection();
  const validateConn = useValidateProviderConnection();
  const [addMode, setAddMode] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleConnect = async () => {
    if (!email.trim()) return;
    toast.info("OAuth flow would start here. Storing connection metadata...");
    await createConn.mutateAsync({
      workspace_id: "placeholder",
      provider_type: "microsoft",
      account_email: email.trim(),
      display_name: displayName.trim() || email.split("@")[0],
      connection_status: "pending",
      oauth_token_status: "none",
      daily_send_limit: 100,
      smtp_host: "smtp.office365.com",
      smtp_port: 587,
      smtp_secure: true,
      imap_host: "outlook.office365.com",
      imap_port: 993,
    });
    setAddMode(false);
    setEmail("");
    setDisplayName("");
  };

  const statusBadge = (status: string) => {
    const configs: Record<string, { label: string; cls: string; Icon: any }> = {
      connected: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", Icon: CheckCircle2 },
      pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", Icon: Clock },
      needs_reauth: { label: "Needs Reauth", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", Icon: AlertTriangle },
      invalid_credentials: { label: "Invalid", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
      disconnected: { label: "Disconnected", cls: "bg-muted text-muted-foreground", Icon: XCircle },
    };
    const c = configs[status] || configs.pending;
    return <Badge className={`text-[10px] gap-1 ${c.cls}`}><c.Icon className="h-2.5 w-2.5" />{c.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Outlook / Microsoft 365</DialogTitle>
              <DialogDescription className="text-sm">Connect Outlook accounts via OAuth for email sending.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">OAuth Connection</p>
              <p className="mt-0.5">When activated, this will use Microsoft OAuth to securely connect your account. Currently in setup mode.</p>
            </div>
          </div>

          {accounts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Token</TableHead>
                  <TableHead className="text-xs">Daily Limit</TableHead>
                  <TableHead className="text-xs">Last Validated</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{a.account_email}</p>
                      {a.display_name && <p className="text-[10px] text-muted-foreground">{a.display_name}</p>}
                    </TableCell>
                    <TableCell>{statusBadge(a.connection_status)}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{a.oauth_token_status || "none"}</Badge></TableCell>
                    <TableCell className="text-xs">{a.daily_send_limit}/day</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.last_validated_at ? new Date(a.last_validated_at).toLocaleDateString() : "Never"}
                    </TableCell>
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
              <p className="text-sm text-muted-foreground">No Outlook accounts connected yet.</p>
            </div>
          ) : null}

          {addMode ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-xs font-semibold">Connect Outlook Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Email Address</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1 h-9 text-sm" autoFocus />
                </div>
                <div>
                  <Label className="text-xs">Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="John Smith" className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setAddMode(false)}>Cancel</Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={handleConnect} disabled={!email.trim() || createConn.isPending}>
                  {createConn.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Connect Account
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setAddMode(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Outlook Account
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
