
# TLBG Intelligent CRM — Architecture & Implementation Plan

A standalone workspace at `/crm` that sits on top of the existing People, Companies, Deals, Engage, LinkedIn, Unibox, Tasks, Meetings, Verification, and Deliverability modules. The central object is the **Opportunity**: a contact/company moment-of-interest created when someone replies positively, books a meeting, requests info, submits an RFQ, or is manually pushed in from any surface. The CRM reuses every existing table — it does not duplicate contacts, companies, deals, threads, or activities.

---

## 1. Route Map

```text
/crm                          → Command Center (default)
/crm/inbox                    → Opportunity Inbox (triage)
/crm/pipeline                 → Kanban by stage
/crm/opportunities            → Table / Smart Views
/crm/opportunities/:id        → Opportunity record page
/crm/accounts                 → Companies in CRM context
/crm/accounts/:id             → Account record (reuses companies)
/crm/contacts                 → Contacts in CRM context
/crm/contacts/:id             → Contact record (reuses contacts)
/crm/deals                    → Deals (reuses existing module, CRM-styled)
/crm/deals/:id                → Deal record
/crm/tasks                    → Tasks (CRM scope)
/crm/meetings                 → Meetings (CRM scope)
/crm/conversations            → Unified email + LinkedIn thread view scoped to opportunities
/crm/notes                    → Notes index
/crm/activity                 → Activity timeline (global)
/crm/views                    → Saved Smart Views
/crm/reports                  → Reports & owner workload
/crm/settings                 → Stages, statuses, priorities, automation rules, AI prompts
```

New layout: `CrmLayout` with its own sidebar (mirrors Engage/LinkedIn shell pattern). Pulls `workspaceId` from `useAuth()` — never `useWorkspace`.

---

## 2. Existing Tables to Reuse (no duplication)

- `contacts`, `companies`, `tags`, `contact_tags`, `company_tags`
- `deals`, `deal_contacts`, `deal_stage_history`, `pipelines`, `pipeline_stages`
- `tasks`, `meetings`, `activities` (timeline), `log_activity()` RPC
- `inbox_threads`, `inbox_messages`, `linkedin_inbox_threads`, `linkedin_inbox_messages`
- `campaigns`, `campaign_contacts`, `linkedin_campaigns`, `linkedin_campaign_leads`
- `lists`, `list_contacts`, `saved_views`, `saved_searches`
- `verification_results`, `prospect_research_profiles`, `contact_insights`, `company_insights`
- `workspace_members`, `profiles`, `user_roles`, RLS infra

The CRM is a **view + orchestration layer** on top of these.

---

## 3. New Tables

All `workspace_id` scoped, RLS via existing `has_workspace_access(workspace_id)` pattern, `GRANT` to `authenticated` + `service_role`.

### 3.1 `opportunities`
Central CRM object. One row per (contact_or_company, source_context) moment-of-interest.

Domain fields:
- `workspace_id`, `owner_id` (profile)
- `contact_id` (nullable), `company_id` (nullable) — at least one required
- `deal_id` (nullable) — linked deal once qualified
- `pipeline_id`, `stage_id` (reuses `pipelines`/`pipeline_stages`)
- `status` enum: `interested`, `qualified`, `meeting_requested`, `meeting_booked`, `proposal_rfq`, `won`, `lost`, `not_fit`, `bad_timing`
- `priority` enum: `low`, `normal`, `high`, `urgent`
- `source_channel` enum: `email_reply`, `linkedin_reply`, `meeting_booked`, `manual_push`, `rfq`, `prospect_search`, `list`, `import`, `api`
- `source_campaign_id` (nullable, polymorphic via `source_campaign_type`: `email` | `linkedin`)
- `source_thread_id` (nullable), `source_thread_type` (`email` | `linkedin`)
- `source_message_id` (nullable)
- `intent_signal` text, `next_action_at`, `last_activity_at`, `stale_after`
- `icp_fit_score` int, `risk_flags` jsonb, `objections` jsonb
- `ai_summary` text, `ai_next_best_action` text, `ai_generated_at`
- Unique partial: `(workspace_id, contact_id, source_thread_id)` where `source_thread_id is not null` — prevents thread duplicates.

### 3.2 `opportunity_contacts`
Many-to-many (multi-stakeholder accounts).

### 3.3 `opportunity_notes`
`workspace_id`, `opportunity_id`, `author_id`, `body`, `pinned`.

### 3.4 `opportunity_status_history`
Append-only stage/status transitions for reporting.

