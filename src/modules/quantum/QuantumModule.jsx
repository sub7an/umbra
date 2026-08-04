import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import BlochSphere from './BlochSphere'
import ParticleInBox from './ParticleInBox'
import DoubleSlit from './DoubleSlit'
import Entanglement from './Entanglement'
import useModuleStore from '../../store/useModuleStore'
import { blochCoordinates, prob0, prob1, particleInBoxEnergy, interferenceIntensity } from './qmMath'

const SCREEN_X = 3.8

const VIEWS = [
  { id: 'blochsphere',   label: 'Bloch Sphere' },
  { id: 'particleinbox', label: 'Particle in Box' },
  { id: 'doubleslit',    label: 'Double Slit' },
  { id: 'entanglement',  label: 'Entanglement' },
]

const CAMERA_POSITIONS = {
  blochsphere:   [1.8, 1.5, 3.8],
  particleinbox: [0, 0.8, 7],
  doubleslit:    [0, 3.5, 9],
  entanglement:  [0, 1.2, 9],
}

// ── Viz mode toggle ───────────────────────────────────────────────────────────

const VIZ_MODES = [
  { id: 'prob', label: '|ψ|²' },
  { id: 'real', label: 'Re(ψ)' },
  { id: 'imag', label: 'Im(ψ)' },
]

