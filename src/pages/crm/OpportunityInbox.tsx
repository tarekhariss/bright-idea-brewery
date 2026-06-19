import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOpportunities, type OpportunityStatus } from "@/hooks/use-opportunities";

const STATUSES: { value: OpportunityStatus | "all"; label: string }[] = [
  { value: "all", label: "All open" },
  { value: "interested", label: "Interested" },
  { value: "qualified", label: "Qualified" },
  { value: "meeting_requested", label: "Meeting requested" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "proposal_rfq", label: "Proposal / RFQ" },
];

export default function OpportunityInbox() {
  const { opportunities, loading } = useOpportunities();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("all");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (s) {
        const name = `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.toLowerCase();
        const hay = [name, o.company?.name ?? "", o.title ?? "", o.contact?.email ?? ""].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [opportunities, search, statusFilter]);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Opportunity Inbox</h1>
          <p className="text-sm text-muted-foreground">Triage incoming and active opportunities.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by contact, company, or title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nothing in the inbox yet. Push contacts in from Engage, LinkedIn, or Prospect Search.
          </div>
        )}
        <ul className="divide-y">
          {filtered.map((o) => (
            <li key={o.id}>
              <Link to={`/crm/opportunities/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">
                      {o.title || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || o.company?.name || "Untitled"}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{o.status.replace("_", " ")}</Badge>
                    {o.priority !== "normal" && <Badge variant="secondary" className="text-[10px]">{o.priority}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {o.contact?.email ?? ""} · {o.company?.name ?? ""} · via {o.source_channel}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {o.last_activity_at ? new Date(o.last_activity_at).toLocaleDateString() : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
