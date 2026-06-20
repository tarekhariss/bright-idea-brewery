/// <reference lib="deno.ns" />
/**
 * Server-side export job processor.
 * Generates CSV for large exports (up to 100k rows), stores in Supabase Storage,
 * and updates the export_jobs table with progress.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const BATCH_SIZE = 5000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = authData.user.id;

    const supabase = createClient(supabaseUrl, serviceKey);
    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from("export_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }

    // Verify user is a member of the job's workspace
    if (job.workspace_id) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("user_id", userId)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden: not a workspace member" }), { status: 403, headers: corsHeaders });
      }
    } else if (job.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Update to processing
    await supabase.from("export_jobs").update({
      status: "processing",
      started_at: new Date().toISOString(),
    }).eq("id", job_id);

    const table = job.entity_type === "contact" ? "contacts" : "companies";
    const columns = job.selected_columns as string[];

    // Resolve pseudo-column: company_custom_fields (joined from companies on contact exports)
    const wantsCompanyCustomFields = job.entity_type === "contact" && columns.includes("company_custom_fields");
    const dbCols = columns.filter((c) => c !== "company_custom_fields");
    const selectStr = wantsCompanyCustomFields
      ? `${dbCols.join(",")},companies:companies!contacts_company_id_fkey(custom_fields)`
      : dbCols.join(",");

    // Build CSV header (use the user-selected labels, including the pseudo column)
    const csvParts: string[] = [columns.join(",")];
    let processedRows = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(table)
        .select(selectStr)
        .range(offset, offset + BATCH_SIZE - 1);

      if (job.workspace_id) {
        query = query.eq("workspace_id", job.workspace_id);
      }

      if (job.export_type === "selected" && job.selected_ids?.length) {
        query = query.in("id", job.selected_ids);
      }

      const { data: rows, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        const vals = columns.map((col) => {
          let v: unknown;
          if (col === "company_custom_fields") v = (row as any)?.companies?.custom_fields ?? null;
          else if (col === "custom_fields") v = (row as any)?.custom_fields ?? null;
          else v = (row as any)[col];
          if (v === null || v === undefined) return "";
          const str = typeof v === "object" && !Array.isArray(v)
            ? JSON.stringify(v)
            : Array.isArray(v) ? v.join("; ") : String(v);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        });
        csvParts.push(vals.join(","));
      }

      processedRows += rows.length;
      offset += BATCH_SIZE;

      // Update progress
      await supabase.from("export_jobs").update({
        processed_rows: processedRows,
      }).eq("id", job_id);

      if (rows.length < BATCH_SIZE) hasMore = false;
    }


    const csvContent = csvParts.join("\n");
    const fileName = job.file_name || `export_${job_id}.csv`;

    // Upload to storage
    const bucketName = "exports";
    // Ensure bucket exists
    await supabase.storage.createBucket(bucketName, { public: false });

    const filePath = `${job.workspace_id || "global"}/${fileName}`;
    const { error: uploadErr } = await supabase.storage
      .from(bucketName)
      .upload(filePath, new Blob([csvContent], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadErr) {
      // Fallback — mark completed without storage URL
      await supabase.from("export_jobs").update({
        status: "completed",
        processed_rows: processedRows,
        total_rows: processedRows,
        completed_at: new Date().toISOString(),
        error_message: `Storage upload failed. CSV was ${csvContent.length} bytes.`,
      }).eq("id", job_id);
    } else {
      const { data: urlData } = await supabase.storage.from(bucketName).createSignedUrl(filePath, 86400);

      await supabase.from("export_jobs").update({
        status: "completed",
        processed_rows: processedRows,
        total_rows: processedRows,
        file_url: urlData?.signedUrl || null,
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);
    }

    return new Response(
      JSON.stringify({ success: true, job_id, rows: processedRows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "An error occurred processing the export" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
