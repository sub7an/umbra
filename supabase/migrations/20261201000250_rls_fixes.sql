-- Umbra for Schools: RLS fix round 1.

-- 1. Deleting an assignment used to null attempts.assignment_id (on delete set null),
--    turning school work into "free practice" that staff of every school the student
--    is enrolled in can see (breaks Review Focus 4). Keep the link: an assignment with
--    attempts cannot be deleted. Assignments with no attempts can still be deleted.
alter table public.attempts drop constraint attempts_assignment_id_fkey;
alter table public.attempts add constraint attempts_assignment_id_fkey
  foreign key (assignment_id) references public.assignments on delete restrict;

-- 2. Baseline bug: authenticated could update every column of its own profiles row,
--    including is_pro and stripe_customer_id (free Pro). Billing columns are written
--    only by the Stripe webhook with the service role.
--    The client only does `upsert({ id }, { ignoreDuplicates: true })`
--    (INSERT (id) ... ON CONFLICT DO NOTHING) and selects, so insert is limited to id.
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant insert (id) on public.profiles to authenticated;
grant update (xp, progress, updated_at) on public.profiles to authenticated;
grant all on public.profiles to service_role;
