
-- Drop the partial index that depended on client-supplied dedupe_key
DROP INDEX IF EXISTS public.email_status_history_workspace_dedupe_uidx;

-- Trigger: compute dedupe_key server-side from a stable signature.
-- Uses the source CSV's verified_at value when present (preserved inside
-- raw_payload), else a "no-date" sentinel — so re-uploads dedupe even when
-- the row originally had no date and we fall back to now() for verified_at.
CREATE OR REPLACE FUNCTION public.fn_email_status_history_set_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_src text;
BEGIN
  IF NEW.dedupe_key IS NULL THEN
    v_src := COALESCE(
      NULLIF(NEW.raw_payload->>'verified_at',''),
      NULLIF(NEW.raw_payload->>'last_verification_date',''),
      NULLIF(NEW.raw_payload->>'checked_at',''),
      NULLIF(NEW.raw_payload->>'date',''),
      'no-date'
    );
    NEW.dedupe_key := NEW.normalized_email
      || '|' || COALESCE(NEW.provider, '')
      || '|' || COALESCE(NEW.provider_status, '')
      || '|' || v_src;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_status_history_set_dedupe_key ON public.email_status_history;
CREATE TRIGGER trg_email_status_history_set_dedupe_key
  BEFORE INSERT ON public.email_status_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_email_status_history_set_dedupe_key();

-- Backfill any rows still missing a key
UPDATE public.email_status_history h
SET dedupe_key = h.normalized_email
  || '|' || COALESCE(h.provider, '')
  || '|' || COALESCE(h.provider_status, '')
  || '|' || COALESCE(
       NULLIF(h.raw_payload->>'verified_at',''),
       NULLIF(h.raw_payload->>'last_verification_date',''),
       NULLIF(h.raw_payload->>'checked_at',''),
       NULLIF(h.raw_payload->>'date',''),
       'no-date'
     )
WHERE h.dedupe_key IS NULL;

-- For the QA workspace's pre-fix duplicates, collapse to one row per dedupe_key
-- so we can promote the index to a full unique constraint. Other workspaces
-- are untouched because they have no NULL-key rows.
DELETE FROM public.email_status_history h
USING (
  SELECT id,
    row_number() OVER (PARTITION BY workspace_id, dedupe_key ORDER BY verified_at DESC, created_at DESC) AS rn
  FROM public.email_status_history
) d
WHERE h.id = d.id AND d.rn > 1;

ALTER TABLE public.email_status_history
  ALTER COLUMN dedupe_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_status_history_workspace_dedupe_uidx
  ON public.email_status_history (workspace_id, dedupe_key);
