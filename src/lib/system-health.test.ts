import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEALTH_THRESHOLDS,
  assessCronJob,
  assessEmailQueue,
  assessExports,
  assessImports,
  assessLinkedInQueue,
  assessVerification,
  rollUpHealth,
} from "./system-health";

const NOW = new Date("2026-09-20T12:00:00Z");
const agoMin = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString();

describe("verification", () => {
  const base = { activeEngines: 1, deadLetterCount: 0, resultsLastHour: 50 };

  it("is HEALTHY on a recent heartbeat with work flowing", () => {
    const v = assessVerification({ ...base, lastHeartbeatAt: agoMin(1) }, DEFAULT_HEALTH_THRESHOLDS, NOW);
    expect(v.status).toBe("HEALTHY");
  });

  it("is DEGRADED when the heartbeat is late but not gone", () => {
    expect(assessVerification({ ...base, lastHeartbeatAt: agoMin(8) }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("DEGRADED");
  });

  it("is OFFLINE past the offline window", () => {
    expect(assessVerification({ ...base, lastHeartbeatAt: agoMin(30) }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("OFFLINE");
  });

  it("distinguishes NEVER CONFIGURED from STOPPED", () => {
    // Both have no heartbeat; only one has ever been set up. Conflating them
    // sends someone hunting for a worker that was never deployed.
    const never = assessVerification(
      { lastHeartbeatAt: null, activeEngines: 0, deadLetterCount: 0, resultsLastHour: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    );
    expect(never.status).toBe("UNKNOWN");
    expect(never.reason).toMatch(/no verification engine is registered/i);

    const registered = assessVerification(
      { lastHeartbeatAt: null, activeEngines: 1, deadLetterCount: 0, resultsLastHour: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    );
    expect(registered.status).toBe("UNKNOWN");
    expect(registered.reason).toMatch(/never sent a heartbeat/i);
  });

  it("is DEGRADED when heartbeating but producing nothing", () => {
    // The nastiest failure mode: up, claiming work, returning none.
    const v = assessVerification(
      { ...base, lastHeartbeatAt: agoMin(1), resultsLastHour: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    );
    expect(v.status).toBe("DEGRADED");
    expect(v.reason).toMatch(/no verification results/i);
  });

  it("is DEGRADED on a large dead-letter pile", () => {
    expect(assessVerification(
      { ...base, lastHeartbeatAt: agoMin(1), deadLetterCount: 500 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("DEGRADED");
  });

  it("reports what it observed", () => {
    const v = assessVerification({ ...base, lastHeartbeatAt: agoMin(3) }, DEFAULT_HEALTH_THRESHOLDS, NOW);
    expect(v.observed.heartbeat_minutes_ago).toBe(3);
    expect(v.observed.active_engines).toBe(1);
  });
});

describe("imports and exports", () => {
  const healthy = { processingCount: 1, oldestProcessingAt: agoMin(5), recentFailed: 0, recentCompleted: 10 };

  it("is HEALTHY while processing normally", () => {
    expect(assessImports(healthy, DEFAULT_HEALTH_THRESHOLDS, NOW).status).toBe("HEALTHY");
  });

  it("is STALLED when a job sits in processing too long", () => {
    expect(assessImports({ ...healthy, oldestProcessingAt: agoMin(120) }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("STALLED");
  });

  it("is FAILING when most recent jobs failed", () => {
    expect(assessImports(
      { processingCount: 0, oldestProcessingAt: null, recentFailed: 8, recentCompleted: 2 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("FAILING");
  });

  it("ignores a bad ratio over too small a sample", () => {
    // 1 of 1 failing is not evidence of a failing system.
    expect(assessImports(
      { processingCount: 0, oldestProcessingAt: null, recentFailed: 1, recentCompleted: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("HEALTHY");
  });

  it("prefers STALLED over FAILING — a stuck job is the live problem", () => {
    expect(assessImports(
      { processingCount: 1, oldestProcessingAt: agoMin(200), recentFailed: 9, recentCompleted: 1 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("STALLED");
  });

  it("is HEALTHY with nothing in flight", () => {
    const v = assessExports(
      { processingCount: 0, oldestProcessingAt: null, recentFailed: 0, recentCompleted: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    );
    expect(v.status).toBe("HEALTHY");
    expect(v.reason).toMatch(/no exports in progress/i);
  });

  it("uses the tighter export stall window", () => {
    // 45 minutes is fine for an import, stalled for an export.
    const input = { processingCount: 1, oldestProcessingAt: agoMin(45), recentFailed: 0, recentCompleted: 5 };
    expect(assessImports(input, DEFAULT_HEALTH_THRESHOLDS, NOW).status).toBe("HEALTHY");
    expect(assessExports(input, DEFAULT_HEALTH_THRESHOLDS, NOW).status).toBe("STALLED");
  });
});

describe("queues", () => {
  const healthy = { pendingCount: 10, oldestDueAt: agoMin(2), recentFailed: 0, recentCompleted: 100 };

  it("is HEALTHY on a shallow, moving queue", () => {
    expect(assessLinkedInQueue(healthy, DEFAULT_HEALTH_THRESHOLDS, NOW).status).toBe("HEALTHY");
  });

  it("is BACKLOG when deep but still moving", () => {
    const v = assessLinkedInQueue({ ...healthy, pendingCount: 900 }, DEFAULT_HEALTH_THRESHOLDS, NOW);
    expect(v.status).toBe("BACKLOG");
    expect(v.reason).toMatch(/but moving/i);
  });

  it("is STALLED when the oldest due item is not being served", () => {
    // Depth alone is not the signal; a deep queue that moves is fine.
    expect(assessLinkedInQueue(
      { ...healthy, pendingCount: 900, oldestDueAt: agoMin(120) },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("STALLED");
  });

  it("is FAILING when items exhaust their retries", () => {
    expect(assessEmailQueue(
      { pendingCount: 5, oldestDueAt: agoMin(1), recentFailed: 30, recentCompleted: 10 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("FAILING");
  });

  it("is HEALTHY when empty", () => {
    expect(assessEmailQueue(
      { pendingCount: 0, oldestDueAt: null, recentFailed: 0, recentCompleted: 0 },
      DEFAULT_HEALTH_THRESHOLDS, NOW,
    ).status).toBe("HEALTHY");
  });
});

describe("cron", () => {
  const sweeper = { jobName: "verification-recheck-sweeper", intervalMinutes: 1, lastStatus: "succeeded" };

  it("is HEALTHY inside the allowed window", () => {
    expect(assessCronJob({ ...sweeper, lastSuccessAt: agoMin(2) }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("HEALTHY");
  });

  it("is MISSED past the multiplier", () => {
    const v = assessCronJob({ ...sweeper, lastSuccessAt: agoMin(10) }, DEFAULT_HEALTH_THRESHOLDS, NOW);
    expect(v.status).toBe("MISSED");
    expect(v.reason).toMatch(/runs every 1/);
  });

  it("scales the window with the job's own interval", () => {
    // 10 minutes late is a miss for a 1-minute job, fine for a 5-minute one.
    const rollup = { jobName: "verification-intelligence-rollup", intervalMinutes: 5, lastStatus: "succeeded" };
    expect(assessCronJob({ ...rollup, lastSuccessAt: agoMin(10) }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("HEALTHY");
  });

  it("is UNKNOWN when it has never succeeded", () => {
    expect(assessCronJob({ ...sweeper, lastSuccessAt: null }, DEFAULT_HEALTH_THRESHOLDS, NOW).status)
      .toBe("UNKNOWN");
  });
});

describe("thresholds are configuration, not constants", () => {
  it("honours an override", () => {
    const strict = {
      ...DEFAULT_HEALTH_THRESHOLDS,
      imports: { ...DEFAULT_HEALTH_THRESHOLDS.imports, stalledMinutes: 5 },
    };
    const input = { processingCount: 1, oldestProcessingAt: agoMin(10), recentFailed: 0, recentCompleted: 5 };
    expect(assessImports(input, DEFAULT_HEALTH_THRESHOLDS, NOW).status).toBe("HEALTHY");
    expect(assessImports(input, strict, NOW).status).toBe("STALLED");
  });
});

describe("rollUpHealth", () => {
  it("is worst-wins", () => {
    expect(rollUpHealth(["HEALTHY", "HEALTHY"])).toBe("HEALTHY");
    expect(rollUpHealth(["HEALTHY", "BACKLOG"])).toBe("DEGRADED");
    expect(rollUpHealth(["HEALTHY", "DEGRADED", "OFFLINE"])).toBe("UNHEALTHY");
    expect(rollUpHealth(["HEALTHY", "MISSED"])).toBe("DEGRADED");
  });

  it("does not let UNKNOWN masquerade as healthy", () => {
    expect(rollUpHealth(["UNKNOWN", "UNKNOWN"])).toBe("UNKNOWN");
    expect(rollUpHealth([])).toBe("UNKNOWN");
  });

  it("treats a known-good signal alongside an unknown as healthy", () => {
    expect(rollUpHealth(["HEALTHY", "UNKNOWN"])).toBe("HEALTHY");
  });
});
