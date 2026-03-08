import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Users, Building2, List, Database, ArrowRight, Search,
  TrendingUp, Upload, Shield, Lightbulb, Filter, Eye, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const modules = [
  {
    icon: Users,
    title: "People Search",
    desc: "Find decision-makers by title, industry, location, and company.",
    url: "/search/people",
    color: "text-primary bg-primary/10",
    stat: "contacts",
  },
  {
    icon: Building2,
    title: "Company Search",
    desc: "Discover target accounts by size, revenue, technology, and more.",
    url: "/search/companies",
    color: "text-[hsl(var(--chart-2))] bg-[hsl(var(--chart-2))]/10",
    stat: "companies",
  },
  {
    icon: List,
    title: "Lists",
    desc: "Organize prospects into targeted segments for outreach.",
    url: "/search/lists",
    color: "text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10",
    stat: "lists",
  },
  {
    icon: Database,
    title: "Data Enrichment",
    desc: "Enrich records with verified firmographic and contact data.",
    url: "/search/data-enrichment",
    color: "text-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))]/10",
    stat: null,
  },
];

const quickFilters = [
  { label: "Missing email", url: "/search/people", filter: "email=missing" },
  { label: "No company linked", url: "/search/people", filter: "company_id=missing" },
  { label: "High quality (70+)", url: "/search/people", filter: "quality=70-100" },
  { label: "Not contacted", url: "/search/people", filter: "outreach=not_contacted" },
  { label: "Missing domain", url: "/search/companies", filter: "domain=missing" },
  { label: "Recently added", url: "/search/people", filter: "sort=created_desc" },
];

export default function ProspectEnrichPage() {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["search-hub-stats"],
    queryFn: async () => {
      const [contacts, companies, lists, missingEmail, missingDomain, lowQuality] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("lists").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("email", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("domain", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).lt("data_quality_score", 40),
      ]);
      return {
        contacts: contacts.count || 0,
        companies: companies.count || 0,
        lists: lists.count || 0,
        missingEmail: missingEmail.count || 0,
        missingDomain: missingDomain.count || 0,
        lowQuality: lowQuality.count || 0,
      };
    },
  });

  const handleGlobalSearch = () => {
    if (globalSearch.trim()) {
      navigate(`/search/people?q=${encodeURIComponent(globalSearch)}`);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospect & Enrich</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find, verify, and enrich your ideal prospects across every channel.
          </p>
        </div>
      </div>

      {/* Global Search */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across people, companies, and lists..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
                className="pl-10 h-10 text-sm bg-background"
              />
            </div>
            <Button onClick={handleGlobalSearch} disabled={!globalSearch.trim()}>
              <Search className="h-4 w-4 mr-1.5" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.contacts?.toLocaleString() ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Total Contacts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--chart-2))]/10">
              <Building2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.companies?.toLocaleString() ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Total Companies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--chart-4))]/10">
              <List className="h-4 w-4 text-[hsl(var(--chart-4))]" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.lists?.toLocaleString() ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Active Lists</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-2 gap-4">
        {modules.map((m) => (
          <Card key={m.url} className="group cursor-pointer hover:border-primary/30 transition-all hover:shadow-md" onClick={() => navigate(m.url)}>
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{m.title}</h3>
                  {m.stat && stats && (
                    <Badge variant="secondary" className="text-[10px]">
                      {stats[m.stat as keyof typeof stats]?.toLocaleString()}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Filter Shortcuts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Quick Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((f) => (
              <Badge
                key={f.label}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors text-xs py-1 px-2.5"
                onClick={() => navigate(f.url)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enrichment Opportunities */}
      {stats && (stats.missingEmail > 0 || stats.missingDomain > 0 || stats.lowQuality > 0) && (
        <Card className="border-[hsl(var(--chart-3))]/20 bg-[hsl(var(--chart-3))]/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[hsl(var(--chart-3))]" />
              Enrichment Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3">
              {stats.missingEmail > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate("/search/data-enrichment")}>
                  <Zap className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                  <div>
                    <p className="text-xs font-medium">{stats.missingEmail} contacts</p>
                    <p className="text-[10px] text-muted-foreground">missing email</p>
                  </div>
                </div>
              )}
              {stats.missingDomain > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate("/search/data-enrichment")}>
                  <Zap className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                  <div>
                    <p className="text-xs font-medium">{stats.missingDomain} companies</p>
                    <p className="text-[10px] text-muted-foreground">missing domain</p>
                  </div>
                </div>
              )}
              {stats.lowQuality > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate("/search/data-enrichment")}>
                  <Shield className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-xs font-medium">{stats.lowQuality} contacts</p>
                    <p className="text-[10px] text-muted-foreground">low quality (&lt;40)</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-muted-foreground/60 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium">Search Tips</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Use the global search bar to find records across people and companies</li>
              <li>• Apply advanced filters for granular prospecting (email exists, quality score, seniority)</li>
              <li>• Save filtered views to quickly return to your best segments</li>
              <li>• Use the Data Enrichment module to identify records missing key fields</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
