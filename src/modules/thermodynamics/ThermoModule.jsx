import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import GasSimulation from './GasSimulation'
import Entropy from './Entropy'
import HeatEngine from './HeatEngine'
import IsingModel from './IsingModel'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'gas',    label: 'Gas' },
  { id: 'entropy', label: 'Entropy' },
  { id: 'engine', label: 'Heat Engine' },
  { id: 'ising',  label: 'Ising Model' },
]

const TC = 2.0 / Math.log(1 + Math.sqrt(2))   // ≈ 2.2692

const CAMERA = {
  gas:    [0, 0, 14],
  entropy: [0, 0, 14],
  engine: [0, 2.5, 14],
  ising:  [0, 9, 8],
}

function buildEquations(view) {
  switch (view) {
    case 'gas':
      return {
        domain: 'THERMODYNAMICS · KINETIC THEORY',
        primaryEq: `f(v) = 4\\pi n\\!\\left(\\frac{m}{2\\pi k_B T}\\right)^{3/2}\\!v^2 e^{-mv^2/2k_BT}`,
        derivedEqs: [
          { label: 'Mean kinetic energy', eq: `\\langle E_k \\rangle = \\tfrac{3}{2}k_BT` },
          { label: 'RMS speed',           eq: `v_{\\rm rms} = \\sqrt{\\dfrac{3k_BT}{m}}` },
        ],
      }
    case 'entropy':
      return {
        domain: 'THERMODYNAMICS · ENTROPY',
        primaryEq: `S = k_B \\ln \\Omega`,
        derivedEqs: [
          { label: 'Second law',   eq: `\\Delta S_{\\rm univ} \\geq 0` },
          { label: 'Gibbs entropy', eq: `S = -k_B \\sum_i p_i \\ln p_i` },
        ],
      }
    case 'engine':
      return {
        domain: 'THERMODYNAMICS · CARNOT CYCLE',
        primaryEq: `\\eta_{\\rm Carnot} = 1 - \\frac{T_C}{T_H}`,
        derivedEqs: [
          { label: 'First law',  eq: `\\Delta U = Q - W` },
          { label: 'Adiabatic', eq: `PV^\\gamma = {\\rm const}` },
        ],
      }
    case 'ising':
      return {
        domain: 'STATISTICAL MECHANICS · PHASE TRANSITION',
        primaryEq: `\\mathcal{H} = -J\\sum_{\\langle i,j\\rangle} s_i s_j,\\quad s_i = \\pm 1`,
        derivedEqs: [
          { label: 'Curie temp (exact)', eq: `T_c = \\dfrac{2J}{k_B\\ln(1+\\sqrt{2})} \\approx 2.269\\,\\tfrac{J}{k_B}` },
          { label: 'Metropolis rule', eq: `P(\\text{flip}) = \\min\\!\\left(1,\\,e^{-\\Delta E/k_BT}\\right)` },
        ],
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
      return `Two gases start separated by a partition — cyan on the left, orange on the right. After 2 seconds the partition opens. The gases spontaneously mix. This is entropy: the number of microstates Ω consistent with the macrostate surges, so S = k ln Ω rises sharply. The second law says this process is irreversible — you will never see the gases spontaneously un-mix. Temperature controls how vigorously particles collide and cross the barrier once it opens.`
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
  const TH  = (temperature * 2 + 1).toFixed(2)
  const eff = ((1 - 1 / (temperature * 2 + 1)) * 100).toFixed(1)
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

function Slider({ label, value, min, max, step, decimals, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-wider uppercase text-text-dim">{label}</span>
        <span className="font-mono-data text-[11px] tabular-nums" style={{ color: '#38bdf8' }}>{value.toFixed(decimals)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-0.5 cursor-pointer" style={{ accentColor: '#38bdf8' }} />
    </div>
  )
}

export default function ThermoModule() {
  const setActiveModule  = useModuleStore((s) => s.setActiveModule)
  const temperature      = useModuleStore((s) => s.thermo.temperature)
  const thermoView       = useModuleStore((s) => s.thermo.viewType)
  const setThermoTemp    = useModuleStore((s) => s.setThermoTemp)
  const setThermoView    = useModuleStore((s) => s.setThermoView)
  const resetThermo      = useModuleStore((s) => s.resetThermo)

  const { domain, primaryEq, derivedEqs } = buildEquations(thermoView)
  const explanation = buildExplanation(thermoView)
  const metrics     = buildMetrics(thermoView, temperature)

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      <style>{`@keyframes umbra-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-sky-glow transition-colors duration-200 uppercase flex items-center gap-1.5">
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">Thermodynamics</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border shrink-0"
            style={{ borderColor: 'rgba(56,189,248,0.25)', background: 'rgba(56,189,248,0.05)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8', animation: 'umbra-pulse 1.8s ease-in-out infinite' }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(56,189,248,0.7)' }}>LIVE</span>
          </div>
        </div>

        <nav className="flex gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setThermoView(v.id)}
              role="tab"
              aria-selected={thermoView === v.id ? 'true' : 'false'}
              className={[
                'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                thermoView === v.id
                  ? 'border-sky-glow text-sky-glow bg-sky-glow/5 shadow-glow-sky'
                  : 'border-border-subtle text-text-dim hover:border-sky-glow/50 hover:text-text-primary',
              ].join(' ')}>
              {v.label}
            </button>
          ))}
        </nav>

        <div className="font-mono-data text-sm tabular-nums" style={{ color: '#38bdf8', textShadow: '0 0 8px rgba(56,189,248,0.5)' }}>
          S = k_B ln Ω · T = {temperature.toFixed(2)}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel title="Thermodynamics" domain={domain} primaryEq={primaryEq}
            derivedEqs={derivedEqs} explanation={explanation} metrics={metrics}
            footer="THERMODYNAMICS · k_B = 1 (units)" accentColor="cyan" />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={CAMERA[thermoView]} showGrid={false} minDist={2} maxDist={30}>
            {thermoView === 'gas'    && <GasSimulation  key="gas"    temperature={temperature} />}
            {thermoView === 'entropy' && <Entropy         key="ent"    temperature={temperature} />}
            {thermoView === 'engine' && <HeatEngine      key="eng"    temperature={temperature} />}
            {thermoView === 'ising'  && <IsingModel      key="ising"  temperature={temperature} />}
          </SceneWrapper>
          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {thermoView === 'gas'     ? 'Maxwell-Boltzmann Distribution · Kinetic Theory'
               : thermoView === 'entropy' ? 'Entropy Increase · Second Law of Thermodynamics'
               : thermoView === 'ising'   ? 'Ising Model · Metropolis MC · Phase Transition'
               : 'Carnot Cycle · PV Diagram · Maximum Efficiency'}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded border pointer-events-none"
            style={{ borderColor: 'rgba(56,189,248,0.18)', background: 'rgba(8,9,10,0.85)' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 4px #38bdf8' }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(56,189,248,0.5)' }}>SIM ACTIVE</span>
          </div>
          <div className="absolute bottom-4 right-4 font-mono-data text-[8px] tracking-[0.12em] pointer-events-none"
            style={{ color: 'rgba(56,189,248,0.28)' }}>
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </main>

        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ backgroundColor: '#38bdf8', boxShadow: '0 0 4px 1px rgba(56,189,248,0.6)' }} />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">Parameters</span>
            </div>
            <button onClick={resetThermo}
              className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-sky-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-sky-glow/40 rounded">
              RST
            </button>
          </div>

          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto thin-scroll">
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">View</p>
              <div className="flex flex-col gap-1.5">
                {VIEWS.map((v) => (
                  <button key={v.id} onClick={() => setThermoView(v.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded border font-mono-data text-[11px] tracking-wide transition-all duration-150',
                      thermoView === v.id
                        ? 'border-sky-glow/60 bg-sky-glow/5 text-text-primary'
                        : 'border-border-subtle text-text-dim hover:border-sky-glow/30',
                    ].join(' ')}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-3">Temperature</p>
              <Slider label="T  temperature" value={temperature} min={0.2} max={3.0} step={0.05} decimals={2} onChange={setThermoTemp} />
            </div>
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[9px] text-text-dim tracking-wider">
              THERMO · k_B = 1 (NATURAL UNITS)
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
