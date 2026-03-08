import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/db-types";

type Tables = Database["public"]["Tables"];
type Sequence = Tables["sequences"]["Row"];
type SequenceStep = Tables["sequence_steps"]["Row"];
type Email = Tables["emails"]["Row"];
type Task = Tables["tasks"]["Row"];
type Call = Tables["calls"]["Row"];

// Helper to bypass strict table typing for tables not yet in live DB
const from = (table: string) => (supabase as any).from(table);

// ── Sequences ──
export function useSequences() {
  return useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const { data, error } = await from("sequences")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Sequence[];
    },
  });
}

export function useSequenceSteps(sequenceId: string | null) {
  return useQuery({
    queryKey: ["sequence_steps", sequenceId],
    enabled: !!sequenceId,
    queryFn: async () => {
      const { data, error } = await from("sequence_steps")
        .select("*")
        .eq("sequence_id", sequenceId!)
        .order("step_order");
      if (error) throw error;
      return data as SequenceStep[];
    },
  });
}

export function useSequenceEnrollments(sequenceId: string | null) {
  return useQuery({
    queryKey: ["sequence_enrollments", sequenceId],
    enabled: !!sequenceId,
    queryFn: async () => {
      const { data, error } = await from("sequence_enrollments")
        .select("*, contacts(id, first_name, last_name, email)")
        .eq("sequence_id", sequenceId!)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; description?: string }) => {
      const { data, error } = await from("sequences")
        .insert({ name: vals.name, description: vals.description, owner_id: user?.id, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Sequence;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequences"] }); toast.success("Sequence created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("sequences").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequences"] }); toast.success("Sequence deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Steps ──
export function useAddStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: Tables["sequence_steps"]["Insert"]) => {
      const { data, error } = await from("sequence_steps").insert(vals).select().single();
      if (error) throw error;
      return data as SequenceStep;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["sequence_steps", d?.sequence_id] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sequenceId }: { id: string; sequenceId: string }) => {
      const { error } = await from("sequence_steps").delete().eq("id", id);
      if (error) throw error;
      return sequenceId;
    },
    onSuccess: (seqId: string) => qc.invalidateQueries({ queryKey: ["sequence_steps", seqId] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sequenceId, ...vals }: { id: string; sequenceId: string } & Partial<Tables["sequence_steps"]["Update"]>) => {
      const { data, error } = await from("sequence_steps").update(vals).eq("id", id).select().single();
      if (error) throw error;
      return data as SequenceStep;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["sequence_steps", d?.sequence_id] });
      toast.success("Step updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Enrollments ──
export function useEnrollContact() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) => {
      const nextStepAt = new Date();
      const { data, error } = await from("sequence_enrollments")
        .insert({ sequence_id: sequenceId, contact_id: contactId, enrolled_by: user?.id, next_step_at: nextStepAt.toISOString() })
        .select()
        .single();
      if (error) throw error;
      // Queue first step
      await from("message_queue").insert({
        queue_type: "email",
        payload: { enrollment_id: data!.id, sequence_id: sequenceId, contact_id: contactId, step_order: 1 },
        reference_id: data!.id,
        reference_type: "enrollment",
        sequence_id: sequenceId,
        enrollment_id: data!.id,
        scheduled_for: nextStepAt.toISOString(),
      });
      return data as any;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["sequence_enrollments", d?.sequence_id] });
      toast.success("Contact enrolled");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Emails ──
export function useEmails() {
  return useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await from("emails")
        .select("*, contacts(id, first_name, last_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateEmail() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { subject: string; body_html?: string; to_address: string; contact_id?: string; scheduled_at?: string }) => {
      const { data, error } = await from("emails")
        .insert({ ...vals, owner_id: user?.id, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      return data as Email;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emails"] }); toast.success("Email created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useQueueEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      const { error: ue } = await from("emails").update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", emailId);
      if (ue) throw ue;
      await from("email_events").insert({ email_id: emailId, event_type: "queued" });
      await from("message_queue").insert({
        queue_type: "email",
        payload: { email_id: emailId },
        reference_id: emailId,
        reference_type: "email",
        scheduled_for: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emails"] }); toast.success("Email queued"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMockSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      await from("emails").update({ status: "processing" }).eq("id", emailId);
      await from("email_events").insert({ email_id: emailId, event_type: "processing" });
      const now = new Date().toISOString();
      await from("emails").update({ status: "sent_mock", sent_at: now, updated_at: now }).eq("id", emailId);
      await from("email_events").insert({ email_id: emailId, event_type: "sent_mock", details: { mock: true, sent_at: now } });
      await from("message_queue").update({ status: "completed", completed_at: now }).eq("reference_id", emailId).eq("reference_type", "email");
      await from("system_activity_log").insert({ action: "email_sent_mock", entity_type: "email", entity_id: emailId, details: { mock: true } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emails"] }); toast.success("Email sent (mock)"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Tasks ──
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await from("tasks")
        .select("*, contacts(id, first_name, last_name, email)")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { title: string; description?: string; task_type?: string; priority?: string; due_date?: string; contact_id?: string; company_id?: string; assigned_to?: string }) => {
      const { data, error } = await from("tasks")
        .insert({ ...vals, owner_id: user?.id, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "task_created", entity_type: "task", entity_id: data!.id, performed_by: user?.id });
      return data as Task;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("tasks").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (vals.status === "completed") {
        await from("system_activity_log").insert({ action: "task_completed", entity_type: "task", entity_id: id, performed_by: user?.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Calls ──
export function useCalls() {
  return useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await from("calls")
        .select("*, contacts(id, first_name, last_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateCall() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { direction?: string; phone_number?: string; contact_id?: string; company_id?: string; notes?: string; scheduled_at?: string }) => {
      const { data, error } = await from("calls")
        .insert({ ...vals, owner_id: user?.id, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      await from("system_activity_log").insert({ action: "call_logged", entity_type: "call", entity_id: data!.id, performed_by: user?.id });
      return data as Call;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calls"] }); toast.success("Call logged"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("calls").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] }),
    onError: (e: any) => toast.error(e.message),
  });
}
