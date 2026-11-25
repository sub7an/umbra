-- Bayesian Knowledge Tracing per topic. JS twin: src/lib/mastery.js.
-- Constants: prior 0.2, learn 0.15, slip 0.1, mastered 0.95, hint guess 0.5,
-- guess by part answer_type: choice 0.2, numeric 0.05, expression 0.05, order 0.2.

-- Pure function; harmless to expose, so it stays callable.
create function public.bkt_update(
  p real, correct boolean, guess real,
  slip real default 0.1, learn real default 0.15
) returns real
language sql immutable
set search_path = ''
as $$
  select (post + (1 - post) * learn)::real
  from (
    select case when correct
      then (p::float8 * (1 - slip)) / (p::float8 * (1 - slip) + (1 - p::float8) * guess)
      else (p::float8 * slip) / (p::float8 * slip + (1 - p::float8) * (1 - guess))
    end as post
  ) s
$$;

create function public.update_mastery() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topics text[];
  v_type text;
  v_guess real;
  v_topic text;
  v_p real;
  v_step int;
  v_new_step int;
  v_days int[] := array[1, 3, 7, 16, 35];
begin
  select i.topic_ids,
         (select part ->> 'answer_type'
            from jsonb_array_elements(
                   case when jsonb_typeof(i.public -> 'parts') = 'array'
                        then i.public -> 'parts' else '[]'::jsonb end) part
           where part ->> 'id' = new.part_id
           limit 1)
    into v_topics, v_type
    from public.items i
   where i.id = new.item_id;

  if v_topics is null then
    return new;
  end if;

  v_guess := case
    when new.hints_used > 0 then 0.5
    when v_type = 'choice' then 0.2
    when v_type = 'numeric' then 0.05
    when v_type = 'expression' then 0.05
    when v_type = 'order' then 0.2
    else 0.2
  end;

  for v_topic in
    select distinct t.id from public.topics t where t.id = any (v_topics)
  loop
    -- lock the row (if any) so concurrent attempts on a topic apply in sequence
    select m.p_known, m.review_step into v_p, v_step
      from public.mastery m
     where m.student_id = new.student_id and m.topic_id = v_topic
       for update;
    if not found then
      v_p := 0.2;
      v_step := 0;
    end if;

    v_p := public.bkt_update(v_p, new.correct, v_guess);
    v_new_step := case when new.correct then least(v_step + 1, 4) else greatest(v_step - 1, 0) end;

    insert into public.mastery (student_id, topic_id, p_known, review_step, last_seen, next_review_at)
    values (
      new.student_id, v_topic, v_p, v_new_step, now(),
      case when v_p >= 0.95
        then now() + make_interval(days => v_days[(case when new.correct then v_step else v_new_step end) + 1])
      end)
    on conflict (student_id, topic_id) do update
      set p_known = excluded.p_known,
          review_step = excluded.review_step,
          last_seen = excluded.last_seen,
          next_review_at = excluded.next_review_at;
  end loop;

  return new;
end;
$$;

create trigger attempts_update_mastery
  after insert on public.attempts
  for each row execute function public.update_mastery();

-- The trigger function runs only as a trigger; nobody calls it directly.
revoke execute on function public.update_mastery() from public, anon, authenticated;
