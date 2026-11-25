# Phase 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the app deep-linkable areas (`/teach`, `/learn`, `/join`, `/validation`).
- Move every untested module's physics into pure, tested functions.
- Ship the answer-checking library.
- Set up the private content repo.
- Make the pricing page truthful.

**Architecture:**
- **Routing:** a pure route parser/formatter (`src/lib/routes.js`) replaces the regex helpers in `src/App.jsx`. New areas render as lazy components.
- **Physics:** extracted from JSX into `*Math.js` beside each module, with validation suites in `tests/validation/`.
- **Answer checking:** pure functions in `src/lib/check/`, used later by `api/check`.

**Tech Stack:** React 19, Vite 8, Vitest 3, Playwright (`@playwright/test`), mathjs (new, for expression equivalence).

**Spec:** `docs/superpowers/specs/2026-11-24-umbra-schools-platform-design.md` (§3, §6.2, §6.6, §7 phase 0). Roadmap: `docs/superpowers/plans/2026-11-25-umbra-schools-roadmap.md`.

## Global Constraints

See the roadmap's Global Constraints. The ones that bite this phase:
- The prerendered `/simulations/...` pages stay byte-identical.
- Validation test names follow `[<simId>] <kind>: <description>`.
- No answers in this repo.
- No `Co-Authored-By` in commits.

## Review Focus

1. **Shared links:** `?s=<state>` on any URL must still apply the shared state and then be stripped. Test in Task 1 (`parseRoute` keeps `search`) and Task 2 (e2e).
2. **Legacy `#module` links** must still open the module. Test in Task 2 (e2e `/#optics`).
3. **Unknown paths** (`/teachx`, `/simulations/nope`) must fall back to home, not a blank screen. Test in Task 1.
4. **Answer formats:** `"2,000"`, `"2e3"`, `"2.0 km"`, `" 2000 m "` and `"2000m"` must all equal 2000 m within tolerance. A wrong unit dimension (`"2000 s"`) must be wrong, never a crash. Test in Task 9.
5. **Randomised physics:** extracted physics with randomness must take an injectable RNG, so validation is deterministic. Test in Tasks 4 and 7 (seeded `mulberry32`).

---

### Task 1: Pure route model

**Files:**
- Create: `src/lib/routes.js`
- Test: `src/lib/routes.test.js`

**Interfaces:**
- Produces:
  - `parseRoute(pathname: string, search?: string): Route`
  - `formatRoute(route: Route): string`
  - `AREAS = ['home','sim','teach','learn','join','validation']`
- `Route` is one of:
  - `{ area:'home' }`
  - `{ area:'sim', module:string, view:string|null }`
  - `{ area:'teach'|'learn'|'validation', rest:string[] }`
  - `{ area:'join', code:string|null }`
- Every route also carries `search:string` (preserved as given, including `?s=`).

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { parseRoute, formatRoute } from './routes'

describe('parseRoute', () => {
  it('sim module + view', () => expect(parseRoute('/simulations/optics/lens')).toMatchObject({ area: 'sim', module: 'optics', view: 'lens' }))
  it('sim module only, trailing slash', () => expect(parseRoute('/simulations/optics/')).toMatchObject({ area: 'sim', module: 'optics', view: null }))
  it('teach with rest', () => expect(parseRoute('/teach/classes/abc')).toMatchObject({ area: 'teach', rest: ['classes', 'abc'] }))
  it('join reads and normalises ?code', () => expect(parseRoute('/join', '?code= ab3 k9x ')).toMatchObject({ area: 'join', code: 'AB3K9X' }))
  it('keeps search for shared state', () => expect(parseRoute('/simulations/optics', '?s=xyz').search).toBe('?s=xyz'))
  it('unknown path falls back home', () => expect(parseRoute('/teachx')).toMatchObject({ area: 'home' }))
  it('module ids are validated by the caller, not here', () => expect(parseRoute('/simulations/nope')).toMatchObject({ area: 'sim', module: 'nope' }))
})

