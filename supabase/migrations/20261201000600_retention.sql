-- Data retention (Task 12). Makes the retention claims in the DPA template, the DPIA
-- (docs/legal/dpia.md) and the privacy notice (/privacy) true:
--
--   * 12 months after a class is archived, the class and everything that hangs off it
--     is deleted: its assignments, its enrolments, and every attempt made on its
--     assignments;
--   * a card student (an account the school created) left with no class at all is
--     deleted completely, auth user included, because the account exists only for the
--     school;
--   * a Google-signed-in student left with no class loses their classroom record
--     (public.students, so their remaining attempts and mastery go too). Their own
--     Google sign-in account (auth.users, and the profiles row with its email already
--     nulled on joining) is theirs, not the school's, so it is kept.
--
-- attempts.assignment_id is ON DELETE RESTRICT (20261201000250_rls_fixes.sql), so the
-- class cannot simply be deleted: the attempts on its assignments go first.
--
-- purge_classes(uuid[]) is also the end-of-contract procedure: to delete a school's
-- classroom data, an Umbra admin runs it over all of that school's classes (see the
-- DPIA, "Deletion procedures").
--
-- Neither function is callable by anon, authenticated or service_role. pg_cron runs
-- the daily job as the role that scheduled it (postgres).

-- ---------------------------------------------------------- purge_classes
create function public.purge_classes(p_classes uuid[])
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

  -- attempts.assignment_id is ON DELETE RESTRICT: remove the class's attempts first.
  delete from public.attempts t
   using public.assignments a
   where t.assignment_id = a.id and a.class_id = any(v_classes);

  -- Cascades to assignments and enrolments.
  delete from public.classes c where c.id = any(v_classes);

  -- Card students with no class left: delete the auth user. That cascades to
  -- public.students and from there to enrolments, attempts and mastery, and in auth to
  -- identities, sessions and refresh tokens.
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

-- ------------------------------------------------- purge_archived_classes
create function public.purge_archived_classes()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return public.purge_classes(array(
    select c.id from public.classes c
     where c.archived_at is not null
       and c.archived_at < now() - interval '12 months'
  ));
end;
$$;

revoke execute on function public.purge_archived_classes() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- schedule
-- Daily at 03:17 UTC. pg_cron is available on Supabase (hosted and local). If it is
-- missing, the functions still exist and the schedule is skipped with a notice.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-archived-classes', '17 3 * * *',
                          'select public.purge_archived_classes()');
  else
    raise notice 'pg_cron not available: purge_archived_classes() is not scheduled';
  end if;
end;
$$;
