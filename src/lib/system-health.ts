/**
 * System health assessment.
 *
 * Pure functions over plain inputs — no database access, no I/O. The caller
 * supplies counts and timestamps; these decide what they mean. That keeps the
 * thresholds testable and lets the same logic run in an edge function, a cron
 * job or the admin UI.
 *
 * Thresholds live in `DEFAULT_HEALTH_THRESHOLDS` and every assessor accepts an
 * override, because the right number for "stalled" depends on how long your
 * imports actually take — and we have not measured that yet on real data.
 * Nothing here should be read as a tuned value.
 */

export type VerificationStatus = "HEALTHY" | "DEGRADED" | "OFFLINE" | "UNKNOWN";
export type JobStatus = "HEALTHY" | "STALLED" | "FAILING";
export type QueueStatus = "HEALTHY" | "BACKLOG" | "STALLED" | "FAILING";
export type CronStatus = "HEALTHY" | "MISSED" | "UNKNOWN";

export interface HealthVerdict<S extends string> {
  status: S;
  /** Why, in terms a person can act on. */
  reason: string;
  /** The values the verdict was based on, for display. */
  observed: Record<string, number | string | null>;
}

export interface HealthThresholds {
  verification: {
    /** Beyond this, a worker is considered gone rather than slow. */
    heartbeatOfflineMinutes: number;
    /** Beyond this but within the offline window, it is degraded. */
    heartbeatDegradedMinutes: number;
    /** Dead-lettered results above this suggest a systemic fault. */
    deadLetterDegraded: number;
  };
  imports: {
    stalledMinutes: number;
    /** Share of recent jobs in `failed` that counts as failing, 0–1. */
    failingRatio: number;
    /** Below this many recent jobs, the ratio is not meaningful. */
    minSampleSize: number;
  };
  exports: {
    stalledMinutes: number;
    failingRatio: number;
    minSampleSize: number;
  };
  linkedinQueue: {
    backlogDepth: number;
    stalledMinutes: number;
    failingRatio: number;
    minSampleSize: number;
  };
  emailQueue: {
    backlogDepth: number;
    stalledMinutes: number;
    failingRatio: number;
    minSampleSize: number;
  };
  cron: {
    /** Multiples of the job's own interval before a miss is declared. */
    missedIntervalMultiplier: number;
  };
}

/**
 * Starting points, not tuned values. Every one of these should be revisited
 * against real production numbers before anyone alerts on them.
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  verification: { heartbeatOfflineMinutes: 15, heartbeatDegradedMinutes: 5, deadLetterDegraded: 100 },
  imports: { stalledMinutes: 60, failingRatio: 0.5, minSampleSize: 4 },
  exports: { stalledMinutes: 30, failingRatio: 0.5, minSampleSize: 4 },
  linkedinQueue: { backlogDepth: 500, stalledMinutes: 60, failingRatio: 0.5, minSampleSize: 10 },
  emailQueue: { backlogDepth: 1000, stalledMinutes: 60, failingRatio: 0.5, minSampleSize: 10 },
  cron: { missedIntervalMultiplier: 3 },
};

const minutesSince = (iso: string | null | undefined, now: Date): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / 60000;
};

const round = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

// ─── Verification ────────────────────────────────────────────

export interface VerificationHealthInput {
  /** Most recent heartbeat across all engines/workers. */
  lastHeartbeatAt: string | null;
  /** Engines marked active in the registry. */
  activeEngines: number;
  /** Results currently dead-lettered. */
  deadLetterCount: number;
  /** Results produced in the last hour — proves work is flowing, not just pings. */
  resultsLastHour: number;
}

