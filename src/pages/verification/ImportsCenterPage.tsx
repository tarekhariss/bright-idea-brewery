import { useRef, useState } from "react";
import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { useVerificationJobs } from "@/hooks/use-verification-platform";
import { useEnqueueVerification } from "@/hooks/use-verification";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function extractEmails(text: string): string[] {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return Array.from(new Set((text.match(re) ?? []).map((s) => s.toLowerCase())));
}

export default function ImportsCenterPage() {
  const { data = [], isLoading } = useVerificationJobs({ source: "csv_upload" });
  const enqueue = useEnqueueVerification();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [previewCount, setPreviewCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshPreview() {
    let text = pasted;
    const f = fileRef.current?.files?.[0];
    if (f) text = (text ? text + "\n" : "") + (await f.text());
    setPreviewCount(extractEmails(text).length);
  }

  async function handleSubmit() {
    let text = pasted;
    const f = fileRef.current?.files?.[0];
    if (f) text = (text ? text + "\n" : "") + (await f.text());
    const emails = extractEmails(text);
    if (!emails.length) { toast.error("No valid emails detected"); return; }
    await enqueue.mutateAsync({
      name: name || `Import · ${new Date().toLocaleString()}`,
      emails,
      source: "csv_upload",
    });
    setOpen(false);
    setName(""); setPasted(""); setPreviewCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Imports Center"
        subtitle="Verify CSV files of emails. We dedupe against cache and run them through the engine pool."
        action={<Button size="sm" onClick={() => setOpen(true)}><Upload className="mr-2 h-4 w-4" />New import</Button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total imports" value={data.length} icon={Upload} />
        <KpiCard label="Processing" value={data.filter((j: any) => j.status === "processing").length} accent="sky" />
        <KpiCard label="Completed" value={data.filter((j: any) => j.status === "completed").length} accent="emerald" />
        <KpiCard label="Failed" value={data.filter((j: any) => j.status === "failed").length} accent="rose" />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={Upload} title="No imports yet" description="Upload a CSV of emails to start your first verification job." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((j: any) => (
                <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link to={`/verification/jobs/${j.id}`} className="font-medium hover:underline">{j.name ?? `Import ${j.id.slice(0, 8)}`}</Link>
                  </TableCell>
                  <TableCell><StatusPill status={j.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{j.total_count?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.processed_count?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.list_quality_score ? `${Number(j.list_quality_score).toFixed(0)}%` : "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New verification import</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Job name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q2 outbound list" />
            </div>
            <div>
              <Label>CSV or text file</Label>
              <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={refreshPreview} />
            </div>
            <div>
              <Label>Or paste emails</Label>
              <Textarea value={pasted} onChange={(e) => { setPasted(e.target.value); }} onBlur={refreshPreview} rows={5} placeholder="one per line, or any text containing emails" />
            </div>
            {previewCount > 0 && (
              <p className="text-xs text-muted-foreground">{previewCount.toLocaleString()} unique emails detected.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={enqueue.isPending}>
              {enqueue.isPending ? "Queueing…" : "Queue verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
