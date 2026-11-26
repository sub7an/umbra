-- Retention (Task 12): purge_archived_classes() deletes classes archived more than
-- 12 months ago with their assignments, enrolments and attempts; card students left
-- with no class are deleted with their auth user; Google students left with no class
-- lose their classroom record but keep their own account. Also the deletion-request
-- cascade (delete from students) and the pg_cron schedule.
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------- fixtures
-- card1: only in Old.  card2: in Old and Active.  card3: only in Recent.
-- goog1: Google student only in Old.
insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('70000000-0000-0000-0000-000000000001', 'r1-0001@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}'),
  ('70000000-0000-0000-0000-000000000002', 'r2-0002@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}'),
  ('70000000-0000-0000-0000-000000000003', 'r3-0003@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}'),
  ('70000000-0000-0000-0000-000000000004', 'goog1@example.test', 'authenticated', 'authenticated', '{}');

insert into public.schools (id, name, country) values
  ('7a000000-0000-0000-0000-000000000000', 'Retention School', 'GB');
insert into public.classes (id, school_id, name, syllabus, code, archived_at) values
  ('7c000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'Old', 'aqa', 'RETOL1', now() - interval '13 months'),
  ('7c000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'Recent', 'aqa', 'RETRC1', now() - interval '1 month'),
  ('7c000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000000', 'Active', 'aqa', 'RETAC1', null);

insert into public.students (user_id, display_name, created_via, username, card_school_id) values
  ('70000000-0000-0000-0000-000000000001', 'Card One', 'card', 'r1-0001', '7a000000-0000-0000-0000-000000000000'),
  ('70000000-0000-0000-0000-000000000002', 'Card Two', 'card', 'r2-0002', '7a000000-0000-0000-0000-000000000000'),
  ('70000000-0000-0000-0000-000000000003', 'Card Three', 'card', 'r3-0003', '7a000000-0000-0000-0000-000000000000');
insert into public.students (user_id, display_name, created_via) values
  ('70000000-0000-0000-0000-000000000004', 'Goog One', 'google');
update public.profiles set email = null where id = '70000000-0000-0000-0000-000000000004';

insert into public.enrolments (class_id, student_id) values
  ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001'),
  ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002'),
  ('7c000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002'),
  ('7c000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003'),
  ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004');

insert into public.topics (id, title) values ('t.ret', 'Retention');
insert into public.items (id, version, kind, topic_ids, difficulty, public) values
  ('i.ret', 1, 'problem', array['t.ret'], 1, '{"stem":"s","parts":[{"id":"a","answer_type":"numeric"}]}'::jsonb);
insert into public.assignments (id, class_id, title, item_ids) values
  ('7d000000-0000-0000-0000-000000000001', '7c000000-0000-0000-0000-000000000001', 'Old work', array['i.ret']),
  ('7d000000-0000-0000-0000-000000000002', '7c000000-0000-0000-0000-000000000002', 'Recent work', array['i.ret']),
  ('7d000000-0000-0000-0000-000000000003', '7c000000-0000-0000-0000-000000000003', 'Active work', array['i.ret']);

insert into public.attempts (id, student_id, item_id, part_id, assignment_id, response, correct, reason) values
  ('7e000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'i.ret', 'a', '7d000000-0000-0000-0000-000000000001', 'x', false, 'r'),
  ('7e000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'i.ret', 'a', '7d000000-0000-0000-0000-000000000001', 'x', false, 'r'),
  ('7e000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'i.ret', 'a', '7d000000-0000-0000-0000-000000000003', 'x', true, 'r'),
  ('7e000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000003', 'i.ret', 'a', '7d000000-0000-0000-0000-000000000002', 'x', true, 'r'),
  ('7e000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000004', 'i.ret', 'a', '7d000000-0000-0000-0000-000000000001', 'x', true, 'r');

-- ------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.purge_archived_classes()', 'execute'),
  'anon cannot execute purge_archived_classes');
select ok(not has_function_privilege('authenticated', 'public.purge_archived_classes()', 'execute'),
  'authenticated cannot execute purge_archived_classes');
select ok(not has_function_privilege('service_role', 'public.purge_archived_classes()', 'execute'),
  'service_role cannot execute purge_archived_classes');
select ok(not has_function_privilege('authenticated', 'public.purge_classes(uuid[])', 'execute'),
  'authenticated cannot execute purge_classes');
select ok(not has_function_privilege('service_role', 'public.purge_classes(uuid[])', 'execute'),
  'service_role cannot execute purge_classes');

-- ---------------------------------------------------------------- schedule
select is((select count(*)::int from cron.job
  where jobname = 'purge-archived-classes' and command = 'select public.purge_archived_classes()'
    and schedule = '17 3 * * *'),
  1, 'pg_cron runs purge_archived_classes daily');

-- -------------------------------------------------------------------- purge
-- A plain class delete fails while attempts hang off its assignments (RESTRICT).
select throws_ok($$delete from public.classes where id = '7c000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'a class with attempts cannot be deleted directly');

select is(public.purge_archived_classes(), 1, 'one class is past 12 months');

select is((select count(*)::int from public.classes where id = '7c000000-0000-0000-0000-000000000001'),
  0, 'the class archived 13 months ago is gone');
select is((select count(*)::int from public.assignments where class_id = '7c000000-0000-0000-0000-000000000001'),
  0, 'its assignments are gone');
select is((select count(*)::int from public.attempts where assignment_id = '7d000000-0000-0000-0000-000000000001'),
  0, 'attempts on its assignments are gone');
select is((select count(*)::int from public.enrolments where class_id = '7c000000-0000-0000-0000-000000000001'),
  0, 'its enrolments are gone');

select is((select count(*)::int from auth.users where id = '70000000-0000-0000-0000-000000000001'),
  0, 'card student with no class left: auth user deleted');
select is((select count(*)::int from public.students where user_id = '70000000-0000-0000-0000-000000000001'),
  0, 'card student with no class left: student row deleted');

select is((select count(*)::int from public.students where user_id = '70000000-0000-0000-0000-000000000002'),
  1, 'card student still in another class is kept');
select is((select count(*)::int from public.attempts where student_id = '70000000-0000-0000-0000-000000000002'),
  1, 'that student keeps only the attempts of the live class');

select is((select count(*)::int from public.students where user_id = '70000000-0000-0000-0000-000000000004'),
  0, 'Google student with no class left: classroom record deleted');
select is((select count(*)::int from auth.users where id = '70000000-0000-0000-0000-000000000004'),
  1, 'Google student keeps their own sign-in account');

select is((select count(*)::int from public.classes where id in
  ('7c000000-0000-0000-0000-000000000002', '7c000000-0000-0000-0000-000000000003')),
  2, 'recently archived and active classes are untouched');
select is((select count(*)::int from public.attempts where student_id = '70000000-0000-0000-0000-000000000003'),
  1, 'attempts in the recently archived class are kept');
select is(public.purge_archived_classes(), 0, 'a second run finds nothing');

-- ---------------------------------------------------------- deletion request
-- DPIA admin procedure: delete from public.students where user_id = ...
select lives_ok($$delete from public.students where user_id = '70000000-0000-0000-0000-000000000002'$$,
  'deleting a student row succeeds although attempts reference assignments');
select is(
  (select count(*)::int from public.enrolments where student_id = '70000000-0000-0000-0000-000000000002')
  + (select count(*)::int from public.attempts where student_id = '70000000-0000-0000-0000-000000000002')
  + (select count(*)::int from public.mastery where student_id = '70000000-0000-0000-0000-000000000002'),
  0, 'deleting a student cascades to enrolments, attempts and mastery');
select lives_ok($$delete from public.assignments where id = '7d000000-0000-0000-0000-000000000003'$$,
  'the assignment can be deleted once the student''s attempts are gone');

select * from finish();
rollback;
