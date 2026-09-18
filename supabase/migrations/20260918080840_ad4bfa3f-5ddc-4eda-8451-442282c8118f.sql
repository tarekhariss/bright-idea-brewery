-- Replace permissive USING(true) read policies with role-gated reads on internal ops tables

DROP POLICY IF EXISTS "bi_read_auth" ON public.bounce_intelligence;
CREATE POLICY "bi_read_ops" ON public.bounce_intelligence FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "cl_select" ON public.confidence_learning;
CREATE POLICY "cl_read_ops" ON public.confidence_learning FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "di_read_auth" ON public.domain_intelligence;
CREATE POLICY "di_read_ops" ON public.domain_intelligence FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "dr_select" ON public.domain_reputation;
CREATE POLICY "dr_read_ops" ON public.domain_reputation FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "grey read auth" ON public.greylisting_events;
CREATE POLICY "grey_read_ops" ON public.greylisting_events FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "pb_read_auth" ON public.provider_behavior;
CREATE POLICY "pb_read_ops" ON public.provider_behavior FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "pbr_select" ON public.provider_behavior_rules;
CREATE POLICY "pbr_read_ops" ON public.provider_behavior_rules FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "provider_profiles read" ON public.provider_profiles;
CREATE POLICY "provider_profiles_read_ops" ON public.provider_profiles FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "sl_select" ON public.smtp_learning;
CREATE POLICY "sl_read_ops" ON public.smtp_learning FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "sp_read_auth" ON public.smtp_patterns;
CREATE POLICY "sp_read_ops" ON public.smtp_patterns FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "urs read" ON public.unknown_reason_stats;
CREATE POLICY "urs_read_ops" ON public.unknown_reason_stats FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "ve_select" ON public.verification_engines;
CREATE POLICY "ve_read_ops" ON public.verification_engines FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','operator']::public.app_role[]) OR public.is_platform_admin(auth.uid()));