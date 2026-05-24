import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVerificationJob, useVerificationResults } from "@/hooks/use-verification";
import { PageContainer, SectionHeader, StatusPill, EmptyState } from "@/components/verification/kit";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Download, RefreshCw, Activity, ShieldCheck, ShieldAlert,
  Server, Cpu, Globe, FileSpreadsheet, FileText, AlertTriangle, Sparkles, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

// --- Status taxonomy (canonical enterprise breakdown) ---
type StatusKey =
  | "ok" | "ok_for_all" | "email_disabled" | "invalid_syntax" | "dead_server"
  | "invalid_mx" | "disposable" | "antispam_system" | "smtp_protocol"
  | "spamtrap" | "unknown" | "risky" | "catch_all" | "role_based";

const STATUS_META: Record<StatusKey, { label: string; tone: string; ring: string }> = {
  ok:              { label: "OK",              tone: "text-emerald-500", ring: "ring-emerald-500/30 bg-emerald-500/5" },
  ok_for_all:      { label: "OK for All",      tone: "text-emerald-400", ring: "ring-emerald-400/30 bg-emerald-400/5" },
  email_disabled:  { label: "Email Disabled",  tone: "text-zinc-400",    ring: "ring-zinc-500/20  bg-zinc-500/5" },
  invalid_syntax:  { label: "Invalid Syntax",  tone: "text-rose-500",    ring: "ring-rose-500/30  bg-rose-500/5" },
  dead_server:     { label: "Dead Server",     tone: "text-rose-400",    ring: "ring-rose-400/30  bg-rose-400/5" },
  invalid_mx:      { label: "Invalid MX",      tone: "text-rose-500",    ring: "ring-rose-500/30  bg-rose-500/5" },
  disposable:      { label: "Disposable",      tone: "text-fuchsia-400", ring: "ring-fuchsia-400/30 bg-fuchsia-400/5" },
  antispam_system: { label: "Antispam System", tone: "text-amber-500",   ring: "ring-amber-500/30 bg-amber-500/5" },
  smtp_protocol:   { label: "SMTP Protocol",   tone: "text-amber-400",   ring: "ring-amber-400/30 bg-amber-400/5" },
  spamtrap:        { label: "Spamtrap",        tone: "text-red-500",     ring: "ring-red-500/30   bg-red-500/5" },
  unknown:         { label: "Unknown",         tone: "text-zinc-400",    ring: "ring-zinc-500/20  bg-zinc-500/5" },
  risky:           { label: "Risky",           tone: "text-orange-400",  ring: "ring-orange-400/30 bg-orange-400/5" },
  catch_all:       { label: "Catch-all",       tone: "text-yellow-400",  ring: "ring-yellow-400/30 bg-yellow-400/5" },
  role_based:      { label: "Role-based",      tone: "text-violet-400",  ring: "ring-violet-400/30 bg-violet-400/5" },
};

const STATUS_ORDER: StatusKey[] = [
  "ok","ok_for_all","email_disabled","invalid_syntax","dead_server","invalid_mx",
  "disposable","antispam_system","smtp_protocol","spamtrap","unknown","risky","catch_all","role_based",
];

function bucketResult(r: any): StatusKey {
  if (r.is_role_based) return "role_based";
  if (r.is_disposable) return "disposable";
  if (r.is_catch_all || r.status === "catch_all") return "catch_all";
  switch (r.status) {
    case "valid":           return "ok";
    case "ok_for_all":      return "ok_for_all";
    case "invalid_syntax":  return "invalid_syntax";
    case "invalid_mx":      return "invalid_mx";
    case "dead_server":     return "dead_server";
    case "antispam_system": return "antispam_system";
    case "smtp_protocol":   return "smtp_protocol";
    case "spamtrap":        return "spamtrap";
    case "email_disabled":  return "email_disabled";
    case "risky":           return "risky";
    case "unknown":         return "unknown";
    case "invalid":         return "dead_server";
    default:                return "unknown";
  }
}

const FRESHNESS_TONE: Record<string, string> = {
  fresh: "text-emerald-500", reverified: "text-emerald-400",
  aging: "text-amber-400", stale: "text-orange-400", expired: "text-rose-500",
};

