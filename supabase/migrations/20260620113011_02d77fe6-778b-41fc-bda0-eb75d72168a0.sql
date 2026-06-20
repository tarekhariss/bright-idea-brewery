
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
  WITH ins AS (
    INSERT INTO public.email_status_history (
      workspace_id, normalized_email, canonical_status,
      is_role_based, is_disposable, is_free_email, is_catch_all,
      is_syntax_invalid, is_mx_missing, is_temporary_failure,
      provider, provider_status, source, verified_at,
      smtp_code, reason, mx_record, domain, raw_payload, created_by, dedupe_key
    )
    SELECT
      (r->>'workspace_id')::uuid,
      r->>'normalized_email',
      (r->>'canonical_status')::email_canonical_status,
      COALESCE((r->>'is_role_based')::bool, false),
      COALESCE((r->>'is_disposable')::bool, false),
      COALESCE((r->>'is_free_email')::bool, false),
      COALESCE((r->>'is_catch_all')::bool, false),
      COALESCE((r->>'is_syntax_invalid')::bool, false),
      COALESCE((r->>'is_mx_missing')::bool, false),
      COALESCE((r->>'is_temporary_failure')::bool, false),
      r->>'provider',
      r->>'provider_status',
      r->>'source',
      COALESCE((r->>'verified_at')::timestamptz, now()),
      r->>'smtp_code',
      r->>'reason',
      r->>'mx_record',
      r->>'domain',
      COALESCE(r->'raw_payload', '{}'::jsonb),
      NULLIF(r->>'created_by','')::uuid,
      r->>'dedupe_key'
    FROM jsonb_array_elements(rows) r
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  inserted_count := v_inserted;
  duplicate_count := v_total - v_inserted;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ingest_email_status_history_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_email_status_history_batch(jsonb) TO service_role;
