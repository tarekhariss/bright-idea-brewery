/**
 * CrmBulkJobs — list of background bulk-push jobs with live progress.
 * Surfaces total/processed/created/updated/failed counts and lets the user
 * retry failed rows. Read-only audit log for compliance.
 */
import { useEffect, useState } from "react";
import { Briefcase, RefreshCw, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Job = {
  id: string; source_kind: string; status: string;
  total: number; processed: number;
  created_count: number; updated_count: number; failed_count: number;
  created_at: string; started_at: string | null; completed_at: string | null;
  error_message: string | null;
};

export default function CrmBulkJobs() {
  const { workspaceId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await (supabase as any).from("crm_bulk_push_jobs")
      .select("*").eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }).limit(50);
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId]);
  useEffect(() => {
    const i = setInterval(() => {
      if (jobs.some((j) => j.status === "running" || j.status === "queued")) load();
    }, 4000);
    return () => clearInterval(i);
  });

  const retry = async (id: string) => {
    const { error } = await supabase.functions.invoke("crm-bulk-push-runner", { body: { job_id: id, retry_failed: true } });
    if (error) toast.error(error.message); else { toast.success("Retry started"); load(); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Briefcase className="h-5 w-5" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Bulk Push Jobs</h1>
          <p className="text-sm text-muted-foreground">Background jobs that push selections from Contacts, Companies, Search, and Lists into the CRM.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No bulk jobs yet. Use "Push to CRM" on large selections to queue one.</div>
          ) : (
            <ul className="divide-y">
              {jobs.map((j) => {
                const pct = j.total ? Math.round((j.processed / j.total) * 100) : 0;
                return (
                  <li key={j.id} className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{j.source_kind}</Badge>
                      <Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(j.created_at).toLocaleString()}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{j.processed} / {j.total}</span>
                      <span className="text-emerald-600">+{j.created_count} created</span>
                      <span className="text-blue-600">{j.updated_count} updated</span>
                      <span className="text-destructive">{j.failed_count} failed</span>
                      {j.failed_count > 0 && j.status === "completed" && (
                        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => retry(j.id)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Retry failed
                        </Button>
                      )}
                    </div>
                    {j.error_message && <div className="text-xs text-destructive">{j.error_message}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
