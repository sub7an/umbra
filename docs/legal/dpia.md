# Data Protection Impact Assessment: Umbra Classroom

> **Template — review with your school's DPO / legal adviser before signing.**
> This DPIA follows the structure of the ICO's sample DPIA template (steps 1–7). It was
> written by the Umbra team from the code as it stands, not by a lawyer. Umbra holds no
> data-protection certification. A school may adopt it as the starting point for its own
> DPIA; the school, as controller, owns the final assessment.

| | |
|---|---|
| Controller | ______________________ (the school) |
| Processor | Umbra (umbrasandbox.com) |
| Version / date | v0.1, 25 November 2026 |
| Reviewed by (school DPO) | ______________________ |

---

## Step 1: Why a DPIA is needed

Umbra Classroom processes personal data about children (students aged roughly 13–18) on
behalf of schools. The ICO lists processing children's data, and matching or combining
data to profile learning, among the factors that make a DPIA appropriate. The service
also estimates each student's mastery of topics from their answers, which is a form of
evaluation. No decisions with legal or similarly significant effects are taken
automatically: teachers decide what to do with the estimates.

## Step 2: The processing

### Nature

- **Collection.** A teacher creates a class. Students join with a class code, either by
  signing in with Google or with a login card the teacher prints (username and passphrase).
- **Use.** Teachers set assignments. Students answer; the server checks each answer and
  records an attempt. A database trigger updates a per-topic mastery estimate.
- **Storage.** Supabase (Postgres and Auth), in an EU region set in the Supabase project.
- **Deletion.** Automatic 12 months after a class is archived; on request; at end of contract.
  See "Deletion procedures" below.
- **Sharing.** Only with the sub-processors listed below. Nothing is sold. No advertising.

### Data held

| Data | Subjects | Where | Notes |
|---|---|---|---|
| Display name (1–40 characters) | Students | `public.students.display_name` | Typed by the student or teacher. Only a display name is needed (a first name is enough). |
| Class memberships and join date | Students | `public.enrolments` | |
| Attempts: response text, correct, reason, hints used, time taken, assignment, timestamp | Students | `public.attempts` | Written only by the server (service role). |
| Mastery per topic, review schedule | Students | `public.mastery` | Derived from attempts by a trigger. |
| Username | Card students | `public.students.username` | Format `name-0000`. |
| Synthetic sign-in email `…@students.umbra.invalid` | Card students | `auth.users` | Not a real mailbox. No `profiles` row is created, so no email in `public.*`. |
| Issuing school | Card students | `public.students.card_school_id` | Ties the card to the school that made it. |
| Google email | Google-signed-in students | `auth.users` | Needed for Google sign-in. Nulled in `public.profiles` when the student joins a class; not visible to teachers. |
| Email address | Teachers | `auth.users`, `public.profiles` | |
| School name and country | Schools | `public.schools` | Not personal data. |

No special category data is requested. Free-text answers could, in principle, contain
anything a student types; the answer boxes are for physics answers and teachers are asked
to tell students not to type personal details.

### Scope

A pilot of 2–3 schools at first; a department licence covers up to 150 students. Data is
kept for the life of a class plus 12 months after it is archived.

### Context

Students are children. The relationship is school-directed: the school decides to use
Umbra and creates the classes. Students and parents would expect teachers to see
classwork and progress, as with any homework platform. Students would not expect their
data to be used for anything else, and it is not.

### Purposes

To let teachers set physics work, check answers automatically, and see class and student
progress, so they can target teaching. Students get immediate feedback and suggestions on
what to review.

### Lawful basis (for the school to confirm)

- State-funded schools: Article 6(1)(e), public task (education).
- Independent schools: Article 6(1)(f), legitimate interests (education), with a balancing
  test that the school records.
- Consent is not relied on.

### Sub-processors

