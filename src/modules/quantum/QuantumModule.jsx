import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import BlochSphere from './BlochSphere'
import ParticleInBox from './ParticleInBox'
import DoubleSlit from './DoubleSlit'
import useModuleStore from '../../store/useModuleStore'
import { blochCoordinates, prob0, prob1, particleInBoxEnergy, particleInBoxWavefunction, interferenceIntensity } from './qmMath'

const SCREEN_X = 3.8  // must match DoubleSlit.jsx SCREEN_X

const VIEWS = [
  { id: 'blochsphere', label: 'Bloch Sphere' },
  { id: 'particleinbox', label: 'Particle in Box' },
  { id: 'doubleslit', label: 'Double Slit' },
]

const CAMERA_POSITIONS = {
  blochsphere: [1.8, 1.5, 3.8],
  particleinbox: [0, 0.8, 7],
  doubleslit: [0, 3.5, 9],
}

function buildExplanation(view, theta, phi, n, lambda, measured) {
  const p0 = prob0(theta)
  const p1 = prob1(theta)
  const En = particleInBoxEnergy(n)
  const E1 = particleInBoxEnergy(1)

  switch (view) {
    case 'blochsphere':
      return `Every pure qubit state maps to a unique point on the surface of the Bloch sphere. The north pole is |0⟩, the south pole is |1⟩ — but unlike a classical bit, the sphere's interior isn't empty. Any point on the surface is a valid quantum state, a superposition. Right now P(|0⟩) = ${(p0 * 100).toFixed(1)}% and P(|1⟩) = ${(p1 * 100).toFixed(1)}%. The azimuthal angle φ sets the relative phase between |0⟩ and |1⟩ — that phase is invisible to a single measurement, but it becomes physical when you interfere two qubits. The equator (θ=π/2) is the |+⟩/|−⟩/|+i⟩/|−i⟩ belt — here neither outcome is preferred. A projective measurement collapses this to a pole.`

    case 'particleinbox':
      return `The particle is confined between infinite walls, so ψ must vanish there — this forces the wavefunction into standing waves with exactly n half-wavelengths fitting in [0, L]. That quantisation condition is what gives you discrete energies. E_${n} = ${En.toFixed(2)} in units of E₁ = ${E1.toFixed(2)} (so it's ${(En / E1).toFixed(0)}× the ground state). The cyan curve oscillates as Re[ψ]·cos(E_n·t); the amber curve is |ψ|², which doesn't oscillate for energy eigenstates — the probability density is static in time. Bump n and watch the nodes: n always has n-1 nodes inside the box. That's a direct consequence of orthogonality.`

    case 'doubleslit': {
      const fringe = (lambda * (SCREEN_X - 0) / 1.0).toFixed(2)
      return measured
        ? `Measurement collapsed it. Once you know which slit the particle went through, it's no longer in a superposition of "went through both." The interference term in |ψ₁+ψ₂|² requires the two paths to be indistinguishable. Tag the paths, the cross-term vanishes, and you get two classical blobs instead of fringes. This isn't about physical disturbance from the detector — even a perfectly gentle measurement destroys the pattern if it yields which-path information.`
        : `Without measurement, the particle propagates as a superposition through both slits simultaneously. The two path amplitudes interfere: |ψ₁+ψ₂|² = |ψ₁|² + |ψ₂|² + 2·Re[ψ₁*ψ₂]. That cross-term is the interference. Fringe spacing ≈ λD/d ≈ ${fringe} (scene units). Increase λ and the fringes spread; the geometry is identical to classical wave optics — what's quantum is that each particle goes through both slits.`
    }

    default:
      return ''
  }
}

function buildEquations(view, theta, phi, n, lambda, measured) {
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
          ? [
              {
                label: 'Cross-term (interference)',
                eq: `2\\,\\mathrm{Re}[\\psi_1^\\ast\\psi_2] = 0`,
              },
            ]
          : [
              {
                label: 'Fringe spacing',
                eq: `\\Delta y = \\dfrac{\\textcolor{#f59e0b}{\\lambda}\\,D}{d} = ${(lambda * SCREEN_X / 1.0).toFixed(3)}\\text{ u}`,
              },
            ],
      }

    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

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

