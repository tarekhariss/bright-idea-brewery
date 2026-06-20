
ALTER TABLE public.email_status_history
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Backfill existing rows with a deterministic key derived from the source CSV's
-- verified_at when present; otherwise fall back to the row's recorded verified_at
-- (the value used before this fix). This preserves prior history but lets new
-- uploads of the same CSV dedupe going forward.
UPDATE public.email_status_history
SET dedupe_key = normalized_email
  || '|' || COALESCE(provider, '')
  || '|' || COALESCE(provider_status, '')
  || '|' || COALESCE(
       NULLIF(raw_payload->>'verified_at',''),
       NULLIF(raw_payload->>'last_verification_date',''),
       NULLIF(raw_payload->>'checked_at',''),
       to_char(verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     )
WHERE dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_status_history_workspace_dedupe_uidx
  ON public.email_status_history (workspace_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
