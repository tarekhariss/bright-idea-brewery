import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Filter, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useLinkedinContacts } from "@/hooks/use-linkedin-engine";
import { useLinkedinCampaigns } from "@/hooks/use-linkedin-campaigns";
import { useEnrollLeadsInLinkedinCampaign } from "@/hooks/use-linkedin-engine";
import { useUpsertLinkedinContactState } from "@/hooks/use-linkedin-platform";

const CONNECTION_STATUSES = [
  { value: "not_connected", label: "Not connected", color: "bg-muted text-muted-foreground" },
  { value: "pending", label: "Request pending", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "connected", label: "Connected", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "declined", label: "Declined", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  { value: "withdrawn", label: "Withdrawn", color: "bg-muted text-muted-foreground" },
];

export default function LinkedinContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [hasLi, setHasLi] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data: contacts, isLoading } = useLinkedinContacts({
    search: search || undefined,
    connectionStatus: connectionStatus || undefined,
    hasLinkedinUrl: hasLi,
  });
  const upsertState = useUpsertLinkedinContactState();

  const allIds = useMemo(() => (contacts || []).map((c: any) => c.id), [contacts]);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(allIds));
  };
  const toggle = (id: string) => {
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s);
  };

  const setStatus = (contact_id: string, value: string) => {
    upsertState.mutate({ contact_id, connection_status: value });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">LinkedIn-scoped view of your CRM contacts with connection state and outreach history.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => navigate("/contacts")}><ExternalLink className="h-3.5 w-3.5" /> Open CRM</Button>
          <Button size="sm" className="text-xs gap-1.5" disabled={!selected.size} onClick={() => setEnrollOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add to automation ({selected.size})
          </Button>
        </div>
      </div>

      <Card>
        <div className="border-b p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={connectionStatus || "all"} onValueChange={(v) => setConnectionStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[170px]"><SelectValue placeholder="Connection status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All connection states</SelectItem>
              {CONNECTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={hasLi} onCheckedChange={(v) => setHasLi(Boolean(v))} />
            Has LinkedIn URL
          </label>
          <div className="ml-auto text-xs text-muted-foreground">{contacts?.length ?? 0} contacts</div>
        </div>

        {isLoading ? (
          <div className="p-3 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !contacts?.length ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No matching contacts.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">LinkedIn</TableHead>
                <TableHead className="text-xs">Connection</TableHead>
                <TableHead className="text-xs">Last LI activity</TableHead>
                <TableHead className="text-xs">Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: any) => {
                const cs = c.li_state?.connection_status || "not_connected";
                const meta = CONNECTION_STATUSES.find(x => x.value === cs);
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-stop]")) return;
                    navigate(`/contacts/${c.id}`);
                  }}>
                    <TableCell data-stop><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} /></TableCell>
                    <TableCell className="text-sm font-medium">{c.first_name} {c.last_name}</TableCell>
                    <TableCell className="text-xs">{c.title || "—"}</TableCell>
                    <TableCell className="text-xs">{c.companies?.name || "—"}</TableCell>
                    <TableCell className="text-xs" data-stop>
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline inline-flex items-center gap-1">
                          Profile <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell data-stop>
                      <Select value={cs} onValueChange={(v) => setStatus(c.id, v)}>
                        <SelectTrigger className="h-7 text-[10px] w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONNECTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">{c.li_state?.last_li_activity_at ? new Date(c.li_state.last_li_activity_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{c.outreach_status || "not_started"}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} contactIds={Array.from(selected)} onDone={() => setSelected(new Set())} />
    </div>
  );
}

function EnrollDialog({ open, onOpenChange, contactIds, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; contactIds: string[]; onDone: () => void }) {
  const { data: campaigns } = useLinkedinCampaigns();
  const enroll = useEnrollLeadsInLinkedinCampaign();
  const [campaignId, setCampaignId] = useState<string>("");

  const handleEnroll = async () => {
    if (!campaignId || !contactIds.length) return;
    await enroll.mutateAsync({ campaign_id: campaignId, contact_ids: contactIds });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add to LinkedIn automation</DialogTitle>
          <DialogDescription className="text-sm">Enroll {contactIds.length} contact{contactIds.length === 1 ? "" : "s"} into a LinkedIn automation. The first action will be scheduled automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select an automation…" /></SelectTrigger>
            <SelectContent>
              {(campaigns || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              {!campaigns?.length && <div className="px-3 py-2 text-xs text-muted-foreground">No automations yet.</div>}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleEnroll} disabled={!campaignId || enroll.isPending}>
            {enroll.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
