import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { useWorkspaceSummaries } from "@/hooks/use-admin";
import { Search, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export function AdminWorkspacesTable() {
  const { data: workspaces, isLoading } = useWorkspaceSummaries();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("emails_sent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = (workspaces ?? [])
    .filter((w) => w.workspace_name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">All Workspaces</CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search workspaces…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead><SortableHeader label="Campaigns" sortKey="active_campaigns" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Contacts" sortKey="total_contacts" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Emails" sortKey="emails_sent" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Replies" sortKey="replies_received" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Meetings" sortKey="meetings_booked" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Deals" sortKey="deals_created" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead><SortableHeader label="Revenue" sortKey="revenue_generated" currentSort={sortKey} currentDirection={sortDir} onSort={handleSort} /></TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !filtered.length ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No workspaces found.</TableCell></TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id} className="cursor-pointer" onClick={() => navigate(`/admin/workspaces/${w.workspace_id}`)}>
                  <TableCell className="font-medium">{w.workspace_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{w.owner_email ?? "—"}</TableCell>
                  <TableCell>{w.active_campaigns ?? 0}</TableCell>
                  <TableCell>{(w.total_contacts ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{(w.emails_sent ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{w.replies_received ?? 0}</TableCell>
                  <TableCell>{w.meetings_booked ?? 0}</TableCell>
                  <TableCell>{w.deals_created ?? 0}</TableCell>
                  <TableCell>${(w.revenue_generated ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.last_activity_at ? format(new Date(w.last_activity_at), "MMM d, HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