const UNKNOWN_SUBCLASS_META: Record<string, { label: string; tone: string; hint: string }> = {
  likely_valid:        { label: "Likely valid",        tone: "text-emerald-400", hint: "Clean SMTP signals — safe to attempt send." },
  likely_invalid:      { label: "Likely invalid",      tone: "text-rose-400",    hint: "Weak signals — recommend suppression." },
  temporary_failure:   { label: "Temp failure",        tone: "text-amber-400",   hint: "4xx response — retry on recovery pass." },
  greylisted:          { label: "Greylisted",          tone: "text-amber-400",   hint: "Server asked us to try again later." },
  provider_blocked:    { label: "Provider blocked",    tone: "text-orange-400",  hint: "Blocked by reputation filter (Proofpoint, Spamhaus, …)." },
  rate_limited:        { label: "Rate limited",        tone: "text-orange-400",  hint: "Provider throttled us — back off and retry." },
  tls_failure:         { label: "TLS failure",         tone: "text-rose-400",    hint: "STARTTLS handshake failed mid-session." },
  smtp_disconnect:     { label: "SMTP disconnect",     tone: "text-rose-400",    hint: "Server closed the connection abnormally." },
  timeout:             { label: "Timeout",             tone: "text-zinc-400",    hint: "Server didn't respond in time." },
  temporary_dns_issue: { label: "DNS issue",           tone: "text-zinc-400",    hint: "MX records did not resolve." },
  high_risk_unknown:   { label: "High-risk unknown",   tone: "text-rose-400",    hint: "Multiple risk signals — do not send." },
};

