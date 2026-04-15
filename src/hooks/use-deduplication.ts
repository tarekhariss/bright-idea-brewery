/**
 * Deduplication + Merge Engine hooks.
 * Large scans use the run-dedup-scan edge function for server-side processing.
 */
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DuplicateGroup {
  id: string;
  workspace_id: string;
  entity_type: "contact" | "company";
  status: string;
  record_count: number;
  primary_record_id: string | null;
  confidence_score: number;
  match_rules: string[];
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DuplicateCandidate {
  id: string;
  group_id: string;
  record_id: string;
  entity_type: "contact" | "company";
  match_score: number;
  match_reasons: string[];
  is_primary: boolean;
  merge_status: string;
  created_at: string;
}

export interface MergeHistoryEntry {
  id: string;
  workspace_id: string;
  entity_type: "contact" | "company";
  surviving_record_id: string;
  merged_record_ids: string[];
  field_selections: Record<string, string>;
  merge_summary: any;
  performed_by: string | null;
  created_at: string;
}

// ─── Duplicate Groups Hook ─────────────────────────────────────────────────────

export function useDuplicateGroups(entityType: "contact" | "company", statusFilter = "all") {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["duplicate-groups", entityType, statusFilter, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = (supabase.from("duplicate_groups") as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("workspace_id", workspaceId)
        .order("confidence_score", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DuplicateGroup[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
  return { groups, isLoading, refetch };
}

// ─── Duplicate Candidates Hook ─────────────────────────────────────────────────

export function useDuplicateCandidates(groupId: string | null) {
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["duplicate-candidates", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await (supabase.from("duplicate_candidates") as any)
        .select("*")
        .eq("group_id", groupId)
        .order("match_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DuplicateCandidate[];
    },
    enabled: !!groupId,
  });
  return { candidates, isLoading };
}

// ─── Merge History Hook ────────────────────────────────────────────────────────

export function useMergeHistory() {
  const { workspaceId } = useAuth();
  const { data: history, isLoading } = useQuery({
    queryKey: ["merge-history", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("merge_history") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MergeHistoryEntry[];
    },
  });
  return { history, isLoading };
}

// ─── Run Duplicate Scan (server-side via edge function) ────────────────────────

export function useDuplicateScan() {
  const { user, workspaceId } = useAuth();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const scanContacts = useCallback(async (wsId?: string) => {
    if (!user) return;
    const targetWs = wsId || workspaceId;
    if (!targetWs) return;
    
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const res = await fetch(`${supabaseUrl}/functions/v1/run-dedup-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: targetWs, entity_type: "contact" }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Scan failed");

      queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
      toast.success(`Scan complete — found ${body.groups_created ?? 0} duplicate group(s)`);
    } catch (err: any) {
      console.error(err);
      toast.error("Duplicate scan failed: " + (err.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  }, [user, workspaceId, queryClient]);

  return { scanContacts, scanning };
}

// ─── Merge Records ─────────────────────────────────────────────────────────────

export function useMergeRecords() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [merging, setMerging] = useState(false);

  const mergeContacts = useCallback(async (
    workspaceId: string,
    survivingId: string,
    mergedIds: string[],
    fieldSelections: Record<string, string>,
    groupId?: string,
  ) => {
    if (!user) return;
    setMerging(true);
    try {
      const allIds = [survivingId, ...mergedIds];
      const { data: records, error } = await supabase
        .from("contacts")
        .select("*")
        .in("id", allIds);

      if (error || !records) throw error;

      const surviving = records.find((r) => r.id === survivingId);
      if (!surviving) throw new Error("Surviving record not found");

      const updateData: Record<string, unknown> = {};
      for (const [field, sourceId] of Object.entries(fieldSelections)) {
        const source = records.find((r) => r.id === sourceId);
        if (source && (source as any)[field] !== undefined) {
          updateData[field] = (source as any)[field];
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: upErr } = await (supabase.from("contacts") as any).update(updateData).eq("id", survivingId);
        if (upErr) throw upErr;
      }

      for (const mergedId of mergedIds) {
        await (supabase.from("activities") as any).update({ contact_id: survivingId }).eq("contact_id", mergedId);
        await (supabase.from("contact_tags") as any).update({ contact_id: survivingId }).eq("contact_id", mergedId);
        await (supabase.from("campaign_contacts") as any).update({ contact_id: survivingId }).eq("contact_id", mergedId);
        await (supabase.from("contact_activity_log") as any).update({ contact_id: survivingId }).eq("contact_id", mergedId);
        await (supabase.from("contacts") as any)
          .update({ lifecycle_status: "archived", notes: `Merged into ${survivingId}` })
          .eq("id", mergedId);
      }

      await (supabase.from("merge_history") as any).insert({
        workspace_id: workspaceId,
        entity_type: "contact",
        surviving_record_id: survivingId,
        merged_record_ids: mergedIds,
        field_selections: fieldSelections,
        merge_summary: { fields_updated: Object.keys(updateData), records_merged: mergedIds.length },
        duplicate_group_id: groupId ?? null,
        performed_by: user.id,
      });

      if (groupId) {
        await (supabase.from("duplicate_groups") as any)
          .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
          .eq("id", groupId);
        await (supabase.from("duplicate_candidates") as any)
          .update({ merge_status: "merged" })
          .eq("group_id", groupId)
          .in("record_id", mergedIds);
      }

      queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
      queryClient.invalidateQueries({ queryKey: ["merge-history"] });
      toast.success(`Merged ${mergedIds.length} record(s) into surviving contact`);
    } catch (err) {
      console.error(err);
      toast.error("Merge failed");
    } finally {
      setMerging(false);
    }
  }, [user, queryClient]);

  return { mergeContacts, merging };
}
