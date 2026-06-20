
REVOKE EXECUTE ON FUNCTION public.merge_company_pair(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dedupe_companies_by_domain(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._company_field_score(public.companies) FROM PUBLIC, anon;
