import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { FilterValues } from "@/components/data-table/FilterPanel";
import type { Json } from "@/integrations/supabase/db-types";

export interface ViewState {
  search: string;
  filters: FilterValues;
  visibleColumns: string[];
  sortBy: string;
  sortDirection: "asc" | "desc";
  pageSize: number;
}

export interface SavedView {
  id: string;
  name: string;
  entity_type: "contact" | "company";
  filters: Json;
  columns: Json | null;
  sort_by: string | null;
  sort_direction: "asc" | "desc";
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSavedViews(entityType: "contact" | "company") {
  const { user } = useAuth();
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchViews = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_views")
      .select("*")
      .eq("entity_type", entityType)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    setViews((data as unknown as SavedView[] | null) ?? []);
    setLoading(false);
  }, [user, entityType]);

  useEffect(() => { fetchViews(); }, [fetchViews]);

  const saveView = async (name: string, state: ViewState) => {
    if (!user) return;
    const payload: any = {
      name,
      entity_type: entityType,
      filters: { search: state.search, filterValues: state.filters, pageSize: state.pageSize },
      columns: state.visibleColumns,
      sort_by: state.sortBy,
      sort_direction: state.sortDirection,
      is_default: false,
      created_by: user.id,
    };
    const { data, error } = await supabase.from("saved_views").insert(payload as any).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    toast({ title: "View saved", description: `"${name}" has been saved.` });
    await fetchViews();
    return data as unknown as SavedView;
  };

  const updateView = async (id: string, state: ViewState) => {
    const payload: any = {
      filters: { search: state.search, filterValues: state.filters, pageSize: state.pageSize },
      columns: state.visibleColumns,
      sort_by: state.sortBy,
      sort_direction: state.sortDirection,
    };
    const { error } = await supabase.from("saved_views").update(payload as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "View updated" });
    await fetchViews();
  };

  const renameView = async (id: string, name: string) => {
    const { error } = await supabase.from("saved_views").update({ name } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchViews();
  };

  const deleteView = async (id: string) => {
    const { error } = await supabase.from("saved_views").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (activeViewId === id) setActiveViewId(null);
    toast({ title: "View deleted" });
    await fetchViews();
  };

  const setDefault = async (id: string) => {
    if (user) {
      await supabase.from("saved_views").update({ is_default: false } as any).eq("entity_type", entityType).eq("created_by", user.id);
    }
    await supabase.from("saved_views").update({ is_default: true } as any).eq("id", id);
    toast({ title: "Default view set" });
    await fetchViews();
  };

  const loadViewState = (view: SavedView): ViewState => {
    const f = view.filters as Record<string, unknown> | null;
    return {
      search: (f?.search as string) ?? "",
      filters: (f?.filterValues as FilterValues) ?? {},
      visibleColumns: (view.columns as string[]) ?? [],
      sortBy: view.sort_by ?? "updated_at",
      sortDirection: view.sort_direction,
      pageSize: (f?.pageSize as number) ?? 25,
    };
  };

  return {
    views,
    activeViewId,
    setActiveViewId,
    loading,
    saveView,
    updateView,
    renameView,
    deleteView,
    setDefault,
    loadViewState,
    refetch: fetchViews,
  };
}
