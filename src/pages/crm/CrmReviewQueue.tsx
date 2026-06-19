/**
 * CrmReviewQueue — human approval queue for AI-detected positive replies.
 * Lists pending items with confidence + reasoning; supports approve / reject.
 * Approve calls approve_review_item RPC which pushes through push_to_crm.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Check, X, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string;
  source_type: string;
  detected_intent: string;
  suggested_status: string;
  confidence: number;
  reasoning: string | null;
  suggested_note: string | null;
  message_excerpt: string | null;
  status: string;
  created_at: string;
  contact_id: string | null;
  resolved_opportunity_id: string | null;
};

export default function CrmReviewQueue() {
  const { workspaceId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "auto_pushed">("pending");
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await (supabase as any).from("crm_review_queue")
      .select("*").eq("workspace_id", workspaceId).eq("status", tab)
      .order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId, tab]);

  const runDetection = async () => {
    if (!workspaceId) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-detect-replies", {
        body: { workspace_id: workspaceId, lookback_hours: 48 },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.skipped) toast.info("Auto-detection is disabled in CRM Settings.");
      else toast.success(`Scanned ${r.scanned}, queued ${r.queued}, auto-pushed ${r.auto_pushed}`);
      load();
    } catch (e: any) { toast.error(e.message ?? "Detection failed"); }
    finally { setRunning(false); }
  };

  const approve = async (id: string) => {
    const { data, error } = await (supabase as any).rpc("approve_review_item", { p_id: id, p_overrides: {} });
    if (error) return toast.error(error.message);
    toast.success("Pushed to CRM");
    load();
  };
  const reject = async (id: string) => {
    const { error } = await (supabase as any).rpc("reject_review_item", { p_id: id, p_reason: null });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Inbox className="h-5 w-5" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Review Queue</h1>
          <p className="text-sm text-muted-foreground">AI-detected positive replies awaiting your approval before becoming CRM opportunities.</p>
        </div>
        <Button variant="outline" size="sm" onClick={runDetection} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Run detection now
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="auto_pushed">Auto-pushed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {tab === "pending" ? "No replies waiting for review. Enable auto-detection in Settings and click Run detection." : "Nothing here yet."}
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{r.detected_intent}</Badge>
                    <Badge variant="secondary">{Math.round(r.confidence * 100)}% confidence</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.source_type.replace("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.reasoning && <div className="text-sm text-muted-foreground">{r.reasoning}</div>}
                  {r.message_excerpt && <div className="text-sm border-l-2 border-muted pl-3 whitespace-pre-wrap line-clamp-4">{r.message_excerpt}</div>}
                  <div className="flex gap-2 pt-1">
                    {tab === "pending" && (
                      <>
                        <Button size="sm" onClick={() => approve(r.id)}><Check className="h-4 w-4 mr-1" />Approve & push</Button>
                        <Button size="sm" variant="outline" onClick={() => reject(r.id)}><X className="h-4 w-4 mr-1" />Reject</Button>
                      </>
                    )}
                    {r.resolved_opportunity_id && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/crm/opportunities/${r.resolved_opportunity_id}`}><ExternalLink className="h-4 w-4 mr-1" />Open opportunity</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
