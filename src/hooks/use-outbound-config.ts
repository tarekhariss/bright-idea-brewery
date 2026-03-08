import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/db-types";

type Tables = Database["public"]["Tables"];
const from = (table: string) => (supabase as any).from(table);

// ── Email Templates ──
export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await from("email_templates").select("*, email_variants(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Tables["email_templates"]["Row"] & { email_variants: Tables["email_variants"]["Row"][] })[];
    },
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; subject?: string; body?: string }) => {
      const { data, error } = await from("email_templates").insert({ ...vals, created_by: user?.id }).select().single();
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
  return useQuery({
    queryKey: ["sending_windows"],
    queryFn: async () => {
      const { data, error } = await from("sending_windows").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables["sending_windows"]["Row"][];
    },
  });
}

export function useCreateSendingWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: Partial<Tables["sending_windows"]["Insert"]>) => {
      const { data, error } = await from("sending_windows").insert(vals).select().single();
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
  return useQuery({
    queryKey: ["esp_routing_rules"],
    queryFn: async () => {
      const { data, error } = await from("esp_routing_rules").select("*").order("priority");
      if (error) throw error;
      return data as Tables["esp_routing_rules"]["Row"][];
    },
  });
}

export function useCreateEspRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: Partial<Tables["esp_routing_rules"]["Insert"]>) => {
      const { data, error } = await from("esp_routing_rules").insert(vals).select().single();
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
  return useQuery({
    queryKey: ["contact_suppression"],
    queryFn: async () => {
      const { data, error } = await from("contact_suppression").select("*, contacts(id, first_name, last_name, email)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDomainSuppression() {
  return useQuery({
    queryKey: ["domain_suppression"],
    queryFn: async () => {
      const { data, error } = await from("domain_suppression").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables["domain_suppression"]["Row"][];
    },
  });
}

export function useCreateContactSuppression() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { contact_id: string; reason?: string }) => {
      const { error } = await from("contact_suppression").insert({ ...vals, suppressed_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact_suppression"] }); toast.success("Contact suppressed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateDomainSuppression() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { domain: string; reason?: string }) => {
      const { error } = await from("domain_suppression").insert({ ...vals, suppressed_by: user?.id });
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
  return useQuery({
    queryKey: ["mailbox_health"],
    queryFn: async () => {
      const { data, error } = await from("mailbox_health").select("*, mailboxes(id, email, display_name, provider_type, connection_status)");
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── Domain Send Limits ──
export function useDomainSendLimits() {
  return useQuery({
    queryKey: ["domain_send_limits"],
    queryFn: async () => {
      const { data, error } = await from("domain_send_limits").select("*").order("domain");
      if (error) throw error;
      return data as Tables["domain_send_limits"]["Row"][];
    },
  });
}

// ── Inbox Threads ──
export function useInboxThreads() {
  return useQuery({
    queryKey: ["inbox_threads"],
    queryFn: async () => {
      const { data, error } = await from("inbox_threads")
        .select("*, contacts(id, first_name, last_name, email), mailboxes(id, email), inbox_messages(id, direction, subject, body_text, timestamp)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
}
