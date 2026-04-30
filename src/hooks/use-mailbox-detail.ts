import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const from = (t: string) => (supabase as any).from(t);

// Warmup settings — single row per mailbox
export function useMailboxWarmupSettings(mailboxId: string | null) {
  return useQuery({
    queryKey: ["mailbox_warmup_settings", mailboxId],
    enabled: !!mailboxId,
    queryFn: async () => {
      const { data, error } = await from("mailbox_warmup_settings")
        .select("*")
        .eq("mailbox_id", mailboxId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertMailboxWarmupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mailbox_id, ...vals }: any) => {
      const { data, error } = await from("mailbox_warmup_settings")
        .upsert({ mailbox_id, ...vals, updated_at: new Date().toISOString() }, { onConflict: "mailbox_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars: any) => {
      qc.invalidateQueries({ queryKey: ["mailbox_warmup_settings", vars.mailbox_id] });
      toast.success("Warmup settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Mailbox health row
export function useMailboxHealth(mailboxId: string | null) {
  return useQuery({
    queryKey: ["mailbox_health", mailboxId],
    enabled: !!mailboxId,
    queryFn: async () => {
      const { data, error } = await from("mailbox_health")
        .select("*")
        .eq("mailbox_id", mailboxId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Campaigns linked to a mailbox via campaign_mailboxes
export function useMailboxCampaigns(mailboxId: string | null) {
  return useQuery({
    queryKey: ["mailbox_campaigns", mailboxId],
    enabled: !!mailboxId,
    queryFn: async () => {
      const { data, error } = await from("campaign_mailboxes")
        .select("campaign_id, created_at, campaigns(id, name, status, created_at, daily_limit)")
        .eq("mailbox_id", mailboxId!);
      if (error) throw error;
      return (data || [])
        .map((r: any) => r.campaigns)
        .filter(Boolean);
    },
  });
}
