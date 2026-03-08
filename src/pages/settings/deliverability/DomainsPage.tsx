import { useState } from "react";
import {
  Globe, Plus, CheckCircle2, XCircle, Clock, Shield, Copy,
  MoreHorizontal, ExternalLink, Archive, Loader2, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { useSendingDomains, useCreateDomain, useUpdateDomain, useDeleteDomain } from "@/hooks/use-deliverability";
import type { Database } from "@/integrations/supabase/db-types";

type SendingDomain = Database["public"]["Tables"]["sending_domains"]["Row"];

interface DnsRecord { type: string; host: string; value: string; status: string; }

const dnsIcon = (s: string) => {
  if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
};

const statusBadge = (s: string) => {
  if (s === "verified") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Verified</Badge>;
  if (s === "failed") return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Pending</Badge>;
};

const getDnsRecords = (domain: string, d: SendingDomain): DnsRecord[] => [
  { type: "TXT", host: domain, value: `v=spf1 include:_spf.${domain} ~all`, status: d.spf_status },
  { type: "CNAME", host: `lb._domainkey.${domain}`, value: `lb.dkim.${domain}`, status: d.dkim_status },
  { type: "TXT", host: `_dmarc.${domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`, status: d.dmarc_status },
];

const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

export default function DomainsPage() {
  const { data: domains, isLoading } = useSendingDomains();
  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();
  const deleteDomain = useDeleteDomain();

  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailDomain = domains?.find((d) => d.id === detailId) || null;

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (domains?.some((d) => d.domain_name === clean)) { toast.error("Domain already exists"); return; }
    const d = await createDomain.mutateAsync({ domain_name: clean });
    setAddOpen(false);
    setNewDomain("");
    setDetailId(d.id);
  };

  const handleVerify = (id: string) => {
    // Simulate DNS verification — in prod this would call an edge function
    const rnd = () => Math.random() > 0.3 ? "pass" as const : "pending" as const;
    const spf = rnd(); const dkim = rnd(); const dmarc = rnd();
    const allPass = spf === "pass" && dkim === "pass" && dmarc === "pass";
    updateDomain.mutate({ id, spf_status: spf, dkim_status: dkim, dmarc_status: dmarc, status: allPass ? "verified" : "pending" });
    toast.info("DNS records checked");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Authenticate sending domains with SPF, DKIM, and DMARC.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Domain
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !domains?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Globe className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No domains added</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Add your first sending domain to authenticate emails and improve deliverability.
            </p>
            <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Domain</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-center">SPF</TableHead>
                <TableHead className="text-xs text-center">DKIM</TableHead>
                <TableHead className="text-xs text-center">DMARC</TableHead>
                <TableHead className="text-xs">Warmup</TableHead>
                <TableHead className="text-xs">Daily Limit</TableHead>
                <TableHead className="text-xs">Added</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(d.id)}>
                  <TableCell className="text-sm font-medium">{d.domain_name}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-center">{dnsIcon(d.spf_status)}</TableCell>
                  <TableCell className="text-center">{dnsIcon(d.dkim_status)}</TableCell>
                  <TableCell className="text-center">{dnsIcon(d.dmarc_status)}</TableCell>
                  <TableCell>
                    <Badge variant={d.warmup_enabled ? "default" : "secondary"} className="text-[10px]">
                      {d.warmup_enabled ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.daily_sending_limit}/day</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailId(d.id); }}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleVerify(d.id); }}>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Re-verify DNS
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteDomain.mutate(d.id); }}>
                          <Archive className="h-3.5 w-3.5 mr-2" /> Remove
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

      {/* Add Domain Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Sending Domain</DialogTitle>
            <DialogDescription className="text-sm">Enter the domain you'll send emails from.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Domain Name</Label>
              <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> After adding, configure these DNS records:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>SPF</strong> — Authorize servers to send on your behalf</li>
                <li><strong>DKIM</strong> — Cryptographically sign your emails</li>
                <li><strong>DMARC</strong> — Policy for handling failed authentication</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newDomain.trim() || createDomain.isPending}>
              {createDomain.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base flex-1">{detailDomain?.domain_name}</DialogTitle>
              {detailDomain && statusBadge(detailDomain.status)}
            </div>
            <DialogDescription className="text-sm">Domain configuration, DNS records, and settings</DialogDescription>
          </DialogHeader>
          {detailDomain && (
            <Tabs defaultValue="dns" className="space-y-4">
              <TabsList className="h-8">
                <TabsTrigger value="dns" className="text-xs h-7">DNS Records</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs h-7">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="dns" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Add these records to your domain's DNS configuration.</p>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={() => handleVerify(detailDomain.id)}>
                    <RefreshCw className="h-3 w-3" /> Verify DNS
                  </Button>
                </div>
                <div className="space-y-3">
                  {getDnsRecords(detailDomain.domain_name, detailDomain).map((rec, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {dnsIcon(rec.status)}
                          <Badge variant="secondary" className="text-[10px]">{rec.type}</Badge>
                          <span className="text-xs font-medium">{i === 0 ? "SPF" : i === 1 ? "DKIM" : "DMARC"}</span>
                        </div>
                        <Badge className={`text-[10px] ${rec.status === "pass" ? "bg-emerald-500/10 text-emerald-600" : rec.status === "fail" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                          {rec.status === "pass" ? "Verified" : rec.status === "fail" ? "Failed" : "Pending"}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] w-12 shrink-0 text-muted-foreground">Host</Label>
                          <code className="text-[11px] bg-muted px-2 py-1 rounded flex-1 truncate">{rec.host}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(rec.host)}><Copy className="h-3 w-3" /></Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] w-12 shrink-0 text-muted-foreground">Value</Label>
                          <code className="text-[11px] bg-muted px-2 py-1 rounded flex-1 truncate">{rec.value}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(rec.value)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Warmup</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Gradually increase sending volume</p>
                  </div>
                  <Switch
                    checked={detailDomain.warmup_enabled}
                    onCheckedChange={(v) => updateDomain.mutate({ id: detailDomain.id, warmup_enabled: v })}
                  />
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Daily Sending Limit</Label>
                  <Input
                    type="number" min={1}
                    defaultValue={detailDomain.daily_sending_limit}
                    className="mt-1.5 h-9 text-sm w-32"
                    onBlur={(e) => updateDomain.mutate({ id: detailDomain.id, daily_sending_limit: parseInt(e.target.value) || 50 })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Max emails per day from this domain</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Notes</Label>
                  <Input
                    defaultValue={detailDomain.notes || ""}
                    className="mt-1.5 h-9 text-sm"
                    placeholder="Internal notes..."
                    onBlur={(e) => updateDomain.mutate({ id: detailDomain.id, notes: e.target.value })}
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
    </div>
  );
}
