// Verify SPF / DKIM / DMARC DNS records for a sending domain.
// Replaces the previous client-side Math.random() simulation.
//
// Request: { domain_id: string, dkim_selector?: string }
// Response: { domain_id, domain_name, spf, dkim, dmarc, all_pass, records, error? }
//
// SPF  : looks up TXT records on the apex; matches v=spf1.
// DKIM : looks up TXT on <selector>._domainkey.<domain>. Default selectors tried:
//        the explicit value passed in, then "default", "google", "selector1", "k1".
// DMARC: looks up TXT on _dmarc.<domain>; matches v=DMARC1.
//
// Status is written back to public.sending_domains.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type DnsStatus = "pass" | "fail" | "pending";

async function lookupTxt(name: string): Promise<string[]> {
  try {
    // Deno.resolveDns returns string[][] for TXT (one inner array per record).
    const recs = await Deno.resolveDns(name, "TXT");
    return recs.flat().map((s) => String(s));
  } catch (_e) {
    return [];
  }
}

function checkSpf(records: string[]): { status: DnsStatus; record: string | null } {
  const spf = records.find((r) => /^v=spf1\b/i.test(r.trim()));
  return { status: spf ? "pass" : "fail", record: spf ?? null };
}

function checkDmarc(records: string[]): { status: DnsStatus; record: string | null } {
  const d = records.find((r) => /^v=DMARC1\b/i.test(r.trim()));
  return { status: d ? "pass" : "fail", record: d ?? null };
}

async function checkDkim(domain: string, selectors: string[]): Promise<{
  status: DnsStatus;
  record: string | null;
  selector: string | null;
}> {
  for (const sel of selectors) {
    const recs = await lookupTxt(`${sel}._domainkey.${domain}`);
    const dkim = recs.find((r) => /(^|;\s*)v=DKIM1\b/i.test(r) || /\bp=/i.test(r));
    if (dkim) return { status: "pass", record: dkim, selector: sel };
  }
  return { status: "fail", record: null, selector: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const domainId = String(body.domain_id ?? "").trim();
    const explicitSelector = body.dkim_selector ? String(body.dkim_selector) : null;
    if (!domainId) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read/update; RLS authorisation already happened via the
    // signed-in client query on the frontend, and we re-verify membership below.
    const { data: domainRow, error: domErr } = await sb
      .from("sending_domains")
      .select("id, workspace_id, domain_name")
      .eq("id", domainId)
      .maybeSingle();

    if (domErr || !domainRow) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership check
    const { data: member } = await sb
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", domainRow.workspace_id)
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = String(domainRow.domain_name).toLowerCase();
    const apexTxt = await lookupTxt(domain);
    const dmarcTxt = await lookupTxt(`_dmarc.${domain}`);

    const spf = checkSpf(apexTxt);
    const dmarc = checkDmarc(dmarcTxt);
    const selectors = [
      ...(explicitSelector ? [explicitSelector] : []),
      "default",
      "google",
      "selector1",
      "k1",
      "mail",
    ];
    const dkim = await checkDkim(domain, selectors);

    const allPass = spf.status === "pass" && dkim.status === "pass" && dmarc.status === "pass";

    await sb
      .from("sending_domains")
      .update({
        spf_status: spf.status,
        dkim_status: dkim.status,
        dmarc_status: dmarc.status,
        status: allPass ? "verified" : "pending",
        verification_details: {
          checked_at: new Date().toISOString(),
          spf_record: spf.record,
          dkim_record: dkim.record,
          dkim_selector: dkim.selector,
          dmarc_record: dmarc.record,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", domainId);

    return new Response(
      JSON.stringify({
        domain_id: domainId,
        domain_name: domain,
        spf: spf.status,
        dkim: dkim.status,
        dmarc: dmarc.status,
        all_pass: allPass,
        records: {
          spf: spf.record,
          dkim: dkim.record,
          dkim_selector: dkim.selector,
          dmarc: dmarc.record,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
