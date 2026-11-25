-- Card identity (R10) and class write grants (R11).
--
-- R10: a card student is marked by app_metadata.umbra_card = true, which only the
-- service role can set (POST /api/class-cards passes it to auth.admin.createUser).
-- The email suffix alone proves nothing, because anyone can sign up with any email:
--   * a new or changed auth user with a …@students.umbra.invalid email is refused
--     unless it carries the card flag, so public sign-up to that domain fails;
--   * enrol_student derives created_via from the flag, not from the email suffix.
--
-- Why the refusal is a deferred constraint trigger and not a raise in handle_new_user:
-- GoTrue's admin createUser inserts the auth.users row first and writes app_metadata
-- with a second UPDATE in the same transaction. At insert time the flag is never
-- there, so an insert-time check also blocks the service role (checked against the
-- local stack: "Database error creating new user"). The deferred check runs at commit
-- and re-reads the row, so it sees the flag the service role set.
--
-- R11: classes are created only through create_class (code generation, created_by),
-- and clients may update only name, year_group and archived_at.

-- ------------------------------------------------------- handle_new_user
-- Unchanged from Task 5 apart from the case-insensitive match: no profiles row (so no
-- email) for a synthetic-domain user. The refusal is guard_card_email below.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) like '%@students.umbra.invalid' then
    return new; -- card student: no profiles row, so no email is stored
  end if;
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------ guard_card_email
create function public.guard_card_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_meta jsonb;
begin
  -- NEW is the row as first written; read the committed-to-be version.
  select u.email, u.raw_app_meta_data into v_email, v_meta
    from auth.users u where u.id = new.id;
  if not found then
    return null; -- deleted later in the same transaction
  end if;
  if lower(v_email) like '%@students.umbra.invalid'
     and coalesce(v_meta->>'umbra_card', '') <> 'true' then
    raise exception 'reserved_email_domain' using errcode = '42501';
  end if;
  return null;
end;
$$;

revoke execute on function public.guard_card_email() from public, anon, authenticated;

drop trigger if exists guard_card_email on auth.users;
create constraint trigger guard_card_email
  after insert or update of email, raw_app_meta_data on auth.users
  deferrable initially deferred
  for each row execute function public.guard_card_email();

-- --------------------------------------------------------- enrol_student
-- Same as the Task 5 version except created_via: 'card' only when the auth user
-- carries app_metadata.umbra_card = true.
create or replace function public.enrol_student(p_class uuid, p_user uuid, p_name text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_card boolean;
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

  select coalesce(u.raw_app_meta_data->>'umbra_card', '') = 'true' into v_card
    from auth.users u where u.id = p_user;
  if not found then
    raise exception 'unknown_user';
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

-- create or replace keeps the existing grants; restate them so this file stands alone.
revoke execute on function public.enrol_student(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.enrol_student(uuid, uuid, text) to service_role;

-- ------------------------------------------------------- classes grants
drop policy if exists "staff insert classes" on public.classes;
revoke insert, update on public.classes from authenticated;
grant update (name, year_group, archived_at) on public.classes to authenticated;
