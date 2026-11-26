-- Fix round 1 for Task 12 (security review).
--
-- I1: teachers may update classes.archived_at (20261201000450_card_identity.sql grants
-- update (name, year_group, archived_at) to authenticated). Without a check, a direct
-- PostgREST call could set archived_at to '2000-01-01', and within a day
-- purge_archived_classes() would delete the class, its attempts and its card students.
-- Archive would become an instant, irreversible delete. Now the server sets the time:
--   * UPDATE: null -> any value stores now(); a value -> another value keeps the old
--     archive time (re-archiving cannot move the clock); any -> null is allowed
--     (un-archive). This applies to every role.
--   * INSERT: archived_at is forced to null unless the inserting role is postgres,
--     supabase_admin or service_role (create_class never sets it; admin tooling and
--     the pgTAP fixtures may insert historical archive times).
--
-- R31a: purge_classes now locks the candidate students rows FOR UPDATE before deleting.
-- An enrolment insert takes FOR KEY SHARE on the students row (FK check), so a join
-- that is in flight either commits first (the purge then waits, and its later
-- "no enrolment left" checks see the new enrolment, as each statement takes a fresh
-- snapshot under READ COMMITTED) or waits for the purge and then fails its FK check.
-- A card student who joins another class during a run is therefore never deleted
-- while enrolled.

-- ------------------------------------------------------ set_archived_at
create function public.set_archived_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.archived_at is not null
       and current_user not in ('postgres', 'supabase_admin', 'service_role') then
      new.archived_at := null;
    end if;
  elsif new.archived_at is distinct from old.archived_at then
    if new.archived_at is null then
      null; -- un-archive
    elsif old.archived_at is null then
      new.archived_at := now();
    else
      new.archived_at := old.archived_at;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_archived_at() from public, anon, authenticated;

create trigger classes_set_archived_at
  before insert or update of archived_at on public.classes
  for each row execute function public.set_archived_at();

-- ---------------------------------------------------------- purge_classes
-- Same as 20261201000600_retention.sql except the students lock.
create or replace function public.purge_classes(p_classes uuid[])
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_classes uuid[];
  v_students uuid[];
begin
  -- Lock the classes so nobody enrols or assigns while they are removed.
  select coalesce(array_agg(l.id), '{}') into v_classes
    from (select c.id from public.classes c where c.id = any(p_classes) for update) l;
  if cardinality(v_classes) = 0 then
    return 0;
  end if;

  select coalesce(array_agg(distinct e.student_id), '{}') into v_students
    from public.enrolments e where e.class_id = any(v_classes);

  -- Lock the candidate students (in a fixed order) so a concurrent join cannot slip
  -- between the "no enrolment left" check and the delete.
  perform 1 from public.students s
    where s.user_id = any(v_students)
    order by s.user_id
    for update;

  -- attempts.assignment_id is ON DELETE RESTRICT: remove the class's attempts first.
  delete from public.attempts t
   using public.assignments a
   where t.assignment_id = a.id and a.class_id = any(v_classes);

  -- Cascades to assignments and enrolments.
  delete from public.classes c where c.id = any(v_classes);

  -- Card students with no class left: delete the auth user (cascades to students,
  -- enrolments, attempts, mastery; and to auth identities, sessions, refresh tokens).
  delete from auth.users u
   using public.students s
   where s.user_id = u.id
     and s.user_id = any(v_students)
     and s.created_via = 'card'
     and not exists (select 1 from public.enrolments e where e.student_id = s.user_id);

  -- Google students with no class left: delete the classroom record only.
  delete from public.students s
   where s.user_id = any(v_students)
     and s.created_via = 'google'
     and not exists (select 1 from public.enrolments e where e.student_id = s.user_id);

  return cardinality(v_classes);
end;
$$;

revoke execute on function public.purge_classes(uuid[]) from public, anon, authenticated, service_role;
