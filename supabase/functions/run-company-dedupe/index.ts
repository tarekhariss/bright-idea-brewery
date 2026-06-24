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
    let failed = false;
    let lastError: string | null = null;

    try {
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
      let consecutiveErrors = 0;

      while (Date.now() - start < maxMs) {
        iterations++;
        const { data, error } = await supabase.rpc("dedupe_companies_by_domain_chunk", {
          p_workspace_id: workspaceId,
          p_limit: chunk,
          p_actor: null,
        });
        if (error) {
          console.error("chunk error", error);
          lastError = error.message;
          consecutiveErrors++;
          if (consecutiveErrors >= 5) { failed = true; break; }
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        consecutiveErrors = 0;
        const rows = (data ?? []) as Array<{ merged_count: number }>;
        if (rows.length === 0) break;
        totalGroups += rows.length;
        totalMerged += rows.reduce((s, r) => s + (r.merged_count ?? 0), 0);
      }

      console.log("dedupe loop done", { workspaceId, iterations, totalGroups, totalMerged, elapsed_ms: Date.now() - start });

      if (parentJobId && !failed) {
        await supabase
          .from("import_jobs")
          .update({ post_processing_stage: "final_validation", updated_at: new Date().toISOString() })
          .eq("id", parentJobId);

        // Final validation pass: drain any stragglers
        for (let i = 0; i < 50; i++) {
          const { data: d } = await supabase.rpc("dedupe_companies_by_domain_chunk", {
            p_workspace_id: workspaceId, p_limit: chunk, p_actor: null,
          });
          if (!Array.isArray(d) || d.length === 0) break;
        }
      }
    } catch (e: any) {
      console.error("dedupe fatal", e);
      failed = true;
      lastError = String(e?.message ?? e);
    }

    if (parentJobId) {
      if (failed) {
        await supabase
          .from("import_jobs")
          .update({
            post_processing_stage: "failed",
            updated_at: new Date().toISOString(),
            error_summary: { post_processing_error: lastError ?? "unknown" },
          })
          .eq("id", parentJobId);
      } else {
        await supabase
          .from("import_jobs")
          .update({
            post_processing_stage: "completed",
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", parentJobId);
      }
    }
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
