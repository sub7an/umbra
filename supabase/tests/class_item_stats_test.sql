-- class_item_stats: RLS applies through security_invoker; wrong answers come from
-- incorrect attempts only.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-0000000000a1', 'ta@example.test', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-0000000000b1', 'tb@example.test', 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000001', null, 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000002', null, 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000003', null, 'authenticated', 'authenticated');

insert into public.schools (id, name, country) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'School A', 'GB'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'School B', 'GB');
insert into public.staff (user_id, school_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'teacher'),
  ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'teacher');
insert into public.classes (id, school_id, name, syllabus, code) values
  ('c0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1', 'aqa', 'AAAAA1'),
  ('c0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1', 'aqa', 'BBBBB1');
insert into public.students (user_id, display_name, created_via) values
  ('50000000-0000-0000-0000-000000000001', 'S One', 'card'),
  ('50000000-0000-0000-0000-000000000002', 'S Two', 'card'),
  ('50000000-0000-0000-0000-000000000003', 'S Three', 'card');
insert into public.enrolments (class_id, student_id) values
  ('c0000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000003');

insert into public.topics (id, title) values ('t.stats', 'Stats topic');
insert into public.items (id, version, kind, topic_ids, difficulty, public)
  values ('i.stats', 1, 'problem', array['t.stats'], 1, '{}'::jsonb);
insert into public.assignments (id, class_id, title, item_ids) values
  ('d0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'A homework', array['i.stats']),
  ('d0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'B homework', array['i.stats']);

-- Class A1: '42' is the most common response overall but every '42' is CORRECT;
-- among incorrect attempts '7 m' (x2) beats '9 m' (x1).
insert into public.attempts (id, student_id, item_id, part_id, assignment_id, response, correct, reason) values
  ('e0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'i.stats', 'a', 'd0000000-0000-0000-0000-0000000000a1', '42', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'i.stats', 'a', 'd0000000-0000-0000-0000-0000000000a1', '42', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'i.stats', 'a', 'd0000000-0000-0000-0000-0000000000a1', '42', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', 'i.stats', 'b', 'd0000000-0000-0000-0000-0000000000a1', '7 m', false, 'value'),
  ('e0000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', 'i.stats', 'b', 'd0000000-0000-0000-0000-0000000000a1', '7 m', false, 'value'),
  ('e0000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', 'i.stats', 'b', 'd0000000-0000-0000-0000-0000000000a1', '9 m', false, 'value'),
  -- Class B1 (school B): one wrong attempt by S Three, also enrolled in A1
  ('e0000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000003', 'i.stats', 'a', 'd0000000-0000-0000-0000-0000000000b1', '1 m', false, 'value');

select ok(
  (select c.reloptions @> array['security_invoker=on'] from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'class_item_stats'),
  'class_item_stats is security_invoker');
select ok(not has_table_privilege('anon', 'public.class_item_stats', 'select'), 'anon cannot select class_item_stats');
select ok(has_table_privilege('authenticated', 'public.class_item_stats', 'select'), 'authenticated can select class_item_stats');

-- Teacher A
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select results_eq(
  $$select attempts, correct_rate, top_wrong_response, top_wrong_part, top_wrong_count
      from public.class_item_stats where class_id = 'c0000000-0000-0000-0000-0000000000a1'$$,
  $$values (6, 0.5::real, '7 m'::text, 'b'::text, 2)$$,
  'tA: A1 stats; top wrong response comes from incorrect attempts only (not the commoner correct 42)');
select is(
  (select count(*)::int from public.class_item_stats where class_id = 'c0000000-0000-0000-0000-0000000000b1'),
  0, 'tA sees no rows for school B''s class');
select is((select count(*)::int from public.class_item_stats), 1, 'tA sees exactly one stats row');

-- Teacher B
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(
  (select count(*)::int from public.class_item_stats where class_id = 'c0000000-0000-0000-0000-0000000000a1'),
  0, 'tB sees no rows for school A''s class');
select results_eq(
  $$select class_id, attempts from public.class_item_stats$$,
  $$values ('c0000000-0000-0000-0000-0000000000b1'::uuid, 1)$$,
  'tB sees only B1, counting only B1 attempts');

-- A student sees only aggregates of their own attempts
set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select attempts from public.class_item_stats$$,
  $$values (2)$$,
  'a student''s view aggregates only their own attempts');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok('select * from public.class_item_stats', '42501', null, 'anon is refused');

reset role;
select * from finish();
rollback;
