-- Fix round 1 for Task 6 (security review).
--
-- R14: a card student belongs to the school that issued the card. Without this, any
-- Google user could create a school (create_school), get a card student to type their
-- class code (join_class), then reset the student's passphrase through PATCH
-- /api/class-cards as "staff of a school the student is enrolled in" and take over the
-- account. Now:
--   * students.card_school_id records the issuing school (null for Google students);
--   * enrol_card_student (service role only) creates the card student's row with
--     username and card_school_id, then enrols, all in one transaction;
--   * enrol_student (and so join_class) refuses to enrol a card user in a class of any
--     other school (card_school_only);
--   * the API lets only staff of card_school_id reset a card passphrase.
-- R15: revoke_user_sessions deletes a user's auth sessions after a reset; refresh
--   tokens and MFA claims cascade from auth.sessions (session_id ... on delete cascade).
-- R16: card students per school are capped at schools.seats (seat_limit), and a user
--   may be admin of at most 3 schools (school_limit).

alter table public.students
  add column card_school_id uuid references public.schools on delete set null;
create index students_card_school_idx on public.students (card_school_id);

-- --------------------------------------------------------- enrol_student
-- Same as 20261201000450 except the card_school_only check.
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
begin
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_display_name';
  end if;

  select c.archived_at, c.school_id into v_archived, v_school from public.classes c where c.id = p_class;
  if not found then
    raise exception 'invalid_code';
  end if;
  if v_archived is not null then
    raise exception 'class_archived';
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
-- Service role only (POST /api/class-cards). Locks the school row so concurrent card
-- creation cannot overshoot the seat cap.
create function public.enrol_card_student(p_class uuid, p_user uuid, p_name text, p_username text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_card boolean;
  v_school uuid;
  v_seats int;
  v_used int;
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

  select sc.seats into v_seats from public.schools sc where sc.id = v_school for update;
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

-- -------------------------------------------------- revoke_user_sessions
create function public.revoke_user_sessions(p_user uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from auth.sessions s where s.user_id = p_user;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- --------------------------------------------------------- create_school
-- Same as 20261201000400 except the school_limit check.
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

  insert into public.schools (name, country)
  values (btrim(p_name), btrim(p_country))
  returning id into v_school;

  insert into public.staff (user_id, school_id, role)
  values (v_uid, v_school, 'admin');

  return v_school;
end;
$$;

revoke execute on function public.create_school(text, text) from public, anon;
grant execute on function public.create_school(text, text) to authenticated;
