import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/db-types";

type Tables = Database["public"]["Tables"];
type SendingDomain = Tables["sending_domains"]["Row"];
type SendingDomainInsert = Tables["sending_domains"]["Insert"];
type SendingDomainUpdate = Tables["sending_domains"]["Update"];
type Mailbox = Tables["mailboxes"]["Row"];
type MailboxInsert = Tables["mailboxes"]["Insert"];
type MailboxUpdate = Tables["mailboxes"]["Update"];

const from = (table: string) => (supabase as any).from(table);

// ── Sending Domains ──

export function useSendingDomains() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["sending_domains", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("sending_domains")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SendingDomain[];
    },
  });
}

export function useSendingDomain(id: string | null) {
  return useQuery({
    queryKey: ["sending_domains", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await from("sending_domains").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as SendingDomain;
    },
  });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: Omit<SendingDomainInsert, "owner_id" | "created_by" | "workspace_id">) => {
      const { data, error } = await from("sending_domains")
        .insert({ ...vals, owner_id: user?.id, created_by: user?.id, workspace_id: workspaceId })
        .select().single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "domain_created", entity_type: "sending_domain", entity_id: data.id, performed_by: user?.id, details: { domain_name: vals.domain_name } });
      return data as SendingDomain;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sending_domains"] }); toast.success("Domain added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateDomain() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string } & SendingDomainUpdate) => {
      const { data, error } = await from("sending_domains").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "domain_updated", entity_type: "sending_domain", entity_id: id, performed_by: user?.id, details: vals });
      return data as SendingDomain;
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["sending_domains"] }); qc.invalidateQueries({ queryKey: ["sending_domains", d.id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("sending_domains").delete().eq("id", id);
      if (error) throw error;
      await from("system_activity_log").insert({ action: "domain_deleted", entity_type: "sending_domain", entity_id: id, performed_by: user?.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sending_domains"] }); toast.success("Domain removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Mailboxes ──

export function useMailboxes() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["mailboxes", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("mailboxes")
        .select("*, sending_domains(id, domain_name, status)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Mailbox & { sending_domains: { id: string; domain_name: string; status: string } | null })[];
    },
  });
}

export function useMailbox(id: string | null) {
  return useQuery({
    queryKey: ["mailboxes", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await from("mailboxes").select("*, sending_domains(id, domain_name, status)").eq("id", id!).single();
      if (error) throw error;
      return data as Mailbox & { sending_domains: { id: string; domain_name: string; status: string } | null };
    },
  });
}

export function useCreateMailbox() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: Omit<MailboxInsert, "owner_id" | "created_by" | "workspace_id">) => {
      const { data, error } = await from("mailboxes")
        .insert({ ...vals, owner_id: user?.id, created_by: user?.id, workspace_id: workspaceId })
        .select().single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "mailbox_created", entity_type: "mailbox", entity_id: data.id, performed_by: user?.id, details: { email: vals.email, provider_type: vals.provider_type } });
      return data as Mailbox;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mailboxes"] }); toast.success("Mailbox connected"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMailbox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string } & MailboxUpdate) => {
      const { data, error } = await from("mailboxes").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "mailbox_updated", entity_type: "mailbox", entity_id: id, performed_by: user?.id, details: vals });
      return data as Mailbox;
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["mailboxes"] }); qc.invalidateQueries({ queryKey: ["mailboxes", d.id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMailbox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("mailboxes").delete().eq("id", id);
      if (error) throw error;
      await from("system_activity_log").insert({ action: "mailbox_deleted", entity_type: "mailbox", entity_id: id, performed_by: user?.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mailboxes"] }); toast.success("Mailbox removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}
