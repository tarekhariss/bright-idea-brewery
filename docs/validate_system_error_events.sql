-- Validation for the system_error_events migration.
--
-- Run this AFTER applying 20260920093000_system_error_events.sql, BEFORE
-- trusting it. It proves privilege behaviour by actually assuming each role
-- (SET ROLE) rather than reading the DDL and hoping.
--
-- Every check RAISEs on failure, so the script stops at the first problem.
-- It creates test rows with a recognisable fingerprint and removes them at the
-- end; the final block verifies nothing was left behind.
--
-- Safe to run on staging. Safe on production in principle — it writes only its
-- own rows and cleans them up — but run it on the clone first.

\echo '=== system_error_events validation ==='

-- ============================================================
-- 0. The objects exist and RLS is on
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='system_error_events') then
    raise exception 'FAIL: table system_error_events does not exist';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='system_error_events' and c.relrowsecurity
  ) then
    raise exception 'FAIL: RLS is not enabled on system_error_events';
  end if;
  raise notice 'PASS 0: table exists, RLS enabled';
end $$;

-- ============================================================
-- 1. No permissive policy, and no UPDATE policy for authenticated
-- ============================================================
do $$
declare v_bad int; v_upd int;
begin
  select count(*) into v_bad from pg_policies
   where schemaname='public' and tablename='system_error_events'
     and (qual = 'true' or with_check = 'true');
  if v_bad > 0 then raise exception 'FAIL: % permissive USING(true) policy/policies', v_bad; end if;

  select count(*) into v_upd from pg_policies
   where schemaname='public' and tablename='system_error_events' and cmd = 'UPDATE';
  if v_upd > 0 then
    raise exception 'FAIL: an UPDATE policy exists; resolution must go through resolve_system_error_event()';
  end if;

  raise notice 'PASS 1: no permissive policies, no direct UPDATE policy';
end $$;

-- ============================================================
-- 2. Table grants are explicit and narrow
-- ============================================================
do $$
declare v_anon text[]; v_auth text[];
begin
  select coalesce(array_agg(privilege_type order by privilege_type), '{}')
    into v_anon from information_schema.role_table_grants
   where table_schema='public' and table_name='system_error_events' and grantee='anon';

  select coalesce(array_agg(privilege_type order by privilege_type), '{}')
    into v_auth from information_schema.role_table_grants
   where table_schema='public' and table_name='system_error_events' and grantee='authenticated';

  if array_length(v_anon, 1) is not null then
    raise exception 'FAIL: anon holds table privileges: %', v_anon;
  end if;
  if v_auth <> array['SELECT']::text[] then
    raise exception 'FAIL: authenticated should hold SELECT only, holds: %', v_auth;
  end if;

  raise notice 'PASS 2: anon has no table grants; authenticated has SELECT only';
end $$;

