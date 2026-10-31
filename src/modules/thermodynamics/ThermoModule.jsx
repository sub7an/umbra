import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption } from '../../components/ModuleShell'
import ControlPanel from '../../components/ControlPanel'
import GasSimulation from './GasSimulation'
import Entropy from './Entropy'
import HeatEngine from './HeatEngine'
import { hotReservoirT } from './carnot'
import IsingModel from './IsingModel'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'gas',    label: 'Gas' },
  { id: 'entropy', label: 'Entropy' },
  { id: 'engine', label: 'Heat engine' },
  { id: 'ising',  label: 'Ising model' },
]

const TC = 2.0 / Math.log(1 + Math.sqrt(2))   // ≈ 2.2692

const CAMERA = {
  gas:    [9, 6.5, 15],
  entropy: [0, 0, 14],
  engine: [0, 2.5, 14],
  ising:  [0, 9, 8],
}

function buildEquations(view) {
  switch (view) {
    case 'gas':
      return {
        domain: 'THERMODYNAMICS · KINETIC THEORY',
        syllabus: 'AQA 3.6.2 · IB 3.1 · kinetic theory',
        primaryEq: `f(v) = 4\\pi n\\!\\left(\\frac{m}{2\\pi k_B T}\\right)^{3/2}\\!v^2 e^{-mv^2/2k_BT}`,
        derivedEqs: [
          { label: 'Mean kinetic energy', eq: `\\langle E_k \\rangle = \\tfrac{3}{2}k_BT` },
          { label: 'RMS speed',           eq: `v_{\\rm rms} = \\sqrt{\\dfrac{3k_BT}{m}}` },
        ],
        tryThis: [
          'Raise T and watch the Maxwell-Boltzmann curve flatten and slide to higher speeds.',
          'Note v_rms grows only as √T — you must quadruple T to double the typical speed.',
        ],
        checkpoint: {
          q: 'You double the absolute temperature of a gas. What happens to the mean kinetic energy of its molecules?',
          a: 'It doubles. ⟨E_k⟩ = (3/2)k_BT is proportional to absolute temperature. But v_rms rises only by √2, because energy depends on v².',
        },
      }
    case 'entropy':
      return {
        domain: 'THERMODYNAMICS · ENTROPY',
        syllabus: 'A-level thermal · IB B.2 · entropy',
        primaryEq: `S = k_B \\ln \\Omega`,
        derivedEqs: [
          { label: 'Second law',   eq: `\\Delta S_{\\rm univ} \\geq 0` },
          { label: 'Gibbs entropy', eq: `S = -k_B \\sum_i p_i \\ln p_i` },
        ],
        tryThis: [
          'Start the gas all in one corner and watch it spread — entropy climbing as it fills the box.',
          'Try to make it gather back into the corner on its own. It won’t.',
        ],
        checkpoint: {
          q: 'Why does gas released in a corner always spread to fill the box, but never spontaneously gather back?',
          a: 'There are vastly more microstates for “spread out” than “in a corner”, so S = k_B ln Ω rises. The second law (ΔS ≥ 0) makes the reverse overwhelmingly improbable — not forbidden, just astronomically unlikely.',
        },
      }
    case 'engine':
      return {
        domain: 'THERMODYNAMICS · CARNOT CYCLE',
        syllabus: 'AQA engines option · IB B.2 · Carnot',
        primaryEq: `\\eta_{\\rm Carnot} = 1 - \\frac{T_C}{T_H}`,
        derivedEqs: [
          { label: 'First law',  eq: `\\Delta U = Q - W` },
          { label: 'Adiabatic', eq: `PV^\\gamma = {\\rm const}` },
        ],
        tryThis: [
          'Raise T_H or lower T_C and watch efficiency climb toward 1 — η = 1 − T_C/T_H.',
          'Drag T to its minimum so T_H nears T_C: the loop collapses and efficiency heads to zero. No temperature difference means no work.',
        ],
        checkpoint: {
          q: 'A Carnot engine runs between 600 K and 300 K. What is its maximum possible efficiency?',
          a: '50%. η = 1 − T_C/T_H = 1 − 300/600 = 0.5. No real engine working between these two temperatures can beat this ideal limit.',
        },
      }
    case 'ising':
      return {
        domain: 'STATISTICAL MECHANICS · PHASE TRANSITION',
        syllabus: 'Enrichment · ferromagnetism & phase transitions',
        primaryEq: `\\mathcal{H} = -J\\sum_{\\langle i,j\\rangle} s_i s_j,\\quad s_i = \\pm 1`,
        derivedEqs: [
          { label: 'Curie temp (exact)', eq: `T_c = \\dfrac{2J}{k_B\\ln(1+\\sqrt{2})} \\approx 2.269\\,\\tfrac{J}{k_B}` },
          { label: 'Metropolis rule', eq: `P(\\text{flip}) = \\min\\!\\left(1,\\,e^{-\\Delta E/k_BT}\\right)` },
        ],
        tryThis: [
          'Cool below T_c ≈ 2.27 J/k_B and watch the spins snap into aligned domains.',
          'Heat back above T_c and the order dissolves into random noise.',
        ],
        checkpoint: {
          q: 'As you cool the lattice through its Curie temperature, magnetization appears abruptly. What is happening?',
          a: 'A phase transition — spontaneous magnetization. Below T_c, spin alignment wins over thermal disorder and the material becomes a ferromagnet.',
        },
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'gas':
      return `300 particles bounce elastically inside a box. Each particle's speed follows the Maxwell-Boltzmann distribution — a consequence of maximizing entropy subject to a fixed mean energy. Color codes speed: blue is slow, orange is fast. Raise temperature and you see the distribution broaden: more particles reach high speeds, the average kinetic energy climbs as ⟨E⟩ = 3kT/2, and the peak of the distribution shifts right. This is statistical mechanics in real time.`
    case 'entropy':
      return `Two gases start separated by a partition — gas A (cyan) on the left, gas B (orange) on the right. After 2 seconds the partition lifts away. The gases spontaneously mix. This is entropy: the number of microstates Ω consistent with the macrostate surges, so S = k ln Ω rises sharply. The second law says this process is irreversible — you will never see the gases spontaneously un-mix. Temperature controls how vigorously particles collide and cross the barrier once it opens.`
    case 'engine':
      return `The Carnot cycle traces the most efficient heat engine possible between hot (T_H) and cold (T_C) reservoirs. Two isothermal strokes (at constant temperature, the gas exchanges heat) alternate with two adiabatic strokes (no heat exchange, the gas does mechanical work by expansion). The enclosed area on the PV diagram is the net work done per cycle. Carnot's theorem proves no engine can exceed this efficiency — it is a thermodynamic limit, not an engineering one.`
    case 'ising':
      return `Each cell is a magnetic spin (±1) on a 40×40 square lattice with periodic boundary conditions. At every frame, the Metropolis algorithm attempts 4 sweeps of random spin flips: a flip is always accepted if it lowers energy, otherwise accepted with probability exp(−ΔE/kT).

Below the critical temperature T_c ≈ 2.269 (Onsager exact solution, 1944), thermal fluctuations are weak — the system spontaneously breaks Z₂ symmetry and the spins align into ordered domains (ferromagnetic phase, |M| → 1). Above T_c, entropy wins and the lattice randomizes (paramagnetic phase, |M| → 0). The phase transition is second-order: the order parameter |M| decreases continuously from 1 to 0. Drag temperature past T_c and watch the pattern lose its clusters.`

    default:
      return ''
  }
}

function buildMetrics(view, temperature) {
  const TH  = hotReservoirT(temperature).toFixed(2)
  const eff = ((1 - 1 / hotReservoirT(temperature)) * 100).toFixed(1)
  const vrms = (Math.sqrt(3 * temperature)).toFixed(2)
  switch (view) {
    case 'gas':
      return [
        { label: 'Temperature T', value: temperature.toFixed(2),  color: 'cyan'  },
        { label: '⟨E_k⟩',         value: `${(1.5*temperature).toFixed(2)} k_B`, color: 'amber' },
        { label: 'v_rms',          value: `${vrms} (arb)`,        color: 'cyan'  },
        { label: 'Particles',      value: '300',                   color: 'dim'   },
      ]
    case 'entropy':
      return [
        { label: 'Temperature T', value: temperature.toFixed(2), color: 'cyan'  },
        { label: 'Initial ΔS',    value: '0',                     color: 'dim'   },
        { label: 'After mixing',  value: 'ΔS > 0',                color: 'amber' },
        { label: 'Reversible?',   value: 'NEVER ♻',               color: 'cyan'  },
      ]
    case 'engine':
      return [
        { label: 'T_hot',     value: TH,         color: 'cyan'  },
        { label: 'T_cold',    value: '1.00',      color: 'amber' },
        { label: 'Efficiency η', value: `${eff}%`, color: 'cyan'  },
        { label: 'Cycle',     value: 'Carnot',    color: 'dim'   },
      ]
    case 'ising': {
      const ratio = temperature / TC
      const phase = temperature < TC ? 'FERROMAGNETIC' : 'PARAMAGNETIC'
      return [
        { label: 'T (current)',     value: temperature.toFixed(3),    color: 'cyan'  },
        { label: 'T_c (critical)',  value: TC.toFixed(4),             color: 'amber' },
        { label: 'T / T_c',        value: ratio.toFixed(4),  color: ratio < 1 ? 'cyan' : 'rose' },
        { label: 'Phase',          value: phase, color: ratio < 1 ? 'cyan' : 'rose' },
        { label: 'Lattice',        value: '40 × 40',                  color: 'dim'   },
        { label: 'Boundary',       value: 'Periodic',                 color: 'dim'   },
        { label: '|M| live',       value: '→ scene readout',          color: 'dim'   },
      ]
    }
    default:
      return []
  }
}


export default function ThermoModule() {
  const temperature      = useModuleStore((s) => s.thermo.temperature)
  const thermoView       = useModuleStore((s) => s.thermo.viewType)
  const setThermoTemp    = useModuleStore((s) => s.setThermoTemp)
  const setThermoView    = useModuleStore((s) => s.setThermoView)
  const resetThermo      = useModuleStore((s) => s.resetThermo)

  const { domain, primaryEq, derivedEqs, syllabus, tryThis, checkpoint } = buildEquations(thermoView)
  const explanation = buildExplanation(thermoView)
  const metrics     = buildMetrics(thermoView, temperature)

  return (
    <ModuleShell
      title="Thermodynamics"
      accent="#38bdf8"
      views={VIEWS}
      activeView={thermoView}
      onViewChange={setThermoView}
      readout={<>T = {temperature.toFixed(2)}</>}
      lesson={
        <InfoPanel domain={domain} syllabus={syllabus} primaryEq={primaryEq}
          derivedEqs={derivedEqs} explanation={explanation} tryThis={tryThis} checkpoint={checkpoint} metrics={metrics} />
      }
      controls={
        <ControlPanel
          title="Parameters"
          onReset={resetThermo}
          footer="Natural units · k_B = 1"
          controls={[{ label: 'Temperature T', min: 0.2, max: 3.0, step: 0.05, value: temperature, onChange: setThermoTemp }]}
        />
      }
    >
      <SceneWrapper cameraPosition={CAMERA[thermoView]} showGrid={false} minDist={2} maxDist={30} idleRotate={thermoView === 'gas' || thermoView === 'ising'}>
        {thermoView === 'gas'     && <GasSimulation key="gas"   temperature={temperature} />}
        {thermoView === 'entropy' && <Entropy       key="ent"   temperature={temperature} />}
        {thermoView === 'engine'  && <HeatEngine    key="eng"   temperature={temperature} />}
        {thermoView === 'ising'   && <IsingModel    key="ising" temperature={temperature} />}
      </SceneWrapper>
      <SceneCaption>
        {thermoView === 'gas'     ? 'Maxwell–Boltzmann distribution · kinetic theory'
         : thermoView === 'entropy' ? 'Entropy increase · second law'
         : thermoView === 'ising'   ? 'Ising model · Metropolis Monte Carlo · phase transition'
         : 'Carnot cycle · PV diagram · maximum efficiency'}
      </SceneCaption>
    </ModuleShell>
  )
}
