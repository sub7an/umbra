# Umbra for Schools: platform design

Date: 2026-11-24 · Status: draft for approval · Owner: Subhan (full-time, building with Claude)

## 1. Intent

Turn Umbra from a free collection of physics simulations into a **platform that physics departments pay for**. The trigger is an external review that asked for six things:

1. university-level modules;
2. rigorous derivations;
3. experimental data compared against theory;
4. harder problem sets;
5. progress tracking and personalised learning;
6. independent validation of the physics.

This design turns all six into a product a school buys, in the order a school needs them.

**Buyer:** A-level and IB physics departments; the teacher buys, the students use it.
**Syllabuses:** AQA, OCR A, Edexcel, IB Physics (2023) and Cambridge International (CIE).
**Later:** university first and second year, as an upsell once schools pay.

## 2. Goals, non-goals, anti-goals

**Goals (6-month horizon)**
- A teacher can set up a class in under 5 minutes, assign simulation tasks and problems, and see who is stuck on which topic.
- Every simulation carries a full derivation, a data lab where real data exists, a syllabus-mapped problem set and a public validation report.
- Students get a personal next-step list driven by their own mastery, which works without any AI call.
- Problem banks cover each board's **whole syllabus**, including the core topics that get new simulations (§6.7).
- 3 pilot schools using it weekly by week 20. The first paid school contract by week 26.

**Non-goals (this horizon)**
- University modules beyond a scoped first batch (phase 5).
- Native mobile apps (the web app works on phones).
- A content-authoring CMS for teachers (content ships as code; teachers assign it).
- Microsoft Teams and LTI integrations: they are planned (phase 4+), but not built until a school asks.

**Anti-goals (these would make it a failure even if it "works")**
- Collecting student emails, real names or any data beyond what a class needs, or selling or advertising on student data.
- An AI tutor that gives final answers to assigned problems, or marks work with an unexplained score.
- "Validated" claims that the test suite does not back.
- Paywalling the simulations themselves: the free simulations are the marketing.
- Problem text copied from exam boards' past papers (copyright).

## 3. Constraints

- **Builder:** one person plus Claude, full-time. Phases must ship independently.
- **Stack** (approach A, chosen):
  - the existing Vite + React 19 + React Three Fiber app;
  - Supabase (Postgres, auth, row-level security);
  - Vercel serverless `api/`;
  - the Anthropic SDK through `api/ai.js`;
  - Stripe;
  - KaTeX;
  - Vitest;
  - Playwright.
- **Users under 18:** UK GDPR and the Children's Code, COPPA (school-authorisation route) and FERPA "school official" terms. The school is the data controller and Umbra is the processor, under a Data Processing Agreement.
- **No outside physics reviewer exists today.** Validation must stand on published automated evidence until paid review is affordable (§6.6).
- **Supabase is already hosted in the UK/EU** (user-confirmed): no migration needed.
- **The app repo is public (MIT).** Problem answers, worked solutions and wrong-answer feedback must therefore never live in it (§6.2).
- **Legal:** the DPA, DPIA and Children's Code paperwork use official templates only (ICO, DfE and the schools' own DPA forms), with no paid lawyer (user decision). Accepted risk in §10.
- **Content today:** 11 topics, 39 simulations (`src/content/simulationPages.js`):
  - SR: 3;
  - QM: 5;
  - GR: 3;
  - Frontier: 4;
  - Dynamical: 6;
  - EM: 2;
  - Waves: 3;
  - Optics: 3;
  - Thermo: 4;
  - Fluids: 3;
  - Acoustics: 3.

  Each simulation page already has an explanation, try-this steps, a misconception, one worked question and equations.
- **Math tests exist** for SR, QM, GR, EM, optics and attractors (`*Math.test.js`). There are none for fluids, thermodynamics, acoustics, waves or frontier.
- **Today's persistence:**
  - `profiles` (XP, `is_pro`);
  - challenges and journeys in `localStorage` (`umbra_challenges`, `umbra_story*`).
