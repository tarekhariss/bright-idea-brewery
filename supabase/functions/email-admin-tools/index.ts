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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action as string;

    // ── Action: check_readiness ──
    if (action === "check_readiness") {
      const { mailbox_id } = body;
      if (!mailbox_id) {
        return new Response(JSON.stringify({ error: "mailbox_id required" }), { status: 400, headers: corsHeaders });
      }

      const { data, error } = await supabase.rpc("check_mailbox_readiness", { p_mailbox_id: mailbox_id });
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: test_send ──
    if (action === "test_send") {
      const { mailbox_id, to_address } = body;
      if (!mailbox_id || !to_address) {
        return new Response(JSON.stringify({ error: "mailbox_id and to_address required" }), { status: 400, headers: corsHeaders });
      }

      // Create a test email record
      const { data: testEmail, error: createErr } = await supabase.from("emails").insert({
        subject: "🧪 Test Email from Outreach Platform",
        body_html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Test Email</h2>
          <p>This is a test email sent from your outreach platform to verify mailbox connectivity.</p>
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
          <p style="color: #666; font-size: 12px;">Mailbox ID: ${mailbox_id}</p>
        </div>`,
        to_address,
        mailbox_id,
        status: "queued",
        owner_id: userData.user.id,
        metadata: { test_email: true },
      }).select().single();

      if (createErr) throw createErr;

      // Call send-email directly
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ email_id: testEmail!.id, mailbox_id }),
      });

      const sendBody = await sendRes.json();

      await supabase.from("system_activity_log").insert({
        action: "test_email_sent",
        entity_type: "mailbox",
        entity_id: mailbox_id,
        performed_by: userData.user.id,
        details: { to_address, success: sendRes.ok, result: sendBody },
      });

      return new Response(JSON.stringify({
        success: sendRes.ok,
        email_id: testEmail!.id,
        result: sendBody,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: preview_payload ──
    if (action === "preview_payload") {
      const { email_id, mailbox_id } = body;
      if (!email_id || !mailbox_id) {
        return new Response(JSON.stringify({ error: "email_id and mailbox_id required" }), { status: 400, headers: corsHeaders });
      }

      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ email_id, mailbox_id, dry_run: true }),
      });

      const result = await sendRes.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: queue_health ──
    if (action === "queue_health") {
      const { data: pending } = await supabase
        .from("message_queue")
        .select("id", { count: "exact" })
        .eq("queue_type", "email")
        .eq("status", "pending");

      const { data: processing } = await supabase
        .from("message_queue")
        .select("id", { count: "exact" })
        .eq("queue_type", "email")
        .eq("status", "processing");

      const { data: failed } = await supabase
        .from("message_queue")
        .select("id", { count: "exact" })
        .eq("queue_type", "email")
        .eq("status", "failed");

      const { data: completed } = await supabase
        .from("message_queue")
        .select("id", { count: "exact" })
        .eq("queue_type", "email")
        .eq("status", "completed");

      const { data: stuckItems } = await supabase
        .from("message_queue")
        .select("id, reference_id, last_error, attempts, scheduled_for")
        .eq("queue_type", "email")
        .eq("status", "processing")
        .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // stuck > 10 min
        .limit(10);

      return new Response(JSON.stringify({
        pending: pending?.length ?? 0,
        processing: processing?.length ?? 0,
        failed: failed?.length ?? 0,
        completed: completed?.length ?? 0,
        stuck_items: stuckItems || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: process_queue (trigger queue processing) ──
    if (action === "process_queue") {
      const processRes = await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: "{}",
      });
      const result = await processRes.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: process_sequences (trigger sequence step processing) ──
    if (action === "process_sequences") {
      const { mailbox_id } = body;
      const processRes = await fetch(`${supabaseUrl}/functions/v1/process-sequence-steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ mailbox_id }),
      });
      const result = await processRes.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
