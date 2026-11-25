-- School, class and join RPCs; no student emails in public.profiles.
-- Fixtures are inserted as postgres; calls run as `authenticated` with a forged JWT `sub`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------- fixtures
-- t1: teacher (Google), g1: student signing in with Google (real email),
-- c1: card student (synthetic email), nobody: authenticated user with no school.
insert into auth.users (id, email, aud, role) values
  ('71000000-0000-0000-0000-000000000001', 't1@example.test', 'authenticated', 'authenticated'),
  ('72000000-0000-0000-0000-000000000001', 'g1@example.test', 'authenticated', 'authenticated'),
  ('73000000-0000-0000-0000-000000000001', 'ab12cd@students.umbra.invalid', 'authenticated', 'authenticated'),
  ('79000000-0000-0000-0000-000000000001', 'nobody@example.test', 'authenticated', 'authenticated');

-- ------------------------------------------------- handle_new_user changes
select is(
  (select count(*)::int from public.profiles where id = '73000000-0000-0000-0000-000000000001'),
  0, 'synthetic-email auth user gets no profiles row');
select is(
  (select email from public.profiles where id = '72000000-0000-0000-0000-000000000001'),
  'g1@example.test', 'real-email auth user still gets a profiles row with email');

-- ------------------------------------------------------------- grants
select ok(not has_function_privilege('anon', 'public.create_school(text, text)', 'execute'),
  'anon cannot execute create_school');
select ok(not has_function_privilege('anon', 'public.join_class(text, text)', 'execute'),
  'anon cannot execute join_class');
select ok(not has_function_privilege('authenticated', 'public.enrol_student(uuid, uuid, text)', 'execute'),
  'authenticated cannot execute enrol_student');
select ok(has_function_privilege('service_role', 'public.enrol_student(uuid, uuid, text)', 'execute'),
  'service_role can execute enrol_student');

-- ------------------------------------------------------- create_school
set local role authenticated;
set local request.jwt.claims = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select set_config('test.school', public.create_school('Test School', 'GB')::text, true)$$,
  'create_school succeeds');
reset role;
select is(
  (select role from public.staff
    where user_id = '71000000-0000-0000-0000-000000000001'
      and school_id = current_setting('test.school')::uuid),
  'admin', 'create_school makes the caller admin');
select is(
  (select name from public.schools where id = current_setting('test.school')::uuid),
  'Test School', 'create_school inserts the school');

set local role authenticated;
set local request.jwt.claims = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.create_school('  ', 'GB')$$, 'P0001', 'invalid_name',
  'create_school rejects a blank name');
select throws_ok($$select public.create_school('X', '')$$, 'P0001', 'invalid_country',
  'create_school rejects a blank country');

-- -------------------------------------------------------- create_class
select lives_ok(
  $$select set_config('test.class', c.id::text, true), set_config('test.code', c.code, true)
      from public.create_class(current_setting('test.school')::uuid, '10X Physics', 'aqa', 'Y10') c$$,
  'create_class succeeds for staff');
select matches(current_setting('test.code'), '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$',
  'create_class returns a 6-character code from the alphabet');
select throws_ok(
  $$select * from public.create_class(current_setting('test.school')::uuid, 'Bad', 'nope', null)$$,
  '23514', null, 'create_class rejects an unknown syllabus');

-- a second class to archive later
select lives_ok(
  $$select set_config('test.class2', c.id::text, true), set_config('test.code2', c.code, true)
      from public.create_class(current_setting('test.school')::uuid, 'Old', 'ocr_a', null) c$$,
  'create_class makes a second class');

set local request.jwt.claims = '{"sub":"79000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select * from public.create_class(current_setting('test.school')::uuid, 'Hijack', 'aqa', null)$$,
  'P0001', 'not_staff', 'non-staff caller of create_class throws not_staff');

-- ------------------------------------------------------- normalise_code
select is(public.normalise_code(E' ab c\t12 '), 'ABC12', 'normalise_code upper-cases and strips whitespace');
select is(public.normalise_code('o0il1'), 'O0IL1', 'normalise_code maps no characters');

-- ----------------------------------------------------------- join_class
-- Google student
set local request.jwt.claims = '{"sub":"72000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  public.join_class(lower(' ' || current_setting('test.code') || ' '), 'Amira'),
  current_setting('test.class')::uuid,
  'join_class with a lower-case, padded code succeeds and returns the class id');
select lives_ok(
  $$select public.join_class(current_setting('test.code'), 'Amira')$$,
  'joining the same class twice is not an error');
select throws_ok($$select public.join_class('OOOOOO', 'Amira')$$, 'P0001', 'invalid_code',
  'a code with characters outside the alphabet throws invalid_code');
select throws_ok($$select public.join_class('ZZZZZZ', 'Amira')$$, 'P0001', 'invalid_code',
  'an unknown code throws invalid_code');
select throws_ok($$select public.join_class(current_setting('test.code'), '   ')$$, 'P0001', 'invalid_display_name',
  'a blank display name throws invalid_display_name');
select throws_ok($$select public.join_class(current_setting('test.code'), repeat('x', 41))$$, 'P0001', 'invalid_display_name',
  'a 41-character display name throws invalid_display_name');
select throws_ok(
  $$select public.enrol_student(current_setting('test.class')::uuid, '72000000-0000-0000-0000-000000000001', 'Amira')$$,
  '42501', null, 'authenticated cannot call enrol_student');

-- card student
set local request.jwt.claims = '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.join_class(current_setting('test.code'), '  Ben  ')$$,
  'card student joins');

reset role;
select is(
  (select email from public.profiles where id = '72000000-0000-0000-0000-000000000001'),
  null, 'after a Google user joins, profiles.email is null');
select results_eq(
  $$select display_name, created_via from public.students
      where user_id in ('72000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001')
      order by display_name$$,
  $$values ('Amira'::text, 'google'::text), ('Ben', 'card')$$,
  'students rows: Google user is google, synthetic-email user is card, names trimmed');
select is(
  (select count(*)::int from public.enrolments where class_id = current_setting('test.class')::uuid),
  2, 'two enrolments, re-join did not duplicate');

-- archived class
update public.classes set archived_at = now() where id = current_setting('test.class2')::uuid;
set local role authenticated;
set local request.jwt.claims = '{"sub":"72000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.join_class(current_setting('test.code2'), 'Amira')$$, 'P0001', 'class_archived',
  'joining an archived class throws class_archived');

select * from finish();
rollback;
