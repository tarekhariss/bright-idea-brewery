import { useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceSummary } from "@/hooks/use-admin";
import {
  Users, Megaphone, Mail, MessageSquare, CalendarCheck, DollarSign,
  Building2, TrendingUp,
} from "lucide-react";

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-lg border">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function WorkspaceDetailAdmin() {
  const { id } = useParams<{ id: string }>();
  const { data: ws, isLoading } = useWorkspaceSummary(id);

  if (isLoading) {
    return (
      <PageShell title="Workspace Detail">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </PageShell>
    );
  }

  if (!ws) {
    return (
      <PageShell title="Workspace Not Found">
        <p className="text-muted-foreground">No summary data available for this workspace.</p>
      </PageShell>
    );
  }

  return (
    <PageShell title={ws.workspace_name} description={`Owner: ${ws.owner_email ?? "Unknown"}`}>
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="outline">{ws.member_count ?? 0} members</Badge>
        <Badge variant="secondary">{ws.active_campaigns ?? 0} active campaigns</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={Users} label="Contacts" value={(ws.total_contacts ?? 0).toLocaleString()} />
        <Stat icon={Building2} label="Companies" value={(ws.total_companies ?? 0).toLocaleString()} />
        <Stat icon={Megaphone} label="Total Campaigns" value={ws.total_campaigns ?? 0} />
        <Stat icon={TrendingUp} label="Active Campaigns" value={ws.active_campaigns ?? 0} />
        <Stat icon={Mail} label="Emails Sent" value={(ws.emails_sent ?? 0).toLocaleString()} />
        <Stat icon={MessageSquare} label="Replies" value={(ws.replies_received ?? 0).toLocaleString()} />
        <Stat icon={CalendarCheck} label="Meetings" value={ws.meetings_booked ?? 0} />
        <Stat icon={DollarSign} label="Deals" value={ws.deals_created ?? 0} />
        <Stat icon={DollarSign} label="Revenue" value={`$${(ws.revenue_generated ?? 0).toLocaleString()}`} />
        <Stat icon={TrendingUp} label="Attributed Revenue" value={`$${(ws.attributed_revenue ?? 0).toLocaleString()}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Detailed campaign, mailbox, LinkedIn, and AI usage breakdowns will populate as data flows through the platform.
          </p>
          {ws.last_activity_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Last activity: {new Date(ws.last_activity_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