### 3.5 `opportunity_smart_views`
Optional CRM-specific extension on top of `saved_views`; or just reuse `saved_views` with `entity_type='opportunity'`. **Preferred: reuse `saved_views`.**

### 3.6 `crm_settings` (singleton per workspace)
Default pipeline, stale thresholds, auto-push rules, AI prompt overrides.

No new tables for tasks/meetings/notes timelines — reuse `tasks`, `meetings`, `activities`. `activities` gets two new `entity_type` values: `opportunity`, and existing `deal`/`contact`/`company` continue to coexist.

---

## 4. RPCs & Edge Functions

### 4.1 RPC `push_to_crm(payload jsonb) → opportunity_id`
Single entry point used by every Push to CRM modal.

Input: `contact_id`, `company_id`, `source_channel`, `source_thread_id/type`, `source_campaign_id/type`, `source_message_id`, `status`, `priority`, `stage_id`, `owner_id`, `note`, `next_task` (optional `{title, due_at}`), `deal` (optional `{create:bool, value, name}`).

Logic:
1. Resolve `workspace_id` from `auth.uid()` membership.
2. Dedupe: find existing opportunity by
   - `(workspace_id, contact_id, source_thread_id)` if thread provided, else
   - `(workspace_id, contact_id, source_campaign_id)` if campaign provided, else
   - latest open `(workspace_id, contact_id)` within 30 days.
3. If found → UPDATE status/priority/owner/stage (only fields explicitly set), append note, append task, link deal.
4. If not found → INSERT opportunity, link contacts, optional deal create or link, insert note, insert task.
5. Insert `opportunity_status_history` row.
6. Call `log_activity('opportunity_pushed', ...)` linking source thread/message.
7. Return `{opportunity_id, created: bool}`.

All as a single SECURITY DEFINER function so RLS is enforced through explicit workspace check.

### 4.2 RPC `transition_opportunity(id, new_stage_id, new_status, reason)`
Used by Kanban drag, record page, bulk actions. Writes history + activity.

### 4.3 RPC `assign_opportunity(id, owner_id)`
With workload guard + activity log.

### 4.4 Edge function `crm-ai-summary`
On-demand or nightly. Inputs: opportunity_id. Reads thread messages, research profile, insights → calls Lovable AI Gateway → updates `ai_summary`, `ai_next_best_action`, `objections`, `icp_fit_score`. Idempotent, rate-limited per workspace.

### 4.5 Edge function `crm-auto-detect-positive-replies` (Phase 2)
pg_cron triggered. Scans recent `inbox_messages` + `linkedin_inbox_messages` flagged as inbound, classifies sentiment/intent via AI Gateway, calls `push_to_crm` for positives. Honors `crm_settings.auto_push_rules`.

### 4.6 Edge function `crm-stale-sweeper` (Phase 2)
pg_cron daily. Flags `risk_flags.stale=true` when `last_activity_at < now() - stale_after`.

---

## 5. Push to CRM Flow (data + UX)

### 5.1 Entry points (Phase 1)
- Engage Unibox thread → "Push to CRM" button
- Engage Campaign → lead row action
- LinkedIn Inbox thread → action
- LinkedIn Campaign lead row
- Prospect Search row + bulk
- People / Companies / Lists row + bulk

### 5.2 Modal shape (`PushToCrmDialog`)
Single shared component. Props: `{contactId?, companyId?, sourceThreadId?, sourceThreadType?, sourceCampaignId?, sourceCampaignType?, sourceMessageId?}`.

Fields:
- Status (default inferred from source: reply→Interested, booking→Meeting Booked, RFQ→Proposal/RFQ)
- Pipeline + Stage (defaults from `crm_settings`)
- Owner (defaults to current user; selectable from `workspace_members`)
- Priority
- Note (markdown)
- Next task (title + due date, optional)
- Link/create deal (optional, with value)
- Existing opportunity preview banner if dedupe matches → switches to "Update" mode

Submit → calls `push_to_crm` RPC → toast only on success (DB-gated) → navigate to `/crm/opportunities/:id` or stay (configurable).

### 5.3 Bulk push
For Prospect Search / Lists: batched RPC call with progress (reuses existing bulk job pattern).

---

## 6. Opportunity Lifecycle

```text
[Source event] → push_to_crm
   ↓
Opportunity (status=interested, stage=New)
   ↓ owner triage in /crm/inbox
Qualified → Meeting Requested → Meeting Booked
   ↓                              ↓
Proposal/RFQ ←── Deal created (links deals.opportunity_id via deal.metadata or new column)
   ↓
Won | Lost | Not Fit | Bad Timing  (terminal, archived from active views)
```

