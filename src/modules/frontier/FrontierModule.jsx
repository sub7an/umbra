import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import RotationCurve from './RotationCurve'
import ExpansionSim from './ExpansionSim'
import BlackHole, { isMobile } from './BlackHole'
import NBody from './NBody'
import useModuleStore from '../../store/useModuleStore'
import {
  keplerianVelocity,
  observedRotationVelocity,
  rotationDiscrepancy,
  darkMatterFraction,
  hubbleExpansion,
  toHubbleUnits,
} from './frontierMath'

const VIEWS = [
  { id: 'rotationcurve', label: 'Rotation Curves' },
  { id: 'expansion', label: 'Hubble Expansion' },
  { id: 'blackhole', label: 'Black Hole' },
  { id: 'nbody', label: 'N-Body' },
]

const CAMERA_POSITIONS = {
  rotationcurve: [0, 4.5, 9],
  expansion: [0, 8, 12],
  blackhole: [0, 2.5, 6],
  nbody: [0, 7, 8],
}

function buildExplanation(view, fpRadius, hubble, bhMass) {
  switch (view) {
    case 'blackhole': {
      const Rs    = (bhMass * 0.5).toFixed(3)
      const bCrit = (bhMass * 0.5 * 2.598).toFixed(3)
      return `The shader bends each background ray by δ ≈ 4·b_crit²/b². That 1/b² falloff diverges sharply near the photon sphere and tapers at distance, giving a convincing ring without solving geodesic equations. The real Schwarzschild deflection goes as 1/b, so this exaggerates strong-field bending for visual effect while preserving the key structure: shadow, photon ring, and weak lensing.

Photon capture radius here is b_crit = ${bCrit}. Rays inside that threshold fall in; rays just outside escape after nearly orbiting once, forming the bright ring. The accretion disk uses Keplerian rotation (ω ∝ r⁻³/²), so the inner edge spins fastest. A real GR renderer would trace null geodesics through curved spacetime. This one does not.`
    }

    case 'rotationcurve': {
      const disc = rotationDiscrepancy(fpRadius)
      const dmf = darkMatterFraction(fpRadius) * 100
      return `At r = ${fpRadius.toFixed(2)}, measured orbital velocity is ${observedRotationVelocity(fpRadius).toFixed(3)}, but gravity from visible mass alone predicts ${keplerianVelocity(fpRadius).toFixed(3)}. That gap of ${disc.toFixed(3)} means ${dmf.toFixed(1)}% of the enclosed mass is invisible. At large radii, the unseen mass dominates completely.

Flat rotation curves are reproducible across hundreds of galaxies. The extra mass is real. Calling it "dark matter" is just a label for the shortfall. Whether it's a new particle, a tweak to gravity (MOND, TeVeS), primordial black holes, or something else is still open. No dark matter particle has been detected directly.`
    }

    case 'expansion': {
      const H_km = toHubbleUnits(hubble)
      return `Galaxies recede at v = H₀·d in every direction. At H₀ = ${hubble.toFixed(2)} (≈ ${H_km} km/s/Mpc), a galaxy 1 Mpc out moves away at ${hubble.toFixed(2)} units/s; at 2 Mpc, twice that. Every observer anywhere in the universe sees the same recession law.

Cosmic expansion is confirmed through redshifts, Cepheid distances, and Type Ia supernovae. Expansion has been accelerating since around z ≈ 0.7, confirmed in 1998. Something is driving it, labeled "dark energy" or the cosmological constant Λ. Its nature is unknown. There's also the Hubble tension: the local distance ladder gives H₀ ≈ 73 km/s/Mpc, while the CMB gives ≈ 67.4. That 5σ gap has no agreed resolution.`
    }

    case 'nbody':
      return `Newton's law of gravitation couples every pair of bodies: F = G·m₁m₂/r². With 3 or more bodies, the system has no general closed-form solution — the three-body problem has been open since Newton. Trajectories become chaotic: arbitrarily small differences in initial conditions diverge exponentially (Lyapunov instability).

The figure-8 choreographic solution (Chenciner & Montgomery, 2000) is a rare periodic exception: three equal masses chase each other on the same figure-8 curve indefinitely. Any perturbation breaks it. Integration here uses 4th-order Runge-Kutta with gravitational softening ε to avoid singularities, running 4 sub-steps per frame for RK4 accuracy.`

    default:
      return ''
  }
}

