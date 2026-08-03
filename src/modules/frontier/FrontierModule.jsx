import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import RotationCurve from './RotationCurve'
import ExpansionSim from './ExpansionSim'
import BlackHole, { isMobile } from './BlackHole'
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
]

const CAMERA_POSITIONS = {
  rotationcurve: [0, 4.5, 9],
  expansion: [0, 8, 12],
  blackhole: [0, 2.5, 6],
}

function buildExplanation(view, fpRadius, hubble, bhMass) {
  switch (view) {
    case 'blackhole': {
      const Rs    = (bhMass * 0.5).toFixed(3)
      const bCrit = (bhMass * 0.5 * 2.598).toFixed(3)
      return `The shader deflects each background ray by δ ≈ 4·b_crit²/b², a 1/b² falloff chosen because it diverges sharply near the photon sphere and tapers naturally at large distances — producing a convincing ring without needing to solve geodesic equations. This is not the real Schwarzschild formula (which is α = 2Rs/b, a 1/b law). The 1/b² version exaggerates strong-field bending for visual impact while getting the qualitative structure right: a shadow, a photon ring, and weak lensing of distant stars.

What the shader does get right: the shadow boundary at b_crit = ${bCrit} (the photon capture radius, not the event horizon), the bright ring caused by rays that nearly orbit before escaping, and the sense of background stars bending around the mass. What it does not do: solve the Schwarzschild or Kerr geodesic equations per ray. A real GR renderer traces null geodesics through curved spacetime — this does not. The accretion disk uses Keplerian rotation (ω ∝ r⁻³/²) and rotates faster at the inner edge.`
    }

    case 'rotationcurve': {
      const disc = rotationDiscrepancy(fpRadius)
      const dmf = darkMatterFraction(fpRadius) * 100
      return `Observation: at r = ${fpRadius.toFixed(2)}, the measured orbital velocity is ${observedRotationVelocity(fpRadius).toFixed(3)} — but Newtonian mechanics predicts ${keplerianVelocity(fpRadius).toFixed(3)} from the visible mass alone. The discrepancy is ${disc.toFixed(3)}, implying ${dmf.toFixed(1)}% of the enclosed mass is unseen. This isn't a small correction — at large radii, unseen matter vastly dominates.

What's established: the flat rotation curves are measured across hundreds of galaxies. Discrepancy with Keplerian predictions is real and reproducible. Inference: extra mass exists that doesn't emit light — labelled "dark matter" by convention. What's unknown: whether dark matter is a new particle, a modified gravity law (MOND, TeVeS), primordial black holes, or something else entirely. No direct detection of a dark matter particle has been confirmed as of 2024. The label "dark matter" names the gap, not its content.`
    }

    case 'expansion': {
      const H_km = toHubbleUnits(hubble)
      return `Observation: galaxies at distance d recede from us with velocity v = H₀·d. This holds in every direction. At H₀ = ${hubble.toFixed(2)} (≈ ${H_km} km/s/Mpc), a galaxy 1 Mpc away recedes at ${hubble.toFixed(2)} normalized units; a galaxy 2 Mpc away at twice that. The expansion is homogeneous — every observer sees the same recession law regardless of position.

What's established: cosmic expansion via galaxy redshifts and Cepheid/Type Ia supernova distances. Acceleration of expansion since z ≈ 0.7, confirmed by Type Ia SNe in 1998. Inference: a "cosmological constant" Λ or "dark energy" drives the acceleration. What's unknown: the physical nature of Λ (vacuum energy? scalar field? modified GR?), why its measured value is ~120 orders of magnitude below naive QFT predictions, and — critically — the Hubble tension: local distance ladder gives H₀ ≈ 73, CMB gives ≈ 67.4 km/s/Mpc. That 5σ discrepancy has no agreed resolution.`
    }

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
        primaryEq: `\\textcolor{#00e5c4}{v_{\\mathrm{obs}}} \\gg \\textcolor{#f59e0b}{v_{\\mathrm{kep}}}`,
        derivedEqs: [
          {
            label: 'Keplerian (visible mass)',
            eq: `\\textcolor{#f59e0b}{v_{\\mathrm{kep}}} = \\sqrt{\\dfrac{GM(r)}{r}}`,
          },
          {
            label: `r = ${fpRadius.toFixed(2)}`,
            eq: `\\textcolor{#00e5c4}{v_{\\mathrm{obs}}} = ${vo.toFixed(3)},\\;\\textcolor{#f59e0b}{v_{\\mathrm{kep}}} = ${vk.toFixed(3)}`,
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
  }

  const explanation = buildExplanation(activeView, fpRadius, hubble, bhMass)
  const { domain, primaryEq, derivedEqs } = buildEquations(activeView, fpRadius, hubble, vo, vk, bhMass)
  const camPos = CAMERA_POSITIONS[activeView]
  const isBlackHole = activeView === 'blackhole'

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
          {isBlackHole ? 'R_s = 2GM/c²' : 'v = H₀·d'}
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
          <SceneWrapper cameraPosition={camPos} showGrid={!isBlackHole} minDist={isBlackHole ? 2.5 : 2}>
            {activeView === 'rotationcurve' && <RotationCurve />}
            {activeView === 'expansion' && <ExpansionSim />}
            {isBlackHole && <BlackHole hiRes={bhHiRes} />}
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
