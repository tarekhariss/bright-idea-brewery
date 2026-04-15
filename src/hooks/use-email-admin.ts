import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callAdminTool(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/email-admin-tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

// ── Check mailbox readiness ──
export function useCheckReadiness() {
  return useMutation({
    mutationFn: async (mailboxId: string) => callAdminTool("check_readiness", { mailbox_id: mailboxId }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Send test email ──
export function useSendTestEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mailboxId, toAddress }: { mailboxId: string; toAddress: string }) =>
      callAdminTool("test_send", { mailbox_id: mailboxId, to_address: toAddress }),
    onSuccess: (data) => {
      if (data.success) toast.success("Test email sent successfully");
      else toast.error("Test email failed: " + (data.result?.error || "Unknown error"));
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["mailboxes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Preview send payload ──
export function usePreviewPayload() {
  return useMutation({
    mutationFn: async ({ emailId, mailboxId }: { emailId: string; mailboxId: string }) =>
      callAdminTool("preview_payload", { email_id: emailId, mailbox_id: mailboxId }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Queue health ──
export function useQueueHealth() {
  return useQuery({
    queryKey: ["queue_health"],
    queryFn: () => callAdminTool("queue_health"),
    refetchInterval: 30000,
  });
}

// ── Process queue manually ──
export function useProcessQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callAdminTool("process_queue"),
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed || 0} queue items`);
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["queue_health"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Process sequences manually ──
export function useProcessSequences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mailboxId?: string) => callAdminTool("process_sequences", { mailbox_id: mailboxId }),
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed || 0} sequence steps`);
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["sequence_enrollments"] });
      qc.invalidateQueries({ queryKey: ["queue_health"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Send a specific email via mailbox (real send) ──
export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ emailId, mailboxId }: { emailId: string; mailboxId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email_id: emailId, mailbox_id: mailboxId }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Send failed");
      return body;
    },
    onSuccess: () => {
      toast.success("Email sent");
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["mailboxes"] });
      qc.invalidateQueries({ queryKey: ["queue_health"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
