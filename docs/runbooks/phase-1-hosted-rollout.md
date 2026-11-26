# Phase 1 hosted rollout checklist

Run these before and after `supabase db push` to the hosted project. Every step that touches the hosted project needs the owner's go-ahead.

1. **Merge order.** Phase 0 (PR #2) merges first; this branch stacks on it. If Vercel deploys `main` to production, run `db push` and the content sync before merging, or `/teach`, `/learn` and `/join` will call RPCs and tables that don't exist yet.
2. **Baseline.** `supabase link`, then `supabase migration list`. With no remote history, `supabase migration repair --status applied 20261201000000`. Check drift first with `supabase db diff --linked`: `20261201000100` adds `profiles.progress` and fails if it already exists. Never run `supabase config push` (local `site_url` is 127.0.0.1).
3. **Auth-schema privileges.** On the hosted DB:
   `select has_table_privilege('postgres','auth.users','TRIGGER'), has_table_privilege('postgres','auth.users','DELETE'), has_table_privilege('postgres','auth.sessions','DELETE');`
   All three must be true (needed by `guard_card_email`, `purge_classes` and `revoke_user_sessions`).
4. **`guard_card_email` against hosted GoTrue.** Right after the push: a real Google sign-up works; a card batch creates users (R12 was verified only on local GoTrue); a public sign-up to `@students.umbra.invalid` is refused.
5. **pg_cron.** `select * from cron.job` shows `purge-archived-classes`. The migration skips scheduling silently if the extension is unavailable.
6. **Migrations together.** `item_keys` is exposed by default grants between `0100` and `0200`; `db push` applies them together. Sync content only after every migration succeeds.
7. **Auth settings.** Email provider enabled (card sign-in uses the password grant). Password rules accept `word-word-word` (lowercase + hyphens) and leaked-password protection doesn't reject them. The per-IP sign-in rate limit allows a whole class behind one network. Redirect URLs include `/join` and `/teach`. JWT expiry 1 hour (ADR 0002).
8. **Vercel env.** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix) in Production and Preview.
9. **Content sync.** From `umbra-content`: `node scripts/sync.mjs --allow-remote` after the push; re-run to completion if it fails part-way (it is not atomic).
10. **Schools.** Schools created before migration `0700` stay `pilot` (no back-fill): audit them. New schools start `pending`; approve with `update public.schools set plan = 'pilot' where id = '…';` and email the teacher by hand until admin tooling exists.
11. **Preview rehearsal.** On a Vercel preview against the hosted project: teacher, class, 2 cards, 3 assignments, 2 students answer, dashboard updates; time the teacher flow (target under 5 minutes). Confirm `/api/check` bundles `../src/lib/check`.
