import { useState } from "react";
import {
  Globe, Plus, CheckCircle2, XCircle, Clock, Shield,
  MoreHorizontal, ExternalLink, Archive, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

interface Domain {
  id: string;
  name: string;
  status: "pending" | "verified" | "failed";
  spf: "pass" | "fail" | "pending";
  dkim: "pass" | "fail" | "pending";
  dmarc: "pass" | "fail" | "pending";
  warmup_enabled: boolean;
  daily_limit: number;
  created_at: string;
}

const dnsStatusIcon = (s: string) => {
  if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
};

const statusBadge = (s: string) => {
  if (s === "verified") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Verified</Badge>;
  if (s === "failed") return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [detailDomain, setDetailDomain] = useState<Domain | null>(null);

  const handleAdd = () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    const d: Domain = {
      id: crypto.randomUUID(),
      name: newDomain.trim().toLowerCase(),
      status: "pending",
      spf: "pending",
      dkim: "pending",
      dmarc: "pending",
      warmup_enabled: false,
      daily_limit: 50,
      created_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setDomains((prev) => [...prev, d]);
      setAddOpen(false);
      setNewDomain("");
      setAdding(false);
    }, 600);
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

      {domains.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Globe className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No domains added</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Add your first sending domain to authenticate emails and improve deliverability across all outreach.
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
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailDomain(d)}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-center">{dnsStatusIcon(d.spf)}</TableCell>
                  <TableCell className="text-center">{dnsStatusIcon(d.dkim)}</TableCell>
                  <TableCell className="text-center">{dnsStatusIcon(d.dmarc)}</TableCell>
                  <TableCell>
                    <Badge variant={d.warmup_enabled ? "default" : "secondary"} className="text-[10px]">
                      {d.warmup_enabled ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.daily_limit}/day</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(d.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailDomain(d); }}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDomains((p) => p.filter((x) => x.id !== d.id)); }}>
                          <Archive className="h-3.5 w-3.5 mr-2" /> Archive
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
            <DialogTitle className="text-base">Add Domain</DialogTitle>
            <DialogDescription className="text-sm">Enter the domain you want to authenticate for sending.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Domain Name</Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="mt-1 h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium">After adding, you'll need to:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Add SPF record to your DNS</li>
                <li>Add DKIM record to your DNS</li>
                <li>Configure DMARC policy</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newDomain.trim() || adding}>
              {adding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Detail Dialog */}
      <Dialog open={!!detailDomain} onOpenChange={() => setDetailDomain(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{detailDomain?.name}</DialogTitle>
            <DialogDescription className="text-sm">Domain configuration and DNS status</DialogDescription>
          </DialogHeader>
          {detailDomain && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  {dnsStatusIcon(detailDomain.spf)}
                  <span className="text-xs font-medium">SPF</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  {dnsStatusIcon(detailDomain.dkim)}
                  <span className="text-xs font-medium">DKIM</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  {dnsStatusIcon(detailDomain.dmarc)}
                  <span className="text-xs font-medium">DMARC</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Warmup</Label>
                  <Switch checked={detailDomain.warmup_enabled} onCheckedChange={(v) => {
                    setDomains((p) => p.map((d) => d.id === detailDomain.id ? { ...d, warmup_enabled: v } : d));
                    setDetailDomain((p) => p ? { ...p, warmup_enabled: v } : p);
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Daily Sending Limit</Label>
                  <Input type="number" value={detailDomain.daily_limit} className="mt-1 h-9 text-sm" onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setDomains((p) => p.map((d) => d.id === detailDomain.id ? { ...d, daily_limit: val } : d));
                    setDetailDomain((p) => p ? { ...p, daily_limit: val } : p);
                  }} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailDomain(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
