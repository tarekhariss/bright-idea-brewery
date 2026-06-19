import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useAuth } from "@/contexts/AuthContext";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:text-red-300",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  normal: "bg-muted text-foreground",
  low: "bg-muted/60 text-muted-foreground",
};

export default function CrmCommandCenter() {
  const { user } = useAuth();
  const { opportunities, loading } = useOpportunities();

  const myOpen = useMemo(
    () => opportunities.filter((o) => o.owner_id === user?.id),
    [opportunities, user?.id]
  );
  const hotThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return opportunities.filter((o) =>
      (o.priority === "high" || o.priority === "urgent") &&
      o.last_activity_at && +new Date(o.last_activity_at) > cutoff
    );
  }, [opportunities]);
  const meetings = useMemo(
    () => opportunities.filter((o) => o.status === "meeting_booked" || o.status === "meeting_requested"),
    [opportunities]
  );

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Open opportunities" value={loading ? "…" : String(opportunities.length)} to="/crm/opportunities" />
        <StatCard label="Mine" value={loading ? "…" : String(myOpen.length)} to="/crm/inbox" />
        <StatCard label="Hot this week" value={loading ? "…" : String(hotThisWeek.length)} to="/crm/opportunities" />
        <StatCard label="Meetings" value={loading ? "…" : String(meetings.length)} to="/crm/pipeline" />
      </div>

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
                  <Badge className={priorityColors[o.priority]}>{o.priority}</Badge>
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
            <CardTitle className="text-base">Hot this week</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/crm/opportunities">View all <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && hotThisWeek.length === 0 && (
              <div className="text-sm text-muted-foreground">No high-priority opportunities active this week.</div>
            )}
            {hotThisWeek.slice(0, 8).map((o) => (
              <Link key={o.id} to={`/crm/opportunities/${o.id}`} className="block rounded-md border p-2 hover:bg-accent">
                <div className="truncate font-medium text-sm">
                  {o.title || o.company?.name || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {o.status.replace("_", " ")} · {o.source_channel}
                </div>
              </Link>
            ))}
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