| Sub-processor | Purpose | Location | Data |
|---|---|---|---|
| Supabase | Database and authentication | EU (region set in the Supabase project) | All account and classroom data above |
| Vercel | Hosting, serverless functions (`api/check`, `api/class-cards`, `api/ai`), cookieless page-view analytics | Vercel's network; function region set in the Vercel project | Requests in transit, including IP addresses; nothing stored by Umbra in Vercel |
| Anthropic | AI features only (`api/ai.js`) | United States | Anything typed into an AI box (the tutor, the scene description box, telescope questions), the tutor chat so far, simulation settings and, for "explain", a JPEG of the simulation canvas. The request carries no user ID, name, email, class or attempt data (`api/ai.js:109-114` forwards only `system`, `messages`, `max_tokens`). |
| Stripe | Billing for paying teachers (Pro) | Stripe's processing locations | Teacher email and Umbra user ID. Not used for students. |

Services the browser contacts directly (they see the visitor's IP address but receive no
account data): Google Fonts; jsDelivr and Google Cloud Storage (hand-tracking model, only
when hand control is switched on); YouTube no-cookie player and NASA image API (telescope
page); Google as sign-in provider for users who choose "Sign in with Google".

The school should check each sub-processor's current data processing terms and
international transfer safeguards (UK IDTA / Addendum or EU SCCs) for Anthropic and
Stripe; Umbra does not restate them here.

## Step 3: Consultation

| Who | How | Outcome |
|---|---|---|
| School DPO | Review of this DPIA and the DPA template | ______ |
| Teachers in the pilot | Pilot feedback | ______ |
| Students / parents | Privacy notice at `/privacy`, written for ages 13–18 | ______ |

## Step 4: Necessity and proportionality

- **Minimisation.** No student email in classroom tables; card students have no real email
  at all. No date of birth, address or photo. Display names can be pseudonyms.
- **Purpose limitation.** Data is used only to run classes. No advertising, no sale, no
  profiling beyond the per-topic mastery estimate shown to the student and their teachers.
- **Access.** Row-level security: a student sees only their own records; staff see
  students and attempts only for classes of their own school (`supabase/migrations/20261201000200_rls.sql`;
  tested in `supabase/tests/rls_test.sql`). Attempts are written only by the server.
- **Accuracy.** Answers are checked server-side; teachers can see the reason for each mark.
- **Retention.** 12 months after archive, enforced by a scheduled job (below).
- **Rights.** Access, rectification and erasure requests go through the school; Umbra
  carries them out on the school's instruction (see "Deletion procedures").
- **Transparency.** Children's Code standard 4: the privacy notice uses short sentences
  and plain words, and is linked from the classroom pages' pricing and data-protection pages.

## Step 5: Risks

| # | Risk | Likelihood | Severity | Overall |
|---|---|---|---|---|
| R1 | A teacher sees data of students in another school | Remote | Significant | Low |
| R2 | Account takeover of a card student by another school's staff | Remote | Significant | Low |
| R3 | Student types personal details into an AI box (tutor, scene description, telescope questions), which reach Anthropic | Possible | Minimal | Low |
| R4 | Data kept longer than needed (class never archived, or un-archived) | Possible | Minimal | Medium |
| R5 | Answer keys or student data leak through the public code repository | Remote | Significant | Low |
| R6 | Deleted data persists in Supabase backups | Probable | Minimal | Low |
| R7 | Breach at a sub-processor | Remote | Significant | Medium |

## Step 6: Measures

| Risk | Measure | Effect | Residual |
|---|---|---|---|
| R1 | RLS on every classroom table, pgTAP tests for cross-school isolation | Reduced | Low |
| R2 | Card students tied to the issuing school (`students.card_school_id`); only that school's staff can reset a card; sessions revoked on reset (`20261201000460_card_school.sql`) | Reduced | Low |
| R3 | AI requests carry no identity; privacy notice tells students not to type personal details into any AI box | Reduced | Low |
| R4 | Daily purge 12 months after archive; end-of-contract purge on instruction; schools told to archive classes at year end | Reduced | Low |
| R5 | Keys and solutions live in a private repo; CI check `scripts/check-no-answers.mjs`; no student data in the repo | Eliminated | Low |
| R6 | Backups roll off under Supabase's backup retention for the plan; restored data would be re-purged by the daily job | Accepted | Low |
| R7 | Sub-processors chosen for their published security programmes; breach notice to schools without undue delay (DPA clause) | Reduced | Medium |

## Step 7: Sign off

