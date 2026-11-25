# ADR 0002: Students sign in with login cards, not email

Status: Accepted (Phase 1, Umbra for Schools)

## Context

Umbra for Schools serves classes that include children under 13. We do not want to collect or store a student's email address or real name. A school may also have no student email accounts at all, or none a teacher can hand out in a lesson. Students still need an identity that persists across sessions and devices, so that attempts and mastery stay with them. Teachers must be able to see progress for their own class and nobody else's.

Supabase Auth requires an email and a password (or an OAuth identity) for each user. Any student identity has to work inside that model.

## Decision

1. **Login cards.** A teacher creates cards for a class through `POST /api/class-cards` (1 to 60 names per request). Each card has a username such as `maya-0427` (first name, up to 12 characters, plus four digits) and a passphrase of three words from the EFF short wordlist (1,295 words), for example `word-word-word`. The passphrase is shown once, in the response to the request, and is never stored or logged.
2. **Synthetic auth email.** Each card is an auth user with the email `<username>@students.umbra.invalid`, created with `email_confirm: true` and the passphrase as the password. The `.invalid` TLD cannot receive mail, so no message can reach it and no real address is held.
3. **Card flag set only by the service role.** The API creates the user with `app_metadata.umbra_card = true`. Clients cannot write `app_metadata`, so only the service role can set it. The email suffix alone proves nothing, because anyone can type any email at sign-up. Server code and the database therefore key on the flag, not the suffix. `enrol_student` derives `students.created_via` (`card` or `google`) from the flag.
4. **Public sign-up to the domain is blocked in the database.** The deferred constraint trigger `guard_card_email` on `auth.users` runs at commit. If the row's email ends in `@students.umbra.invalid` and `raw_app_meta_data->>'umbra_card'` is not `true`, it raises `reserved_email_domain`. It is deferred because GoTrue's admin `createUser` inserts the row first and writes `app_metadata` in a second UPDATE in the same transaction. A check at insert time would also refuse the service role.
5. **No profile row for card students.** `handle_new_user` skips the `public.profiles` insert for the synthetic domain, so no email is copied into `public.*`.
6. **A card belongs to the school that issued it.** `students.card_school_id` records the issuing school, set by `enrol_card_student` (service role only). `enrol_student`, and so `join_class`, refuses to enrol a card student in a class of another school (`card_school_only`). `PATCH /api/class-cards` lets only staff of `card_school_id` reset a card. This closes a takeover path: without it, any Google user could create a school, get a card student to join their class by code, and then reset that student's passphrase as "staff of a school the student is enrolled in".
7. **Resets revoke sessions.** `PATCH /api/class-cards` sets a new passphrase with `updateUserById`, then calls `revoke_user_sessions`, which deletes the student's rows in `auth.sessions`. Refresh tokens cascade from those rows. A reset therefore signs the student out on every device.
8. **Caps.** Card students per school are limited to `schools.seats` (default 150). The API checks the whole batch before creating anything and returns 409 `seat_limit`. `enrol_card_student` checks again per card while holding a lock on the school row, so concurrent requests cannot go over. A user can be admin of at most 3 schools (`school_limit` in `create_school`).
9. **Google sign-in for students stays available.** A student who signs in with Google keeps their email in Supabase Auth, which is outside our schema. `enrol_student` sets `public.profiles.email` to null when the student joins a class, so `public.*` holds no student email either way.

## Consequences

- No student email, real name or mail flow exists for card students. Display names are what the teacher typed.
- The passphrase is shown once. If a student loses their card, the teacher resets it and prints a new one. Teachers cannot recover an old passphrase, because we do not keep it.
- Cards are per school. A card student cannot join another school's class, and staff of another school cannot reset the card.
- A reset revokes refresh tokens, not access tokens. An access JWT issued before the reset stays valid until it expires (the GoTrue JWT lifetime, one hour by default). A stolen session can act as the student for that long.
- If the session revoke step fails after the password change, the API returns 500 `session_revoke_failed` and shows no new passphrase. The password has already changed, and the teacher resets again.
- Three words from 1,295 give about 31 bits (1,295^3 is roughly 2.2 billion). That is weak against offline attack, but there is no offline copy to attack. Online guessing relies on GoTrue's rate limits on the password grant and on usernames not being listable. The risk is accepted for low-stakes classroom data, and a stronger passphrase would be harder for children to type.
- The `.invalid` domain and the `umbra_card` flag form a convention that every later feature must respect. Database tests (`card_identity_test.sql`, `card_school_test.sql`) cover the trigger, the school binding and the caps.
- Card creation is all or nothing per request. If any card fails, the API deletes the auth users it created (students and enrolments cascade).

## Alternatives considered

- **Student email addresses.** Rejected: it stores personal data about children, and many schools cannot issue student emails or will not give them to a small vendor. It adds mail delivery, bounces and verification to a flow that must work in a lesson.
- **Google sign-in only.** Rejected as the only path: it excludes students without a Google account and tells Google which children use Umbra. It stays as an optional path for older students.
- **School SSO or LTI.** Deferred: it is the right answer for larger schools, but it needs per-school setup, school IT contact and review. It is a later phase. The `students.created_via` column leaves room for new sign-in methods.
- **Longer passphrases or random strings.** Rejected for now: the usability cost for young students outweighs the extra bits while GoTrue rate limits cover online guessing. Revisit if the threat model changes.
