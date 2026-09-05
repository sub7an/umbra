import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import StreamLines from './StreamLines'
import VortexShedding from './VortexShedding'
import SPH from './SPH'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'streamlines', label: 'Streamlines' },
  { id: 'vortex',      label: 'Vortex Street' },
  { id: 'sph',         label: 'SPH' },
]

const CAMERA = {
  streamlines: [0, 0, 17],
  vortex:      [0, 0, 20],
  sph:         [4, 2, 15],
}

function buildEquations(view) {
  switch (view) {
    case 'streamlines':
      return {
        domain: 'FLUID DYNAMICS · POTENTIAL FLOW',
        primaryEq: `\\nabla^2 \\phi = 0,\\quad \\mathbf{u} = \\nabla\\phi`,
        derivedEqs: [
          { label: 'Stream function', eq: `\\phi = U\\!\\left(r + \\frac{R^2}{r}\\right)\\cos\\theta` },
          { label: 'Bernoulli', eq: `p + \\tfrac{1}{2}\\rho u^2 = {\\rm const}` },
        ],
      }
    case 'vortex':
      return {
        domain: 'FLUID DYNAMICS · DISCRETE VORTEX METHOD',
        primaryEq: `\\mathbf{u}(\\mathbf{x}) = \\frac{1}{2\\pi}\\sum_k \\frac{\\Gamma_k\\,(\\mathbf{x}-\\mathbf{x}_k)^\\perp}{|\\mathbf{x}-\\mathbf{x}_k|^2 + \\sigma^2}`,
        derivedEqs: [
          { label: 'Biot-Savart (2D)', eq: `\\mathbf{u} = -\\frac{\\Gamma}{2\\pi r^2}(y\\hat x - x\\hat y)` },
          { label: 'Strouhal number', eq: `St = \\frac{fD}{U} \\approx 0.20` },
        ],
      }
    case 'sph':
      return {
        domain: 'FLUID DYNAMICS · SPH (NAVIER-STOKES)',
        primaryEq: `\\rho\\!\\left(\\frac{D\\mathbf{u}}{Dt}\\right) = -\\nabla p + \\mu\\nabla^2\\mathbf{u} + \\rho\\mathbf{g}`,
        derivedEqs: [
          { label: 'SPH density', eq: `\\rho_i = \\sum_j m_j W(|\\mathbf{r}_{ij}|,h)` },
          { label: 'Pressure', eq: `p_i = k(\\rho_i - \\rho_0)` },
        ],
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'streamlines':
      return `Potential flow is the simplest model of an ideal (inviscid, irrotational, incompressible) fluid. The velocity field is a gradient of a scalar potential φ satisfying Laplace's equation. Around a cylinder the exact solution bends streamlines symmetrically — no drag, no vortices. This is D'Alembert's paradox: the theory predicts zero drag, but real fluids create a wake. Color codes speed: blue is slow (stagnation), orange is fast (shoulders of cylinder where flow accelerates). The orange dots mark stagnation points at the front and rear.`
    case 'vortex':
      return `When a real viscous fluid flows past a cylinder above a critical Reynolds number (~47), the wake becomes unstable and alternating vortices are shed — the Kármán vortex street. Here each vortex is a point singularity with circulation Γ. Tracer particles are advected by the sum of all vortex velocities (Biot-Savart law). Red vortices have positive circulation (CCW), blue have negative (CW). They self-organize into two staggered rows separated by 0.28D and advancing at ~0.7U. The Strouhal number St ≈ 0.20 is nearly universal across a wide Reynolds range.`
    case 'sph':
      return `Smoothed Particle Hydrodynamics (SPH) discretizes the Navier-Stokes equations into 216 interacting 3D particles. Each particle carries mass, velocity, and pressure; density is summed over neighbors via the Müller Poly6 kernel. Pressure repels compressed particles; viscosity damps relative motion; gravity pulls the column down. The result is a 3D dam break: a tall block collapses, splashes across the box in all three axes, and eventually settles. Color encodes velocity speed — blue = slow (settled), cyan → amber = accelerating, white = peak impact. The additive glow reveals density: overlapping fast particles create bright halos.`
    default:
      return ''
  }
}

function buildMetrics(view, reynolds) {
  const U = (0.4 + reynolds * 0.55).toFixed(2)
  const G = (2.0 + reynolds * 0.8).toFixed(2)
  switch (view) {
    case 'streamlines':
      return [
        { label: 'Free-stream U', value: `${U} m/s`,         color: 'cyan'  },
        { label: 'Cylinder R',    value: '1.2 units',         color: 'dim'   },
        { label: 'Drag coeff',    value: 'C_D = 0 (ideal)',   color: 'amber' },
        { label: 'Model',         value: 'Irrotational',      color: 'cyan'  },
      ]
    case 'vortex':
      return [
        { label: 'Free-stream U', value: '1.5 m/s',           color: 'cyan'  },
        { label: 'Vortex Γ',      value: `${G} m²/s`,         color: 'amber' },
        { label: 'St number',     value: '~0.20',              color: 'cyan'  },
        { label: 'Max vortices',  value: '80',                 color: 'dim'   },
      ]
    case 'sph':
      return [
        { label: 'Particles N',   value: '216 (3D)',           color: 'cyan'  },
        { label: 'Gravity g',     value: `${(7+reynolds*2.5).toFixed(1)} m/s²`, color: 'amber' },
        { label: 'Kernel h',      value: '0.90',               color: 'cyan'  },
        { label: 'Scenario',      value: '3D dam break',       color: 'dim'   },
      ]
    default:
      return []
  }
}

function Slider({ label, value, min, max, step, decimals, onChange, accentHex }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-wider uppercase text-text-dim">{label}</span>
        <span className="font-mono-data text-[11px] tabular-nums" style={{ color: accentHex }}>{value.toFixed(decimals)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-0.5 cursor-pointer" style={{ accentColor: accentHex }} />
    </div>
  )
}

const ACCENT = '#2dd4bf'

export default function FluidModule() {
  const setActiveModule   = useModuleStore((s) => s.setActiveModule)
  const fluidView         = useModuleStore((s) => s.fluid.viewType)
  const reynolds          = useModuleStore((s) => s.fluid.reynolds)
  const setFluidView      = useModuleStore((s) => s.setFluidView)
  const setFluidReynolds  = useModuleStore((s) => s.setFluidReynolds)
  const resetFluid        = useModuleStore((s) => s.resetFluid)

  const { domain, primaryEq, derivedEqs } = buildEquations(fluidView)
  const explanation = buildExplanation(fluidView)
  const metrics     = buildMetrics(fluidView, reynolds)

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      <style>{`@keyframes umbra-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-teal-glow transition-colors duration-200 uppercase flex items-center gap-1.5">
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">Fluid Dynamics</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border shrink-0"
            style={{ borderColor: 'rgba(45,212,191,0.25)', background: 'rgba(45,212,191,0.05)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`, animation: 'umbra-pulse 1.8s ease-in-out infinite' }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(45,212,191,0.7)' }}>LIVE</span>
          </div>
        </div>

        <nav className="flex gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setFluidView(v.id)}
              className={[
                'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                fluidView === v.id
                  ? 'border-teal-glow text-teal-glow bg-teal-glow/5 shadow-glow-teal'
                  : 'border-border-subtle text-text-dim hover:border-teal-glow/50 hover:text-text-primary',
              ].join(' ')}>
              {v.label}
            </button>
          ))}
        </nav>

        <div className="font-mono-data text-sm tabular-nums" style={{ color: ACCENT, textShadow: '0 0 8px rgba(45,212,191,0.5)' }}>
          ∇²φ = 0 · Re = {reynolds.toFixed(1)}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel title="Fluid Dynamics" domain={domain} primaryEq={primaryEq}
            derivedEqs={derivedEqs} explanation={explanation} metrics={metrics}
            footer="FLUID DYNAMICS · INCOMPRESSIBLE" accentColor="cyan" />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={CAMERA[fluidView]} showGrid={false} minDist={3} maxDist={35}>
            {fluidView === 'streamlines' && <StreamLines   key="sl"  reynolds={reynolds} />}
            {fluidView === 'vortex'      && <VortexShedding key="vs"  reynolds={reynolds} />}
            {fluidView === 'sph'         && <SPH            key="sph" reynolds={reynolds} />}
          </SceneWrapper>
          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {fluidView === 'streamlines' ? 'Potential Flow · Irrotational · Incompressible'
               : fluidView === 'vortex'    ? 'Kármán Vortex Street · Discrete Vortex Method'
               : 'SPH Dam Break 3D · Navier-Stokes · 216 Particles'}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded border pointer-events-none"
            style={{ borderColor: 'rgba(45,212,191,0.18)', background: 'rgba(8,9,10,0.85)' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 4px ${ACCENT}` }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(45,212,191,0.5)' }}>SIM ACTIVE</span>
          </div>
          <div className="absolute bottom-4 right-4 font-mono-data text-[8px] tracking-[0.12em] pointer-events-none"
            style={{ color: 'rgba(45,212,191,0.28)' }}>
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </main>

        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ backgroundColor: ACCENT, boxShadow: `0 0 4px 1px rgba(45,212,191,0.6)` }} />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">Parameters</span>
            </div>
            <button onClick={resetFluid}
              className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-teal-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-teal-glow/40 rounded">
              RST
            </button>
          </div>

          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto thin-scroll">
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">View</p>
              <div className="flex flex-col gap-1.5">
                {VIEWS.map((v) => (
                  <button key={v.id} onClick={() => setFluidView(v.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded border font-mono-data text-[11px] tracking-wide transition-all duration-150',
                      fluidView === v.id
                        ? 'border-teal-glow/60 bg-teal-glow/5 text-text-primary'
                        : 'border-border-subtle text-text-dim hover:border-teal-glow/30',
                    ].join(' ')}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-3">Flow</p>
              <Slider label={fluidView === 'sph' ? 'G  gravity' : 'Re  speed'}
                value={reynolds} min={0.3} max={2.5} step={0.05} decimals={2}
                onChange={setFluidReynolds} accentHex={ACCENT} />
            </div>

            <div className="h-px bg-border-subtle" />

            <div className="font-mono-data text-[9px] text-text-dim space-y-1.5">
              {fluidView === 'streamlines' && (
                <>
                  <p style={{ color: '#fb923c' }}>● stagnation pts</p>
                  <p style={{ color: ACCENT }}>─ streamlines</p>
                  <p style={{ color: '#2dd4bf', opacity: 0.6 }}>· · tracers (speed)</p>
                </>
              )}
              {fluidView === 'vortex' && (
                <>
                  <p style={{ color: '#fb923c' }}>● positive Γ (CCW)</p>
                  <p style={{ color: '#38bdf8' }}>● negative Γ (CW)</p>
                  <p style={{ color: ACCENT, opacity: 0.6 }}>· · vorticity field</p>
                </>
              )}
              {fluidView === 'sph' && (
                <>
                  <p style={{ color: '#38bdf8' }}>■ slow (settled)</p>
                  <p style={{ color: ACCENT }}>■ accelerating</p>
                  <p style={{ color: '#fff', opacity: 0.8 }}>■ peak impact</p>
                </>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[9px] text-text-dim tracking-wider">
              FLUID DYNAMICS · 3D SPH · NAVIER-STOKES
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
