---
name: Company Domain Identity
description: Domain-first company matching, normalized_domain column, merge function, dedupe by domain
type: feature
---
- `companies.normalized_domain` is a STORED GENERATED column that strips `http(s)://`, `www.`, paths, query, fragments, and falls back to `website` when `domain` is empty. Never write to it directly.
- Importer (`run-import-job`) resolves companies in this order: explicit domain → website → email host (skipping free-mail providers) → `company_linkedin_url` → normalized name.
- A single company is reused across imports/lists/campaigns when the normalized domain matches. `companyDomainCache` and `companyNameCache` prevent duplicate inserts within a batch.
- After every import job, `dedupe_companies_by_domain(workspace_id, actor)` is invoked to merge any companies that ended up sharing a normalized_domain.
- `merge_company_pair(survivor, loser, actor)` re-parents every public table with a `company_id` column, merges JSONB `custom_fields` (survivor wins), fills survivor's blank fields from the loser, and marks the loser via `companies.merged_into / merged_at / merged_by` — never a hard delete.
- The importer's preload skips merged companies (`is("merged_into", null)`).
