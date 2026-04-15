/// <reference lib="deno.ns" />
/**
 * Unified background job runner — called via pg_cron every 5 minutes.
 * Handles: analytics aggregation, admin KPI population, dynamic list refresh,
 * and stuck import job detection.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const incomingSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");
  const isAuthed =
    (incomingSecret && cronSecret && incomingSecret === cronSecret) ||
    (authHeader === `Bearer ${serviceKey}`);

  if (!isAuthed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const results: Record<string, any> = {};

  try {
    // ── 0. Stuck import job detection ──────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabase
      .from("import_jobs")
      .select("id, started_at, total_rows, processed_rows")
      .eq("status", "processing")
      .lt("started_at", oneHourAgo);

    for (const job of stuckJobs ?? []) {
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_summary: { reason: `Job stuck in processing for over 1 hour. Started at ${job.started_at}. ${job.processed_rows}/${job.total_rows} rows processed before stall.` },
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
    results.stuck_jobs_failed = (stuckJobs ?? []).length;

    // ── 1. Populate admin_platform_kpis ───────────────────────────
    const [
      { count: totalContacts },
      { count: totalCompanies },
      { count: totalWorkspaces },
      { count: totalCampaigns },
      { count: activeCampaigns },
      { count: emailsSent },
      { count: meetingsBooked },
      { count: dealsCreated },
    ] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("workspaces").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("emails").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("meetings").select("id", { count: "exact", head: true }),
      supabase.from("deals").select("id", { count: "exact", head: true }),
    ]);

    const { data: existingKpi } = await supabase
      .from("admin_platform_kpis")
      .select("id")
      .limit(1)
      .maybeSingle();

    const kpiData = {
      total_contacts: totalContacts ?? 0,
      total_companies: totalCompanies ?? 0,
      total_workspaces: totalWorkspaces ?? 0,
      total_campaigns: totalCampaigns ?? 0,
      active_campaigns: activeCampaigns ?? 0,
      emails_sent: emailsSent ?? 0,
      meetings_booked: meetingsBooked ?? 0,
      deals_created: dealsCreated ?? 0,
      active_workspaces: totalWorkspaces ?? 0,
      updated_at: new Date().toISOString(),
    };

    if (existingKpi) {
      await supabase.from("admin_platform_kpis").update(kpiData).eq("id", existingKpi.id);
    } else {
      await supabase.from("admin_platform_kpis").insert(kpiData);
    }
    results.platform_kpis = "updated";

    // ── 2. Populate workspace summaries ───────────────────────────
    const { data: allWorkspaces } = await supabase.from("workspaces").select("id, name");
    for (const ws of allWorkspaces ?? []) {
      const [contacts, companies, campaigns, active, emails, meetings, deals] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("status", "active"),
        supabase.from("emails").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("meetings").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
      ]);

      await supabase.from("admin_workspace_summaries").upsert({
        workspace_id: ws.id,
        workspace_name: ws.name,
        total_contacts: contacts.count ?? 0,
        total_companies: companies.count ?? 0,
        total_campaigns: campaigns.count ?? 0,
        active_campaigns: active.count ?? 0,
        emails_sent: emails.count ?? 0,
        meetings_booked: meetings.count ?? 0,
        deals_created: deals.count ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id" });
    }
    results.workspace_summaries = `updated ${(allWorkspaces ?? []).length}`;

    // ── 3. Campaign performance metrics ───────────────────────────
    const { data: activeCampaignsList } = await supabase
      .from("campaigns")
      .select("id, workspace_id")
      .in("status", ["active", "paused"])
      .limit(500);

    for (const camp of activeCampaignsList ?? []) {
      const { data: stats } = await supabase
        .from("campaign_stats")
        .select("*")
        .eq("campaign_id", camp.id)
        .maybeSingle();

      if (stats) {
        await supabase.from("campaign_performance_metrics").upsert({
          campaign_id: camp.id,
          workspace_id: camp.workspace_id,
          emails_sent: stats.emails_sent ?? 0,
          emails_delivered: (stats.emails_sent ?? 0) - (stats.bounces ?? 0),
          replies_received: stats.replies ?? 0,
          reply_rate: stats.emails_sent ? (stats.replies ?? 0) / stats.emails_sent : 0,
          meetings_booked: stats.meetings ?? 0,
          deals_created: stats.deals ?? 0,
          revenue_generated: stats.revenue ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "campaign_id" });
      }
    }
    results.campaign_metrics = `processed ${(activeCampaignsList ?? []).length}`;

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
