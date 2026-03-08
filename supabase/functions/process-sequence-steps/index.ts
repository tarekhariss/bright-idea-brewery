/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: authErr } = await anonClient.auth.getUser();
    if (authErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const body = await req.json().catch(() => ({}));
    const defaultMailboxId = body.mailbox_id || null;

    // 1. Fetch active enrollments with next_step_at <= now
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

      // 2. Get the next step
      const nextStepOrder = enrollment.current_step_order + 1;
      const { data: step } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_order", nextStepOrder)
        .single();

      if (!step) {
        // No more steps — mark enrollment as completed
        await supabase.from("sequence_enrollments").update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, status: "completed", reason: "no_more_steps" });
        continue;
      }

      // Safeguard: skip inactive steps
      if (!step.is_active) {
        // Advance to next step
        const delayMs = ((step.delay_days || 0) * 86400 + (step.delay_hours || 0) * 3600) * 1000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextAt,
          updated_at: now,
        }).eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, step_order: nextStepOrder, status: "skipped", reason: "step_inactive" });
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
          results.push({ enrollment_id: enrollment.id, status: "skipped", reason: "duplicate_email_exists" });
          // Still advance
          const delayMs = ((step.delay_days || 0) * 86400 + (step.delay_hours || 0) * 3600) * 1000;
          const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
          await supabase.from("sequence_enrollments").update({
            current_step_order: nextStepOrder,
            next_step_at: nextAt,
            updated_at: now,
          }).eq("id", enrollment.id);
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
          details: { sequence_id: enrollment.sequence_id, step_order: nextStepOrder },
        });

        // Advance enrollment
        const delayMs = ((step.delay_days || 0) * 86400 + (step.delay_hours || 0) * 3600) * 1000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextAt,
          updated_at: now,
        }).eq("id", enrollment.id);

        results.push({ enrollment_id: enrollment.id, step_order: nextStepOrder, email_id: newEmail.id, status: "queued" });

      } else if (step.step_type === "task" || step.step_type === "call") {
        // Create task/call record and advance
        if (step.step_type === "task") {
          await supabase.from("tasks").insert({
            title: step.label || `Sequence task (Step ${nextStepOrder})`,
            description: step.task_instructions,
            task_type: "sequence",
            contact_id: enrollment.contact_id,
            sequence_id: enrollment.sequence_id,
            sequence_step_id: step.id,
            enrollment_id: enrollment.id,
            owner_id: enrollment.enrolled_by,
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

        const delayMs = ((step.delay_days || 0) * 86400 + (step.delay_hours || 0) * 3600) * 1000;
        const nextAt = new Date(Date.now() + Math.max(delayMs, 60000)).toISOString();
        await supabase.from("sequence_enrollments").update({
          current_step_order: nextStepOrder,
          next_step_at: nextAt,
          updated_at: now,
        }).eq("id", enrollment.id);

        results.push({ enrollment_id: enrollment.id, step_order: nextStepOrder, type: step.step_type, status: "created" });
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
