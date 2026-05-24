import { PageContainer, SectionHeader, EmptyState } from "@/components/verification/kit";
import { useProviderRules, useUpsertProviderRule, useDeleteProviderRule } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Settings2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function RulesEnginePage() {
  const { data = [], isLoading } = useProviderRules();
  const upsert = useUpsertProviderRule();
  const del = useDeleteProviderRule();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provider_type: "", rule_key: "", rule_value: "{}", is_active: true, notes: "" });

  const save = () => {
    let parsed: any;
    try { parsed = JSON.parse(form.rule_value || "{}"); } catch { return alert("Rule value must be valid JSON"); }
    upsert.mutate({ ...form, rule_value: parsed }, {
      onSuccess: () => { setOpen(false); setForm({ provider_type: "", rule_key: "", rule_value: "{}", is_active: true, notes: "" }); },
    });
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Rules Engine"
        subtitle="Per-provider SMTP behavior rules — greylist windows, accept-then-bounce patterns, rate limits."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />New rule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New provider rule</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Provider</label>
                  <Input value={form.provider_type} onChange={(e) => setForm({ ...form, provider_type: e.target.value })} placeholder="google, outlook, zoho…" /></div>
                <div><label className="text-xs text-muted-foreground">Rule key</label>
                  <Input value={form.rule_key} onChange={(e) => setForm({ ...form, rule_key: e.target.value })} placeholder="greylist_window_seconds" /></div>
                <div><label className="text-xs text-muted-foreground">Rule value (JSON)</label>
                  <Textarea rows={4} value={form.rule_value} onChange={(e) => setForm({ ...form, rule_value: e.target.value })} className="font-mono text-xs" /></div>
                <div><label className="text-xs text-muted-foreground">Notes</label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /><span className="text-sm">Active</span></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={Settings2} title="No rules configured" description="Add provider-specific behavior rules to fine-tune verification logic." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.provider_type}</TableCell>
                  <TableCell className="font-mono text-xs">{r.rule_key}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground max-w-md truncate">{JSON.stringify(r.rule_value)}</TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} onCheckedChange={(c) => upsert.mutate({ ...r, is_active: c })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
