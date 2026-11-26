-- Final review, ruling R32: new schools wait for approval.
--
-- Anyone signed in with Google can call create_school. Until now the school it made
-- was immediately a working 'pilot' school, so a stranger could open classes and enrol
-- students under Umbra's name with no agreement in place. Now:
--   * schools.plan gains 'pending'; create_school inserts plan = 'pending';
--   * enrol_student (and so join_class) and enrol_card_student refuse a class whose
--     school is pending ('school_pending');
--   * create_class still works, so a teacher can prepare classes while waiting.
-- Approval is a service-role / SQL step: update public.schools set plan = 'pilot'
-- where id = ...; (admin tooling comes in Phase 5). The column default stays 'pilot'
-- for rows inserted directly by the service role (seed, admin tools).

alter table public.schools drop constraint schools_plan_check;
alter table public.schools
  add constraint schools_plan_check check (plan in ('pending','pilot','classroom','lapsed'));

-- --------------------------------------------------------- enrol_student
-- Same as 20261201000460_card_school.sql except the school_pending check.
create or replace function public.enrol_student(p_class uuid, p_user uuid, p_name text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_card boolean;
  v_archived timestamptz;
  v_school uuid;
  v_card_school uuid;
  v_plan text;
begin
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_display_name';
  end if;

  select c.archived_at, c.school_id, sc.plan into v_archived, v_school, v_plan
    from public.classes c join public.schools sc on sc.id = c.school_id
   where c.id = p_class;
  if not found then
    raise exception 'invalid_code';
  end if;
  if v_archived is not null then
    raise exception 'class_archived';
  end if;
  if v_plan = 'pending' then
    raise exception 'school_pending';
  end if;

  select coalesce(u.raw_app_meta_data->>'umbra_card', '') = 'true' into v_card
    from auth.users u where u.id = p_user;
  if not found then
    raise exception 'unknown_user';
  end if;

  if v_card then
    select s.card_school_id into v_card_school from public.students s where s.user_id = p_user;
    if v_card_school is not null and v_card_school is distinct from v_school then
      raise exception 'card_school_only';
    end if;
  end if;

  insert into public.students as s (user_id, display_name, created_via)
  values (p_user, v_name, case when v_card then 'card' else 'google' end)
  on conflict (user_id) do nothing;

  insert into public.enrolments as e (class_id, student_id)
  values (p_class, p_user)
  on conflict (class_id, student_id) do nothing;

  -- No student email in public.*.
  update public.profiles p set email = null where p.id = p_user and p.email is not null;
end;
$$;

revoke execute on function public.enrol_student(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.enrol_student(uuid, uuid, text) to service_role;

-- ---------------------------------------------------- enrol_card_student
-- Same as 20261201000460_card_school.sql except the school_pending check (made under
-- the same school row lock as the seat count).
create or replace function public.enrol_card_student(p_class uuid, p_user uuid, p_name text, p_username text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_card boolean;
  v_school uuid;
  v_seats int;
  v_used int;
  v_plan text;
begin
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_display_name';
  end if;
  if p_username is null or p_username !~ '^[a-z0-9]{1,12}-[0-9]{4}$' then
    raise exception 'invalid_username';
  end if;

  select coalesce(u.raw_app_meta_data->>'umbra_card', '') = 'true' into v_card
    from auth.users u where u.id = p_user;
  if not found then
    raise exception 'unknown_user';
  end if;
  if not v_card then
    raise exception 'not_card_user';
  end if;

  select c.school_id into v_school from public.classes c where c.id = p_class;
  if not found then
    raise exception 'invalid_code';
  end if;

  select sc.seats, sc.plan into v_seats, v_plan from public.schools sc where sc.id = v_school for update;
  if v_plan = 'pending' then
    raise exception 'school_pending';
  end if;
  select count(*) into v_used from public.students s
    where s.card_school_id = v_school and s.user_id <> p_user;
  if v_used >= v_seats then
    raise exception 'seat_limit';
  end if;

  insert into public.students as s (user_id, display_name, created_via, username, card_school_id)
  values (p_user, v_name, 'card', p_username, v_school)
  on conflict (user_id) do nothing;

  perform public.enrol_student(p_class, p_user, v_name);
end;
$$;

revoke execute on function public.enrol_card_student(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.enrol_card_student(uuid, uuid, text, text) to service_role;

-- --------------------------------------------------------- create_school
-- Same as 20261201000460_card_school.sql except new schools start as 'pending'.
create or replace function public.create_school(p_name text, p_country text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name';
  end if;
  if p_country is null or btrim(p_country) = '' then
    raise exception 'invalid_country';
  end if;
  if (select count(*) from public.staff s where s.user_id = v_uid and s.role = 'admin') >= 3 then
    raise exception 'school_limit';
  end if;

  insert into public.schools (name, country, plan)
  values (btrim(p_name), btrim(p_country), 'pending')
  returning id into v_school;

  insert into public.staff (user_id, school_id, role)
  values (v_uid, v_school, 'admin');

  return v_school;
end;
$$;

revoke execute on function public.create_school(text, text) from public, anon;
grant execute on function public.create_school(text, text) to authenticated;
