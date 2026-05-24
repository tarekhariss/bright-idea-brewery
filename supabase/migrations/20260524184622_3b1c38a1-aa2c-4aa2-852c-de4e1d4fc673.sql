
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS deliverability_score numeric,
  ADD COLUMN IF NOT EXISTS bounce_risk_score numeric,
  ADD COLUMN IF NOT EXISTS unknown_confidence numeric,
  ADD COLUMN IF NOT EXISTS unknown_subclass text,
  ADD COLUMN IF NOT EXISTS confidence_breakdown jsonb;

CREATE INDEX IF NOT EXISTS idx_verification_results_unknown_subclass
  ON public.verification_results (unknown_subclass)
  WHERE unknown_subclass IS NOT NULL;