function buildEquations(view, fpRadius, hubble, vo, vk, bhMass) {
  switch (view) {
    case 'blackhole': {
      const Rs    = (bhMass * 0.5).toFixed(3)
      const bCrit = (bhMass * 0.5 * 2.598).toFixed(3)
      const rPh   = (bhMass * 0.5 * 1.5).toFixed(3)
      return {
        domain: 'GENERAL RELATIVITY · GRAVITATIONAL LENSING',
        // Show the actual shader formula, not the true Schwarzschild formula
        primaryEq: `\\delta \\approx \\dfrac{4\\,b_{\\rm crit}^2}{b^2}\\quad\\textcolor{#f59e0b}{(\\text{approx.})}`,
        derivedEqs: [
          {
            label: 'True Schwarzschild α',
            eq: `\\textcolor{#4a7a74}{\\alpha_{\\rm true} = \\dfrac{2R_s}{b} \\;\\text{(not used)}}`,
          },
          { label: 'Shadow radius', eq: `b_{\\rm crit} = \\dfrac{3\\sqrt{3}}{2}R_s = ${bCrit}\\text{ u}` },
          { label: 'Photon sphere', eq: `r_{\\rm ph} = \\tfrac{3}{2}R_s = ${rPh}\\text{ u}` },
          { label: 'Event horizon', eq: `R_s = ${Rs}\\text{ u} = 2GM/c^2` },
        ],
      }
    }

    case 'rotationcurve':
      return {
        domain: 'GALACTIC KINEMATICS · MISSING MASS',
        primaryEq: `\\textcolor{#5e6ad2}{v_{\\mathrm{obs}}} \\gg \\textcolor{#f59e0b}{v_{\\mathrm{kep}}}`,
        derivedEqs: [
          {
            label: 'Keplerian (visible mass)',
            eq: `\\textcolor{#f59e0b}{v_{\\mathrm{kep}}} = \\sqrt{\\dfrac{GM(r)}{r}}`,
          },
          {
            label: `r = ${fpRadius.toFixed(2)}`,
            eq: `\\textcolor{#5e6ad2}{v_{\\mathrm{obs}}} = ${vo.toFixed(3)},\\;\\textcolor{#f59e0b}{v_{\\mathrm{kep}}} = ${vk.toFixed(3)}`,
          },
        ],
      }

    case 'expansion': {
      const H_km = toHubbleUnits(hubble)
      return {
        domain: 'COSMOLOGY · HUBBLE FLOW',
        primaryEq: `v = \\textcolor{#f59e0b}{H_0}\\,\\textcolor{#e040fb}{d}`,
        derivedEqs: [
          {
            label: 'Current H₀',
            eq: `\\textcolor{#f59e0b}{H_0} = ${hubble.toFixed(2)} \\approx ${H_km}\\text{ km/s/Mpc}`,
          },
          {
            label: 'Hubble tension',
            eq: `|\\Delta H_0| \\approx 5\\sigma\\;\\text{(unresolved)}`,
          },
        ],
      }
    }

    case 'nbody':
      return {
        domain: 'CELESTIAL MECHANICS · CHAOS THEORY',
        primaryEq: `\\mathbf{F}_i = G\\sum_{j\\neq i}\\dfrac{m_j(\\mathbf{r}_j-\\mathbf{r}_i)}{|\\mathbf{r}_j-\\mathbf{r}_i|^3+\\varepsilon^3}`,
        derivedEqs: [
          { label: 'Energy (conserved)', eq: `E = \\tfrac{1}{2}\\sum m_i v_i^2 - G\\sum_{i<j}\\dfrac{m_im_j}{r_{ij}}` },
          { label: 'RK4 update', eq: `\\mathbf{r}_{n+1}=\\mathbf{r}_n+\\tfrac{h}{6}(k_1+2k_2+2k_3+k_4)` },
          { label: 'Figure-8 period', eq: `T \\approx 6.3259\\;\\text{(Chenciner 2000)}` },
        ],
      }

    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

export default function FrontierModule() {
  const [activeView, setActiveView] = useState('rotationcurve')
  const [bhHiRes, setBhHiRes] = useState(!isMobile)

  const fpRadius = useModuleStore((s) => s.fp.fpRadius)
  const hubble   = useModuleStore((s) => s.fp.hubble)
  const bhMass   = useModuleStore((s) => s.fp.bhMass)
  const setFpRadius  = useModuleStore((s) => s.setFpRadius)
  const setFpHubble  = useModuleStore((s) => s.setFpHubble)
  const setFpBhMass  = useModuleStore((s) => s.setFpBhMass)
  const resetFp      = useModuleStore((s) => s.resetFp)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const vo     = observedRotationVelocity(fpRadius)
  const vk     = keplerianVelocity(fpRadius)
  const disc   = rotationDiscrepancy(fpRadius)
  const dmFrac = darkMatterFraction(fpRadius)
  const Rs     = bhMass * 0.5

  const controlsByView = {
    rotationcurve: [
      { label: 'Orbital radius r', min: 0.2, max: 6.5, step: 0.05, value: fpRadius, onChange: setFpRadius, unit: ' r' },
    ],
    expansion: [
      { label: 'H₀ (expansion rate)', min: 0.2, max: 2.5, step: 0.05, value: hubble, onChange: setFpHubble, unit: '×' },
    ],
    blackhole: [
      { label: 'BH Mass', min: 0.3, max: 1.5, step: 0.05, value: bhMass, onChange: setFpBhMass, unit: ' M' },
    ],
    nbody: [],
  }

  const metricsByView = {
    rotationcurve: [
      { label: 'r (orbital)', value: fpRadius.toFixed(3), unit: ' r', color: 'amber' },
      { label: 'v_observed', value: vo.toFixed(4), color: 'cyan' },
      { label: 'v_keplerian', value: vk.toFixed(4), color: 'amber' },
      { label: 'Δv (excess)', value: `+${Math.max(0, disc).toFixed(4)}`, color: disc > 0.05 ? 'rose' : 'dim' },
      { label: 'Dark matter fraction*', value: `${(dmFrac * 100).toFixed(1)}%`, color: 'rose' },
      { label: '* inferred, not observed', value: '', color: 'dim' },
    ],
    expansion: [
      { label: 'H₀ (normalized)', value: hubble.toFixed(3), color: 'amber' },
      { label: 'H₀ (km/s/Mpc)', value: `~${toHubbleUnits(hubble)}`, color: 'amber' },
      { label: 'v @ d = 1.1', value: hubbleExpansion(1.1, hubble).toFixed(3), color: 'cyan' },
      { label: 'v @ d = 2.2', value: hubbleExpansion(2.2, hubble).toFixed(3), color: 'cyan' },
      { label: 'v @ d = 4.4', value: hubbleExpansion(4.4, hubble).toFixed(3), color: 'cyan' },
      { label: 'Hubble tension', value: '~5σ', color: 'rose' },
    ],
    blackhole: [
      { label: 'BH Mass', value: bhMass.toFixed(2), unit: ' M', color: 'amber' },
      { label: 'R_s (event horizon)', value: Rs.toFixed(3), unit: ' u', color: 'amber' },
      { label: 'Shadow b_crit', value: (Rs * 2.598).toFixed(3), unit: ' u', color: 'rose' },
      { label: 'Photon sphere r_ph', value: (Rs * 1.5).toFixed(3), unit: ' u', color: 'cyan' },
      { label: 'ISCO (disk inner)', value: (Rs * 3.0).toFixed(3), unit: ' u', color: 'cyan' },
      { label: '* screen-space approx.', value: '~1st order', color: 'dim' },
    ],
    nbody: [
      { label: 'Integrator', value: 'RK4', color: 'cyan' },
      { label: 'Sub-steps / frame', value: '4', color: 'cyan' },
      { label: 'G (normalized)', value: '1.000', color: 'amber' },
      { label: 'Softening ε', value: '0.02 – 0.08', color: 'amber' },
      { label: 'Trail length', value: '600 pts', color: 'dim' },
      { label: 'Presets', value: 'select in scene', color: 'dim' },
    ],
  }

  const explanation = buildExplanation(activeView, fpRadius, hubble, bhMass)
  const { domain, primaryEq, derivedEqs } = buildEquations(activeView, fpRadius, hubble, vo, vk, bhMass)
  const camPos = CAMERA_POSITIONS[activeView]
  const isBlackHole = activeView === 'blackhole'
  const isNBody     = activeView === 'nbody'

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-amber-glow transition-colors duration-200 uppercase flex items-center gap-1.5"
          >
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">
            Frontier Physics
          </h1>
          <span className="font-mono-data text-[9px] tracking-wider uppercase px-2 py-0.5 border border-amber-glow/30 text-amber-glow/60 rounded bg-amber-glow/5">
            Evidence-based · mechanism unconfirmed
          </span>
        </div>

        <nav className="flex gap-1 items-center" role="tablist" aria-label="Scene views">
          {VIEWS.map((v) => {
            const isActive = activeView === v.id
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveView(v.id)}
                className={[
                  'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                  isActive
                    ? 'border-amber-glow text-amber-glow shadow-glow-amber bg-amber-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-amber-mid hover:text-text-primary',
                ].join(' ')}
              >
                {v.label}
              </button>
            )
          })}
        </nav>

        <div className="font-mono-data text-sm text-amber-glow tabular-nums" style={{ textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
          {isBlackHole ? 'R_s = 2GM/c²' : isNBody ? 'F = Gm₁m₂/r²' : 'v = H₀·d'}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Analysis"
            domain={domain}
            primaryEq={primaryEq}
            derivedEqs={derivedEqs}
            explanation={explanation}
            metrics={metricsByView[activeView]}
            footer="FRONTIER PHYSICS · OBSERVED ≠ EXPLAINED"
          />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={camPos} showGrid={!isBlackHole && !isNBody} minDist={isBlackHole ? 2.5 : 2}>
            {activeView === 'rotationcurve' && <RotationCurve />}
            {activeView === 'expansion' && <ExpansionSim />}
            {isBlackHole && <BlackHole hiRes={bhHiRes} />}
            {isNBody && <NBody />}
          </SceneWrapper>

          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {VIEWS.find((v) => v.id === activeView)?.label}
            </span>
          </div>

          {isBlackHole && (
            <div className="absolute bottom-3 right-3 pointer-events-auto">
              <button
                onClick={() => setBhHiRes((v) => !v)}
                className={[
                  'font-mono-data text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 rounded border transition-all duration-200',
                  bhHiRes
                    ? 'border-cyan-glow/50 text-cyan-glow bg-cyan-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-amber-glow/40 hover:text-text-primary',
                ].join(' ')}
                title={bhHiRes ? 'Switch to low-res (mobile / low-end GPU)' : 'Switch to hi-res (3 star scales + nebula)'}
              >
                {bhHiRes ? '◉ HI-RES' : '◎ LO-RES'}
              </button>
            </div>
          )}
        </main>

        <div className="w-52 shrink-0 flex flex-col overflow-hidden">
          <ControlPanel title="Parameters" controls={controlsByView[activeView]} onReset={resetFp} />
        </div>
      </div>
    </div>
  )
}
