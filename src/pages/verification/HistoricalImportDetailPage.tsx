import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, SectionHeader, KpiCard, StatusPill, EmptyState } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Database, Brain, Sparkles, Activity, ShieldCheck, AlertTriangle, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  CartesianGrid, Legend,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

const sb = supabase as any;

const STATUS_COLORS: Record<string, string> = {
  valid: "hsl(142 71% 45%)", invalid: "hsl(0 72% 51%)", catch_all: "hsl(38 92% 50%)",
  unknown: "hsl(220 9% 60%)", risky: "hsl(24 95% 53%)", role_based: "hsl(262 83% 58%)",
  disposable: "hsl(340 82% 52%)", suppressed: "hsl(0 0% 30%)", failed: "hsl(0 84% 60%)",
};

const TIER_COLORS: Record<string, string> = {
  safe: "hsl(142 71% 45%)", recommended: "hsl(200 90% 50%)",
  risky: "hsl(38 92% 50%)", unsafe: "hsl(0 72% 51%)",
};

const FRESH_COLORS: Record<string, string> = {
  fresh: "hsl(142 71% 45%)", aging: "hsl(200 90% 50%)",
  stale: "hsl(38 92% 50%)", expired: "hsl(0 72% 51%)",
};

function toEntries(obj: any): { name: string; value: number }[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .filter(([, v]) => typeof v === "number" && (v as number) > 0)
    .map(([k, v]) => ({ name: k, value: Number(v) }));
}

