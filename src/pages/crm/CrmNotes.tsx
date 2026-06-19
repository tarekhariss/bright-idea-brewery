import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export default function CrmNotes() {
  const { workspaceId } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workspaceId) return;
      const { data } = await (supabase as any)
        .from("opportunity_notes")
        .select("id, body, created_at, author_id, opportunity_id, opportunities(id, title, contact:contacts(first_name, last_name), company:companies(name))")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setNotes(data ?? []);
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <div className="p-6 space-y-4 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Notes</h1>
          <p className="text-xs text-muted-foreground">All notes written on opportunities, newest first.</p>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading…</Card>
      ) : notes.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">No notes yet.</Card>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const opp = n.opportunities;
            const subject = opp?.title || `${opp?.contact?.first_name ?? ""} ${opp?.contact?.last_name ?? ""}`.trim() || opp?.company?.name || "Opportunity";
            return (
              <Card key={n.id} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Link to={`/crm/opportunities/${opp?.id}`} className="text-xs font-medium text-primary hover:underline">{subject}</Link>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
