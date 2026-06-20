// TEMPORARY QA helper — mints a short-lived session for the QA workspace admin
// so that backend-driven UI parity tests of /verification/email-memory can run
// against the deployed `ingest-verification-upload` edge function as a real
// authenticated user. Restricted to the QA workspace + a fixed header secret.
// DELETE AFTER QA.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-qa-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QA_SECRET = "ba3db687eddc02b28155e05053ef0187046e957221f6b859";
const QA_WORKSPACE = "461b9c23-16d9-43f7-b533-6ff13486cf81";
const QA_USER_EMAIL = "info@theleadsbridge.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("x-qa-secret") !== QA_SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "mint";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: ws } = await admin.from("workspaces").select("id, intelligence_v2, name").eq("id", QA_WORKSPACE).maybeSingle();
    if (!ws?.intelligence_v2) {
      return new Response(JSON.stringify({ error: "qa_flag_off" }), { status: 412, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "qa_seed_contacts") {
      // Insert a small set of test contacts with QA marker; safe to call repeatedly.
      const emails: string[] = await req.json().then(b => b?.emails ?? []).catch(() => []);
      const rows = emails.map((e: string) => ({
        workspace_id: QA_WORKSPACE,
        email: e,
        email_normalized: e.toLowerCase(),
        first_name: "QA",
        last_name: "Test",
        source: "qa_phase1a_backend_test",
      }));
      const { data, error } = await admin.from("contacts").upsert(rows, { onConflict: "workspace_id,email_normalized", ignoreDuplicates: false }).select("id, email_normalized, email_canonical_status, email_status_source, email_status_verified_at, email_confidence, email_is_role_based, email_is_disposable, email_is_catch_all");
      if (error) return new Response(JSON.stringify({ error: "seed_failed", detail: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, inserted: data?.length ?? 0, contacts: data }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
    }

    if (action === "qa_inspect_contacts") {
      const emails: string[] = await req.json().then(b => b?.emails ?? []).catch(() => []);
      const { data, error } = await admin.from("contacts").select("email_normalized, email_canonical_status, email_status_source, email_status_verified_at, email_confidence, email_is_role_based, email_is_disposable, email_is_catch_all, email_is_free_email").eq("workspace_id", QA_WORKSPACE).in("email_normalized", emails);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ contacts: data }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
    }

    if (action === "qa_cleanup_contacts") {
      const { error } = await admin.from("contacts").delete().eq("workspace_id", QA_WORKSPACE).eq("source", "qa_phase1a_backend_test");
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
    }

    if (action === "qa_cleanup_history") {
      // Remove any historical_upload rows from this QA test run only (by source prefix list provided)
      const sources: string[] = await req.json().then(b => b?.sources ?? []).catch(() => []);
      if (!sources.length) return new Response(JSON.stringify({ error: "no_sources" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const { error } = await admin.from("email_status_history").delete().eq("workspace_id", QA_WORKSPACE).in("source", sources);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
    }

    // default: mint JWT
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: QA_USER_EMAIL });
    if (linkErr || !link?.properties?.email_otp) {
      return new Response(JSON.stringify({ error: "mint_failed", detail: linkErr?.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({ email: QA_USER_EMAIL, token: link.properties.email_otp, type: "magiclink" });
    if (vErr || !sess?.session?.access_token) {
      return new Response(JSON.stringify({ error: "verify_failed", detail: vErr?.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ access_token: sess.session.access_token, user_id: sess.session.user.id, workspace_id: QA_WORKSPACE, workspace_name: ws.name, expires_in: sess.session.expires_in }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "internal", detail: String(e?.message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
