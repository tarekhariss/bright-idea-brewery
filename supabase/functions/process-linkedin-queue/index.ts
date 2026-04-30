/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

const MAX_BATCH = 15;
const MAX_RETRIES = 3;

type QueueRow = {
  id: string;
  workspace_id: string | null;
  linkedin_account_id: string;
  contact_id: string;
  campaign_id: string | null;
  campaign_step_id: string | null;
  action_type: string;
  status: string;
  scheduled_at: string | null;
  retry_count: number;
  payload: Record<string, unknown>;
};

type Adapter = {
  id: string;
  workspace_id: string;
  provider: string; // 'unipile' | 'heyreach' | 'phantombuster' | 'webhook'
  config: Record<string, unknown>;
  credentials_secret_name: string | null;
};

type AdapterResult = {
  outcome: "success" | "failure" | "retry";
  response?: Record<string, unknown>;
  error?: string;
};

// ---------------- Auth ----------------
async function authenticateCaller(req: Request): Promise<boolean> {
  const incomingCronSecret = req.headers.get("x-cron-secret");
  if (incomingCronSecret && cronSecret && incomingCronSecret === cronSecret) {
    return true;
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await anonClient.auth.getUser(token);
  return !error && !!data?.user;
}

// ---------------- Adapter Dispatcher ----------------
/**
 * Each adapter receives the queue row + sender profile + contact info
 * and returns an AdapterResult. No scraping or browser automation.
 */
async function dispatchToAdapter(
  adapter: Adapter,
  ctx: {
    action: QueueRow;
    senderAccount: Record<string, unknown>;
    contact: Record<string, unknown>;
  },
): Promise<AdapterResult> {
  const apiKey = adapter.credentials_secret_name
    ? Deno.env.get(adapter.credentials_secret_name) ?? null
    : null;

  const payload = {
    action_type: ctx.action.action_type,
    sender: {
      account_id: adapter.config?.account_id ?? ctx.senderAccount.id,
      profile_url: ctx.senderAccount.profile_url ?? null,
    },
    target: {
      contact_id: ctx.action.contact_id,
      linkedin_url: ctx.contact.linkedin_url ?? null,
      first_name: ctx.contact.first_name ?? null,
      last_name: ctx.contact.last_name ?? null,
    },
    message_body: ctx.action.payload?.message_body ?? null,
    metadata: ctx.action.payload ?? {},
  };

  try {
    switch (adapter.provider) {
      case "unipile": {
        const baseUrl = (adapter.config?.base_url as string) ?? "https://api.unipile.com";
        if (!apiKey) return { outcome: "failure", error: "Missing Unipile API key (secret not set)" };
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/linkedin/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return { outcome: "success", response: body };
        if (res.status >= 500 || res.status === 429) {
          return { outcome: "retry", error: `Unipile ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
        }
        return { outcome: "failure", error: `Unipile ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
      }
      case "heyreach": {
        const baseUrl = (adapter.config?.base_url as string) ?? "https://api.heyreach.io";
        if (!apiKey) return { outcome: "failure", error: "Missing HeyReach API key" };
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/public/action/enqueue`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return { outcome: "success", response: body };
        if (res.status >= 500 || res.status === 429) return { outcome: "retry", error: `HeyReach ${res.status}` };
        return { outcome: "failure", error: `HeyReach ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
      }
      case "phantombuster": {
        if (!apiKey) return { outcome: "failure", error: "Missing PhantomBuster API key" };
        const res = await fetch("https://api.phantombuster.com/api/v2/agents/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Phantombuster-Key-1": apiKey },
          body: JSON.stringify({ id: adapter.config?.agent_id, argument: payload }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return { outcome: "success", response: body };
        if (res.status >= 500 || res.status === 429) return { outcome: "retry", error: `PhantomBuster ${res.status}` };
        return { outcome: "failure", error: `PhantomBuster ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
      }
      case "webhook": {
        const url = adapter.config?.webhook_url as string | undefined;
        if (!url) return { outcome: "failure", error: "Webhook URL not configured" };
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
        const text = await res.text();
        let body: unknown;
        try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
        if (res.ok) return { outcome: "success", response: body as Record<string, unknown> };
        if (res.status >= 500 || res.status === 429) return { outcome: "retry", error: `Webhook ${res.status}` };
        return { outcome: "failure", error: `Webhook ${res.status}: ${text.slice(0, 200)}` };
      }
      default:
        return { outcome: "failure", error: `Unknown adapter provider: ${adapter.provider}` };
    }
  } catch (err) {
    // Network/transport errors are retryable
    return { outcome: "retry", error: `Adapter transport error: ${(err as Error).message}` };
  }
}

// ---------------- Main loop ----------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!(await authenticateCaller(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const runStart = new Date();
    const notes: Array<Record<string, unknown>> = [];
    let claimed = 0, succeeded = 0, failed = 0, blocked = 0, skipped = 0;

    // Open run record
    const { data: runRow } = await supabase
      .from("linkedin_worker_runs")
      .insert({ started_at: runStart.toISOString() })
      .select("id")
      .single();
    const runId = runRow?.id as string | undefined;

    // 1. Atomically claim a batch of due actions
    const { data: batch, error: claimErr } = await supabase
      .rpc("linkedin_claim_due_actions", { _limit: MAX_BATCH });
    if (claimErr) throw claimErr;
    const actions = (batch ?? []) as QueueRow[];
    claimed = actions.length;

    // Cache adapters per workspace within this run
    const adapterCache = new Map<string, Adapter | null>();

    for (const action of actions) {
      const wsId = action.workspace_id;
      try {
        // 'wait' actions are no-ops: just complete and schedule next step
        if (action.action_type === "wait") {
          await supabase.rpc("linkedin_record_action_result", {
            _queue_id: action.id,
            _outcome: "success",
            _provider_response: { type: "wait" },
            _error: null,
            _max_retries: MAX_RETRIES,
          });
          succeeded++;
          notes.push({ id: action.id, status: "wait_completed" });
          continue;
        }

        if (!wsId) {
          await supabase.rpc("linkedin_block_action", { _queue_id: action.id, _reason: "Missing workspace" });
          blocked++; notes.push({ id: action.id, status: "blocked", reason: "no workspace" });
          continue;
        }

        // 2. Resolve adapter
        let adapter = adapterCache.get(wsId);
        if (adapter === undefined) {
          const { data: adp } = await supabase
            .from("linkedin_execution_adapters")
            .select("id, workspace_id, provider, config, credentials_secret_name, is_active")
            .eq("workspace_id", wsId)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          adapter = (adp as Adapter | null) ?? null;
          adapterCache.set(wsId, adapter);
        }
        if (!adapter) {
          await supabase.rpc("linkedin_block_action", {
            _queue_id: action.id,
            _reason: "Execution provider required",
          });
          blocked++; notes.push({ id: action.id, status: "blocked", reason: "no adapter" });
          continue;
        }

        // 3. Sender profile checks: active + capacity + window
        const { data: sender } = await supabase
          .from("linkedin_accounts")
          .select("*")
          .eq("id", action.linkedin_account_id)
          .maybeSingle();
        if (!sender || sender.connection_status !== "connected") {
          await supabase.rpc("linkedin_block_action", {
            _queue_id: action.id,
            _reason: `Sender not connected (status: ${sender?.connection_status ?? "missing"})`,
          });
          blocked++; notes.push({ id: action.id, status: "blocked", reason: "sender inactive" });
          continue;
        }

        const { data: capRaw } = await supabase.rpc("linkedin_account_remaining_capacity", {
          _account_id: action.linkedin_account_id,
          _action_type: action.action_type,
        });
        const remaining = Number(capRaw ?? 0);
        if (remaining <= 0) {
          // Reschedule for next day at 09:00 UTC
          const next = new Date(); next.setUTCDate(next.getUTCDate() + 1); next.setUTCHours(9, 0, 0, 0);
          await supabase.from("linkedin_action_queue").update({
            status: "pending", scheduled_at: next.toISOString(),
            error_message: "Daily capacity reached", updated_at: new Date().toISOString(),
          }).eq("id", action.id);
          skipped++; notes.push({ id: action.id, status: "rescheduled", reason: "capacity" });
          continue;
        }

        const { data: inWin } = await supabase.rpc("linkedin_account_in_window", {
          _account_id: action.linkedin_account_id,
        });
        if (inWin === false) {
          // Try again in 30 minutes
          const next = new Date(Date.now() + 30 * 60 * 1000);
          await supabase.from("linkedin_action_queue").update({
            status: "pending", scheduled_at: next.toISOString(),
            error_message: "Outside sending window", updated_at: new Date().toISOString(),
          }).eq("id", action.id);
          skipped++; notes.push({ id: action.id, status: "rescheduled", reason: "window" });
          continue;
        }

        // 4. Stoplist check
        const { data: stop } = await supabase.rpc("linkedin_contact_on_stoplist", {
          _workspace_id: wsId, _contact_id: action.contact_id,
        });
        if (stop === true) {
          await supabase.rpc("linkedin_block_action", { _queue_id: action.id, _reason: "Contact on stoplist" });
          blocked++; notes.push({ id: action.id, status: "blocked", reason: "stoplist" });
          continue;
        }

        // 5. Lead/campaign status check (skip if paused/removed)
        if (action.campaign_id) {
          const { data: lead } = await supabase
            .from("linkedin_campaign_leads")
            .select("id, status")
            .eq("campaign_id", action.campaign_id)
            .eq("contact_id", action.contact_id)
            .maybeSingle();
          if (lead && ["paused", "removed", "completed", "replied"].includes(lead.status)) {
            await supabase.rpc("linkedin_block_action", {
              _queue_id: action.id, _reason: `Lead status: ${lead.status}`,
            });
            blocked++; notes.push({ id: action.id, status: "blocked", reason: `lead ${lead.status}` });
            continue;
          }
        }

        // 6. Load contact and dispatch
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, linkedin_url, email")
          .eq("id", action.contact_id)
          .maybeSingle();

        const result = await dispatchToAdapter(adapter, {
          action,
          senderAccount: sender,
          contact: contact ?? {},
        });

        // 7. Record outcome
        await supabase.rpc("linkedin_record_action_result", {
          _queue_id: action.id,
          _outcome: result.outcome,
          _provider_response: result.response ?? {},
          _error: result.error ?? null,
          _max_retries: MAX_RETRIES,
        });
        if (result.outcome === "success") succeeded++;
        else failed++;
        notes.push({ id: action.id, status: result.outcome, error: result.error ?? null });
      } catch (rowErr) {
        failed++;
        const msg = (rowErr as Error).message;
        notes.push({ id: action.id, status: "error", error: msg });
        await supabase.rpc("linkedin_record_action_result", {
          _queue_id: action.id, _outcome: "retry",
          _provider_response: {}, _error: msg, _max_retries: MAX_RETRIES,
        }).catch(() => {});
      }
    }

    // Close run
    if (runId) {
      await supabase.from("linkedin_worker_runs").update({
        finished_at: new Date().toISOString(),
        claimed, succeeded, failed, blocked, skipped,
        notes: notes.slice(0, 100),
      }).eq("id", runId);
    }

    return new Response(
      JSON.stringify({ ok: true, claimed, succeeded, failed, blocked, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("LinkedIn worker fatal", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
