# Phase 1: Classroom Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher signs in, creates a school and class, issues student login cards and assigns items. Students answer, answers are checked server-side, and the teacher sees mastery update live. Pilots start at week 9 with a template legal pack.

**Architecture:**
- **Data:** Supabase migrations define school, class, student, item, attempt and mastery tables, all under row-level security. Answer keys sit in `item_keys`, which only the service role can read.
- **Server:** `api/check` (service role) grades answers and writes attempts. A Postgres trigger runs Bayesian Knowledge Tracing per topic. `api/class-cards` issues and resets student logins.
- **UI:** in the `/teach`, `/learn` and `/join` areas from Phase 0.

**Tech Stack:**
- Supabase (Postgres 15, RLS, pgTAP via `supabase test db`, local stack via `supabase start`);
- Vercel functions;
- React 19;
- `@supabase/supabase-js` 2.115;
- Vitest;
- Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-umbra-schools-platform-design.md` §6.1, §5, §7 phase 1. Roadmap: `2026-11-25-umbra-schools-roadmap.md`. Depends on Phase 0 Tasks 1, 2, 9 and 10.

## Global Constraints

See the roadmap. The ones that bite this phase:
- No student email stored anywhere in `public.*`.
- `item_keys` must never be readable by `anon` or `authenticated`.
- Attempts are written only by the service role (students cannot forge `correct`).
- No `Co-Authored-By` in commits.

## Review Focus

1. **Class codes typed carelessly** (lower case, spaces, ambiguous characters O/0, I/1) must still join, or fail with a clear message. Test in Task 5 (`normalise_code`) and Task 7 (UI).
2. **A teacher removed from `staff`** loses access to that school's attempts immediately. Test in Task 3 (pgTAP).
3. **Double submit or a network retry** of the same answer creates one attempt, not two. The client sends an `attempt_id` uuid and `api/check` upserts. Test in Task 8.
4. **A student enrolled in two classes from different schools** is visible to each school's teachers only for that school's assignments. Test in Task 3.
5. **A Google-signed-in student's email** is null in `profiles` after joining. Test in Task 5 (pgTAP).

---

### Task 1: Local Supabase + baseline migration

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/20261201000000_baseline.sql` (the exact contents of today's `supabase-schema.sql`)
- Modify: `supabase-schema.sql` (replace its body with one comment pointing to `supabase/migrations/`)
- Create: `supabase/seed.sql` (empty for now)

- [ ] **Step 1: Run `supabase init` (accept the defaults) and `supabase start`.** Expected: the local API URL and keys are printed.
- [ ] **Step 2: Copy the schema into the baseline migration. Run `supabase db reset`.** Expected: "Finished supabase db reset", and `profiles` exists (`supabase db dump --local --schema public | grep "create table.*profiles"`).
- [ ] **Step 3: Confirm the hosted project's migration history.** Run `supabase link`, then `supabase migration list`. If the remote shows no history, mark the baseline as applied with `supabase migration repair --status applied 20261201000000`. **Ask the user before running any command against the hosted project.**
- [ ] **Step 4: Commit** `chore(db): supabase migrations with baseline schema`.

### Task 2: Classroom schema

**Files:**
- Create: `supabase/migrations/20261201000100_classroom.sql`
- Test: `supabase/tests/schema_test.sql`

**Interfaces (tables, exact columns):**
```
schools(id uuid pk default gen_random_uuid(), name text not null, country text not null, dpa_signed_at timestamptz, plan text not null default 'pilot' check (plan in ('pilot','classroom','lapsed')), seats int not null default 150, created_at timestamptz default now())
staff(user_id uuid references auth.users on delete cascade, school_id uuid references schools on delete cascade, role text not null check (role in ('teacher','admin')), primary key (user_id, school_id))
classes(id uuid pk, school_id uuid not null references schools on delete cascade, name text not null, syllabus text not null check (syllabus in ('aqa','ocr_a','edexcel','ib','cie')), year_group text, code char(6) unique not null, archived_at timestamptz, created_by uuid references auth.users)
students(user_id uuid pk references auth.users on delete cascade, display_name text not null check (char_length(display_name) between 1 and 40), created_via text not null check (created_via in ('google','card')), username text unique)
enrolments(class_id uuid references classes on delete cascade, student_id uuid references students(user_id) on delete cascade, joined_at timestamptz default now(), primary key (class_id, student_id))
topics(id text pk, title text not null, parent_id text references topics)
syllabus_map(topic_id text references topics, syllabus text, spec_ref text, primary key (topic_id, syllabus, spec_ref))
items(id text pk, version int not null, kind text not null, topic_ids text[] not null, difficulty int not null check (difficulty between 1 and 5), public jsonb not null)   -- stem, parts, sim_preset
item_keys(item_id text pk references items on delete cascade, version int not null, private jsonb not null)               -- key, solution, wrong_answers
assignments(id uuid pk, class_id uuid not null references classes on delete cascade, title text not null, item_ids text[] not null, opens_at timestamptz default now(), due_at timestamptz, created_by uuid references auth.users)
attempts(id uuid pk, student_id uuid not null references students(user_id) on delete cascade, item_id text not null references items, part_id text not null, assignment_id uuid references assignments on delete set null, response text not null, correct boolean not null, reason text not null, hints_used int not null default 0, time_ms int, created_at timestamptz default now())
mastery(student_id uuid references students(user_id) on delete cascade, topic_id text references topics, p_known real not null, review_step int not null default 0, last_seen timestamptz not null, next_review_at timestamptz, primary key (student_id, topic_id))
```
- Add `alter table profiles add column progress jsonb not null default '{}'::jsonb` (used by Task 11).

- [ ] **Step 1: Write pgTAP `schema_test.sql`:** `has_table` for all 12 tables; `col_is_pk('attempts','id')`; `has_check('items')`. Run `supabase test db`. Expected: FAIL.
- [ ] **Step 2: Write the migration. Run `supabase db reset && supabase test db`.** Expected: PASS.
- [ ] **Step 3: Review with the `ecc:database-reviewer` agent** (indexes: `attempts(student_id, created_at)`, `attempts(assignment_id)`, `enrolments(student_id)`, `classes(school_id)`). Add any missing indexes in the same migration.
- [ ] **Step 4: Commit** `feat(db): classroom schema`.

### Task 3: Row-level security

**Files:**
- Create: `supabase/migrations/20261201000200_rls.sql`
- Test: `supabase/tests/rls_test.sql`

**Interfaces:**
- Produces two SQL helpers (`security definer`, `stable`):
  - `is_school_staff(p_school uuid) returns boolean`
  - `teaches_student(p_student uuid) returns boolean` (true when the caller is staff of a school with a class the student is enrolled in)

**Policies (exact):**
- `schools`: staff can select their own school.
- `staff`: select rows of own schools.
- `classes`: staff select/insert/update where `is_school_staff(school_id)`; students select classes they are enrolled in.
- `students`: self select; staff select where `teaches_student(user_id)`.
- `enrolments`: self select; staff select via the class.
- `topics`, `syllabus_map`, `items`: select to `anon, authenticated`.
- `item_keys`: RLS enabled, **no policies**; `revoke all on item_keys from anon, authenticated`.
- `assignments`: staff of the class's school manage; enrolled students select.
- `attempts`: student selects own; staff select where `teaches_student(student_id)` **and** the attempt's `assignment_id` belongs to a class of their school (or is null and the student is in their class); **no insert/update/delete policy** (service role only).
- `mastery`: student selects own; staff select where `teaches_student(student_id)`.

- [ ] **Step 1: Write `rls_test.sql`** using `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'`. Fixtures: schools A and B, teacher tA in A, tB in B, student s1 in a class of A, student s2 in classes of A and B, an attempt of s2 on an A assignment and one on a B assignment. Assertions:
  - tA sees s1's attempts; tB sees none of s1's.
  - tA sees s2's A attempt but not their B attempt (Review Focus 4).
  - s1 sees only own attempts.
  - `select * from item_keys` as authenticated throws `permission denied` (`throws_ok`).
  - Insert into attempts as s1 throws.
  - After `delete from staff where user_id = tA`, tA sees 0 attempts (Review Focus 2).
- [ ] **Step 2: Run `supabase test db`.** Expected: FAIL.
- [ ] **Step 3: Write the migration. Run `supabase db reset && supabase test db`.** Expected: PASS.
- [ ] **Step 4: Run the `ecc:security-reviewer` agent on the migration.** Fix findings.
- [ ] **Step 5: Commit** `feat(db): row-level security for schools, classes, attempts; item_keys locked`.

### Task 4: Mastery model (JS + SQL, same vectors)

**Files:**
- Create: `src/lib/mastery.js`, `src/lib/mastery.test.js`
- Create: `supabase/migrations/20261201000300_mastery.sql`
- Test: `supabase/tests/mastery_test.sql`

**Interfaces:**
- Produces:
  - `BKT = { prior:0.2, learn:0.15, slip:0.1, guess:{ choice:0.2, numeric:0.05, expression:0.05, order:0.2 }, hintGuess:0.5, mastered:0.95 }`
  - `bktUpdate(p:number, correct:boolean, guess:number, slip=0.1, learn=0.15): number`
  - `REVIEW_DAYS = [1,3,7,16,35]`
  - `nextReview(step:number, correct:boolean, p:number, now:Date): { step:number, at:Date|null }`. `at` is null until p ≥ 0.95. A correct review answer advances the step (capped at 4). A wrong one goes back one step (minimum 0).
- SQL: `bkt_update(p real, correct bool, guess real) returns real` and trigger `after insert on attempts for each row execute function update_mastery()`. The trigger updates the `mastery` row for every topic in `items.topic_ids`; when `hints_used > 0` it uses `hintGuess`.

- [ ] **Step 1: Failing JS tests with exact vectors:**
  - `bktUpdate(0.2, true, 0.2)` within 1e-4 of 0.6000;
  - `bktUpdate(0.2, false, 0.2)` within 1e-4 of 0.1758;
  - `bktUpdate(0.6, true, 0.05)` within 1e-4 of 0.9696 (posterior 0.54/0.56 = 0.96429, then + 0.03571 × 0.15);
  - `nextReview(0, true, 0.96, now).at` equals now + 1 day;
  - `nextReview(2, false, 0.97, now).step` equals 1.
- [ ] **Step 2: Run `npx vitest run src/lib/mastery.test.js`.** Expected: FAIL. Implement. Expected: PASS.
- [ ] **Step 3: Failing pgTAP:** `bkt_update(0.2, true, 0.2)` rounds to 0.6000 at 4 dp. Inserting a correct numeric attempt (as the service role) for a fresh student/topic creates `mastery.p_known` = 0.8455 at 4 dp (prior 0.2, guess 0.05: posterior 0.18/0.22 = 0.8182, then + 0.1818 × 0.15). The JS `bktUpdate(0.2, true, 0.05)` must return the same value to 1e-4. Add it to the JS test too.
- [ ] **Step 4: Write the migration. Run `supabase db reset && supabase test db`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(mastery): BKT per topic in JS and a Postgres trigger, shared vectors`.

### Task 5: School, class and join RPCs

**Files:**
- Create: `supabase/migrations/20261201000400_rpcs.sql`
- Modify: the `handle_new_user` trigger in the same migration: skip the insert when `new.email like '%@students.umbra.invalid'`
- Test: `supabase/tests/rpc_test.sql`

**Interfaces (all `security definer`, `set search_path = public`):**
- `create_school(p_name text, p_country text) returns uuid`: inserts the school, and the caller as `admin`.
- `create_class(p_school uuid, p_name text, p_syllabus text, p_year text) returns table(id uuid, code text)`: the caller must be staff. The code is 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, retried on collision.
- `normalise_code(p text) returns text`: upper-cases and strips whitespace. It maps no characters. The alphabet excludes O, I, L, 0 and 1, so any character outside it makes `join_class` raise `invalid_code`, and the UI explains "codes don't use O, I, L, 0 or 1".
- `enrol_student(p_class uuid, p_user uuid, p_name text) returns void`: **service role only** (`revoke execute … from anon, authenticated`). It does the same inserts as `join_class` for a given user. Used by Task 6.
- `join_class(p_code text, p_display_name text) returns uuid` (class id): normalises the code; errors `'invalid_code'` or `'class_archived'`; inserts `students` (`created_via` = 'card' when the email is synthetic, otherwise 'google'); inserts the enrolment; then `update profiles set email = null where id = auth.uid()`.

- [ ] **Step 1: Failing pgTAP:**
  - `create_school` makes the caller admin;
  - `create_class` returns a 6-character code matching `^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$`;
  - a non-staff caller of `create_class` throws;
  - `join_class(lower(' ' || code || ' '), 'Amira')` succeeds;
  - `join_class('OOOOOO', …)` throws `invalid_code`;
  - after a Google user joins, `profiles.email` is null (Review Focus 5);
  - inserting an auth user with a synthetic email creates no `profiles` row.
- [ ] **Step 2: Run** (expect FAIL) → **implement** → `supabase db reset && supabase test db` (expect PASS).
- [ ] **Step 3: Commit** `feat(db): school, class and join RPCs; no student emails in profiles`.

### Task 6: Student login cards API

**Files:**
- Create: `api/_lib/supabaseAdmin.js` (a service-role client from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, server-only env vars)
- Create: `api/_lib/auth.js` (`requireUser(req): Promise<{ user }>`, which verifies the `Authorization: Bearer` JWT with `admin.auth.getUser`)
- Create: `api/_lib/words.js` (the EFF short wordlist, 1296 words, CC BY 3.0, with attribution comment)
- Create: `api/class-cards.js`
- Test: `test/class-cards.test.js` (mocked admin client, following the pattern in `test/ai-proxy.test.js`)
- Modify: `vite.config.js` (serve `/api/class-cards` and `/api/check` locally, the same way `/api/ai` is served)

**Interfaces:**
- `makeUsername(displayName:string, taken:(u:string)=>Promise<boolean>): Promise<string>` → `${slug(first name, max 12)}-${4 digits}`
- `makePassphrase(rand=crypto.getRandomValues): string` → 3 words joined by `-`
- `POST /api/class-cards { class_id, names: string[] (1–60) }` → `201 { cards: [{ student_id, display_name, username, passphrase }] }`. The passphrase is returned once, never stored in plain text. Each card creates an auth user with `email = username + '@students.umbra.invalid'`, `email_confirm: true`, and calls `join_class` as that user (via a service-role RPC variant `enrol_student(p_class uuid, p_user uuid, p_name text)`, added to the Task 5 migration).
- `PATCH /api/class-cards { student_id }` → `200 { username, passphrase }` (reset).
- Both require the caller to be staff of the class's school (check via `is_school_staff`). Otherwise 403.

- [ ] **Step 1: Failing tests:**
  - `makeUsername('Amira Khan', async () => false)` matches `/^amira-\d{4}$/`;
  - `makePassphrase` yields 3 words, each in the wordlist;
  - POST by a non-staff user → 403;
  - POST with 61 names → 400;
  - a successful POST calls `admin.auth.admin.createUser` with an email ending `@students.umbra.invalid`, and never logs the passphrase (spy on `console`);
  - PATCH calls `updateUserById`.
- [ ] **Step 2: Run** `npx vitest run test/class-cards.test.js` (FAIL) → **implement** → run (PASS).
- [ ] **Step 3: Commit** `feat(api): student login cards (create and reset) with synthetic auth emails`.

### Task 7: Teacher and student UI (sign-in, school, classes, cards, join)

**Files:**
- Create:
  - `src/areas/teach/TeachHome.jsx` (school onboarding if no staff row; otherwise a list of classes);
  - `src/areas/teach/ClassPage.jsx` (roster, issue cards, printable cards view `@media print`);
  - `src/areas/join/JoinForm.jsx` (code + name with Google, or username + passphrase);
  - `src/lib/classroomApi.js` (thin wrappers: `createSchool`, `createClass`, `listClasses`, `issueCards`, `resetCard`, `joinClass`, `signInWithCard(username, passphrase)` → `supabase.auth.signInWithPassword({ email: username + '@students.umbra.invalid', password })`)
- Modify: `src/areas/TeachArea.jsx`, `src/areas/JoinArea.jsx` (render the above), `src/context/AuthContext.jsx` (expose `role: 'teacher'|'student'|'public'`)
- Create: `supabase/seed.sql` (local teacher `teacher@example.test` / password from `.env.local` `SEED_TEACHER_PASSWORD`, plus a school and class)
- Test: `tests/e2e/classroom.spec.js` (runs against local Supabase; `VITE_SUPABASE_URL` points at the local API)

- [ ] **Step 1: Design pass.** `ui-ux-pro-max` (`--design-system` for "teacher dashboard education", reuse the app's tokens) and `impeccable` for the onboarding and roster. Sketch in the browser before coding.
- [ ] **Step 2: Failing e2e:**
  - the teacher signs in with the seed user;
  - creates class "12P" (AQA);
  - issues cards for "Amira Khan" and "Ben Ode";
  - the printable view shows 2 cards;
  - in a new context, a student logs in with Amira's card on `/join` → lands on `/learn`;
  - `/join?code=<lowercase code with spaces>` pre-fills the normalised code;
  - typing `O` shows "codes don't use O, I, L, 0 or 1".
- [ ] **Step 3: Implement. Run `supabase start && npm run test:e2e -- classroom`.** Expected: PASS.
- [ ] **Step 4: Accessibility check with the `ecc:a11y-architect` agent** (labels, focus order, contrast). Fix findings.
- [ ] **Step 5: Commit** `feat(classroom): teacher onboarding, classes, login cards, student join`.

### Task 8: `api/check` (server-side grading and attempts)

**Files:**
- Create: `api/check.js`
- Test: `test/check-api.test.js`

**Interfaces:**
- Consumes: Phase 0 `checkResponse`, `matchWrongAnswer`; Task 6 `requireUser`, `supabaseAdmin`.
- Produces: `POST /api/check { attempt_id: uuid, item_id, part_id, response: string|string[], assignment_id?: uuid, hints_used?: int, time_ms?: int }` → `200 { correct, reason, feedback?: string, solution?: string[] }`.
  - `solution` is included only after an attempt exists for that student, item and part (this one included).
  - Errors: `401` without a session, `404` for an unknown item or part, `429` above 30 checks per minute per user.
  - It upserts `attempts` on `id = attempt_id` (`on conflict (id) do nothing`) and, on conflict, returns the stored verdict (Review Focus 3).

- [ ] **Step 1: Failing tests** (mocked admin):
  - a correct numeric answer → `{ correct: true, reason: 'ok' }`, with the attempt inserted with `correct = true`;
  - a known wrong value → `feedback` from `wrong_answers`;
  - the same `attempt_id` twice → one insert, same response;
  - the response JSON never contains `key` (`JSON.stringify(body)` has no `"key"`);
  - 31st call in a minute → 429;
  - no auth → 401.
- [ ] **Step 2: Run** `npx vitest run test/check-api.test.js` (FAIL) → **implement** → run (PASS).
- [ ] **Step 3: Run the `ecc:security-reviewer` agent on `api/check.js` and `api/class-cards.js`.**
- [ ] **Step 4: Commit** `feat(api): server-side answer checking with idempotent attempts`.

### Task 9: Item sync + seed content

**Files (in `umbra-content`):**
- `scripts/sync.mjs`: upserts each item into `items` (`public` = `{ stem, parts, sim_preset }`) and `item_keys` (`private` = `{ key, solution, wrong_answers }`) with the service-role key from `SUPABASE_SERVICE_ROLE_KEY`. Supports `--dry-run`.
- `items/`: **20 pilot items** (2 per topic across SR, QM, optics, EM, thermo, waves, dynamical, GR, frontier, acoustics), difficulty 1–3, written to the Phase 0 schema. Also `topics.json` with the topic ids these use.

- [ ] **Step 1: Write the 20 items** (`claude-api` draft → `node scripts/validate.mjs` → read each by hand).
- [ ] **Step 2: Run `node scripts/sync.mjs --dry-run` against local Supabase.** Expected: "20 items, 20 keys, 10 topics".
- [ ] **Step 3: Run without `--dry-run`, then as an authenticated user `select count(*) from item_keys`.** Expected: a permission error (keys stay private).
- [ ] **Step 4: Commit in `umbra-content`:** `content: 20 pilot items and sync script`.

### Task 10: Assignments, item player and dashboard

**Files:**
- Create:
  - `src/areas/teach/AssignmentEditor.jsx` (pick items by topic and difficulty; due date);
  - `src/areas/learn/AssignmentList.jsx`;
  - `src/areas/learn/ItemPlayer.jsx` (KaTeX stem; inputs per `answer_type`; "Open in simulation" from `sim_preset`; calls `/api/check` with a client `crypto.randomUUID()` attempt id, with retry up to 3× on a network error, reusing the id);
  - `src/areas/teach/Dashboard.jsx` (heatmap of topics × students coloured by `p_known` with thresholds <0.4 / <0.7 / <0.95 / ≥0.95; completion table; most-missed items with their most common wrong response);
  - `supabase/migrations/20261201000500_views.sql`: view `class_item_stats` (`security_invoker = on`) with `class_id, item_id, attempts, correct_rate, top_wrong_response`.
- Test:
  - `tests/e2e/assignment.spec.js`;
  - `src/areas/teach/heatmapColour.test.js` (`heatmapColour(p)` thresholds).
- Skills: `ecc:dashboard-builder`, `dataviz` (heatmap colour scale, colour-blind safe), `impeccable`.

- [ ] **Step 1: Failing unit test** `heatmapColour`: 0.39 → `'low'`, 0.69 → `'developing'`, 0.94 → `'secure'`, 0.95 → `'mastered'`.
- [ ] **Step 2: Failing e2e:**
  - the teacher assigns 3 seed items to 12P;
  - Amira answers item 1 correctly and item 2 wrongly;
  - the teacher dashboard shows Amira's topic cells changed from empty, and item 2 in "most missed" with her wrong answer;
  - killing the network mid-submit (`page.route('/api/check', abort once)`) still records exactly one attempt.
- [ ] **Step 3: Implement. Run `npm test && npm run test:e2e -- assignment`.** Expected: PASS.
- [ ] **Step 4: Commit** `feat(classroom): assignments, item player, mastery dashboard`.

### Task 11: Migrate local progress for signed-in users

**Files:**
- Create: `src/lib/progressMerge.js`, `src/lib/progressMerge.test.js`
- Modify: `src/context/AuthContext.jsx` (on first sign-in per device: merge, save to `profiles.progress`, set `localStorage['umbra_progress_migrated'] = user.id`)

**Interfaces:**
- `readLocalProgress(storage=localStorage): { challenges:string[], streak:number, storyXp:number, story:Record<string,unknown> }`
- `mergeProgress(local, remote): same shape`: union of challenge ids, max of streak and storyXp, and per-key union of story progress keeping the further chapter.

- [ ] **Step 1: Failing tests:**
  - union of `['a','b']` and `['b','c']` gives `['a','b','c']` (sorted);
  - XP 120 versus 80 gives 120;
  - empty local returns remote unchanged;
  - corrupted JSON in localStorage → `readLocalProgress` returns empty defaults (no throw).
- [ ] **Step 2: Run** (FAIL) → **implement** (`caveman:migration`) → run (PASS).
- [ ] **Step 3: Commit** `feat(progress): move device progress into the account on sign-in`.

### Task 12: Legal pack (template-only) and sub-processors page

**Files:**
- Create: `public/legal/umbra-dpa-template.docx` (`anthropic-skills:docx`, from the DfE / ICO model clauses; school = controller, Umbra = processor)
- Create: `docs/legal/dpia.md` (an ICO DPIA template filled for: display names, class membership, attempts, mastery; lawful basis public task/legitimate interest of the school; retention: 12 months after class archive; sub-processors)
- Create: `src/areas/LegalPages.jsx`, with routes `/privacy` and `/schools/data-protection`: a plain-language privacy notice (Children's Code standard 4, "transparency", written for ages 13–18), the sub-processor list (Supabase EU, Vercel, Anthropic: tutor messages only, no account data), and a download link to the DPA.
- Modify: `src/lib/routes.js` (add `legal` area for both paths, with a route test), `src/components/PricingPanel.jsx` (link "Data protection" under Classroom)

- [ ] **Step 1: Failing route test:** `parseRoute('/privacy')` gives `{ area: 'legal', page: 'privacy' }`; `/schools/data-protection` gives `page: 'schools'`.
- [ ] **Step 2: Draft the documents.** Run `ecc:security-review` over the retention and deletion claims, checking each claim has a mechanism: deletion request → admin `delete from students where user_id = …` (cascade); archive + 12 months → a scheduled job (`pg_cron` `delete … where archived_at < now() - interval '12 months'`, in a migration).
- [ ] **Step 3: Implement the pages and the cron migration. Run tests and the e2e smoke test (`/privacy` heading visible).**
- [ ] **Step 4: Commit** `docs(legal): DPA template, DPIA, privacy notice, sub-processors, retention job`.

### Task 13: Pilot outreach (runs alongside, from week 3)

No code. Outward-facing steps need user approval.
- [ ] **Step 1: Research.** `last30days` on "A-level physics teacher software", "IB physics simulation"; `marketing-skills:customer-research`. Write `marketing/schools/icp.md` (private folder).
- [ ] **Step 2: Build the CRM** in a Google Sheet via the Sheets connector: 40 target departments (name, country, board, contact role, source, status). Columns `school, country, board, contact_role, public_contact_url, status, next_step, date`. Public, role-based school contacts only.
- [ ] **Step 3: Draft emails.** `marketing-skills:cold-email` writes 3 variants. Create **Gmail drafts only**. The user reviews and sends.
- [ ] **Step 4: Booking.** A Google Calendar appointment slot for 20-minute demos. The pilot one-pager (`anthropic-skills:pdf`) links the free pilot terms and `/schools/data-protection`.
- [ ] **Step 5: Exit.** ≥ 3 departments agreed to pilot from week 9 (tracked in the sheet).

### Task 14: Phase 1 exit check

- [ ] Run `supabase db reset && supabase test db && npm test && npm run test:e2e && npm run build && npm run lint`. All are green.
- [ ] Manual pilot rehearsal on a Vercel preview against the hosted (EU) project. Apply migrations with `supabase db push` **only after user approval**. Teacher → class → 2 cards → 3 assignments → 2 students answer → dashboard updates. Time the teacher flow: < 5 minutes.
- [ ] Run whole-branch review (`superpowers:requesting-code-review`, `ecc:security-reviewer`, `ecc:database-reviewer`) and `caveman:verify-and-stop` against this plan.
- [ ] Write ADR `docs/adr/0002-student-identity-without-email.md`.
