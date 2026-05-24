
# Email Verification Infrastructure — Production Expansion

Goal: evolve the existing verification feature into a standalone subsystem inside the platform, with its own navigation, dashboards, and ops tooling, plus deeper schema for provider/domain/bounce intelligence and pipeline reliability. No architectural rewrite — strict extension.

## Scope split

This is a very large request. To ship it cleanly and avoid a 5000-line single dump, I'll deliver it in **3 phases**, each independently usable. This plan covers all 3. I'll start Phase 1 immediately on approval; Phases 2 and 3 follow in subsequent turns without further confirmation unless you want to change direction.

---

## Phase 1 — Schema & infrastructure extension (one migration)

Extend existing tables (no breaking changes), add new ones, add helpers.

### Existing tables — additive columns
- `verification_results`: `primary_engine`, `fallback_engine`, `engine_latency_ms`, `engine_consensus_score`, `engine_conflict` (bool), `ai_risk_score`, `ai_confidence`, `behavioral_signals jsonb`, `historical_outcome_score`, `engagement_correlation`, `priority smallint default 5`, `attempt_count int default 0`, `last_attempt_at`, `next_retry_at`, `dead_letter bool default false`.
- `verification_jobs`: `priority smallint`, `dead_letter_count int`, `avg_latency_ms`, `cache_hit_count`, `started_at` (if missing).
- `domain_reputation`: `total_verified`, `total_invalid`, `total_bounces`, `total_catch_all`, `smtp_accept_rate`, `bounce_rate`, `provider_type text`, `mx_host text`, `mx_region text`, `suspicious_pattern_score numeric`, `last_seen_active timestamptz`, `temporary_failure_rate numeric`, `risk_score numeric`, `risk_tier text` (low|medium|high|critical), `catch_all_confidence numeric`, `catch_all_delivery_success_rate numeric`.
- `bounce_feedback`: `bounce_category` enum (`hard_bounce|soft_bounce|mailbox_full|spam_block|greylisted|invalid_recipient|policy_block|temporary_failure`), `smtp_code int`, `provider text`, `escalated bool`.

### New tables (RLS workspace-scoped)
- `verification_engines` — registry: `name`, `kind` (primary|fallback|consensus), `version`, `is_active`, `priority`, `config jsonb`, `last_heartbeat_at`, `status`, `avg_latency_ms`, `success_rate`.
- `verification_engine_runs` — per-result per-engine: `result_id`, `engine_id`, `status`, `confidence`, `latency_ms`, `response jsonb`, `error`.
- `provider_behavior_rules` — `provider_type`, `rule_key`, `rule_value jsonb`, `notes`, active flag.
- `verification_workers` — heartbeat registry: `worker_id`, `last_heartbeat_at`, `status`, `claimed_batch_size`, `version`, `host`.
- `verification_audit_log` — `actor_id`, `workspace_id`, `action`, `target`, `metadata`, `ip`.
- `verification_quotas` — per workspace: `daily_limit`, `monthly_limit`, `used_today`, `used_month`, `reset_at`, `abuse_flagged bool`.
- `verification_dead_letter` — failed-permanently rows: copy of result + reason + escalated_at.

### Helpers / RPCs / cron
- `compute_domain_risk(_domain text)` — recalculates `risk_score`, `risk_tier`, `bounce_rate`, `smtp_accept_rate`, `temporary_failure_rate`.
- `record_bounce(_workspace, _email, _category, _smtp_code, _provider)` — writes `bounce_feedback`, escalates repeated soft bounces to `suppression_list`, updates `domain_reputation`.
- `compute_list_health(_job_id)` — returns `{ list_quality_score, bounce_probability, inbox_risk, provider_trust_risk, warnings[] }`.
- `check_campaign_list_safety(_campaign_id)` — used by campaign launch; can block based on workspace setting.
- `recover_stuck_verification_jobs()` — pg_cron every 5 min: re-queue rows stuck in `processing` > 15 min, move > N attempts to dead-letter.
- `consume_verification_quota(_workspace, _count)` — atomic increment with limit check.
- `worker_heartbeat(_worker_id, _meta)` — upsert.

### Edge function
- Extend `verification-worker-api` with `/heartbeat`, `/dead-letter`, `/quota`, and accept new fields on `/submit` (engine name, latency, consensus).

