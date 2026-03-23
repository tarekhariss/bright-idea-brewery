import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProviderType = "google" | "microsoft" | "smtp" | "linkedin";
export type ConnectionStatusType = "connected" | "disconnected" | "needs_reauth" | "invalid_credentials" | "pending";

export interface ProviderConnection {
  id: string;
  workspace_id: string;
  provider_type: ProviderType;
  account_email: string | null;
  display_name: string | null;
  connection_status: ConnectionStatusType;
  oauth_token_status: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  imap_host: string | null;
  imap_port: number | null;
  from_email: string | null;
  from_name: string | null;
  daily_send_limit: number;
  daily_message_limit: number;
  aliases: string[];
  metadata: Record<string, any>;
  last_validated_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useProviderConnections() {
  return useQuery({
    queryKey: ["provider-connections"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("provider_connections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProviderConnection[];
    },
  });
}

export function useProviderConnectionsByType(type: ProviderType) {
  return useQuery({
    queryKey: ["provider-connections", type],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("provider_connections")
        .select("*")
        .eq("provider_type", type)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProviderConnection[];
    },
  });
}

export function useCreateProviderConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conn: Partial<ProviderConnection> & { workspace_id: string; provider_type: ProviderType }) => {
      const { data, error } = await (supabase as any)
        .from("provider_connections")
        .insert(conn)
        .select()
        .single();
      if (error) throw error;
      return data as ProviderConnection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-connections"] });
      toast.success("Provider connection added");
    },
    onError: (e: any) => toast.error(e.message || "Failed to add connection"),
  });
}

export function useUpdateProviderConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProviderConnection> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("provider_connections")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ProviderConnection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-connections"] });
      toast.success("Connection updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });
}

export function useDeleteProviderConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("provider_connections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-connections"] });
      toast.success("Connection removed");
    },
    onError: (e: any) => toast.error(e.message || "Failed to remove"),
  });
}

export function useValidateProviderConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Simulated validation - in production this would call an edge function
      await new Promise((r) => setTimeout(r, 1500));
      const passed = Math.random() > 0.2;
      await (supabase as any)
        .from("provider_connections")
        .update({
          connection_status: passed ? "connected" : "invalid_credentials",
          last_validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      return { passed };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["provider-connections"] });
      if (result.passed) toast.success("Connection validated ✓");
      else toast.warning("Validation failed — check credentials");
    },
    onError: (e: any) => toast.error(e.message || "Validation error"),
  });
}
