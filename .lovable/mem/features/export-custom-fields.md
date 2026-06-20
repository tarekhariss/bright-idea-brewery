---
name: Export Custom Fields
description: Export builder supports contact and company custom_fields, including joined company_custom_fields pseudo-column
type: feature
---
- `ALL_CONTACT_EXPORT_COLUMNS` includes `custom_fields` (contact JSONB) and the pseudo-column `company_custom_fields` (joined from `contacts.companies.custom_fields`).
- `ALL_COMPANY_EXPORT_COLUMNS` includes `custom_fields` and `normalized_domain`.
- Server-side (`run-export-job`) and client-side (`use-exports.ts`) both:
  - Strip `company_custom_fields` before building the PostgREST `select`.
  - Add `companies:companies!contacts_company_id_fkey(custom_fields)` to the select when the pseudo column is requested.
  - Serialize JSON objects with `JSON.stringify` so `custom_fields` round-trips intact in CSV.
- `ExportDialog` groups both columns under "Custom Fields (preserved from CSV)".