Every transition: `opportunity_status_history` + `activities` row + optional task auto-creation per stage rules in `crm_settings`.

---

## 7. Dedupe & Update Logic

Three-tier match (in order, first hit wins):
1. **Thread-level**: same `contact_id` + `source_thread_id` → always update.
2. **Campaign-level**: same `contact_id` + `source_campaign_id` AND status not terminal → update.
3. **Recent-open**: same `contact_id` with any open opportunity in last 30 days → update with new source appended to `activities` (do NOT overwrite source fields).

Company-only opportunities (no contact) dedupe on `(company_id, source_thread_id)`.

Manual override: modal shows "Force create new" checkbox for edge cases.

---

## 8. Activity Timeline Model

Reuse `activities` table + `log_activity()` RPC. Add `entity_type='opportunity'` everywhere CRM writes. Timeline aggregator (server-side view or client merge) for an opportunity page pulls:

- `activities` where `entity_type='opportunity' AND entity_id=$1`
- `activities` for linked contact_id / company_id / deal_id (filtered to CRM-relevant types)
- `inbox_messages` from `source_thread_id`
- `linkedin_inbox_messages` from linked LinkedIn thread
- `tasks`, `meetings`, `opportunity_notes`, `opportunity_status_history`

Merged + sorted by timestamp on the client. No new timeline table.

---

## 9. Permissions & RLS

- All new tables: `workspace_id` mandatory, RLS using existing `has_workspace_access(workspace_id)` security-definer pattern.
- Roles (reuse `user_roles` + workspace RBAC):
  - `admin` / `manager`: full CRM, reassign, change stages, edit settings.
  - `operator`: own + assigned opportunities; create, update, push.
  - `viewer`: read-only.
- `platform_admin`: read-only cross-workspace via existing admin views.
- `push_to_crm` RPC: SECURITY DEFINER, validates membership; never bypasses workspace scope.
- GRANT block: `authenticated` (CRUD), `service_role` (ALL). No `anon`.

---

## 10. UI Sections (Phase 1 vs Phase 2 mapping)

| Section | Phase | Notes |
|---|---|---|
| CRM shell + sidebar + layout | 1 | New `CrmLayout`, `CrmSidebar` |
| Command Center | 1 (basic), 2 (rich) | Phase 1: counts + lists; Phase 2: charts, workload, pipeline value |
| Opportunity Inbox | 1 | Triage queue, filters by source/status |
| Pipeline (Kanban) | 1 | Reuses `pipelines`/`pipeline_stages`; drag updates via `transition_opportunity` |
| Opportunities table + Smart Views | 1 (table), 2 (smart views) | Reuses `saved_views` |
| Accounts / Contacts | 1 | CRM-styled wrappers around existing pages with opportunity panel |
| Deals | 1 | Existing Deals module, opportunity linkage added |
| Tasks / Meetings | 1 | Scoped views over existing tables |
| Conversations | 1 | Unified email+LinkedIn for a given opportunity |
| Notes index | 1 | |
| Activity timeline (global) | 1 | |
| Reports | 2 | Owner workload, conversion funnel, source channel ROI |
| AI summaries / next best action | 2 | `crm-ai-summary` |
| Auto positive-reply detection | 2 | `crm-auto-detect-positive-replies` |
| Stale sweeper, automation rules | 2 | |
| CRM Settings UI | 1 (stages/statuses), 2 (automation, AI prompts) | |

---

## 11. Record Pages

**Opportunity page** (Phase 1 baseline):
- Header: contact + company, owner, status, stage, priority, source badge
- Tabs: Overview | Conversations | Tasks | Meetings | Notes | Timeline | AI (Phase 2)
- Side panel: linked deal, source campaign, verification status, list memberships, import source, ICP fit, risk flags

**Contact / Account pages** in CRM context: existing People/Company detail components with an added "Opportunities" panel and a Push to CRM CTA. No duplication.

**Deal page**: existing deal page + "Linked Opportunity" panel.

---

## 12. Flexible Views

Reuse `saved_views`. Built-in presets:
- My Open Opportunities
- Hot This Week (priority=high/urgent, last_activity_at < 7d)
- Meetings Booked (status=meeting_booked)
- Stale > 14 days
- By Source Campaign
- By Owner
- By Company

View modes: Table, Kanban (by stage or status), Calendar (by `next_action_at` / meeting date), Owner board, Priority queue. Implemented via a single `OpportunityViewRenderer` reading view config.

