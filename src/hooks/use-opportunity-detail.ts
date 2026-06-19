/**
 * use-opportunity-detail — single-opportunity loader for the CRM record page.
 * Pulls the opportunity, its notes, status history, tasks (linked by contact),
 * and merged activity timeline (activities + opportunity_status_history).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Opportunity } from "./use-opportunities";

export interface OpportunityNote {
  id: string;
  body: string;
  author_id: string | null;
  author?: { id: string; full_name: string | null; email: string | null } | null;
  pinned: boolean;
  created_at: string;
}

export interface OpportunityStatusEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_at: string;
  changed_by: string | null;
}

export interface TimelineEntry {
  id: string;
  kind: "activity" | "status" | "note";
  title: string;
  description?: string | null;
  occurred_at: string;
  meta?: Record<string, any>;
}

export function useOpportunityDetail(id: string | undefined) {
  const { workspaceId, user } = useAuth();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [notes, setNotes] = useState<OpportunityNote[]>([]);
  const [history, setHistory] = useState<OpportunityStatusEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: opp }, { data: noteRows }, { data: hist }, { data: acts }] = await Promise.all([
        (supabase as any).from("opportunities").select(
          `id, workspace_id, owner_id, contact_id, company_id, deal_id, pipeline_id, stage_id,
           status, priority, source_channel, source_campaign_type, source_campaign_id,
           source_thread_type, source_thread_id, source_message_id, title, intent_signal,
           next_action_at, last_activity_at, closed_at, close_reason, created_at, updated_at,
           contact:contacts(id, first_name, last_name, email),
           company:companies(id, name)`
        ).eq("id", id).maybeSingle(),
        (supabase as any).from("opportunity_notes").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }),
        (supabase as any).from("opportunity_status_history").select("*").eq("opportunity_id", id).order("changed_at", { ascending: false }),
        (supabase as any).from("activities").select("id, activity_type, title, description, occurred_at, metadata")
          .eq("source_type", "opportunity").eq("source_id", id).order("occurred_at", { ascending: false }).limit(200),
      ]);

      if (opp?.owner_id) {
        const { data: ownerProfile } = await (supabase as any)
          .from("profiles").select("id, full_name, email").eq("id", opp.owner_id).maybeSingle();
        opp.owner = ownerProfile ?? null;
      }
      setOpportunity(opp as Opportunity | null);

      const noteAuthorIds = Array.from(new Set((noteRows ?? []).map((n: any) => n.author_id).filter(Boolean)));
      let authorMap: Record<string, any> = {};
      if (noteAuthorIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, full_name, email").in("id", noteAuthorIds);
        (profs ?? []).forEach((p: any) => { authorMap[p.id] = p; });
      }
      const fullNotes: OpportunityNote[] = (noteRows ?? []).map((n: any) => ({
        ...n, author: n.author_id ? authorMap[n.author_id] ?? null : null,
      }));
      setNotes(fullNotes);
      setHistory((hist ?? []) as OpportunityStatusEvent[]);

      // Merge timeline
      const items: TimelineEntry[] = [];
      (acts ?? []).forEach((a: any) => {
        items.push({
          id: `act-${a.id}`, kind: "activity",
          title: a.title, description: a.description,
          occurred_at: a.occurred_at, meta: a.metadata,
        });
      });
      (hist ?? []).forEach((h: any) => {
        items.push({
          id: `st-${h.id}`, kind: "status",
          title: `Status: ${h.from_status ?? "—"} → ${h.to_status}`,
          description: h.reason, occurred_at: h.changed_at,
        });
      });
      fullNotes.forEach((n) => {
        items.push({
          id: `note-${n.id}`, kind: "note",
          title: `Note by ${n.author?.full_name ?? n.author?.email ?? "user"}`,
          description: n.body, occurred_at: n.created_at,
        });
      });
      items.sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
      setTimeline(items);
    } finally { setLoading(false); }
  }, [id, workspaceId]);

  useEffect(() => { load(); }, [load]);

  const addNote = useCallback(async (body: string) => {
    if (!id || !workspaceId || !user?.id || !body.trim()) return false;
    const { error } = await (supabase as any).from("opportunity_notes").insert({
      workspace_id: workspaceId, opportunity_id: id, author_id: user.id, body: body.trim(),
    });
    if (error) { toast.error(`Failed to add note: ${error.message}`); return false; }
    toast.success("Note added");
    await load();
    return true;
  }, [id, workspaceId, user?.id, load]);

  return { opportunity, notes, history, timeline, loading, reload: load, addNote };
}
