-- Umbra for Schools: per-class item statistics for the teacher dashboard.
--
-- class_item_stats: one row per (class, item) that has assignment attempts.
--   attempts            all attempts on the item made through the class's assignments
--   correct_rate        share of those attempts that were correct (0..1)
--   top_wrong_response  the most common response among INCORRECT attempts only
--                       (ties: most recent, then text order); null when none are wrong
--   top_wrong_part      the part that response was given for
--   top_wrong_count     how many incorrect attempts gave it
--
-- security_invoker = on: the view runs with the caller's rights, so the RLS policies on
-- attempts and assignments decide what goes into the aggregates. A teacher only ever
-- aggregates attempts they could select directly (their own schools' assignments).

create view public.class_item_stats
with (security_invoker = on)
as
with base as (
  select a.class_id, t.item_id, t.part_id, btrim(t.response) as response, t.correct, t.created_at
    from public.attempts t
    join public.assignments a on a.id = t.assignment_id
),
agg as (
  select class_id, item_id,
         count(*)::int as attempts,
         round(avg(case when correct then 1 else 0 end)::numeric, 3)::real as correct_rate
    from base
   group by class_id, item_id
),
wrong as (
  select class_id, item_id, part_id, response,
         count(*)::int as n,
         row_number() over (
           partition by class_id, item_id
           order by count(*) desc, max(created_at) desc, response
         ) as rn
    from base
   where not correct
   group by class_id, item_id, part_id, response
)
select g.class_id, g.item_id, g.attempts, g.correct_rate,
       w.response as top_wrong_response,
       w.part_id as top_wrong_part,
       w.n as top_wrong_count
  from agg g
  left join wrong w on w.class_id = g.class_id and w.item_id = g.item_id and w.rn = 1;

revoke all on public.class_item_stats from public, anon, authenticated;
grant select on public.class_item_stats to authenticated;
grant select on public.class_item_stats to service_role;