- **Routing today:** home-grown `pushState` / `popstate` in `src/App.jsx`.
- **Pricing page today:** `src/components/PricingPanel.jsx` already promises a Classroom tier with a "teacher dashboard, progress tracking, LMS embeds, FERPA-friendly". That promise must become true or be reworded before selling.

## 4. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Extend the current SPA + Supabase + Vercel functions. Teacher area at `/teach`. Content as versioned files in the repo, synced to the database by stable IDs. | Fastest to sellable. One codebase. Needs a real router first (~1 week). | **Chosen by user** |
| B | Migrate to Next.js (server rendering, server actions) | 4–6 weeks of rewriting a working 3D app before any school feature. The SEO gain is already covered by the build-time prerender. | Rejected |
| C | Separate Next.js teacher app sharing Supabase | Two codebases, two deploys, duplicated auth for one builder | Rejected |

## 5. Packaging and pricing (builder's call; the user delegated it)

| Tier | Who | Price (starting point, validate in pilots) | Includes |
|---|---|---|---|
| Explorer | anyone | free | All simulations, all derivations, all data labs, the public validation pages, the AI tutor (rate-limited), challenges/journeys. Signed-in learners also get difficulty 1–3 problems, with solutions after an attempt, and their personal Next up list. |
| Pro | individual students and parents | $6/mo (existing) | 4K export, longer recordings, priority tutor, private rooms, the full problem bank (difficulty 4–5, synoptic, board-matched exam sets) |
| Classroom | a physics department | **£600/yr per department up to 150 students, then £3/student/yr**. A free 60-day pilot. | Classes and rosters, assignments, the progress dashboard, syllabus-mapped problem banks with worked solutions, mastery and personalised review, CSV/Sheets export, a DPA, the validation report PDF, priority support |
| Classroom+ (later) | universities | quote | University modules, LTI 1.3, cohort analytics |

Free simulations bring in traffic, and teachers pay for workflow and evidence.

## 6. The design, by reviewer point

### 6.1 Progress tracking and personalised learning (built first, because it is what schools pay for)

