-- Row-level security for the classroom tables.
-- Fixtures are inserted as postgres; assertions run as `authenticated` with a
-- forged JWT `sub`, or as `anon`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

-- ---------------------------------------------------------------- fixtures
-- users: tA (teacher, school A), tB (teacher, school B),
--        s1 (student in class A1), s2 (student in A1 and B1),
--        s3 (student in no class), outsider (authenticated, no role)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-0000000000a1', 'ta@example.test', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-0000000000b1', 'tb@example.test', 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000001', null, 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000002', null, 'authenticated', 'authenticated'),
  ('50000000-0000-0000-0000-000000000003', null, 'authenticated', 'authenticated'),
  ('90000000-0000-0000-0000-000000000009', 'out@example.test', 'authenticated', 'authenticated');

insert into public.schools (id, name, country) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'School A', 'GB'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'School B', 'GB');

insert into public.staff (user_id, school_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'teacher'),
  ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'teacher');

insert into public.classes (id, school_id, name, syllabus, code, created_by) values
  ('c0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A1', 'aqa', 'AAAAA1', 'a0000000-0000-0000-0000-0000000000a1'),
  ('c0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B1', 'ocr_a', 'BBBBB1', 'b0000000-0000-0000-0000-0000000000b1');

insert into public.students (user_id, display_name, created_via) values
  ('50000000-0000-0000-0000-000000000001', 'S One', 'card'),
  ('50000000-0000-0000-0000-000000000002', 'S Two', 'card'),
  ('50000000-0000-0000-0000-000000000003', 'S Three', 'card');

insert into public.enrolments (class_id, student_id) values
  ('c0000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000002');

insert into public.topics (id, title) values ('t.test', 'Test topic');
insert into public.items (id, version, kind, topic_ids, difficulty, public)
  values ('i.test', 1, 'numeric', array['t.test'], 1, '{}'::jsonb);
insert into public.item_keys (item_id, version, private)
  values ('i.test', 1, '{"key":"fixture"}'::jsonb);

insert into public.assignments (id, class_id, title, item_ids) values
  ('d0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'A homework', array['i.test']),
  ('d0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'B homework', array['i.test']),
  ('d0000000-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-0000000000b1', 'B unused', array['i.test']);

-- attempts:
--   e1: s1 on A assignment      e2: s1 free practice (null assignment)
--   e3: s2 on A assignment      e4: s2 on B assignment
--   e5: s3 free practice (not enrolled anywhere)
insert into public.attempts (id, student_id, item_id, part_id, assignment_id, response, correct, reason) values
  ('e0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'i.test', 'a', 'd0000000-0000-0000-0000-0000000000a1', '1', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'i.test', 'a', null, '1', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'i.test', 'a', 'd0000000-0000-0000-0000-0000000000a1', '1', true, 'ok'),
  ('e0000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'i.test', 'a', 'd0000000-0000-0000-0000-0000000000b1', '1', false, 'no'),
  ('e0000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', 'i.test', 'a', null, '1', true, 'ok');

insert into public.mastery (student_id, topic_id, p_known, last_seen) values
  ('50000000-0000-0000-0000-000000000001', 't.test', 0.5, now()),
  ('50000000-0000-0000-0000-000000000002', 't.test', 0.5, now());

-- ------------------------------------------------------- structural checks
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      and c.relname = any(array['schools','staff','classes','students','enrolments','topics',
        'syllabus_map','items','item_keys','assignments','attempts','mastery'])),
  0, 'RLS enabled on all 12 classroom tables');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'item_keys'),
  0, 'item_keys has no policies');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'attempts'
     and cmd <> 'SELECT'),
  0, 'attempts has no write policies');

-- ------------------------------------------------------------ teacher tA
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select count(*)::int from public.attempts where student_id = '50000000-0000-0000-0000-000000000001'),
  2, 'tA sees s1''s attempts (assignment + free practice)');
select is((select count(*)::int from public.attempts where id = 'e0000000-0000-0000-0000-000000000003'),
  1, 'tA sees s2''s A-assignment attempt');
select is((select count(*)::int from public.attempts where id = 'e0000000-0000-0000-0000-000000000004'),
  0, 'tA does not see s2''s B-assignment attempt (Review Focus 4)');
select is((select count(*)::int from public.attempts where student_id = '50000000-0000-0000-0000-000000000003'),
  0, 'tA does not see attempts of a student in none of their classes');
