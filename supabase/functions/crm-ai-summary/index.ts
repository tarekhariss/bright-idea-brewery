/// <reference lib="deno.ns" />
/**
 * crm-ai-summary — on-demand AI summary for a CRM Opportunity.
 *
 * Reads the opportunity, contact, company, notes, status history, recent
 * activities, linked tasks, deal, and source thread/campaign context.
 * Calls Lovable AI Gateway and persists ai_summary, ai_next_best_action,
 * urgency, icp_fit_score, objections, risk_flags, ai_generated_at.
 *
 * If LOVABLE_API_KEY is missing, returns 503 so the UI can show an honest
 * "AI not configured" state.
 *
 * Workspace-scoped: validates caller is a workspace member before reading
 * or writing. Soft rate-limited per opportunity to 1 request / 20s.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// In-memory soft rate-limit (per opportunity)
const lastRunByOpp = new Map<string, number>();
const RATE_WINDOW_MS = 20_000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  if (!LOVABLE_API_KEY) {
    return json(503, {
      error: "ai_not_configured",
      message:
        "Lovable AI is not enabled for this workspace. Ask an admin to enable it, then retry.",
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "unauthorized" });
  const userId = userData.user.id;

  let body: { opportunity_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const oppId = body.opportunity_id;
  if (!oppId) return json(400, { error: "opportunity_id required" });

  // Rate limit per opportunity
  const last = lastRunByOpp.get(oppId);
  if (last && Date.now() - last < RATE_WINDOW_MS) {
    return json(429, { error: "rate_limited", retry_after_ms: RATE_WINDOW_MS - (Date.now() - last) });
  }
  lastRunByOpp.set(oppId, Date.now());

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Load opportunity, validate workspace membership
  const { data: opp, error: oppErr } = await admin
    .from("opportunities")
    .select("*, contact:contacts(id, first_name, last_name, email, title, company_name), company:companies(id, name, domain, industry, country, employee_count)")
    .eq("id", oppId)
    .maybeSingle();
  if (oppErr || !opp) return json(404, { error: "not_found" });

  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", opp.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return json(403, { error: "forbidden" });

  // Fetch supporting context in parallel
  const [notesR, histR, actsR, tasksR, dealR] = await Promise.all([
    admin.from("opportunity_notes").select("body, created_at").eq("opportunity_id", oppId).order("created_at", { ascending: false }).limit(20),
    admin.from("opportunity_status_history").select("from_status, to_status, reason, changed_at").eq("opportunity_id", oppId).order("changed_at", { ascending: false }).limit(20),
    admin.from("activities").select("activity_type, title, description, occurred_at").eq("source_type", "opportunity").eq("source_id", oppId).order("occurred_at", { ascending: false }).limit(30),
    opp.contact_id
      ? admin.from("tasks").select("title, status, due_date, task_type").eq("contact_id", opp.contact_id).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as any[] }),
    opp.deal_id
      ? admin.from("deals").select("name, amount, stage_id, status").eq("id", opp.deal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Optional: latest source thread snippet
  let threadSummary = "";
  if (opp.source_thread_id && opp.source_thread_type === "email") {
    const { data: msgs } = await admin
      .from("inbox_messages")
      .select("subject, body_text, from_email, sent_at")
      .eq("thread_id", opp.source_thread_id)
      .order("sent_at", { ascending: false })
      .limit(3);
    threadSummary = (msgs ?? [])
      .map((m: any) => `From: ${m.from_email}\n${(m.body_text ?? "").slice(0, 800)}`)
      .join("\n---\n");
  } else if (opp.source_thread_id && opp.source_thread_type === "linkedin") {
    const { data: msgs } = await admin
      .from("linkedin_inbox_messages")
      .select("body, sent_at, direction")
      .eq("thread_id", opp.source_thread_id)
      .order("sent_at", { ascending: false })
      .limit(5);
    threadSummary = (msgs ?? [])
      .map((m: any) => `[${m.direction}] ${(m.body ?? "").slice(0, 500)}`)
      .join("\n---\n");
  }

  const promptContext = {
    opportunity: {
      title: opp.title,
      status: opp.status,
      priority: opp.priority,
      source_channel: opp.source_channel,
      created_at: opp.created_at,
      last_activity_at: opp.last_activity_at,
      next_action_at: opp.next_action_at,
    },
    contact: opp.contact,
    company: opp.company,
    deal: dealR?.data ?? null,
    recent_notes: (notesR.data ?? []).map((n: any) => n.body),
    status_history: histR.data ?? [],
    recent_activities: (actsR.data ?? []).map((a: any) => `${a.activity_type}: ${a.title}${a.description ? ` — ${a.description}` : ""}`),
    open_tasks: (tasksR.data ?? []).filter((t: any) => t.status !== "completed").map((t: any) => t.title),
    source_thread_excerpt: threadSummary || null,
  };

  const systemPrompt = `You are a precise B2B sales analyst. Read the opportunity context and respond ONLY with strict JSON matching this shape:
{
  "ai_summary": "2-4 sentence summary of where this opportunity stands today",
  "ai_next_best_action": "one concrete action the rep should take next, < 200 chars",
  "objections": ["short objection or concern", ...],   // 0-5 items
  "risk_flags": ["risk tag", ...],                      // 0-5 items, e.g. ["stale","ghosted","budget"]
  "urgency": "low" | "normal" | "high" | "urgent",
  "icp_fit_score": 0-100
}
No prose outside the JSON. If data is thin, still answer based on what is provided and lower icp_fit_score.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(promptContext) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    if (aiRes.status === 429) return json(429, { error: "ai_rate_limited", details: errText });
    if (aiRes.status === 402) return json(402, { error: "ai_credits_exhausted", details: errText });
    return json(502, { error: "ai_request_failed", status: aiRes.status, details: errText.slice(0, 500) });
  }
  const aiJson = await aiRes.json();
  const contentText: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(contentText); } catch {
    return json(502, { error: "ai_invalid_response", raw: contentText.slice(0, 500) });
  }

  const clean = {
    ai_summary: typeof parsed.ai_summary === "string" ? parsed.ai_summary.slice(0, 2000) : null,
    ai_next_best_action: typeof parsed.ai_next_best_action === "string" ? parsed.ai_next_best_action.slice(0, 400) : null,
    objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 5).map((s: any) => String(s).slice(0, 200)) : [],
    risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags.slice(0, 5).map((s: any) => String(s).slice(0, 60)) : [],
    urgency: ["low", "normal", "high", "urgent"].includes(parsed.urgency) ? parsed.urgency : "normal",
    icp_fit_score: typeof parsed.icp_fit_score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.icp_fit_score))) : null,
  };

  const { error: updErr } = await admin
    .from("opportunities")
    .update({
      ai_summary: clean.ai_summary,
      ai_next_best_action: clean.ai_next_best_action,
      objections: clean.objections,
      risk_flags: clean.risk_flags,
      urgency: clean.urgency,
      icp_fit_score: clean.icp_fit_score,
      ai_generated_at: new Date().toISOString(),
      ai_model: "google/gemini-3-flash-preview",
    })
    .eq("id", oppId);
  if (updErr) return json(500, { error: "persist_failed", details: updErr.message });

  return json(200, { ok: true, ...clean, ai_generated_at: new Date().toISOString() });
});
