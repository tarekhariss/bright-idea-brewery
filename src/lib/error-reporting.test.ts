import { describe, expect, it, vi } from "vitest";
import {
  describeError,
  recordErrorEvent,
  sanitizeMetadata,
  scrubString,
} from "./error-reporting";

const okClient = () => ({
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ error: null })),
});

describe("secrets never reach storage", () => {
  it.each([
    "authorization", "Authorization", "api_key", "apiKey", "API-KEY",
    "smtp_password", "password", "service_role_key", "access_token",
    "refresh_token", "webhook_secret", "worker_secret", "session", "cookie",
    "SENTRY_DSN",
  ])("redacts the %s key", (key) => {
    const out = sanitizeMetadata({ [key]: "super-secret-value" }) as Record<string, unknown>;
    expect(out[key]).toBe("[redacted]");
    expect(JSON.stringify(out)).not.toContain("super-secret-value");
  });

  it("redacts credential-shaped values whatever the key is called", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
    expect(scrubString(`token is ${jwt}`)).not.toContain(jwt);
    expect(scrubString("Bearer abcdefghijklmnop")).toContain("[redacted]");
    expect(scrubString("sk_live_abcdefgh12345678")).toContain("[redacted]");
  });

  it("redacts connection strings that carry credentials", () => {
    const dsn = "postgresql://admin:hunter2@db.example.com:5432/app";
    expect(scrubString(`failed on ${dsn}`)).not.toContain("hunter2");
  });

  it("redacts nested secrets", () => {
    const out = sanitizeMetadata({
      request: { headers: { authorization: "Bearer xyz123456789012" } },
    }) as any;
    expect(JSON.stringify(out)).not.toContain("xyz123456789012");
  });

  it("keeps ordinary diagnostic fields intact", () => {
    const out = sanitizeMetadata({ job_id: "abc", row_count: 42, ok: true }) as any;
    expect(out).toEqual({ job_id: "abc", row_count: 42, ok: true });
  });
});

describe("metadata cannot grow without bound", () => {
  it("truncates long strings", () => {
    const out = scrubString("x".repeat(2000));
    expect(out.length).toBeLessThan(600);
    expect(out).toContain("truncated");
  });

  it("caps the number of keys", () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 200; i++) big[`k${i}`] = i;
    const out = sanitizeMetadata(big) as Record<string, unknown>;
    expect(Object.keys(out).length).toBeLessThanOrEqual(41);
  });

  it("summarises structures that are too deep rather than serialising them", () => {
    const deep = { a: { b: { c: { d: { e: "secret-ish payload" } } } } };
    const out = JSON.stringify(sanitizeMetadata(deep));
    expect(out).not.toContain("secret-ish payload");
  });

  it("caps array length", () => {
    const out = sanitizeMetadata({ rows: Array.from({ length: 100 }, (_, i) => i) }) as any;
    expect(out.rows.length).toBeLessThanOrEqual(20);
  });
});

describe("describeError", () => {
  it("uses an Error's message and name", () => {
    expect(describeError(new TypeError("x.catch is not a function"))).toEqual({
      message: "x.catch is not a function",
      code: "TypeError",
    });
  });

  it("handles bare strings", () => {
    expect(describeError("something broke").message).toBe("something broke");
  });

  it("handles PostgREST-style error objects", () => {
    expect(describeError({ message: "permission denied", code: "42501" })).toEqual({
      message: "permission denied",
      code: "42501",
    });
  });

  it("handles null and undefined without throwing", () => {
    expect(describeError(null).message).toBe("null");
    expect(describeError(undefined).message).toBe("undefined");
  });

  it("scrubs secrets out of the message itself", () => {
    const r = describeError(new Error("auth failed with Bearer abcdefghijklmnop"));
    expect(r.message).not.toContain("abcdefghijklmnop");
  });
});

describe("reporting never breaks the operation it reports on", () => {
  it("stores an event and reports success", async () => {
    const client = okClient();
    await expect(
      recordErrorEvent(client, { source: "edge_function", component: "run-import-job", error: new Error("boom") }),
    ).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("resolves false — never throws — when the RPC returns an error", async () => {
    const client = { rpc: vi.fn(async () => ({ error: { message: "permission denied" } })) };
    await expect(
      recordErrorEvent(client, { source: "cron", component: "sweeper", error: "x" }),
    ).resolves.toBe(false);
  });

  it("resolves false — never throws — when storage is unreachable", async () => {
    const client = { rpc: vi.fn(async () => { throw new Error("network down"); }) };
    await expect(
      recordErrorEvent(client, { source: "queue", component: "worker", error: "x" }),
    ).resolves.toBe(false);
  });

  it("survives a client that throws synchronously", async () => {
    const client = { rpc: () => { throw new Error("client exploded"); } } as any;
    await expect(
      recordErrorEvent(client, { source: "queue", component: "worker", error: "x" }),
    ).resolves.toBe(false);
  });

  it("does not report errors raised while reporting", async () => {
    // A reporter that tries to report its own failure must not loop.
    const client: any = {
      rpc: vi.fn(async () => {
        await recordErrorEvent(client, { source: "queue", component: "inner", error: "nested" });
        return { error: null };
      }),
    };
    await recordErrorEvent(client, { source: "queue", component: "outer", error: "x" });
    expect(client.rpc).toHaveBeenCalledOnce(); // the nested call was dropped
  });

  it("passes severity, ids and the derived code through", async () => {
    const client = okClient();
    await recordErrorEvent(client, {
      source: "edge_function",
      component: "process-linkedin-queue",
      operation: "record_action_result",
      severity: "critical",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      jobId: "job-7",
      entityId: "action-9",
      error: new TypeError("nope"),
      metadata: { attempt: 2 },
    });
    const args = client.rpc.mock.calls[0][1] as any;
    expect(args.p_severity).toBe("critical");
    expect(args.p_job_id).toBe("job-7");
    expect(args.p_entity_id).toBe("action-9");
    expect(args.p_error_code).toBe("TypeError");
    expect(args.p_metadata).toEqual({ attempt: 2 });
  });

  it("sanitises metadata before it is sent, not after", async () => {
    const client = okClient();
    await recordErrorEvent(client, {
      source: "edge_function", component: "send-email", error: "failed",
      metadata: { smtp_password: "hunter2", mailbox_id: "mb-1" },
    });
    const args = client.rpc.mock.calls[0][1] as any;
    expect(args.p_metadata.smtp_password).toBe("[redacted]");
    expect(args.p_metadata.mailbox_id).toBe("mb-1");
  });
});
