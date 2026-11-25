# ADR 0001: Answer keys live in a private content repo; checking runs server-side

Status: Accepted (Phase 0, Umbra for Schools)

## Context

Umbra for Schools adds assignments with auto-checked answers. This repository is public and the app ships as a static bundle. Anything in either place is readable by a student with browser dev tools. Teachers need answers that students cannot see, and the checker must give the same verdict for the same input every time.

Expression answers (for example `m*g*h`) need a symbolic-ish equivalence check. That check uses mathjs, which adds about 96 KB gzipped. Shipping it to every visitor of a free simulation site would slow the core product for a feature most visitors never use.

## Decision

1. Answer keys live only in the private repository `sub7an/umbra-content` and, at runtime, in a service-role-only Supabase table `item_keys`. Row-level security grants no read access to anon or authenticated roles.
2. Checking runs server-side in `api/check` (built in Phase 1). The client sends the student's response and an item id. The server loads the key, checks, and returns only the verdict and feedback, never the key.
3. The checking logic is the open library `src/lib/check` (numeric with units, choice, order, expression). It is public and unit-tested, so teachers and contributors can audit how marking works. It holds no keys. The mathjs-based expression checker stays server-side and is not imported from client code, which keeps the 96 KB out of the client bundle.
4. CI guard `scripts/check-no-answers.mjs` fails the build if answer-key material appears in this public repository.

## Consequences

- Students cannot extract answers from the bundle, the repo, or network responses.
- Each check is a network round trip and needs the server to be up. Offline marking is not supported. Simulations themselves still work offline.
- The server needs rate limiting and per-item attempt logging (Phase 1) to stop answer probing by repeated guesses.
- Content authors work in a separate repository with its own review flow. Syncing content into `item_keys` becomes a deploy step to build and test.
- The checker is public, so its tolerance and unit rules are transparent. Secrecy rests on the keys, not on the algorithm.
- The CI guard is a heuristic. It reduces accidental leaks but does not replace review.

## Alternatives considered

- **Answers in the public repo.** Rejected: any student can read them.
- **Client-side checking.** Rejected: the keys would be in the bundle, and mathjs would add about 96 KB gzipped for everyone.
- **A hosted CMS for content.** Rejected: there is one builder, and versioned, diffable, reviewable content in git is wanted. A CMS adds cost, a vendor dependency and weaker history.