select is((select count(*)::int from public.schools), 1, 'tA sees only own school');
select is((select count(*)::int from public.staff where school_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  0, 'tA sees no staff of school B');
select is((select count(*)::int from public.classes), 1, 'tA sees only school A classes');
select is((select count(*)::int from public.students), 2, 'tA sees only students they teach');
select is((select count(*)::int from public.enrolments), 2, 'tA sees only enrolments of A classes');
select is((select count(*)::int from public.assignments), 1, 'tA sees only A assignments');
select is((select count(*)::int from public.mastery), 2, 'tA sees mastery of taught students');
select lives_ok(
  $$insert into public.classes (school_id, name, syllabus, code) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A2', 'aqa', 'AAAAA2')$$,
  'tA can create a class in own school');
select throws_ok(
  $$insert into public.classes (school_id, name, syllabus, code) values ('bbbbbbbb-0000-0000-0000-000000000000', 'X', 'aqa', 'XXXXXX')$$,
  '42501', null, 'tA cannot create a class in school B');
select throws_ok(
  $$insert into public.assignments (class_id, title, item_ids) values ('c0000000-0000-0000-0000-0000000000b1', 'evil', array['i.test'])$$,
  '42501', null, 'tA cannot create an assignment in a B class');
select throws_ok($$select * from public.item_keys$$, '42501', null,
  'item_keys not readable by a teacher');

-- ------------------------------------------------------------ teacher tB
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select is((select count(*)::int from public.attempts where student_id = '50000000-0000-0000-0000-000000000001'),
  0, 'tB sees none of s1''s attempts');
select is((select count(*)::int from public.attempts where student_id = '50000000-0000-0000-0000-000000000002' and assignment_id is not null),
  1, 'tB sees only s2''s B-assignment attempt');
select is_empty(
  $$update public.classes set name = 'pwned' where id = 'c0000000-0000-0000-0000-0000000000a1' returning id$$,
  'tB cannot update a school A class');
-- Fix round 1: deleting an assignment must not turn its attempts into free practice.
select throws_ok(
  $$delete from public.assignments where id = 'd0000000-0000-0000-0000-0000000000b1'$$,
  '23503', null, 'tB cannot delete a B assignment that has attempts (restrict)');
select results_eq(
  $$delete from public.assignments where id = 'd0000000-0000-0000-0000-0000000000b2' returning id$$,
  $$values ('d0000000-0000-0000-0000-0000000000b2'::uuid)$$,
  'tB can delete a B assignment with no attempts');

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.attempts where id = 'e0000000-0000-0000-0000-000000000004'),
  0, 'after tB delete attempt, tA still sees 0 of s2''s B attempts');

-- Fix round 1 (R8): billing columns on profiles are not client-writable.
select throws_ok(
  $$update public.profiles set is_pro = true where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'user cannot set own is_pro');
select throws_ok(
  $$update public.profiles set stripe_customer_id = 'cus_x' where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'user cannot set own stripe_customer_id');
select results_eq(
  $$update public.profiles set progress = '{"t":1}'::jsonb where id = 'a0000000-0000-0000-0000-0000000000a1' returning progress$$,
  $$values ('{"t":1}'::jsonb)$$,
  'user can update own progress');
select throws_ok(
  $$insert into public.profiles (id, is_pro) values ('a0000000-0000-0000-0000-0000000000a1', true) on conflict (id) do nothing$$,
  '42501', null, 'user cannot insert a profile with is_pro');

-- ------------------------------------------------------------ student s1
set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.attempts), 2, 's1 sees exactly two attempts');
select is((select count(*)::int from public.attempts where student_id <> '50000000-0000-0000-0000-000000000001'),
  0, 's1 sees only own attempts');
select is((select count(*)::int from public.students), 1, 's1 sees only own student row');
select is((select count(*)::int from public.classes), 1, 's1 sees only enrolled class');
select is((select count(*)::int from public.assignments), 1, 's1 sees only assignments of enrolled class');
select is((select count(*)::int from public.schools), 0, 's1 sees no schools');
select is((select count(*)::int from public.mastery where student_id <> '50000000-0000-0000-0000-000000000001'),
  0, 's1 sees no other student''s mastery');
select throws_ok($$select * from public.item_keys$$, '42501', null,
  'select * from item_keys as authenticated: permission denied');
select throws_ok(
  $$insert into public.attempts (id, student_id, item_id, part_id, response, correct, reason)
    values ('e0000000-0000-0000-0000-0000000000ff', '50000000-0000-0000-0000-000000000001', 'i.test', 'a', '1', true, 'forged')$$,
  '42501', null, 'insert into attempts as s1 throws');
select throws_ok(
  $$update public.attempts set correct = true where id = 'e0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'update attempts as s1 throws');
select throws_ok(
  $$insert into public.mastery (student_id, topic_id, p_known, last_seen) values ('50000000-0000-0000-0000-000000000001', 't.test', 1, now())$$,
  '42501', null, 'insert into mastery as s1 throws');

-- ------------------------------------------------------------------ anon
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.items), 1, 'anon can read items');
select throws_ok($$select * from public.item_keys$$, '42501', null, 'item_keys not readable by anon');
select throws_ok($$select * from public.attempts$$, '42501', null, 'attempts not readable by anon');

-- ------------------------------------- removing staff revokes visibility
reset role;
delete from public.staff where user_id = 'a0000000-0000-0000-0000-0000000000a1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select count(*)::int from public.attempts), 0,
  'after delete from staff, tA sees 0 attempts (Review Focus 2)');

reset role;
select * from finish();
rollback;
