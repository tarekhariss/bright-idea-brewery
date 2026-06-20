# Project Memory

## Core
- **Identity:** TLBG Prospect Intelligence (Apollo/Instantly alternative for outbound sales).
- **Tech Stack:** Lovable Cloud managed DB, Supabase Edge Functions, pg_cron.
- **Visuals:** Professional SaaS aesthetic, modern sidebar layout, Poppins/Inter typography.
- **Workflow:** Batch DB modifications into migrations. Prioritize app-layer fixes over schema changes.
- **Performance:** Handle 1M+ records via server-side pagination, table virtualization, and debounced queries.
- **Access:** Private platform — no public signups. Only allowlisted emails can log in.
- **Company identity:** Strongest key is `companies.normalized_domain` (GENERATED). Importer resolves company via domain → website → email host → company LinkedIn → name. Never write to `normalized_domain` directly.

## Memories
- [Project Identity](mem://project/identity) — Platform positioning, purpose, and core value proposition
- [Product Navigation](mem://architecture/product-navigation) — Core hubs (Search, Engage, Deals, Tools, Records) and settings
- [Performance Optimization](mem://architecture/performance-optimization) — Standards for handling 1M+ records and database indexing
- [Data Management](mem://features/data-management) — Deduplication, CSV imports wizard, dynamic lists, filtering
- [Company Identity](mem://features/company-identity) — Domain-first company matching, merge_company_pair, dedupe_companies_by_domain
- [Export Custom Fields](mem://features/export-custom-fields) — Contact + company custom_fields in export builder, joined company_custom_fields pseudo-column
- [Permissions System](mem://auth/permissions-system) — Workspace RBAC (admin, manager, operator, viewer) and platform_admin
- [Outbound Engine](mem://features/outbound-engine) — Email sending foundation, pg_cron queues, SMTP credential secrets
- [Multichannel Campaigns](mem://features/multichannel-campaigns) — Sequence engine (Email, LinkedIn, Tasks) and workflow builder
- [AI Intelligence](mem://features/ai-intelligence) — Prospect research, pain point tracking, and custom outreach generation
- [Analytics & Attribution](mem://features/analytics-attribution) — Revenue attribution models (first/last/multi-touch)
- [Platform Admin](mem://features/platform-admin-oversight) — Global admin dashboard for platform-wide KPIs
- [Activity Timeline](mem://architecture/activity-timeline) — Centralized timeline using 'activities' table and log_activity()
- [Provider Connections](mem://features/provider-connections) — Onboarding flows for Google, Outlook, SMTP, LinkedIn
- [Workspace Isolation](mem://architecture/workspace-isolation) — Single-workspace architecture using workspace_id and RLS
- [Internal Authentication](mem://security/internal-authentication) — Background task execution using x-cron-secret header
- [Private Platform](mem://constraint/private-platform) — No public signups, email allowlist enforcement
