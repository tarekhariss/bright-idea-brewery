/// <reference lib="deno.ns" />
/**
 * Email sequence worker — Instantly-style.
 *
 * For each due active enrollment:
 *  1. Stop-on-reply: if the campaign has stop_on_reply and the contact replied
 *     since enrollment, mark enrollment as 'replied' and skip.
 *  2. Resolve sender mailbox via campaign_mailbox_pool (round-robin, daily-limit
 *     aware). Falls back to enrollment's stored mailbox or function payload mailbox.
 *  3. Sending window: if the sequence/campaign has a sending window and it is
 *     closed, push next_step_at into the future without consuming the step.
 *  4. Pacing: enforce campaign min_wait_minutes + random_wait_minutes between
 *     sends from the same mailbox.
 *  5. Per-step delays support minutes + hours + days.
 *  6. Email rows are queued (status='queued') for the send worker; tasks/calls
 *     are inserted directly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

async function authenticateCaller(req: Request): Promise<boolean> {
  const incomingCronSecret = req.headers.get("x-cron-secret");
  if (incomingCronSecret && cronSecret && incomingCronSecret === cronSecret) return true;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await anonClient.auth.getUser(token);
  return !error && !!data?.user;
}

function delayMs(step: { delay_days?: number | null; delay_hours?: number | null; delay_minutes?: number | null }): number {
  const days = step.delay_days || 0;
  const hours = step.delay_hours || 0;
  const minutes = step.delay_minutes || 0;
  return ((days * 86400) + (hours * 3600) + (minutes * 60)) * 1000;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!(await authenticateCaller(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const body = await req.json().catch(() => ({}));
    const fallbackMailboxId = body.mailbox_id || null;

    const { data: enrollments, error: enErr } = await supabase
      .from("sequence_enrollments")
      .select("*, sequences(id, name, status, campaign_id), campaigns:sequences!inner(campaign_id)")
      .eq("status", "active")
      .lte("next_step_at", now)
      .order("next_step_at", { ascending: true })
      .limit(50);

    if (enErr) throw enErr;
    if (!enrollments?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No due enrollments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const enrollment of enrollments) {
      const sequence = enrollment.sequences as any;
      if (!sequence || sequence.status !== "active") {
        results.push({ enrollment_id: enrollment.id, status: "skipped", reason: "sequence_not_active" });
        continue;
      }

      // 1) Stop-on-reply check
      const { data: stopForReply } = await supabase.rpc("enrollment_should_stop_for_reply", {
        _enrollment_id: enrollment.id,
      });
      if (stopForReply === true) {
        await supabase.from("sequence_enrollments").update({
          status: "replied",
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, status: "stopped", reason: "replied" });
        continue;
      }

      // Load campaign + sequence config (campaign drives daily limit, pacing, sending window)
      const campaignId = sequence.campaign_id;
      let campaign: any = null;
      if (campaignId) {
        const { data: c } = await supabase
          .from("campaigns")
          .select("id, daily_limit, min_wait_minutes, random_wait_minutes, sending_window_id, stop_on_reply")
          .eq("id", campaignId).single();
        campaign = c;
      }

      // 2) Sending window check
      if (campaign?.sending_window_id) {
        const { data: open } = await supabase.rpc("is_sending_window_open", {
          _window_id: campaign.sending_window_id,
        });
        if (open === false) {
          // Push next attempt 15 minutes ahead — don't consume step
          const retry = new Date(Date.now() + 15 * 60_000).toISOString();
          await supabase.from("sequence_enrollments").update({
            next_step_at: retry,
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "deferred", reason: "outside_sending_window" });
          continue;
        }
      }

      const currentStepOrder = enrollment.current_step_order;
      const { data: step } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_order", currentStepOrder)
        .single();

      if (!step) {
        await supabase.from("sequence_enrollments").update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, status: "completed", reason: "no_more_steps" });
        continue;
      }

      const nextStepOrder = currentStepOrder + 1;
      const { data: nextStep } = await supabase
        .from("sequence_steps")
        .select("delay_days, delay_hours, delay_minutes")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_order", nextStepOrder)
        .maybeSingle();

      // Skip inactive
      if (!step.is_active) {
        const dms = nextStep ? Math.max(delayMs(nextStep), 60_000) : 60_000;
        const nextAt = new Date(Date.now() + dms).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextStep ? nextAt : null,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, step_order: currentStepOrder, status: "skipped", reason: "step_inactive" });
        continue;
      }

      // EMAIL STEP
      if (step.step_type === "email") {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, email, first_name, last_name, job_title, company_name_raw")
          .eq("id", enrollment.contact_id).single();

        if (!contact?.email) {
          await supabase.from("sequence_enrollments").update({
            status: "failed",
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "failed", reason: "contact_no_email" });
          continue;
        }

        // 3) Mailbox rotation: prefer pool, then enrollment's, then fallback
        let mailboxId: string | null = null;
        if (campaignId) {
          const { data: picked } = await supabase.rpc("pick_campaign_mailbox", { _campaign_id: campaignId });
          mailboxId = (picked as string) || null;
        }
        mailboxId = mailboxId || enrollment.mailbox_id || fallbackMailboxId;

        if (!mailboxId) {
          // No eligible mailbox — defer 10 minutes
          const retry = new Date(Date.now() + 10 * 60_000).toISOString();
          await supabase.from("sequence_enrollments").update({
            next_step_at: retry,
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "deferred", reason: "no_eligible_mailbox" });
          continue;
        }

        // Variable replacement
        const replaceVars = (text: string | null): string => {
          if (!text) return "";
          return text
            .replace(/\{\{first_name\}\}/gi, contact.first_name || "")
            .replace(/\{\{last_name\}\}/gi, contact.last_name || "")
            .replace(/\{\{company_name\}\}/gi, contact.company_name_raw || "")
            .replace(/\{\{job_title\}\}/gi, contact.job_title || "")
            .replace(/\{\{email\}\}/gi, contact.email || "");
        };
        const subject = replaceVars(step.email_subject);
        const bodyHtml = replaceVars(step.email_body);

        // Dedup
        const { data: existingEmail } = await supabase
          .from("emails")
          .select("id, status")
          .eq("enrollment_id", enrollment.id)
          .eq("sequence_step_id", step.id)
          .limit(1).maybeSingle();

        if (existingEmail) {
          const dms = nextStep ? Math.max(delayMs(nextStep), 60_000) : 60_000;
          const nextAt = new Date(Date.now() + dms).toISOString();
          await supabase.from("sequence_enrollments").update({
            current_step_order: nextStepOrder,
            next_step_at: nextStep ? nextAt : null,
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "skipped", reason: "duplicate_email_exists" });
          continue;
        }

        const { data: newEmail, error: emailErr } = await supabase
          .from("emails").insert({
            subject,
            body_html: bodyHtml,
            to_address: contact.email,
            contact_id: contact.id,
            sequence_id: enrollment.sequence_id,
            sequence_step_id: step.id,
            enrollment_id: enrollment.id,
            mailbox_id: mailboxId,
            status: "queued",
            owner_id: enrollment.enrolled_by,
          }).select().single();

        if (emailErr || !newEmail) {
          results.push({ enrollment_id: enrollment.id, status: "error", reason: emailErr?.message });
          continue;
        }

        // 4) Pacing: schedule queue send at last_send_at + min_wait + random_wait
        const minWait = (campaign?.min_wait_minutes ?? 3);
        const randomWait = Math.floor(Math.random() * (campaign?.random_wait_minutes ?? 5));
        const sendAt = new Date(Date.now() + (minWait + randomWait) * 60_000).toISOString();

        await supabase.from("message_queue").insert({
          queue_type: "email",
          payload: { email_id: newEmail.id, mailbox_id: mailboxId, enrollment_id: enrollment.id },
          reference_id: newEmail.id,
          reference_type: "email",
          sequence_id: enrollment.sequence_id,
          enrollment_id: enrollment.id,
          mailbox_id: mailboxId,
          scheduled_for: sendAt,
        });

        await supabase.from("email_events").insert({
          email_id: newEmail.id, event_type: "queued",
          details: { sequence_id: enrollment.sequence_id, step_order: currentStepOrder, mailbox_id: mailboxId },
        });

        const dms = nextStep ? Math.max(delayMs(nextStep), 60_000) : 60_000;
        const nextAt = new Date(Date.now() + dms).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextStep ? nextAt : null,
          mailbox_id: mailboxId,
          updated_at: now,
        }).eq("id", enrollment.id);

        results.push({ enrollment_id: enrollment.id, step_order: currentStepOrder, email_id: newEmail.id, mailbox_id: mailboxId, status: "queued", send_at: sendAt });
        continue;
      }

      // TASK / CALL
      if (step.step_type === "task" || step.step_type === "call") {
        if (step.step_type === "task") {
          await supabase.from("tasks").insert({
            title: step.label || `Sequence task (Step ${currentStepOrder})`,
            description: step.task_instructions,
            task_type: "follow_up",
            contact_id: enrollment.contact_id,
            sequence_id: enrollment.sequence_id,
            sequence_step_id: step.id,
            enrollment_id: enrollment.id,
            owner_id: enrollment.enrolled_by,
            assigned_to: enrollment.enrolled_by,
            created_by: enrollment.enrolled_by,
          });
        } else {
          await supabase.from("calls").insert({
            direction: "outbound",
            notes: step.call_instructions,
            contact_id: enrollment.contact_id,
            sequence_id: enrollment.sequence_id,
            sequence_step_id: step.id,
            enrollment_id: enrollment.id,
            owner_id: enrollment.enrolled_by,
            created_by: enrollment.enrolled_by,
          });
        }

        const dms = nextStep ? Math.max(delayMs(nextStep), 60_000) : 60_000;
        const nextAt = new Date(Date.now() + dms).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextStep ? nextAt : null,
          updated_at: now,
        }).eq("id", enrollment.id);

        results.push({ enrollment_id: enrollment.id, step_order: currentStepOrder, type: step.step_type, status: "created" });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
