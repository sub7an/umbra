import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import MagnetLab3D from './MagnetLab3D'
import useModuleStore from '../../store/useModuleStore'

const MAGNET_TYPES = [
  { id: 'dipole',   abbr: 'DIP', label: 'Dipole',   desc: 'Point magnetic dipole' },
  { id: 'bar',      abbr: 'BAR', label: 'Bar',       desc: 'N+S poles separated' },
  { id: 'solenoid', abbr: 'SOL', label: 'Solenoid',  desc: 'Stacked current loops' },
  { id: 'halbach',  abbr: 'HAL', label: 'Halbach',   desc: 'Rotating moment array' },
]

function buildEquations(magnetType) {
  switch (magnetType) {
    case 'dipole':
      return {
        domain: 'ELECTROMAGNETISM · MAGNETIC DIPOLE',
        primaryEq: `\\mathbf{B} = \\dfrac{\\mu_0}{4\\pi} \\cdot \\dfrac{3(\\mathbf{m}\\cdot\\hat{r})\\hat{r} - \\mathbf{m}}{r^3}`,
        derivedEqs: [
          { label: 'Dipole moment',    eq: `\\mathbf{m} = I\\,A\\,\\hat{n}` },
          { label: 'On-axis (θ=0)',    eq: `B_{\\rm axis} = \\tfrac{\\mu_0}{4\\pi}\\dfrac{2m}{r^3}` },
          { label: 'Equatorial (θ=π/2)', eq: `B_{\\rm eq} = -\\tfrac{\\mu_0}{4\\pi}\\dfrac{m}{r^3}` },
        ],
      }
    case 'bar':
      return {
        domain: 'ELECTROMAGNETISM · BAR MAGNET',
        primaryEq: `\\mathbf{B} = \\dfrac{\\mu_0 q_m}{4\\pi}\\!\\left(\\dfrac{\\hat{r}_N}{r_N^2} - \\dfrac{\\hat{r}_S}{r_S^2}\\right)`,
        derivedEqs: [
          { label: 'Far field',   eq: `r \\gg \\ell \\implies \\mathbf{B} \\to \\text{dipole}` },
          { label: 'Interior',    eq: `\\mathbf{B}_{\\rm int} = \\mu_0(\\mathbf{H}+\\mathbf{M})` },
          { label: 'Pole strength', eq: `q_m = \\mu_0^{-1}\\oint \\mathbf{B}\\cdot d\\mathbf{A}` },
        ],
      }
    case 'solenoid':
      return {
        domain: 'ELECTROMAGNETISM · SOLENOID',
        primaryEq: `\\mathbf{B}_{\\rm int} = \\mu_0\\,n\\,I\\,\\hat{z}`,
        derivedEqs: [
          { label: 'Biot-Savart', eq: `d\\mathbf{B} = \\dfrac{\\mu_0 I}{4\\pi}\\dfrac{d\\boldsymbol{\\ell}\\times\\hat{r}}{r^2}` },
          { label: 'End field',   eq: `B_{\\rm end} = \\tfrac{1}{2}\\mu_0 n I` },
          { label: 'Inductance',  eq: `L = \\mu_0 n^2 V` },
        ],
      }
    case 'halbach':
      return {
        domain: 'ELECTROMAGNETISM · HALBACH ARRAY',
        primaryEq: `|\\mathbf{B}_{\\rm above}| \\approx B_r\\!\\left(1-e^{-kd}\\right)`,
        derivedEqs: [
          { label: 'Moment rotation', eq: `\\theta_k = \\dfrac{2\\pi k}{N},\\; k=0,\\ldots,N-1` },
          { label: 'Below side',      eq: `\\mathbf{B}_{\\rm below} \\approx 0 \\;\\text{(ideal)}` },
          { label: 'Enhancement',     eq: `\\approx 2\\times \\text{ vs. uniform array}` },
        ],
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(magnetType) {
  switch (magnetType) {
    case 'dipole':
      return `A magnetic dipole is the fundamental building block of all magnetism — every bar magnet, current loop, and electron spin reduces to a dipole at sufficient distance. The field falls off as 1/r³, much faster than gravity (1/r²), which is why magnetic effects are so localized. Field lines form closed loops: leaving the north pole, curving outward through space, returning through the south pole. There are no magnetic monopoles — Gauss's law for magnetism (∇·B = 0) forbids isolated N or S poles. The 3D field lines here are traced via RK4 integration of the normalized B field.`

    case 'bar':
      return `A bar magnet modeled as two magnetic monopoles — a north pole at top and south pole at bottom — separated by the magnet's length. This dipole approximation converges to the exact formula far from the magnet, but breaks down near the poles. Inside a real magnet, the field is governed by magnetization M and opposes the external B field. Applications: compasses, MRI permanent magnets, magnetic separators, and speaker drivers — all rely on the geometry of the external dipole field you see here.`

    case 'solenoid':
      return `A solenoid is a helical coil of wire carrying current. Inside a long solenoid, Ampère's law gives a strikingly uniform field: B = μ₀nI, where n is turns per meter. The field outside an ideal infinite solenoid is exactly zero. At the ends, the field halves — the fringe field you see curving outward. Inductance scales with n²V, making solenoids energy-storage elements. Applications: electromagnets, MRI scanner coils, railgun accelerators, and the basis for every transformer.`

    case 'halbach':
      return `A Halbach array arranges permanent magnets with sequentially rotated magnetization directions. The rotating pattern constructively interferes on one face and destructively on the other — creating a strong, concentrated field above and near-zero field below. Named after physicist Klaus Halbach, who designed them for particle accelerator focusing in the 1980s. Today: maglev train tracks (strong side repels conducting rail), brushless DC motors (higher torque density), MRI bore magnets (flux focused inward), and magnetic levitation bearings.`

    default:
      return ''
  }
}

function buildMetrics(magnetType) {
  switch (magnetType) {
    case 'dipole':
      return [
        { label: 'Model',         value: 'Point dipole',    color: 'dim' },
        { label: 'B on-axis',     value: '2m/4πr³',         color: 'cyan' },
        { label: 'B equatorial',  value: 'm/4πr³',          color: 'amber' },
        { label: 'Symmetry',      value: 'Axisymmetric',    color: 'dim' },
        { label: '∇·B',           value: '0 everywhere',    color: 'cyan' },
      ]
    case 'bar':
      return [
        { label: 'Model',         value: '2 monopoles',     color: 'dim' },
        { label: 'Pole separation', value: '1.6 u',         color: 'amber' },
        { label: 'Far field',     value: '→ dipole',        color: 'cyan' },
        { label: 'Interior field', value: 'Opposes B_ext',  color: 'rose' },
        { label: 'Max at',        value: 'Pole faces',      color: 'amber' },
      ]
    case 'solenoid':
      return [
        { label: 'Loops modeled', value: '10',              color: 'dim' },
        { label: 'Interior B',    value: 'μ₀nI (uniform)',  color: 'cyan' },
        { label: 'End B',         value: '½ × interior',   color: 'amber' },
        { label: 'Exterior B',    value: '≈ 0',             color: 'dim' },
        { label: 'Inductance',    value: 'L ∝ n²V',         color: 'rose' },
      ]
    case 'halbach':
      return [
        { label: 'Magnets',       value: '4 dipoles',       color: 'dim' },
        { label: 'Strong side',   value: 'Above (+y)',      color: 'cyan' },
        { label: 'Weak side',     value: 'Below (−y)',      color: 'rose' },
        { label: 'Enhancement',   value: '≈ 2× uniform',   color: 'amber' },
        { label: 'Application',   value: 'Maglev · BLDC',  color: 'dim' },
      ]
    default:
      return []
  }
}

export default function ElectromagnetismModule() {
  const magnetType      = useModuleStore((s) => s.em.magnetType)
  const setMagnetType   = useModuleStore((s) => s.setEmMagnetType)
  const resetEm         = useModuleStore((s) => s.resetEm)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const [showFieldLines, setShowFieldLines] = useState(true)
  const [showHeatmap,    setShowHeatmap]    = useState(true)
  const [showParticles,  setShowParticles]  = useState(true)

  const { domain, primaryEq, derivedEqs } = buildEquations(magnetType)
  const explanation = buildExplanation(magnetType)
  const metrics     = buildMetrics(magnetType)

  const activeType = MAGNET_TYPES.find((m) => m.id === magnetType)

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-violet-glow transition-colors duration-200 uppercase flex items-center gap-1.5"
          >
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">
            Electromagnetism
          </h1>
          <span className="font-mono-data text-[9px] tracking-wider uppercase px-2 py-0.5 border border-violet-glow/30 text-violet-glow/60 rounded bg-violet-glow/5">
            3D Field Lines · Biot-Savart · RK4
          </span>
        </div>

        {/* Magnet type nav */}
        <nav className="flex gap-1" aria-label="Magnet type">
          {MAGNET_TYPES.map((mt) => {
            const active = magnetType === mt.id
            return (
              <button
                key={mt.id}
                onClick={() => setMagnetType(mt.id)}
                title={mt.desc}
                className={[
                  'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                  active
                    ? 'border-violet-glow text-violet-glow bg-violet-glow/5 shadow-glow-violet'
                    : 'border-border-subtle text-text-dim hover:border-violet-glow/50 hover:text-text-primary',
                ].join(' ')}
              >
                {mt.abbr}
              </button>
            )
          })}
        </nav>

        <div className="font-mono-data text-sm text-violet-glow tabular-nums" style={{ textShadow: '0 0 8px rgba(168,85,247,0.5)' }}>
          ∇·B = 0
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Info panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Field Analysis"
            domain={domain}
            primaryEq={primaryEq}
            derivedEqs={derivedEqs}
            explanation={explanation}
            metrics={metrics}
            footer="ELECTROMAGNETISM · BIOT-SAVART LAW"
            accentColor="rose"
          />
        </div>

        {/* 3D scene */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper
            cameraPosition={[0, 4, 9]}
            showGrid={false}
            minDist={2}
            maxDist={22}
          >
            <MagnetLab3D
              showFieldLines={showFieldLines}
              showHeatmap={showHeatmap}
              showParticles={showParticles}
            />
          </SceneWrapper>

          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              MagnetLab 3D · {activeType?.label}
            </span>
          </div>
        </main>

        {/* Right control panel */}
        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-glow bg-violet-glow"
                style={{ boxShadow: '0 0 4px 1px rgba(168,85,247,0.6)' }}
              />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">
                Visualization
              </span>
            </div>
            <button
              onClick={resetEm}
              className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-violet-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-violet-glow/40 rounded"
            >
              RST
            </button>
          </div>

          <div className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto thin-scroll">
            {/* Display toggles */}
            <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-0.5">
              Display layers
            </p>
            {[
              { label: 'Field Lines',   value: showFieldLines, set: setShowFieldLines },
              { label: 'Heatmap Slice', value: showHeatmap,    set: setShowHeatmap    },
              { label: 'Particle Flow', value: showParticles,  set: setShowParticles  },
            ].map(({ label, value, set }) => (
              <button
                key={label}
                onClick={() => set((v) => !v)}
                className={[
                  'w-full flex items-center justify-between px-3 py-2 rounded border font-mono-data text-[11px] tracking-wider uppercase transition-all duration-200',
                  value
                    ? 'border-violet-glow/50 text-violet-glow bg-violet-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-violet-glow/30',
                ].join(' ')}
              >
                {label}
                <span>{value ? '◉' : '○'}</span>
              </button>
            ))}

            <div className="h-px bg-border-subtle my-2" />

            {/* Magnet type selector */}
            <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-0.5">
              Magnet type
            </p>
            {MAGNET_TYPES.map((mt) => (
              <button
                key={mt.id}
                onClick={() => setMagnetType(mt.id)}
                className={[
                  'w-full flex flex-col items-start px-3 py-2 rounded border font-mono-data text-left transition-all duration-200',
                  magnetType === mt.id
                    ? 'border-violet-glow/50 text-violet-glow bg-violet-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-violet-glow/30',
                ].join(' ')}
              >
                <span className="text-[11px] tracking-wider uppercase">{mt.label}</span>
                <span className="text-[9px] text-text-dim mt-0.5 leading-tight">{mt.desc}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[10px] text-text-dim leading-relaxed">
              EM · BIOT-SAVART · RK4
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
