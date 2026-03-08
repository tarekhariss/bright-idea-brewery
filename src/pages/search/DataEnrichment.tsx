import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Database, Users, Building2, Mail, Phone, Linkedin, Globe2,
  Shield, RefreshCw, Zap, ArrowRight, Puzzle, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EnrichmentWorkflow {
  id: string;
  title: string;
  description: string;
  icon: any;
  targetCount: number;
  objectType: string;
  field: string;
  priority: "high" | "medium" | "low";
}

export default function DataEnrichmentPage() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["enrichment-overview"],
    queryFn: async () => {
      const [
        totalContacts, totalCompanies,
        noEmail, noPhone, noLinkedin, noCompanyLink,
        noDomain, noWebsite, noIndustry, noCompanyLinkedin,
        lowQuality, staleContacts, highQuality,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("email", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("phone", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("linkedin_url", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("company_id", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("domain", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("website", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("industry", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("linkedin_url", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).lt("data_quality_score", 40),
        supabase.from("contacts").select("id", { count: "exact", head: true }).lt("updated_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("contacts").select("id", { count: "exact", head: true }).gte("data_quality_score", 70),
      ]);
      return {
        totalContacts: totalContacts.count || 0,
        totalCompanies: totalCompanies.count || 0,
        noEmail: noEmail.count || 0,
        noPhone: noPhone.count || 0,
        noLinkedin: noLinkedin.count || 0,
        noCompanyLink: noCompanyLink.count || 0,
        noDomain: noDomain.count || 0,
        noWebsite: noWebsite.count || 0,
        noIndustry: noIndustry.count || 0,
        noCompanyLinkedin: noCompanyLinkedin.count || 0,
        lowQuality: lowQuality.count || 0,
        staleContacts: staleContacts.count || 0,
        highQuality: highQuality.count || 0,
      };
    },
  });

  const d = data;
  const contactCompleteness = d ? Math.round(((d.totalContacts - d.noEmail) / Math.max(d.totalContacts, 1)) * 100) : 0;
  const companyCompleteness = d ? Math.round(((d.totalCompanies - d.noDomain) / Math.max(d.totalCompanies, 1)) * 100) : 0;

  const workflows: EnrichmentWorkflow[] = d ? [
    { id: "email", title: "Enrich Missing Emails", description: "Find verified email addresses for contacts without emails", icon: Mail, targetCount: d.noEmail, objectType: "contact", field: "email", priority: "high" },
    { id: "linkedin", title: "Enrich Missing LinkedIn", description: "Discover LinkedIn profile URLs for better outreach", icon: Linkedin, targetCount: d.noLinkedin, objectType: "contact", field: "linkedin_url", priority: "high" },
    { id: "phone", title: "Enrich Missing Phones", description: "Find direct dial numbers for contacts", icon: Phone, targetCount: d.noPhone, objectType: "contact", field: "phone", priority: "medium" },
    { id: "domain", title: "Enrich Company Domains", description: "Resolve company domains for website and email matching", icon: Globe2, targetCount: d.noDomain, objectType: "company", field: "domain", priority: "high" },
    { id: "low-quality", title: "Improve Low-Quality Records", description: "Re-enrich contacts with data quality score below 40", icon: Shield, targetCount: d.lowQuality, objectType: "contact", field: "data_quality_score", priority: "medium" },
    { id: "stale", title: "Refresh Stale Records", description: "Update contacts not modified in the last 30 days", icon: RefreshCw, targetCount: d.staleContacts, objectType: "contact", field: "updated_at", priority: "low" },
  ] : [];

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/20",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Data Enrichment</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Identify gaps, improve data quality, and enrich records across your database.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/tools/analytics")}>
          <TrendingUp className="h-4 w-4 mr-1.5" /> View Analytics
        </Button>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Completeness</p>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{contactCompleteness}%</p>
            <Progress value={contactCompleteness} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Completeness</p>
              <Building2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
            </div>
            <p className="text-2xl font-bold">{companyCompleteness}%</p>
            <Progress value={companyCompleteness} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Quality</p>
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
            </div>
            <p className="text-2xl font-bold">{d?.highQuality?.toLocaleString() ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Score 70+</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Low Quality</p>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold">{d?.lowQuality?.toLocaleString() ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Score &lt;40</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gaps">
        <TabsList>
          <TabsTrigger value="gaps">Data Gaps</TabsTrigger>
          <TabsTrigger value="workflows">Enrichment Workflows</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Contact Gaps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Contact Data Gaps
                </CardTitle>
                <CardDescription className="text-xs">{d?.totalContacts?.toLocaleString()} total contacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Missing Email", count: d?.noEmail || 0, icon: Mail },
                  { label: "Missing Phone", count: d?.noPhone || 0, icon: Phone },
                  { label: "Missing LinkedIn", count: d?.noLinkedin || 0, icon: Linkedin },
                  { label: "No Company Linked", count: d?.noCompanyLink || 0, icon: Building2 },
                ].map((gap) => (
                  <div key={gap.label} className="flex items-center gap-3">
                    <gap.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">{gap.label}</span>
                        <span className="text-xs tabular-nums font-medium">{gap.count.toLocaleString()}</span>
                      </div>
                      <Progress value={d?.totalContacts ? (gap.count / d.totalContacts) * 100 : 0} className="h-1" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Company Gaps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[hsl(var(--chart-2))]" /> Company Data Gaps
                </CardTitle>
                <CardDescription className="text-xs">{d?.totalCompanies?.toLocaleString()} total companies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Missing Domain", count: d?.noDomain || 0, icon: Globe2 },
                  { label: "Missing Website", count: d?.noWebsite || 0, icon: Search },
                  { label: "Missing Industry", count: d?.noIndustry || 0, icon: Building2 },
                  { label: "Missing LinkedIn", count: d?.noCompanyLinkedin || 0, icon: Linkedin },
                ].map((gap) => (
                  <div key={gap.label} className="flex items-center gap-3">
                    <gap.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">{gap.label}</span>
                        <span className="text-xs tabular-nums font-medium">{gap.count.toLocaleString()}</span>
                      </div>
                      <Progress value={d?.totalCompanies ? (gap.count / d.totalCompanies) * 100 : 0} className="h-1" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
          <div className="grid grid-cols-1 gap-3">
            {workflows.filter((w) => w.targetCount > 0).map((w) => (
              <Card key={w.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <w.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{w.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${priorityColors[w.priority]}`}>
                        {w.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold tabular-nums">{w.targetCount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{w.objectType}s to enrich</p>
                  </div>
                  <Button variant="outline" size="sm" disabled className="shrink-0">
                    <Zap className="h-3.5 w-3.5 mr-1" /> Run
                  </Button>
                </CardContent>
              </Card>
            ))}
            {workflows.filter((w) => w.targetCount > 0).length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]/40 mb-3" />
                  <h3 className="text-sm font-medium">All data looks good!</h3>
                  <p className="text-xs text-muted-foreground mt-1">No enrichment workflows needed right now.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Email Verification", desc: "Verify email deliverability and catch-all detection", icon: Mail },
              { name: "Contact Enrichment", desc: "Enrich contacts with firmographic and social data", icon: Users },
              { name: "Company Intelligence", desc: "Technographic, funding, and org chart data", icon: Building2 },
            ].map((provider) => (
              <Card key={provider.name} className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <provider.icon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-sm font-medium">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{provider.desc}</p>
                  <Button variant="outline" size="sm" className="mt-4" disabled>
                    <Puzzle className="h-3.5 w-3.5 mr-1" /> Connect Provider
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
