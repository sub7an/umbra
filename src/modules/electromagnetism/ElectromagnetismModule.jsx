import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell from '../../components/ModuleShell'
import ControlPanel, { Slider as SharedSlider, ControlGroup, ToggleRow, OptionList } from '../../components/ControlPanel'
import MagnetLab3D from './MagnetLab3D'
import LorentzForce from './LorentzForce'
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
        syllabus: 'A-level · IB 5.4 · magnetic field patterns',
        primaryEq: `\\mathbf{B} = \\dfrac{\\mu_0}{4\\pi} \\cdot \\dfrac{3(\\mathbf{m}\\cdot\\hat{r})\\hat{r} - \\mathbf{m}}{r^3}`,
        derivedEqs: [
          { label: 'Dipole moment',    eq: `\\mathbf{m} = I\\,A\\,\\hat{n}` },
          { label: 'On-axis (θ=0)',    eq: `B_{\\rm axis} = \\tfrac{\\mu_0}{4\\pi}\\dfrac{2m}{r^3}` },
          { label: 'Equatorial (θ=π/2)', eq: `B_{\\rm eq} = -\\tfrac{\\mu_0}{4\\pi}\\dfrac{m}{r^3}` },
        ],
        tryThis: [
          'Trace one field line out of the north pole and follow it right back to the south — every line is a closed loop.',
          'Notice how fast the field dies with distance: 1/r³, far quicker than gravity’s 1/r².',
        ],
        checkpoint: {
          q: 'Why can you never isolate a single north magnetic pole?',
          a: 'Because ∇·B = 0 — magnetic field lines are always closed loops with no start or end. Every N is paired with an S; isolated monopoles have never been found.',
        },
      }
    case 'bar':
      return {
        domain: 'ELECTROMAGNETISM · BAR MAGNET',
        syllabus: 'AQA 3.7.5.1 · IB 5.4 · bar magnet field',
        primaryEq: `\\mathbf{B} = \\dfrac{\\mu_0 q_m}{4\\pi}\\!\\left(\\dfrac{\\hat{r}_N}{r_N^2} - \\dfrac{\\hat{r}_S}{r_S^2}\\right)`,
        derivedEqs: [
          { label: 'Far field',   eq: `r \\gg \\ell \\implies \\mathbf{B} \\to \\text{dipole}` },
          { label: 'Interior',    eq: `\\mathbf{B}_{\\rm int} = \\mu_0(\\mathbf{H}+\\mathbf{M})` },
          { label: 'Pole strength', eq: `q_m = \\mu_0^{-1}\\oint \\mathbf{B}\\cdot d\\mathbf{A}` },
        ],
        tryThis: [
          'Compare the field far from the magnet with the dipole view — they converge.',
          'Look near the poles, where the simple two-pole model works best.',
        ],
        checkpoint: {
          q: 'Far from a bar magnet, which simpler field does it resemble?',
          a: 'A dipole field, falling off as 1/r³. Up close the pole structure matters, but at a distance any magnet looks like a point dipole.',
        },
      }
    case 'solenoid':
      return {
        domain: 'ELECTROMAGNETISM · SOLENOID',
        syllabus: 'A-level · IB 5.4 · solenoid field',
        primaryEq: `\\mathbf{B}_{\\rm int} = \\mu_0\\,n\\,I\\,\\hat{z}`,
        derivedEqs: [
          { label: 'Biot-Savart', eq: `d\\mathbf{B} = \\dfrac{\\mu_0 I}{4\\pi}\\dfrac{d\\boldsymbol{\\ell}\\times\\hat{r}}{r^2}` },
          { label: 'End field',   eq: `B_{\\rm end} = \\tfrac{1}{2}\\mu_0 n I` },
          { label: 'Inductance',  eq: `L = \\mu_0 n^2 V` },
        ],
        tryThis: [
          'See that the field inside is uniform and parallel to the axis — that’s B = μ₀nI.',
          'Watch the fringe field curl outward and drop to half strength at each end.',
        ],
        checkpoint: {
          q: 'Which two quantities set the field strength inside a long solenoid?',
          a: 'Turns per metre n and current I: B = μ₀nI. Length and diameter don’t matter for a long solenoid, and the field outside is almost zero.',
        },
      }
    case 'halbach':
      return {
        domain: 'ELECTROMAGNETISM · HALBACH ARRAY',
        syllabus: 'Enrichment · field superposition / maglev',
        primaryEq: `|\\mathbf{B}_{\\rm above}| \\approx B_r\\!\\left(1-e^{-kd}\\right)`,
        derivedEqs: [
          { label: 'Moment rotation', eq: `\\theta_k = \\dfrac{2\\pi k}{N},\\; k=0,\\ldots,N-1` },
          { label: 'Below side',      eq: `\\mathbf{B}_{\\rm below} \\approx 0 \\;\\text{(ideal)}` },
          { label: 'Enhancement',     eq: `\\approx 2\\times \\text{ vs. uniform array}` },
        ],
        tryThis: [
          'See the field pile up on one face and almost vanish on the other.',
          'That one-sided flux is exactly what maglev tracks and fridge magnets exploit.',
        ],
        checkpoint: {
          q: 'A Halbach array is strong on one side and ~zero on the other. How is that possible?',
          a: 'Each magnet’s direction is rotated in sequence so the fields add on one face and cancel on the other — pure field superposition, no special materials required.',
        },
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

function buildLorentzEquations() {
  return {
    domain: 'ELECTROMAGNETISM · LORENTZ FORCE',
    syllabus: 'AQA 3.7.5.1 · IB 5.4 · F = BQv',
    primaryEq: `\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v} \\times \\mathbf{B})`,
    derivedEqs: [
      { label: 'Cyclotron radius', eq: `r = \\dfrac{mv_\\perp}{|q|B}` },
      { label: 'Cyclotron freq',   eq: `\\omega_c = \\dfrac{|q|B}{m}` },
      { label: 'Helical pitch',    eq: `p = v_\\parallel \\cdot T_c = \\dfrac{2\\pi m v_\\parallel}{|q|B}` },
    ],
    tryThis: [
      'Increase B and watch the circular radius tighten — r = mv⊥/(qB).',
      'Give the charge some velocity along B and the circle stretches into a helix.',
    ],
    checkpoint: {
      q: 'The magnetic force on a moving charge is always perpendicular to its velocity. What does that mean for its speed?',
      a: 'The speed never changes — a perpendicular force does no work. B only bends the path into a circle or helix; it can’t speed the charge up or slow it down.',
    },
  }
}

function buildLorentzExplanation() {
  return `A charged particle (q=+1, m=1) moves through a uniform magnetic field B = B₀ŷ. The magnetic component of the Lorentz force F = qv×B acts perpendicular to both v and B — it never does work, only curves the path. The component of v perpendicular to B produces circular motion with cyclotron radius r = mv⊥/(qB). The component parallel to B (v_drift) is unaffected. Together these produce a helix: a circle in the xz-plane that advances along y. Increasing B tightens the radius; decreasing it uncoils the helix. The cyan arrow shows the instantaneous Lorentz force direction.`
}

function buildLorentzMetrics(B) {
  const vperp = 2.4
  const r = B > 0.01 ? (vperp / B).toFixed(2) : '∞'
  const wc  = B.toFixed(2)
  const Tc  = B > 0.01 ? ((2 * Math.PI / B).toFixed(2)) : '∞'
  return [
    { label: 'B field',       value: `${B.toFixed(2)} T`,   color: 'rose'  },
    { label: 'r_cyclotron',   value: `${r} u`,              color: 'cyan'  },
    { label: 'ω_c = qB/m',   value: `${wc} rad/s`,         color: 'amber' },
    { label: 'Period T_c',    value: `${Tc} s`,             color: 'dim'   },
  ]
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

function Slider({ label, value, min, max, step, onChange }) {
  return <SharedSlider label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
}

export default function ElectromagnetismModule() {
  const magnetType      = useModuleStore((s) => s.em.magnetType)
  const setMagnetType   = useModuleStore((s) => s.setEmMagnetType)
  const resetEm         = useModuleStore((s) => s.resetEm)

  const [view,           setView]           = useState('field')
  const [showFieldLines, setShowFieldLines] = useState(true)
  const [showHeatmap,    setShowHeatmap]    = useState(true)
  const [showParticles,  setShowParticles]  = useState(true)
  const [bStrength,      setBStrength]      = useState(1.0)

  const isLorentz  = view === 'lorentz'
  const activeEq   = isLorentz ? buildLorentzEquations() : buildEquations(magnetType)
  const explanation = isLorentz ? buildLorentzExplanation() : buildExplanation(magnetType)
  const metrics     = isLorentz ? buildLorentzMetrics(bStrength) : buildMetrics(magnetType)

  const { domain, primaryEq, derivedEqs, syllabus, tryThis, checkpoint } = activeEq
  const activeType = MAGNET_TYPES.find((m) => m.id === magnetType)

  return (
    <ModuleShell
      title="Electromagnetism"
      accent="#c084fc"
      views={[{ id: 'field', label: 'Field lab' }, { id: 'lorentz', label: 'Lorentz force' }]}
      activeView={view}
      onViewChange={setView}
      readout={isLorentz ? `B₀ = ${bStrength.toFixed(2)}` : <>∇·B = 0 · {activeType?.label}</>}
      lesson={
        <InfoPanel
          domain={domain}
          syllabus={syllabus}
          primaryEq={primaryEq}
          derivedEqs={derivedEqs}
          explanation={explanation}
          tryThis={tryThis}
          checkpoint={checkpoint}
          metrics={metrics}
        />
      }
      controls={
        <ControlPanel
          title={isLorentz ? 'Parameters' : 'Visualization'}
          onReset={isLorentz ? () => setBStrength(1.0) : resetEm}
          footer={isLorentz ? 'Lorentz force · RK4 integrator' : 'Biot–Savart field · RK4 tracing'}
        >
          {isLorentz ? (
            <>
              <Slider label="Field strength B₀" value={bStrength} min={0.2} max={3.0} step={0.05} onChange={setBStrength} />
              <ControlGroup label="Legend">
                <ul className="space-y-1.5 text-[13px] text-text-dim">
                  <li><span className="text-cyan-mid">━</span> Particle trail</li>
                  <li><span className="text-cyan-mid">↗</span> Lorentz force F</li>
                  <li><span className="text-violet-glow">↑</span> B-field arrows</li>
                </ul>
              </ControlGroup>
            </>
          ) : (
            <>
              <ControlGroup label="Magnet type">
                <OptionList label="Magnet type" options={MAGNET_TYPES} value={magnetType} onChange={setMagnetType} />
              </ControlGroup>
              <ControlGroup label="Display layers">
                <ToggleRow label="Field lines"   value={showFieldLines} onChange={setShowFieldLines} />
                <ToggleRow label="Iron filings slice" value={showHeatmap} onChange={setShowHeatmap} />
                <ToggleRow label="Particle flow" value={showParticles}  onChange={setShowParticles} />
              </ControlGroup>
            </>
          )}
        </ControlPanel>
      }
    >
      <SceneWrapper
        cameraPosition={isLorentz ? [4, 1, 12] : [1.2, 1.6, 10]}
        showGrid={false}
        minDist={2}
        maxDist={22}
      >
        {isLorentz
          ? <LorentzForce key="lorentz" bStrength={bStrength} />
          : <MagnetLab3D showFieldLines={showFieldLines} showHeatmap={showHeatmap} showParticles={showParticles} />
        }
      </SceneWrapper>

      <div className="absolute top-3 left-3 pointer-events-none px-2.5 py-1 rounded-md bg-ground/70 border border-border-subtle text-[12px] text-text-dim backdrop-blur-sm">
        {isLorentz ? 'Lorentz force · cyclotron motion · F = qv × B' : `Magnet lab · ${activeType?.label}`}
      </div>
    </ModuleShell>
  )
}
