
-- 1. Identity columns on contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS normalized_email TEXT
    GENERATED ALWAYS AS (
      NULLIF(lower(regexp_replace(coalesce(email, ''), '\s', '', 'g')), '')
    ) STORED,
  ADD COLUMN IF NOT EXISTS normalized_linkedin_url TEXT
    GENERATED ALWAYS AS (
      NULLIF(
        regexp_replace(
          regexp_replace(lower(coalesce(linkedin_url, '')), '^https?://(www\.)?', ''),
          '[/?#].*$', ''
        ),
        ''
      )
    ) STORED,
  ADD COLUMN IF NOT EXISTS merged_into_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_by UUID;

CREATE INDEX IF NOT EXISTS idx_contacts_normalized_email
  ON public.contacts (normalized_email)
  WHERE normalized_email IS NOT NULL AND merged_into_contact_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_linkedin
  ON public.contacts (normalized_linkedin_url)
  WHERE normalized_linkedin_url IS NOT NULL AND merged_into_contact_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_merged_into
  ON public.contacts (merged_into_contact_id)
  WHERE merged_into_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_external_contact_id_live
  ON public.contacts (external_contact_id)
  WHERE external_contact_id IS NOT NULL AND merged_into_contact_id IS NULL;

-- 2. Merge events
CREATE TABLE IF NOT EXISTS public.contact_merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  surviving_contact_id UUID NOT NULL,
  merged_contact_id UUID NOT NULL,
  reason TEXT,
  match_rule TEXT,
  field_actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_merge_events TO authenticated;
