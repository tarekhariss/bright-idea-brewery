
-- 1. LinkedIn action queue / history: enforce workspace_id NOT NULL and tighten policies
ALTER TABLE public.linkedin_action_queue ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.linkedin_action_history ALTER COLUMN workspace_id SET NOT NULL;

DROP POLICY IF EXISTS li_queue_select ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_insert ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_update ON public.linkedin_action_queue;
DROP POLICY IF EXISTS li_queue_delete ON public.linkedin_action_queue;

CREATE POLICY li_queue_select ON public.linkedin_action_queue
  FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_insert ON public.linkedin_action_queue
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_update ON public.linkedin_action_queue
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_queue_delete ON public.linkedin_action_queue
  FOR DELETE TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

DROP POLICY IF EXISTS li_hist_select ON public.linkedin_action_history;
DROP POLICY IF EXISTS li_hist_insert ON public.linkedin_action_history;

CREATE POLICY li_hist_select ON public.linkedin_action_history
  FOR SELECT TO authenticated
  USING (public.is_workspace_member_or_admin(auth.uid(), workspace_id));
CREATE POLICY li_hist_insert ON public.linkedin_action_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member_or_admin(auth.uid(), workspace_id));

-- 2. sending_daily_counts: scope by workspace through mailboxes
DROP POLICY IF EXISTS daily_counts_select ON public.sending_daily_counts;
DROP POLICY IF EXISTS daily_counts_insert ON public.sending_daily_counts;
DROP POLICY IF EXISTS daily_counts_update ON public.sending_daily_counts;
DROP POLICY IF EXISTS daily_counts_delete ON public.sending_daily_counts;

CREATE POLICY daily_counts_select ON public.sending_daily_counts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes mb
    WHERE mb.id = sending_daily_counts.mailbox_id
      AND public.is_workspace_member_or_admin(auth.uid(), mb.workspace_id)
  ));
CREATE POLICY daily_counts_insert ON public.sending_daily_counts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mailboxes mb
    WHERE mb.id = sending_daily_counts.mailbox_id
      AND public.is_workspace_member_or_admin(auth.uid(), mb.workspace_id)
  ));
CREATE POLICY daily_counts_update ON public.sending_daily_counts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes mb
    WHERE mb.id = sending_daily_counts.mailbox_id
      AND public.is_workspace_member_or_admin(auth.uid(), mb.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mailboxes mb
    WHERE mb.id = sending_daily_counts.mailbox_id
      AND public.is_workspace_member_or_admin(auth.uid(), mb.workspace_id)
  ));
CREATE POLICY daily_counts_delete ON public.sending_daily_counts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mailboxes mb
    WHERE mb.id = sending_daily_counts.mailbox_id
      AND public.workspace_role(auth.uid(), mb.workspace_id) IN ('admin'::public.app_role, 'manager'::public.app_role)
  ));

-- 3. workspace_members: remove empty-workspace self-claim branch.
-- Workspace bootstrapping is handled by SECURITY DEFINER public.create_workspace_for_user.
DROP POLICY IF EXISTS wm_insert ON public.workspace_members;
CREATE POLICY wm_insert ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.workspace_role(auth.uid(), workspace_id) IN ('admin'::public.app_role, 'manager'::public.app_role)
  );

-- 4. email_queue_health_v: run as invoker so RLS of underlying tables applies
ALTER VIEW public.email_queue_health_v SET (security_invoker = true);
