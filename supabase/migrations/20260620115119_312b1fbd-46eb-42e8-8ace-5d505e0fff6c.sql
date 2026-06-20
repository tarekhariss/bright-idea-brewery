
-- ============================================================
-- MVP Intelligence Sprint — Half B backend
-- All RPCs gated by workspaces.intelligence_v2 = true.
-- ============================================================

-- 1. Rule-based reply / objection classifier --------------------------------
CREATE OR REPLACE FUNCTION public.classify_reply_text(p_text text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text := lower(coalesce(p_text,''));
  cat text := 'unknown';
  conf numeric := 0.0;
  matched text[] := '{}';
  add_match text;
BEGIN
  IF t = '' THEN
    RETURN jsonb_build_object('category','unknown','confidence',0,'matched_terms','[]'::jsonb);
  END IF;

  -- order matters: most specific / strongest first
  IF t ~ '(out of (the )?office|on (vacation|holiday|leave|pto|annual leave)|i am away|will be (away|out))' THEN
    cat := 'out_of_office'; conf := 0.9; matched := array_append(matched,'out_of_office_phrase');
  ELSIF t ~ '(unsubscribe|please remove me|take me off|stop emailing me|do not contact|opt[- ]?out)' THEN
    cat := 'unsubscribe'; conf := 0.95; matched := array_append(matched,'unsubscribe_phrase');
  ELSIF t ~ '(not the right person|wrong person|please contact|you should (talk|reach out|speak) to|forwarding to|loop(ed|ing) in|cc[- ]?ing|introducing you|connecting you|reach out to (our|my)|speak to (our|my))' THEN
    cat := 'authority_referral'; conf := 0.85; matched := array_append(matched,'referral_phrase');
  ELSIF t ~ '(no budget|budget (is )?(tight|frozen|cut)|cannot afford|too expensive|out of budget|price is too high|cost prohibitive)' THEN
    cat := 'budget_objection'; conf := 0.85; matched := array_append(matched,'budget_phrase');
  ELSIF t ~ '(not (a )?(good )?(time|fit) (right )?now|circle back (in|next)|reach (back )?out (in|next) (q[1-4]|quarter|month|year|few months|6 months)|revisit (this )?(next|in)|too early|premature|let''?s (talk|revisit) (in|next))' THEN
    cat := 'bad_timing'; conf := 0.8; matched := array_append(matched,'timing_phrase');
  ELSIF t ~ '(already (use|using|have|work with|partnered)|currently (use|using|work with)|happy with (our )?(current )?(provider|vendor|solution)|we use [a-z0-9 ]{2,30} for this)' THEN
    cat := 'competitor_mention'; conf := 0.8; matched := array_append(matched,'competitor_phrase');
  ELSIF t ~ '(not interested|no thanks|no thank you|pass on this|we''?ll pass|not for us|do not need)' THEN
    cat := 'not_interested'; conf := 0.9; matched := array_append(matched,'not_interested_phrase');
  ELSIF t ~ '(book (a )?(call|meeting|demo|time)|schedule (a )?(call|meeting|demo)|put (some )?time on (my|the) calendar|set up (a )?(call|meeting|demo)|happy to chat|let''?s (jump on|hop on|set up) (a )?call|calendly|when (are you|works for you))' THEN
    cat := 'meeting_intent'; conf := 0.9; matched := array_append(matched,'meeting_phrase');
  ELSIF t ~ '(sounds (great|good|interesting)|interested|tell me more|would love to|love to learn|keen to (learn|hear|chat)|happy to (learn|hear|explore)|yes,? (please|interested))' THEN
    cat := 'positive'; conf := 0.7; matched := array_append(matched,'positive_phrase');
  END IF;

  RETURN jsonb_build_object('category',cat,'confidence',conf,'matched_terms',to_jsonb(matched));
END;
$$;
GRANT EXECUTE ON FUNCTION public.classify_reply_text(text) TO authenticated, service_role;

-- Apply classification to inbox threads that have no high-confidence category
CREATE OR REPLACE FUNCTION public.classify_unclassified_inbox_threads(p_workspace_id uuid, p_limit int DEFAULT 200)
RETURNS TABLE(classified int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_count int := 0;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag,false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH targets AS (
    SELECT t.id AS thread_id,
      (SELECT m.body_text FROM public.inbox_messages m
        WHERE m.thread_id = t.id AND m.direction = 'inbound'
        ORDER BY m.timestamp DESC NULLS LAST LIMIT 1) AS body
    FROM public.inbox_threads t
    WHERE t.workspace_id = p_workspace_id
      AND (t.classification_source IS NULL OR t.classification_source = 'rule_based')
      AND (t.classification_confidence IS NULL OR t.classification_confidence < 0.7)
    ORDER BY t.last_message_at DESC NULLS LAST
    LIMIT p_limit
  ),
  scored AS (
    SELECT thread_id, body, public.classify_reply_text(body) AS r FROM targets
  ),
  upd AS (
    UPDATE public.inbox_threads t
    SET category = (s.r->>'category'),
        classification_source = 'rule_based',
        classification_confidence = (s.r->>'confidence')::numeric,
        classified_at = now()
    FROM scored s
    WHERE t.id = s.thread_id
      AND (s.r->>'category') <> 'unknown'
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upd;

  classified := v_count;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.classify_unclassified_inbox_threads(uuid,int) TO authenticated, service_role;


-- 2. Account heat score -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_account_heat_score(p_workspace_id uuid, p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_total int; v_valid int; v_senior int; v_has_opp boolean;
  v_positive_reply boolean; v_recent_activity boolean; v_bounce_risk int;
  v_score int := 0; v_inputs jsonb;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag,false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE email_canonical_status IN ('valid','valid_catch_all')),
    count(*) FILTER (WHERE COALESCE(lower(job_title),'') ~ '(chief|c[a-z]o|ceo|cto|cfo|coo|vp|vice president|head of|director|founder|owner|president|partner)'),
    count(*) FILTER (WHERE email_canonical_status IN ('bounced','suppressed','invalid'))
  INTO v_total, v_valid, v_senior, v_bounce_risk
  FROM public.contacts
  WHERE workspace_id = p_workspace_id AND company_id = p_company_id;

  v_has_opp := EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE workspace_id = p_workspace_id AND company_id = p_company_id
      AND COALESCE(status::text,'open') NOT IN ('lost','closed_lost','disqualified')
  );

  v_positive_reply := EXISTS (
    SELECT 1 FROM public.inbox_threads t
    JOIN public.contacts c ON c.id = t.contact_id
    WHERE t.workspace_id = p_workspace_id AND c.company_id = p_company_id
      AND t.category IN ('positive','meeting_intent')
      AND COALESCE(t.classification_confidence,0) >= 0.7
  );

  v_recent_activity := EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.workspace_id = p_workspace_id AND a.company_id = p_company_id
      AND a.created_at > now() - interval '14 days'
  );

  IF v_total = 0 THEN
    RETURN jsonb_build_object('insufficient_data', true);
  END IF;

  -- transparent weights, max 100
  v_score := LEAST(100,
      (CASE WHEN v_valid >= 3 THEN 25 WHEN v_valid >= 1 THEN 15 ELSE 0 END)
    + (CASE WHEN v_total >= 5 THEN 10 WHEN v_total >= 2 THEN 5 ELSE 0 END)
    + (CASE WHEN v_senior >= 1 THEN 15 ELSE 0 END)
    + (CASE WHEN v_has_opp THEN 20 ELSE 0 END)
    + (CASE WHEN v_positive_reply THEN 25 ELSE 0 END)
    + (CASE WHEN v_recent_activity THEN 10 ELSE 0 END)
    - (CASE WHEN v_bounce_risk >= 2 THEN 15 WHEN v_bounce_risk = 1 THEN 5 ELSE 0 END)
  );
  v_score := GREATEST(0, v_score);

  v_inputs := jsonb_build_object(
    'total_contacts', v_total,
    'valid_emails', v_valid,
    'valid_email_ratio', round((v_valid::numeric / GREATEST(v_total,1))::numeric, 3),
    'seniority_count', v_senior,
    'has_open_opportunity', v_has_opp,
    'has_positive_reply', v_positive_reply,
    'recent_activity_14d', v_recent_activity,
    'bounce_or_suppression_count', v_bounce_risk
  );

  RETURN jsonb_build_object(
    'score', v_score,
    'tier', CASE WHEN v_score >= 75 THEN 'hot' WHEN v_score >= 45 THEN 'warm' WHEN v_score >= 20 THEN 'cool' ELSE 'cold' END,
    'inputs', v_inputs,
    'computed_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_account_heat_score(uuid,uuid) TO authenticated, service_role;


-- 3. Segment performance ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_segment_performance(p_workspace_id uuid, p_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_total int; v_valid int; v_risky int; v_invalid int; v_bounced int;
  v_positive_replies int; v_threads int; v_crm_pushed int;
  v_grade text;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag,false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH cset AS (
    SELECT c.id, c.email_canonical_status
    FROM public.contacts c
    JOIN public.list_contacts lc ON lc.contact_id = c.id
    WHERE c.workspace_id = p_workspace_id AND lc.list_id = p_list_id
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE email_canonical_status IN ('valid','valid_catch_all')),
    count(*) FILTER (WHERE email_canonical_status IN ('risky','unknown')),
    count(*) FILTER (WHERE email_canonical_status = 'invalid'),
    count(*) FILTER (WHERE email_canonical_status IN ('bounced','suppressed'))
  INTO v_total, v_valid, v_risky, v_invalid, v_bounced
  FROM cset;

  SELECT
    count(DISTINCT t.id),
    count(DISTINCT t.id) FILTER (WHERE t.category IN ('positive','meeting_intent') AND COALESCE(t.classification_confidence,0) >= 0.7)
  INTO v_threads, v_positive_replies
  FROM public.inbox_threads t
  WHERE t.workspace_id = p_workspace_id
    AND t.contact_id IN (SELECT contact_id FROM public.list_contacts WHERE list_id = p_list_id);

  IF v_total = 0 THEN
    RETURN jsonb_build_object('insufficient_data', true);
  END IF;

  v_grade := CASE
    WHEN v_valid::numeric / v_total >= 0.85 AND v_invalid + v_bounced < v_total * 0.05 THEN 'A'
    WHEN v_valid::numeric / v_total >= 0.70 THEN 'B'
    WHEN v_valid::numeric / v_total >= 0.50 THEN 'C'
    ELSE 'D'
  END;

  RETURN jsonb_build_object(
    'total', v_total,
    'valid_rate',   round((v_valid::numeric    / v_total)::numeric, 3),
    'risky_rate',   round((v_risky::numeric    / v_total)::numeric, 3),
    'invalid_rate', round((v_invalid::numeric  / v_total)::numeric, 3),
    'bounce_rate',  round((v_bounced::numeric  / v_total)::numeric, 3),
    'threads', v_threads,
    'positive_reply_rate', CASE WHEN v_threads > 0 THEN round((v_positive_replies::numeric / v_threads)::numeric, 3) ELSE NULL END,
    'grade', v_grade,
    'computed_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_segment_performance(uuid,uuid) TO authenticated, service_role;


-- 4. Daily Command Center --------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_command_center(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_flag boolean;
  v_user uuid := auth.uid();
  v_positive_replies jsonb; v_stale_opps jsonb; v_quarantine_count int;
  v_blocked_contacts int; v_low_readiness_lists jsonb;
BEGIN
  SELECT intelligence_v2 INTO v_flag FROM public.workspaces WHERE id = p_workspace_id;
  IF NOT COALESCE(v_flag,false) THEN RAISE EXCEPTION 'intelligence_v2_disabled'; END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_positive_replies FROM (
    SELECT jsonb_build_object(
      'thread_id', t.id, 'subject', t.subject,
      'category', t.category, 'confidence', t.classification_confidence,
      'contact_id', t.contact_id, 'last_message_at', t.last_message_at
    ) AS row
    FROM public.inbox_threads t
    WHERE t.workspace_id = p_workspace_id
      AND t.category IN ('positive','meeting_intent')
      AND COALESCE(t.classification_confidence,0) >= 0.7
      AND COALESCE(t.status::text,'open') NOT IN ('archived','closed')
    ORDER BY t.last_message_at DESC NULLS LAST
    LIMIT 25
  ) x;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_stale_opps FROM (
    SELECT jsonb_build_object(
      'opportunity_id', o.id, 'title', o.title, 'company_id', o.company_id,
      'last_activity_at', o.last_activity_at
    ) AS row
    FROM public.opportunities o
    WHERE o.workspace_id = p_workspace_id
      AND COALESCE(o.status::text,'open') NOT IN ('lost','closed_lost','won','closed_won','disqualified')
      AND (o.last_activity_at IS NULL OR o.last_activity_at < now() - interval '14 days')
    ORDER BY o.last_activity_at NULLS FIRST
    LIMIT 25
  ) x;

  SELECT count(*) INTO v_quarantine_count
  FROM public.import_quarantine_rows
  WHERE workspace_id = p_workspace_id AND status = 'pending';

  SELECT count(*) INTO v_blocked_contacts
  FROM public.contacts
  WHERE workspace_id = p_workspace_id
    AND email_canonical_status IN ('invalid','bounced','suppressed');

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_low_readiness_lists FROM (
    SELECT jsonb_build_object('list_id', l.id, 'name', l.name, 'contact_count', cnt) AS row
    FROM public.lists l
    JOIN LATERAL (
      SELECT count(*) AS cnt,
        count(*) FILTER (WHERE c.email_canonical_status IN ('invalid','bounced','suppressed')) AS bad,
        count(*) FILTER (WHERE c.email_canonical_status IN ('valid','valid_catch_all')) AS good
      FROM public.list_contacts lc
      JOIN public.contacts c ON c.id = lc.contact_id
      WHERE lc.list_id = l.id
    ) s ON true
    WHERE l.workspace_id = p_workspace_id
      AND s.cnt >= 5
      AND (s.good::numeric / GREATEST(s.cnt,1)) < 0.5
    ORDER BY (s.good::numeric / GREATEST(s.cnt,1)) ASC
    LIMIT 10
  ) x;

  RETURN jsonb_build_object(
    'positive_replies', v_positive_replies,
    'stale_opportunities', v_stale_opps,
    'quarantine_pending_count', v_quarantine_count,
    'blocked_contacts_count', v_blocked_contacts,
    'low_readiness_lists', v_low_readiness_lists,
    'computed_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_daily_command_center(uuid) TO authenticated, service_role;
