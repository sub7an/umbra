-- Card identity (R10) and class write grants (R11).
-- Fixtures are inserted as postgres; class writes run as `authenticated` with a forged JWT `sub`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- ------------------------------------------------ guard_card_email (R10)
-- The guard is deferred to commit (GoTrue sets app_metadata after the insert);
-- make it fire at the end of each statement so the test can see it.
set constraints all immediate;
select throws_ok(
  $$insert into auth.users (id, email, aud, role) values
    ('81000000-0000-0000-0000-000000000001', 'fake-1234@students.umbra.invalid', 'authenticated', 'authenticated')$$,
  '42501', 'reserved_email_domain',
  'a synthetic-domain auth user without the card flag is refused');
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_app_meta_data) values
    ('81000000-0000-0000-0000-000000000002', 'Fake-1234@Students.Umbra.Invalid', 'authenticated', 'authenticated', '{"umbra_card":"yes"}')$$,
  '42501', 'reserved_email_domain',
  'mixed-case synthetic domain with a non-true flag is refused');

select lives_ok(
  $$insert into auth.users (id, email, aud, role, raw_app_meta_data) values
    ('82000000-0000-0000-0000-000000000001', 'amira-1234@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}')$$,
  'a synthetic-domain auth user with app_metadata umbra_card = true is created');
select is(
  (select count(*)::int from public.profiles where id = '82000000-0000-0000-0000-000000000001'),
  0, 'the card user gets no profiles row');
select throws_ok(
  $$update auth.users set raw_app_meta_data = '{}' where id = '82000000-0000-0000-0000-000000000001'$$,
  '42501', 'reserved_email_domain',
  'removing the card flag from a synthetic-domain user is refused');

-- t: teacher of school S; g: a plain (Google) user.
insert into auth.users (id, email, aud, role) values
  ('83000000-0000-0000-0000-000000000001', 't@example.test', 'authenticated', 'authenticated'),
  ('84000000-0000-0000-0000-000000000001', 'g@example.test', 'authenticated', 'authenticated');
insert into public.schools (id, name, country) values ('a8000000-0000-0000-0000-000000000000', 'S', 'GB');
insert into public.staff (user_id, school_id, role) values
  ('83000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', 'teacher');
insert into public.classes (id, school_id, name, syllabus, code) values
  ('c8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000000', 'K', 'aqa', 'KKKKK8');

-- ---------------------------------------------------- enrol_student (R10)
select lives_ok(
  $$select public.enrol_student('c8000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Amira')$$,
  'enrol_student enrols the card user');
select is(
  (select created_via from public.students where user_id = '82000000-0000-0000-0000-000000000001'),
  'card', 'enrol_student sets created_via = card from app_metadata');
select lives_ok(
  $$select public.enrol_student('c8000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'Gita')$$,
  'enrol_student enrols a Google user');
select is(
  (select created_via from public.students where user_id = '84000000-0000-0000-0000-000000000001'),
  'google', 'a user without the flag is google');
select throws_ok(
  $$update auth.users set email = 'gita-0001@students.umbra.invalid' where id = '84000000-0000-0000-0000-000000000001'$$,
  '42501', 'reserved_email_domain',
  'changing a normal user''s email to the synthetic domain is refused');

-- -------------------------------------------------- classes grants (R11)
set local role authenticated;
set local request.jwt.claims = '{"sub":"83000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$insert into public.classes (school_id, name, syllabus, code) values ('a8000000-0000-0000-0000-000000000000', 'K2', 'aqa', 'KKKKK9')$$,
  '42501', null, 'staff cannot insert into classes directly (create_class only)');
select throws_ok(
  $$update public.classes set code = 'ZZZZZ9' where id = 'c8000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'staff cannot update classes.code');
select results_eq(
  $$update public.classes set name = 'K renamed', archived_at = now()
      where id = 'c8000000-0000-0000-0000-000000000001' returning name$$,
  $$values ('K renamed'::text)$$,
  'staff can still update name and archived_at');

select * from finish();
rollback;
