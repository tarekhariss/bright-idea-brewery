import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Cpu, RotateCw, AlertTriangle, ServerCog, Gauge,
  Clock, ShieldAlert, Sparkles,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";

function pct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(0)}%`;
}

function num(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

export default function OperationsDashboardPage() {
  // Workers
  const { data: workers = [] } = useQuery({
    queryKey: ["ops", "workers"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_workers")
        .select("*")
        .order("last_seen_at", { ascending: false });
      return data ?? [];
    },
  });

  // Recent activity logs (last hour, all workers)
  const { data: activity = [] } = useQuery({
    queryKey: ["ops", "activity"],
    refetchInterval: 5000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("worker_activity_logs")
        .select("worker_id,event_type,throughput,in_flight,error_message,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(2000);
      return data ?? [];
    },
  });

  // Queue + recheck + DLQ counts
  const { data: counts } = useQuery({
    queryKey: ["ops", "counts"],
    refetchInterval: 5000,
    queryFn: async () => {
      const [pending, recheck, dlq, processing, done24h, transient24h] = await Promise.all([
        supabase.from("verification_results").select("id", { count: "exact", head: true }).is("verified_at", null).eq("from_cache", false),
        supabase.from("verification_results").select("id", { count: "exact", head: true }).eq("recheck_required", true),
        supabase.from("verification_dead_letter").select("id", { count: "exact", head: true }).is("recovered_at", null),
        supabase.from("verification_results").select("id", { count: "exact", head: true }).not("processing_started_at", "is", null).is("verified_at", null),
        supabase.from("verification_results").select("id", { count: "exact", head: true }).gte("verified_at", new Date(Date.now() - 86400000).toISOString()),
        supabase.from("verification_results").select("id", { count: "exact", head: true }).in("status", ["greylisted", "temporary_failure", "antispam_system", "smtp_protocol"]).gte("verified_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      return {
        pending: pending.count ?? 0,
        recheck: recheck.count ?? 0,
        dlq: dlq.count ?? 0,
        processing: processing.count ?? 0,
        done24h: done24h.count ?? 0,
        transient24h: transient24h.count ?? 0,
      };
    },
  });

  // Provider intelligence (top 12)
  const { data: providers = [] } = useQuery({
    queryKey: ["ops", "providers"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_behavior")
        .select("provider_type,total_verifications,accept_rate,bounce_rate,greylist_rate,reliability_score,recommended_concurrency,avg_latency_ms,avg_retry_delay_seconds,last_seen_at")
        .order("total_verifications", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  // SMTP intelligence: top response patterns last 24h
  const { data: smtpPatterns = [] } = useQuery({
    queryKey: ["ops", "smtp-patterns"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("smtp_patterns")
        .select("provider_type,smtp_code,response_pattern,inferred_status,occurrences,confidence,last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Quality logs
  const { data: quality = [] } = useQuery({
    queryKey: ["ops", "quality"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_quality_logs")
        .select("quality_mode,total_processed,unknown_recovery_attempts,unknown_recovery_success,retry_total,retry_success,greylist_detected,avg_latency_ms,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Throughput series from activity (group by minute)
  const series = (() => {
    const buckets: Record<string, { t: string; throughput: number; in_flight: number; errors: number }> = {};
    for (const a of activity) {
      const m = new Date(a.created_at as string);
      m.setSeconds(0, 0);
      const key = m.toISOString();
      const b = (buckets[key] ||= { t: key, throughput: 0, in_flight: 0, errors: 0 });
      b.throughput += Number(a.throughput ?? 0);
      b.in_flight = Math.max(b.in_flight, Number(a.in_flight ?? 0));
      if (a.error_message) b.errors += 1;
    }
    return Object.values(buckets).slice(-60).map((b) => ({
      ...b,
      label: new Date(b.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  })();

  const onlineWorkers = workers.filter((w: any) => ["online", "idle"].includes(w.status)).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Verification Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Live worker monitoring, queue intelligence, retry pipeline, SMTP and provider behavior.
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live · 5s refresh
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<ServerCog className="h-4 w-4" />} label="Workers" value={`${onlineWorkers}/${workers.length}`} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Pending" value={num(counts?.pending)} />
        <Kpi icon={<Cpu className="h-4 w-4" />} label="Processing" value={num(counts?.processing)} />
        <Kpi icon={<RotateCw className="h-4 w-4" />} label="Awaiting recheck" value={num(counts?.recheck)} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Dead-letter" value={num(counts?.dlq)} />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="Verified 24h" value={num(counts?.done24h)} />
      </div>

      <Tabs defaultValue="workers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="smtp">SMTP Intelligence</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {workers.length === 0 && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No workers reporting heartbeats.</CardContent></Card>
            )}
            {workers.map((w: any) => {
              const stale = w.last_seen_at && Date.now() - new Date(w.last_seen_at).getTime() > 120_000;
              return (
                <Card key={w.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium truncate">{w.worker_id ?? w.id}</CardTitle>
                      <Badge variant={stale ? "destructive" : w.status === "online" ? "default" : "secondary"}>
                        {stale ? "stale" : w.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <Row label="Host" value={w.host ?? "—"} />
                    <Row label="Version" value={w.version ?? "—"} />
                    <Row label="In flight" value={num(w.in_flight)} />
                    <Row label="Batch" value={num(w.batch_size)} />
                    <Row label="Avg latency" value={w.avg_latency ? `${Math.round(w.avg_latency)}ms` : "—"} />
                    <Row
                      label="Last seen"
                      value={w.last_seen_at ? formatDistanceToNow(new Date(w.last_seen_at), { addSuffix: true }) : "—"}
                    />
                    {w.last_error && <div className="text-rose-500">{w.last_error}</div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="throughput">
          <Card>
            <CardHeader><CardTitle className="text-sm">Throughput · last hour</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="throughput" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="in_flight" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Transient failures (24h)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-3xl font-semibold">{num(counts?.transient24h)}</div>
                  <div className="text-xs text-muted-foreground">greylist · temp · antispam · protocol</div>
                </div>
                <Progress className="flex-1" value={Math.min(100, ((counts?.transient24h ?? 0) / Math.max(1, counts?.done24h ?? 1)) * 100)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardHeader><CardTitle className="text-sm">Provider intelligence</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3 text-right">Verifs</th>
                      <th className="py-2 pr-3 text-right">Accept</th>
                      <th className="py-2 pr-3 text-right">Bounce</th>
                      <th className="py-2 pr-3 text-right">Greylist</th>
                      <th className="py-2 pr-3 text-right">Reliability</th>
                      <th className="py-2 pr-3 text-right">Concurrency</th>
                      <th className="py-2 pr-3 text-right">Retry delay</th>
                      <th className="py-2 pr-3 text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p: any) => (
                      <tr key={p.provider_type} className="border-t border-border/60">
                        <td className="py-2 pr-3 font-medium">{p.provider_type}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{num(p.total_verifications)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pct(p.accept_rate)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pct(p.bounce_rate)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pct(p.greylist_rate)}</td>
                        <td className="py-2 pr-3 text-right">
                          <Badge variant={Number(p.reliability_score) >= 70 ? "default" : Number(p.reliability_score) >= 40 ? "secondary" : "destructive"}>
                            {p.reliability_score?.toFixed?.(0) ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.recommended_concurrency}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.avg_retry_delay_seconds}s</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.avg_latency_ms ? `${Math.round(p.avg_latency_ms)}ms` : "—"}</td>
                      </tr>
                    ))}
                    {providers.length === 0 && (
                      <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No provider data yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Top SMTP response patterns</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Response</th>
                      <th className="py-2 pr-3">Inferred</th>
                      <th className="py-2 pr-3 text-right">Seen</th>
                      <th className="py-2 pr-3 text-right">Confidence</th>
                      <th className="py-2 pr-3">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smtpPatterns.map((p: any, i: number) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-2 pr-3">{p.provider_type}</td>
                        <td className="py-2 pr-3 font-mono">{p.smtp_code ?? "—"}</td>
                        <td className="py-2 pr-3 max-w-md truncate text-muted-foreground" title={p.response_pattern}>{p.response_pattern}</td>
                        <td className="py-2 pr-3"><Badge variant="outline">{p.inferred_status ?? "—"}</Badge></td>
                        <td className="py-2 pr-3 text-right tabular-nums">{num(p.occurrences)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pct((p.confidence ?? 0) * 100)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{p.last_seen_at ? formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true }) : "—"}</td>
                      </tr>
                    ))}
                    {smtpPatterns.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No SMTP patterns recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader><CardTitle className="text-sm">Verification quality metrics</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quality.slice().reverse().map((q: any) => ({
                  t: new Date(q.created_at).toLocaleString(),
                  processed: q.total_processed,
                  recovered: q.unknown_recovery_success,
                  greylist: q.greylist_detected,
                  retries: q.retry_total,
                  retry_success: q.retry_success,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="processed" fill="hsl(var(--primary))" />
                  <Bar dataKey="recovered" fill="hsl(var(--accent-foreground))" />
                  <Bar dataKey="greylist" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="retries" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
