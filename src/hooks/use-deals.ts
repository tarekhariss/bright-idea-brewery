/**
 * use-deals — basic CRUD + Kanban backing for the Deals module.
 *
 * Scope (Round 3A):
 *   - List deals in the active workspace with their stage, company, owner, contacts.
 *   - Create / update / delete a deal.
 *   - Move a deal to another stage (drag-and-drop on Kanban).
 *
 * We intentionally do NOT model activity timeline or stage history here — that
 * is reserved for the future intelligent CRM round.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  stage_name: string;
  stage_key: string;
  display_order: number;
  color: string | null;
  is_closed: boolean;
  is_won: boolean;
}

export interface DealContactLink {
  contact_id: string;
  role: string | null;
  contact?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

export interface Deal {
  id: string;
  workspace_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  name: string;
  status: "open" | "won" | "lost" | "abandoned";
  amount: number | null;
  currency: string | null;
  notes: string | null;
  company_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  company?: { id: string; name: string | null } | null;
  owner?: { id: string; full_name: string | null; email: string | null } | null;
  contacts?: DealContactLink[];
}

export interface DealInput {
  name: string;
  status: Deal["status"];
  stage_id: string | null;
  amount: number | null;
  currency: string;
  notes: string | null;
  company_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  contact_ids: string[];
}

export function useDeals() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!workspaceId) {
      if (!wsLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Resolve default deal pipeline
      const { data: pipeline } = await (supabase as any)
        .from("pipelines")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("entity_type", "deal")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pid = pipeline?.id ?? null;
      setPipelineId(pid);

      // Stages
      if (pid) {
        const { data: stageRows } = await (supabase as any)
          .from("pipeline_stages")
          .select("*")
          .eq("pipeline_id", pid)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        setStages((stageRows ?? []) as PipelineStage[]);
      } else {
        setStages([]);
      }

      // Deals with joins (company + contacts via FK relations).
      // Owner is FK to auth.users, so we resolve profiles in a second query.
      const { data: dealRows, error } = await (supabase as any)
        .from("deals")
        .select(
          `id, workspace_id, pipeline_id, stage_id, name, status, amount, currency,
           notes, company_id, owner_id, expected_close_date, created_at, updated_at,
           company:companies(id, name),
           contacts:deal_contacts(contact_id, role, contact:contacts(id, first_name, last_name, email))`
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("loadDeals error", error);
        toast.error(`Failed to load deals: ${error.message}`);
      }

      const rows = (dealRows ?? []) as Deal[];
      const ownerIds = Array.from(new Set(rows.map((d) => d.owner_id).filter(Boolean))) as string[];
      let owners: Record<string, Deal["owner"]> = {};
      if (ownerIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, full_name, email").in("id", ownerIds);
        (profs ?? []).forEach((p: any) => { owners[p.id] = p; });
      }
      setDeals(rows.map((d) => ({ ...d, owner: d.owner_id ? owners[d.owner_id] ?? null : null })));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const upsertDeal = useCallback(
    async (input: DealInput, existingId?: string): Promise<Deal | null> => {
      if (!workspaceId) {
        toast.error("No workspace selected");
        return null;
      }
      const payload: any = {
        workspace_id: workspaceId,
        pipeline_id: pipelineId,
        stage_id: input.stage_id,
        name: input.name.trim(),
        status: input.status,
        amount: input.amount,
        currency: input.currency || "USD",
        notes: input.notes,
        company_id: input.company_id,
        owner_id: input.owner_id,
        expected_close_date: input.expected_close_date,
      };

      let dealId = existingId;
      if (existingId) {
        const { error } = await (supabase as any)
          .from("deals")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) {
          toast.error(`Failed to save deal: ${error.message}`);
          return null;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("deals")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error || !data) {
          toast.error(`Failed to create deal: ${error?.message ?? "unknown error"}`);
          return null;
        }
        dealId = data.id;
      }

      if (dealId) {
        // Replace contact links (simple full-replace)
        await (supabase as any).from("deal_contacts").delete().eq("deal_id", dealId);
        if (input.contact_ids.length > 0) {
          const rows = input.contact_ids.map((cid) => ({ deal_id: dealId, contact_id: cid }));
          const { error: linkErr } = await (supabase as any).from("deal_contacts").insert(rows);
          if (linkErr) {
            toast.error(`Saved deal but failed to link contacts: ${linkErr.message}`);
          }
        }
      }

      toast.success(existingId ? "Deal updated" : "Deal created");
      await loadAll();
      return deals.find((d) => d.id === dealId) ?? null;
    },
    [workspaceId, pipelineId, user?.id, loadAll, deals]
  );

  const deleteDeal = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from("deals").delete().eq("id", id);
      if (error) {
        toast.error(`Failed to delete deal: ${error.message}`);
        return false;
      }
      toast.success("Deal deleted");
      setDeals((prev) => prev.filter((d) => d.id !== id));
      return true;
    },
    []
  );

  const moveDealToStage = useCallback(
    async (dealId: string, stageId: string) => {
      const stage = stages.find((s) => s.id === stageId);
      // Optimistic update
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage_id: stageId,
                status: stage?.is_closed ? (stage.is_won ? "won" : "lost") : "open",
              }
            : d
        )
      );
      const update: any = { stage_id: stageId, updated_at: new Date().toISOString() };
      if (stage?.is_closed) update.status = stage.is_won ? "won" : "lost";
      else update.status = "open";

      const { error } = await (supabase as any).from("deals").update(update).eq("id", dealId);
      if (error) {
        toast.error(`Failed to move deal: ${error.message}`);
        await loadAll();
        return false;
      }
      return true;
    },
    [stages, loadAll]
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    stages.forEach((s) => map.set(s.id, []));
    const unstaged: Deal[] = [];
    deals.forEach((d) => {
      if (d.stage_id && map.has(d.stage_id)) map.get(d.stage_id)!.push(d);
      else unstaged.push(d);
    });
    return { map, unstaged };
  }, [stages, deals]);

  return {
    workspaceId,
    pipelineId,
    deals,
    stages,
    loading,
    dealsByStage,
    reload: loadAll,
    upsertDeal,
    deleteDeal,
    moveDealToStage,
  };
}
