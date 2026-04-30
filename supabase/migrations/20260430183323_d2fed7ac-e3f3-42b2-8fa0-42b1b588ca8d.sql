-- Add Instantly-style options to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS prioritize_new_leads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_optimize_ab boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_winning_metric text NOT NULL DEFAULT 'reply_rate',
  ADD COLUMN IF NOT EXISTS provider_matching boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_esp_routing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_company_on_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insert_unsubscribe_header boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_risky_emails boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc text,
  ADD COLUMN IF NOT EXISTS limit_emails_per_company boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_emails_per_company_per_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS override_domain_limiter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_domain_limit integer;

-- Validate ab_winning_metric values via trigger (avoid CHECK with future flexibility)
CREATE OR REPLACE FUNCTION public.validate_campaign_options()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ab_winning_metric NOT IN ('reply_rate','open_rate','meeting_booked','positive_reply') THEN
    RAISE EXCEPTION 'Invalid ab_winning_metric: %', NEW.ab_winning_metric;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campaign_options ON public.campaigns;
CREATE TRIGGER trg_validate_campaign_options
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_options();

-- Campaign ↔ Tags link table (reuse existing tags table)
CREATE TABLE IF NOT EXISTS public.campaign_tags (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, tag_id)
);

ALTER TABLE public.campaign_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_tags_select" ON public.campaign_tags;
CREATE POLICY "campaign_tags_select" ON public.campaign_tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_tags.campaign_id AND public.is_workspace_member_or_admin(auth.uid(), c.workspace_id)));

DROP POLICY IF EXISTS "campaign_tags_insert" ON public.campaign_tags;
CREATE POLICY "campaign_tags_insert" ON public.campaign_tags
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_tags.campaign_id AND public.is_workspace_member(auth.uid(), c.workspace_id)));

DROP POLICY IF EXISTS "campaign_tags_delete" ON public.campaign_tags;
CREATE POLICY "campaign_tags_delete" ON public.campaign_tags
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_tags.campaign_id AND public.is_workspace_member(auth.uid(), c.workspace_id)));

CREATE INDEX IF NOT EXISTS idx_campaign_tags_campaign ON public.campaign_tags(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_tags_tag ON public.campaign_tags(tag_id);