function TopList({ title, data, icon: Icon, accent }: { title: string; data: { name: string; value: number }[]; icon: any; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data captured.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.slice(0, 10).map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{d.name}</span>
              <Badge variant="outline" className={accent}>{d.value.toLocaleString()}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function HistoricalImportDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: ds, isLoading } = useQuery({
    queryKey: ["imported_dataset", id],
    queryFn: async () => {
      const { data, error } = await sb.from("imported_datasets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 4000,
  });

  const { data: previewProspects = [] } = useQuery({
    queryKey: ["imported_dataset_prospects", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb
        .from("contacts")
        .select("id,email,first_name,last_name,company_name_raw,job_title,country,data_quality_score,last_verified_at")
        .contains("enrichment_data", { imported_datasets: [id] })
        .order("last_verified_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
  });

  const stats = (ds?.stats ?? {}) as any;

  const statusData = useMemo(() => {
    const keys = ["valid","invalid","catch_all","risky","unknown","disposable","role_based","suppressed","failed"];
    return keys.filter((k) => stats[k]).map((k) => ({ name: k, value: stats[k] }));
  }, [stats]);

  const subtypeData = useMemo(() => toEntries(stats.subtypes), [stats]);
  const freshnessData = useMemo(() => toEntries(stats.freshness), [stats]);
  const tierData = useMemo(() => toEntries(stats.tiers), [stats]);

  if (isLoading) {
    return <PageContainer><Card className="p-8 text-sm text-muted-foreground">Loading dataset…</Card></PageContainer>;
  }
  if (!ds) {
    return (
      <PageContainer>
        <EmptyState icon={Database} title="Dataset not found" description="This historical import may have been deleted." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <Link to="/verification/historical-imports">
          <Button variant="ghost" size="sm"><ChevronLeft className="mr-1 h-4 w-4" />All datasets</Button>
        </Link>
        <StatusPill status={ds.status} />
      </div>

      <SectionHeader
        title={ds.filename ?? "(unnamed dataset)"}
        subtitle={
          <>
            <Badge variant="outline" className="mr-2">{ds.source}</Badge>
            <span className="uppercase text-muted-foreground">{ds.file_type}</span>
            {ds.uploaded_at && <span className="ml-2 text-muted-foreground">· {formatDistanceToNow(new Date(ds.uploaded_at), { addSuffix: true })}</span>}
          </>
        }
      />

      <div className="rounded-md border bg-primary/5 px-4 py-3 text-sm">
        <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
        This dataset improved intelligence for{" "}
        <b>{(stats.domains_learned ?? 0).toLocaleString()}</b> domains,{" "}
        <b>{(stats.providers_learned ?? 0).toLocaleString()}</b> providers, and{" "}
        <b>{((stats.prospects_created ?? 0) + (stats.prospects_merged ?? 0)).toLocaleString()}</b> prospects.
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Rows imported" value={(ds.processed_count ?? 0).toLocaleString()} hint={`${(ds.row_count ?? 0).toLocaleString()} total`} icon={Database} />
        <KpiCard label="Prospects added" value={(stats.prospects_created ?? 0).toLocaleString()} accent="emerald" icon={Users} />
        <KpiCard label="Duplicates merged" value={(stats.prospects_merged ?? 0).toLocaleString()} accent="sky" />
        <KpiCard label="Skipped duplicates" value={(stats.skipped_duplicates ?? 0).toLocaleString()} accent="amber" />
        <KpiCard label="Safe to send" value={(stats.safe_to_send ?? 0).toLocaleString()} accent="emerald" icon={ShieldCheck} />
        <KpiCard label="Risky" value={(stats.risky_total ?? stats.risky ?? 0).toLocaleString()} accent="rose" icon={AlertTriangle} />
        <KpiCard label="Catch-all" value={(stats.catch_all ?? 0).toLocaleString()} accent="amber" />
        <KpiCard label="Unknown" value={(stats.unknown ?? 0).toLocaleString()} />
        <KpiCard label="Disposable" value={(stats.disposable ?? stats.subtypes?.disposable ?? 0).toLocaleString()} accent="rose" />
        <KpiCard label="Spamtrap" value={(stats.subtypes?.spamtrap ?? 0).toLocaleString()} accent="rose" />
        <KpiCard label="Dead server" value={(stats.subtypes?.dead_server ?? 0).toLocaleString()} accent="rose" />
        <KpiCard label="Invalid MX" value={(stats.subtypes?.invalid_mx ?? 0).toLocaleString()} accent="rose" />
        <KpiCard label="Email disabled" value={(stats.subtypes?.email_disabled ?? 0).toLocaleString()} accent="amber" />
        <KpiCard label="Provider blocked" value={(stats.subtypes?.provider_blocked ?? 0).toLocaleString()} accent="amber" />
        <KpiCard label="Greylisted" value={(stats.greylisted_patterns ?? stats.subtypes?.greylisted ?? 0).toLocaleString()} accent="sky" />
        <KpiCard label="Domains learned" value={(stats.domains_learned ?? 0).toLocaleString()} icon={Brain} accent="violet" />
        <KpiCard label="Providers learned" value={(stats.providers_learned ?? 0).toLocaleString()} icon={Brain} accent="violet" />
        <KpiCard label="Avg confidence" value={stats.avg_confidence != null ? `${Math.round(stats.avg_confidence)}` : "—"} hint="0–100" />
        <KpiCard label="Avg bounce prob" value={stats.avg_bounce_probability != null ? `${(stats.avg_bounce_probability * 100).toFixed(1)}%` : "—"} accent="amber" />
        <KpiCard label="Avg safe-to-send" value={stats.avg_safe_to_send_score != null ? `${Math.round(stats.avg_safe_to_send_score)}` : "—"} accent="emerald" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Status distribution</h3>
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? "hsl(220 9% 60%)"} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No data.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Campaign safety tiers</h3>
          {tierData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {tierData.map((d) => <Cell key={d.name} fill={TIER_COLORS[d.name] ?? "hsl(220 9% 60%)"} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No data.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Freshness breakdown</h3>
          {freshnessData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={freshnessData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value">
                  {freshnessData.map((d) => <Cell key={d.name} fill={FRESH_COLORS[d.name] ?? "hsl(220 9% 60%)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No data.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Provider breakdown</h3>
          {Object.keys(stats.top_providers ?? {}).length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={toEntries(stats.top_providers).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No data.</p>}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Subtype detection</h3>
          {subtypeData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subtypeData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">No subtype signals detected.</p>}
        </Card>
      </div>

      {/* Top lists */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TopList title="Top industries" icon={Users} data={toEntries(stats.top_industries)} />
        <TopList title="Top countries" icon={Users} data={toEntries(stats.top_countries)} />
        <TopList title="Top providers" icon={Brain} data={toEntries(stats.top_providers)} />
        <TopList title="Top safe domains" icon={ShieldCheck} data={toEntries(stats.top_safe_domains)} accent="bg-emerald-500/10 text-emerald-600 border-emerald-500/20" />
        <TopList title="Top risky domains" icon={AlertTriangle} data={toEntries(stats.top_risky_domains)} accent="bg-rose-500/10 text-rose-600 border-rose-500/20" />
        <TopList title="Top repeated companies" icon={Users} data={toEntries(stats.top_companies)} />
      </div>

      {/* Merge summary */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Duplicate merge summary</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-xs">
          <div><div className="text-muted-foreground">New prospects created</div><div className="text-xl font-semibold">{(stats.prospects_created ?? 0).toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">Existing prospects merged</div><div className="text-xl font-semibold">{(stats.prospects_merged ?? 0).toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">Skipped duplicates in file</div><div className="text-xl font-semibold">{(stats.skipped_duplicates ?? 0).toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">Failed rows</div><div className="text-xl font-semibold">{(ds.failed_count ?? 0).toLocaleString()}</div></div>
        </div>
      </Card>

      {/* Imported prospect previews */}
      <Card>
        <div className="border-b px-4 py-3 text-sm font-semibold">Imported prospect previews</div>
        {previewProspects.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">No prospects linked yet (or auto-seed was disabled).</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewProspects.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.email}</TableCell>
                  <TableCell className="text-xs">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-xs">{p.company_name_raw ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.job_title ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.country ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{p.data_quality_score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Learning impact summary */}
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4" />Learning impact</h3>
        <p className="text-xs text-muted-foreground">
          Aggregates from this dataset were folded into <code>domain_intelligence</code>, <code>provider_behavior</code>,
          <code> confidence_learning</code>, <code>smtp_learning</code>, and <code>bounce_intelligence</code>. Future verification,
          confidence scoring, cache decisions, and unknown recovery now benefit from this history — without treating it as live truth.
        </p>
      </Card>
    </PageContainer>
  );
}