export function assessVerification(
  input: VerificationHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<VerificationStatus> {
  const t = thresholds.verification;
  const age = minutesSince(input.lastHeartbeatAt, now);
  const observed = {
    heartbeat_minutes_ago: round(age),
    active_engines: input.activeEngines,
    dead_letter: input.deadLetterCount,
    results_last_hour: input.resultsLastHour,
  };

  // No heartbeat ever recorded is not the same as a worker that stopped. One
  // means never configured; the other means it died. Saying so matters.
  if (age === null) {
    return {
      status: "UNKNOWN",
      reason: input.activeEngines === 0
        ? "No verification engine is registered and no heartbeat has ever been recorded."
        : "An engine is registered but has never sent a heartbeat.",
      observed,
    };
  }

  if (age > t.heartbeatOfflineMinutes) {
    return {
      status: "OFFLINE",
      reason: `No heartbeat for ${round(age)} minutes (offline after ${t.heartbeatOfflineMinutes}).`,
      observed,
    };
  }

  if (age > t.heartbeatDegradedMinutes) {
    return {
      status: "DEGRADED",
      reason: `Last heartbeat ${round(age)} minutes ago (expected within ${t.heartbeatDegradedMinutes}).`,
      observed,
    };
  }

  if (input.deadLetterCount >= t.deadLetterDegraded) {
    return {
      status: "DEGRADED",
      reason: `Heartbeating, but ${input.deadLetterCount} results are dead-lettered.`,
      observed,
    };
  }

  // Heartbeating but producing nothing is a real failure mode: the worker is up
  // and claiming, and no results are coming back.
  if (input.activeEngines > 0 && input.resultsLastHour === 0) {
    return {
      status: "DEGRADED",
      reason: "Heartbeating but no verification results in the last hour.",
      observed,
    };
  }

  return { status: "HEALTHY", reason: `Heartbeat ${round(age)} minutes ago.`, observed };
}

// ─── Jobs (imports, exports) ─────────────────────────────────

export interface JobHealthInput {
  /** Jobs sitting in a processing state. */
  processingCount: number;
  /** Age of the oldest processing job, ISO. */
  oldestProcessingAt: string | null;
  /** Terminal outcomes over the recent window. */
  recentFailed: number;
  recentCompleted: number;
}

function assessJob(
  input: JobHealthInput,
  t: { stalledMinutes: number; failingRatio: number; minSampleSize: number },
  label: string,
  now: Date,
): HealthVerdict<JobStatus> {
  const age = minutesSince(input.oldestProcessingAt, now);
  const total = input.recentFailed + input.recentCompleted;
  const ratio = total > 0 ? input.recentFailed / total : 0;
  const observed = {
    processing: input.processingCount,
    oldest_processing_minutes: round(age),
    recent_failed: input.recentFailed,
    recent_completed: input.recentCompleted,
    failure_ratio: total > 0 ? Math.round(ratio * 100) / 100 : null,
  };

  // Stalled first: a job stuck in processing is a live problem, whereas the
  // failure ratio describes jobs that already finished.
  if (age !== null && age > t.stalledMinutes) {
    return {
      status: "STALLED",
      reason: `A ${label} has been processing for ${round(age)} minutes (stalled after ${t.stalledMinutes}).`,
      observed,
    };
  }

  // A ratio over a tiny sample is noise, not a signal.
  if (total >= t.minSampleSize && ratio >= t.failingRatio) {
    return {
      status: "FAILING",
      reason: `${input.recentFailed} of ${total} recent ${label}s failed.`,
      observed,
    };
  }

  return {
    status: "HEALTHY",
    reason: input.processingCount > 0
      ? `${input.processingCount} ${label}(s) processing normally.`
      : `No ${label}s in progress.`,
    observed,
  };
}

export function assessImports(
  input: JobHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<JobStatus> {
  return assessJob(input, thresholds.imports, "import", now);
}

export function assessExports(
  input: JobHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<JobStatus> {
  return assessJob(input, thresholds.exports, "export", now);
}

// ─── Queues (LinkedIn, email) ────────────────────────────────

export interface QueueHealthInput {
  /** Items waiting to be processed. */
  pendingCount: number;
  /** Scheduled time of the oldest item that is due, ISO. */
  oldestDueAt: string | null;
  /** Items that exhausted their retries. */
  recentFailed: number;
  recentCompleted: number;
}

function assessQueue(
  input: QueueHealthInput,
  t: { backlogDepth: number; stalledMinutes: number; failingRatio: number; minSampleSize: number },
  label: string,
  now: Date,
): HealthVerdict<QueueStatus> {
  const age = minutesSince(input.oldestDueAt, now);
  const total = input.recentFailed + input.recentCompleted;
  const ratio = total > 0 ? input.recentFailed / total : 0;
  const observed = {
    pending: input.pendingCount,
    oldest_due_minutes_ago: round(age),
    recent_failed: input.recentFailed,
    recent_completed: input.recentCompleted,
    failure_ratio: total > 0 ? Math.round(ratio * 100) / 100 : null,
  };

  // Stalled beats backlog: a deep queue that is moving is different from one
  // that is not, and the difference is whether the oldest item is being served.
  if (age !== null && age > t.stalledMinutes) {
    return {
      status: "STALLED",
      reason: `Oldest due ${label} item has waited ${round(age)} minutes (stalled after ${t.stalledMinutes}).`,
      observed,
    };
  }

  if (total >= t.minSampleSize && ratio >= t.failingRatio) {
    return {
      status: "FAILING",
      reason: `${input.recentFailed} of ${total} recent ${label} items failed.`,
      observed,
    };
  }

  if (input.pendingCount >= t.backlogDepth) {
    return {
      status: "BACKLOG",
      reason: `${input.pendingCount} ${label} items pending (backlog above ${t.backlogDepth}), but moving.`,
      observed,
    };
  }

  return { status: "HEALTHY", reason: `${input.pendingCount} ${label} items pending.`, observed };
}

export function assessLinkedInQueue(
  input: QueueHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<QueueStatus> {
  return assessQueue(input, thresholds.linkedinQueue, "LinkedIn", now);
}

export function assessEmailQueue(
  input: QueueHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<QueueStatus> {
  return assessQueue(input, thresholds.emailQueue, "email", now);
}

// ─── Cron ────────────────────────────────────────────────────

export interface CronJobHealthInput {
  jobName: string;
  /** How often the job is scheduled to run. */
  intervalMinutes: number;
  /** Last run that succeeded, ISO. */
  lastSuccessAt: string | null;
  /** Status of the most recent run, whatever it was. */
  lastStatus: string | null;
}

export function assessCronJob(
  input: CronJobHealthInput,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  now: Date = new Date(),
): HealthVerdict<CronStatus> {
  const age = minutesSince(input.lastSuccessAt, now);
  const allowed = input.intervalMinutes * thresholds.cron.missedIntervalMultiplier;
  const observed = {
    job: input.jobName,
    interval_minutes: input.intervalMinutes,
    last_success_minutes_ago: round(age),
    allowed_minutes: allowed,
    last_status: input.lastStatus ?? null,
  };

  if (age === null) {
    return {
      status: "UNKNOWN",
      reason: `${input.jobName} has no recorded successful run.`,
      observed,
    };
  }

  if (age > allowed) {
    return {
      status: "MISSED",
      reason: `${input.jobName} last succeeded ${round(age)} minutes ago; it runs every ${input.intervalMinutes}.`,
      observed,
    };
  }

  return {
    status: "HEALTHY",
    reason: `${input.jobName} last succeeded ${round(age)} minutes ago.`,
    observed,
  };
}

// ─── Rollup ──────────────────────────────────────────────────

export type OverallHealth = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

/** Worst-wins, with UNKNOWN distinguished from bad news. */
export function rollUpHealth(statuses: string[]): OverallHealth {
  if (statuses.length === 0) return "UNKNOWN";
  if (statuses.some((s) => ["OFFLINE", "STALLED", "FAILING"].includes(s))) return "UNHEALTHY";
  if (statuses.some((s) => ["DEGRADED", "BACKLOG", "MISSED"].includes(s))) return "DEGRADED";
  if (statuses.every((s) => s === "UNKNOWN")) return "UNKNOWN";
  return "HEALTHY";
}
