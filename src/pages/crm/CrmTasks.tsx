import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export default function CrmTasks() {
  const { workspaceId } = useAuth();
  const [tab, setTab] = useState<"open" | "completed">("open");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workspaceId) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from("tasks")
        .select("id, title, description, status, priority, due_date, contact_id, company_id, contacts(id, first_name, last_name), companies(id, name), created_at")
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (cancelled) return;
      setTasks((data ?? []).filter((t: any) => tab === "open" ? t.status !== "completed" : t.status === "completed"));
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [workspaceId, tab]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Tasks</h1>
          <p className="text-xs text-muted-foreground">Follow-ups and to-dos across your workspace.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList><TabsTrigger value="open">Open</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger></TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr><th className="text-left p-2.5 font-medium">Task</th><th className="text-left p-2.5 font-medium">Priority</th><th className="text-left p-2.5 font-medium">Due</th><th className="text-left p-2.5 font-medium">Linked to</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">No tasks.</td></tr>
            ) : tasks.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="p-2.5">
                  <p className="font-medium text-sm">{t.title}</p>
                  {t.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>}
                </td>
                <td className="p-2.5"><Badge variant="outline" className="text-[10px] capitalize">{t.priority}</Badge></td>
                <td className="p-2.5 text-xs text-muted-foreground">{t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}</td>
                <td className="p-2.5 text-xs">
                  {t.contacts ? <Link to={`/contacts/${t.contacts.id}`} className="text-primary hover:underline">{t.contacts.first_name} {t.contacts.last_name}</Link>
                    : t.companies ? <Link to={`/companies/${t.companies.id}`} className="text-primary hover:underline">{t.companies.name}</Link>
                    : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
