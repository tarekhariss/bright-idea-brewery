/// <reference lib="deno.ns" />
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

/**
 * Auth: accepts either a valid user JWT or a cron secret header.
 */
async function authenticateCaller(req: Request): Promise<boolean> {
  const incomingCronSecret = req.headers.get("x-cron-secret");
  if (incomingCronSecret && cronSecret && incomingCronSecret === cronSecret) {
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await anonClient.auth.getUser(token);
  return !error && !!data?.user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorized = await authenticateCaller(req);
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const body = await req.json().catch(() => ({}));
    const defaultMailboxId = body.mailbox_id || null;

    // 1. Fetch active enrollments with next_step_at <= now
    // current_step_order starts at 1 and represents the step to process NEXT.
    // On enrollment creation, current_step_order = 1 means "step 1 is next".
    const { data: enrollments, error: enErr } = await supabase
      .from("sequence_enrollments")
      .select("*, sequences(id, name, status)")
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

      // Safeguard: skip if sequence paused/archived
      if (!sequence || sequence.status !== "active") {
        results.push({ enrollment_id: enrollment.id, status: "skipped", reason: "sequence_not_active" });
        continue;
      }

      // 2. Get the step matching current_step_order (NOT +1).
      // current_step_order = the step_order we need to execute now.
      const currentStepOrder = enrollment.current_step_order;
      const { data: step } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_order", currentStepOrder)
        .single();

      if (!step) {
        // No step at this order — enrollment is complete
        await supabase.from("sequence_enrollments").update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, status: "completed", reason: "no_more_steps" });
        continue;
      }

      // Calculate the next step's timing for after we process this step
      const nextStepOrder = currentStepOrder + 1;

      // Get the NEXT step to calculate its delay (if it exists)
      const { data: nextStep } = await supabase
        .from("sequence_steps")
        .select("delay_days, delay_hours")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_order", nextStepOrder)
        .maybeSingle();

      // Safeguard: skip inactive steps (advance to next)
      if (!step.is_active) {
        const delayMs = nextStep
          ? ((nextStep.delay_days || 0) * 86400 + (nextStep.delay_hours || 0) * 3600) * 1000
          : 60000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextStep ? nextAt : null,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, step_order: currentStepOrder, status: "skipped", reason: "step_inactive" });
        continue;
      }

      // 3. Handle step by type
      if (step.step_type === "email") {
        // Get contact for email address
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, email, first_name, last_name, job_title, company_name_raw")
          .eq("id", enrollment.contact_id)
          .single();

        if (!contact?.email) {
          await supabase.from("sequence_enrollments").update({
            status: "failed",
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "failed", reason: "contact_no_email" });
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

        // Check for duplicate: same enrollment + step already has an email
        const { data: existingEmail } = await supabase
          .from("emails")
          .select("id, status")
          .eq("enrollment_id", enrollment.id)
          .eq("sequence_step_id", step.id)
          .limit(1)
          .maybeSingle();

        if (existingEmail) {
          // Duplicate — still advance
          const delayMs = nextStep
            ? ((nextStep.delay_days || 0) * 86400 + (nextStep.delay_hours || 0) * 3600) * 1000
            : 60000;
          const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
          await supabase.from("sequence_enrollments").update({
            current_step_order: nextStepOrder,
            next_step_at: nextStep ? nextAt : null,
            updated_at: now,
          }).eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "skipped", reason: "duplicate_email_exists" });
          continue;
        }

        // Create email record
        const { data: newEmail, error: emailErr } = await supabase
          .from("emails")
          .insert({
            subject,
            body_html: bodyHtml,
            to_address: contact.email,
            contact_id: contact.id,
            sequence_id: enrollment.sequence_id,
            sequence_step_id: step.id,
            enrollment_id: enrollment.id,
            mailbox_id: defaultMailboxId,
            status: "queued",
            owner_id: enrollment.enrolled_by,
          })
          .select()
          .single();

        if (emailErr || !newEmail) {
          results.push({ enrollment_id: enrollment.id, status: "error", reason: emailErr?.message });
          continue;
        }

        // Queue the email
        await supabase.from("message_queue").insert({
          queue_type: "email",
          payload: { email_id: newEmail.id, mailbox_id: defaultMailboxId, enrollment_id: enrollment.id },
          reference_id: newEmail.id,
          reference_type: "email",
          sequence_id: enrollment.sequence_id,
          enrollment_id: enrollment.id,
          mailbox_id: defaultMailboxId,
          scheduled_for: now,
        });

        await supabase.from("email_events").insert({
          email_id: newEmail.id,
          event_type: "queued",
          details: { sequence_id: enrollment.sequence_id, step_order: currentStepOrder },
        });

        // Advance enrollment to next step
        const delayMs = nextStep
          ? ((nextStep.delay_days || 0) * 86400 + (nextStep.delay_hours || 0) * 3600) * 1000
          : 60000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextStep ? nextAt : null,
          updated_at: now,
        }).eq("id", enrollment.id);

        results.push({ enrollment_id: enrollment.id, step_order: currentStepOrder, email_id: newEmail.id, status: "queued" });

      } else if (step.step_type === "task" || step.step_type === "call") {
        // Create task or call record
        if (step.step_type === "task") {
          // task_type constraint: 'general','call','email','follow_up','linkedin','custom'
          // Use 'follow_up' for sequence-generated tasks (NOT 'sequence' which is invalid)
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

        // Advance enrollment
        const delayMs = nextStep
          ? ((nextStep.delay_days || 0) * 86400 + (nextStep.delay_hours || 0) * 3600) * 1000
          : 60000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
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
