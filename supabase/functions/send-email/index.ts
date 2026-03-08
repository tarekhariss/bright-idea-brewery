/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

interface SendRequest {
  email_id: string;
  mailbox_id: string;
  dry_run?: boolean;
}

/**
 * Authenticates the request. Supports two modes:
 * 1. User JWT — validated via getClaims(), returns user ID
 * 2. Internal/cron — validated via x-cron-secret header, returns "__cron__"
 */
async function authenticateCaller(req: Request): Promise<{ callerId: string } | { error: string }> {
  // Check cron secret first (internal calls from pg_cron or other functions)
  const incomingCronSecret = req.headers.get("x-cron-secret");
  if (incomingCronSecret && cronSecret && incomingCronSecret === cronSecret) {
    return { callerId: "__cron__" };
  }

  // Check service_role key passed as Bearer token (function-to-function calls)
  const authHeader = req.headers.get("Authorization");
  if (authHeader === `Bearer ${serviceKey}`) {
    return { callerId: "__service__" };
  }

  // Otherwise validate as user JWT
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized — no valid auth header" };
  }

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Unauthorized — invalid JWT" };
  }
  return { callerId: data.user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateCaller(req);
    if ("error" in auth) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body: SendRequest = await req.json();
    const { email_id, mailbox_id, dry_run } = body;

    if (!email_id || !mailbox_id) {
      return new Response(JSON.stringify({ error: "email_id and mailbox_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Fetch email record
    const { data: email, error: emailErr } = await supabase
      .from("emails")
      .select("*")
      .eq("id", email_id)
      .single();
    if (emailErr || !email) {
      return new Response(JSON.stringify({ error: "Email not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // 2. Fetch mailbox config (with joined domain)
    const { data: mailbox, error: mbErr } = await supabase
      .from("mailboxes")
      .select("*, sending_domains(id, domain_name, status)")
      .eq("id", mailbox_id)
      .single();
    if (mbErr || !mailbox) {
      return new Response(JSON.stringify({ error: "Mailbox not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // 3. Readiness checks — uses real ConnectionStatus enum values
    const issues: string[] = [];
    if (mailbox.connection_status !== "active") {
      issues.push(`Mailbox connection is ${mailbox.connection_status}`);
    }
    if (!mailbox.smtp_host) issues.push("No SMTP host configured");
    if (mailbox.daily_sending_limit <= 0) issues.push("No daily limit set");

    if (issues.length > 0 && !dry_run) {
      return new Response(JSON.stringify({ error: "Mailbox not ready", issues }), {
        status: 422,
        headers: corsHeaders,
      });
    }

    // 4. Build send payload
    const fromAddress = mailbox.display_name
      ? `${mailbox.display_name} <${mailbox.email}>`
      : mailbox.email;

    const payload = {
      from: fromAddress,
      to: email.to_address,
      cc: email.cc || undefined,
      bcc: email.bcc || undefined,
      subject: email.subject,
      html: email.body_html || "",
      text: email.body_text || email.body_html?.replace(/<[^>]*>/g, "") || "",
    };

    // Dry run — return payload without sending
    if (dry_run) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          payload,
          mailbox: {
            id: mailbox.id,
            email: mailbox.email,
            smtp_host: mailbox.smtp_host,
            smtp_port: mailbox.smtp_port,
            connection_status: mailbox.connection_status,
          },
          issues,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check daily limit atomically via RPC
    const { data: limitOk } = await supabase.rpc("increment_daily_send_count", {
      p_mailbox_id: mailbox_id,
      p_limit: mailbox.daily_sending_limit,
    });

    if (!limitOk) {
      const now = new Date().toISOString();
      await supabase.from("emails").update({ status: "failed", error_message: "Daily sending limit reached", updated_at: now }).eq("id", email_id);
      await supabase.from("email_events").insert({ email_id, event_type: "failed", details: { reason: "daily_limit_reached" } });
      return new Response(JSON.stringify({ error: "Daily sending limit reached" }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // 6. Mark as processing
    const now = new Date().toISOString();
    await supabase.from("emails").update({ status: "processing", mailbox_id, updated_at: now }).eq("id", email_id);
    await supabase.from("email_events").insert({ email_id, event_type: "processing" });

    // 7. Get SMTP password from secrets
    const smtpPassword = Deno.env.get(`SMTP_PASS_${mailbox_id}`);
    if (!smtpPassword) {
      await supabase.from("emails").update({ status: "failed", error_message: `SMTP password not configured (secret SMTP_PASS_${mailbox_id})`, updated_at: now }).eq("id", email_id);
      await supabase.from("email_events").insert({ email_id, event_type: "failed", details: { reason: "missing_smtp_secret" } });
      return new Response(JSON.stringify({ error: `SMTP secret not found: SMTP_PASS_${mailbox_id}` }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 8. Send via SMTP
    try {
      const client = new SmtpClient();

      const connectConfig: any = {
        hostname: mailbox.smtp_host!,
        port: mailbox.smtp_port,
        username: mailbox.smtp_username || mailbox.email,
        password: smtpPassword,
      };

      if (mailbox.smtp_secure) {
        await client.connectTLS(connectConfig);
      } else {
        await client.connect(connectConfig);
      }

      await client.send({
        from: mailbox.email,
        to: email.to_address,
        cc: email.cc ? email.cc.split(",").map((s: string) => s.trim()) : undefined,
        bcc: email.bcc ? email.bcc.split(",").map((s: string) => s.trim()) : undefined,
        subject: email.subject,
        content: email.body_text || email.body_html?.replace(/<[^>]*>/g, "") || "",
        html: email.body_html || undefined,
      });

      await client.close();

      // 9. Mark as sent
      const sentAt = new Date().toISOString();
      await supabase.from("emails").update({
        status: "sent",
        sent_at: sentAt,
        from_address: mailbox.email,
        updated_at: sentAt,
      }).eq("id", email_id);

      await supabase.from("email_events").insert({
        email_id,
        event_type: "sent",
        details: { mailbox_id, sent_at: sentAt },
      });

      // Update mailbox convenience counter (emails_sent_today exists on mailboxes table)
      await supabase.from("mailboxes").update({
        emails_sent_today: (mailbox.emails_sent_today || 0) + 1,
        last_checked_at: sentAt,
        updated_at: sentAt,
      }).eq("id", mailbox_id);

      // Update message_queue if exists
      await supabase.from("message_queue").update({
        status: "completed",
        completed_at: sentAt,
      }).eq("reference_id", email_id).eq("reference_type", "email").eq("status", "processing");

      // Activity log (only if caller is a real user)
      if (auth.callerId !== "__cron__" && auth.callerId !== "__service__") {
        await supabase.from("system_activity_log").insert({
          action: "email_sent",
          entity_type: "email",
          entity_id: email_id,
          performed_by: auth.callerId,
          details: { mailbox_id, to: email.to_address },
        });
      }

      return new Response(
        JSON.stringify({ success: true, email_id, status: "sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpError: any) {
      // SMTP failure
      const errMsg = smtpError?.message || "Unknown SMTP error";
      const failedAt = new Date().toISOString();
      await supabase.from("emails").update({
        status: "failed",
        error_message: errMsg,
        updated_at: failedAt,
      }).eq("id", email_id);

      await supabase.from("email_events").insert({
        email_id,
        event_type: "failed",
        details: { reason: "smtp_error", error: errMsg },
      });

      await supabase.from("message_queue").update({
        status: "failed",
        last_error: errMsg,
        completed_at: failedAt,
      }).eq("reference_id", email_id).eq("reference_type", "email").eq("status", "processing");

      return new Response(
        JSON.stringify({ error: "SMTP send failed", details: errMsg }),
        { status: 502, headers: corsHeaders }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
