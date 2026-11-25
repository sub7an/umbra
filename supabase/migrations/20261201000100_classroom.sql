-- Umbra for Schools: classroom schema. RLS lives in the next migration.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  dpa_signed_at timestamptz,
  plan text not null default 'pilot' check (plan in ('pilot','classroom','lapsed')),
  seats int not null default 150,
  created_at timestamptz default now()
);

create table public.staff (
  user_id uuid references auth.users on delete cascade,
  school_id uuid references public.schools on delete cascade,
  role text not null check (role in ('teacher','admin')),
  primary key (user_id, school_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools on delete cascade,
  name text not null,
  syllabus text not null check (syllabus in ('aqa','ocr_a','edexcel','ib','cie')),
  year_group text,
  code char(6) unique not null,
  archived_at timestamptz,
  created_by uuid references auth.users
);

create table public.students (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_via text not null check (created_via in ('google','card')),
  username text unique
);

create table public.enrolments (
  class_id uuid references public.classes on delete cascade,
  student_id uuid references public.students(user_id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, student_id)
);

create table public.topics (
  id text primary key,
  title text not null,
  parent_id text references public.topics
);

create table public.syllabus_map (
  topic_id text references public.topics,
  syllabus text,
  spec_ref text,
  primary key (topic_id, syllabus, spec_ref)
);

create table public.items (
  id text primary key,
  version int not null,
  kind text not null,
  topic_ids text[] not null,
  difficulty int not null check (difficulty between 1 and 5),
  public jsonb not null -- stem, parts, sim_preset
);

create table public.item_keys (
  item_id text primary key references public.items on delete cascade,
  version int not null,
  private jsonb not null -- key, solution, wrong_answers
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  title text not null,
  item_ids text[] not null,
  opens_at timestamptz default now(),
  due_at timestamptz,
  created_by uuid references auth.users
);

-- id has no default: the client supplies attempt_id so retries are idempotent.
create table public.attempts (
  id uuid primary key,
  student_id uuid not null references public.students(user_id) on delete cascade,
  item_id text not null references public.items,
  part_id text not null,
  assignment_id uuid references public.assignments on delete set null,
  response text not null,
  correct boolean not null,
  reason text not null,
  hints_used int not null default 0,
  time_ms int,
  created_at timestamptz default now()
);

create table public.mastery (
  student_id uuid references public.students(user_id) on delete cascade,
  topic_id text references public.topics,
  p_known real not null,
  review_step int not null default 0,
  last_seen timestamptz not null,
  next_review_at timestamptz,
  primary key (student_id, topic_id)
);

alter table public.profiles add column progress jsonb not null default '{}'::jsonb;

-- Indexes for FK lookups and the RLS checks that follow.
create index attempts_student_created_idx on public.attempts (student_id, created_at);
create index attempts_assignment_idx on public.attempts (assignment_id);
create index enrolments_student_idx on public.enrolments (student_id);
create index classes_school_idx on public.classes (school_id);
create index staff_school_idx on public.staff (school_id);
create index assignments_class_idx on public.assignments (class_id);