---

## Phase 2 — Standalone Verification module shell + first 5 pages

Move verification out of `/tools/verification` into its own top-level module `/verification` with its own sub-sidebar (matching pattern used by Cold Email/Database modules).

### New layout
- `VerificationLayout.tsx` — sub-sidebar + header with live worker status pill, queue depth pill, quota pill.
- Sub-nav groups:
  1. **Overview** — Dashboard, List Quality
  2. **Operations** — Jobs, Queue Monitor, Workers, Retry Pipeline, Dead Letter
  3. **Intelligence** — Domains, Providers, Bounces, Catch-All
  4. **Lists** — Imports, History, Suppression
  5. **Settings** — Rules engine, Engines, API, Quotas, Audit log
  6. **AI** — placeholder "Coming soon" with architecture preview

### Phase 2 pages (shipped first)
- `OverviewDashboard` — KPIs (throughput, cache hit, invalid %, bounce trend, avg latency), live charts (last 24h), recent jobs.
- `OperationsJobs` — replaces current Jobs list, adds priority, attempts, latency columns, filters.
- `QueueMonitor` — live queue by status with auto-refresh.
- `WorkersPage` — heartbeats, status, throughput per worker, last error.
- `SuppressionCenter` — existing list, upgraded with filters, source breakdown, growth chart, bulk add/remove, CSV import/export.

### Remaining pages in Phase 3
- DomainIntelligence, ProviderIntelligence, BounceIntelligence, CatchAllIntelligence, RetryPipeline, DeadLetter, ImportsCenter, HistoryExplorer, ListQualityAnalytics, RulesEngine, EnginesRegistry, APIManagement, AuditLog, QuotasPage, AdminAnalytics, AIPlaceholder.

### Shared components
- `VerificationKpiCard`, `LiveStatusPill`, `RiskTierBadge`, `ProviderBadge`, `BounceCategoryBadge`, `EngineHealthPill`, `QueueDepthSparkline`, `RealtimePulse`.
- Chart wrappers using existing Recharts setup, dark glass surfaces matching the rest of the platform.

### Routing
- `/verification` → OverviewDashboard
- `/verification/*` for all subpages
- Keep old `/tools/verification` as redirect to `/verification` for compatibility.
- Add top-level "Verification" entry in main sidebar under Tools group (or its own group).

---

## Phase 3 — Intelligence pages + admin + safety wiring

- Domain / Provider / Bounce / Catch-All intelligence centers with heatmaps, leaderboards, risk maps (Recharts + table).
- Retry Pipeline + Dead Letter pages with requeue actions.
- History Explorer (per-email timeline) and List Quality Analytics (per-job quality breakdown).
- Settings: Rules engine UI (CRUD over `provider_behavior_rules`), Engines registry UI, API management (worker secret rotation guidance + endpoint reference), Quotas, Audit Log.
- Admin analytics dashboard at `/admin/verification` for platform_admin.
- Wire `check_campaign_list_safety` into campaign launch (email + LinkedIn) with warning modals and configurable block thresholds.

---

## Technical notes
- Stack: existing React + Tailwind + shadcn + Recharts + TanStack Query + Supabase JS. Animations via existing `framer-motion`.
- All new tables: RLS enabled, workspace-scoped via `is_workspace_member_or_admin`, with `tg_set_workspace_*` triggers where the workspace can be inferred.
- All new SECURITY DEFINER functions follow existing pattern (search_path set, stable where applicable).
- Cron jobs registered via `cron.schedule` using `supabase--insert` (not migration) since they contain project-specific URLs.
- No external API keys required. AI section is placeholder only.
- No fake data anywhere — empty states everywhere a feature isn't wired yet (e.g., "No bounces recorded yet — connect a feedback source").

## What I will NOT do
- Will not change auth, will not touch existing email/LinkedIn engines except for the campaign-safety hook.
- Will not implement the actual SMTP verifier (still external).
- Will not build the AI scoring engine — schema only.
- Will not break existing `/tools/verification` URLs (redirected).

## After approval
I start Phase 1 (schema migration) immediately, then Phase 2 (module shell + 5 pages) in the same response if size allows, else next turn. Phase 3 in the turn after.
