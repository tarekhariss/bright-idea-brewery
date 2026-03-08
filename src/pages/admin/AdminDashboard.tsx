import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Users, Megaphone, Mail, MessageSquare,
  CalendarCheck, DollarSign, TrendingUp, Activity, Globe,
  Linkedin, Server, Shield,
} from "lucide-react";
import { usePlatformKpis, useAdminActivityFeed } from "@/hooks/use-admin";
import { AdminWorkspacesTable } from "@/components/admin/AdminWorkspacesTable";
import { AdminMailboxMonitor } from "@/components/admin/AdminMailboxMonitor";
import { AdminLinkedinMonitor } from "@/components/admin/AdminLinkedinMonitor";
import { AdminCampaignOversight } from "@/components/admin/AdminCampaignOversight";
import { format } from "date-fns";

function KpiCard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: string | number; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-6 w-16 mt-0.5" />
          ) : (
            <p className="text-lg font-semibold text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: kpis, isLoading } = usePlatformKpis();
  const { data: feed } = useAdminActivityFeed();

  const k = kpis ?? {} as Record<string, any>;

  const kpiCards = [
    { icon: Globe, label: "Total Workspaces", value: k.total_workspaces ?? 0 },
    { icon: Building2, label: "Active Workspaces", value: k.active_workspaces ?? 0 },
    { icon: Users, label: "Total Contacts", value: (k.total_contacts ?? 0).toLocaleString() },
    { icon: Building2, label: "Total Companies", value: (k.total_companies ?? 0).toLocaleString() },
    { icon: Megaphone, label: "Total Campaigns", value: k.total_campaigns ?? 0 },
    { icon: TrendingUp, label: "Active Campaigns", value: k.active_campaigns ?? 0 },
    { icon: Mail, label: "Emails Sent", value: (k.emails_sent ?? 0).toLocaleString() },
    { icon: MessageSquare, label: "Replies", value: (k.replies_received ?? 0).toLocaleString() },
    { icon: CalendarCheck, label: "Meetings Booked", value: k.meetings_booked ?? 0 },
    { icon: DollarSign, label: "Deals Created", value: k.deals_created ?? 0 },
    { icon: DollarSign, label: "Revenue", value: `$${(k.revenue_generated ?? 0).toLocaleString()}` },
    { icon: TrendingUp, label: "Attributed Revenue", value: `$${(k.attributed_revenue ?? 0).toLocaleString()}` },
  ];

  return (
    <PageShell title="Platform Admin" subtitle="Global overview across all workspaces">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-primary" />
        <Badge variant="outline" className="text-xs">Admin Only</Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        {kpiCards.map((c) => (
          <KpiCard key={c.label} {...c} loading={isLoading} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workspaces" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="deliverability">Deliverability</TabsTrigger>
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces">
          <AdminWorkspacesTable />
        </TabsContent>

        <TabsContent value="campaigns">
          <AdminCampaignOversight />
        </TabsContent>

        <TabsContent value="deliverability">
          <AdminMailboxMonitor />
        </TabsContent>

        <TabsContent value="linkedin">
          <AdminLinkedinMonitor />
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              {!feed?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No activity events recorded yet.</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {feed.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{ev.event_type}</Badge>
                          {ev.workspace_name && (
                            <span className="text-[10px] text-muted-foreground">{ev.workspace_name}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-0.5">{ev.event_title}</p>
                        {ev.event_description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.event_description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(ev.occurred_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
