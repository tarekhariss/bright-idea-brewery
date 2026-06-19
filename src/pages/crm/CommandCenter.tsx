import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { filterQueue, SMART_QUEUES, isStale } from "@/lib/crm-rules";
import { NextBestActionCard } from "@/components/crm/NextBestActionCard";
import { StaleBadge } from "@/components/crm/StaleBadge";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:text-red-300",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  normal: "bg-muted text-foreground",
  low: "bg-muted/60 text-muted-foreground",
};

export default function CrmCommandCenter() {
  const { user } = useAuth();
  const { opportunities, loading } = useOpportunities({ includeClosed: true });
  const { staleDays } = useCrmSettings();

  const open = useMemo(() => opportunities.filter((o) => !["won", "lost", "not_fit", "bad_timing"].includes(o.status)), [opportunities]);
  const myOpen = useMemo(() => open.filter((o) => o.owner_id === user?.id), [open, user?.id]);
  const meetings = useMemo(() => open.filter((o) => o.status === "meeting_booked" || o.status === "meeting_requested"), [open]);
  const staleCount = useMemo(() => opportunities.filter((o) => isStale(o, staleDays)).length, [opportunities, staleDays]);

  // Top opportunity for NBA: highest priority, then most recent activity
  const topOpp = useMemo(() => {
    const rank = { urgent: 4, high: 3, normal: 2, low: 1 } as Record<string, number>;
    return [...myOpen].sort((a, b) =>
      (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0) ||
      +new Date(b.last_activity_at ?? b.created_at) - +new Date(a.last_activity_at ?? a.created_at)
    )[0];
  }, [myOpen]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">CRM Command Center</h1>
          <p className="text-sm text-muted-foreground">Triage, pipeline, and follow-ups across opportunities.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Open" value={loading ? "…" : String(open.length)} to="/crm/opportunities" />
        <StatCard label="Mine" value={loading ? "…" : String(myOpen.length)} to="/crm/inbox" />
        <StatCard label="Meetings" value={loading ? "…" : String(meetings.length)} to="/crm/pipeline" />
        <StatCard label="Stale" value={loading ? "…" : String(staleCount)} to="/crm/queues" />
        <StatCard label="Reports" value="→" to="/crm/reports" />
      </div>

      {topOpp && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Top opportunity for you</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/crm/opportunities/${topOpp.id}`}>Open <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{topOpp.title || topOpp.company?.name || topOpp.contact?.email || "Untitled"}</div>
                  <Badge className={priorityColors[topOpp.priority]}>{topOpp.priority}</Badge>
                  <Badge variant="outline">{topOpp.status.replace("_", " ")}</Badge>
                  <StaleBadge opportunity={topOpp} staleDays={staleDays} compact />
                </div>
                <NextBestActionCard opportunity={topOpp} staleDays={staleDays} />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Smart queues</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {SMART_QUEUES.slice(0, 6).map((q) => {
                  const n = filterQueue(q.key, opportunities, staleDays).length;
                  return (
                    <Link key={q.key} to="/crm/queues" className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-accent/40">
                      <span>{q.label}</span>
                      <span className="tabular-nums text-muted-foreground">{n}</span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">My open opportunities</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/crm/inbox">Open inbox <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loading && myOpen.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing assigned to you yet.</div>
            )}
            {myOpen.slice(0, 8).map((o) => (
              <Link key={o.id} to={`/crm/opportunities/${o.id}`} className="block rounded-md border p-2 hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium text-sm">
                    {o.title || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || o.company?.name || "Untitled opportunity"}
                  </div>
                  <div className="flex items-center gap-1">
                    <StaleBadge opportunity={o} staleDays={staleDays} compact />
                    <Badge className={priorityColors[o.priority]}>{o.priority}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {o.company?.name ?? ""} · {o.status.replace("_", " ")}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Stale — needs attention</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/crm/queues">View all <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {filterQueue("stale", opportunities, staleDays).slice(0, 8).map((o) => (
              <Link key={o.id} to={`/crm/opportunities/${o.id}`} className="block rounded-md border p-2 hover:bg-accent">
                <div className="truncate font-medium text-sm">
                  {o.title || o.company?.name || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {o.status.replace("_", " ")} · last {o.last_activity_at ? new Date(o.last_activity_at).toLocaleDateString() : "—"}
                </div>
              </Link>
            ))}
            {!loading && filterQueue("stale", opportunities, staleDays).length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing stale — nice work.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link to={to} className="block">
      <Card className="hover:bg-accent/30 transition-colors">
        <CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
