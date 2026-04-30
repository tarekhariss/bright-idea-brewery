
DROP VIEW IF EXISTS public.linkedin_campaign_stats_v;

CREATE VIEW public.linkedin_campaign_stats_v
WITH (security_invoker = true)
AS
SELECT
  c.id AS campaign_id,
  c.workspace_id,
  COUNT(DISTINCT l.id) AS leads_total,
  COUNT(DISTINCT l.id) FILTER (WHERE l.connection_status = 'connected') AS connected,
  COUNT(DISTINCT h.id) FILTER (WHERE h.action_type::text = 'connect_request' AND h.status = 'completed') AS connects_sent,
  COUNT(DISTINCT h.id) FILTER (WHERE h.action_type::text IN ('message','follow_up_message','inmail') AND h.status = 'completed') AS messages_sent,
  COUNT(DISTINCT l.id) FILTER (WHERE l.reply_status IS NOT NULL AND l.reply_status NOT IN ('none','bounce','auto_reply')) AS replies,
  COUNT(DISTINCT l.id) FILTER (WHERE l.reply_status = 'meeting_booked') AS meetings,
  COUNT(DISTINCT q.id) FILTER (WHERE q.status IN ('pending','scheduled')) AS queued_actions
FROM public.linkedin_campaigns c
LEFT JOIN public.linkedin_campaign_leads l ON l.campaign_id = c.id
LEFT JOIN public.linkedin_action_history h ON h.campaign_id = c.id
LEFT JOIN public.linkedin_action_queue q ON q.campaign_id = c.id
GROUP BY c.id, c.workspace_id;

GRANT SELECT ON public.linkedin_campaign_stats_v TO authenticated;
