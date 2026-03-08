import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Users, Building2, List, Upload, AlertTriangle, ShieldAlert, Mail, Linkedin,
  Globe, TrendingUp, BarChart3, ArrowRight, Clock, CheckCircle2, XCircle, Eye
} from "lucide-react";
import { format, subDays } from "date-fns";

interface DashboardStats {
  contacts: number;
  companies: number;
  lists: number;
  imports: number;
  highQuality: number;
  lowQuality: number;
  dncCount: number;
  missingEmail: number;
  missingLinkedin: number;
  missingDomain: number;
  reviewQueueCount: number;
  contactsLast7: number;
  contactsLast30: number;
  companiesLast7: number;
  companiesLast30: number;
  lifecycleCounts: Record<string, number>;
  outreachCounts: Record<string, number>;
  topCountries: { name: string; count: number }[];
  topIndustries: { name: string; count: number }[];
  qualityDistribution: { high: number; medium: number; low: number; unscored: number };
  recentImports: { id: string; file_name: string; status: string; total_rows: number; created_at: string }[];
}

const EMPTY: DashboardStats = {
  contacts: 0, companies: 0, lists: 0, imports: 0,
  highQuality: 0, lowQuality: 0, dncCount: 0,
  missingEmail: 0, missingLinkedin: 0, missingDomain: 0,
  reviewQueueCount: 0,
  contactsLast7: 0, contactsLast30: 0,
  companiesLast7: 0, companiesLast30: 0,
  lifecycleCounts: {}, outreachCounts: {},
  topCountries: [], topIndustries: [],
  qualityDistribution: { high: 0, medium: 0, low: 0, unscored: 0 },
  recentImports: [],
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [s, setS] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const now = new Date();
    const d7 = subDays(now, 7).toISOString();
    const d30 = subDays(now, 30).toISOString();

    const [
      cTotal, coTotal, lTotal, iTotal,
      cHigh, cLow, cDnc,
      cNoEmail, cNoLi,
      coNoDomain,
      reviewQ,
      c7, c30, co7, co30,
      recentImp,
      allContacts,
      allCompanies,
    ] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("lists").select("id", { count: "exact", head: true }),
      supabase.from("import_jobs").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }).gte("data_quality_score", 70),
      supabase.from("contacts").select("id", { count: "exact", head: true }).lt("data_quality_score", 40),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("do_not_contact", true),
      supabase.from("contacts").select("id", { count: "exact", head: true }).is("email", null),
      supabase.from("contacts").select("id", { count: "exact", head: true }).is("linkedin_url", null),
      supabase.from("companies").select("id", { count: "exact", head: true }).is("domain", null),
      supabase.from("import_job_rows").select("id", { count: "exact", head: true }).eq("review_required", true).eq("status", "review"),
      supabase.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", d7),
      supabase.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", d30),
      supabase.from("companies").select("id", { count: "exact", head: true }).gte("created_at", d7),
      supabase.from("companies").select("id", { count: "exact", head: true }).gte("created_at", d30),
      supabase.from("import_jobs").select("id, file_name, status, total_rows, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("contacts").select("lifecycle_status, outreach_status, country, data_quality_score"),
      supabase.from("companies").select("industry"),
    ]);

    // Aggregate lifecycle, outreach, countries, quality
    const lifecycleCounts: Record<string, number> = {};
    const outreachCounts: Record<string, number> = {};
    const countryMap: Record<string, number> = {};
    let high = 0, medium = 0, low = 0, unscored = 0;

    (allContacts.data ?? []).forEach((c: any) => {
      lifecycleCounts[c.lifecycle_status] = (lifecycleCounts[c.lifecycle_status] || 0) + 1;
      outreachCounts[c.outreach_status] = (outreachCounts[c.outreach_status] || 0) + 1;
      if (c.country) countryMap[c.country] = (countryMap[c.country] || 0) + 1;
      if (c.data_quality_score === null) unscored++;
      else if (c.data_quality_score >= 70) high++;
      else if (c.data_quality_score >= 40) medium++;
      else low++;
    });

    const industryMap: Record<string, number> = {};
    (allCompanies.data ?? []).forEach((c: any) => {
      if (c.industry) industryMap[c.industry] = (industryMap[c.industry] || 0) + 1;
    });

    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    const topIndustries = Object.entries(industryMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    setS({
      contacts: cTotal.count ?? 0,
      companies: coTotal.count ?? 0,
      lists: lTotal.count ?? 0,
      imports: iTotal.count ?? 0,
      highQuality: cHigh.count ?? 0,
      lowQuality: cLow.count ?? 0,
      dncCount: cDnc.count ?? 0,
      missingEmail: cNoEmail.count ?? 0,
      missingLinkedin: cNoLi.count ?? 0,
      missingDomain: coNoDomain.count ?? 0,
      reviewQueueCount: reviewQ.count ?? 0,
      contactsLast7: c7.count ?? 0,
      contactsLast30: c30.count ?? 0,
      companiesLast7: co7.count ?? 0,
      companiesLast30: co30.count ?? 0,
      lifecycleCounts,
      outreachCounts,
      topCountries,
      topIndustries,
      qualityDistribution: { high, medium, low, unscored },
      recentImports: (recentImp.data ?? []) as any,
    });
    setLoading(false);
  }

  const n = (v: number) => (loading ? "—" : v.toLocaleString());

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-muted text-muted-foreground",
  };

  const lifecycleLabels: Record<string, string> = {
    new: "New", researching: "Researching", qualified: "Qualified", nurturing: "Nurturing",
    engaged: "Engaged", converted: "Converted", churned: "Churned", archived: "Archived",
  };
  const outreachLabels: Record<string, string> = {
    not_contacted: "Not Contacted", queued: "Queued", contacted: "Contacted", replied: "Replied",
    bounced: "Bounced", opted_out: "Opted Out", unresponsive: "Unresponsive",
  };

  const qualityTotal = s.qualityDistribution.high + s.qualityDistribution.medium + s.qualityDistribution.low + s.qualityDistribution.unscored;
  const pct = (v: number) => qualityTotal > 0 ? Math.round((v / qualityTotal) * 100) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">TLBG Prospect Intelligence Overview</p>
        </div>
        {s.reviewQueueCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-warning text-warning" onClick={() => navigate("/imports")}>
            <AlertTriangle className="h-3.5 w-3.5" /> {s.reviewQueueCount} rows need review
          </Button>
        )}
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Contacts", value: s.contacts, icon: Users, color: "text-primary", sub: `+${n(s.contactsLast7)} this week` },
          { label: "Companies", value: s.companies, icon: Building2, color: "text-chart-2", sub: `+${n(s.companiesLast7)} this week` },
          { label: "Lists", value: s.lists, icon: List, color: "text-chart-3", sub: "Active lists" },
          { label: "Import Jobs", value: s.imports, icon: Upload, color: "text-chart-4", sub: `${n(s.reviewQueueCount)} pending review` },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{n(c.value)}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Quality + Health Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Data Quality Distribution</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/data-health")}>
                View Details <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "High (70+)", value: s.qualityDistribution.high, pct: pct(s.qualityDistribution.high), color: "bg-green-500" },
                { label: "Medium (40-69)", value: s.qualityDistribution.medium, pct: pct(s.qualityDistribution.medium), color: "bg-yellow-500" },
                { label: "Low (<40)", value: s.qualityDistribution.low, pct: pct(s.qualityDistribution.low), color: "bg-red-500" },
                { label: "Unscored", value: s.qualityDistribution.unscored, pct: pct(s.qualityDistribution.unscored), color: "bg-muted-foreground" },
              ].map((q) => (
                <div key={q.label} className="text-center">
                  <div className="text-2xl font-bold tabular-nums">{n(q.value)}</div>
                  <p className="text-xs text-muted-foreground">{q.label}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${q.color}`} style={{ width: `${q.pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{q.pct}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Health Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Missing email", value: s.missingEmail, icon: Mail, onClick: () => navigate("/data-health") },
              { label: "Missing LinkedIn", value: s.missingLinkedin, icon: Linkedin, onClick: () => navigate("/data-health") },
              { label: "Missing domain", value: s.missingDomain, icon: Globe, onClick: () => navigate("/data-health") },
              { label: "Do Not Contact", value: s.dncCount, icon: ShieldAlert, onClick: () => navigate("/contacts") },
              { label: "Low quality", value: s.lowQuality, icon: AlertTriangle, onClick: () => navigate("/data-health") },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick} className="flex items-center justify-between w-full text-left rounded-md px-3 py-2 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <a.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{a.label}</span>
                </div>
                <Badge variant="outline" className="text-[11px] tabular-nums">{n(a.value)}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle + Outreach breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contacts by Lifecycle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(lifecycleLabels).map(([key, label]) => {
                const count = s.lifecycleCounts[key] || 0;
                const pctVal = s.contacts > 0 ? Math.round((count / s.contacts) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctVal}%` }} />
                    </div>
                    <span className="text-xs tabular-nums w-16 text-right">{n(count)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contacts by Outreach Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(outreachLabels).map(([key, label]) => {
                const count = s.outreachCounts[key] || 0;
                const pctVal = s.contacts > 0 ? Math.round((count / s.contacts) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-chart-2 rounded-full transition-all" style={{ width: `${pctVal}%` }} />
                    </div>
                    <span className="text-xs tabular-nums w-16 text-right">{n(count)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Countries + Industries + Recent Imports */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Top Countries</CardTitle></CardHeader>
          <CardContent>
            {s.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {s.topCountries.map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="text-sm truncate">{c.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Top Industries</CardTitle></CardHeader>
          <CardContent>
            {s.topIndustries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {s.topIndustries.map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="text-sm truncate">{c.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Imports</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/imports")}>
                All <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {s.recentImports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet</p>
            ) : (
              <div className="space-y-3">
                {s.recentImports.map((imp) => (
                  <button key={imp.id} onClick={() => navigate(`/imports/${imp.id}`)}
                    className="flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[160px]">{imp.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(imp.created_at), "MMM d")}</p>
                    </div>
                    <Badge variant="outline" className={`text-[11px] ${statusColor[imp.status] || ""}`}>{imp.status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth summary */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Growth Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Contacts (7d)", value: s.contactsLast7 },
              { label: "Contacts (30d)", value: s.contactsLast30 },
              { label: "Companies (7d)", value: s.companiesLast7 },
              { label: "Companies (30d)", value: s.companiesLast30 },
            ].map((g) => (
              <div key={g.label} className="text-center p-3 rounded-lg bg-muted/50">
                <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <div className="text-xl font-bold tabular-nums">{n(g.value)}</div>
                <p className="text-xs text-muted-foreground">{g.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
