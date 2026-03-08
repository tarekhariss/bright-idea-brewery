-- ============================================================
-- TLBG Prospect Intelligence — Engage Module Tables
-- Paste into Supabase SQL Editor and Run
-- ============================================================

-- Enums
DO $$ BEGIN CREATE TYPE public.sequence_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.enrollment_status AS ENUM ('active','paused','completed','bounced','replied','opted_out','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.email_status AS ENUM ('draft','queued','processing','sent_mock','sent','failed','bounced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status AS ENUM ('pending','in_progress','completed','skipped','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.call_outcome AS ENUM ('no_answer','voicemail','connected','interested','not_interested','callback','wrong_number'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.queue_item_status AS ENUM ('pending','processing','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. SEQUENCES
CREATE TABLE IF NOT EXISTS public.sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    status sequence_status NOT NULL DEFAULT 'draft',
    owner_id uuid REFERENCES auth.users(id),
    schedule_config jsonb DEFAULT '{"send_days":["mon","tue","wed","thu","fri"],"send_start_hour":9,"send_end_hour":17,"timezone":"UTC"}'::jsonb,
    max_enrollments integer,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sequences" ON public.sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own sequences" ON public.sequences FOR ALL TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[]));

-- 2. SEQUENCE STEPS
CREATE TABLE IF NOT EXISTS public.sequence_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    step_type text NOT NULL CHECK (step_type IN ('email','call','task')),
    label text NOT NULL DEFAULT 'New step',
    delay_days integer NOT NULL DEFAULT 0,
    delay_hours integer NOT NULL DEFAULT 0,
    email_subject text,
    email_body text,
    task_instructions text,
    call_instructions text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(sequence_id, step_order)
);
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read steps" ON public.sequence_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Step owners can manage" ON public.sequence_steps FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sequences s WHERE s.id = sequence_id AND (s.owner_id = auth.uid() OR s.created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[])))
);

-- 3. SEQUENCE ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status enrollment_status NOT NULL DEFAULT 'active',
    current_step_order integer NOT NULL DEFAULT 1,
    next_step_at timestamptz,
    enrolled_by uuid REFERENCES auth.users(id),
    enrolled_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    paused_at timestamptz,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(sequence_id, contact_id)
);
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read enrollments" ON public.sequence_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage enrollments" ON public.sequence_enrollments FOR ALL TO authenticated USING (
    enrolled_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[])
);

-- 4. EMAILS
CREATE TABLE IF NOT EXISTS public.emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL DEFAULT '',
    body_html text,
    body_text text,
    from_address text,
    to_address text NOT NULL,
    cc text,
    bcc text,
    status email_status NOT NULL DEFAULT 'draft',
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
    sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
    enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES auth.users(id),
    scheduled_at timestamptz,
    sent_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    replied_at timestamptz,
    bounced_at timestamptz,
    error_message text,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read emails" ON public.emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own emails" ON public.emails FOR ALL TO authenticated USING (
    owner_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[])
);

-- 5. EMAIL EVENTS
CREATE TABLE IF NOT EXISTS public.email_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id uuid NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('queued','processing','sent','sent_mock','delivered','opened','clicked','replied','bounced','failed','unsubscribed')),
    details jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read email events" ON public.email_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert email events" ON public.email_events FOR INSERT TO authenticated WITH CHECK (true);

-- 6. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    task_type text NOT NULL DEFAULT 'general' CHECK (task_type IN ('general','call','email','follow_up','linkedin','custom')),
    status task_status NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    due_date timestamptz,
    completed_at timestamptz,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
    sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
    enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES auth.users(id),
    assigned_to uuid REFERENCES auth.users(id),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage assigned tasks" ON public.tasks FOR ALL TO authenticated USING (
    owner_id = auth.uid() OR assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[])
);

-- 7. CALLS
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
    outcome call_outcome,
    duration_seconds integer,
    notes text,
    phone_number text,
    scheduled_at timestamptz,
    started_at timestamptz,
    ended_at timestamptz,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
    sequence_step_id uuid REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
    enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES auth.users(id),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read calls" ON public.calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own calls" ON public.calls FOR ALL TO authenticated USING (
    owner_id = auth.uid() OR created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::app_role[])
);

-- 8. MESSAGE QUEUE
CREATE TABLE IF NOT EXISTS public.message_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type text NOT NULL CHECK (queue_type IN ('email','task','call','webhook')),
    status queue_item_status NOT NULL DEFAULT 'pending',
    priority integer NOT NULL DEFAULT 0,
    payload jsonb NOT NULL,
    reference_id uuid,
    reference_type text,
    sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
    enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
    scheduled_for timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    last_error text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read queue" ON public.message_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage queue" ON public.message_queue FOR ALL TO authenticated USING (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences (status);
CREATE INDEX IF NOT EXISTS idx_sequences_owner ON sequences (owner_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_seq ON sequence_steps (sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_seq ON sequence_enrollments (sequence_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON sequence_enrollments (contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments (status, next_step_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (status);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails (contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_sequence ON emails (sequence_id);
CREATE INDEX IF NOT EXISTS idx_emails_owner ON emails (owner_id);
CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events (email_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks (contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls (contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_owner ON calls (owner_id);
CREATE INDEX IF NOT EXISTS idx_queue_pending ON message_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_type ON message_queue (queue_type, status);
