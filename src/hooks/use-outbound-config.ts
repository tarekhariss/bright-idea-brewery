import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/db-types";

type Tables = Database["public"]["Tables"];
const from = (table: string) => (supabase as any).from(table);

// ── Email Templates ──
export function useEmailTemplates() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["email_templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("email_templates")
        .select("*, email_variants(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Tables["email_templates"]["Row"] & { email_variants: Tables["email_variants"]["Row"][] })[];
    },
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; subject?: string; body?: string }) => {
      const { data, error } = await from("email_templates").insert({ ...vals, created_by: user?.id, workspace_id: workspaceId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email_templates"] }); toast.success("Template created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string } & Partial<Tables["email_templates"]["Update"]>) => {
      const { data, error } = await from("email_templates").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email_templates"] }); toast.success("Template deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Sending Windows ──
export function useSendingWindows() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["sending_windows", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("sending_windows")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables["sending_windows"]["Row"][];
    },
  });
}

export function useCreateSendingWindow() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: Partial<Tables["sending_windows"]["Insert"]>) => {
      const { data, error } = await from("sending_windows").insert({ ...vals, workspace_id: workspaceId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sending_windows"] }); toast.success("Sending window created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteSendingWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("sending_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sending_windows"] }); toast.success("Window removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── ESP Routing ──
export function useEspRoutingRules() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["esp_routing_rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("esp_routing_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("priority");
      if (error) throw error;
      return data as Tables["esp_routing_rules"]["Row"][];
    },
  });
}

export function useCreateEspRule() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: Partial<Tables["esp_routing_rules"]["Insert"]>) => {
      const { data, error } = await from("esp_routing_rules").insert({ ...vals, workspace_id: workspaceId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["esp_routing_rules"] }); toast.success("Rule added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEspRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("esp_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["esp_routing_rules"] }); toast.success("Rule removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Suppression ──
export function useContactSuppression() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["contact_suppression", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("contact_suppression")
        .select("*, contacts(id, first_name, last_name, email)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDomainSuppression() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["domain_suppression", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("domain_suppression")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables["domain_suppression"]["Row"][];
    },
  });
}

export function useCreateContactSuppression() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: { contact_id: string; reason?: string }) => {
      const { error } = await from("contact_suppression").insert({ ...vals, suppressed_by: user?.id, workspace_id: workspaceId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact_suppression"] }); toast.success("Contact suppressed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateDomainSuppression() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: { domain: string; reason?: string }) => {
      const { error } = await from("domain_suppression").insert({ ...vals, suppressed_by: user?.id, workspace_id: workspaceId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["domain_suppression"] }); toast.success("Domain suppressed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteContactSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("contact_suppression").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact_suppression"] }); toast.success("Suppression removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteDomainSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("domain_suppression").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["domain_suppression"] }); toast.success("Suppression removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Mailbox Health ──
export function useMailboxHealth() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["mailbox_health", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("mailbox_health")
        .select("*, mailboxes!inner(id, email, display_name, provider_type, connection_status, workspace_id)")
        .eq("mailboxes.workspace_id", workspaceId);
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── Domain Send Limits ──
export function useDomainSendLimits() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["domain_send_limits", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("domain_send_limits")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("domain");
      if (error) throw error;
      return data as Tables["domain_send_limits"]["Row"][];
    },
  });
}

// ── Inbox Threads ──
export function useInboxThreads() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["inbox_threads", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("inbox_threads")
        .select("*, contacts(id, first_name, last_name, email), mailboxes(id, email), inbox_messages(id, direction, subject, body_text, timestamp)")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
}
