/**
 * Deduplication + Merge Engine hooks.
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normalizeCompanyName } from "@/lib/csv-utils";

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
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["duplicate-groups", entityType, statusFilter],
    queryFn: async () => {
      let query = (supabase.from("duplicate_groups") as any)
        .select("*")
        .eq("entity_type", entityType)
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
  const { data: history, isLoading } = useQuery({
    queryKey: ["merge-history"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("merge_history") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MergeHistoryEntry[];
    },
  });

  return { history, isLoading };
}

// ─── Run Duplicate Scan ────────────────────────────────────────────────────────

export function useDuplicateScan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const scanContacts = useCallback(async (workspaceId: string) => {
    if (!user) return;
    setScanning(true);
    try {
      // Fetch all contacts for dedup
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, email, secondary_email, linkedin_url, phone, first_name, last_name, company_name_raw")
        .eq("workspace_id", workspaceId)
        .limit(50000);

      if (error) throw error;
      if (!contacts || contacts.length < 2) {
        toast.info("Not enough contacts for duplicate detection");
        return;
      }

      // Build indices
      const emailMap = new Map<string, string[]>();
      const linkedinMap = new Map<string, string[]>();
      const nameCompanyMap = new Map<string, string[]>();

      for (const c of contacts) {
        const id = c.id;
        if (c.email) {
          const key = c.email.toLowerCase();
          emailMap.set(key, [...(emailMap.get(key) ?? []), id]);
        }
        if (c.secondary_email) {
          const key = c.secondary_email.toLowerCase();
          emailMap.set(key, [...(emailMap.get(key) ?? []), id]);
        }
        if (c.linkedin_url) {
          const key = c.linkedin_url.toLowerCase().replace(/\/+$/, "");
          linkedinMap.set(key, [...(linkedinMap.get(key) ?? []), id]);
        }
        const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().trim();
        const companyNorm = c.company_name_raw ? normalizeCompanyName(c.company_name_raw) : "";
        if (fullName && companyNorm) {
          const key = `${fullName}|${companyNorm}`;
          nameCompanyMap.set(key, [...(nameCompanyMap.get(key) ?? []), id]);
        }
      }

      // Find groups (sets of 2+ matching IDs)
      const seen = new Set<string>();
      const dupGroups: { ids: string[]; rules: string[]; confidence: number }[] = [];

      const addGroup = (ids: string[], rule: string, confidence: number) => {
        const key = ids.sort().join(",");
        if (seen.has(key)) return;
        seen.add(key);
        dupGroups.push({ ids, rules: [rule], confidence });
      };

      for (const [, ids] of emailMap) {
        const unique = [...new Set(ids)];
        if (unique.length >= 2) addGroup(unique.slice(0, 5), "email_match", 95);
      }
      for (const [, ids] of linkedinMap) {
        const unique = [...new Set(ids)];
        if (unique.length >= 2) addGroup(unique.slice(0, 5), "linkedin_match", 90);
      }
      for (const [, ids] of nameCompanyMap) {
        const unique = [...new Set(ids)];
        if (unique.length >= 2) addGroup(unique.slice(0, 5), "name_company_match", 70);
      }

      if (dupGroups.length === 0) {
        toast.info("No duplicates found");
        return;
      }

      // Insert groups and candidates
      for (const g of dupGroups.slice(0, 200)) {
        const { data: group, error: gErr } = await (supabase.from("duplicate_groups") as any)
          .insert({
            workspace_id: workspaceId,
            entity_type: "contact",
            status: "pending",
            record_count: g.ids.length,
            primary_record_id: g.ids[0],
            confidence_score: g.confidence,
            match_rules: g.rules,
          })
          .select("id")
          .single();

        if (gErr || !group) continue;

        const candidates = g.ids.map((id, idx) => ({
          group_id: group.id,
          record_id: id,
          entity_type: "contact",
          match_score: g.confidence,
          match_reasons: g.rules,
          is_primary: idx === 0,
          merge_status: "candidate",
        }));

        await (supabase.from("duplicate_candidates") as any).insert(candidates);
      }

      queryClient.invalidateQueries({ queryKey: ["duplicate-groups"] });
      toast.success(`Found ${dupGroups.length} duplicate group(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Duplicate scan failed");
    } finally {
      setScanning(false);
    }
  }, [user, queryClient]);

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
      // Load all records
      const allIds = [survivingId, ...mergedIds];
      const { data: records, error } = await supabase
        .from("contacts")
        .select("*")
        .in("id", allIds);

      if (error || !records) throw error;

      const surviving = records.find((r) => r.id === survivingId);
      if (!surviving) throw new Error("Surviving record not found");

      // Build merged record from field selections
      const updateData: Record<string, unknown> = {};
      for (const [field, sourceId] of Object.entries(fieldSelections)) {
        const source = records.find((r) => r.id === sourceId);
        if (source && (source as any)[field] !== undefined) {
          updateData[field] = (source as any)[field];
        }
      }

      // Update surviving record
      if (Object.keys(updateData).length > 0) {
        const { error: upErr } = await (supabase.from("contacts") as any)
          .update(updateData)
          .eq("id", survivingId);
        if (upErr) throw upErr;
      }

      // Reassign related data from merged records to surviving
      for (const mergedId of mergedIds) {
        // Move activities
        await (supabase.from("activities") as any)
          .update({ contact_id: survivingId })
          .eq("contact_id", mergedId);

        // Move contact tags
        await (supabase.from("contact_tags") as any)
          .update({ contact_id: survivingId })
          .eq("contact_id", mergedId);

        // Move campaign contacts
        await (supabase.from("campaign_contacts") as any)
          .update({ contact_id: survivingId })
          .eq("contact_id", mergedId);

        // Move contact activity log
        await (supabase.from("contact_activity_log") as any)
          .update({ contact_id: survivingId })
          .eq("contact_id", mergedId);

        // Soft-delete merged record (mark as archived)
        await (supabase.from("contacts") as any)
          .update({ lifecycle_status: "archived", notes: `Merged into ${survivingId}` })
          .eq("id", mergedId);
      }

      // Record merge history
      await (supabase.from("merge_history") as any).insert({
        workspace_id: workspaceId,
        entity_type: "contact",
        surviving_record_id: survivingId,
        merged_record_ids: mergedIds,
        field_selections: fieldSelections,
        merge_summary: {
          fields_updated: Object.keys(updateData),
          records_merged: mergedIds.length,
        },
        duplicate_group_id: groupId ?? null,
        performed_by: user.id,
      });

      // Update group status if provided
      if (groupId) {
        await (supabase.from("duplicate_groups") as any)
          .update({
            status: "resolved",
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", groupId);

        // Update candidate statuses
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
