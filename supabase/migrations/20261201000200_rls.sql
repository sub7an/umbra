-- Umbra for Schools: row-level security for the classroom tables.
--
-- Model:
--   * Staff (teachers/admins) see data of the schools they are staff of.
--   * Students see their own rows, plus the classes/assignments they are enrolled in.
--   * Catalogue tables (topics, syllabus_map, items) are public read.
--   * item_keys (answers/solutions) are never readable by clients: no grants, no policies.
--   * attempts and mastery are written only by the service role (no client write grants).
--
-- Privileges are explicit: every table first has all client privileges revoked, then
-- only what the policies need is granted back. Supabase default privileges are not relied on.
--
-- Cross-table checks go through security definer helpers. They run as the owner (which
-- bypasses RLS), so a policy never re-enters RLS on another protected table and cannot recurse.

-- ------------------------------------------------------------------ follow-ups from Task 2

create index attempts_item_idx on public.attempts (item_id);
create index mastery_topic_idx on public.mastery (topic_id);

alter table public.classes drop constraint classes_created_by_fkey;
alter table public.classes add constraint classes_created_by_fkey
  foreign key (created_by) references auth.users on delete set null;

alter table public.assignments drop constraint assignments_created_by_fkey;
alter table public.assignments add constraint assignments_created_by_fkey
  foreign key (created_by) references auth.users on delete set null;

-- ------------------------------------------------------------------ helpers

-- Caller is staff of the given school.
create function public.is_school_staff(p_school uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid())
  );
$$;

-- Caller is staff of a school with a class the student is enrolled in.
create function public.teaches_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.enrolments e
    join public.classes c on c.id = e.class_id
    join public.staff s on s.school_id = c.school_id
    where e.student_id = p_student and s.user_id = (select auth.uid())
  );
$$;

-- Caller is staff of the school that owns the given class.
create function public.is_class_staff(p_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.staff s on s.school_id = c.school_id
    where c.id = p_class and s.user_id = (select auth.uid())
  );
$$;

-- Caller (a student) is enrolled in the given class.
create function public.is_enrolled_in_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrolments e
    where e.class_id = p_class and e.student_id = (select auth.uid())
  );
$$;

-- Staff visibility of one attempt (Review Focus 4):
--   the caller teaches the student, AND
--   either the attempt's assignment belongs to a class of a school the caller is staff of,
--   or the attempt has no assignment (free practice) and the student is enrolled in a
--   class of the caller's school (which teaches_student already guarantees).
create function public.can_staff_see_attempt(p_student uuid, p_assignment uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.teaches_student(p_student)
    and (
      p_assignment is null
      or exists (
        select 1
        from public.assignments a
        join public.classes c on c.id = a.class_id
        join public.staff s on s.school_id = c.school_id
        where a.id = p_assignment and s.user_id = (select auth.uid())
      )
    );
$$;

revoke execute on function public.is_school_staff(uuid) from public, anon;
revoke execute on function public.teaches_student(uuid) from public, anon;
revoke execute on function public.is_class_staff(uuid) from public, anon;
revoke execute on function public.is_enrolled_in_class(uuid) from public, anon;
revoke execute on function public.can_staff_see_attempt(uuid, uuid) from public, anon;
grant execute on function public.is_school_staff(uuid) to authenticated;
grant execute on function public.teaches_student(uuid) to authenticated;
grant execute on function public.is_class_staff(uuid) to authenticated;
grant execute on function public.is_enrolled_in_class(uuid) to authenticated;
grant execute on function public.can_staff_see_attempt(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ privileges

revoke all on
  public.schools, public.staff, public.classes, public.students, public.enrolments,
  public.topics, public.syllabus_map, public.items, public.item_keys,
  public.assignments, public.attempts, public.mastery
from public, anon, authenticated;

grant all on
  public.schools, public.staff, public.classes, public.students, public.enrolments,
  public.topics, public.syllabus_map, public.items, public.item_keys,
  public.assignments, public.attempts, public.mastery
to service_role;

grant select on public.topics, public.syllabus_map, public.items to anon, authenticated;
grant select on public.schools, public.staff, public.students, public.enrolments,
  public.attempts, public.mastery to authenticated;
grant select, insert, update on public.classes to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
-- item_keys: nothing for anon/authenticated.
-- attempts, mastery: select only; inserts/updates/deletes are service role only.

-- ------------------------------------------------------------------ enable RLS

alter table public.schools enable row level security;
alter table public.staff enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.enrolments enable row level security;
alter table public.topics enable row level security;
alter table public.syllabus_map enable row level security;
alter table public.items enable row level security;
alter table public.item_keys enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.mastery enable row level security;

-- ------------------------------------------------------------------ policies

-- schools: staff see their own school.
create policy "staff select own school" on public.schools
  for select to authenticated
  using (public.is_school_staff(id));

-- staff: staff see the staff rows of their schools.
create policy "staff select own school staff" on public.staff
  for select to authenticated
  using (public.is_school_staff(school_id));

-- classes: staff manage classes of their school; students see classes they are in.
create policy "staff select classes" on public.classes
  for select to authenticated
  using (public.is_school_staff(school_id));
create policy "staff insert classes" on public.classes
  for insert to authenticated
  with check (public.is_school_staff(school_id));
create policy "staff update classes" on public.classes
  for update to authenticated
  using (public.is_school_staff(school_id))
  with check (public.is_school_staff(school_id));
create policy "student select enrolled classes" on public.classes
  for select to authenticated
  using (public.is_enrolled_in_class(id));

-- students: self, or staff who teach them.
create policy "student select self" on public.students
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "staff select taught students" on public.students
  for select to authenticated
  using (public.teaches_student(user_id));

-- enrolments: self, or staff of the class's school.
create policy "student select own enrolments" on public.enrolments
  for select to authenticated
  using (student_id = (select auth.uid()));
create policy "staff select class enrolments" on public.enrolments
  for select to authenticated
  using (public.is_class_staff(class_id));

-- catalogue: public read.
create policy "public read topics" on public.topics
  for select to anon, authenticated using (true);
create policy "public read syllabus_map" on public.syllabus_map
  for select to anon, authenticated using (true);
create policy "public read items" on public.items
  for select to anon, authenticated using (true);

-- item_keys: RLS on, no policies, no grants. Service role only.

-- assignments: staff of the class's school manage; enrolled students read.
create policy "staff manage assignments" on public.assignments
  for all to authenticated
  using (public.is_class_staff(class_id))
  with check (public.is_class_staff(class_id));
create policy "student select enrolled assignments" on public.assignments
  for select to authenticated
  using (public.is_enrolled_in_class(class_id));

-- attempts: read only. Student sees own; staff per can_staff_see_attempt.
create policy "student select own attempts" on public.attempts
  for select to authenticated
  using (student_id = (select auth.uid()));
create policy "staff select attempts" on public.attempts
  for select to authenticated
  using (public.can_staff_see_attempt(student_id, assignment_id));

-- mastery: read only. Student sees own; staff who teach them.
create policy "student select own mastery" on public.mastery
  for select to authenticated
  using (student_id = (select auth.uid()));
create policy "staff select taught mastery" on public.mastery
  for select to authenticated
  using (public.teaches_student(student_id));
