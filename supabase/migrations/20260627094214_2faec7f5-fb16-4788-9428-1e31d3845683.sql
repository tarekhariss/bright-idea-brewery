
CREATE OR REPLACE FUNCTION public.dedupe_companies_global_chunk(
  p_limit int DEFAULT 50,
  p_actor uuid DEFAULT NULL
) RETURNS TABLE(groups_processed int, companies_merged int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_group  record;
  v_winner uuid;
  v_loser  uuid;
  v_groups int := 0;
  v_merged int := 0;
BEGIN
  FOR v_group IN
    SELECT normalized_domain
    FROM public.companies
    WHERE merged_into IS NULL
      AND normalized_domain IS NOT NULL AND normalized_domain <> ''
    GROUP BY normalized_domain
    HAVING count(*) > 1
    LIMIT p_limit
  LOOP
    SELECT id INTO v_winner
    FROM public.companies c
    WHERE c.normalized_domain = v_group.normalized_domain
      AND c.merged_into IS NULL
    ORDER BY
      (c.workspace_id = '461b9c23-16d9-43f7-b533-6ff13486cf81')::int DESC,  -- prefer main TLBG ws
      (
        (c.industry      IS NOT NULL AND c.industry      <> '')::int +
        (c.employee_count IS NOT NULL)::int +
        (c.annual_revenue IS NOT NULL)::int +
        (c.country       IS NOT NULL AND c.country       <> '')::int +
        (c.city          IS NOT NULL AND c.city          <> '')::int +
        (c.linkedin_url  IS NOT NULL AND c.linkedin_url  <> '')::int +
        (c.description   IS NOT NULL AND c.description   <> '')::int +
        (c.founded_year  IS NOT NULL)::int
      ) DESC,
      (SELECT count(*) FROM public.contacts ct
        WHERE ct.company_id = c.id AND ct.merged_into_contact_id IS NULL) DESC,
      c.created_at ASC
    LIMIT 1;

    IF v_winner IS NULL THEN CONTINUE; END IF;

    FOR v_loser IN
      SELECT id FROM public.companies
      WHERE normalized_domain = v_group.normalized_domain
        AND merged_into IS NULL
        AND id <> v_winner
    LOOP
      BEGIN
        PERFORM public.merge_company_pair(v_winner, v_loser, p_actor);
        v_merged := v_merged + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'company merge failed s=% l=% err=%', v_winner, v_loser, SQLERRM;
      END;
    END LOOP;

    v_groups := v_groups + 1;
  END LOOP;

  RETURN QUERY SELECT v_groups, v_merged;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dedupe_companies_global_chunk(int, uuid) TO service_role;
