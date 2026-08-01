import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import RotationCurve from './RotationCurve'
import ExpansionSim from './ExpansionSim'
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
]

const CAMERA_POSITIONS = {
  rotationcurve: [0, 4.5, 9],
  expansion: [0, 8, 12],
}

function buildExplanation(view, fpRadius, hubble) {
  switch (view) {
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

function buildFormula(view, fpRadius, hubble) {
  switch (view) {
    case 'rotationcurve': {
      const vo = observedRotationVelocity(fpRadius)
      const vk = keplerianVelocity(fpRadius)
      return `v_obs(${fpRadius.toFixed(2)}) = ${vo.toFixed(3)}   v_kep = ${vk.toFixed(3)}`
    }
    case 'expansion':
      return `v = H₀ · d  =  ${hubble.toFixed(2)} × d`
    default:
      return ''
  }
}

export default function FrontierModule() {
  const [activeView, setActiveView] = useState('rotationcurve')

  const fpRadius = useModuleStore((s) => s.fp.fpRadius)
  const hubble = useModuleStore((s) => s.fp.hubble)
  const setFpRadius = useModuleStore((s) => s.setFpRadius)
  const setFpHubble = useModuleStore((s) => s.setFpHubble)
  const resetFp = useModuleStore((s) => s.resetFp)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const vo = observedRotationVelocity(fpRadius)
  const vk = keplerianVelocity(fpRadius)
  const disc = rotationDiscrepancy(fpRadius)
  const dmFrac = darkMatterFraction(fpRadius)

  const controlsByView = {
    rotationcurve: [
      { label: 'Orbital radius r', min: 0.2, max: 6.5, step: 0.05, value: fpRadius, onChange: setFpRadius, unit: ' r' },
    ],
    expansion: [
      { label: 'H₀ (expansion rate)', min: 0.2, max: 2.5, step: 0.05, value: hubble, onChange: setFpHubble, unit: '×' },
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
  }

  const formula = buildFormula(activeView, fpRadius, hubble)
  const explanation = buildExplanation(activeView, fpRadius, hubble)
  const camPos = CAMERA_POSITIONS[activeView]

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
          {/* Persistent epistemic tag */}
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
          v = H₀·d
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-56 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Analysis"
            formula={formula}
            explanation={explanation}
            metrics={metricsByView[activeView]}
            footer="FRONTIER PHYSICS · OBSERVED ≠ EXPLAINED"
          />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={camPos}>
            {activeView === 'rotationcurve' && <RotationCurve />}
            {activeView === 'expansion' && <ExpansionSim />}
          </SceneWrapper>

          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {VIEWS.find((v) => v.id === activeView)?.label}
            </span>
          </div>
        </main>

        <div className="w-52 shrink-0 flex flex-col overflow-hidden">
          <ControlPanel
            title="Parameters"
            controls={controlsByView[activeView]}
            onReset={resetFp}
          />
        </div>
      </div>
    </div>
  )
}
