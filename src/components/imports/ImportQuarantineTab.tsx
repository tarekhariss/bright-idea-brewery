import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Loader2, Check, X, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";

const REASON_LABELS: Record<string, string> = {
  no_valid_email: "No valid email",
  no_linkedin: "No LinkedIn URL",
  no_company: "No company name",
  malformed_email: "Malformed email",
  shifted_row: "Shifted/malformed row",
};

export function ImportQuarantineTab({ importJobId }: { importJobId: string }) {
  const qc = useQueryClient();
  const { enabled: v2 } = useIntelligenceV2();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["import-quarantine", importJobId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("import_quarantine_rows") as any)
        .select("*")
        .eq("import_job_id", importJobId)
        .order("row_index", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!importJobId && v2,
  });

  if (!v2) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Import Quarantine is part of Intelligence v2 and is not enabled for this workspace.
        </CardContent>
      </Card>
    );
  }

  const rows = data ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const pending = rows.filter((r) => r.status === "pending").length;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const doScan = async () => {
    setScanBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("scan_import_quarantine", { p_import_job_id: importJobId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast.success(`Quarantine scan: ${row?.quarantined ?? 0} flagged of ${row?.scanned ?? 0} scanned`);
      qc.invalidateQueries({ queryKey: ["import-quarantine", importJobId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Scan failed");
    } finally {
      setScanBusy(false);
    }
  };

  const decide = async (ids: string[], status: "approved" | "excluded") => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from("import_quarantine_rows") as any)
        .update({ status, decided_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} row(s) ${status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["import-quarantine", importJobId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Identity Quarantine</span>
            <Badge variant="outline" className="text-[10px]">{rows.length} total · {pending} pending</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={doScan} disabled={scanBusy} className="gap-1.5">
              {scanBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Re-scan rows
            </Button>
            <Button variant="outline" size="sm" disabled={selected.size === 0 || busy} onClick={() => decide([...selected], "approved")} className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> Approve ({selected.size})
            </Button>
            <Button variant="outline" size="sm" disabled={selected.size === 0 || busy} onClick={() => decide([...selected], "excluded")} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Exclude ({selected.size})
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Rows here are missing all three identity anchors (valid email, LinkedIn URL, company). They are <strong>not</strong> counted in Prospect Search, readiness, or Engage until you approve them.
        </p>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></TableHead>
                <TableHead className="text-xs">Row #</TableHead>
                <TableHead className="text-xs">Reasons</TableHead>
                <TableHead className="text-xs">Detected</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">No quarantined rows. Run a scan to detect identity-less rows.</TableCell></TableRow>
              ) : rows.map((r) => {
                const raw = r.raw_row ?? {};
                const detected = [raw.email ?? raw.Email, raw.company ?? raw.Company, raw.linkedin_url ?? raw.linkedin].filter(Boolean).join(" · ") || "—";
                return (
                  <TableRow key={r.id} className="h-10">
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => {
                      const next = new Set(selected); if (v) next.add(r.id); else next.delete(r.id); setSelected(next);
                    }} /></TableCell>
                    <TableCell className="text-xs">{r.row_index ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(r.reasons ?? []).map((reason: string) => (
                          <Badge key={reason} variant="outline" className="text-[10px]">{REASON_LABELS[reason] ?? reason}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={detected}>{detected}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "outline"} className="text-[10px] capitalize">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(r)}><Eye className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <SheetContent>
            <SheetHeader><SheetTitle>Raw row #{preview?.row_index}</SheetTitle></SheetHeader>
            <pre className="mt-4 text-xs bg-muted/40 p-3 rounded-md overflow-auto max-h-[70vh]">{JSON.stringify(preview?.raw_row, null, 2)}</pre>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}
