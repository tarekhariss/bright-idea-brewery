import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Users, Building2, Upload, Shield, TrendingUp,
  Globe2, Briefcase, UserCheck, Activity, GitBranch, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  LineChart, Line, ResponsiveContainer, Tooltip, Legend,
} from "recharts";

const COLORS = [
  "hsl(217, 71%, 45%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)", "hsl(0, 72%, 51%)", "hsl(200, 70%, 50%)",
  "hsl(160, 60%, 45%)", "hsl(320, 60%, 50%)",
];

export default function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      // Use head:true count queries instead of fetching all rows
      const [
        contactsRes, companiesRes, importsRes,
        noEmailRes, noPhoneRes, noLinkedinRes, reviewRes,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("import_jobs").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("email", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("phone", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("linkedin_url", null),
        supabase.from("import_job_rows").select("id", { count: "exact", head: true }).eq("status", "review"),
      ]);

      // Fetch only needed columns with limits for aggregation
      const [lifecycleRes, outreachRes, countryRes, industryRes, qualityRes, ownerRes] = await Promise.all([
        supabase.from("contacts").select("lifecycle_status").limit(50000),
        supabase.from("contacts").select("outreach_status").limit(50000),
        supabase.from("contacts").select("country").not("country", "is", null).limit(50000),
        supabase.from("companies").select("industry").not("industry", "is", null).limit(50000),
        supabase.from("contacts").select("data_quality_score").not("data_quality_score", "is", null).limit(50000),
        supabase.from("contacts").select("owner_id").limit(50000),
      ]);

      const countBy = (arr: any[], key: string) => {
        const map: Record<string, number> = {};
        (arr || []).forEach((r) => { const v = r[key] || "Unknown"; map[v] = (map[v] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      };

      const scores = (qualityRes.data || []).map((r) => r.data_quality_score).filter(Boolean) as number[];
      const qualityDist = [
        { name: "High (70-100)", value: scores.filter((s) => s >= 70).length },
        { name: "Medium (40-69)", value: scores.filter((s) => s >= 40 && s < 70).length },
        { name: "Low (0-39)", value: scores.filter((s) => s < 40).length },
      ];
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      const owners = (ownerRes.data || []);
      const assigned = owners.filter((r) => r.owner_id).length;

      return {
        totalContacts: contactsRes.count || 0,
        totalCompanies: companiesRes.count || 0,
        totalImports: importsRes.count || 0,
        reviewQueue: reviewRes.count || 0,
        lifecycle: countBy(lifecycleRes.data || [], "lifecycle_status"),
        outreach: countBy(outreachRes.data || [], "outreach_status"),
        countries: countBy(countryRes.data || [], "country").slice(0, 10),
        industries: countBy(industryRes.data || [], "industry").slice(0, 10),
        qualityDist,
        avgScore,
        missingEmail: noEmailRes.count || 0,
        missingPhone: noPhoneRes.count || 0,
        missingLinkedin: noLinkedinRes.count || 0,
        ownerAssigned: assigned,
        ownerUnassigned: owners.length - assigned,
      };
    },
    staleTime: 60_000, // Cache for 1 minute
  });

  const d = data;

  const chartConfig = {
    value: { label: "Count", color: "hsl(var(--chart-1))" },
    contacts: { label: "Contacts", color: "hsl(var(--chart-1))" },
    companies: { label: "Companies", color: "hsl(var(--chart-2))" },
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Measure data quality, pipeline health, and operational trends.</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: d?.totalContacts, icon: Users, color: "text-primary" },
          { label: "Total Companies", value: d?.totalCompanies, icon: Building2, color: "text-[hsl(var(--chart-2))]" },
          { label: "Import Jobs", value: d?.totalImports, icon: Upload, color: "text-[hsl(var(--chart-3))]" },
          { label: "Avg Quality Score", value: d?.avgScore, icon: Shield, color: "text-[hsl(var(--chart-4))]", suffix: "/100" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold mt-1">
                {kpi.value?.toLocaleString() ?? "—"}{kpi.suffix || ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Lifecycle Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Contacts by Lifecycle Status</CardTitle>
              </CardHeader>
              <CardContent>
                {(d?.lifecycle || []).length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={d?.lifecycle} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            {/* Outreach Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Contacts by Outreach Status</CardTitle>
              </CardHeader>
              <CardContent>
                {(d?.outreach || []).length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={d?.outreach} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Countries + Industries */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe2 className="h-4 w-4" /> Contacts by Country
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(d?.countries || []).length > 0 ? (
                  <div className="space-y-2">
                    {d?.countries.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="text-xs w-24 truncate text-muted-foreground">{c.name}</span>
                        <Progress value={(c.value / (d?.totalContacts || 1)) * 100} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums w-10 text-right">{c.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Companies by Industry
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(d?.industries || []).length > 0 ? (
                  <div className="space-y-2">
                    {d?.industries.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="text-xs w-24 truncate text-muted-foreground">{c.name}</span>
                        <Progress value={(c.value / (d?.totalCompanies || 1)) * 100} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums w-10 text-right">{c.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missing Email</p>
                <p className="text-2xl font-bold mt-1">{d?.missingEmail?.toLocaleString() ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d?.totalContacts ? `${Math.round(((d.missingEmail || 0) / d.totalContacts) * 100)}% of contacts` : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missing Phone</p>
                <p className="text-2xl font-bold mt-1">{d?.missingPhone?.toLocaleString() ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d?.totalContacts ? `${Math.round(((d.missingPhone || 0) / d.totalContacts) * 100)}% of contacts` : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missing LinkedIn</p>
                <p className="text-2xl font-bold mt-1">{d?.missingLinkedin?.toLocaleString() ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d?.totalContacts ? `${Math.round(((d.missingLinkedin || 0) / d.totalContacts) * 100)}% of contacts` : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quality Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Data Quality Score Distribution</CardTitle>
              <CardDescription>Breakdown of contact quality scores across your database</CardDescription>
            </CardHeader>
            <CardContent>
              {(d?.qualityDist || []).some((q) => q.value > 0) ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={d?.qualityDist}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {(d?.qualityDist || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No quality scores yet</div>
              )}
            </CardContent>
          </Card>

          {/* Review queue */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Import Review Queue</p>
                  <p className="text-2xl font-bold mt-1">{d?.reviewQueue?.toLocaleString() ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rows flagged for manual review during import</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-4 space-y-4">
          {/* Owner Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4" /> Owner Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Assigned</span>
                    <span className="font-medium tabular-nums">{d?.ownerAssigned ?? 0}</span>
                  </div>
                  <Progress value={d?.totalContacts ? ((d.ownerAssigned || 0) / d.totalContacts) * 100 : 0} className="h-2" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                    <span className="font-medium tabular-nums">{d?.ownerUnassigned ?? 0}</span>
                  </div>
                  <Progress value={d?.totalContacts ? ((d.ownerUnassigned || 0) / d.totalContacts) * 100 : 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <GitBranch className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">Sequence Activity</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Track sequence performance, enrollment trends, and step completion rates.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Zap className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">Workflow Activity</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Monitor workflow runs, trigger volumes, and automation effectiveness.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
