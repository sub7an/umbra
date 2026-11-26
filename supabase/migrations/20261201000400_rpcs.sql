-- School, class and join RPCs.
--
-- staff and schools have no client insert grant, so creating them goes through these
-- security-definer functions. Every function pins search_path to '' and fully qualifies
-- names, so a caller cannot shadow a table or function.
--
-- No student email in public.*: card students get a synthetic auth email
-- (…@students.umbra.invalid) and handle_new_user no longer copies it into profiles;
-- Google students have profiles.email nulled when they join a class.

-- ------------------------------------------------------- handle_new_user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email like '%@students.umbra.invalid' then
    return new; -- card student: no profiles row, so no email is stored
  end if;
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------- create_school
create function public.create_school(p_name text, p_country text)
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

  insert into public.schools (name, country)
  values (btrim(p_name), btrim(p_country))
  returning id into v_school;

  insert into public.staff (user_id, school_id, role)
  values (v_uid, v_school, 'admin');

  return v_school;
end;
$$;

-- ------------------------------------------------------- normalise_code
-- Upper-cases and strips whitespace. Maps no characters: the alphabet has no
-- O, I, L, 0 or 1, so such characters make join_class raise invalid_code.
create function public.normalise_code(p text)
returns text
language sql immutable security definer set search_path = ''
as $$
  select upper(regexp_replace(p, '\s', '', 'g'));
$$;

-- ---------------------------------------------------------- create_class
-- Code: 6 characters from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (31 symbols), drawn from
-- pgcrypto random bytes with rejection sampling (bytes >= 248 = 8*31 are discarded),
-- so there is no modulo bias. Retried on a unique-code collision, at most 10 times.
create function public.create_class(p_school uuid, p_name text, p_syllabus text, p_year text)
returns table (id uuid, code text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_byte int;
  v_attempt int := 0;
begin
  if v_uid is null or not exists (
    select 1 from public.staff s where s.user_id = v_uid and s.school_id = p_school
  ) then
    raise exception 'not_staff';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    while length(v_code) < 6 loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      if v_byte < 248 then
        v_code := v_code || substr(c_alphabet, (v_byte % 31) + 1, 1);
      end if;
    end loop;

    begin
      insert into public.classes as c (school_id, name, syllabus, year_group, code, created_by)
      values (p_school, btrim(p_name), p_syllabus, nullif(btrim(p_year), ''), v_code, v_uid)
      returning c.id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception 'code_generation_failed';
      end if;
    end;
  end loop;

  id := v_id;
  code := v_code;
  return next;
end;
$$;

-- --------------------------------------------------------- enrol_student
-- Service role only (Task 6 uses it for card students). join_class calls it for the
-- signed-in user.
--
-- Re-joining is idempotent: an existing students row is kept unchanged (its
-- display_name and created_via are not overwritten; renaming is a separate action),
-- and a duplicate enrolment is ignored.
create function public.enrol_student(p_class uuid, p_user uuid, p_name text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_email text;
  v_archived timestamptz;
begin
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_display_name';
  end if;

  select c.archived_at into v_archived from public.classes c where c.id = p_class;
  if not found then
    raise exception 'invalid_code';
  end if;
  if v_archived is not null then
    raise exception 'class_archived';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user;
  if not found then
    raise exception 'unknown_user';
  end if;

  insert into public.students as s (user_id, display_name, created_via)
  values (
    p_user,
    v_name,
    case when v_email like '%@students.umbra.invalid' then 'card' else 'google' end
  )
  on conflict (user_id) do nothing;

  insert into public.enrolments as e (class_id, student_id)
  values (p_class, p_user)
  on conflict (class_id, student_id) do nothing;

  -- No student email in public.*.
  update public.profiles p set email = null where p.id = p_user and p.email is not null;
end;
$$;

-- ------------------------------------------------------------ join_class
create function public.join_class(p_code text, p_display_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := public.normalise_code(p_code);
  v_class uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_code is null or v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_code';
  end if;

  select c.id into v_class from public.classes c where c.code = v_code;
  if not found then
    raise exception 'invalid_code';
  end if;

  perform public.enrol_student(v_class, v_uid, p_display_name);
  return v_class;
end;
$$;

-- --------------------------------------------------------------- grants
revoke execute on function public.create_school(text, text) from public, anon;
revoke execute on function public.create_class(uuid, text, text, text) from public, anon;
revoke execute on function public.normalise_code(text) from public, anon;
revoke execute on function public.join_class(text, text) from public, anon;
revoke execute on function public.enrol_student(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_school(text, text) to authenticated;
grant execute on function public.create_class(uuid, text, text, text) to authenticated;
grant execute on function public.normalise_code(text) to authenticated;
grant execute on function public.join_class(text, text) to authenticated;
grant execute on function public.enrol_student(uuid, uuid, text) to service_role;