function ConfidenceCell({ row }: { row: any }) {
  const breakdown = row.confidence_breakdown as { factors?: Array<{ k: string; w: number; why: string }>; mode?: string; provider?: string } | null;
  const score = row.confidence_score != null ? Number(row.confidence_score) : (row.confidence != null ? Number(row.confidence) / 100 : null);
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-xs tabular-nums underline-offset-2 hover:underline">{pct}</button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs">
        <div className="font-medium mb-1">Confidence breakdown</div>
        <div className="text-muted-foreground mb-2">
          Mode: {breakdown?.mode ?? "—"} · Provider: {breakdown?.provider ?? row.provider_type ?? "—"}
        </div>
        {breakdown?.factors?.length ? (
          <ul className="space-y-1">
            {breakdown.factors.map((f, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate">{f.why}</span>
                <span className={`tabular-nums ${f.w > 0 ? "text-emerald-500" : f.w < 0 ? "text-rose-500" : "text-zinc-400"}`}>
                  {f.w > 0 ? "+" : ""}{(f.w * 100).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground">No breakdown stored for this verdict.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}



type ExportMode = "safe_to_send" | "recommended" | "simplified" | "all" | "custom";

export default function VfJobDetailPage() {
  const { id } = useParams();
  const jobId = id ?? null;
  const { data: job, refetch: refetchJob } = useVerificationJob(jobId);
  const { data: rows = [], refetch: refetchRows } = useVerificationResults(jobId);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [filterFresh, setFilterFresh] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("recommended");
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [exporting, setExporting] = useState(false);

  // Per-status counts
  const buckets = useMemo(() => {
    const c: Record<StatusKey, number> = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as any;
    for (const r of rows) c[bucketResult(r)]++;
    return c;
  }, [rows]);

  const total = rows.length;
  const processed = job?.processed_count ?? 0;
  const grandTotal = job?.total_count ?? total;
  const pendingCount = Math.max(0, grandTotal - processed);
  const failedCount = job?.failed_count ?? 0;
  const dlqCount = job?.dead_letter_count ?? 0;
  const cacheRate = job?.cache_hit_rate ?? 0;
  const avgLatency = job?.avg_latency_ms ?? 0;
  const progressPct = grandTotal > 0 ? Math.min(100, Math.round((processed / grandTotal) * 100)) : 0;

  // --- Reuse / live-vs-cache execution trace ---
  const liveSmtpCount     = job?.live_smtp_count ?? 0;
  const recoveryCount     = job?.recovery_count ?? 0;
  const reusedCache       = job?.reused_from_cache_count ?? job?.cached_hit_count ?? 0;
  const skippedLive       = job?.skipped_live_verification_count ?? 0;
  const cachePolicy       = job?.cache_policy ?? "default";
  const verificationQ     = job?.verification_quality ?? "balanced";
  const isAllReused       = grandTotal > 0 && liveSmtpCount === 0 && reusedCache >= grandTotal;

  // Throughput / ETA — only meaningful for live work
  const throughputPerMin = useMemo(() => {
    if (!job?.started_at || liveSmtpCount === 0) return 0;
    const elapsedMin = Math.max(0.5, (Date.now() - new Date(job.started_at).getTime()) / 60000);
    return Math.round(liveSmtpCount / elapsedMin);
  }, [job?.started_at, liveSmtpCount]);
  const etaMin = throughputPerMin > 0 ? Math.ceil(pendingCount / throughputPerMin) : null;


  // Freshness distribution
  const freshDist = useMemo(() => {
    const f: Record<string, number> = { fresh: 0, reverified: 0, aging: 0, stale: 0, expired: 0 };
    for (const r of rows) if (r.freshness_label) f[r.freshness_label] = (f[r.freshness_label] ?? 0) + 1;
    return Object.entries(f).map(([k, v]) => ({ label: k, value: v }));
  }, [rows]);

  // Deliverability score distribution (bucketed)
  const deliverabilityDist = useMemo(() => {
    const buckets = [
      { label: "0-20",  min: 0,   max: 20,  count: 0 },
      { label: "20-40", min: 20,  max: 40,  count: 0 },
      { label: "40-60", min: 40,  max: 60,  count: 0 },
      { label: "60-80", min: 60,  max: 80,  count: 0 },
      { label: "80-100",min: 80,  max: 101, count: 0 },
    ];
    for (const r of rows) {
      const s = Number(r.deliverability_score ?? -1);
      if (s < 0) continue;
      const b = buckets.find((b) => s >= b.min && s < b.max);
      if (b) b.count++;
    }
    return buckets;
  }, [rows]);

  // Provider mix
  const providerMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const p = r.provider_type || r.mx_provider || "unknown";
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [rows]);

  // Bounce risk indicator buckets
  const bounceRiskDist = useMemo(() => {
    const b = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of rows) {
      const s = Number(r.bounce_risk_score ?? 0);
      if (s >= 75) b.critical++;
      else if (s >= 50) b.high++;
      else if (s >= 25) b.medium++;
      else b.low++;
    }
    return [
      { label: "Low",      value: b.low,      fill: "hsl(142 70% 45%)" },
      { label: "Medium",   value: b.medium,   fill: "hsl(48 95% 55%)" },
      { label: "High",     value: b.high,     fill: "hsl(20 90% 55%)" },
      { label: "Critical", value: b.critical, fill: "hsl(0 85% 55%)" },
    ];
  }, [rows]);

  // Confidence trend over verification order
  const confidenceTrend = useMemo(() => {
    const ordered = [...rows]
      .filter((r) => r.verified_at)
      .sort((a, b) => new Date(a.verified_at).getTime() - new Date(b.verified_at).getTime());
    const step = Math.max(1, Math.floor(ordered.length / 40));
    const out: { i: number; conf: number; deliver: number }[] = [];
    for (let i = 0; i < ordered.length; i += step) {
      const slice = ordered.slice(i, i + step);
      const conf = slice.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / slice.length;
      const deliver = slice.reduce((s, r) => s + Number(r.deliverability_score ?? 0), 0) / slice.length;
      out.push({ i, conf: Math.round(conf), deliver: Math.round(deliver) });
    }
    return out;
  }, [rows]);

  // Workers (for live processing intel)
  const { data: workers = [] } = useQuery({
    queryKey: ["ops-workers-mini"],
    refetchInterval: 7000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("verification_workers")
        .select("worker_id,status,last_seen_at,in_flight,avg_latency_ms").limit(20);
      return data ?? [];
    },
  });
  const onlineWorkers = workers.filter((w: any) => w.status === "online" || w.status === "idle").length;

  // Filter table rows
  const filteredRows = useMemo(() => {
    return rows
      .filter((r: any) => {
        if (filterStatus !== "all" && bucketResult(r) !== filterStatus) return false;
        if (filterRisk !== "all" && r.risk_level !== filterRisk) return false;
        if (filterFresh !== "all" && r.freshness_label !== filterFresh) return false;
        if (search && !r.email?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .slice(0, 500);
  }, [rows, filterStatus, filterRisk, filterFresh, search]);

  async function runExport() {
    if (!jobId) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-verification-results`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          mode: exportMode,
          format: exportFormat,
          preserve_original_columns: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `verification_${exportMode}_${jobId.slice(0, 8)}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(fileUrl);
      toast.success("Export ready");
      setExportOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!job) {
    return <PageContainer><div className="text-muted-foreground text-sm">Loading job…</div></PageContainer>;
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/verification/jobs" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline w-3 h-3 mr-1" />Back to jobs
            </Link>
          </div>
          <h1 className="text-xl font-semibold mt-1">{job.name || `Job ${job.id.slice(0, 8)}`}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <StatusPill status={job.status} />
            <span>{job.source}</span>
            <span>Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
            {job.source_file_name && <span className="truncate">· {job.source_file_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchJob(); refetchRows(); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => setExportOpen(true)}>
            <Download className="w-3.5 h-3.5 mr-1.5" />Export results
          </Button>
        </div>
      </div>

      {/* Live processing intelligence */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Execution trace</span>
            <Badge variant="outline" className="text-[10px] uppercase">{verificationQ}</Badge>
            <Badge variant="outline" className="text-[10px]">cache: {cachePolicy}</Badge>
            {isAllReused && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">
                All rows reused from cache · no live SMTP performed
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {processed.toLocaleString()} / {grandTotal.toLocaleString()} ({progressPct}%)
          </span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
          <Mini icon={ShieldCheck} label="Processed" value={processed.toLocaleString()} tone="text-emerald-500" />
          <Mini icon={Clock}       label="Pending"   value={pendingCount.toLocaleString()} tone="text-amber-400" />
          <Mini icon={AlertTriangle} label="Failed"  value={failedCount.toLocaleString()} tone={failedCount > 0 ? "text-rose-500" : "text-foreground"} />
          <Mini icon={RefreshCw}   label="Recovery"  value={recoveryCount.toLocaleString()} tone="text-sky-400" />
          <Mini
            icon={Activity}
            label="Throughput"
            value={liveSmtpCount === 0 ? "— (no live)" : `${throughputPerMin}/min`}
            tone={liveSmtpCount === 0 ? "text-muted-foreground" : "text-foreground"}
          />
          <Mini
            icon={Server}
            label="Workers"
            value={liveSmtpCount === 0 ? "n/a" : `${onlineWorkers}/${workers.length}`}
            tone={liveSmtpCount === 0 ? "text-muted-foreground" : onlineWorkers > 0 ? "text-emerald-500" : "text-rose-500"}
          />
          <Mini
            icon={Cpu}
            label="Avg latency"
            value={liveSmtpCount === 0 ? "— (cached)" : `${Math.round(avgLatency)}ms`}
            tone={liveSmtpCount === 0 ? "text-muted-foreground" : "text-foreground"}
          />
          <Mini icon={Sparkles}    label="ETA" value={etaMin === null ? "—" : etaMin < 1 ? "<1m" : `${etaMin}m`} tone="text-foreground" />
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground flex-wrap">
          <span>Live SMTP: <b className="text-foreground tabular-nums">{liveSmtpCount.toLocaleString()}</b></span>
          <span>Reused from cache: <b className="text-foreground tabular-nums">{reusedCache.toLocaleString()}</b></span>
          <span>Skipped live: <b className="text-foreground tabular-nums">{skippedLive.toLocaleString()}</b></span>
          <span>Cache hit: <b className="text-foreground tabular-nums">{cacheRate}%</b></span>
          <span>Dead letter: <b className={dlqCount > 0 ? "text-amber-400" : "text-foreground"}>{dlqCount}</b></span>
          <span>Greylisted recovery: <b className="text-foreground">{rows.filter((r: any) => r.greylisting_detected).length}</b></span>
        </div>
      </Card>


      {/* Status Intelligence Cards (14) */}
      <div>
        <SectionHeader title="Status intelligence" subtitle="Enterprise-grade breakdown across the full deliverability taxonomy" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {STATUS_ORDER.map((k) => {
            const count = buckets[k];
            const pct = total > 0 ? (count / total) * 100 : 0;
            const meta = STATUS_META[k];
            const rowsOfBucket = rows.filter((r: any) => bucketResult(r) === k);
            const avgConf = rowsOfBucket.length
              ? Math.round(rowsOfBucket.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / rowsOfBucket.length)
              : null;
            const freshShare = rowsOfBucket.length
              ? Math.round(100 * rowsOfBucket.filter((r) => r.freshness_label === "fresh" || r.freshness_label === "reverified").length / rowsOfBucket.length)
              : null;
            const recheckShare = rowsOfBucket.length
              ? Math.round(100 * rowsOfBucket.filter((r) => r.recheck_required).length / rowsOfBucket.length)
              : 0;
            return (
              <button
                key={k}
                onClick={() => setFilterStatus(k)}
                className={`text-left rounded-lg ring-1 ${meta.ring} p-3 transition hover:ring-2 ${filterStatus === k ? "ring-2" : ""}`}
              >
                <div className={`text-[11px] uppercase tracking-wide ${meta.tone}`}>{meta.label}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold tabular-nums">{count.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>conf {avgConf ?? "—"}</span>
                  <span>fresh {freshShare ?? "—"}%</span>
                  {recheckShare > 0 && <span className="text-amber-400">recheck {recheckShare}%</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <SectionHeader title="Deliverability score distribution" subtitle="Higher = safer" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deliverabilityDist}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(160 70% 45%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Bounce risk" subtitle="Predicted bounce tiers" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bounceRiskDist} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {bounceRiskDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            {bounceRiskDist.map((d) => (
              <div key={d.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                <span>{d.label}: <b className="text-foreground tabular-nums">{d.value}</b></span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionHeader title="Confidence & deliverability trend" subtitle="By verification order" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={confidenceTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="i" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="conf" stroke="hsl(200 80% 55%)" dot={false} name="Confidence" />
                <Line type="monotone" dataKey="deliver" stroke="hsl(160 70% 45%)" dot={false} name="Deliverability" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Freshness" subtitle="Result aging distribution" />
          <div className="space-y-1.5 mt-2">
            {freshDist.map((f) => {
              const pct = total > 0 ? (f.value / total) * 100 : 0;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-[11px]">
                    <span className={FRESHNESS_TONE[f.label] ?? "text-muted-foreground"}>{f.label}</span>
                    <span className="tabular-nums text-muted-foreground">{f.value} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded overflow-hidden">
                    <div className="h-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-3">
          <SectionHeader title="Provider mix" subtitle="Top MX/email providers in this list" />
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerMix} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(280 60% 60%)" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Results table with intelligence filters */}
      <Card className="p-4">
        <Tabs defaultValue="results">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="workers">Workers</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 flex-wrap">
              <Input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-xs" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterFresh} onValueChange={setFilterFresh}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Freshness" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All freshness</SelectItem>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="reverified">Reverified</SelectItem>
                  <SelectItem value="aging">Aging</SelectItem>
                  <SelectItem value="stale">Stale</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="results" className="mt-3">
            {filteredRows.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No matching rows" description="Adjust filters to see more results." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Sub-class</TableHead>
                      <TableHead className="text-right">Conf</TableHead>
                      <TableHead className="text-right">Deliver</TableHead>
                      <TableHead className="text-right">Bounce risk</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Freshness</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>SMTP</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Recheck</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredRows.map((r: any) => {
                      const k = bucketResult(r);
                      const sub = r.unknown_subclass ? UNKNOWN_SUBCLASS_META[r.unknown_subclass] : null;
                      const deliverPct = r.deliverability_score != null ? Math.round(Number(r.deliverability_score) * 100) : null;
                      const bouncePct = r.bounce_risk_score != null ? Math.round(Number(r.bounce_risk_score) * 100) : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-[11px]">{r.email}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-[10px] ${STATUS_META[k].tone}`}>{STATUS_META[k].label}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {r.result_source ? (
                              <span
                                title={r.finalization_reason ?? ""}
                                className={
                                  r.result_source === "cache"     ? "text-amber-400" :
                                  r.result_source === "recovery"  ? "text-sky-400" :
                                  r.result_source === "live_smtp" ? "text-emerald-400" :
                                  "text-muted-foreground"
                                }
                              >
                                {r.result_source}
                                {r.pass_number > 1 ? ` ·p${r.pass_number}` : ""}
                              </span>
                            ) : r.from_cache ? <span className="text-amber-400">cache</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {sub ? (
                              <span title={sub.hint} className={sub.tone}>{sub.label}</span>
                            ) : r.unknown_subclass ? (
                              <span className="text-muted-foreground">{r.unknown_subclass}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right"><ConfidenceCell row={r} /></TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{deliverPct != null ? deliverPct : "—"}</TableCell>
                          <TableCell className={`text-right tabular-nums text-xs ${bouncePct != null && bouncePct >= 50 ? "text-rose-400" : ""}`}>{bouncePct != null ? bouncePct : "—"}</TableCell>
                          <TableCell className="text-xs">{r.risk_level ?? "—"}</TableCell>
                          <TableCell className={`text-xs ${FRESHNESS_TONE[r.freshness_label] ?? ""}`}>{r.freshness_label ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.provider_detected ?? r.provider_type ?? r.mx_provider ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{r.smtp_code ?? ""} {r.smtp_result ?? r.smtp_response ?? ""}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={r.claimed_by_worker ?? ""}>
                            {r.claimed_by_worker ? `${r.claimed_by_worker}${r.worker_version ? ` (${r.worker_version})` : ""}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{r.recheck_required ? <Badge variant="outline" className="text-[10px] text-amber-400">required</Badge> : "—"}</TableCell>
                        </TableRow>
                      );

                    })}
                  </TableBody>
                </Table>
                {rows.length > filteredRows.length && (
                  <div className="text-[11px] text-muted-foreground mt-2 text-center">
                    Showing first {filteredRows.length} of {rows.length} matching rows · use Export for the full dataset.
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="workers" className="mt-3">
            {workers.length === 0 ? (
              <EmptyState icon={Server} title="No workers reporting" description="No verification worker has sent a heartbeat recently." />
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Worker</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">In flight</TableHead>
                  <TableHead className="text-right">Avg latency</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {workers.map((w: any) => (
                    <TableRow key={w.worker_id}>
                      <TableCell className="font-mono text-xs">{w.worker_id}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] ${w.status === "online" || w.status === "idle" ? "text-emerald-500" : "text-rose-500"}`}>{w.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{w.in_flight ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{w.avg_latency_ms ?? "—"}ms</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.last_seen_at ? formatDistanceToNow(new Date(w.last_seen_at), { addSuffix: true }) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Export verification results</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Export mode</div>
              <div className="grid grid-cols-1 gap-2">
                {([
                  ["safe_to_send", "Safe to Send", "Highest-confidence valid emails, fresh, low bounce risk."],
                  ["recommended",  "Recommended",  "Balanced quality — usable for warmed inboxes."],
                  ["simplified",   "Simplified",   "Just valid/catch-all — minimum cleaning."],
                  ["all",          "All Emails",   "Every row, regardless of status."],
                  ["custom",       "Custom Filters", "(Coming soon — use intelligence filters above for now.)"],
                ] as [ExportMode, string, string][]).map(([k, label, desc]) => (
                  <button
                    key={k}
                    onClick={() => setExportMode(k)}
                    className={`text-left rounded-md border p-2.5 transition ${exportMode === k ? "border-emerald-500 bg-emerald-500/5" : "border-border hover:border-emerald-500/40"}`}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Format</div>
              <div className="flex gap-2">
                <Button variant={exportFormat === "csv" ? "default" : "outline"} size="sm" onClick={() => setExportFormat("csv")}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" />CSV
                </Button>
                <Button variant={exportFormat === "xlsx" ? "default" : "outline"} size="sm" onClick={() => setExportFormat("xlsx")}>
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />XLSX
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
              <Globe className="inline w-3 h-3 mr-1" />
              All original uploaded columns are preserved in original order. Intelligence columns
              (<span className="text-foreground">status, confidence, deliverability_score, risk_level, freshness_label, …</span>) are prepended.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={runExport} disabled={exporting}>
              {exporting ? "Preparing…" : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Mini({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className={`text-base font-semibold tabular-nums mt-0.5 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
