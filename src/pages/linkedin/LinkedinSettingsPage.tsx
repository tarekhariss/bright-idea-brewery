import { Settings, Save, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLinkedinSafetyRules, useUpsertLinkedinSafetyRules } from "@/hooks/use-linkedin";

export default function LinkedinSettingsPage() {
  const { data: rules, isLoading } = useLinkedinSafetyRules();
  const upsert = useUpsertLinkedinSafetyRules();
  const [form, setForm] = useState({ max_connects_per_day: 20, max_messages_per_day: 50, min_delay_minutes: 2, max_delay_minutes: 10 });

  useEffect(() => {
    if (rules) setForm({
      max_connects_per_day: rules.max_connects_per_day,
      max_messages_per_day: rules.max_messages_per_day,
      min_delay_minutes: rules.min_delay_minutes,
      max_delay_minutes: rules.max_delay_minutes,
    });
  }, [rules]);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Settings className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Workspace-wide safety and execution defaults.</p>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>LinkedIn execution is <b>pending activation</b>. These settings will be enforced once a LinkedIn provider is connected.</span>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Daily Safety Limits</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Max Connects / Day</Label><Input type="number" value={form.max_connects_per_day} onChange={(e) => setForm({ ...form, max_connects_per_day: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
              <div><Label className="text-xs">Max Messages / Day</Label><Input type="number" value={form.max_messages_per_day} onChange={(e) => setForm({ ...form, max_messages_per_day: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
              <div><Label className="text-xs">Min Delay (min)</Label><Input type="number" value={form.min_delay_minutes} onChange={(e) => setForm({ ...form, min_delay_minutes: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
              <div><Label className="text-xs">Max Delay (min)</Label><Input type="number" value={form.max_delay_minutes} onChange={(e) => setForm({ ...form, max_delay_minutes: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => upsert.mutate(form)} disabled={upsert.isPending} className="gap-1.5">
          {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
