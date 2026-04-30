import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

export type ReplyCategory =
  | "lead" | "interested" | "not_interested"
  | "meeting_booked" | "meeting_completed" | "won"
  | "auto_reply" | "bounce" | "neutral" | "unknown";

export const CATEGORY_META: Record<ReplyCategory, { label: string; tone: string }> = {
  lead:               { label: "Lead",              tone: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  interested:         { label: "Interested",        tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  not_interested:     { label: "Not Interested",    tone: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400" },
  meeting_booked:     { label: "Meeting Booked",    tone: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400" },
  meeting_completed:  { label: "Meeting Completed", tone: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400" },
  won:                { label: "Won",               tone: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400" },
  auto_reply:         { label: "Auto Reply",        tone: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400" },
  bounce:             { label: "Bounce",            tone: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  neutral:            { label: "Neutral",           tone: "bg-muted text-muted-foreground border-border" },
  unknown:            { label: "Unclassified",      tone: "bg-muted text-muted-foreground border-border" },
};

export const PRIMARY_CATEGORIES: ReplyCategory[] = [
  "lead","interested","not_interested","meeting_booked","meeting_completed","won","neutral",
];

// Threads list (Primary or Others)
export function useInboxThreads(view: "primary" | "others" = "primary") {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["inbox_threads_v2", workspaceId, view],
    enabled: !!workspaceId,
    queryFn: async () => {
      const q = from("inbox_threads")
        .select("*, contacts(id, first_name, last_name, email, company_name_raw), mailboxes(id, email), campaigns(id, name)")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false })
        .limit(200);
      const { data, error } = view === "primary"
        ? await q.eq("is_primary", true)
        : await q.eq("is_primary", false);
      if (error) throw error;
      return data as any[];
    },
  });
}

// Messages for a single thread
export function useInboxThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["inbox_thread_messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await from("inbox_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

// Manual override of category
export function useUpdateThreadCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, category }: { threadId: string; category: ReplyCategory }) => {
      const { error } = await from("inbox_threads")
        .update({
          user_category: category,
          category,
          classification_source: "manual",
          classification_confidence: 1,
          classified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);
      if (error) throw error;
      return threadId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox_threads_v2"] });
      toast.success("Classification updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Update thread status (open/snoozed/closed)
export function useUpdateThreadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, status }: { threadId: string; status: string }) => {
      const { error } = await from("inbox_threads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", threadId);
      if (error) throw error;
      return threadId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox_threads_v2"] }),
    onError: (e: any) => toast.error(e.message),
  });
}
