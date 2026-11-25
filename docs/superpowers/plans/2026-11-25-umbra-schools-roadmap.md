# Umbra for Schools: Master Roadmap

> **For agentic workers:** this is the index. Each phase has (or gets, when it is reached) its own task-level plan. Execute those with superpowers:subagent-driven-development or superpowers:executing-plans. Never execute this roadmap directly.

**Goal:** Turn Umbra into a platform physics departments pay for, in about 32 weeks. It delivers all six reviewer points: progress tracking and personalised learning, harder problem sets, rigorous derivations, data labs, validation, and university modules.

**Architecture:** Extend the existing Vite + React 19 + R3F single-page app, Supabase (UK/EU) and Vercel functions (approach A).
- School data lives in Supabase under row-level security.
- Problem answers live in a private `umbra-content` repo and a service-role-only `item_keys` table, checked server-side by `api/check`.
- The physics lives in pure, tested `*Math.js` modules that feed a public validation report.

**Spec:** `docs/superpowers/specs/2026-11-24-umbra-schools-platform-design.md`

## Global Constraints (apply to every phase plan)

- Never store a student email, real name or any data beyond: display name, class memberships, attempts, mastery.
- Problem answers, worked solutions and wrong-answer feedback never enter this (public, MIT) repo. CI must fail if they do.
- Simulations, derivations and data labs stay free for everyone. Never paywall a simulation.
- The prerendered `/simulations/<topic>/<slug>` pages must stay byte-identical unless a task says otherwise.
- Physics code lives in pure functions in `*Math.js` files with Vitest tests. Validation test names follow `[<simId>] <kind>: <description>`, where kind ∈ `analytic | invariant | convergence | reference`.
- Problem text is original. Exam-board past papers are analysed for patterns only, never reproduced.
- The AI tutor gives hints only on assigned items, never the final value.
- Commit messages carry no `Co-Authored-By` lines (user rule).
- Node 22. Supabase migrations in `supabase/migrations/`. Database tests in `supabase/tests/` (pgTAP, `supabase test db`).

## Phases

| # | Phase | Weeks | Plan file | Status |
|---|---|---|---|---|
| 0 | Foundations | 1–4 | `2026-11-25-phase-0-foundations.md` | **written** |
| 1 | Classroom core + legal + pilot outreach | 3–9 | `2026-11-25-phase-1-classroom-core.md` | **written** |
| 2 | Core A-level simulations | 8–14 | written at week 7 | outline below |
| 3 | Problem banks + tutor hint mode | 10–18 | written at week 9 | outline below |
| 4 | Derivations + data labs | 14–22 | written at week 13 | outline below |
| 5 | Sellable (validation report, onboarding, invoicing, a11y) | 20–26 | written at week 19 | outline below |
| 6 | University modules + LTI spike | 27–32 | written at week 26 | outline below |

**Dependencies**
- 1 needs 0's routes, checker library and content repo.
- 2 needs 0's extraction pattern.
- 3 needs 1's tables and `api/check`, plus 2's simulations (for presets).
- 4 needs 2.
- 5 needs 1, 3 and 4.
- 6 needs 5.

Phases 2, 3 and 4 overlap. Run each in its own worktree (`superpowers:using-git-worktrees`) and merge in phase order.

## Phase outlines (task level for each future plan)

### Phase 2: Core A-level simulations (6 new simulations)

One task per simulation. Each delivers:
- a `src/modules/<id>/<id>Math.js` plus `tests/validation/<id>.validation.test.js`;
- the R3F view;
- a `VIEW_PAGES` entry (explanation, try-this, misconception, worked question, equations) so prerender creates the SEO page;
- a registration in `ROUTABLE` / `renderModule`.