function VizModeToggle({ mode, onChange }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Visualization mode">
      {VIZ_MODES.map((m) => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={[
              'font-mono-data text-[10px] tracking-wider uppercase px-2.5 py-1 rounded border transition-all duration-200',
              active
                ? 'border-rose-glow text-rose-glow bg-rose-glow/5 shadow-glow-rose'
                : 'border-border-subtle text-text-dim hover:border-rose-mid hover:text-text-primary',
            ].join(' ')}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Measurement toggle (DoubleSlit) ───────────────────────────────────────────

function MeasureToggle({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={[
        'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
        active
          ? 'border-amber-glow text-amber-glow shadow-glow-amber bg-amber-glow/5'
          : 'border-border-subtle text-text-dim hover:border-amber-mid hover:text-text-primary',
      ].join(' ')}
    >
      {active ? '⊙ MEASURED' : '◎ UNMEASURED'}
    </button>
  )
}

// ── Explanations ──────────────────────────────────────────────────────────────

function buildExplanation(view, theta, phi, n, lambda, measured, entAlpha = 0) {
  const p0 = prob0(theta)
  const p1 = prob1(theta)
  const En = particleInBoxEnergy(n)
  const E1 = particleInBoxEnergy(1)

  switch (view) {
    case 'blochsphere':
      return `Every pure qubit state sits at a unique point on this sphere. North pole is |0⟩, south is |1⟩. Any other surface point is a genuine superposition. Right now P(|0⟩) = ${(p0 * 100).toFixed(1)}% and P(|1⟩) = ${(p1 * 100).toFixed(1)}%. The angle φ sets the phase between |0⟩ and |1⟩. Phase is invisible in a single measurement, but it becomes real when two qubits interfere. The equator is the |+⟩/|−⟩ belt where neither outcome has an advantage. Measure any state on this sphere and it snaps to a pole.`

    case 'particleinbox':
      return `The walls force ψ to zero at both edges, so only standing waves with an exact number of half-wavelengths can fit. That's the origin of discrete energies. Right now E_${n} = ${En.toFixed(2)} E₁, which is ${(En / E1).toFixed(0)}× the ground state. Each dot is sampled from |ψ_n(x)|², so the cloud is denser where the particle is likely to be found. Nodes are the empty gaps where ψ = 0 and the particle can never appear. Switch to Re(ψ) or Im(ψ) to watch the wavefunction rotate in time.`

    case 'doubleslit': {
      const fringe = (lambda * (SCREEN_X - 0) / 1.0).toFixed(2)
      return measured
        ? `Which-path information was recorded, so interference collapses. The cross-term in |ψ₁+ψ₂|² only survives when the two paths are completely indistinguishable. Once you tag which slit the particle used, that term vanishes and you get two classical blobs. It doesn't matter how gentle the detector is. Any measurement that reveals path information is enough to kill the fringes.`
        : `No measurement means the particle takes both slits as a superposition. The amplitudes interfere: |ψ₁+ψ₂|² = |ψ₁|² + |ψ₂|² + 2·Re[ψ₁*ψ₂]. That last term makes the fringes. Spacing ≈ λD/d ≈ ${fringe} scene units. Increase λ and the fringes spread. Each dot is a single particle, but the probability wave passes through both slits at once.`
    }

    case 'entanglement': {
      const C = Math.sin(2 * entAlpha)
      return `The state is |ψ⟩ = cos(α)|00⟩ + sin(α)|11⟩. Move α from 0 to π/4 and the state goes from a plain product to the Bell state |Φ⁺⟩. Right now concurrence C = ${C.toFixed(3)}. The Bloch vector for each qubit starts at the north pole and shrinks toward zero as entanglement grows, because a maximally entangled qubit has no definite local state. You cannot describe it as any single spin direction. The two qubits are perfectly correlated, but neither one has a state of its own.`
    }

    default:
      return ''
  }
}

// ── KaTeX equations ───────────────────────────────────────────────────────────

function buildEquations(view, theta, phi, n, lambda, measured, entAlpha = 0) {
  const p0 = prob0(theta)
  const p1 = prob1(theta)
  const En = particleInBoxEnergy(n)

  switch (view) {
    case 'blochsphere':
      return {
        domain: 'QUANTUM STATE SPACE · BLOCH SPHERE',
        primaryEq: `|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}|0\\rangle + e^{i\\phi}\\sin\\tfrac{\\theta}{2}|1\\rangle`,
        derivedEqs: [
          {
            label: 'Born rule',
            eq: `P(|0\\rangle) = \\cos^2\\!\\tfrac{\\textcolor{#f59e0b}{\\theta}}{2} = ${(p0 * 100).toFixed(1)}\\%`,
          },
          {
            label: '',
            eq: `P(|1\\rangle) = \\sin^2\\!\\tfrac{\\textcolor{#f59e0b}{\\theta}}{2} = ${(p1 * 100).toFixed(1)}\\%`,
          },
        ],
      }

    case 'particleinbox':
      return {
        domain: 'SCHRÖDINGER EQ · PARTICLE IN BOX',
        primaryEq: `\\psi_{\\textcolor{#f59e0b}{n}}(x) = \\sqrt{\\tfrac{2}{L}}\\sin\\tfrac{\\textcolor{#f59e0b}{n}\\pi x}{L}`,
        derivedEqs: [
          {
            label: 'Energy eigenvalue',
            eq: `E_{\\textcolor{#f59e0b}{n}} = \\dfrac{\\textcolor{#f59e0b}{n}^2\\pi^2\\hbar^2}{2mL^2}`,
          },
          {
            label: `n = ${n}`,
            eq: `E_{${n}} = ${En.toFixed(2)}\\,E_1,\\;\\text{nodes: }${n - 1}`,
          },
        ],
      }

    case 'doubleslit':
      return {
        domain: measured ? 'WHICH-PATH · DECOHERENCE' : 'WAVE–PARTICLE DUALITY · INTERFERENCE',
        primaryEq: measured
          ? `|\\psi|^2 = |\\psi_1|^2 + |\\psi_2|^2`
          : `I(y) = \\cos^2\\!\\left(\\dfrac{\\pi\\,d\\,y}{\\textcolor{#f59e0b}{\\lambda}\\,D}\\right)`,
        derivedEqs: measured
          ? [{ label: 'Cross-term (interference)', eq: `2\\,\\mathrm{Re}[\\psi_1^\\ast\\psi_2] = 0` }]
          : [{ label: 'Fringe spacing', eq: `\\Delta y = \\dfrac{\\textcolor{#f59e0b}{\\lambda}\\,D}{d} = ${(lambda * SCREEN_X / 1.0).toFixed(3)}\\text{ u}` }],
      }

    case 'entanglement': {
      const C = Math.sin(2 * entAlpha).toFixed(4)
      const r = Math.cos(2 * entAlpha).toFixed(4)
      return {
        domain: 'QUANTUM ENTANGLEMENT · BELL STATES',
        primaryEq: `|\\psi\\rangle = \\cos\\textcolor{#f59e0b}{\\alpha}|00\\rangle + \\sin\\textcolor{#f59e0b}{\\alpha}|11\\rangle`,
        derivedEqs: [
          {
            label: 'Concurrence (entanglement)',
            eq: `C = \\sin(2\\textcolor{#f59e0b}{\\alpha}) = ${C}`,
          },
          {
            label: 'Bloch vector length',
            eq: `|\\mathbf{r}| = \\cos(2\\textcolor{#f59e0b}{\\alpha}) = ${r}`,
          },
        ],
      }
    }

    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function QuantumModule() {
  const [activeView, setActiveView] = useState('blochsphere')

  const theta   = useModuleStore((s) => s.qm.blochTheta)
  const phi     = useModuleStore((s) => s.qm.blochPhi)
  const n       = useModuleStore((s) => s.qm.boxN)
  const lambda  = useModuleStore((s) => s.qm.slitWavelength)
  const measured= useModuleStore((s) => s.qm.slitMeasured)
  const particleCount   = useModuleStore((s) => s.qm.particleCount)
  const boxVizMode      = useModuleStore((s) => s.qm.boxVizMode)
  const blochVizMode    = useModuleStore((s) => s.qm.blochVizMode)
  const entangleAlpha   = useModuleStore((s) => s.qm.entangleAlpha)

  const setBlochTheta   = useModuleStore((s) => s.setBlochTheta)
  const setBlochPhi     = useModuleStore((s) => s.setBlochPhi)
  const setBoxN         = useModuleStore((s) => s.setBoxN)
  const setSlitWavelength = useModuleStore((s) => s.setSlitWavelength)
  const setSlitMeasured = useModuleStore((s) => s.setSlitMeasured)
  const setParticleCount= useModuleStore((s) => s.setParticleCount)
  const setBoxVizMode   = useModuleStore((s) => s.setBoxVizMode)
  const setBlochVizMode = useModuleStore((s) => s.setBlochVizMode)
  const setEntangleAlpha= useModuleStore((s) => s.setEntangleAlpha)
  const resetQm         = useModuleStore((s) => s.resetQm)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const bloch = blochCoordinates(theta, phi)

  const controlsByView = {
    blochsphere: [
      { label: 'Polar θ',       min: 0, max: Math.PI,      step: 0.01, value: theta,  onChange: setBlochTheta,    unit: ' rad' },
      { label: 'Azimuthal φ',   min: 0, max: 2 * Math.PI,  step: 0.01, value: phi,    onChange: setBlochPhi,      unit: ' rad' },
      { label: 'Particles',     min: 1, max: 100,           step: 1,    value: particleCount / 1000, onChange: (v) => setParticleCount(Math.round(v) * 1000), unit: 'k' },
    ],
    particleinbox: [
      { label: 'Quantum n',     min: 1, max: 6,             step: 1,    value: n,      onChange: setBoxN,          unit: '' },
      { label: 'Particles',     min: 1, max: 100,           step: 1,    value: particleCount / 1000, onChange: (v) => setParticleCount(Math.round(v) * 1000), unit: 'k' },
    ],
    doubleslit: [
      { label: 'Wavelength λ',  min: 0.3, max: 1.2,         step: 0.01, value: lambda, onChange: setSlitWavelength, unit: ' λ' },
    ],
    entanglement: [
      { label: 'Coupling α', min: 0, max: Math.PI / 4, step: 0.005, value: entangleAlpha, onChange: setEntangleAlpha, unit: ' rad' },
    ],
  }

  const concurrence = Math.sin(2 * entangleAlpha)

  const metricsByView = {
    blochsphere: [
      { label: 'θ  (polar)',    value: theta.toFixed(4),            unit: ' rad', color: 'cyan' },
      { label: 'φ  (azimuth)', value: phi.toFixed(4),              unit: ' rad', color: 'amber' },
      { label: 'P(|0⟩)',       value: (prob0(theta) * 100).toFixed(2), unit: '%', color: 'cyan' },
      { label: 'P(|1⟩)',       value: (prob1(theta) * 100).toFixed(2), unit: '%', color: 'rose' },
      { label: 'Bloch x',      value: bloch.x.toFixed(3),          color: 'amber' },
      { label: 'Bloch y',      value: bloch.y.toFixed(3),          color: 'rose' },
      { label: 'Bloch z',      value: bloch.z.toFixed(3),          color: 'cyan' },
    ],
    particleinbox: [
      { label: 'Quantum n',    value: String(n),                               color: 'cyan' },
      { label: 'E_n',          value: particleInBoxEnergy(n).toFixed(3),       unit: ' E₁',  color: 'amber' },
      { label: 'E_n / E₁',    value: (n * n).toFixed(0),                      unit: '×',    color: 'rose' },
      { label: 'Nodes inside', value: String(n - 1),                                         color: 'dim' },
      { label: 'λ_n = 2L/n',  value: (2 / n).toFixed(3),                      unit: ' L',   color: 'cyan' },
    ],
    doubleslit: [
      { label: 'λ (wavelength)', value: lambda.toFixed(3),          color: 'cyan' },
      { label: 'Slit sep. d',   value: '1.000',                     color: 'dim' },
      { label: 'Screen dist D', value: '3.800',                     color: 'dim' },
      { label: 'Fringe Δy',     value: (lambda * 3.8 / 1.0).toFixed(3), unit: ' u', color: 'amber' },
      { label: 'Mode',          value: measured ? 'MEASURED' : 'QUANTUM', color: measured ? 'amber' : 'cyan' },
    ],
    entanglement: [
      { label: 'α (coupling)',    value: entangleAlpha.toFixed(4), unit: ' rad', color: 'amber' },
      { label: 'Concurrence C',  value: concurrence.toFixed(4), color: concurrence > 0.95 ? 'rose' : 'cyan' },
      { label: 'Bloch |r|',      value: Math.cos(2 * entangleAlpha).toFixed(4), color: 'dim' },
      { label: 'P(|00⟩)',        value: (Math.pow(Math.cos(entangleAlpha), 2) * 100).toFixed(1), unit: '%', color: 'cyan' },
      { label: 'P(|11⟩)',        value: (Math.pow(Math.sin(entangleAlpha), 2) * 100).toFixed(1), unit: '%', color: 'rose' },
      { label: 'State',          value: concurrence > 0.95 ? 'BELL |Φ⁺⟩' : concurrence < 0.05 ? 'PRODUCT' : 'PARTIAL', color: concurrence > 0.95 ? 'rose' : 'cyan' },
    ],
  }

  const explanation = buildExplanation(activeView, theta, phi, n, lambda, measured, entangleAlpha)
  const { domain, primaryEq, derivedEqs } = buildEquations(activeView, theta, phi, n, lambda, measured, entangleAlpha)
  const camPos = CAMERA_POSITIONS[activeView]

  const activeVizMode  = activeView === 'blochsphere' ? blochVizMode : boxVizMode
  const setActiveVizMode = activeView === 'blochsphere' ? setBlochVizMode : setBoxVizMode
  const showVizToggle  = activeView === 'blochsphere' || activeView === 'particleinbox'

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-cyan-glow transition-colors duration-200 uppercase flex items-center gap-1.5"
          >
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">
            Quantum Mechanics
          </h1>
        </div>

        <nav className="flex gap-1 items-center flex-wrap justify-center" role="tablist" aria-label="Scene views">
          {/* View tabs */}
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
                    ? 'border-rose-glow text-rose-glow shadow-glow-rose bg-rose-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-rose-mid hover:text-text-primary',
                ].join(' ')}
              >
                {v.label}
              </button>
            )
          })}

          {/* Divider */}
          {showVizToggle && <div className="w-px h-5 bg-border-subtle mx-1" />}

          {/* Viz mode toggles (Bloch + PIB only) */}
          {showVizToggle && (
            <VizModeToggle mode={activeVizMode} onChange={setActiveVizMode} />
          )}

          {/* DoubleSlit measure toggle */}
          {activeView === 'doubleslit' && (
            <MeasureToggle active={measured} onToggle={() => setSlitMeasured(!measured)} />
          )}
        </nav>

        <div className="font-mono-data text-sm text-rose-glow tabular-nums" style={{ textShadow: '0 0 8px rgba(224,64,251,0.5)' }}>
          iℏ∂ψ/∂t = Ĥψ
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Analysis"
            domain={domain}
            primaryEq={primaryEq}
            derivedEqs={derivedEqs}
            explanation={explanation}
            metrics={metricsByView[activeView]}
            footer="QUANTUM MECHANICS · QM MODULE"
            accentColor="rose"
          />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={camPos}>
            {activeView === 'blochsphere'   && <BlochSphere />}
            {activeView === 'particleinbox' && <ParticleInBox />}
            {activeView === 'doubleslit'    && <DoubleSlit />}
            {activeView === 'entanglement'  && <Entanglement />}
          </SceneWrapper>

          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {VIEWS.find((v) => v.id === activeView)?.label}
            </span>
          </div>
        </main>

        <div className="w-52 shrink-0 flex flex-col overflow-hidden">
          <ControlPanel title="Parameters" controls={controlsByView[activeView]} onReset={resetQm} />
        </div>
      </div>
    </div>
  )
}