GRANT ALL ON public.contact_merge_events TO service_role;
ALTER TABLE public.contact_merge_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read merge events"
  ON public.contact_merge_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_contact_merge_events_workspace
  ON public.contact_merge_events (workspace_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_merge_events_survivor
  ON public.contact_merge_events (surviving_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_merge_events_merged
  ON public.contact_merge_events (merged_contact_id);

-- 3. Field history
CREATE TABLE IF NOT EXISTS public.contact_field_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  change_type TEXT NOT NULL,
  source TEXT,
  import_job_id UUID,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_field_history TO authenticated;
GRANT ALL ON public.contact_field_history TO service_role;
ALTER TABLE public.contact_field_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read field history"
  ON public.contact_field_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_contact_field_history_contact
  ON public.contact_field_history (contact_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_field_history_workspace
  ON public.contact_field_history (workspace_id, changed_at DESC);

-- 4. Conflicts queue
CREATE TABLE IF NOT EXISTS public.contact_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  existing_value JSONB,
  incoming_value JSONB,
  source TEXT,
  import_job_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_value JSONB,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contact_conflicts TO authenticated;
GRANT ALL ON public.contact_conflicts TO service_role;
ALTER TABLE public.contact_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read conflicts"
  ON public.contact_conflicts FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Managers resolve conflicts"
  ON public.contact_conflicts FOR UPDATE TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::app_role,'manager'::app_role]))
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['admin'::app_role,'manager'::app_role]));
CREATE INDEX IF NOT EXISTS idx_contact_conflicts_workspace_status
  ON public.contact_conflicts (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_conflicts_contact
  ON public.contact_conflicts (contact_id);

-- 5. Pause imports
INSERT INTO public.platform_settings (key, value)
VALUES ('imports_paused', jsonb_build_object(
  'paused', true,
  'reason', 'Enterprise identity resolution rollout',
  'paused_at', now()
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Canonical resolver
CREATE OR REPLACE FUNCTION public.resolve_canonical_contact(
  p_workspace_ids UUID[],
  p_email TEXT,
  p_linkedin_url TEXT,
  p_external_id TEXT
) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH norm AS (
    SELECT
      NULLIF(lower(regexp_replace(coalesce(p_email,''), '\s', '', 'g')), '') AS nemail,
      NULLIF(
        regexp_replace(
          regexp_replace(lower(coalesce(p_linkedin_url,'')), '^https?://(www\.)?', ''),
          '[/?#].*$', ''), '') AS nlinkedin,
      NULLIF(p_external_id, '') AS xid
  )
  SELECT c.id FROM public.contacts c, norm n
  WHERE c.merged_into_contact_id IS NULL
    AND (p_workspace_ids IS NULL OR c.workspace_id = ANY(p_workspace_ids))
    AND (
      (n.nemail IS NOT NULL AND c.normalized_email = n.nemail)
      OR (n.nlinkedin IS NOT NULL AND c.normalized_linkedin_url = n.nlinkedin)
      OR (n.xid IS NOT NULL AND c.external_contact_id = n.xid)
    )
  ORDER BY
    CASE WHEN n.nemail IS NOT NULL AND c.normalized_email = n.nemail THEN 0
         WHEN n.nlinkedin IS NOT NULL AND c.normalized_linkedin_url = n.nlinkedin THEN 1
         ELSE 2 END,
    c.created_at ASC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_canonical_contact(UUID[], TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_contact(UUID[], TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 7. Soft-merge
CREATE OR REPLACE FUNCTION public.soft_merge_contacts(
  p_survivor_id UUID, p_loser_id UUID, p_actor UUID, p_match_rule TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace UUID;
BEGIN
  IF p_survivor_id = p_loser_id THEN RETURN; END IF;
  SELECT workspace_id INTO v_workspace FROM public.contacts WHERE id = p_survivor_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Survivor not found %', p_survivor_id; END IF;

  UPDATE public.list_contacts SET contact_id = p_survivor_id WHERE contact_id = p_loser_id
    AND NOT EXISTS (SELECT 1 FROM public.list_contacts lc2
                    WHERE lc2.list_id = list_contacts.list_id AND lc2.contact_id = p_survivor_id);
  DELETE FROM public.list_contacts WHERE contact_id = p_loser_id;
  UPDATE public.activities SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.contact_tags SET contact_id = p_survivor_id WHERE contact_id = p_loser_id
    AND NOT EXISTS (SELECT 1 FROM public.contact_tags ct2
                    WHERE ct2.tag_id = contact_tags.tag_id AND ct2.contact_id = p_survivor_id);
  DELETE FROM public.contact_tags WHERE contact_id = p_loser_id;
  UPDATE public.campaign_contacts SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.campaign_enrollments SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.tasks SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.emails SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.calls SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.meetings SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.deal_contacts SET contact_id = p_survivor_id WHERE contact_id = p_loser_id
    AND NOT EXISTS (SELECT 1 FROM public.deal_contacts dc2
                    WHERE dc2.deal_id = deal_contacts.deal_id AND dc2.contact_id = p_survivor_id);
  DELETE FROM public.deal_contacts WHERE contact_id = p_loser_id;
  UPDATE public.opportunity_contacts SET contact_id = p_survivor_id WHERE contact_id = p_loser_id
    AND NOT EXISTS (SELECT 1 FROM public.opportunity_contacts oc2
                    WHERE oc2.opportunity_id = opportunity_contacts.opportunity_id AND oc2.contact_id = p_survivor_id);
  DELETE FROM public.opportunity_contacts WHERE contact_id = p_loser_id;
  UPDATE public.contact_activity_log SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;
  UPDATE public.contact_outreach_history SET contact_id = p_survivor_id WHERE contact_id = p_loser_id;

  UPDATE public.contacts s SET
    first_name       = COALESCE(NULLIF(s.first_name,''),       l.first_name),
    last_name        = COALESCE(NULLIF(s.last_name,''),        l.last_name),
    email            = COALESCE(NULLIF(s.email,''),            l.email),
    phone            = COALESCE(NULLIF(s.phone,''),            l.phone),
    title            = COALESCE(NULLIF(s.title,''),            l.title),
    linkedin_url     = COALESCE(NULLIF(s.linkedin_url,''),     l.linkedin_url),
    company_id       = COALESCE(s.company_id, l.company_id),
    company_name_raw = COALESCE(NULLIF(s.company_name_raw,''), l.company_name_raw),
    country          = COALESCE(NULLIF(s.country,''),          l.country),
    custom_fields    = COALESCE(l.custom_fields, '{}'::jsonb) || COALESCE(s.custom_fields, '{}'::jsonb),
    updated_at = now()
  FROM public.contacts l
  WHERE s.id = p_survivor_id AND l.id = p_loser_id;

  UPDATE public.contacts SET
    merged_into_contact_id = p_survivor_id,
    merged_at = now(),
    merged_by = p_actor,
    lifecycle_status = 'archived',
    updated_at = now()
  WHERE id = p_loser_id;

  INSERT INTO public.contact_merge_events (
    workspace_id, surviving_contact_id, merged_contact_id, match_rule, performed_by
  ) VALUES (v_workspace, p_survivor_id, p_loser_id, p_match_rule, p_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.soft_merge_contacts(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_merge_contacts(UUID, UUID, UUID, TEXT) TO service_role;