| Task | Simulation | Key validation (analytic) |
|---|---|---|
| 2.1 | `dc-circuits`: a drag-and-drop component graph solved by nodal analysis (modified nodal analysis matrix) | Series and parallel resistance, potential divider, internal resistance r: V = ε − Ir, Kirchhoff's current law at every node to 1e-9 |
| 2.2 | `mechanics`: forces, SUVAT, projectiles with/without quadratic drag, 1D/2D collisions | No-drag range = v²sin2θ/g; momentum conserved in collisions; e = 1 conserves KE |
| 2.3 | `shm`: mass–spring and pendulum, damping, driven resonance | T = 2π√(m/k); amplitude decays as e^(−bt/2m); resonance peak at ω₀ for light damping |
| 2.4 | `fields`: gravitational/electric field lines, equipotentials, orbits | g = GM/r²; v_esc = √(2GM/r); circular orbit energy = −GMm/2r |
| 2.5 | `nuclear-decay`: N stochastic nuclei, half-life, chains | Mean N(t) within 3σ of N₀e^(−λt) (seeded RNG); activity A = λN |
| 2.6 | `capacitors`: RC charge/discharge | V(τ) = V₀/e within 1e-6; energy = ½CV² |

- **Skills:** `ecc:tdd-workflow`, `ui-ux-pro-max`, `impeccable`, `ecc:react-performance`, `ecc:benchmark` (60 fps on a 2020 Chromebook profile), `ecc:frontend-a11y`, `claude-seo:seo-page`.
- **Exit:** every new simulation passes its validation file; Lighthouse performance ≥ 70 on mobile.

### Phase 3: Problem banks + tutor hint mode

| Task | Deliverable |
|---|---|
| 3.1 | Past-paper analysis per board with `reverse-engineer-tests`. Download each board's free past papers and mark schemes into `umbra-content/research/<board>/` (git-ignored PDFs). Output `patterns/<board>.json`: topic weights, command words, mark allocations, traps. |
| 3.2 | Topic tree + `syllabus_map` seed for AQA, OCR A, Edexcel, IB 2023 and CIE (every spec point → `topic_id`), with a coverage report script |
| 3.3 | Item-writing pipeline in `umbra-content`: `scripts/draft.mjs` generates items per topic and pattern through the Anthropic API (`claude-api`); schema check; checker self-test; two-model review (`ecc:santa-method`); a 20 % human-review queue as an xlsx export (`anthropic-skills:xlsx`) |
| 3.4 | ~800 items (15 per simulation × 45, plus ~100 synoptic, plus simulation-free items for uncovered spec points). Coverage ≥ 90 % per board. |
| 3.5 | "Next up" ranking `rankNextUp(state) → Item[3]` (overdue reviews → due ≤ 3 days → weakest topic with prerequisites met) with reason strings, plus the `/learn` UI |
| 3.6 | Tutor hint mode: `api/ai` gains a `mode: 'hint'` that loads `item_keys` server-side and never returns the final value. Hints add to `hints_used`. Per-school budget via Vercel AI Gateway. `ecc:eval-harness`: 200 adversarial prompts, 0 leaks required. |
| 3.7 | Free versus Pro gating of difficulty 4–5 items (RLS on `items` by tier) |

- **Skills:** `reverse-engineer-tests`, `claude-api`, `ecc:prompt-caching-strategy`, `ecc:cost-aware-llm-pipeline`, `ecc:agent-security-hardening`, `ecc:eval-harness`, `ecc:santa-method`, `ecc:council`.

### Phase 4: Derivations + data labs

| Task | Deliverable |
|---|---|
| 4.1 | Derivation content format (`derivations/<simId>.json`: steps with KaTeX, justification, "why", level `alevel|beyond`) plus the `DerivationTab` component |
| 4.2 | Derivations for all 45 simulations at both levels. Each derived formula gets a cross-check test against its `*Math.js` |
| 4.3 | "Fill the missing step" derivation-check items (flow into mastery) |
| 4.4 | `src/lib/fit.js`: linear least squares, Levenberg–Marquardt for 1–3 parameters, residuals, χ², reduced χ² (tested against NIST StRD datasets Norris and Misra1a) |
| 4.5 | `DataLabTab` with dataset loading, a plot (`dataviz`), a fit overlay on the simulation prediction, and an evaluation question |
| 4.6 | Sensor capture: accelerometer (`DeviceMotionEvent` with the iOS permission prompt), microphone FFT (Web Audio), camera luminance. Bundled fallback datasets. |
| 4.7 | 13 labs (10 in spec §6.4 plus 3 core-simulation labs: I–V, Geiger counts, RC). Licence and citation in each `public/data/*.json`. |
| 4.8 | 10 Manim derivation animations (`ecc:manim-video`), reused as Shorts via `scripts/video` and OpenMontage |