**Accounts**
- Teachers sign in with Google (Supabase OAuth). Microsoft comes later.
- Students join with a **6-character class code**, then sign in one of two ways (*builder's call*):
  - **School Google sign-in:** the email is used only to authenticate and is **not** copied into any Umbra table.
  - **A teacher-issued login card:** a username plus a 3-word passphrase. It is backed by a Supabase email/password user whose email is a synthetic, non-routable address (`<uuid>@students.umbra.invalid`), never shown or used. The same card works on any device. Teachers reset forgotten passphrases from the dashboard, through a service-role `api/` function.
- Students get their own `students` table. The existing `handle_new_user` trigger is changed to skip student accounts and never store emails for them. Public users keep `profiles`.
- Only these are stored: display name, class memberships, attempts, mastery.
- Student data is deleted on request, and 12 months after a class is archived.

**Data model (Supabase, every table under row-level security)**
```
schools(id, name, country, dpa_signed_at, plan, seats)
staff(id→auth.users, school_id, role[teacher|admin])
classes(id, school_id, name, syllabus[aqa|ocr_a|edexcel|ib|cie], year_group, code, archived_at)
enrolments(class_id, student_id, joined_at)
students(id→auth.users, display_name, created_via[google|code])
topics(id, title, parent_id)                       -- one shared topic tree
syllabus_map(topic_id, syllabus, spec_ref)         -- e.g. aqa "3.6.1.2", ib "C.1"
items(id, kind[problem|sim_task|derivation_check|data_lab], topic_ids[], difficulty 1–5, version)
assignments(id, class_id, title, item_ids[], opens_at, due_at)
attempts(id, student_id, item_id, assignment_id?, response jsonb, correct bool, score, hints_used, time_ms, created_at)
mastery(student_id, topic_id, p_known, last_seen, next_review_at)
```
Row-level security rules:
- a student reads and writes only their own attempts;
- a teacher reads attempts only for students enrolled in their own school's classes;
- `topics`, `syllabus_map` and item **stems** are public read. Answers, solutions and feedback sit in `item_keys`, which has no client access at all: only the service role in `api/` reads it.

**Mastery model:** Bayesian Knowledge Tracing per topic. It is simple, explainable and needs no ML infrastructure.
- Parameters per difficulty band: prior 0.2, learn 0.15, slip 0.1, guess 0.2 (or 0.05 for numeric-entry items).
- A topic counts as mastered at p_known ≥ 0.95.
- Spaced review uses intervals of 1, 3, 7, 16 and 35 days after mastery. A wrong review answer resets one step.
- Everything runs in a Postgres function on each attempt insert (an `update_mastery()` trigger), so the dashboard is always current and costs nothing per query.

**Student view: a "Next up" list**
- It holds 3 items, ranked like this:
  1. overdue reviews;
  2. assignments due within 3 days;
  3. the weakest topic in the student's syllabus that has prerequisites met.
- Each item says *why* it is there ("Review: you last saw projectile motion 8 days ago").

**Teacher dashboard (`/teach`)**
- A class heatmap of topics × students by mastery.
- The assignment completion table.
- "Most-missed items", with each item's most common wrong answer.
- A student drill-down.
- Export to CSV and Google Sheets (via the Sheets API, with the teacher's own Google auth).

**AI tutor in assignments**
- It may give hints only. The system prompt receives the item and its solution steps, with the rule "never reveal the final value". Hints are counted in `hints_used`, which lowers the attempt's BKT weight.
- Cost control, using Vercel AI Gateway budgets:
  - a per-school monthly token budget;
  - a cached system prompt;
  - Haiku for hints and Sonnet for explanations.

### 6.2 Harder, syllabus-mapped problem sets

**Where content lives (*builder's call*, because the app repo is public):**
- Problems live in a **separate private repo** (`umbra-content`) with its own CI: schema checks, a checker test per item, and two-model review.
- A sync script upserts **stems** into `items` and **answers, solutions and feedback** into `item_keys`.
- The browser only ever receives the stem.
- Answers are checked server-side by `api/check`, which records the attempt and returns the verdict plus feedback. The worked solution is returned only after an attempt (or after the teacher releases it).
- The checker library stays open source in the app repo (`src/lib/check/`, run by `api/check`). Only the content is private.

**Coverage:** banks cover each board's **whole syllabus**, not just the simulations. An item links to a simulation preset where one exists. Core topics gain simulations in §6.7.

**Format:** each item is a file at `items/<topic>/<id>.json` in `umbra-content`. It contains:
- the stem (KaTeX);
- parts;
- the answer type (numeric with tolerance and units, multiple choice, expression, or ordered steps);
- worked solution steps;
- the common wrong answers, each with targeted feedback;
- difficulty 1–5;
- topic IDs;
- syllabus spec refs;
- an optional `sim_preset` that deep-links to a simulation state, e.g. "set β to 0.9 and read γ".

**Checkers**
- Pure functions in `src/lib/check/`: numeric with significant-figure and unit handling, symbolic equivalence via a small CAS, multiple choice, and ordering.
- Every item gets a Vitest test that runs its own answer through its own checker.

**Volume target by week 18**
- ~800 items:
  - about 15 per simulation across difficulties 1–5 (45 simulations including §6.7);
  - ~100 synoptic multi-topic problems at difficulty 4–5 ("harder");
  - simulation-free items for any spec point still uncovered.
- Written **original**, in exam style.

**Pattern grounding**
- `reverse-engineer-tests` over each board's freely downloadable past papers and mark schemes (analysis only, never reproduced).
- It yields, per board:
  - topic weightings;
  - command words;
  - mark allocation;
  - recurring traps.
- Item writing follows those patterns, and each board's mix of difficulty and command words matches its real papers.

**Item types that use the simulation**
- *Predict–observe–explain:* commit a prediction, run the simulation, then explain the gap.
- *Measure-in-sim:* read values from the simulation and compute.
- *Break-it:* find the setting where the model's approximation fails.

### 6.3 Rigorous mathematical derivations

- Every simulation page gets a **Derivation** tab. It is a step-by-step derivation in KaTeX, from first principles to the equation the simulation uses. Each step has a one-line justification and a "why this step" expandable.
- There are two depth levels per derivation: **A-level/IB** (algebra plus calculus where the syllabus allows) and **Beyond** (vector calculus, Lagrangians, and where the simulation's numerical method comes from, e.g. RK4 for the Lorenz system or a symplectic integrator for N-body).
- **Derivation checks:** after each derivation, 2–3 "fill the missing step" items feed the same mastery model.
- **Animated derivations:** for the 10 flagship derivations, render short Manim animations, embedded on the page and reused as Shorts through the existing video pipeline and OpenMontage.
- Every derived formula gets a numerical cross-check test, e.g. the derived small-angle pendulum period compared against the simulation's measured period (§6.6).

### 6.4 Experimental data compared against theory (data labs)

A **Data lab** tab sits on each simulation where real data exists. The student loads a dataset, or collects their own, and overlays it on the simulation's prediction. They fit one parameter and compute residuals and χ². Each lab ends with an evaluation question about uncertainty and error sources (A-level practical endorsement / IB IA skills).

| Lab | Dataset or collection | Simulation |
|---|---|---|
| Pendulum period vs length | phone accelerometer (`DeviceMotionEvent`) | Double pendulum (small-angle mode) |
| Speed of sound / resonance | phone microphone (Web Audio FFT) | Acoustics: harmonics |
| Inverse-square light falloff | phone camera luminance | Optics |
| Hydrogen and helium emission lines | NIST Atomic Spectra Database | Optics: grating / QM |
| Diffraction grating spacing | student photo of a laser pattern, then a pixel-measuring tool | Optics: grating |
| Gravitational wave chirp | LIGO GWOSC GW150914 strain | GR: waves |
| Galaxy rotation curves | SPARC database | Frontier: rotation curve |
| Hubble diagram | Pantheon+ supernova sample | Frontier: expansion |
| Exoplanet orbits (Kepler's 3rd law) | NASA Exoplanet Archive | Frontier: N-body |
| Ideal gas / Boyle | bundled class dataset (phone pressure sensor where available) | Thermo: gas |

- Datasets are trimmed to a few hundred KB of JSON in `public/data/`, with source, licence and citation in each file. All are public or open-licence, and each licence is checked before shipping.
- The fitting runs client-side: linear and nonlinear least squares in `src/lib/fit.js`, with tests.

### 6.5 University-level modules (phase 5, the upsell)

A first batch is chosen to extend existing engines rather than start from scratch:
- **Lagrangian mechanics:** coupled oscillators and normal modes, extending waves/normal modes.
- **Quantum:** the harmonic oscillator and the hydrogen atom, extending particle-in-a-box.
- **Statistical mechanics:** an Ising phase transition with critical exponents, extending thermo/Ising.
- **Electrodynamics:** Maxwell waves and the Poynting vector, extending EM.
- **Special relativity:** four-vectors and collisions.

Each ships with the full §6.2–6.4 bundle at university level and its own validation (§6.6). Packaged as Classroom+.

### 6.7 Core A-level and IB simulations (new, user decision)

These are the topics teachers teach most weeks, and today they have no simulation. Each ships with the full bundle: derivation, problems, data lab where possible, and validation from day one.

| Simulation | Shows | Data lab |
|---|---|---|
| DC circuits | Drag-and-drop series/parallel circuits. Ammeters, voltmeters, internal resistance, potential dividers, Kirchhoff's laws live. | Bundled I–V data for a filament lamp and a diode |
| Mechanics: forces and projectiles | Free-body diagrams, SUVAT, projectiles with and without drag, momentum and collisions | Phone video frame-stepping of a thrown ball |
| Simple harmonic motion | Mass–spring and pendulum, phase plots, damping and resonance | Phone accelerometer (shares the pendulum lab) |
| Gravitational and electric fields | Field lines, equipotentials, potential wells, orbits and escape velocity | NASA Exoplanet Archive (Kepler's third law) |
| Nuclear decay | Random decay of N nuclei, half-life, activity, decay chains, binding energy curve | Bundled Geiger-count dataset |
| Capacitors (RC) | Charge and discharge curves, the time constant, energy stored | Bundled RC discharge data |

They are built with physics in pure functions from the start (`*Math.js` + tests), matching §6.6. Materials (stress–strain, Young modulus) is covered by problems plus a data lab only, with no simulation in this horizon.

### 6.6 Independent validation of the physics models

**Validation suite:** `tests/validation/<module>/*.test.js`. Per simulation it covers:
1. **Analytic benchmarks:** compare against exact solutions, e.g.:
   - the projectile range;
   - the small-angle pendulum period;
   - particle-in-a-box energies Eₙ = n²h²/8mL²;
   - Snell's law and the thin-lens equation;
   - γ(β);
   - Schwarzschild ISCO at 6M and photon sphere at 3M;
   - the Carnot efficiency;
   - the Lorenz fixed points (±√(β(ρ−1)), ±√(β(ρ−1)), ρ−1).
2. **Invariants:**
   - energy and momentum conservation drift per 10⁴ steps under a threshold;
   - wavefunction normalisation;
   - the spacetime interval.
3. **Convergence:** halving dt must reduce the error at the method's expected order (RK4 about 16×).
4. **Reference data:** CODATA constants; NIST lines within 0.1 %.
5. **Known limits, stated honestly:**
   - SPH fluids and vortex shedding are qualitative (Strouhal number within 20 %, not exact);
   - the black-hole raytrace is an approximation.

**Public report**
- `/validation` lists, per simulation, the method, the tests, the latest CI result, its accuracy and its limitations.
- The report is generated at build time from the Vitest JSON output.
- A downloadable PDF goes in school sales packs.

**Outside review:** at the first paid contract, commission 1–2 freelance physics PhDs to audit the report, budget £300–800 per module batch. Pilot teachers file "this looks wrong" reports through an in-app button.

Coverage gaps to close first: fluids, thermodynamics, acoustics, waves and frontier.

## 7. Phased roadmap (about 32 weeks, full-time)

The phase lengths are the builder's call: phase 0 is 4 weeks, not 2, because extracting physics from components takes time, and the pilots move earlier.

| Phase | Weeks | Ships | Exit criteria |
|---|---|---|---|
| 0. Foundations | 1–4 | A real router (`/sim/…`, `/teach`, `/learn`, `/validation`). Extracting physics into pure `*Math.js` modules for fluids, thermo, acoustics, waves and frontier. Validation suites for those modules. The private `umbra-content` repo with its item schema and sync script; the open checker library in `src/lib/check/`. Rewording the pricing promises until they are true. | All 39 simulations have physics in pure functions and tests in CI. Routes are deep-linkable. Existing prerendered SEO pages unchanged. |
| 1. Classroom core + legal | 3–9 | The schema and RLS (incl. `item_keys` locked to the service role), teacher Google sign-in, classes and codes, login cards, assignments, `api/check`, attempts, the BKT trigger, a basic dashboard, `localStorage` migration. **In parallel from week 3:** the DPA, DPIA, privacy notice and sub-processor list from official templates; pilot outreach. | A teacher creates a class, assigns 5 items, and sees mastery update live. RLS tests prove cross-school isolation and that no client can read `item_keys`. Legal pack published. **Pilots start week 9** (2–3 schools). |
| 2. Core simulations | 8–14 | The 6 core simulations (§6.7) with physics, validation and derivation | Each core simulation passes analytic and invariant tests. Pilot teachers use at least 3 of them in class. |
| 3. Problem banks | 10–18 | Past-paper analysis per board, item writing (~800 items), Next up, hint-only tutor mode with budgets | Each simulation has ≥ 15 items. Each board's spec has ≥ 90 % topic coverage. Tutor eval: 0 final-answer leaks in 200 adversarial prompts. |
| 4. Derivations and data labs | 14–22 | Derivation tabs (A-level plus Beyond) for all 45 simulations, derivation checks, 13 data labs, the fitting library, 10 Manim derivation animations | Every derived formula is cross-checked against its simulation. Each lab works on iOS Safari and Android Chrome. |
| 5. Sellable | 20–26 | The `/validation` report and PDF, school onboarding, CSV and Sheets export, Stripe invoicing for schools, a WCAG 2.2 AA pass, pilot case studies | ≥ 3 pilots weekly by week 20. The first quote sent. A signed contract by week 26. |
| 6. University upsell | 27–32 | The 5 university modules with the full bundle, an LTI 1.3 spike | One university demo. Classroom+ priced. |

Running alongside all phases: the marketing engine (Shorts via the video pipeline and OpenMontage, programmatic SEO for derivation and problem pages, teacher outreach).

## 8. Installed skills and plugins: where each is used

| Area | Skills / plugins / agents |
|---|---|
| Process | `superpowers:writing-plans` → `subagent-driven-development` / `executing-plans`, `using-git-worktrees`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`, `dispatching-parallel-agents`. `ecc:plan-prd`, `ecc:architecture-decision-records` (one ADR per major decision), `ecc:story-lifecycle`, `ecc:verification-loop`. `caveman:lean-build`, `caveman:migration` (localStorage → Supabase), `caveman:safe-refactor` (router), `caveman:surgical-patch`, `caveman:investigate-first`, `caveman:verify-and-stop`. `task-observer`, `graphify` (codebase map before the router refactor) |
| Database, auth, security | `ecc:postgres-patterns`, `ecc:database-migrations`, `ecc:database-reviewer` agent (RLS review), `ecc:security-review` + `ecc:security-reviewer` agent, `ecc:api-design`, `ecc:backend-patterns`, `ecc:error-handling`, `ecc:agent-security-hardening` (tutor prompt-injection limits) |
| Frontend and UX | `ui-ux-pro-max` (+ design-system, ui-styling, brand), `impeccable` (dashboard and onboarding polish), `ecc:dashboard-builder`, `ecc:react-patterns`, `ecc:react-performance`, `ecc:react-reviewer` agent, `ecc:frontend-a11y`, `ecc:accessibility`, `ecc:a11y-architect` agent (WCAG 2.2 for schools), `ecc:make-interfaces-feel-better`, `ecc:motion-*`, `dataviz` (heatmaps, fit plots), `ecc:i18n-sync` (later) |
| Testing | `ecc:tdd-workflow`, `ecc:react-testing`, `ecc:e2e-testing` + `ecc:e2e-runner` agent (teacher/student journeys in Playwright), `ecc:browser-qa`, `ecc:click-path-audit`, `ecc:benchmark` (simulation performance on school Chromebooks) |
| Physics content | `reverse-engineer-tests` (past-paper patterns per board), `ecc:scientific-thinking-literature-review` and `ecc:deep-research` (reference values, numerical methods), `ecc:manim-video` (derivation animations), `ecc:santa-method` / `ecc:council` (two independent model reviews of each derivation and solution before merge), `anthropic-skills:pdf` (validation report), `anthropic-skills:xlsx` (item bank QA sheets) |
| AI tutor | `claude-api` (model choice, prompt caching, streaming), `ecc:prompt-caching-strategy`, `ecc:cost-aware-llm-pipeline`, `ecc:eval-harness` + `ecc:agent-eval` (hint-only compliance eval), Vercel MCP AI Gateway budgets per school |
| Deploy and ops | Vercel MCP (deployments, AI Gateway), `ecc:deployment-patterns`, `ecc:canary-watch`, `ecc:production-audit`, `ecc:cost-tracking` |
| Sales and marketing | marketing-skills: `pricing`, `product-marketing`, `customer-research`, `competitors` / `competitor-profiling` (Isaac Physics, PhET, Seneca, Kerboodle), `sales-enablement`, `prospecting`, `cold-email`, `onboarding`, `signup`, `emails`, `launch`, `cro`, `analytics` / `conversion-tracking`, `churn-prevention`, `referrals`, `content-strategy`, `programmatic-seo`, `schema`, `video`, `social`. `claude-seo:*` (seo-audit, seo-programmatic, seo-schema for LearningResource), `last30days` (what physics teachers say on Reddit and X), `ecc:market-research`, `ecc:investor-materials` (if raising) |
| Content production | `scripts/video` pipeline + OpenMontage (`~/OpenMontage`), Remotion skills, `ecc:remotion-video-creation`, `ecc:video-editing`, `ecc:content-engine`, `ecc:crosspost`, `ecc:social-publisher` |
| Workspace connectors | Google Sheets (outreach CRM, class export), Gmail (teacher outreach drafts, sent only on approval), Google Calendar (pilot demo booking), Google Docs/Slides (DPA, sales deck; or `anthropic-skills:pptx`) |
| Not used, and why | Healthcare, finance, hardware and network skills; non-JS language reviewers. Each was checked and none fits this stack or domain. |

## 9. Success metrics

- **Activation:** a teacher creates a class and assigns within the first session (target ≥ 60 %).
- **Weekly active classes in pilots:** ≥ 3 by week 20.
- **Learning signal:** mastery gain per topic after assignments. Track the median Δp_known.
- **Validation:** 100 % of simulations have analytic plus invariant tests passing in CI.
- **Revenue:** the first signed Classroom contract by week 26.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Item writing volume (~800 items) overwhelms one builder | Generate drafts with Claude from the board patterns, gated by a checker test and two-model review (`santa-method`). The builder reviews 20 % at random each batch. |
| A wrong physics answer reaches a student | Each item's answer is checked by its own test and recomputed from the simulation where possible. The "report a problem" button. Public changelog. |
| Data-protection blocks a school | Minimal data, a DPA template, a published sub-processor list (Supabase, Vercel, Anthropic), UK/EU region Supabase, no student emails |
| Legal paperwork is template-only, with no lawyer review (user decision) | Use the official ICO and DfE templates without changes where possible. Accept each school's own DPA form. Keep a DPIA on file. Revisit paid review at the first contract if a school asks. |
| Content leaks from the public repo | Answers live only in the private `umbra-content` repo and the `item_keys` table. CI in the app repo fails if any `item_keys`-shaped data is committed. |
| AI tutor costs | Hint-only mode, Haiku for hints, prompt caching, per-school budgets |
| Phones without sensors (iOS DeviceMotion permission) | Each lab has a bundled sample dataset fallback |

## 11. Calls made by the builder (please check)

1. Pricing and packaging (§5): the £600/yr department price, and the free versus Pro problem split.
2. Answers kept in a private repo and checked server-side (§6.2).
3. Student login cards with synthetic emails; Google emails are never stored (§6.1).
4. Pilots start week 9, with legal pages built from week 3 (§7).
5. Phase 0 runs 4 weeks; the total timeline grows to about 32 weeks with the core simulations.
6. Mastery model: Bayesian Knowledge Tracing plus fixed review intervals (§6.1).
7. The data-lab list and the university module batch (§6.4, §6.5).
8. Materials has no simulation this horizon (§6.7).

## 12. Left to the builder

Exact UI layouts, BKT parameter tuning after pilot data, item difficulty calibration from attempt data, and the choice of symbolic checker library.