-- ============================================================
-- 3. Function EXECUTE is restricted
-- ============================================================
do $$
begin
  if has_function_privilege('anon',
       'public.record_error_event(text,text,text,text,text,uuid,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute record_error_event';
  end if;
  if has_function_privilege('authenticated',
       'public.record_error_event(text,text,text,text,text,uuid,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute record_error_event';
  end if;
  if not has_function_privilege('service_role',
       'public.record_error_event(text,text,text,text,text,uuid,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'FAIL: service_role CANNOT execute record_error_event — telemetry would silently record nothing';
  end if;
  if has_function_privilege('anon', 'public.resolve_system_error_event(uuid,boolean)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute resolve_system_error_event';
  end if;
  raise notice 'PASS 3: recorder is service_role only; resolver not reachable by anon';
end $$;

-- ============================================================
-- 4. SECURITY DEFINER functions pin search_path
-- ============================================================
do $$
declare r record;
begin
  for r in
    select p.proname, p.proconfig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.prosecdef
       and p.proname in ('record_error_event','resolve_system_error_event')
  loop
    if r.proconfig is null or not (r.proconfig::text like '%search_path%') then
      raise exception 'FAIL: % is SECURITY DEFINER without an explicit search_path', r.proname;
    end if;
  end loop;
  raise notice 'PASS 4: SECURITY DEFINER functions pin search_path';
end $$;

-- ============================================================
-- 5. anon cannot read or write  (actual role behaviour)
-- ============================================================
do $$
declare v_count int;
begin
  set local role anon;
  begin
    select count(*) into v_count from public.system_error_events;
    -- Reaching here is only acceptable if RLS returned zero rows.
    if v_count > 0 then
      reset role;
      raise exception 'FAIL: anon read % rows', v_count;
    end if;
  exception when insufficient_privilege then
    null; -- also acceptable: denied outright
  end;

  begin
    insert into public.system_error_events (fingerprint, source, component, message)
    values ('VALIDATION-anon', 'test', 'test', 'should not be possible');
    reset role;
    raise exception 'FAIL: anon inserted a row';
  exception when insufficient_privilege or check_violation then
    null; -- expected
  end;

  reset role;
  raise notice 'PASS 5: anon cannot read or write';
end $$;

-- ============================================================
-- 6. A normal authenticated user cannot read or write
-- ============================================================
-- Note: SET ROLE authenticated leaves auth.uid() null, so is_platform_admin()
-- is false — which is exactly the non-admin case being tested.
do $$
declare v_count int;
begin
  set local role authenticated;
  select count(*) into v_count from public.system_error_events;
  if v_count > 0 then
    reset role;
    raise exception 'FAIL: non-admin authenticated user read % rows', v_count;
  end if;

  begin
    insert into public.system_error_events (fingerprint, source, component, message)
    values ('VALIDATION-auth', 'test', 'test', 'should not be possible');
    reset role;
    raise exception 'FAIL: authenticated inserted a row';
  exception when insufficient_privilege then
    null; -- expected: no INSERT grant
  end;

  begin
    update public.system_error_events set occurrence_count = 999999;
    reset role;
    raise exception 'FAIL: authenticated updated rows';
  exception when insufficient_privilege then
    null; -- expected: no UPDATE grant
  end;

  reset role;
  raise notice 'PASS 6: non-admin authenticated cannot read, insert or update';
end $$;

-- ============================================================
-- 7. service_role can record, and identical errors aggregate
-- ============================================================
do $$
declare
  v_id1 uuid; v_id2 uuid; v_count bigint; v_first timestamptz; v_last timestamptz;
begin
  set local role service_role;

  v_id1 := public.record_error_event(
    'validation', 'validation-component', 'Simulated failure for contact 12345678-1234-1234-1234-123456789abc',
    'validate', 'error', null, 'job-1', 'entity-1', 'TestError', '{"attempt":1}'::jsonb);

  -- Same fault, different volatile detail: a different uuid and a different
  -- number. The fingerprint must normalise both away.
  v_id2 := public.record_error_event(
    'validation', 'validation-component', 'Simulated failure for contact 99999999-9999-9999-9999-999999999999',
    'validate', 'error', null, 'job-2', 'entity-2', 'TestError', '{"attempt":2}'::jsonb);

  if v_id1 <> v_id2 then
    reset role;
    raise exception 'FAIL: identical faults produced two rows (% and %) — fingerprint is not normalising', v_id1, v_id2;
  end if;

  select occurrence_count, first_seen_at, last_seen_at
    into v_count, v_first, v_last
    from public.system_error_events where id = v_id1;

  if v_count <> 2 then
    reset role;
    raise exception 'FAIL: occurrence_count is % after two records, expected 2', v_count;
  end if;
  if v_last < v_first then
    reset role;
    raise exception 'FAIL: last_seen_at is earlier than first_seen_at';
  end if;

  reset role;
  raise notice 'PASS 7: service_role records; identical faults aggregate (count=%, first preserved)', v_count;
end $$;

-- ============================================================
-- 8. Recurrence reopens a resolved error
-- ============================================================
do $$
declare v_id uuid; v_resolved timestamptz;
begin
  set local role service_role;

  select id into v_id from public.system_error_events where source = 'validation' limit 1;
  update public.system_error_events set resolved_at = now() where id = v_id;

  perform public.record_error_event(
    'validation', 'validation-component', 'Simulated failure for contact 11111111-1111-1111-1111-111111111111',
    'validate', 'error', null, null, null, 'TestError', '{}'::jsonb);

  select resolved_at into v_resolved from public.system_error_events where id = v_id;
  if v_resolved is not null then
    reset role;
    raise exception 'FAIL: a recurring error stayed resolved';
  end if;

  reset role;
  raise notice 'PASS 8: recurrence reopens a resolved error';
end $$;

-- ============================================================
-- 9. The privileged resolver cannot create rows
-- ============================================================
do $$
declare v_before bigint; v_after bigint; v_result jsonb;
begin
  set local role service_role;
  select count(*) into v_before from public.system_error_events;

  -- A random id that does not exist. A resolver that upserted would create one.
  v_result := public.resolve_system_error_event(gen_random_uuid(), true);

  select count(*) into v_after from public.system_error_events;
  if v_after <> v_before then
    reset role;
    raise exception 'FAIL: resolve_system_error_event created a row';
  end if;
  if (v_result->>'ok')::boolean then
    reset role;
    raise exception 'FAIL: resolving a non-existent id reported success';
  end if;

  reset role;
  raise notice 'PASS 9: resolver cannot fabricate error history (reason: %)', v_result->>'reason';
end $$;

-- ============================================================
-- 10. Concurrency — two identical records must not race
-- ============================================================
-- Single-session approximation. The real guarantee comes from the unique
-- constraint plus ON CONFLICT DO UPDATE, which takes a row lock: two concurrent
-- inserts of the same fingerprint serialise, and the loser increments rather
-- than failing. Run the pgbench note below for a true concurrent test.
do $$
declare v_id uuid; v_count bigint; i int;
begin
  set local role service_role;
  for i in 1..25 loop
    v_id := public.record_error_event(
      'validation-concurrency', 'validation-component', 'Repeated identical fault',
      'validate', 'warning', null, null, null, 'RaceTest', '{}'::jsonb);
  end loop;

  select occurrence_count into v_count
    from public.system_error_events where source = 'validation-concurrency';

  if v_count <> 25 then
    reset role;
    raise exception 'FAIL: 25 records produced occurrence_count=%', v_count;
  end if;

  reset role;
  raise notice 'PASS 10: 25 identical records produced one row with count=25';
end $$;

-- For a genuine concurrency test, from a shell with psql available:
--   pgbench -n -c 8 -j 4 -t 50 -f - "$DATABASE_URL" <<'BENCH'
--   select public.record_error_event('bench','bench-component','Concurrent fault',
--     'validate','error',null,null,null,'BenchError','{}'::jsonb);
--   BENCH
-- Then: select occurrence_count from public.system_error_events where source='bench';
-- Expected: exactly 400, in a single row.

-- ============================================================
-- 11. Clean up and confirm
-- ============================================================
do $$
declare v_left int;
begin
  set local role service_role;
  delete from public.system_error_events
   where source in ('validation', 'validation-concurrency', 'bench');

  select count(*) into v_left from public.system_error_events
   where source in ('validation', 'validation-concurrency', 'bench');
  reset role;

  if v_left > 0 then
    raise exception 'FAIL: % validation row(s) left behind', v_left;
  end if;
  raise notice 'PASS 11: validation rows removed';
end $$;

\echo '=== all checks passed ==='
