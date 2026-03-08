import { useAnalyticsOverview, useAllCampaignPerformance } from "@/hooks/use-analytics";
import {
  BarChart3, Mail, MessageSquare, Calendar, Target, DollarSign,
  TrendingUp, Users, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function AnalyticsPage() {
  const { data: overview } = useAnalyticsOverview();
  const { data: campaignPerf } = useAllCampaignPerformance();

  const d = overview;
  const chartConfig = {
    value: { label: "Count", color: "hsl(var(--chart-1))" },
  };

  const kpis = [
    { label: "Emails Sent", value: d?.emailsSent, icon: Mail, color: "text-primary" },
    { label: "Meetings Booked", value: d?.meetingsBooked, icon: Calendar, color: "text-[hsl(var(--chart-2))]" },
    { label: "Deals Won", value: d?.wonDeals, icon: Target, color: "text-[hsl(var(--chart-3))]" },
    { label: "Revenue", value: d?.totalRevenue, icon: DollarSign, color: "text-[hsl(var(--chart-4))]", prefix: "$" },
    { label: "Attributed Revenue", value: d?.attributedRevenue, icon: TrendingUp, color: "text-[hsl(var(--chart-5))]", prefix: "$" },
    { label: "Active Campaigns", value: d?.activeCampaigns, icon: Zap, color: "text-[hsl(var(--chart-1))]" },
  ];

  const topCampaigns = (campaignPerf || []).slice(0, 10);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics & Attribution</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Unified view of outreach activity, pipeline, and revenue attribution.</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xl font-bold mt-1">
                {kpi.prefix || ""}{kpi.value?.toLocaleString() ?? "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaign Performance</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {topCampaigns.length > 0 ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Campaign Performance Overview</CardTitle>
                  <CardDescription>Top campaigns by emails sent</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={topCampaigns.map(c => ({
                      name: (c.campaigns as any)?.name?.substring(0, 20) || "—",
                      value: c.emails_sent || 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Campaign</TableHead>
                        <TableHead className="text-xs">Sent</TableHead>
                        <TableHead className="text-xs">Replies</TableHead>
                        <TableHead className="text-xs">Meetings</TableHead>
                        <TableHead className="text-xs">Deals</TableHead>
                        <TableHead className="text-xs">Revenue</TableHead>
                        <TableHead className="text-xs">Reply Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topCampaigns.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs font-medium">{(c.campaigns as any)?.name || "—"}</TableCell>
                          <TableCell className="text-xs tabular-nums">{c.emails_sent || 0}</TableCell>
                          <TableCell className="text-xs tabular-nums">{c.replies_received || 0}</TableCell>
                          <TableCell className="text-xs tabular-nums">{c.meetings_booked || 0}</TableCell>
                          <TableCell className="text-xs tabular-nums">{c.deals_created || 0}</TableCell>
                          <TableCell className="text-xs tabular-nums">${Number(c.revenue_generated || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs tabular-nums">{c.reply_rate != null ? `${Number(c.reply_rate).toFixed(1)}%` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-sm font-medium">No Campaign Data Yet</h3>
                <p className="text-xs text-muted-foreground mt-1">Campaign performance metrics will appear here once campaigns are active.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attribution" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Attributed Revenue</p>
                <p className="text-2xl font-bold mt-1">${d?.attributedRevenue?.toLocaleString() ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deals from Campaigns</p>
                <p className="text-2xl font-bold mt-1">{d?.wonDeals ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meetings Booked</p>
                <p className="text-2xl font-bold mt-1">{d?.meetingsBooked ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="text-sm font-medium">Attribution Model</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Supports first-touch, last-touch, and multi-touch attribution. Configure your preferred model in workspace settings.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Outreach Funnel</CardTitle>
              <CardDescription>Conversion from emails to revenue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Contacts Reached", value: d?.totalContacts || 0, max: d?.totalContacts || 1 },
                { label: "Emails Sent", value: d?.emailsSent || 0, max: d?.totalContacts || 1 },
                { label: "Meetings Booked", value: d?.meetingsBooked || 0, max: d?.emailsSent || 1 },
                { label: "Deals Created", value: d?.totalDeals || 0, max: d?.meetingsBooked || 1 },
                { label: "Deals Won", value: d?.wonDeals || 0, max: d?.totalDeals || 1 },
              ].map(stage => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="text-xs w-32 text-muted-foreground">{stage.label}</span>
                  <Progress value={Math.min(100, (stage.value / stage.max) * 100)} className="h-3 flex-1" />
                  <span className="text-xs tabular-nums w-16 text-right font-medium">{stage.value.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
