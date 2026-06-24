import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId: string = body.workspace_id;
    const chunk: number = Number(body.chunk ?? 25);
    const maxIterations: number = Number(body.max_iterations ?? 1000);
    const parentJobId: string | undefined = body.parent_job_id;

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (parentJobId) {
      await supabase
        .from("import_jobs")
        .update({ post_processing_stage: "dedupe_companies", updated_at: new Date().toISOString() })
        .eq("id", parentJobId);
    }

    let totalMerged = 0;
    let totalGroups = 0;
    let iterations = 0;
    const start = Date.now();

    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      const { data, error } = await supabase.rpc("dedupe_companies_by_domain_chunk", {
        p_workspace_id: workspaceId,
        p_limit: chunk,
        p_actor: null,
      });
      if (error) {
        console.error("chunk error", error);
        return new Response(JSON.stringify({ ok: false, error: error.message, iterations, totalMerged, totalGroups }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rows = (data ?? []) as Array<{ merged_count: number }>;
      if (rows.length === 0) break;
      totalGroups += rows.length;
      totalMerged += rows.reduce((s, r) => s + (r.merged_count ?? 0), 0);
    }

    if (parentJobId) {
      await supabase
        .from("import_jobs")
        .update({
          post_processing_stage: "completed",
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", parentJobId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        workspace_id: workspaceId,
        iterations,
        totalGroups,
        totalMerged,
        elapsed_ms: Date.now() - start,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
