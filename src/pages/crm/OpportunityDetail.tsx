import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, User, Building2, Sparkles, MessageSquare, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useOpportunityDetail } from "@/hooks/use-opportunity-detail";
import { useOpportunities, type OpportunityStatus } from "@/hooks/use-opportunities";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { NextBestActionCard } from "@/components/crm/NextBestActionCard";
import { StaleBadge } from "@/components/crm/StaleBadge";

const STATUSES: OpportunityStatus[] = [
  "interested", "qualified", "meeting_requested", "meeting_booked",
  "proposal_rfq", "won", "lost", "not_fit", "bad_timing",
];

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const { opportunity, notes, timeline, loading, addNote, reload } = useOpportunityDetail(id);
  const { stages, transition } = useOpportunities({ includeClosed: true });
  const { staleDays } = useCrmSettings();
  const [note, setNote] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  async function generateSummary() {
    if (!id) return;
    setGenLoading(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("crm-ai-summary", {
        body: { opportunity_id: id },
      });
      if (error) {
        const ctx: any = (error as any).context;
        const status = ctx?.status ?? ctx?.statusCode;
        const message = ctx?.body?.message ?? ctx?.body?.error ?? error.message ?? "AI request failed";
        if (status === 503) toast.error("AI is not configured for this workspace. Showing rule-based suggestions instead.");
        else if (status === 429) toast.error("AI is rate-limited. Try again in a moment.");
        else if (status === 402) toast.error("AI credits exhausted. Add credits to continue.");
        else toast.error(`AI summary failed: ${message}`);
        return;
      }
      if (data?.error) {
        toast.error(`AI summary failed: ${data.message ?? data.error}`);
        return;
      }
      toast.success("AI summary updated");
      await reload();
    } finally {
      setGenLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!opportunity) {
    return (
      <div className="p-6">
        <Link to="/crm/opportunities" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to opportunities
        </Link>
        <div className="mt-4">Opportunity not found.</div>
      </div>
    );
  }

  const name =
    opportunity.title ||
    `${opportunity.contact?.first_name ?? ""} ${opportunity.contact?.last_name ?? ""}`.trim() ||
    opportunity.company?.name ||
    "Untitled opportunity";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/crm/opportunities" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">{name}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {opportunity.contact && (
              <Link to={`/contacts/${opportunity.contact.id}`} className="inline-flex items-center gap-1 hover:underline">
                <User className="h-3.5 w-3.5" />
                {`${opportunity.contact.first_name ?? ""} ${opportunity.contact.last_name ?? ""}`.trim() || opportunity.contact.email}
              </Link>
            )}
            {opportunity.company && (
              <Link to={`/companies/${opportunity.company.id}`} className="inline-flex items-center gap-1 hover:underline">
                <Building2 className="h-3.5 w-3.5" />
                {opportunity.company.name}
              </Link>
            )}
            <Badge variant="outline">{opportunity.source_channel}</Badge>
            <StaleBadge opportunity={opportunity} staleDays={staleDays} />
            {opportunity.urgency && opportunity.urgency !== "normal" && (
              <Badge variant="secondary" className="capitalize">{opportunity.urgency} urgency</Badge>
            )}
            {typeof opportunity.icp_fit_score === "number" && (
              <Badge variant="outline">ICP {opportunity.icp_fit_score}</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={opportunity.status}
            onValueChange={async (v) => {
              await transition(opportunity.id, null, v as OpportunityStatus);
              reload();
            }}
          >
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={opportunity.stage_id ?? ""}
            onValueChange={async (v) => {
              await transition(opportunity.id, v, null);
              reload();
            }}
          >
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.stage_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <NextBestActionCard opportunity={opportunity} staleDays={staleDays} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> AI Opportunity Summary
              </CardTitle>
              <Button size="sm" variant="outline" onClick={generateSummary} disabled={genLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${genLoading ? "animate-spin" : ""}`} />
                {opportunity.ai_summary ? (genLoading ? "Refreshing…" : "Refresh") : (genLoading ? "Generating…" : "Generate")}
              </Button>
            </CardHeader>
            <CardContent className="pt-0 text-sm space-y-2">
              {opportunity.ai_summary ? (
                <>
                  <div className="whitespace-pre-wrap">{opportunity.ai_summary}</div>
                  {opportunity.ai_generated_at && (
                    <div className="text-[11px] text-muted-foreground">
                      Generated {new Date(opportunity.ai_generated_at).toLocaleString()}
                    </div>
                  )}
                  {opportunity.risk_flags && opportunity.risk_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {opportunity.risk_flags.map((r, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-red-500/40 text-red-700 dark:text-red-300">{r}</Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">
                  No AI summary yet. Click <strong>Generate</strong> to summarise this opportunity, suggest objections, and score ICP fit.
                  Rule-based next-best-action above always works without AI.
                </div>
              )}
            </CardContent>
          </Card>
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline"><Clock className="h-3.5 w-3.5 mr-1" /> Timeline</TabsTrigger>
              <TabsTrigger value="notes"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-2">
              <Card>
                <CardContent className="p-4">
                  {timeline.length === 0 && (
                    <div className="text-sm text-muted-foreground">No activity yet.</div>
                  )}
                  <ol className="space-y-3">
                    {timeline.map((e) => (
                      <li key={e.id} className="border-l-2 border-primary/30 pl-3">
                        <div className="text-sm font-medium">{e.title}</div>
                        {e.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{e.description}</div>}
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          {new Date(e.occurred_at).toLocaleString()} · {e.kind}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-3">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" rows={3} />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={async () => { if (await addNote(note)) setNote(""); }}>Add note</Button>
                  </div>
                </CardContent>
              </Card>
              {notes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notes yet.</div>
              ) : (
                notes.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        {n.author?.full_name ?? n.author?.email ?? "User"} · {new Date(n.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row label="Priority" value={<Badge variant="secondary">{opportunity.priority}</Badge>} />
              <Row label="Owner" value={opportunity.owner?.full_name ?? opportunity.owner?.email ?? "—"} />
              <Row label="Source" value={`${opportunity.source_channel}${opportunity.source_campaign_type ? ` · ${opportunity.source_campaign_type} campaign` : ""}`} />
              {opportunity.source_thread_id && (
                <Row label="Source thread" value={<span className="text-xs font-mono truncate max-w-[160px] inline-block">{opportunity.source_thread_id.slice(0, 8)}…</span>} />
              )}
              <Row label="Next action" value={opportunity.next_action_at ? new Date(opportunity.next_action_at).toLocaleString() : "—"} />
              <Row label="Created" value={new Date(opportunity.created_at).toLocaleString()} />
              <Row label="Last activity" value={opportunity.last_activity_at ? new Date(opportunity.last_activity_at).toLocaleString() : "—"} />
              {opportunity.closed_at && <Row label="Closed" value={new Date(opportunity.closed_at).toLocaleString()} />}
              {opportunity.close_reason && <Row label="Close reason" value={opportunity.close_reason} />}
              {opportunity.deal_id && (
                <Row label="Linked deal" value={<Link to={`/deals/deals`} className="text-primary hover:underline">View deal</Link>} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