describe('formatRoute', () => {
  it.each(['/simulations/optics/lens', '/simulations/optics', '/teach/classes/abc', '/validation', '/'])('round-trips %s', (p) =>
    expect(formatRoute(parseRoute(p))).toBe(p))
  it('join with code', () => expect(formatRoute({ area: 'join', code: 'AB3K9X', search: '' })).toBe('/join?code=AB3K9X'))
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/routes.test.js`
Expected: FAIL, "Failed to resolve import ./routes".

- [ ] **Step 3: Implement `parseRoute` / `formatRoute` in `src/lib/routes.js`**

Class codes are normalised by removing whitespace and upper-casing. The simulations regex stays `^\/simulations\/([a-z-]+)(?:\/([a-z0-9-]+))?\/?$` (the current `SIM_PATH`).

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/routes.test.js`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routes.js src/lib/routes.test.js
git commit -m "feat(routes): pure route parser and formatter"
```

### Task 2: Wire routes into the app, with area shells

**Files:**
- Modify: `src/App.jsx` (replace `SIM_PATH`, `moduleFromLocation` and `viewFromLocation` with `parseRoute`; add area rendering before the module UI)
- Create: `src/areas/AreaShell.jsx` (header with the Umbra mark, a back-to-simulations link, and `children`)
- Create: `src/areas/TeachArea.jsx`, `src/areas/LearnArea.jsx`, `src/areas/JoinArea.jsx`, `src/areas/ValidationArea.jsx` (each an `AreaShell` with an `<h1>` placeholder: "Teacher dashboard", "Your learning", "Join a class", "How we know it's right")
- Create: `playwright.config.js`, `tests/e2e/routes.spec.js`
- Modify: `package.json` (devDependency `@playwright/test@1.64.1`; script `"test:e2e": "playwright test"`)

**Interfaces:**
- Consumes: Task 1 `parseRoute`, `formatRoute`.
- Produces:
  - `useRoute(): Route`, a hook in `src/lib/useRoute.js` that subscribes to `popstate`;
  - `navigate(route: Route, { replace?: boolean }): void` in `src/lib/routes.js`. It calls `history.pushState` and dispatches `popstate`.

- [ ] **Step 0: Map the routing code before touching it**

Run `graphify` on `src/App.jsx`, `src/store/useModuleStore.js` and `src/components/ModulePicker.jsx`. Note every reader of `window.location` (`App.jsx:179-311`, `ModulePicker.jsx:103`, `GuideModal.jsx:187`). Use `caveman:safe-refactor`.

- [ ] **Step 1: Write the failing e2e tests** in `tests/e2e/routes.spec.js`

Config: `webServer: { command: 'npx vite --port 5199 --strictPort', port: 5199, reuseExistingServer: true }`, `use.baseURL: 'http://localhost:5199'`.

Each test:
- `goto('/simulations/optics/lens')` → the lens view's tab is selected (`getByRole('tab', { name: /lens/i })` has `aria-selected="true"`).
- `goto('/validation')` → heading "How we know it's right".
- `goto('/teach')`, then `page.goBack()` from a module → the URL is restored.
- `goto('/#optics')` → the URL becomes `/simulations/optics`.
- `goto('/simulations/optics?s=<valid share code>')` → the `s` param is removed after load. (Generate a valid code in the test from `encodeShareState` in `src/components/ShareButton.jsx`.)
- `goto('/simulations/nope')` → the module picker is visible (home).

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run test:e2e`. Expected: the area tests fail (no `/validation` heading).

- [ ] **Step 3: Replace the regex helpers with `parseRoute`. Render `<…Area />` lazily when `route.area` ∈ teach/learn/join/validation; otherwise keep the current module flow unchanged.**

- [ ] **Step 4: Run e2e and unit tests**

Run: `npm run test:e2e && npm test`. Expected: all pass.

- [ ] **Step 5: Verify the prerender is byte-identical**

Run:
```bash
git stash && npm run build && find dist/simulations -name index.html -exec shasum {} + | sort > /tmp/pre.txt
git stash pop && npm run build && find dist/simulations -name index.html -exec shasum {} + | sort > /tmp/post.txt
diff /tmp/pre.txt /tmp/post.txt
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/areas src/lib/useRoute.js src/lib/routes.js playwright.config.js tests/e2e package.json package-lock.json
git commit -m "feat(routes): /teach /learn /join /validation areas on the shared route model"
```

### Task 3: Validation harness

**Files:**
- Create: `tests/validation/helpers.js`
- Test: `tests/validation/helpers.test.js`

**Interfaces:**
- Produces:
  - `mulberry32(seed:number): () => number`
  - `relErr(a:number, b:number): number`
  - `convergenceOrder(errCoarse:number, errFine:number, ratio=2): number` (returns log₂(errCoarse/errFine))
  - `integrate(f:(x:number)=>number, a:number, b:number, n=2000): number` (Simpson's rule)

- [ ] **Step 1: Failing tests:**
  - `mulberry32(1)()` is deterministic: two generators with seed 1 return equal first values;
  - `integrate(Math.sin, 0, Math.PI)` is within 1e-9 of 2;
  - `convergenceOrder(16e-4, 1e-4)` equals 4.
- [ ] **Step 2: Run `npx vitest run tests/validation/helpers.test.js`.** Expect FAIL.
- [ ] **Step 3: Implement in `tests/validation/helpers.js`.**
- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** `test(validation): shared helpers (seeded rng, simpson, convergence order)`.

### Task 4: Thermodynamics physics extraction + validation

**Files:**
- Create: `src/modules/thermodynamics/thermoMath.js`
- Modify: `GasSimulation.jsx`, `IsingModel.jsx`, `HeatEngine.jsx`, `Entropy.jsx` (import from `thermoMath.js` instead of inline formulas). Fold `carnot.js`'s `hotReservoirT` into `thermoMath.js` and re-export it from `carnot.js`.
- Test: `tests/validation/thermodynamics.validation.test.js`

**Interfaces:**
- Produces:
  - `maxwellBoltzmannPdf(v, m, T, k=1): number`
  - `meanSpeed(m, T, k=1): number`
  - `idealGasPressure(N, T, V, k=1): number`
  - `carnotEfficiency(Tc, Th): number`
  - `isingEnergy(grid:Int8Array, L:number, J=1): number`
  - `isingMagnetisation(grid, L): number` (per spin, in [-1, 1])
  - `isingSweep(grid, L, beta, rng): void` (one Metropolis sweep, in place)
  - `entropyMixing(nA, nB): number` (S/k = ln C(nA+nB, nA) via log-gamma)

- [ ] **Step 1: Failing tests** (names follow the convention):
  - `[gas] analytic: MB pdf integrates to 1`: `integrate(v => maxwellBoltzmannPdf(v,1,1), 0, 20)` within 1e-6 of 1.
  - `[gas] analytic: mean speed √(8kT/πm)`: the numerical ∫v·pdf equals `meanSpeed(1,1)` within 1e-6.
  - `[engine] analytic: Carnot η`: `carnotEfficiency(300, 500)` is 0.4.
  - `[ising] analytic: ground-state energy`: an all-up L=16 periodic grid gives `isingEnergy` = −2·16².
  - `[ising] invariant: low-T order`: β=1.0, seeded `mulberry32(7)`, 400 sweeps from random → |m| > 0.9.
  - `[ising] invariant: high-T disorder`: β=0.2, the same seed → |m| < 0.2.
- [ ] **Step 2: Run `npx vitest run tests/validation/thermodynamics.validation.test.js`.** Expect FAIL.
- [ ] **Step 3: Implement `thermoMath.js`. Replace the inline code in the four components.** `isingSweep` must take `rng`; components pass `Math.random`.
- [ ] **Step 4: Run the tests, then `npm run dev` and check all four thermo views render and animate** (`ecc:browser-qa`, a screenshot per view).
- [ ] **Step 5: Commit** `refactor(thermo): physics in thermoMath.js with validation suite`.

### Task 5: Waves physics extraction + validation

**Files:**
- Create: `src/modules/wave/waveMath.js`
- Modify: `RippleTank.jsx`, `DoubleSlit.jsx`, `NormalModes.jsx`
- Test: `tests/validation/wave-mechanics.validation.test.js`

**Interfaces:**
- Produces:
  - `stringModeFrequency(n, L, T, mu): number` (f = n/(2L)·√(T/μ))
  - `doubleSlitIntensity(theta, d, a, lambda): number` (normalised: cos²(πd sinθ/λ) · sinc²(πa sinθ/λ))
  - `waveStep(u:Float32Array, uPrev:Float32Array, out:Float32Array, nx, ny, c, dt, dx): void` (second-order finite difference)
  - `waveEnergy(u, uPrev, nx, ny, c, dt, dx): number`

- [ ] **Step 1: Failing tests:**
  - `[modes] analytic: fundamental`: `stringModeFrequency(1, 0.5, 100, 0.01)` within 1e-12 of 100.
  - `[slit] analytic: bright fringe at d sinθ = λ`: `doubleSlitIntensity(Math.asin(500e-9/2e-6), 2e-6, 0, 500e-9)` within 1e-9 of 1.
  - `[slit] analytic: dark fringe at d sinθ = λ/2`: the value is < 1e-12.
  - `[ripple] invariant: energy drift`: a Gaussian pulse at CFL 0.5, 2000 steps, with reflecting edges, gives relative energy drift < 2 %.
- [ ] **Steps 2–5:** run (FAIL) → implement and replace the inline code → run (PASS) plus browser check of the 3 views → commit `refactor(waves): physics in waveMath.js with validation suite`.

### Task 6: Acoustics physics extraction + validation

**Files:**
- Create: `src/modules/acoustic/acousticMath.js`
- Modify: `AcousticModule.jsx` (947 lines; extract only the formulas; no UI restructure)
- Test: `tests/validation/acoustic-physics.validation.test.js`

**Interfaces:**
- Produces:
  - `pipeHarmonics(f0, end:'open'|'closed', count): number[]`
  - `stringHarmonics(f0, count): number[]`
  - `chladniAmplitude(m, n, x, y): number` (square plate: cos(nπx)cos(mπy) − cos(mπx)cos(nπy), on [0, 1]²)
  - `lissajous(t, a, b, delta): [number, number]`

- [ ] **Step 1: Failing tests:**
  - `[harmonics] analytic: closed pipe odd harmonics`: `pipeHarmonics(100,'closed',3)` equals `[100,300,500]`.
  - `[harmonics] analytic: open pipe`: `[100,200,300]`.
  - `[cymatics] analytic: diagonal nodal line`: for m≠n, `chladniAmplitude(m,n,x,x)` = 0 for 10 sample x.
  - `[lissajous] analytic: circle`: a=b=1, δ=π/2 → x²+y² = 1 at 20 sample t.
- [ ] **Steps 2–5:** as in Task 5. Commit `refactor(acoustics): physics in acousticMath.js with validation suite`.

### Task 7: Fluids physics extraction + validation (qualitative limits stated)

**Files:**
- Create: `src/modules/fluid-dynamics/fluidMath.js`
- Modify: `SPH.jsx`, `StreamLines.jsx`, `VortexShedding.jsx`
- Test: `tests/validation/fluid-dynamics.validation.test.js`

**Interfaces:**
- Produces:
  - `cubicSplineKernel2D(r, h): number`
  - `cylinderFlowVelocity(x, y, U, R): [number, number]` (potential flow)
  - `sheddingFrequency(U, D, St=0.2): number`
  - `sphStep(particles, params, rng): void`

- [ ] **Step 1: Failing tests:**
  - `[sph] analytic: kernel normalisation`: ∫∫W dA over a disk of radius 2h equals 1 within 1e-3 (polar `integrate`).
  - `[streamlines] analytic: no flow through the surface`: the radial velocity at r=R is within 1e-12 of 0 for 12 angles.
  - `[streamlines] analytic: far field`: at (50R, 0) the velocity is within 1e-3 of [U, 0].
  - `[vortex] reference: Strouhal`: `sheddingFrequency(1, 0.1)` = 2.
  - `[sph] invariant: mass conserved`: the particle count and total mass are unchanged after 500 steps (seeded).
- [ ] **Step 2: Add `src/content/validationLimits.js` with:**

```js
export const VALIDATION_LIMITS = {
  sph: 'Qualitative: SPH with artificial viscosity; shows flow behaviour, not exact pressures.',
  vortex: 'Qualitative: vortex street frequency follows Strouhal ≈ 0.2 within about 20 %.',
  blackhole: 'Approximate: ray-marched lensing for visual intuition, not a full Kerr ray trace.',
}
```

- [ ] **Steps 3–5:** implement and replace the inline code → run (PASS) plus browser check → commit `refactor(fluids): physics in fluidMath.js with validation suite and stated limits`.

### Task 8: Frontier validation (N-body integrator + black-hole radii)

**Files:**
- Modify: `src/modules/frontier/frontierMath.js` (add exports), `NBody.jsx`, `BlackHole.jsx`
- Test: `tests/validation/frontier-physics.validation.test.js`

**Interfaces:**
- Produces:
  - `leapfrogStep(bodies:{x,y,vx,vy,m}[], dt, G=1, soft=0): void`
  - `totalEnergy(bodies, G=1, soft=0): number`
  - `photonSphereRadius(M): number` (3M, G=c=1)
  - `iscoRadius(M): number` (6M)
  - Existing exports are unchanged.

- [ ] **Step 1: Failing tests:**
  - `[nbody] invariant: energy drift`: a two-body circular orbit (m=1 and 1e-3, r=1), dt=1e-3, 1e4 steps → relative energy drift < 1e-5.
  - `[nbody] analytic: Kepler period`: the measured period is within 1e-3 of 2π√(r³/GM).
  - `[nbody] convergence: second order`: an energy-error ratio of dt=2e-3 versus 1e-3 gives `convergenceOrder` within 0.3 of 2.
  - `[blackhole] analytic: photon sphere and ISCO`: `photonSphereRadius(1)` = 3 and `iscoRadius(1)` = 6.
  - `[expansion] analytic: Hubble law`: `hubbleExpansion(100, 70)` = 7000.
  - `[rotationcurve] analytic: Keplerian falloff`: `keplerianVelocity(4r)/keplerianVelocity(r)` → 0.5 for r ≫ a.
- [ ] **Steps 2–5:** run (FAIL) → implement, and use `leapfrogStep` in `NBody.jsx` → run (PASS) plus browser check → commit `feat(frontier): validated leapfrog integrator and black-hole radii`.

### Task 9: Answer-checking library

**Files:**
- Create: `src/lib/check/units.js`, `numeric.js`, `choice.js`, `order.js`, `expression.js`, `index.js`
- Test: `src/lib/check/check.test.js`
- Modify: `package.json` (dependency `mathjs@15.1.0`)

**Interfaces:**
- Produces (all from `src/lib/check/index.js`):
  - `parseQuantity(input:string): { value:number, unit:string|null } | null` (accepts `,` thousands separators, `e` notation, an optional space before the unit)
  - `toSI(value:number, unit:string|null): { value:number, dim:string } | null`. It covers the SI prefixes p n µ/u m c k M G on m, s, g, A, K, mol, J, W, V, Ω/ohm, N, Pa, Hz, C, F, T, eV, plus `min`, `h`, `°C` (offset).
  - `checkNumeric(response:string, key:{ value:number, unit:string|null, rel_tol?:number=0.01, sig_figs?:number }): CheckResult`
  - `checkChoice(response:string, key:{ answer:string }): CheckResult`
  - `checkOrder(response:string[], key:{ order:string[] }): CheckResult`
  - `checkExpression(response:string, key:{ expr:string, vars:Record<string,[number,number]> }): CheckResult` (equivalence by evaluating at 6 seeded random points, rel 1e-6)
  - `checkResponse(answerType:'numeric'|'choice'|'order'|'expression', key, response): CheckResult`
  - `matchWrongAnswer(response, wrong:{ value:string, feedback_id:string }[]): string|null`
  - `CheckResult = { correct:boolean, reason:'ok'|'value'|'unit'|'format'|'sig_figs', normalised?:string }`

- [ ] **Step 1: Failing tests (Review Focus item 4):**

```js
const key = { value: 2000, unit: 'm', rel_tol: 0.01 }
it.each(['2000 m', '2,000 m', '2e3 m', '2.0 km', ' 2000 m ', '2000m'])('accepts %s', (r) => expect(checkNumeric(r, key).correct).toBe(true))
it('rejects wrong dimension', () => expect(checkNumeric('2000 s', key)).toMatchObject({ correct: false, reason: 'unit' }))
it('rejects garbage without throwing', () => expect(checkNumeric('two thousand', key)).toMatchObject({ correct: false, reason: 'format' }))
it('rejects outside tolerance', () => expect(checkNumeric('2100 m', key).correct).toBe(false))
it('celsius offset', () => expect(checkNumeric('27 °C', { value: 300.15, unit: 'K', rel_tol: 0.001 }).correct).toBe(true))
it('sig figs enforced when set', () => expect(checkNumeric('2000.0 m', { ...key, sig_figs: 2 })).toMatchObject({ correct: false, reason: 'sig_figs' }))
it('expression equivalence', () => expect(checkExpression('m*v^2/2', { expr: '0.5*m*v^2', vars: { m: [1, 5], v: [1, 10] } }).correct).toBe(true))
it('expression non-equivalence', () => expect(checkExpression('m*v^2', { expr: '0.5*m*v^2', vars: { m: [1, 5], v: [1, 10] } }).correct).toBe(false))
it('choice is case/space-insensitive', () => expect(checkChoice(' b ', { answer: 'B' }).correct).toBe(true))
it('order', () => expect(checkOrder(['c', 'a', 'b'], { order: ['c', 'a', 'b'] }).correct).toBe(true))
it('wrong-answer match', () => expect(matchWrongAnswer('1000 m', [{ value: '1000 m', feedback_id: 'halved' }])).toBe('halved'))
```

- [ ] **Step 2: Run `npx vitest run src/lib/check`.** Expect FAIL.
- [ ] **Step 3: Implement.** `checkExpression` uses mathjs `evaluate` with the scope sampled by `mulberry32(42)` (copy the 6-line function into `src/lib/check/rng.js`; tests may not import from `tests/`).
- [ ] **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** `feat(check): answer-checking library (numeric+units, choice, order, expression)`.

### Task 10: Private content repo `umbra-content`

**Files (new repo, outside this one):**
- `README.md`
- `schema/item.schema.json`
- `items/_examples/sr-gamma-001.json`
- `scripts/validate.mjs`
- `.github/workflows/validate.yml`
- `package.json`

**Interfaces:**
- Consumes: Task 9's `checkResponse`. Copy `src/lib/check/` in via a `scripts/sync-check-lib.mjs` that copies from a sibling checkout of `physics-sandbox` at a pinned commit. Record the commit hash in `check-lib.lock`.
- Produces: the item schema later phases rely on:

```json
{ "id": "string (topic-slug-NNN)", "version": 1, "kind": "problem|sim_task|derivation_check|data_lab",
  "topic_ids": ["string"], "difficulty": 1, "syllabus": { "aqa": ["3.6.1.2"], "ib": ["C.1"] },
  "stem": "KaTeX string", "parts": [{ "id": "a", "stem": "…", "answer_type": "numeric|choice|order|expression",
  "choices": ["…"], "marks": 1 }], "sim_preset": { "module": "special-relativity", "view": "timedilation", "state": {} },
  "key": { "a": { "value": 5.03, "unit": null, "rel_tol": 0.01 } },
  "solution": ["step KaTeX", "…"], "wrong_answers": { "a": [{ "value": "2.2", "feedback_id": "forgot-gamma", "feedback": "…" }] } }
```

`stem`, `parts` and `sim_preset` are public. `key`, `solution` and `wrong_answers` are private (they go to `item_keys`).

- [ ] **Step 1: Ask the user before creating the GitHub repo.** It is outward-facing. Proposed: `gh repo create sub7an/umbra-content --private`.
- [ ] **Step 2: Write `scripts/validate.mjs`.** It validates every `items/**/*.json` against the schema (ajv). For each part, it runs `checkResponse(answer_type, key[part], String(key[part].value))` and requires `correct:true` (self-consistency). It exits non-zero on any failure.
- [ ] **Step 3: Add one valid and one deliberately broken example. Run `node scripts/validate.mjs`.** Expected: exit 1, naming the broken file. Fix the broken one, rerun, and expect exit 0.
- [ ] **Step 4: Add the CI workflow running `npm ci && node scripts/validate.mjs`. Push. Confirm the run passes (`gh run watch`).**
- [ ] **Step 5: Add the guard in this repo.**
  - Create `scripts/check-no-answers.mjs`: it fails if any tracked `*.json` contains both `"key"` and `"solution"` top-level fields.
  - Wire it into `.github/workflows/test.yml` before `npm test`.
  - Commit `ci: guard against answer keys in the public repo`.

### Task 11: Truthful pricing copy

**Files:**
- Modify: `src/components/PricingPanel.jsx` (the `TIERS` Classroom entry)

- [ ] **Step 1: Replace the Classroom features with exactly:**
  - `'Everything in Pro, for every student'`
  - `'Teacher dashboard & progress tracking (pilot)'`
  - `'Syllabus-mapped problem sets: AQA, OCR, Edexcel, IB, CIE (in development)'`
  - `'UK/EU data hosting · no student emails'`
  - `'Free 60-day pilot for departments'`

  Set the CTA to `'Join the pilot →'`. Remove "LMS embeds" and "FERPA-friendly" (not true yet).
- [ ] **Step 2: Run `npm run dev`. Open the pricing panel and screenshot it** (`ecc:browser-qa`). Check the copy fits without overflow at 375 px and 1440 px.
- [ ] **Step 3: Commit** `copy(pricing): Classroom tier lists only what exists or is in pilot`.

### Task 12: Phase 0 exit check

- [ ] Run `npm test && npm run test:e2e && npm run build && npm run lint`. All are green.
- [ ] `ls tests/validation/*.validation.test.js | wc -l` returns 5, and the existing `*Math.test.js` still pass.
- [ ] Prerender is byte-identical (Task 2 Step 5 commands) against the pre-phase commit.
- [ ] Run `caveman:verify-and-stop` against this plan's tasks. Request a whole-branch review (`superpowers:requesting-code-review`, plus the `ecc:react-reviewer` agent for `src/App.jsx`).
- [ ] Write ADR `docs/adr/0001-content-repo-and-server-side-checking.md` (`ecc:architecture-decision-records`).
