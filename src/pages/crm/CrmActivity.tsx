import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export default function CrmActivity() {
  const { workspaceId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workspaceId) return;
      const { data } = await (supabase as any)
        .from("activities")
        .select("id, activity_type, title, description, occurred_at, contact_id, company_id, source_type, source_id")
        .eq("workspace_id", workspaceId)
        .eq("source_type", "opportunity")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setRows(data ?? []);
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <div className="p-6 space-y-4 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Activity</h1>
          <p className="text-xs text-muted-foreground">Every event logged against an opportunity, newest first.</p>
        </div>
      </div>
      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">No activity yet.</Card>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <Card key={r.id} className="p-3 flex items-start gap-3">
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{(r.activity_type ?? "event").replace(/_/g, " ")}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{r.title}</p>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(r.occurred_at), { addSuffix: true })}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
