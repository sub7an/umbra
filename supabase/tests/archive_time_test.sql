-- Fix round 1 for Task 12 (I1): the server sets classes.archived_at, so a teacher
-- cannot backdate an archive and trigger the 12-month purge early.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('71000000-0000-0000-0000-000000000001', 'arch-teacher@example.test', 'authenticated', 'authenticated', '{}'),
  ('71000000-0000-0000-0000-000000000002', 'ar1-0001@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}');
insert into public.schools (id, name, country) values
  ('71a00000-0000-0000-0000-000000000000', 'Archive School', 'GB');
insert into public.staff (user_id, school_id, role) values
  ('71000000-0000-0000-0000-000000000001', '71a00000-0000-0000-0000-000000000000', 'teacher');
insert into public.classes (id, school_id, name, syllabus, code) values
  ('71c00000-0000-0000-0000-000000000001', '71a00000-0000-0000-0000-000000000000', 'Arch', 'aqa', 'ARCHV1');
insert into public.students (user_id, display_name, created_via, username, card_school_id) values
  ('71000000-0000-0000-0000-000000000002', 'Arch Card', 'card', 'ar1-0001', '71a00000-0000-0000-0000-000000000000');
insert into public.enrolments (class_id, student_id) values
  ('71c00000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002');

select has_trigger('public', 'classes', 'classes_set_archived_at', 'classes has the archived_at trigger');

-- ------------------------------------------------- teacher tries to backdate
set local role authenticated;
set local request.jwt.claims = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$update public.classes set archived_at = '2000-01-01' where id = '71c00000-0000-0000-0000-000000000001'$$,
  'teacher can archive a class');
reset role;

select ok((select abs(extract(epoch from (archived_at - now()))) < 5 from public.classes
  where id = '71c00000-0000-0000-0000-000000000001'),
  'a backdated archive is stored as now()');
select is(public.purge_archived_classes(), 0, 'purge deletes nothing for a class just archived');
select is((select count(*)::int from auth.users where id = '71000000-0000-0000-0000-000000000002'),
  1, 'its card student is kept');

-- ------------------------------------------ re-archive cannot move the clock
update public.classes set archived_at = '2001-01-01' where id = '71c00000-0000-0000-0000-000000000001';
select ok((select abs(extract(epoch from (archived_at - now()))) < 5 from public.classes
  where id = '71c00000-0000-0000-0000-000000000001'),
  'changing an existing archive time keeps the original time');

-- ------------------------------------------------------------- un-archive
set local role authenticated;
set local request.jwt.claims = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.classes set archived_at = null where id = '71c00000-0000-0000-0000-000000000001';
reset role;
select is((select archived_at from public.classes where id = '71c00000-0000-0000-0000-000000000001'),
  null, 'teacher can un-archive');

-- ---------------------------------------------------------------- inserts
-- Clients cannot insert classes at all (create_class only), so the insert rule only
-- matters for privileged roles: they may insert a historical archive time.
select ok(not has_table_privilege('authenticated', 'public.classes', 'insert'),
  'authenticated cannot insert classes directly');
insert into public.classes (id, school_id, name, syllabus, code, archived_at) values
  ('71c00000-0000-0000-0000-000000000002', '71a00000-0000-0000-0000-000000000000', 'Hist', 'aqa', 'ARCHV2', '2020-01-01');
select is((select archived_at from public.classes where id = '71c00000-0000-0000-0000-000000000002'),
  '2020-01-01'::timestamptz, 'postgres (admin tooling) may insert a historical archive time');

-- R31a: purge_classes locks the candidate students before its "no class left" checks.
select ok(pg_get_functiondef('public.purge_classes(uuid[])'::regprocedure)
  ~ 'from public\.students s\s+where s\.user_id = any\(v_students\)\s+order by s\.user_id\s+for update',
  'purge_classes locks candidate students FOR UPDATE');

select * from finish();
rollback;
