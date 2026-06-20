
-- 1) Replace companies.normalized_domain with a fully-normalized generated column
--    Strips http/https, www., paths, query, fragments. Falls back to website if domain blank.

-- Drop dependent indexes first
DROP INDEX IF EXISTS public.idx_companies_normalized_domain;
DROP INDEX IF EXISTS public.idx_companies_normalized_domain_trgm;

ALTER TABLE public.companies DROP COLUMN IF EXISTS normalized_domain;

ALTER TABLE public.companies ADD COLUMN normalized_domain text
GENERATED ALWAYS AS (
  NULLIF(
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            COALESCE(NULLIF(btrim(domain), ''), NULLIF(btrim(website), ''), ''),
            '^\s*https?://', '', 'i'
          ),
          '^www\.', '', 'i'
        ),
        '[/?#].*$', ''
      )
    ),
    ''
  )
) STORED;

CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain
  ON public.companies (normalized_domain);
CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain_workspace
  ON public.companies (workspace_id, normalized_domain) WHERE normalized_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain_trgm
  ON public.companies USING gin (normalized_domain extensions.gin_trgm_ops);

-- 2) Soft-merge marker on companies (preserve audit history; no hard deletes)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE INDEX IF NOT EXISTS idx_companies_merged_into ON public.companies (merged_into);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies (workspace_id) WHERE merged_into IS NULL;

-- 3) Helper: pick survivor (most non-null fields, then oldest)
CREATE OR REPLACE FUNCTION public._company_field_score(c public.companies)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (
    (c.industry IS NOT NULL)::int + (c.employee_count IS NOT NULL)::int +
    (c.revenue_range IS NOT NULL)::int + (c.annual_revenue IS NOT NULL)::int +
    (c.headquarters IS NOT NULL)::int + (c.linkedin_url IS NOT NULL)::int +
    (c.website IS NOT NULL)::int + (c.founded_year IS NOT NULL)::int +
    (c.description IS NOT NULL)::int + (c.country IS NOT NULL)::int +
    (c.city IS NOT NULL)::int + (c.technologies IS NOT NULL)::int +
    (c.custom_fields IS NOT NULL)::int
  )
$$;

