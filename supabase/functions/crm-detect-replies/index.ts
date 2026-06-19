/// <reference lib="deno.ns" />
/**
 * crm-detect-replies — opt-in positive reply detector.
 *
 * Scans recent inbound inbox_messages + linkedin_inbox_messages in the
 * workspace, classifies intent via Lovable AI, and either:
 *   - pushes to CRM through push_to_crm (high confidence + auto-push enabled)
 *   - writes to crm_review_queue (anything else above min-confidence)
 *   - skips (neutral / negative / below min-confidence)
 *
 * Guarded by crm_settings.auto_detect_positive_replies. Honors
 * positive_reply_confidence_threshold and positive_reply_review_mode.
 * Never duplicates: dedupe is per (workspace_id, source_type, source_message_id).
 *
 * Caller: an authenticated workspace member. The function runs with service
 * role internally but enforces membership in code.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const POSITIVE = new Set(["interested", "meeting_requested", "proposal_rfq"]);
const ALL_INTENTS = ["interested","meeting_requested","proposal_rfq","bad_timing","not_interested","neutral"] as const;
type Intent = typeof ALL_INTENTS[number];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function classify(text: string): Promise<{ intent: Intent; confidence: number; reasoning: string } | null> {
  if (!LOVABLE_API_KEY) return null;
  const sys = `Classify the sales reply into ONE intent: interested, meeting_requested, proposal_rfq, bad_timing, not_interested, neutral.
Return strict JSON: {"intent":"...","confidence":0.0-1.0,"reasoning":"one sentence"}.
- interested: positive signal, wants to learn more
- meeting_requested: asks for a call/demo/meeting or shares availability
- proposal_rfq: asks for pricing, proposal, quote, RFQ
- bad_timing: positive but not now (busy, later, next quarter)
- not_interested: explicit no, unsubscribe, remove, stop
- neutral: OOO, autoresponder, unclear
Confidence MUST reflect ambiguity. Output ONLY JSON.`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: text.slice(0, 3000) }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const intent = ALL_INTENTS.includes(parsed.intent) ? parsed.intent : "neutral";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    return { intent, confidence, reasoning: String(parsed.reasoning ?? "") };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({}));
  const workspaceId: string = body.workspace_id;
  const lookbackHours: number = Math.min(168, Math.max(1, Number(body.lookback_hours) || 24));
  if (!workspaceId) return json(400, { error: "workspace_id required" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: member } = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", userData.user.id).maybeSingle();
  if (!member) return json(403, { error: "forbidden" });

  const { data: settings } = await admin.from("crm_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!settings?.auto_detect_positive_replies) {
    return json(200, { skipped: true, reason: "auto_detect_disabled" });
  }
  const threshold = Number(settings.positive_reply_confidence_threshold ?? 0.8);
  const reviewMode = settings.positive_reply_review_mode !== false;
  const autoPush = settings.auto_push_high_confidence === true;
  const sinceIso = new Date(Date.now() - lookbackHours * 3600_000).toISOString();

  // Email inbound
  const { data: emailMsgs } = await admin
    .from("inbox_messages")
    .select("id, thread_id, body_text, body_html, subject, from_address, timestamp")
    .eq("direction", "inbound")
    .gte("timestamp", sinceIso)
    .limit(200);

  const stats = { scanned: 0, classified: 0, queued: 0, auto_pushed: 0, skipped: 0, errors: 0 };

  for (const m of emailMsgs ?? []) {
    stats.scanned++;
    // Ensure thread belongs to workspace
    const { data: thread } = await admin.from("inbox_threads")
      .select("id, workspace_id, contact_id, campaign_id, subject")
      .eq("id", m.thread_id).maybeSingle();
    if (!thread || thread.workspace_id !== workspaceId) continue;

    // Dedupe by review queue
    const { data: dup } = await admin.from("crm_review_queue")
      .select("id").eq("workspace_id", workspaceId).eq("source_type", "email_thread").eq("source_message_id", m.id).maybeSingle();
    if (dup) continue;

    // Skip if opportunity already exists for this thread
    const { data: oppExists } = await admin.from("opportunities")
      .select("id").eq("workspace_id", workspaceId).eq("source_thread_id", m.thread_id).limit(1).maybeSingle();
    // We still classify so we can update existing opp via push_to_crm dedupe; but if intent is positive.

    const text = (m.subject ? m.subject + "\n\n" : "") + (m.body_text ?? "").trim();
    if (!text) continue;
    const cls = await classify(text);
    if (!cls) { stats.errors++; continue; }
    stats.classified++;

    if (cls.intent === "neutral" || cls.intent === "not_interested" || cls.confidence < Math.min(threshold, 0.5)) {
      stats.skipped++; continue;
    }

    const suggestedStatus = cls.intent === "meeting_requested" ? "meeting_requested"
      : cls.intent === "proposal_rfq" ? "proposal_rfq"
      : cls.intent === "bad_timing" ? "bad_timing" : "interested";

    const shouldAutoPush = autoPush && !reviewMode && POSITIVE.has(cls.intent) && cls.confidence >= threshold && !oppExists;

    if (shouldAutoPush) {
      const { data: pushed, error: pushErr } = await admin.rpc("push_to_crm" as any, {
        payload: {
          workspace_id: workspaceId,
          contact_id: thread.contact_id,
          source_thread_id: m.thread_id,
          source_thread_type: "email_thread",
          source_message_id: m.id,
          source_campaign_id: thread.campaign_id,
          source_campaign_type: "email",
          source_channel: "email_reply",
          status: suggestedStatus,
          note: `Auto-detected ${cls.intent} (${Math.round(cls.confidence * 100)}%): ${cls.reasoning}`,
          caller_id: userData.user.id,
        },
      });
      if (pushErr) { stats.errors++; continue; }
      await admin.from("crm_review_queue").insert({
        workspace_id: workspaceId, source_type: "email_thread", source_thread_id: m.thread_id,
        source_message_id: m.id, contact_id: thread.contact_id,
        source_campaign_id: thread.campaign_id, source_campaign_type: "email",
        detected_intent: cls.intent, suggested_status: suggestedStatus, confidence: cls.confidence,
        reasoning: cls.reasoning, message_excerpt: text.slice(0, 500), ai_model: "google/gemini-2.5-flash",
        status: "auto_pushed", resolved_opportunity_id: (pushed as any)?.opportunity_id ?? null,
        resolved_at: new Date().toISOString(),
      });
      stats.auto_pushed++;
    } else {
      await admin.from("crm_review_queue").insert({
        workspace_id: workspaceId, source_type: "email_thread", source_thread_id: m.thread_id,
        source_message_id: m.id, contact_id: thread.contact_id,
        source_campaign_id: thread.campaign_id, source_campaign_type: "email",
        detected_intent: cls.intent, suggested_status: suggestedStatus, confidence: cls.confidence,
        reasoning: cls.reasoning, message_excerpt: text.slice(0, 500), ai_model: "google/gemini-2.5-flash",
        suggested_note: `${cls.intent} signal: ${cls.reasoning}`,
        status: "pending",
      });
      stats.queued++;
    }
  }

  // LinkedIn inbound
  const { data: liMsgs } = await admin
    .from("linkedin_inbox_messages")
    .select("id, thread_id, body, created_at, direction")
    .eq("direction", "inbound")
    .gte("created_at", sinceIso)
    .limit(200);

  for (const m of liMsgs ?? []) {
    stats.scanned++;
    const { data: thread } = await admin.from("linkedin_inbox_threads")
      .select("id, workspace_id, contact_id, campaign_id").eq("id", m.thread_id).maybeSingle();
    if (!thread || thread.workspace_id !== workspaceId) continue;

    const { data: dup } = await admin.from("crm_review_queue")
      .select("id").eq("workspace_id", workspaceId).eq("source_type", "linkedin_thread").eq("source_message_id", m.id).maybeSingle();
    if (dup) continue;

    const text = (m.body ?? "").trim();
    if (!text) continue;
    const cls = await classify(text);
    if (!cls) { stats.errors++; continue; }
    stats.classified++;
    if (cls.intent === "neutral" || cls.intent === "not_interested" || cls.confidence < Math.min(threshold, 0.5)) { stats.skipped++; continue; }

    const suggestedStatus = cls.intent === "meeting_requested" ? "meeting_requested"
      : cls.intent === "proposal_rfq" ? "proposal_rfq"
      : cls.intent === "bad_timing" ? "bad_timing" : "interested";

    await admin.from("crm_review_queue").insert({
      workspace_id: workspaceId, source_type: "linkedin_thread", source_thread_id: m.thread_id,
      source_message_id: m.id, contact_id: thread.contact_id,
      source_campaign_id: thread.campaign_id, source_campaign_type: "linkedin",
      detected_intent: cls.intent, suggested_status: suggestedStatus, confidence: cls.confidence,
      reasoning: cls.reasoning, message_excerpt: text.slice(0, 500), ai_model: "google/gemini-2.5-flash",
      suggested_note: `${cls.intent} signal: ${cls.reasoning}`, status: "pending",
    });
    stats.queued++;
  }

  await admin.from("crm_settings").update({ last_reply_detection_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);

  return json(200, { ok: true, ...stats });
});
