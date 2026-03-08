import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { useAdminCampaignSummaries } from "@/hooks/use-admin";
import { Search } from "lucide-react";

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600",
  paused: "bg-amber-500/15 text-amber-600",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

export function AdminCampaignOversight() {
  const { data: campaigns, isLoading } = useAdminCampaignSummaries();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("emails_sent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = (campaigns ?? [])
    .filter((c) =>
      c.campaign_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.workspace_name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortKey) return 0;
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Global Campaign Oversight</CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><SortableHeader label="Emails" sortKey="emails_sent" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Replies" sortKey="replies" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Meetings" sortKey="meetings" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Deals" sortKey="deals" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Revenue" sortKey="revenue" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead>Attributed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !filtered.length ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No campaign data yet.</TableCell></TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{c.workspace_name ?? "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{c.campaign_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={`border-0 text-[10px] ${statusColor[c.status ?? "draft"] ?? ""}`}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{(c.emails_sent ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{c.replies ?? 0}</TableCell>
                  <TableCell>{c.meetings ?? 0}</TableCell>
                  <TableCell>{c.deals ?? 0}</TableCell>
                  <TableCell>${(c.revenue ?? 0).toLocaleString()}</TableCell>
                  <TableCell>${(c.attributed_revenue ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
