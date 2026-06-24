import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const workspaceId: string = body.workspace_id;
  const chunk: number = Number(body.chunk ?? 25);
  const parentJobId: string | undefined = body.parent_job_id;
  const background: boolean = body.background !== false;

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

  const work = async () => {
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
    const maxMs = 25 * 60 * 1000;

    while (Date.now() - start < maxMs) {
      iterations++;
      const { data, error } = await supabase.rpc("dedupe_companies_by_domain_chunk", {
        p_workspace_id: workspaceId,
        p_limit: chunk,
        p_actor: null,
      });
      if (error) {
        console.error("chunk error", error);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
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

    console.log("dedupe finished", { workspaceId, iterations, totalGroups, totalMerged, elapsed_ms: Date.now() - start });
  };

  if (background) {
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(work());
    return new Response(JSON.stringify({ ok: true, started: true, workspace_id: workspaceId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await work();
  return new Response(JSON.stringify({ ok: true, workspace_id: workspaceId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
