-- New quality modes (idempotent)
ALTER TYPE public.verification_quality_mode ADD VALUE IF NOT EXISTS 'fast';
ALTER TYPE public.verification_quality_mode ADD VALUE IF NOT EXISTS 'balanced';
ALTER TYPE public.verification_quality_mode ADD VALUE IF NOT EXISTS 'high_accuracy';

-- SMTP intelligence columns
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS smtp_banner       text,
  ADD COLUMN IF NOT EXISTS tls_supported     boolean,
  ADD COLUMN IF NOT EXISTS disconnect_reason text,
  ADD COLUMN IF NOT EXISTS probe_metadata    jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vr_tls_supported
  ON public.verification_results (tls_supported) WHERE tls_supported IS NOT NULL;