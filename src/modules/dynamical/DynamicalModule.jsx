import { useState, useMemo } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import AttractorViz from './AttractorViz'
import PhaseSpace from './PhaseSpace'
import useModuleStore from '../../store/useModuleStore'
import { ATTRACTOR_DEFS } from './attractorMath'

const ATTRACTORS = [
  { id: 'lorenz',      abbr: 'LOR', label: 'Lorenz',      desc: 'Butterfly chaos — atmosphere' },
  { id: 'rossler',     abbr: 'ROS', label: 'Rössler',     desc: 'Scroll band — simplest chaos' },
  { id: 'thomas',      abbr: 'THO', label: 'Thomas',      desc: 'Labyrinth — cyclic symmetry' },
  { id: 'aizawa',      abbr: 'AIZ', label: 'Aizawa',      desc: 'Toroidal — driven oscillator' },
  { id: 'phasespace',  abbr: 'PHS', label: 'Phase Space', desc: 'Van der Pol portrait', separator: true },
]

function buildEquations(type) {
  switch (type) {
    case 'lorenz':
      return {
        domain: 'DYNAMICAL SYSTEMS · LORENZ ATTRACTOR',
        primaryEq: `\\dot{\\mathbf{X}} = \\mathbf{F}(\\mathbf{X},\\boldsymbol{\\theta})`,
        derivedEqs: [
          { label: 'ẋ', eq: `\\dot{x} = \\sigma(y-x)` },
          { label: 'ẏ', eq: `\\dot{y} = x(\\rho-z)-y` },
          { label: 'ż', eq: `\\dot{z} = xy - \\beta z` },
        ],
      }
    case 'rossler':
      return {
        domain: 'DYNAMICAL SYSTEMS · RÖSSLER ATTRACTOR',
        primaryEq: `\\dot{x} = -y - z`,
        derivedEqs: [
          { label: 'ẏ', eq: `\\dot{y} = x + ay` },
          { label: 'ż', eq: `\\dot{z} = b + z(x-c)` },
          { label: 'Default', eq: `a = b = 0.2,\\; c = 5.7` },
        ],
      }
    case 'thomas':
      return {
        domain: 'DYNAMICAL SYSTEMS · THOMAS ATTRACTOR',
        primaryEq: `\\dot{x} = \\sin y - bx`,
        derivedEqs: [
          { label: 'ẏ', eq: `\\dot{y} = \\sin z - by` },
          { label: 'ż', eq: `\\dot{z} = \\sin x - bz` },
          { label: 'Labyrinth', eq: `b = 0.19` },
        ],
      }
    case 'aizawa':
      return {
        domain: 'DYNAMICAL SYSTEMS · AIZAWA ATTRACTOR',
        primaryEq: `\\dot{z} = c + az - \\tfrac{z^3}{3} - r^2(1+ez)`,
        derivedEqs: [
          { label: 'ẋ', eq: `\\dot{x} = (z-b)x - dy` },
          { label: 'ẏ', eq: `\\dot{y} = dx + (z-b)y` },
          { label: 'Default', eq: `a=0.95,\\,b=0.7,\\,d=3.5` },
        ],
      }
    case 'phasespace':
      return {
        domain: 'NONLINEAR DYNAMICS · VAN DER POL',
        primaryEq: `\\ddot{x} - \\textcolor{#f59e0b}{\\mu}(1-x^2)\\dot{x} + x = 0`,
        derivedEqs: [
          { label: 'Phase plane form', eq: `\\dot{x} = v,\\;\\dot{v} = \\textcolor{#f59e0b}{\\mu}(1-x^2)v - x` },
          { label: 'Limit cycle exists for', eq: `\\textcolor{#f59e0b}{\\mu} > 0` },
        ],
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(type) {
  switch (type) {
    case 'lorenz':
      return `Lorenz found this while modeling weather in 1963, trimmed from 12 variables down to 3. It was the first hard proof that deterministic systems can be unpredictable: two trajectories just 10⁻¹⁵ apart become totally uncorrelated within about 50 steps. The butterfly shape is the attractor itself, not a single path. Every starting point eventually lands on it. Pull ρ below 24.74 and all 1,800 particles collapse to a fixed point; the chaos disappears.`
    case 'rossler':
      return `Rössler designed this in 1976 as the minimal continuous-time chaotic system. Only one nonlinear term (z·x) appears in the whole set of equations. Chaos enters through period-doubling: as c grows, the orbit splits 1→2→4→8→∞ cycles before going fully chaotic. The XY projection shows a flat spiral with a hook on one side, called the Rössler band. Adjust a to change how tight or spread out the scroll becomes.`
    case 'thomas':
      return `René Thomas built this in 1999 to study chaos from three sine-coupled oscillators. The parameter b controls dissipation. At b = 0.19, particles enter a labyrinth: they wander through an infinite corridor and never repeat. The attractor is 3-fold symmetric under 120° permutations of x, y, z. Lower b toward 0 and chaos fills more of space. Push b above 0.21 and trajectories settle into limit cycles. No fixed points exist in the chaotic regime.`
    case 'aizawa':
      return `Aizawa's system wraps chaos around a torus-like surface with a hollow center. The z-axis acts as a driver for a circular oscillator in the xy-plane. Adjust a near 0.95 to stretch or compress the torus; lower b to close the inner void. Lyapunov exponents here are much smaller than Lorenz, so the chaos feels more structured and geometric. Instead of a butterfly, you get a quiet doughnut that rearranges endlessly without quite repeating.`
    case 'phasespace':
      return `The Van der Pol oscillator was built in 1927 to model oscillations in vacuum tube circuits. At μ = 0 it's a perfect harmonic oscillator, circular in phase space. As μ increases, the limit cycle distorts. By μ = 3 the oscillator snaps into relaxation mode, with slow drift and fast jumps. The fixed point at the origin is an unstable focus for all μ > 0, so every trajectory eventually settles onto the limit cycle. Each particle in the scene is an independent initial condition converging toward it.`
    default:
      return ''
  }
}

function buildMetrics(type, p) {
  switch (type) {
    case 'lorenz': {
      const chaotic = p.rho > 24.74
      return [
        { label: 'σ',              value: p.sigma.toFixed(1),        color: 'cyan'  },
        { label: 'ρ',              value: p.rho.toFixed(1),           color: 'amber' },
        { label: 'β',              value: p.beta.toFixed(2),          color: 'dim'   },
        { label: 'Chaos threshold', value: 'ρ > 24.74',              color: 'dim'   },
        { label: 'Regime',         value: chaotic ? 'CHAOTIC' : 'STABLE', color: chaotic ? 'rose' : 'cyan' },
      ]
    }
    case 'rossler': {
      const chaotic = p.c > 5.4
      return [
        { label: 'a',       value: p.a.toFixed(2), color: 'cyan'  },
        { label: 'b',       value: p.b.toFixed(2), color: 'dim'   },
        { label: 'c',       value: p.c.toFixed(1), color: 'amber' },
        { label: 'Route',   value: 'Period-doubling', color: 'dim' },
        { label: 'Regime',  value: chaotic ? 'CHAOTIC' : 'PERIODIC', color: chaotic ? 'rose' : 'cyan' },
      ]
    }
    case 'thomas':
      return [
        { label: 'b',        value: p.b.toFixed(3),      color: 'amber' },
        { label: 'Lyapunov', value: 'λ ≈ 0.19',          color: 'cyan'  },
        { label: 'Symmetry', value: 'Cyclic 3-fold',      color: 'dim'   },
        { label: 'Regime',   value: p.b < 0.21 ? 'LABYRINTH' : 'LIMIT CYCLE', color: p.b < 0.21 ? 'rose' : 'cyan' },
      ]
    case 'aizawa':
      return [
        { label: 'a',      value: p.a.toFixed(2),  color: 'cyan'  },
        { label: 'b',      value: p.b.toFixed(2),  color: 'amber' },
        { label: 'Shape',  value: 'Toroidal',       color: 'dim'   },
        { label: 'Regime', value: 'CHAOTIC',        color: 'rose'  },
      ]
    case 'phasespace':
      return [
        { label: 'μ  (nonlinearity)', value: p.mu?.toFixed(2) ?? '1.00', color: 'amber' },
        { label: 'Limit cycle',       value: (p.mu ?? 1) > 0 ? 'EXISTS' : 'ABSENT', color: (p.mu ?? 1) > 0 ? 'cyan' : 'dim' },
        { label: 'Fixed point',       value: (p.mu ?? 1) > 0 ? 'UNSTABLE' : 'STABLE', color: (p.mu ?? 1) > 0 ? 'rose' : 'cyan' },
        { label: 'Type',              value: (p.mu ?? 1) > 2.5 ? 'RELAXATION' : 'SOFT', color: 'dim' },
      ]
    default:
      return []
  }
}

function Slider({ label, value, min, max, step, decimals, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-wider uppercase text-text-dim">
          {label}
        </span>
        <span className="font-mono-data text-[11px] text-emerald-glow tabular-nums">
          {value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-0.5 accent-emerald-glow cursor-pointer"
        style={{ accentColor: '#10b981' }}
      />
    </div>
  )
}

export default function DynamicalModule() {
  const attractorType    = useModuleStore((s) => s.ds.attractorType)
  const phaseMu          = useModuleStore((s) => s.ds.phaseMu)
  const setAttractorType = useModuleStore((s) => s.setDsAttractorType)
  const setPhaseMu       = useModuleStore((s) => s.setDsPhaseMu)
  const setActiveModule  = useModuleStore((s) => s.setActiveModule)

  // Lorenz params
  const [sigma, setSigma] = useState(10)
  const [rho,   setRho]   = useState(28)
  const [beta,  setBeta]  = useState(2.667)

  // Rössler params
  const [rossA, setRossA] = useState(0.2)
  const [rossC, setRossC] = useState(5.7)

  // Thomas params
  const [thomB, setThomB] = useState(0.19)

  // Aizawa params
  const [aizA, setAizA] = useState(0.95)
  const [aizB, setAizB] = useState(0.7)

  // Speed
  const [speed, setSpeed] = useState(1.0)

  const params = useMemo(() => {
    switch (attractorType) {
      case 'lorenz':      return { sigma, rho, beta }
      case 'rossler':     return { a: rossA, b: 0.2, c: rossC }
      case 'thomas':      return { b: thomB }
      case 'aizawa':      return { a: aizA, b: aizB, c: 0.6, d: 3.5, e: 0.25, f: 0.1 }
      case 'phasespace':  return { mu: phaseMu }
      default:            return {}
    }
  }, [attractorType, sigma, rho, beta, rossA, rossC, thomB, aizA, aizB, phaseMu])

  const { domain, primaryEq, derivedEqs } = buildEquations(attractorType)
  const explanation = buildExplanation(attractorType)
  const metrics     = buildMetrics(attractorType, params)

  const isPhaseSpace = attractorType === 'phasespace'
  const def = ATTRACTOR_DEFS[attractorType] ?? { name: 'Phase Space', dt: 0.012 }

  function resetParams() {
    setSigma(10); setRho(28); setBeta(2.667)
    setRossA(0.2); setRossC(5.7)
    setThomB(0.19)
    setAizA(0.95); setAizB(0.7)
    setSpeed(1.0)
    setPhaseMu(1.0)
  }

  function paramSliders() {
    switch (attractorType) {
      case 'lorenz':
        return (
          <>
            <Slider label="σ  sigma" value={sigma} min={1}   max={20}  step={0.5} decimals={1} onChange={setSigma} />
            <Slider label="ρ  rho"   value={rho}   min={10}  max={45}  step={0.5} decimals={1} onChange={setRho}   />
            <Slider label="β  beta"  value={beta}  min={0.5} max={5.0} step={0.1} decimals={2} onChange={setBeta}  />
            {rho > 24.74 && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-rose-glow/40 bg-rose-glow/5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-glow animate-pulse-glow" />
                <span className="font-mono-data text-[10px] tracking-wider text-rose-glow uppercase">Chaotic</span>
              </div>
            )}
            {rho <= 24.74 && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-cyan-glow/30 bg-cyan-glow/5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow" />
                <span className="font-mono-data text-[10px] tracking-wider text-cyan-glow uppercase">Stable</span>
              </div>
            )}
          </>
        )
      case 'rossler':
        return (
          <>
            <Slider label="a" value={rossA} min={0.1} max={0.5} step={0.01} decimals={2} onChange={setRossA} />
            <Slider label="c" value={rossC} min={3.0} max={10}  step={0.1}  decimals={1} onChange={setRossC} />
          </>
        )
      case 'thomas':
        return (
          <Slider label="b  dissipation" value={thomB} min={0.05} max={0.38} step={0.005} decimals={3} onChange={setThomB} />
        )
      case 'aizawa':
        return (
          <>
            <Slider label="a" value={aizA} min={0.5} max={1.2} step={0.05} decimals={2} onChange={setAizA} />
            <Slider label="b" value={aizB} min={0.4} max={1.0} step={0.05} decimals={2} onChange={setAizB} />
          </>
        )
      case 'phasespace':
        return (
          <Slider label="μ  nonlinearity" value={phaseMu} min={0} max={3} step={0.05} decimals={2} onChange={setPhaseMu} />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-emerald-glow transition-colors duration-200 uppercase flex items-center gap-1.5"
          >
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">
            Dynamical Systems
          </h1>
          <span className="font-mono-data text-[9px] tracking-wider uppercase px-2 py-0.5 border border-emerald-glow/30 text-emerald-glow/60 rounded bg-emerald-glow/5">
            Strange Attractors · RK4 · Phase Space
          </span>
        </div>

        {/* Attractor nav */}
        <nav className="flex gap-1" aria-label="Attractor type">
          {ATTRACTORS.map((a) => {
            const active = attractorType === a.id
            return (
              <button
                key={a.id}
                onClick={() => setAttractorType(a.id)}
                title={a.desc}
                className={[
                  'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                  active
                    ? 'border-emerald-glow text-emerald-glow bg-emerald-glow/5 shadow-glow-emerald'
                    : 'border-border-subtle text-text-dim hover:border-emerald-glow/50 hover:text-text-primary',
                ].join(' ')}
              >
                {a.abbr}
              </button>
            )
          })}
        </nav>

        <div
          className="font-mono-data text-sm tabular-nums"
          style={{ color: '#10b981', textShadow: '0 0 8px rgba(16,185,129,0.5)' }}
        >
          {isPhaseSpace ? `Van der Pol · μ = ${phaseMu.toFixed(2)}` : `${def.name} · 1,800 particles`}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Info panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Phase Space"
            domain={domain}
            primaryEq={primaryEq}
            derivedEqs={derivedEqs}
            explanation={explanation}
            metrics={metrics}
            footer="DYNAMICAL SYSTEMS · CHAOS THEORY"
            accentColor="cyan"
          />
        </div>

        {/* 3D scene */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper
            cameraPosition={isPhaseSpace ? [0, 0, 9] : [0, 3, 8]}
            showGrid={false}
            minDist={2}
            maxDist={20}
          >
            {!isPhaseSpace && (
              <AttractorViz
                key={attractorType}
                attractorType={attractorType}
                params={params}
                speedMultiplier={speed}
              />
            )}
            {isPhaseSpace && <PhaseSpace key="phasespace" />}
          </SceneWrapper>

          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {isPhaseSpace ? `Van der Pol · Phase Portrait · RK4 · dt = ${def.dt}` : `${def.name} Attractor · RK4 · dt = ${def.dt}`}
            </span>
          </div>
        </main>

        {/* Right control panel */}
        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
                style={{ backgroundColor: '#10b981', boxShadow: '0 0 4px 1px rgba(16,185,129,0.6)' }}
              />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">
                Parameters
              </span>
            </div>
            <button
              onClick={resetParams}
              className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-emerald-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-emerald-glow/40 rounded"
            >
              RST
            </button>
          </div>

          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto thin-scroll">
            {/* Attractor selector */}
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">
                Attractor
              </p>
              <div className="flex flex-col gap-1.5">
                {ATTRACTORS.map((a) => (
                  <div key={a.id}>
                    {a.separator && <div className="h-px bg-border-subtle my-1" />}
                    <button
                      onClick={() => setAttractorType(a.id)}
                      className={[
                        'w-full flex flex-col items-start px-3 py-2 rounded border font-mono-data text-left transition-all duration-200',
                        attractorType === a.id
                          ? 'border-emerald-glow/50 bg-emerald-glow/5'
                          : 'border-border-subtle text-text-dim hover:border-emerald-glow/30',
                      ].join(' ')}
                    >
                      <span className={`text-[11px] tracking-wider uppercase ${attractorType === a.id ? 'text-emerald-glow' : ''}`}>
                        {a.label}
                      </span>
                      <span className="text-[9px] text-text-dim mt-0.5 leading-tight">{a.desc}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Parameter sliders for current attractor */}
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-3">
                ODE Parameters
              </p>
              <div className="flex flex-col gap-3">
                {paramSliders()}
              </div>
            </div>

            {!isPhaseSpace && <div className="h-px bg-border-subtle" />}

            {/* Speed */}
            {!isPhaseSpace && (
              <div>
                <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-3">
                  Simulation Speed
                </p>
                <Slider
                  label="Speed"
                  value={speed}
                  min={0.25}
                  max={3.0}
                  step={0.25}
                  decimals={2}
                  onChange={setSpeed}
                />
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[10px] text-text-dim leading-relaxed">
              {isPhaseSpace ? 'DS · VAN DER POL · RK4' : 'DS · 1,800 PARTICLES · TRAIL 72'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