| Item | Name / date | Notes |
|---|---|---|
| Measures approved by | | |
| Residual risks approved by | | |
| DPO advice provided | | |
| DPO advice accepted or overruled by | | |
| Consultation responses reviewed by | | |
| This DPIA will be kept under review by | | Review at least yearly, and before any new sub-processor or data type. |

---

## Deletion procedures (Umbra admin)

Run in the Supabase SQL editor as `postgres` (the functions are not callable by `anon`,
`authenticated` or `service_role`). Record each request and confirm to the school in writing.

**1. Automatic: classes archived more than 12 months ago.** The archive time is always set by
the database (`set_archived_at` trigger), so it cannot be backdated by a client. pg_cron job
`purge-archived-classes` runs `select public.purge_archived_classes()` daily at 03:17 UTC.
For each class it deletes the attempts on the class's assignments (needed because
`attempts.assignment_id` is `on delete restrict`), then the class (cascading to
assignments and enrolments). Then:
- a card student with no class left is deleted from `auth.users`, which cascades to
  `public.students`, and from there to enrolments, attempts and mastery;
- a Google-signed-in student with no class left has their `public.students` row deleted
  (cascading to attempts and mastery). Their `auth.users` row and `profiles` row (email
  already nulled) are kept, because the sign-in account is the student's own.

Check it ran: `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-archived-classes') order by start_time desc limit 5;`

**2. A student's erasure request (via the school).**
- Card student: `delete from auth.users where id = '<user_id>';`
  (removes the sign-in, and cascades to `students`, `enrolments`, `attempts`, `mastery`).
- Google-signed-in student, classroom data only: `delete from public.students where user_id = '<user_id>';`
  (cascades to `enrolments`, `attempts` and `mastery`). If the student also wants their
  Umbra account gone: `delete from auth.users where id = '<user_id>';` (also removes `profiles`).

Find the user ID from the school's class roster: `select s.user_id, s.display_name, s.username from public.students s join public.enrolments e on e.student_id = s.user_id where e.class_id = '<class_id>';`

**3. End of contract.** On the school's written instruction:
`select public.purge_classes(array(select id from public.classes where school_id = '<school_id>'));`
then `delete from public.schools where id = '<school_id>';`. This removes every class, its
attempts, and every card student of the school. Teacher accounts belong to the teachers;
delete them on request with `delete from auth.users where id = '<user_id>';`.

## Claims and mechanisms

Every retention or deletion claim in the DPA template, this DPIA, `/privacy` and
`/schools/data-protection` must map to a mechanism here.

| Claim | Mechanism |
|---|---|
| Archive time is set by the server (cannot be backdated) | `supabase/migrations/20261201000610_archive_time.sql` (`set_archived_at` trigger); test `supabase/tests/archive_time_test.sql` |
| Archived classes deleted after 12 months | `supabase/migrations/20261201000600_retention.sql:75-86` (`purge_archived_classes`, `interval '12 months'` at :83); daily schedule :93-104 |
| Attempts on the class's work deleted with it | `20261201000600_retention.sql:45-47`; needed by the RESTRICT FK at `20261201000250_rls_fixes.sql:8-9` |
| Assignments and enrolments deleted with the class | `20261201000600_retention.sql:50`; cascades at `20261201000100_classroom.sql:39,75` |
| Card student with no class left deleted completely | `20261201000600_retention.sql:55-60`; `students.user_id` cascade at `20261201000100_classroom.sql:32` |
| Google student with no class left: classroom record deleted, sign-in kept | `20261201000600_retention.sql:63-66` |
| Deleting a student removes enrolments, attempts, mastery | `20261201000100_classroom.sql:40,86,99` (`on delete cascade`) |
| No student email in classroom tables | no profiles row for card users `20261201000450_card_identity.sql:26-28`; Google email nulled on joining `20261201000460_card_school.sql:70` |
| AI features get no account data | `api/ai.js:109-114`; client `src/lib/ai.js` sends no auth header |
| Purge never deletes a student who joins another class mid-run | `20261201000610_archive_time.sql` (`purge_classes` locks candidate `students` rows FOR UPDATE) |
| Tested | `supabase/tests/retention_test.sql`, `supabase/tests/archive_time_test.sql` |
