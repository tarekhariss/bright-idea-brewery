import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Mail, Linkedin, Globe, Building2, Users, AlertTriangle,
  ArrowRight, ShieldAlert, UserX, Eye, Clock
} from "lucide-react";

interface HealthStats {
  total: number;
  missingEmail: number;
  missingLinkedin: number;
  missingPhone: number;
  missingTitle: number;
  missingCompany: number;
  missingOwner: number;
  dnc: number;
  lowQuality: number;
  medQuality: number;
  highQuality: number;
  unscored: number;
  companyTotal: number;
  companyMissingDomain: number;
  companyMissingIndustry: number;
  companyMissingCountry: number;
  companyMissingOwner: number;
  reviewRows: number;
  staleContacts: number;
}

const EMPTY: HealthStats = {
  total: 0, missingEmail: 0, missingLinkedin: 0, missingPhone: 0, missingTitle: 0,
  missingCompany: 0, missingOwner: 0, dnc: 0,
  lowQuality: 0, medQuality: 0, highQuality: 0, unscored: 0,
  companyTotal: 0, companyMissingDomain: 0, companyMissingIndustry: 0,
  companyMissingCountry: 0, companyMissingOwner: 0,
  reviewRows: 0, staleContacts: 0,
};

export default function DataHealthPage() {
  const navigate = useNavigate();
  const [s, setS] = useState<HealthStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const results = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("email", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("linkedin_url", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("phone", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("job_title", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("company_id", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("owner_id", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("do_not_contact", true),
        supabase.from("contacts").select("id", { count: "exact", head: true }).lt("data_quality_score", 40),
        supabase.from("contacts").select("id", { count: "exact", head: true }).gte("data_quality_score", 40).lt("data_quality_score", 70),
        supabase.from("contacts").select("id", { count: "exact", head: true }).gte("data_quality_score", 70),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("data_quality_score", null),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("domain", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("industry", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("country", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).is("owner_id", null),
        supabase.from("import_job_rows").select("id", { count: "exact", head: true }).eq("review_required", true).eq("status", "review"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).lt("updated_at", thirtyDaysAgo),
      ]);

      const c = (i: number) => results[i].count ?? 0;
      setS({
        total: c(0), missingEmail: c(1), missingLinkedin: c(2), missingPhone: c(3),
        missingTitle: c(4), missingCompany: c(5), missingOwner: c(6), dnc: c(7),
        lowQuality: c(8), medQuality: c(9), highQuality: c(10), unscored: c(11),
        companyTotal: c(12), companyMissingDomain: c(13), companyMissingIndustry: c(14),
        companyMissingCountry: c(15), companyMissingOwner: c(16),
        reviewRows: c(17), staleContacts: c(18),
      });
      setLoading(false);
    }
    fetch();
  }, []);

  const n = (v: number) => (loading ? "—" : v.toLocaleString());
  const pct = (v: number, total: number) => total > 0 ? Math.round((v / total) * 100) : 0;
  const completeness = (missing: number, total: number) => total > 0 ? Math.round(((total - missing) / total) * 100) : 0;

  const contactFields = [
    { label: "Email", missing: s.missingEmail, icon: Mail },
    { label: "LinkedIn", missing: s.missingLinkedin, icon: Linkedin },
    { label: "Phone", missing: s.missingPhone, icon: Users },
    { label: "Job Title", missing: s.missingTitle, icon: Users },
    { label: "Company Link", missing: s.missingCompany, icon: Building2 },
    { label: "Owner", missing: s.missingOwner, icon: UserX },
  ];

  const companyFields = [
    { label: "Domain", missing: s.companyMissingDomain, icon: Globe },
    { label: "Industry", missing: s.companyMissingIndustry, icon: Activity },
    { label: "Country", missing: s.companyMissingCountry, icon: Globe },
    { label: "Owner", missing: s.companyMissingOwner, icon: UserX },
  ];

  const overallScore = s.total > 0
    ? Math.round(((s.highQuality * 100 + s.medQuality * 55 + s.lowQuality * 20) / (s.total - s.unscored || 1)))
    : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Health</h1>
          <p className="text-sm text-muted-foreground">Monitor and improve data quality across your database</p>
        </div>
        {s.reviewRows > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-warning text-warning" onClick={() => navigate("/imports")}>
            <Eye className="h-3.5 w-3.5" /> {n(s.reviewRows)} rows need review
          </Button>
        )}
      </div>

      {/* Overall score + summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="relative">
              <svg className="h-24 w-24" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-muted" />
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                  className={overallScore >= 70 ? "stroke-green-500" : overallScore >= 40 ? "stroke-yellow-500" : "stroke-red-500"}
                  strokeDasharray={`${overallScore * 2.51} 251`} strokeLinecap="round"
                  transform="rotate(-90 50 50)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{loading ? "—" : overallScore}</span>
              </div>
            </div>
            <p className="text-sm font-medium mt-2">Health Score</p>
          </CardContent>
        </Card>

        {[
          { label: "High Quality", value: s.highQuality, pctVal: pct(s.highQuality, s.total), color: "text-green-600" },
          { label: "Medium Quality", value: s.medQuality, pctVal: pct(s.medQuality, s.total), color: "text-yellow-600" },
          { label: "Low Quality", value: s.lowQuality, pctVal: pct(s.lowQuality, s.total), color: "text-red-600" },
          { label: "Unscored", value: s.unscored, pctVal: pct(s.unscored, s.total), color: "text-muted-foreground" },
        ].map((q) => (
          <Card key={q.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{q.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${q.color}`}>{n(q.value)}</div>
              <p className="text-xs text-muted-foreground">{q.pctVal}% of contacts</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attention items */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Do Not Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{n(s.dnc)}</div>
            <p className="text-xs text-muted-foreground">Flagged contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Stale Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{n(s.staleContacts)}</div>
            <p className="text-xs text-muted-foreground">Not updated in 30+ days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-chart-3" /> Review Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{n(s.reviewRows)}</div>
            <p className="text-xs text-muted-foreground">
              {s.reviewRows > 0 ? (
                <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate("/imports")}>Resolve now →</Button>
              ) : "All clear"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contact field completeness */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contact Field Completeness</CardTitle>
            <span className="text-xs text-muted-foreground">{n(s.total)} contacts</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contactFields.map((f) => {
              const comp = completeness(f.missing, s.total);
              return (
                <div key={f.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{f.label}</span>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{comp}%</span>
                  </div>
                  <Progress value={comp} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{n(f.missing)} missing</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Company field completeness */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Company Field Completeness</CardTitle>
            <span className="text-xs text-muted-foreground">{n(s.companyTotal)} companies</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {companyFields.map((f) => {
              const comp = completeness(f.missing, s.companyTotal);
              return (
                <div key={f.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{f.label}</span>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{comp}%</span>
                  </div>
                  <Progress value={comp} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{n(f.missing)} missing</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
