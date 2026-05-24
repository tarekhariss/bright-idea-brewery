import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageShell } from "@/components/PageShell";
import { AlertTriangle, CheckCircle2, Upload, Trash2, Plus } from "lucide-react";
import {
  useEnqueueVerification, useVerificationHealth, useVerificationJobs,
  useSuppressionList, useAddSuppression, useRemoveSuppression, type VerificationStatus,
  type CachePolicy,
} from "@/hooks/use-verification";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";


const STATUS_COLOR: Record<VerificationStatus, string> = {
  safe: "bg-emerald-100 text-emerald-700 border-emerald-200",
  valid: "bg-green-100 text-green-700 border-green-200",
  invalid: "bg-red-100 text-red-700 border-red-200",
  risky: "bg-orange-100 text-orange-700 border-orange-200",
  catch_all: "bg-yellow-100 text-yellow-700 border-yellow-200",
  disposable: "bg-rose-100 text-rose-700 border-rose-200",
  role_based: "bg-purple-100 text-purple-700 border-purple-200",
  unknown: "bg-gray-100 text-gray-600 border-gray-200",
  suppressed: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-gray-100 text-gray-600 border-gray-200",
};

function StatusBadge({ s }: { s: VerificationStatus }) {
  return <Badge variant="outline" className={`text-[11px] ${STATUS_COLOR[s] ?? ""}`}>{s}</Badge>;
}

export default function VerificationPage() {
  const { data: health } = useVerificationHealth();
  const { data: jobs = [] } = useVerificationJobs();
  const enqueue = useEnqueueVerification();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [quality, setQuality] = useState<"fast" | "balanced" | "high_accuracy">("balanced");
  const [cachePolicy, setCachePolicy] = useState<CachePolicy | "auto">("auto");
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    return jobs.reduce(
      (acc: any, j: any) => {
        acc.total += j.total_count ?? 0;
        acc.valid += (j.safe_count ?? 0) + (j.valid_count ?? 0);
        acc.invalid += j.invalid_count ?? 0;
        acc.risky += (j.risky_count ?? 0) + (j.catch_all_count ?? 0);
        return acc;
      },
      { total: 0, valid: 0, invalid: 0, risky: 0 }
    );
  }, [jobs]);

  function extractEmails(text: string): string[] {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return Array.from(new Set((text.match(re) ?? []).map((s) => s.toLowerCase())));
  }

  async function handleSubmit() {
    let text = pasted;
    const f = fileRef.current?.files?.[0];
    if (f) text = (text ? text + "\n" : "") + (await f.text());
    const emails = extractEmails(text);
    if (!emails.length) { return; }
    await enqueue.mutateAsync({
      name: name || `Job · ${new Date().toLocaleString()}`,
      emails,
      quality,
      cache_policy: cachePolicy === "auto" ? undefined : cachePolicy,
    });
    setOpen(false);
    setName(""); setPasted("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <PageShell
      title="Email Verification"
      description="First-party verification powered by your self-hosted SMTP engine. Smart cache reuses only deterministic results; weak/unknown rows always re-verify live."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="w-4 h-4 mr-2" />New verification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Verify emails</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Job name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea
                placeholder="Paste one email per line, or upload a CSV below"
                rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)}
              />
              <Input type="file" accept=".csv,.txt" ref={fileRef} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Quality</div>
                  <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast — cheap, allow cache</SelectItem>
                      <SelectItem value="balanced">Balanced — recommended</SelectItem>
                      <SelectItem value="high_accuracy">High Accuracy — full live + recovery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Cache policy</div>
                  <Select value={cachePolicy} onValueChange={(v: any) => setCachePolicy(v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (default per quality)</SelectItem>
                      <SelectItem value="trusted_cache">Use trusted cache (reuse anything fresh)</SelectItem>
                      <SelectItem value="default">Smart reuse (valid + deterministic only)</SelectItem>
                      <SelectItem value="recheck_weak">Recheck weak results only</SelectItem>
                      <SelectItem value="force_live">Force live re-verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                High Accuracy defaults to <b>Force live</b>. Unknown / Risky / Catch-all / low-confidence rows
                never auto-reuse; they enter staged SMTP + recovery passes.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={enqueue.isPending}>Queue verification</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >

      {!health?.adapter_configured && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Execution provider required</AlertTitle>
          <AlertDescription>
            The verification engine adapter is not configured. Cached results are returned instantly and new emails will queue,
            but live SMTP verification will only begin once your external worker (e.g. AfterShip email-verifier or truemail-go)
            is connected to <code>verification-worker-api</code> with the <code>VERIFICATION_WORKER_SECRET</code> header.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="suppression">Suppression list</TabsTrigger>
          <TabsTrigger value="health">Engine health</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total verified</div><div className="text-2xl font-semibold tabular-nums">{totals.total}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Valid/Safe</div><div className="text-2xl font-semibold text-emerald-600 tabular-nums">{totals.valid}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Invalid</div><div className="text-2xl font-semibold text-red-600 tabular-nums">{totals.invalid}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Risky / Catch-all</div><div className="text-2xl font-semibold text-orange-600 tabular-nums">{totals.risky}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent jobs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Quality</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell><Link className="hover:underline" to={`/tools/verification/${j.id}`}>{j.name}</Link></TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{j.source}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{j.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{j.processed_count}/{j.total_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{j.list_quality_score ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {j.created_at ? formatDistanceToNow(new Date(j.created_at), { addSuffix: true }) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!jobs.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No verification jobs yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppression"><SuppressionTab /></TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader><CardTitle className="text-base">Verification engine</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {health?.adapter_configured
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Adapter configured</Badge>
                  : <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200"><AlertTriangle className="w-3 h-3 mr-1" />Execution provider required</Badge>}
                <div className="text-sm text-muted-foreground">Pending results: <span className="tabular-nums">{health?.pending_results ?? 0}</span></div>
              </div>
              <div className="text-sm space-y-2">
                <p className="text-muted-foreground">
                  Point your external verifier (AfterShip <code>email-verifier</code>, <code>truemail-go</code>, etc.) at:
                </p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`POST  /functions/v1/verification-worker-api/claim   { "limit": 50 }
POST  /functions/v1/verification-worker-api/submit  { result_id, status, confidence, ... }
POST  /functions/v1/verification-worker-api/retry   { result_id, error }
POST  /functions/v1/verification-worker-api/bounce  { workspace_id, email, bounce_type, ... }

Header: x-worker-secret: <VERIFICATION_WORKER_SECRET>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function SuppressionTab() {
  const { data = [] } = useSuppressionList();
  const add = useAddSuppression();
  const remove = useRemoveSuppression();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("manual");
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Suppression list</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-sm" />
          <Input placeholder="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-[160px]" />
          <Button onClick={async () => { if (!email) return; await add.mutateAsync({ email, reason }); setEmail(""); }}>
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Email</TableHead><TableHead>Reason</TableHead><TableHead>Source</TableHead><TableHead>Added</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.email_normalized}</TableCell>
                <TableCell><Badge variant="outline" className="text-[11px]">{s.reason}</Badge></TableCell>
                <TableCell><span className="text-xs text-muted-foreground">{s.source}</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : ""}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No suppressed emails.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { StatusBadge as VerificationStatusBadge };
