import { PageContainer, SectionHeader } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

export default function ApiManagementPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
  const endpoint = `${supabaseUrl}/functions/v1/verification-worker-api`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const examples = [
    { label: "Claim a batch", path: "/claim", body: `{ "limit": 50 }` },
    { label: "Submit result", path: "/submit", body: `{ "result_id": "<uuid>", "status": "valid", "confidence": 95, "source_engine": "smtp-probe" }` },
    { label: "Heartbeat", path: "/heartbeat", body: `{ "worker_id": "worker-eu-1", "status": "online", "in_flight": 12, "avg_latency": 480 }` },
    { label: "Push to dead letter", path: "/dead-letter", body: `{ "workspace_id": "<uuid>", "result_id": "<uuid>", "email": "test@x.com", "reason": "max_retries_exceeded" }` },
    { label: "Quota check / consume", path: "/quota", body: `{ "workspace_id": "<uuid>", "consume": true, "count": 50 }` },
    { label: "Report bounce", path: "/bounce", body: `{ "workspace_id": "<uuid>", "email": "x@y.com", "bounce_type": "hard", "smtp_code": 550 }` },
  ];

  return (
    <PageContainer>
      <SectionHeader title="API Management" subtitle="Worker integration endpoints. Authenticate with the x-worker-secret header." />

      <Card className="p-5 space-y-4">
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
            Send the header <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">x-worker-secret: $VERIFICATION_WORKER_SECRET</code> on every worker call.
            The secret is configured server-side and never exposed to the browser.
          </p>
        </div>
      </Card>

      <SectionHeader title="Endpoints" subtitle="All worker actions are POST and accept/return JSON." />
      <div className="grid gap-3">
        {examples.map((ex) => (
          <Card key={ex.path} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{ex.label}</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">POST {ex.path}</code>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copy(`curl -X POST '${endpoint}${ex.path}' -H 'x-worker-secret: $SECRET' -H 'content-type: application/json' -d '${ex.body}'`, "cURL")}>
                <Terminal className="mr-1.5 h-3.5 w-3.5" /> Copy cURL
              </Button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-3 text-[11px] text-muted-foreground">{ex.body}</pre>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
