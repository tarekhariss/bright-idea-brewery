import { useState } from "react";
import {
  Linkedin, CheckCircle2, XCircle, Clock, Loader2,
  Plus, Trash2, RefreshCw, Heart,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  useProviderConnectionsByType, useCreateProviderConnection,
  useDeleteProviderConnection, useValidateProviderConnection,
} from "@/hooks/use-provider-connections";

interface Props { open: boolean; onClose: () => void; }

export function LinkedInConnectionWizard({ open, onClose }: Props) {
  const { data: accounts } = useProviderConnectionsByType("linkedin");
  const createConn = useCreateProviderConnection();
  const deleteConn = useDeleteProviderConnection();
  const validateConn = useValidateProviderConnection();
  const [addMode, setAddMode] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [connectLimit, setConnectLimit] = useState(20);
  const [messageLimit, setMessageLimit] = useState(50);

  const handleAdd = async () => {
    if (!profileName.trim()) return;
    await createConn.mutateAsync({
      workspace_id: "placeholder",
      provider_type: "linkedin",
      display_name: profileName.trim(),
      account_email: profileUrl.trim() || undefined,
      connection_status: "pending",
      daily_send_limit: connectLimit,
      daily_message_limit: messageLimit,
      metadata: { profile_url: profileUrl.trim() },
    });
    setAddMode(false);
    setProfileName("");
    setProfileUrl("");
    setConnectLimit(20);
    setMessageLimit(50);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      connected: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
      pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      disconnected: { label: "Disconnected", cls: "bg-muted text-muted-foreground" },
    };
    const c = map[status] || map.pending;
    return <Badge className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setAddMode(false); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Linkedin className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">LinkedIn Accounts</DialogTitle>
              <DialogDescription className="text-sm">Connect LinkedIn profiles for multichannel campaign outreach.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
            <Heart className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Account Health</p>
              <p className="mt-0.5">LinkedIn accounts are monitored for safety. Automation is not yet active — this is setup mode only.</p>
            </div>
          </div>

          {accounts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Profile</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Health</TableHead>
                  <TableHead className="text-xs">Connect Limit</TableHead>
                  <TableHead className="text-xs">Message Limit</TableHead>
                  <TableHead className="text-xs">Last Validated</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{a.display_name}</p>
                      {a.metadata?.profile_url && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{String(a.metadata.profile_url)}</p>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(a.connection_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={80} className="w-12 h-1.5" />
                        <span className="text-xs font-medium text-emerald-600">80</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{a.daily_send_limit}/day</TableCell>
                    <TableCell className="text-xs">{a.daily_message_limit}/day</TableCell>
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
              <p className="text-sm text-muted-foreground">No LinkedIn accounts connected yet.</p>
            </div>
          ) : null}

          {addMode ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-xs font-semibold">Add LinkedIn Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Profile Name</Label>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="John Doe" className="mt-1 h-9 text-sm" autoFocus />
                </div>
                <div>
                  <Label className="text-xs">Profile URL</Label>
                  <Input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://linkedin.com/in/johndoe" className="mt-1 h-9 text-sm" />
                </div>
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
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setAddMode(false)}>Cancel</Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={handleAdd} disabled={!profileName.trim() || createConn.isPending}>
                  {createConn.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Account
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setAddMode(true)}>
              <Plus className="h-3.5 w-3.5" /> Add LinkedIn Account
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
