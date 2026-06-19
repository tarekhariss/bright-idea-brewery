-- Production hardening: normalized-email dedup with one-time safe merge + DB-level uniqueness

-- 1) Add normalized email + merged_into soft-archive fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_normalized text
    GENERATED ALWAYS AS (NULLIF(lower(btrim(email)), '')) STORED;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_email_normalized
  ON public.contacts (workspace_id, email_normalized)
  WHERE email_normalized IS NOT NULL AND merged_into IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_merged_into
  ON public.contacts (merged_into)
  WHERE merged_into IS NOT NULL;

-- 2) One-time safe merge of exact-normalized-email duplicates per workspace.
--    Survivor = the row with the most non-null identity fields (tie-break by recency).
--    Duplicates are soft-archived (merged_into set), never hard-deleted.
CREATE OR REPLACE FUNCTION public.merge_duplicate_contacts_by_email()
RETURNS TABLE(workspace_id uuid, email text, survivor_id uuid, merged_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grp RECORD;
  survivor uuid;
  dup_ids uuid[];
BEGIN
  FOR grp IN
    SELECT
      c.workspace_id AS ws,
      c.email_normalized AS em,
      array_agg(c.id ORDER BY
        (
          (CASE WHEN c.first_name IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.last_name IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.phone IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.linkedin_url IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.job_title IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.company_id IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.company_name_raw IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.department IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN c.country IS NOT NULL THEN 1 ELSE 0 END)
        ) DESC,
        COALESCE(c.updated_at, c.created_at) DESC NULLS LAST,
        c.created_at ASC
      ) AS ids
    FROM public.contacts c
    WHERE c.email_normalized IS NOT NULL AND c.merged_into IS NULL
    GROUP BY c.workspace_id, c.email_normalized
    HAVING COUNT(*) > 1
  LOOP
    survivor := grp.ids[1];
    dup_ids := grp.ids[2:array_length(grp.ids, 1)];

    -- Merge list memberships onto survivor (no in-list duplicates)
    INSERT INTO public.list_contacts (list_id, contact_id, added_by, added_at)
      SELECT lc.list_id, survivor, lc.added_by, lc.added_at
      FROM public.list_contacts lc
      WHERE lc.contact_id = ANY(dup_ids)
      ON CONFLICT (list_id, contact_id) DO NOTHING;
    DELETE FROM public.list_contacts WHERE contact_id = ANY(dup_ids);

    -- Merge tags onto survivor
    INSERT INTO public.contact_tags (contact_id, tag_id)
      SELECT survivor, ct.tag_id
      FROM public.contact_tags ct
      WHERE ct.contact_id = ANY(dup_ids)
      ON CONFLICT DO NOTHING;
    DELETE FROM public.contact_tags WHERE contact_id = ANY(dup_ids);

    -- Reassign deal/campaign/outreach/activity history to survivor (best-effort)
    BEGIN
      UPDATE public.deal_contacts SET contact_id = survivor
        WHERE contact_id = ANY(dup_ids)
          AND NOT EXISTS (
            SELECT 1 FROM public.deal_contacts dc2
            WHERE dc2.contact_id = survivor AND dc2.deal_id = deal_contacts.deal_id
          );
      DELETE FROM public.deal_contacts WHERE contact_id = ANY(dup_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      UPDATE public.campaign_contacts SET contact_id = survivor
        WHERE contact_id = ANY(dup_ids)
          AND NOT EXISTS (
            SELECT 1 FROM public.campaign_contacts cc2
            WHERE cc2.contact_id = survivor AND cc2.campaign_id = campaign_contacts.campaign_id
          );
      DELETE FROM public.campaign_contacts WHERE contact_id = ANY(dup_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      UPDATE public.contact_outreach_history SET contact_id = survivor WHERE contact_id = ANY(dup_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      UPDATE public.prospect_verification_history SET contact_id = survivor WHERE contact_id = ANY(dup_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      UPDATE public.activities SET contact_id = survivor WHERE contact_id = ANY(dup_ids);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Audit trail (only when workspace is set, since merge_history requires it)
    IF grp.ws IS NOT NULL THEN
      INSERT INTO public.merge_history (
        workspace_id, entity_type, surviving_record_id, merged_record_ids,
        field_selections, merge_summary, performed_by, created_at
      )
      VALUES (
        grp.ws, 'contact', survivor, dup_ids,
        '{}'::jsonb,
        jsonb_build_object('reason', 'auto_merge_exact_email_pre_unique_index', 'email', grp.em, 'count', array_length(dup_ids,1)),
        NULL, now()
      );
    END IF;

    -- Soft-archive duplicates (preserve for rollback / reference)
    UPDATE public.contacts
       SET merged_into = survivor, merged_at = now(), updated_at = now()
     WHERE id = ANY(dup_ids);

    workspace_id := grp.ws;
    email := grp.em;
    survivor_id := survivor;
    merged_count := array_length(dup_ids, 1);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Run the one-time merge now
SELECT * FROM public.merge_duplicate_contacts_by_email();

-- 3) Hard uniqueness going forward.
--    Uses COALESCE so NULL workspace also enforces per-instance uniqueness consistently.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_workspace_email_normalized
  ON public.contacts (
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    email_normalized
  )
  WHERE email_normalized IS NOT NULL AND merged_into IS NULL;

-- 4) Helper for the importer to follow merge redirects
CREATE OR REPLACE FUNCTION public.resolve_contact_id(_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT id, merged_into, 0 AS depth FROM public.contacts WHERE id = _id
    UNION ALL
    SELECT c.id, c.merged_into, chain.depth + 1
    FROM public.contacts c JOIN chain ON c.id = chain.merged_into
    WHERE chain.merged_into IS NOT NULL AND chain.depth < 10
  )
  SELECT id FROM chain ORDER BY depth DESC LIMIT 1;
$$;