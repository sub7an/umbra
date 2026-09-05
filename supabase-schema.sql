-- Umbra — Supabase schema. Run this in the Supabase SQL Editor (once).
-- Creates a `profiles` row per auth user, tracks Pro status + XP, and locks
-- it down with row-level security so users can only read/update their own row.
-- The Stripe webhook writes with the service-role key, which bypasses RLS.

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  is_pro             boolean not null default false,
  stripe_customer_id text,
  xp                 integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Users can insert their own profile row (the app upserts on login).
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Users can update their own profile — but NOT is_pro / stripe_customer_id
-- (those are set only by the Stripe webhook via the service-role key).
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
