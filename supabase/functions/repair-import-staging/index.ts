/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const RequestSchema = z.object({
  parent_job_id: z.string().uuid(),
  bucket: z.string().min(1).default("verification-uploads"),
  file_path: z.string().min(1),
});

type CsvRow = Record<string, string>;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCSVAll(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(current); current = ""; }
      else if (char === "\n" || char === "\r") {
        row.push(current); current = "";
        rows.push(row); row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      } else current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const parsed = parseCSVAll(text);
  if (parsed.length === 0) throw new Error("CSV is empty");
  const headers = parsed[0].map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => !h)) throw new Error("No CSV headers detected");
  const rows = parsed.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((values) => {
      const obj: CsvRow = {};
      headers.forEach((h, idx) => { obj[h] = (values[idx] ?? "").trim(); });
      return obj;
    });
  return { headers, rows };
}

async function fetchExistingRowNumbers(supabase: any, childId: string): Promise<Set<number>> {
  const existing = new Set<number>();
  const pageSize = 5000;
  for (let from = 0;; from += pageSize) {
    const { data, error } = await supabase
      .from("import_job_rows")
      .select("row_number")
      .eq("import_job_id", childId)
      .order("row_number", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed reading staged rows for ${childId}: ${error.message}`);
    const rows = (data ?? []) as Array<{ row_number: number }>;
    for (const r of rows) existing.add(Number(r.row_number));
    if (rows.length < pageSize) break;
  }
  return existing;
}

async function invokeRunImportJob(childId: string) {
  const res = await fetch(`${supabaseUrl}/functions/v1/run-import-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ job_id: childId }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`run-import-job failed for ${childId}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!bearerToken) return json(401, { success: false, error: "Unauthorized" });

    const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json(400, { success: false, error: parsed.error.message });
    const { parent_job_id, bucket, file_path } = parsed.data;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader! } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authError } = await userClient.auth.getUser(bearerToken);
    if (authError || !authData?.user) return json(401, { success: false, error: "Unauthorized" });
    const userId = authData.user.id;

    const { data: parent, error: parentError } = await admin
      .from("import_jobs")
      .select("*")
      .eq("id", parent_job_id)
      .maybeSingle();
    if (parentError || !parent) return json(404, { success: false, error: "Parent import job not found" });
    if (parent.parent_job_id) return json(400, { success: false, error: "Repair must be run on the parent import job" });

    if (parent.workspace_id) {
      const { data: member, error: memberError } = await admin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", parent.workspace_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (memberError) throw new Error(`Workspace membership check failed: ${memberError.message}`);
      if (!member) return json(403, { success: false, error: "Forbidden" });
    } else if (parent.created_by !== userId) {
      return json(403, { success: false, error: "Forbidden" });
    }

    const { data: children, error: childrenError } = await admin
      .from("import_jobs")
      .select("*")
      .eq("parent_job_id", parent_job_id)
      .order("batch_index", { ascending: true });
    if (childrenError) throw new Error(`Failed loading child batches: ${childrenError.message}`);

    const childRows = children ?? [];
    const incompleteChildren: any[] = [];
    for (const child of childRows) {
      const { count, error } = await admin
        .from("import_job_rows")
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", child.id);
      if (error) throw new Error(`Failed counting staged rows for batch ${child.batch_index}: ${error.message}`);
      const staged = count ?? 0;
      const planned = Number(child.total_rows ?? 0);
      if (planned > 0 && staged < planned) incompleteChildren.push({ ...child, staged_rows: staged, missing_staged_rows: planned - staged });
    }

    if (incompleteChildren.length === 0) {
      return json(200, { success: true, parent_job_id, staged_inserted: 0, repaired_children: 0, message: "No missing staged rows found" });
    }

    const { data: fileBlob, error: downloadError } = await admin.storage.from(bucket).download(file_path);
    if (downloadError || !fileBlob) throw new Error(`Could not read uploaded CSV: ${downloadError?.message ?? "download failed"}`);
    const csvText = await fileBlob.text();
    const { rows } = parseCsv(csvText);

    const expected = Number(parent.total_rows ?? 0);
    if (expected > 0 && rows.length < expected) {
      throw new Error(`Uploaded CSV has ${rows.length.toLocaleString()} rows but parent planned ${expected.toLocaleString()} rows. Upload the original full CSV.`);
    }

    const before = incompleteChildren.map((c) => ({
      child_id: c.id,
      batch_index: c.batch_index,
      planned: c.total_rows,
      staged_before: c.staged_rows,
      missing_before: c.missing_staged_rows,
    }));

    let stagedInserted = 0;
    const perChild: any[] = [];

    for (const child of incompleteChildren) {
      const planned = Number(child.total_rows ?? 0);
      const start = Number(child.batch_row_start ?? 1);
      const existing = await fetchExistingRowNumbers(admin, child.id);
      const missingPayload: Array<{ import_job_id: string; row_number: number; raw_data: CsvRow; status: string }> = [];

      for (let rowNumber = 1; rowNumber <= planned; rowNumber++) {
        if (existing.has(rowNumber)) continue;
        const originalIndex = start - 1 + (rowNumber - 1);
        const raw = rows[originalIndex];
        if (!raw) throw new Error(`CSV missing original row ${originalIndex + 1} for batch ${child.batch_index}`);
        missingPayload.push({
          import_job_id: child.id,
          row_number: rowNumber,
          raw_data: raw,
          status: "pending",
        });
      }

      let insertedForChild = 0;
      const chunkSize = 1000;
      for (let i = 0; i < missingPayload.length; i += chunkSize) {
        const chunk = missingPayload.slice(i, i + chunkSize);
        const { error } = await admin
          .from("import_job_rows")
          .upsert(chunk, { onConflict: "import_job_id,row_number", ignoreDuplicates: true });
        if (error) throw new Error(`Failed staging batch ${child.batch_index}: ${error.message}`);
        insertedForChild += chunk.length;
      }

      const { count: stagedAfter, error: countAfterError } = await admin
        .from("import_job_rows")
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", child.id);
      if (countAfterError) throw new Error(`Failed recounting batch ${child.batch_index}: ${countAfterError.message}`);
      if ((stagedAfter ?? 0) !== planned) {
        throw new Error(`Batch ${child.batch_index} still has ${stagedAfter ?? 0}/${planned} staged rows after repair`);
      }

      await admin.from("import_jobs").update({
        status: "pending",
        processed_rows: Number(child.success_rows ?? 0) + Number(child.error_rows ?? 0) + Number(child.duplicate_rows ?? 0) + Number(child.review_rows ?? 0),
        completed_at: null,
        error_summary: {
          ...(child.error_summary ?? {}),
          incomplete_staging: false,
          repaired_at: new Date().toISOString(),
          repaired_by: userId,
          repaired_rows: missingPayload.length,
          staged_rows_after_repair: stagedAfter ?? 0,
        },
      }).eq("id", child.id);

      stagedInserted += insertedForChild;
      perChild.push({
        child_id: child.id,
        batch_index: child.batch_index,
        planned,
        staged_before: child.staged_rows,
        staged_after: stagedAfter ?? 0,
        missing_staged_after: Math.max(0, planned - (stagedAfter ?? 0)),
        inserted_attempted: insertedForChild,
      });
    }

    await admin.from("import_jobs").update({
      status: "processing",
      completed_at: null,
      error_summary: {
        ...(parent.error_summary ?? {}),
        incomplete_staging: false,
        repaired_at: new Date().toISOString(),
        repaired_by: userId,
        repair_source_file_path: file_path,
      },
    }).eq("id", parent_job_id);

    const resumeResults: any[] = [];
    for (const child of incompleteChildren) {
      resumeResults.push({ child_id: child.id, batch_index: child.batch_index, result: await invokeRunImportJob(child.id) });
    }

    return json(200, {
      success: true,
      parent_job_id,
      repaired_children: incompleteChildren.length,
      staged_inserted: stagedInserted,
      before,
      after: perChild,
      resume_results: resumeResults,
    });
  } catch (e: any) {
    console.error("repair-import-staging failed", e);
    return json(500, { success: false, error: e?.message ?? String(e) });
  }
});
