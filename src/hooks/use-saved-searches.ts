import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import type { Json } from "@/integrations/supabase/db-types";

const db = () => supabase as any;

export interface SavedSearch {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  entity_type: "contact" | "company";
  filter_definition: FilterDefinition;
  is_pinned: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSavedSearches(entityType: "contact" | "company", workspaceId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const qk = ["saved-searches", entityType, workspaceId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await db()
        .from("saved_searches")
        .select("*")
        .eq("entity_type", entityType)
        .eq("workspace_id", workspaceId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedSearch[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string; filter_definition: FilterDefinition; is_pinned?: boolean }) => {
      const { data, error } = await db()
        .from("saved_searches")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          description: input.description || null,
          entity_type: entityType,
          filter_definition: input.filter_definition as unknown as Json,
          is_pinned: input.is_pinned ?? false,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SavedSearch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Saved search created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; filter_definition?: FilterDefinition; is_pinned?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.filter_definition !== undefined) updates.filter_definition = input.filter_definition as unknown as Json;
      if (input.is_pinned !== undefined) updates.is_pinned = input.is_pinned;
      const { error } = await db().from("saved_searches").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Saved search updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("saved_searches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Saved search deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const original = query.data?.find((s) => s.id === id);
      if (!original) throw new Error("Search not found");
      const { data, error } = await db()
        .from("saved_searches")
        .insert({
          workspace_id: workspaceId,
          name: `${original.name} (copy)`,
          description: original.description,
          entity_type: entityType,
          filter_definition: original.filter_definition as unknown as Json,
          is_pinned: false,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SavedSearch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Saved search duplicated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const trackUsage = async (id: string) => {
    await db()
      .from("saved_searches")
      .update({ usage_count: (query.data?.find((s) => s.id === id)?.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", id);
  };

  return {
    searches: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    duplicate: duplicateMutation.mutateAsync,
    trackUsage,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