- **Skills:** `ecc:deep-research`, `ecc:scientific-thinking-literature-review` (reference values), `dataviz`, `ecc:manim-video`, `ecc:remotion-video-creation`, `ecc:browser-qa` (iOS Safari, Android Chrome).

### Phase 5: Sellable

| Task | Deliverable |
|---|---|
| 5.1 | `scripts/validation-report.mjs`: Vitest JSON → `public/validation.json` (per simulation: checks, pass state, tolerance, limitations from `src/content/validationLimits.js`) |
| 5.2 | `/validation` page and per-simulation "How we know it's right" section, plus a PDF export (`anthropic-skills:pdf`) |
| 5.3 | School onboarding flow (teacher sign-up → school → first class → first assignment in < 5 min, measured) with `marketing-skills:onboarding` and `impeccable` |
| 5.4 | CSV export, plus Google Sheets export with the teacher's Google auth (scope `spreadsheets` requested only at export time) |
| 5.5 | Stripe invoicing: a Classroom product (£600/yr ≤ 150 students, then £3/student), quotes, invoice payment, `schools.plan` and `seats` set by webhook |
| 5.6 | WCAG 2.2 AA pass on `/teach`, `/learn` and item players (`ecc:a11y-architect`, `ecc:accessibility`) |
| 5.7 | Pilot case studies plus the sales pack (`marketing-skills:sales-enablement`, `anthropic-skills:pptx`), and pricing-page copy (`marketing-skills:pricing`, `copywriting`) |
| 5.8 | "Report a problem" button → GitHub issue via `api/report` (rate-limited, no personal data) |

### Phase 6: University modules + LTI

| Task | Deliverable |
|---|---|
| 6.1–6.5 | Lagrangian coupled oscillators, the quantum harmonic oscillator and hydrogen, Ising critical exponents, Maxwell waves and Poynting, four-vectors and collisions. Each with math, validation, derivation, problems and a lab where possible. |
| 6.6 | LTI 1.3 launch spike (Canvas test instance) |
| 6.7 | Classroom+ pricing and a university demo |

## Running alongside every phase

| Stream | Cadence | Skills / tools |
|---|---|---|
| Teacher outreach CRM | weekly | Google Sheets connector (CRM sheet), Gmail drafts (**sent only after user approval**), Google Calendar (demo slots), `marketing-skills:prospecting`, `cold-email`, `customer-research`, `last30days` (what teachers say) |
| Shorts | 2 per week | `scripts/video/make.mjs`, OpenMontage (`~/OpenMontage`), Remotion skills, `marketing-skills:video`, `social`, `ecc:crosspost` |
| SEO | per content release | `claude-seo:seo-programmatic` (derivation and problem landing pages: stems only, never answers), `claude-seo:seo-schema` (LearningResource, Quiz), `marketing-skills:programmatic-seo` |
| Competitors | monthly | `marketing-skills:competitors` / `competitor-profiling` (Isaac Physics, PhET, Seneca, Kerboodle), `ecc:market-research` |
| Quality gates | every task | `superpowers:test-driven-development`, `requesting-code-review`, `verification-before-completion`. `ecc:security-reviewer` on any RLS / `api/` change; `ecc:database-reviewer` on migrations; `ecc:react-reviewer` on UI; `caveman:verify-and-stop` before closing a phase |
| Decisions | per major decision | `ecc:architecture-decision-records` → `docs/adr/NNNN-*.md` |
| Ops | per deploy | Vercel MCP (deployments, AI Gateway budgets), `ecc:canary-watch`, `ecc:production-audit`, `ecc:cost-tracking` |
