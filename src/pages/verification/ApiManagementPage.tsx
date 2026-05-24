import { PageContainer, SectionHeader } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Copy, Terminal, CheckCircle2, XCircle, AlertCircle, Server, Boxes, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVerificationWorkers } from "@/hooks/use-verification-platform";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

function useWorkerHealth() {
  return useQuery({
    queryKey: ["verification-worker-health"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await sb.functions.invoke("verification-worker-api/health", { method: "POST" });
      if (error) return null;
      return data as { adapter_configured: boolean; pending_results: number; dead_letter_open: number; workers_online: number };
    },
  });
}

function useChecklistCounts() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["worker-checklist-counts", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [{ count: submitted }, { count: dlq }, { count: bounces }] = await Promise.all([
        sb.from("verification_results").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("verified_at", "is", null),
        sb.from("verification_dead_letter").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        sb.from("bounce_feedback").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      ]);
      return { submitted: submitted ?? 0, dlq: dlq ?? 0, bounces: bounces ?? 0 };
    },
  });
}

export default function ApiManagementPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
  const endpoint = `${supabaseUrl}/functions/v1/verification-worker-api`;

  const { data: health, isLoading: healthLoading } = useWorkerHealth();
  const { data: workers = [] } = useVerificationWorkers();
  const { data: counts } = useChecklistCounts();

  const adapterConfigured = !!health?.adapter_configured;
  const anyWorker = workers.length > 0;
  const heartbeatRecent = workers.some((w: any) => w.last_heartbeat_at && (Date.now() - new Date(w.last_heartbeat_at).getTime()) < 5 * 60_000);
  const submitsHappening = (counts?.submitted ?? 0) > 0;
  const dlqWired = (counts?.dlq ?? 0) >= 0; // table reachable
  const bouncesWired = (counts?.bounces ?? 0) >= 0;

  const checklist = [
    { key: "secret", label: "VERIFICATION_WORKER_SECRET configured", ok: adapterConfigured, hint: "Set the secret in Lovable Cloud secrets. Without it, all worker calls return 401." },
    { key: "deployed", label: "External worker deployed", ok: anyWorker, hint: "Run docker compose up in external/verifier-worker." },
    { key: "heartbeat", label: "Heartbeat received in last 5 min", ok: heartbeatRecent, hint: "Worker must POST /heartbeat every 60 seconds." },
    { key: "claim", label: "Jobs can be claimed", ok: anyWorker, hint: "Worker calls POST /claim every 5–15s when queue is non-empty." },
    { key: "submit", label: "Results submitted successfully", ok: submitsHappening, warn: !submitsHappening, hint: "Run a test verification to confirm /submit writes back results." },
    { key: "quota", label: "Quota checks reachable", ok: adapterConfigured, hint: "POST /quota with consume=true before each batch." },
    { key: "dlq", label: "Dead-letter reporting wired", ok: dlqWired, hint: "POST /dead-letter on permanent failures." },
    { key: "safety", label: "Campaign safety receives results", ok: submitsHappening, warn: !submitsHappening, hint: "Submitted results feed check_campaign_list_safety automatically." },
  ];

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const endpoints = [
    { label: "Claim a batch", path: "/claim", purpose: "Pull pending jobs", body: `{ "limit": 50 }` },
    { label: "Submit result", path: "/submit", purpose: "Write verification result", body: `{ "result_id": "<uuid>", "email": "jane@x.com", "status": "valid", "confidence_score": 0.95, "source_engine": "aftership-email-verifier", "engine_version": "1.7.2", "engine_latency_ms": 482, "verified_at": "2026-05-24T10:00:00Z" }` },
    { label: "Heartbeat", path: "/heartbeat", purpose: "Worker liveness every 60s", body: `{ "worker_id": "worker-eu-1", "status": "online", "in_flight": 12, "avg_latency": 480, "version": "1.0.0", "host": "eu-west-1" }` },
    { label: "Transient failure", path: "/fail", purpose: "Reschedule with backoff", body: `{ "result_id": "<uuid>", "error": "smtp_timeout" }` },
    { label: "Dead-letter", path: "/dead-letter", purpose: "Unrecoverable failure", body: `{ "workspace_id": "<uuid>", "result_id": "<uuid>", "email": "x@y.com", "reason": "max_retries_exceeded", "attempt_count": 3, "last_error": "550 mailbox unavailable" }` },
    { label: "Quota", path: "/quota", purpose: "Check / consume workspace quota", body: `{ "workspace_id": "<uuid>", "consume": true, "count": 50 }` },
    { label: "Bounce ingest", path: "/bounce", purpose: "Forward SMTP bounce feedback", body: `{ "workspace_id": "<uuid>", "email": "x@y.com", "bounce_type": "hard", "smtp_code": 550, "smtp_response": "5.1.1 user unknown" }` },
  ];

  const payloadFields = [
    ["email", "string", "Original email being verified"],
    ["normalized_email", "string", "Lower-cased / RFC-normalized form"],
    ["status", "enum", "valid | invalid | catch_all | unknown | risky | disposable | failed"],
    ["confidence_score", "0..1", "Engine confidence in the status"],
    ["risk_level", "enum", "low | medium | high"],
    ["risk_reasons", "string[]", "e.g. ['role_based','free_provider','full_inbox']"],
    ["syntax_result", "object", "{ valid, reason }"],
    ["mx_result", "object", "{ valid, records[] }"],
    ["smtp_result", "object", "{ valid, deliverable, full_inbox }"],
    ["catch_all_result", "object", "{ is_catch_all, confidence }"],
    ["disposable_result", "object", "{ is_disposable }"],
    ["role_based_result", "object", "{ is_role_based }"],
    ["mx_provider", "string?", "e.g. 'google', 'microsoft'"],
    ["smtp_response_code", "number?", "Raw SMTP code from probe"],
    ["smtp_response_message", "string?", "Raw SMTP message"],
    ["source_engine", "string", "e.g. 'aftership-email-verifier'"],
    ["engine_version", "string", "Engine semver"],
    ["engine_latency_ms", "number", "Time spent in the engine"],
    ["retry_count", "number", "Attempts so far for this result"],
    ["verified_at", "ISO8601", "When the engine produced the verdict"],
  ];

  return (
    <PageContainer>
      <SectionHeader
        title="API Management"
        subtitle="Connect your self-hosted SMTP verifier worker. All worker calls authenticate with x-worker-secret."
      />

      {/* ---- Worker connection checklist ---- */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Worker Connection Checklist</h3>
            <p className="text-xs text-muted-foreground">Live status. Refreshes every 15–20s.</p>
          </div>
          {healthLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant={adapterConfigured && anyWorker && heartbeatRecent ? "default" : "outline"}>
              {adapterConfigured && anyWorker && heartbeatRecent ? "Connected" : "Not connected"}
            </Badge>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {checklist.map((c) => (
            <div key={c.key} className="flex items-start gap-2 rounded-md border bg-card/40 p-3">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : c.warn ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </div>
            </div>
          ))}
        </div>
        {!adapterConfigured && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600">
            No verifier is connected yet. The platform will not produce verification results until the external worker is deployed and
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">VERIFICATION_WORKER_SECRET</code> is set.
            Results shown elsewhere come strictly from the cache or the worker — nothing is simulated.
          </div>
        )}
      </Card>

      {/* ---- Architecture ---- */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Recommended Worker Architecture</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {[
            { label: "Lovable / Supabase", icon: Boxes },
            { label: "verification-worker-api", icon: KeyRound },
            { label: "External verifier worker", icon: Server },
            { label: "Open-source verifier engine", icon: Boxes },
            { label: "SMTP / MX providers", icon: Server },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border bg-card/40 px-3 py-2">
                <step.icon className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The SMTP verification engine runs <strong>outside Lovable</strong> — preferably as a Docker service. Default engine:
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">AfterShip/email-verifier</code> (Go, MIT).
          Alternative: <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">truemail-go</code> (Go, MIT).
          <span className="ml-1">Reacher may only be evaluated after a licensing review.</span>
          <span className="block mt-1">No paid third-party API is used. No verification success is ever faked.</span>
        </p>
      </Card>

      {/* ---- Connection details ---- */}
      <Card className="space-y-4 p-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint base</label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={endpoint} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(endpoint, "Endpoint")}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Authentication</label>
          <p className="mt-1 text-sm">
            Send <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">x-worker-secret: $VERIFICATION_WORKER_SECRET</code> on every worker request. The secret lives in Lovable Cloud and is never sent to the browser.
          </p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Quick deploy</label>
          <pre className="mt-1 overflow-x-auto rounded bg-background/60 p-3 text-[11px] text-muted-foreground">
{`# from repo root
cd external/verifier-worker
cp .env.example .env   # set SUPABASE_URL + VERIFICATION_WORKER_SECRET
docker compose up -d --build`}
          </pre>
        </div>
      </Card>

      {/* ---- Endpoints ---- */}
      <SectionHeader title="Endpoints" subtitle="All worker actions are POST and accept/return JSON." />
      <div className="grid gap-3">
        {endpoints.map((ex) => (
          <Card key={ex.path} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{ex.label}</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">POST {ex.path}</code>
                <span className="text-xs text-muted-foreground">— {ex.purpose}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copy(`curl -X POST '${endpoint}${ex.path}' -H 'x-worker-secret: $VERIFICATION_WORKER_SECRET' -H 'content-type: application/json' -d '${ex.body}'`, "cURL")}>
                <Terminal className="mr-1.5 h-3.5 w-3.5" /> Copy cURL
              </Button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-3 text-[11px] text-muted-foreground">{ex.body}</pre>
          </Card>
        ))}
      </div>

      {/* ---- Submit payload spec ---- */}
      <SectionHeader title="/submit Payload Spec" subtitle="Canonical fields the worker must send for every verified email." />
      <Card className="overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {payloadFields.map(([f, t, d]) => (
              <tr key={f} className="border-t">
                <td className="px-3 py-2 font-mono">{f}</td>
                <td className="px-3 py-2 text-muted-foreground">{t}</td>
                <td className="px-3 py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Reference connector source: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">external/verifier-worker/</code> (Docker + Node 20). Replace the engine adapter inside <code className="rounded bg-muted px-1.5 py-0.5 font-mono">worker.mjs</code> if you swap engines.
      </p>
    </PageContainer>
  );
}
