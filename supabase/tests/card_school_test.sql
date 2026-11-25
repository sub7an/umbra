-- Card students belong to their issuing school (R14), resets revoke sessions (R15),
-- seat and school caps (R16).
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- ---------------------------------------------------------------- fixtures
-- tA: staff of school A (2 seats); attacker: Google user who will own school B.
-- card1, card2, card3: card users (app_metadata umbra_card = true).
insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'ta@example.test', 'authenticated', 'authenticated', '{}'),
  ('a2000000-0000-0000-0000-000000000001', 'evil@example.test', 'authenticated', 'authenticated', '{}'),
  ('a3000000-0000-0000-0000-000000000001', 'amira-0001@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}'),
  ('a3000000-0000-0000-0000-000000000002', 'ben-0002@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}'),
  ('a3000000-0000-0000-0000-000000000003', 'cara-0003@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}');

insert into public.schools (id, name, country, seats) values
  ('aa000000-0000-0000-0000-000000000000', 'School A', 'GB', 2),
  ('bb000000-0000-0000-0000-000000000000', 'School B', 'GB', 150);
insert into public.staff (user_id, school_id, role) values
  ('a1000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000000', 'teacher'),
  ('a2000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000000', 'admin');
insert into public.classes (id, school_id, name, syllabus, code) values
  ('ca000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000000', 'A1', 'aqa', 'AAAAA3'),
  ('ca000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000000', 'A2', 'aqa', 'AAAAA4'),
  ('cb000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000000', 'B1', 'aqa', 'BBBBB3');

-- ------------------------------------------------- enrol_card_student (R14)
select has_column('public', 'students', 'card_school_id', 'students.card_school_id exists');
select ok(not has_function_privilege('authenticated', 'public.enrol_card_student(uuid, uuid, text, text)', 'execute'),
  'authenticated cannot execute enrol_card_student');
select lives_ok(
  $$select public.enrol_card_student('ca000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Amira', 'amira-0001')$$,
  'service path enrols a card user in a class of school A');
select results_eq(
  $$select created_via, username, card_school_id from public.students where user_id = 'a3000000-0000-0000-0000-000000000001'$$,
  $$values ('card'::text, 'amira-0001'::text, 'aa000000-0000-0000-0000-000000000000'::uuid)$$,
  'enrol_card_student records card, username and the issuing school');
select throws_ok(
  $$select public.enrol_card_student('ca000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Evil', 'evil-0001')$$,
  'P0001', 'not_card_user', 'enrol_card_student refuses a non-card user');

-- seat cap: school A has 2 seats
select lives_ok(
  $$select public.enrol_card_student('ca000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'Ben', 'ben-0002')$$,
  'second card student fits in 2 seats');
select throws_ok(
  $$select public.enrol_card_student('ca000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'Cara', 'cara-0003')$$,
  'P0001', 'seat_limit', 'third card student over the seat cap throws seat_limit');

-- join_class as the card student
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.join_class('BBBBB3', 'Amira')$$, 'P0001', 'card_school_only',
  'a card student of school A cannot join a class of school B');
select lives_ok($$select public.join_class('AAAAA4', 'Amira')$$,
  'a card student of school A can join another class of school A');
reset role;
select is(
  (select count(*)::int from public.enrolments where student_id = 'a3000000-0000-0000-0000-000000000001'),
  2, 'card student is in the two A classes only');

-- ------------------------------------------------ revoke_user_sessions (R15)
insert into auth.sessions (id, user_id) values
  ('5e000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001'),
  ('5e000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001'),
  ('5e000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001');
insert into auth.refresh_tokens (token, user_id, session_id, revoked) values
  ('tok-card-1', 'a3000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', false);

select ok(not has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'execute'),
  'authenticated has no execute on revoke_user_sessions');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.revoke_user_sessions('a3000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'calling revoke_user_sessions as authenticated throws 42501');
reset role;
select lives_ok($$select public.revoke_user_sessions('a3000000-0000-0000-0000-000000000001')$$,
  'revoke_user_sessions runs for the service path');
select is(
  (select count(*)::int from auth.sessions where user_id = 'a3000000-0000-0000-0000-000000000001')
  + (select count(*)::int from auth.refresh_tokens where user_id = 'a3000000-0000-0000-0000-000000000001'),
  0, 'the student''s sessions and refresh tokens are gone');
select is((select count(*)::int from auth.sessions where user_id = 'a1000000-0000-0000-0000-000000000001'),
  1, 'other users'' sessions are untouched');

-- ------------------------------------------------------ create_school (R16)
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_school('B2', 'GB')$$, 'second school as admin');
select lives_ok($$select public.create_school('B3', 'GB')$$, 'third school as admin');
select throws_ok($$select public.create_school('B4', 'GB')$$, 'P0001', 'school_limit',
  'a fourth school as admin throws school_limit');

select * from finish();
rollback;