export default function QuantumModule() {
  const [activeView, setActiveView] = useState('blochsphere')

  const theta = useModuleStore((s) => s.qm.blochTheta)
  const phi = useModuleStore((s) => s.qm.blochPhi)
  const n = useModuleStore((s) => s.qm.boxN)
  const lambda = useModuleStore((s) => s.qm.slitWavelength)
  const measured = useModuleStore((s) => s.qm.slitMeasured)

  const setBlochTheta = useModuleStore((s) => s.setBlochTheta)
  const setBlochPhi = useModuleStore((s) => s.setBlochPhi)
  const setBoxN = useModuleStore((s) => s.setBoxN)
  const setSlitWavelength = useModuleStore((s) => s.setSlitWavelength)
  const setSlitMeasured = useModuleStore((s) => s.setSlitMeasured)
  const resetQm = useModuleStore((s) => s.resetQm)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const bloch = blochCoordinates(theta, phi)

  const controlsByView = {
    blochsphere: [
      { label: 'Polar θ', min: 0, max: Math.PI, step: 0.01, value: theta, onChange: setBlochTheta, unit: ' rad' },
      { label: 'Azimuthal φ', min: 0, max: 2 * Math.PI, step: 0.01, value: phi, onChange: setBlochPhi, unit: ' rad' },
    ],
    particleinbox: [
      { label: 'Quantum n', min: 1, max: 6, step: 1, value: n, onChange: setBoxN, unit: '' },
    ],
    doubleslit: [
      { label: 'Wavelength λ', min: 0.3, max: 1.2, step: 0.01, value: lambda, onChange: setSlitWavelength, unit: ' λ' },
    ],
  }

  const metricsByView = {
    blochsphere: [
      { label: 'θ  (polar)', value: theta.toFixed(4), unit: ' rad', color: 'cyan' },
      { label: 'φ  (azimuth)', value: phi.toFixed(4), unit: ' rad', color: 'amber' },
      { label: 'P(|0⟩)', value: (prob0(theta) * 100).toFixed(2), unit: '%', color: 'cyan' },
      { label: 'P(|1⟩)', value: (prob1(theta) * 100).toFixed(2), unit: '%', color: 'rose' },
      { label: 'Bloch x', value: bloch.x.toFixed(3), color: 'amber' },
      { label: 'Bloch y', value: bloch.y.toFixed(3), color: 'rose' },
      { label: 'Bloch z', value: bloch.z.toFixed(3), color: 'cyan' },
    ],
    particleinbox: [
      { label: 'Quantum n', value: String(n), color: 'cyan' },
      { label: 'E_n', value: particleInBoxEnergy(n).toFixed(3), unit: ' E₁', color: 'amber' },
      { label: 'E_n / E₁', value: (n * n).toFixed(0), unit: '×', color: 'rose' },
      { label: 'Nodes inside', value: String(n - 1), color: 'dim' },
      { label: 'λ_n = 2L/n', value: (2 / n).toFixed(3), unit: ' L', color: 'cyan' },
    ],
    doubleslit: [
      { label: 'λ (wavelength)', value: lambda.toFixed(3), color: 'cyan' },
      { label: 'Slit sep. d', value: '1.000', color: 'dim' },
      { label: 'Screen dist D', value: '3.800', color: 'dim' },
      { label: 'Fringe Δy', value: (lambda * 3.8 / 1.0).toFixed(3), unit: ' u', color: 'amber' },
      { label: 'Mode', value: measured ? 'MEASURED' : 'QUANTUM', color: measured ? 'amber' : 'cyan' },
    ],
  }

  const explanation = buildExplanation(activeView, theta, phi, n, lambda, measured)
  const { domain, primaryEq, derivedEqs } = buildEquations(activeView, theta, phi, n, lambda, measured)
  const camPos = CAMERA_POSITIONS[activeView]

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* Top bar */}
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
                    ? 'border-rose-glow text-rose-glow shadow-glow-rose bg-rose-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-rose-mid hover:text-text-primary',
                ].join(' ')}
              >
                {v.label}
              </button>
            )
          })}

          {activeView === 'doubleslit' && (
            <MeasureToggle active={measured} onToggle={() => setSlitMeasured(!measured)} />
          )}
        </nav>

        <div className="font-mono-data text-sm text-rose-glow tabular-nums" style={{ textShadow: '0 0 8px rgba(224,64,251,0.5)' }}>
          iℏ∂ψ/∂t = Ĥψ
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
            footer="QUANTUM MECHANICS · QM MODULE"
            accentColor="rose"
          />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={camPos}>
            {activeView === 'blochsphere' && <BlochSphere />}
            {activeView === 'particleinbox' && <ParticleInBox />}
            {activeView === 'doubleslit' && <DoubleSlit />}
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
