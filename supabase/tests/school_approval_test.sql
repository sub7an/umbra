-- New schools wait for approval (R32): create_school makes a 'pending' school; staff
-- can prepare classes; join_class / enrol_card_student refuse its classes until the
-- school is approved with `update public.schools set plan = 'pilot'`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------- fixtures
-- t: teacher (Google) who creates the school; g: Google student; k: card user.
insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('d1000000-0000-0000-0000-000000000001', 'tp@example.test', 'authenticated', 'authenticated', '{}'),
  ('d2000000-0000-0000-0000-000000000001', 'gp@example.test', 'authenticated', 'authenticated', '{}'),
  ('d3000000-0000-0000-0000-000000000001', 'kim-0001@students.umbra.invalid', 'authenticated', 'authenticated', '{"umbra_card":true}');

select lives_ok($$insert into public.schools (name, country, plan) values ('Check', 'GB', 'pending')$$,
  'schools.plan accepts pending');
select throws_ok($$insert into public.schools (name, country, plan) values ('Check', 'GB', 'trial')$$,
  '23514', null, 'schools.plan still rejects unknown plans');
select is((select column_default from information_schema.columns
            where table_schema = 'public' and table_name = 'schools' and column_name = 'plan'),
  '''pilot''::text', 'the column default stays pilot for service-role inserts');

-- ------------------------------------------------------- create_school
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select set_config('test.school', public.create_school('Pending School', 'GB')::text, true)$$,
  'create_school succeeds');
select is((select plan from public.schools where id = current_setting('test.school')::uuid),
  'pending', 'the new school is pending (its admin can read it)');

-- Staff can prepare classes while waiting.
select lives_ok(
  $$select set_config('test.class', c.id::text, true), set_config('test.code', c.code, true)
      from public.create_class(current_setting('test.school')::uuid, '12P', 'aqa', null) c$$,
  'create_class works for a pending school');

-- Staff cannot approve their own school.
select throws_ok($$update public.schools set plan = 'pilot' where id = current_setting('test.school')::uuid$$,
  '42501', null, 'staff have no update right on schools');
reset role;
select is((select plan from public.schools where id = current_setting('test.school')::uuid),
  'pending', 'staff cannot change the plan themselves');

-- ------------------------------------------------- joining while pending
set local role authenticated;
set local request.jwt.claims = '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.join_class(current_setting('test.code'), 'Amira')$$, 'P0001', 'school_pending',
  'join_class refuses a class of a pending school');
reset role;
select throws_ok(
  $$select public.enrol_student(current_setting('test.class')::uuid, 'd2000000-0000-0000-0000-000000000001', 'Amira')$$,
  'P0001', 'school_pending', 'enrol_student refuses a class of a pending school');
select throws_ok(
  $$select public.enrol_card_student(current_setting('test.class')::uuid, 'd3000000-0000-0000-0000-000000000001', 'Kim', 'kim-0001')$$,
  'P0001', 'school_pending', 'enrol_card_student refuses a class of a pending school');
select is(
  (select count(*)::int from public.students
    where user_id in ('d2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001')),
  0, 'no students rows were created while pending');

-- ------------------------------------------------------------- approval
update public.schools set plan = 'pilot' where id = current_setting('test.school')::uuid;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.join_class(current_setting('test.code'), 'Amira'), current_setting('test.class')::uuid,
  'after approval join_class works');
reset role;
select lives_ok(
  $$select public.enrol_card_student(current_setting('test.class')::uuid, 'd3000000-0000-0000-0000-000000000001', 'Kim', 'kim-0001')$$,
  'after approval enrol_card_student works');
select results_eq(
  $$select created_via, card_school_id from public.students
      where user_id = 'd3000000-0000-0000-0000-000000000001'$$,
  $$values ('card'::text, current_setting('test.school')::uuid)$$,
  'the card student belongs to the approved school');
select is((select count(*)::int from public.enrolments where class_id = current_setting('test.class')::uuid),
  2, 'both students are enrolled');

-- A lapsed school is not pending: it is not blocked by this gate.
update public.schools set plan = 'lapsed' where id = current_setting('test.school')::uuid;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.join_class(current_setting('test.code'), 'Amira')$$,
  'only pending blocks joining');

select * from finish();
rollback;
