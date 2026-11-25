-- BKT: bkt_update vectors and the attempts trigger. Same vectors as src/lib/mastery.test.js.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, aud, role) values
  ('60000000-0000-0000-0000-000000000001', null, 'authenticated', 'authenticated');
insert into public.students (user_id, display_name, created_via)
  values ('60000000-0000-0000-0000-000000000001', 'BKT One', 'card');
insert into public.topics (id, title) values ('t.bkt1', 'BKT 1'), ('t.bkt2', 'BKT 2');
insert into public.items (id, version, kind, topic_ids, difficulty, public) values
  ('i.bkt.num', 1, 'problem', array['t.bkt1','t.bkt2'], 1,
   '{"stem":"s","parts":[{"id":"a","answer_type":"numeric"},{"id":"b","answer_type":"choice"}]}'::jsonb);

select is(round(public.bkt_update(0.2::real, true, 0.2::real)::numeric, 4), 0.6000::numeric, 'vector: correct, g=0.2');
select is(round(public.bkt_update(0.2::real, false, 0.2::real)::numeric, 4), 0.1758::numeric, 'vector: wrong, g=0.2');
select is(round(public.bkt_update(0.6::real, true, 0.05::real)::numeric, 4), 0.9696::numeric, 'vector: correct, g=0.05 from 0.6');

set local role service_role;

insert into public.attempts (id, student_id, item_id, part_id, response, correct, reason) values
  ('f0000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'i.bkt.num', 'a', '1', true, 'ok');

select is((select round(p_known::numeric, 4) from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt1'),
  0.8455::numeric, 'first numeric correct: 0.8455 on topic 1');
select is((select round(p_known::numeric, 4) from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt2'),
  0.8455::numeric, 'every topic of the item updated');
select is((select review_step from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt1'),
  1, 'correct answer advances review_step');
select is((select next_review_at from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt1') is null,
  true, 'no review date below 0.95');

-- second correct numeric: 0.8455 -> 0.9696 area, crosses 0.95
insert into public.attempts (id, student_id, item_id, part_id, response, correct, reason) values
  ('f0000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'i.bkt.num', 'a', '1', true, 'ok');
select is((select round(p_known::numeric, 4) from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt1'),
  0.9915::numeric, 'second correct: 0.9915');
select ok((select next_review_at from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt1')
  between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour',
  'mastered: next review in 3 days (step 1 interval)');

-- hint used: guess 0.5 on a fresh topic
reset role;
insert into public.topics (id, title) values ('t.bkt3', 'BKT 3');
insert into public.items (id, version, kind, topic_ids, difficulty, public) values
  ('i.bkt.hint', 1, 'problem', array['t.bkt3'], 1,
   '{"parts":[{"id":"a","answer_type":"numeric"}]}'::jsonb);
set local role service_role;
insert into public.attempts (id, student_id, item_id, part_id, response, correct, reason, hints_used) values
  ('f0000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'i.bkt.hint', 'a', '1', true, 'ok', 1);
select is((select round(p_known::numeric, 4) from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt3'),
  0.4138::numeric, 'hint used: guess 0.5');

-- unknown part -> guess 0.2 default
insert into public.attempts (id, student_id, item_id, part_id, response, correct, reason) values
  ('f0000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 'i.bkt.num', 'zzz', '1', false, 'no');
select is((select round(p_known::numeric, 4) from public.mastery
  where student_id = '60000000-0000-0000-0000-000000000001' and topic_id = 't.bkt2'),
  0.9452::numeric, 'unknown part: default guess 0.2, wrong answer');

-- R33: topics are locked in a fixed order (topic id) so concurrent attempts can't deadlock.
select ok(pg_get_functiondef('public.update_mastery()'::regprocedure) ~ 'order by t\.id',
  'update_mastery walks topics in topic-id order');

select * from finish();
rollback;