---

## 13. Phase 1 Scope (small, usable, ship-first)

1. New tables: `opportunities`, `opportunity_contacts`, `opportunity_notes`, `opportunity_status_history`, `crm_settings` + RLS + GRANTs.
2. RPCs: `push_to_crm`, `transition_opportunity`, `assign_opportunity`.
3. `CrmLayout` + `CrmSidebar` + routes.
4. Pages: Command Center (basic), Opportunity Inbox, Pipeline (Kanban), Opportunities table, Opportunity record page, CRM Settings (stages/statuses/defaults).
5. `PushToCrmDialog` wired into: Unibox, Engage campaign leads, LinkedIn Inbox, LinkedIn campaign leads, Prospect Search (single + bulk), People, Companies, Lists.
6. Tasks + Notes + Activity timeline on opportunity page (reusing existing infra).
7. Honest config banners where source data is missing.

## 14. Phase 2 Scope

1. `crm-ai-summary` edge function + AI panel (summary, next best action, objections, ICP fit).
2. `crm-auto-detect-positive-replies` + automation rules in settings.
3. `crm-stale-sweeper` + risk flags surfacing.
4. Reports page: funnel, owner workload, source-channel ROI, pipeline value.
5. Smart Views editor + advanced filters.
6. Calendar / Owner view modes.
7. Bulk transitions, bulk reassign with workload guard.
8. Client reporting export templates (reuses `export_templates`).

---

## 15. Risks & Mitigations

- **Dedup ambiguity** (same contact replying from new thread): three-tier match + manual "Force create new". Status history preserves audit trail.
- **Opportunity ↔ Deal coupling**: keep loose (opportunity can exist without deal; deal can exist without opportunity). Link via nullable FK.
- **Activity timeline performance** for hot accounts: paginate; add index on `(entity_type, entity_id, created_at desc)` if missing.
- **Auto-push false positives** (Phase 2): require confidence threshold + queue for review before creating opportunity.
- **Workspace scoping regressions**: use `useAuth().workspaceId` exclusively; add lint note. Never import `useWorkspace`.
- **RLS escalation via SECURITY DEFINER RPCs**: explicit membership check inside each RPC body.
- **Existing module breakage**: CRM is additive — no schema changes to `contacts`, `companies`, `deals`, `tasks`, `meetings`, `activities` beyond optional nullable `opportunity_id` on `deals`/`tasks`/`meetings` (additive, default null).

---

## 16. Engineering Guardrails

- `useAuth().workspaceId` everywhere — never `useWorkspace`.
- Every `toast.success` gated by real DB write / RPC success.
- All new public tables: GRANT + RLS in same migration.
- Reuse `log_activity()`; do not create a parallel timeline system.
- Reuse `saved_views`; do not create CRM-specific view tables.
- No fake stages, fake counts, or mock pushes.

---

## 17. Phase 1 — Shipped

Final answers applied:
- Default "CRM Opportunities" pipeline seeded per workspace via `ensure_crm_pipeline()`.
- Opportunity ↔ Deal: manual by default (`crm_settings.auto_create_deal_on_proposal=false`), explicit "Create / link deal" in the Push to CRM modal.
- Auto positive-reply detection: setting present but inert (opt-in, Phase 2).
- Closed statuses hidden by default with "Include closed" toggle on table view.
- `opportunity_contacts` table shipped; multi-stakeholder UI deferred to Phase 2.
- Owner default = smart fallback (contact owner → company owner → current user) in `push_to_crm`.

Built:
- Migration: opportunities + opportunity_contacts + opportunity_notes + opportunity_status_history + crm_settings (RLS + GRANTs).
- RPCs: `push_to_crm`, `transition_opportunity`, `assign_opportunity`, `ensure_crm_pipeline`.
- `CrmLayout` + sidebar at `/crm`; AppSidebar entry added.
- Pages: Command Center, Opportunity Inbox, Pipeline (drag Kanban), Opportunities table (with Include closed), Opportunity record (timeline + notes + status/stage controls), CRM Settings.
- Coming-soon placeholders for `/crm/accounts`, `/crm/contacts`, `/crm/deals`, `/crm/tasks`, `/crm/notes`.
- Shared `PushToCrmDialog` + `PushToCrmButton`; wired into Contact Detail and Company Detail header.
- Push-to-CRM entry points pending for Phase 1.5: Unibox thread header, Engage / LinkedIn campaign lead rows, LinkedIn inbox, Prospect Search row + bulk, People / Companies / Lists row + bulk.

