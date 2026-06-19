/// <reference lib="deno.ns" />
/**
 * crm-stale-sweeper — flags stale open opportunities. Never closes anything.
 *
 * Per workspace (or single via workspace_id param):
 *   - Reads crm_settings.default_stale_days
 *   - Updates opportunities.is_stale = true when:
 *       status is open AND (no future next_action_at) AND
 *       max(last_activity_at, created_at) older than threshold
 *   - Clears is_stale = false otherwise
 *   - Inserts an activities row only when an opportunity transitions to stale
 *
 * Callable by:
 *   - authenticated workspace member (manual "Run sweep" button)
 *   - cron, by sending header x-cron-secret matching CRON_SECRET
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

function json(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sweepWorkspace(admin: any, workspaceId: string) {
  const { data: settings } = await admin.from("crm_settings").select("default_stale_days, stale_sweeper_enabled")
    .eq("workspace_id", workspaceId).maybeSingle();
  if (settings?.stale_sweeper_enabled === false) return { workspace_id: workspaceId, skipped: "disabled" };
  const staleDays = settings?.default_stale_days ?? 14;
  const cutoff = new Date(Date.now() - staleDays * 86400_000).toISOString();
  const nowIso = new Date().toISOString();

  // Fetch open opps
  const { data: opps } = await admin.from("opportunities")
    .select("id, status, last_activity_at, created_at, next_action_at, is_stale, contact_id, company_id")
    .eq("workspace_id", workspaceId)
    .not("status", "in", "(won,lost,not_fit,bad_timing)");

  let newlyStale = 0, cleared = 0, unchanged = 0;
  const toMarkStale: string[] = [];
  const toClear: string[] = [];
  const transitionedToStale: any[] = [];

  for (const o of opps ?? []) {
    const anchor = o.last_activity_at ?? o.created_at;
    const futureAction = o.next_action_at && new Date(o.next_action_at).getTime() > Date.now();
    const isStale = !futureAction && anchor && new Date(anchor).getTime() < new Date(cutoff).getTime();
    if (isStale && !o.is_stale) { toMarkStale.push(o.id); transitionedToStale.push(o); newlyStale++; }
    else if (!isStale && o.is_stale) { toClear.push(o.id); cleared++; }
    else unchanged++;
  }

  if (toMarkStale.length) {
    await admin.from("opportunities").update({ is_stale: true }).in("id", toMarkStale);
    const rows = transitionedToStale.map((o) => ({
      workspace_id: workspaceId, activity_type: "note", contact_id: o.contact_id, company_id: o.company_id,
      source_type: "opportunity", source_id: o.id, title: "Flagged as stale",
      description: `No activity in the last ${staleDays} days.`,
      metadata: { auto: true, sweeper: true },
    }));
    if (rows.length) await admin.from("activities").insert(rows);
  }
  if (toClear.length) {
    await admin.from("opportunities").update({ is_stale: false }).in("id", toClear);
  }
  await admin.from("crm_settings").update({ last_stale_sweep_at: nowIso }).eq("workspace_id", workspaceId);
  return { workspace_id: workspaceId, newly_stale: newlyStale, cleared, unchanged };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret");
  const body = await req.json().catch(() => ({}));
  const workspaceId: string | undefined = body.workspace_id;

  // Cron path: sweep all workspaces with sweeper enabled
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    const { data: ws } = await admin.from("crm_settings").select("workspace_id").eq("stale_sweeper_enabled", true);
    const results = [];
    for (const w of ws ?? []) results.push(await sweepWorkspace(admin, w.workspace_id));
    return json(200, { ok: true, results });
  }

  // User path
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: "unauthorized" });
  if (!workspaceId) return json(400, { error: "workspace_id required" });
  const { data: member } = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", userData.user.id).maybeSingle();
  if (!member) return json(403, { error: "forbidden" });

  return json(200, await sweepWorkspace(admin, workspaceId));
});
