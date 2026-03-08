/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_BATCH = 20;
const MAX_ATTEMPTS = 3;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: authErr } = await anonClient.auth.getUser();
    if (authErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const now = new Date().toISOString();

    // 1. Fetch pending email queue items that are due
    const { data: items, error: fetchErr } = await supabase
      .from("message_queue")
      .select("*")
      .eq("queue_type", "email")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .lt("attempts", MAX_ATTEMPTS)
      .order("priority", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(MAX_BATCH);

    if (fetchErr) throw fetchErr;
    if (!items?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const item of items) {
      const payload = item.payload as any;
      const emailId = payload?.email_id || item.reference_id;
      const mailboxId = payload?.mailbox_id || item.mailbox_id;

      if (!emailId) {
        // Mark as failed — no email_id
        await supabase.from("message_queue").update({
          status: "failed",
          last_error: "No email_id in payload",
          attempts: item.attempts + 1,
          completed_at: now,
        }).eq("id", item.id);
        results.push({ id: item.id, status: "failed", reason: "no_email_id" });
        continue;
      }

      // Fetch the email to determine mailbox
      const { data: email } = await supabase.from("emails").select("id, status, mailbox_id, to_address").eq("id", emailId).single();
      if (!email) {
        await supabase.from("message_queue").update({
          status: "failed",
          last_error: "Email record not found",
          attempts: item.attempts + 1,
          completed_at: now,
        }).eq("id", item.id);
        results.push({ id: item.id, status: "failed", reason: "email_not_found" });
        continue;
      }

      // Skip already sent/failed
      if (email.status === "sent" || email.status === "failed") {
        await supabase.from("message_queue").update({
          status: "completed",
          completed_at: now,
        }).eq("id", item.id);
        results.push({ id: item.id, status: "skipped", reason: `email_already_${email.status}` });
        continue;
      }

      const resolvedMailboxId = mailboxId || email.mailbox_id;
      if (!resolvedMailboxId) {
        await supabase.from("message_queue").update({
          status: "failed",
          last_error: "No mailbox assigned",
          attempts: item.attempts + 1,
          completed_at: now,
        }).eq("id", item.id);
        await supabase.from("emails").update({ status: "failed", error_message: "No mailbox assigned", updated_at: now }).eq("id", emailId);
        results.push({ id: item.id, status: "failed", reason: "no_mailbox" });
        continue;
      }

      // Fetch mailbox for readiness
      const { data: mailbox } = await supabase.from("mailboxes").select("*").eq("id", resolvedMailboxId).single();
      if (!mailbox || mailbox.connection_status !== "active") {
        const reason = !mailbox ? "mailbox_not_found" : "mailbox_not_active";
        await supabase.from("message_queue").update({
          status: "failed",
          last_error: reason,
          attempts: item.attempts + 1,
          completed_at: now,
        }).eq("id", item.id);
        results.push({ id: item.id, status: "failed", reason });
        continue;
      }

      // Claim the item (prevent duplicate processing)
      const { data: claimed, error: claimErr } = await supabase
        .from("message_queue")
        .update({ status: "processing", started_at: now, attempts: item.attempts + 1 })
        .eq("id", item.id)
        .eq("status", "pending") // optimistic lock
        .select()
        .single();

      if (claimErr || !claimed) {
        results.push({ id: item.id, status: "skipped", reason: "already_claimed" });
        continue;
      }

      // Call send-email function
      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ email_id: emailId, mailbox_id: resolvedMailboxId }),
        });

        const sendBody = await sendRes.json();

        if (sendRes.ok && sendBody.success) {
          results.push({ id: item.id, email_id: emailId, status: "sent" });
        } else {
          // send-email already updated email status; update queue
          if (claimed.attempts >= MAX_ATTEMPTS) {
            await supabase.from("message_queue").update({
              status: "failed",
              last_error: sendBody.error || "Send failed",
              completed_at: now,
            }).eq("id", item.id);
          } else {
            // Retry — put back to pending with backoff
            const backoffMinutes = Math.pow(2, claimed.attempts) * 5;
            const retryAt = new Date(Date.now() + backoffMinutes * 60000).toISOString();
            await supabase.from("message_queue").update({
              status: "pending",
              last_error: sendBody.error || "Send failed",
              scheduled_for: retryAt,
            }).eq("id", item.id);
          }
          results.push({ id: item.id, email_id: emailId, status: "failed", error: sendBody.error });
        }
      } catch (callErr: any) {
        await supabase.from("message_queue").update({
          status: "failed",
          last_error: callErr.message,
          completed_at: now,
        }).eq("id", item.id);
        results.push({ id: item.id, status: "error", error: callErr.message });
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
