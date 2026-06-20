ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'positive';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'meeting_intent';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'out_of_office';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'unsubscribe';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'authority_referral';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'budget_objection';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'bad_timing';
ALTER TYPE public.reply_category ADD VALUE IF NOT EXISTS 'competitor_mention';