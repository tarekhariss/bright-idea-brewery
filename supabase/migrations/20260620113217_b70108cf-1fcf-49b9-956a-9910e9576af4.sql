
CREATE OR REPLACE FUNCTION public.ingest_email_status_history_batch(rows jsonb)
RETURNS TABLE(inserted_count int, duplicate_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := jsonb_array_length(rows);
  v_inserted int;
BEGIN
  WITH src AS (
    SELECT
      (r->>'workspace_id')::uuid             AS workspace_id,
      r->>'normalized_email'                 AS normalized_email,
      (r->>'canonical_status')::email_canonical_status AS canonical_status,
      COALESCE((r->>'is_role_based')::bool, false)        AS is_role_based,
      COALESCE((r->>'is_disposable')::bool, false)        AS is_disposable,
      COALESCE((r->>'is_free_email')::bool, false)        AS is_free_email,
      COALESCE((r->>'is_catch_all')::bool, false)         AS is_catch_all,
      COALESCE((r->>'is_syntax_invalid')::bool, false)    AS is_syntax_invalid,
      COALESCE((r->>'is_mx_missing')::bool, false)        AS is_mx_missing,
      COALESCE((r->>'is_temporary_failure')::bool, false) AS is_temporary_failure,
      r->>'provider'                         AS provider,
      r->>'provider_status'                  AS provider_status,
      r->>'source'                           AS source,
      COALESCE((r->>'verified_at')::timestamptz, now()) AS verified_at,
      r->>'smtp_code'                        AS smtp_code,
      r->>'reason'                           AS reason,
      r->>'mx_record'                        AS mx_record,
      r->>'domain'                           AS domain,
      COALESCE(r->'raw_payload', '{}'::jsonb) AS raw_payload,
      NULLIF(r->>'created_by','')::uuid      AS created_by,
      r->>'dedupe_key'                       AS dedupe_key,
      (r->>'ord_idx')::int                   AS ord_idx
    FROM jsonb_array_elements(rows) WITH ORDINALITY AS t(r, ord_idx)
  ),
  deduped AS (
    SELECT DISTINCT ON (workspace_id, dedupe_key) *
    FROM src
    ORDER BY workspace_id, dedupe_key, ord_idx
  ),
  ins AS (
    INSERT INTO public.email_status_history (
      workspace_id, normalized_email, canonical_status,
      is_role_based, is_disposable, is_free_email, is_catch_all,
      is_syntax_invalid, is_mx_missing, is_temporary_failure,
      provider, provider_status, source, verified_at,
      smtp_code, reason, mx_record, domain, raw_payload, created_by, dedupe_key
    )
    SELECT
      workspace_id, normalized_email, canonical_status,
      is_role_based, is_disposable, is_free_email, is_catch_all,
      is_syntax_invalid, is_mx_missing, is_temporary_failure,
      provider, provider_status, source, verified_at,
      smtp_code, reason, mx_record, domain, raw_payload, created_by, dedupe_key
    FROM deduped
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  inserted_count := v_inserted;
  duplicate_count := v_total - v_inserted;
  RETURN NEXT;
END;
$$;
