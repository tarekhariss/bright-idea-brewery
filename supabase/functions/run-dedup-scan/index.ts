/// <reference lib="deno.ns" />
/**
 * Server-side duplicate scanning job.
 * Scans contacts in a workspace for duplicates using email, LinkedIn, and name+company matching.
 * Processes in chunks to handle large datasets.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHUNK_SIZE = 10000;
const MAX_GROUPS = 500;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { workspace_id, entity_type = "contact" } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), { status: 400, headers: corsHeaders });
    }

    // Build indices from all contacts in workspace
    const emailMap = new Map<string, string[]>();
    const linkedinMap = new Map<string, string[]>();
    const nameCompanyMap = new Map<string, string[]>();
    let offset = 0;
    let totalScanned = 0;

    while (true) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email, secondary_email, linkedin_url, first_name, last_name, company_name_raw")
        .eq("workspace_id", workspace_id)
        .range(offset, offset + CHUNK_SIZE - 1);

      if (!contacts || contacts.length === 0) break;
      totalScanned += contacts.length;

      for (const c of contacts) {
        const id = c.id;
        if (c.email) {
          const key = c.email.toLowerCase();
          emailMap.set(key, [...(emailMap.get(key) ?? []), id]);
        }
        if (c.secondary_email) {
          const key = (c.secondary_email as string).toLowerCase();
          emailMap.set(key, [...(emailMap.get(key) ?? []), id]);
        }
        if (c.linkedin_url) {
          const key = c.linkedin_url.toLowerCase().replace(/\/+$/, "");
          linkedinMap.set(key, [...(linkedinMap.get(key) ?? []), id]);
        }
        const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().trim();
        const companyNorm = c.company_name_raw ? (c.company_name_raw as string).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
        if (fullName && companyNorm) {
          const key = `${fullName}|${companyNorm}`;
          nameCompanyMap.set(key, [...(nameCompanyMap.get(key) ?? []), id]);
        }
      }

      if (contacts.length < CHUNK_SIZE) break;
      offset += CHUNK_SIZE;
    }

    // Find duplicate groups
    const seen = new Set<string>();
    const dupGroups: { ids: string[]; rules: string[]; confidence: number }[] = [];

    const addGroup = (ids: string[], rule: string, confidence: number) => {
      const unique = [...new Set(ids)];
      if (unique.length < 2) return;
      const key = unique.sort().join(",");
      if (seen.has(key)) return;
      seen.add(key);
      dupGroups.push({ ids: unique.slice(0, 5), rules: [rule], confidence });
    };

    for (const [, ids] of emailMap) addGroup(ids, "email_match", 95);
    for (const [, ids] of linkedinMap) addGroup(ids, "linkedin_match", 90);
    for (const [, ids] of nameCompanyMap) addGroup(ids, "name_company_match", 70);

    // Insert groups (capped)
    let inserted = 0;
    for (const g of dupGroups.slice(0, MAX_GROUPS)) {
      const { data: group } = await supabase
        .from("duplicate_groups")
        .insert({
          workspace_id,
          entity_type,
          status: "pending",
          record_count: g.ids.length,
          primary_record_id: g.ids[0],
          confidence_score: g.confidence,
          match_rules: g.rules,
        })
        .select("id")
        .single();

      if (!group) continue;
      inserted++;

      const candidates = g.ids.map((id, idx) => ({
        group_id: group.id,
        record_id: id,
        entity_type,
        match_score: g.confidence,
        match_reasons: g.rules,
        is_primary: idx === 0,
        merge_status: "candidate",
      }));

      await supabase.from("duplicate_candidates").insert(candidates);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: totalScanned,
        groups_found: dupGroups.length,
        groups_inserted: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