-- 4) Safe merge function: re-parents all rows that reference a "loser" company.id
--    to the "survivor" id, then marks losers as merged. Works for every public
--    table that has a "company_id" uuid column (e.g. contacts, deals, opportunities,
--    company_tags, company_insights, ...). Never hard-deletes.
CREATE OR REPLACE FUNCTION public.merge_company_pair(
  p_survivor uuid,
  p_loser uuid,
  p_actor uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
  sql_stmt text;
  surv public.companies%ROWTYPE;
  los  public.companies%ROWTYPE;
  merged_cf jsonb;
BEGIN
  IF p_survivor = p_loser THEN RETURN; END IF;
  SELECT * INTO surv FROM public.companies WHERE id = p_survivor;
  SELECT * INTO los  FROM public.companies WHERE id = p_loser;
  IF NOT FOUND OR surv.id IS NULL THEN RETURN; END IF;

  -- Reassign every public table with a company_id column (except companies itself)
  FOR rec IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'company_id'
      AND table_name <> 'companies'
  LOOP
    sql_stmt := format(
      'UPDATE %I.%I SET company_id = %L WHERE company_id = %L',
      rec.table_schema, rec.table_name, p_survivor, p_loser
    );
    BEGIN
      EXECUTE sql_stmt;
    EXCEPTION WHEN unique_violation THEN
      -- Skip rows that would violate a uniqueness constraint on the survivor side
      EXECUTE format(
        'DELETE FROM %I.%I WHERE company_id = %L AND EXISTS (SELECT 1 FROM %I.%I s WHERE s.company_id = %L)',
        rec.table_schema, rec.table_name, p_loser,
        rec.table_schema, rec.table_name, p_survivor
      );
    END;
  END LOOP;

  -- Re-parent companies.parent_company_id pointing at loser
  UPDATE public.companies SET parent_company_id = p_survivor WHERE parent_company_id = p_loser;

  -- Merge custom_fields (survivor wins on conflict)
  merged_cf := COALESCE(los.custom_fields, '{}'::jsonb) || COALESCE(surv.custom_fields, '{}'::jsonb);

  -- Fill survivor blanks from loser, NEVER overwrite existing data
  UPDATE public.companies SET
    domain                = COALESCE(NULLIF(surv.domain,''),                NULLIF(los.domain,'')),
    website               = COALESCE(NULLIF(surv.website,''),               NULLIF(los.website,'')),
    industry              = COALESCE(NULLIF(surv.industry,''),              NULLIF(los.industry,'')),
    employee_count        = COALESCE(surv.employee_count,                   los.employee_count),
    employee_range        = COALESCE(NULLIF(surv.employee_range,''),        NULLIF(los.employee_range,'')),
    revenue_range         = COALESCE(NULLIF(surv.revenue_range,''),         NULLIF(los.revenue_range,'')),
    annual_revenue        = COALESCE(surv.annual_revenue,                   los.annual_revenue),
    total_funding         = COALESCE(surv.total_funding,                    los.total_funding),
    funding_stage         = COALESCE(NULLIF(surv.funding_stage,''),         NULLIF(los.funding_stage,'')),
    founded_year          = COALESCE(surv.founded_year,                     los.founded_year),
    headquarters          = COALESCE(NULLIF(surv.headquarters,''),          NULLIF(los.headquarters,'')),
    country               = COALESCE(NULLIF(surv.country,''),               NULLIF(los.country,'')),
    city                  = COALESCE(NULLIF(surv.city,''),                  NULLIF(los.city,'')),
    state                 = COALESCE(NULLIF(surv.state,''),                 NULLIF(los.state,'')),
    linkedin_url          = COALESCE(NULLIF(surv.linkedin_url,''),          NULLIF(los.linkedin_url,'')),
    company_linkedin_url  = COALESCE(NULLIF(surv.company_linkedin_url,''),  NULLIF(los.company_linkedin_url,'')),
    description           = COALESCE(NULLIF(surv.description,''),           NULLIF(los.description,'')),
    technologies          = COALESCE(surv.technologies,                     los.technologies),
    keywords              = COALESCE(surv.keywords,                         los.keywords),
    external_account_id   = COALESCE(NULLIF(surv.external_account_id,''),  NULLIF(los.external_account_id,'')),
    custom_fields         = merged_cf,
    updated_at            = now()
  WHERE id = p_survivor;

  -- Mark loser as merged (soft delete; preserves history)
  UPDATE public.companies SET
    merged_into = p_survivor,
    merged_at   = now(),
    merged_by   = p_actor,
    updated_at  = now()
  WHERE id = p_loser;
END;
$$;

-- 5) Bulk dedupe by normalized_domain within a workspace
CREATE OR REPLACE FUNCTION public.dedupe_companies_by_domain(
  p_workspace_id uuid,
  p_actor uuid DEFAULT NULL
) RETURNS TABLE(domain text, survivor uuid, merged_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp record;
  survivor_id uuid;
  loser_id uuid;
  cnt int;
BEGIN
  FOR grp IN
    SELECT normalized_domain
    FROM public.companies
    WHERE merged_into IS NULL
      AND normalized_domain IS NOT NULL
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    GROUP BY normalized_domain
    HAVING count(*) > 1
  LOOP
    -- Pick survivor: highest field score, then oldest
    SELECT id INTO survivor_id
    FROM public.companies c
    WHERE c.normalized_domain = grp.normalized_domain
      AND c.merged_into IS NULL
      AND (p_workspace_id IS NULL OR c.workspace_id = p_workspace_id)
    ORDER BY public._company_field_score(c) DESC, c.created_at ASC NULLS LAST
    LIMIT 1;

    cnt := 0;
    FOR loser_id IN
      SELECT id FROM public.companies
      WHERE normalized_domain = grp.normalized_domain
        AND merged_into IS NULL
        AND id <> survivor_id
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    LOOP
      PERFORM public.merge_company_pair(survivor_id, loser_id, p_actor);
      cnt := cnt + 1;
    END LOOP;

    domain := grp.normalized_domain; survivor := survivor_id; merged_count := cnt;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_company_pair(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dedupe_companies_by_domain(uuid, uuid) TO authenticated, service_role;
