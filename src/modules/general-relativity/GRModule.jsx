import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import SpacetimeCurvature from './SpacetimeCurvature'
import Geodesics from './Geodesics'
import GravitationalWaves from './GravitationalWaves'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'curvature', label: 'Curvature' },
  { id: 'geodesics', label: 'Geodesics' },
  { id: 'waves',     label: 'Grav. Waves' },
]

const CAMERA = {
  curvature: [0, 7, 10],
  geodesics:  [0, 12, 2],
  waves:      [0, 8, 10],
}

function buildEquations(view) {
  switch (view) {
    case 'curvature':
      return {
        domain: 'GENERAL RELATIVITY · EINSTEIN FIELD EQUATIONS',
        primaryEq: `G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\dfrac{8\\pi G}{c^4}\\,T_{\\mu\\nu}`,
        derivedEqs: [
          { label: 'Schwarzschild metric', eq: `ds^2 = -\\!\\left(1-\\tfrac{r_s}{r}\\right)c^2 dt^2 + \\dfrac{dr^2}{1-r_s/r}` },
          { label: 'Curvature depth', eq: `y \\propto -\\dfrac{GM}{r}` },
        ],
      }
    case 'geodesics':
      return {
        domain: 'GR · GEODESIC EQUATION',
        primaryEq: `\\frac{d^2u}{d\\phi^2} = -u + 3Mu^2`,
        derivedEqs: [
          { label: 'u = 1/r, Newtonian', eq: `\\frac{d^2u}{d\\phi^2} = -u` },
          { label: 'Orbital precession', eq: `\\Delta\\phi = \\frac{6\\pi GM}{c^2 a(1-e^2)}` },
        ],
      }
    case 'waves':
      return {
        domain: 'GR · GRAVITATIONAL WAVES',
        primaryEq: `\\square\\,\\bar{h}_{\\mu\\nu} = -\\frac{16\\pi G}{c^4}\\,T_{\\mu\\nu}`,
        derivedEqs: [
          { label: 'h₊ strain', eq: `h_+ = \\frac{2G}{c^4 r}\\ddot{Q}_{xx}` },
          { label: 'Power radiated', eq: `P = \\frac{32G^4}{5c^5}\\frac{m_1^2 m_2^2(m_1+m_2)}{r^5}` },
        ],
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'curvature':
      return `Einstein replaced Newton's gravitational force with geometry. Mass curves the 4D spacetime manifold; objects then follow the straightest possible paths through that curved space. The well here shows the Schwarzschild solution — the exact spacetime geometry around a non-rotating mass. Curvature is steepest at small r and falls off as 1/r. The orange ring marks the photon sphere: the radius where light can orbit in an unstable circular path.`
    case 'geodesics':
      return `A geodesic is the GR equivalent of a straight line — the path a free-falling object traces through curved spacetime. In Newtonian gravity, orbits close perfectly. In GR they precess: Mercury's orbit shifts 43 arcsec/century, confirmed in 1859. The white lines show light rays bent by the mass. GR predicts bending twice as large as Newton. Eddington confirmed this in 1919, making Einstein famous overnight.`
    case 'waves':
      return `When two massive objects orbit each other, they radiate energy as ripples in spacetime — gravitational waves. The grid shows the h₊ polarization: spacetime alternately stretches and compresses perpendicular to the wave direction. LIGO detected the first signal in 2015 (GW150914), a binary black hole merger 1.3 billion light-years away. The strain was 10⁻²¹ — a thousand times smaller than a proton over 4 km.`
    default:
      return ''
  }
}

function buildMetrics(view, mass) {
  const rs = (mass * 0.15 * 1.5).toFixed(2)
  switch (view) {
    case 'curvature':
      return [
        { label: 'Mass M',             value: mass.toFixed(1),       color: 'amber' },
        { label: 'Schwarzschild r_s',  value: `${rs} units`,         color: 'cyan'  },
        { label: 'Curvature ∝',        value: 'GM / r',              color: 'dim'   },
        { label: 'Photon sphere',       value: `r = 1.5 r_s`,        color: 'amber' },
      ]
    case 'geodesics':
      return [
        { label: 'Mass M',         value: mass.toFixed(1),    color: 'amber' },
        { label: 'r_s',            value: `${rs} units`,      color: 'cyan'  },
        { label: 'Orbit type',     value: 'Precessing ellipse', color: 'dim' },
        { label: 'Light bending',  value: '4GM / bc²',        color: 'amber' },
      ]
    case 'waves':
      return [
        { label: 'Mass M',       value: mass.toFixed(1),       color: 'amber' },
        { label: 'Orbital freq', value: `${(1.2+mass*0.3).toFixed(2)} rad/s`, color: 'cyan'  },
        { label: 'Polarization', value: 'h₊',                  color: 'dim'   },
        { label: 'Propagation',  value: 'c',                   color: 'amber' },
      ]
    default:
      return []
  }
}

function Slider({ label, value, min, max, step, decimals, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-wider uppercase text-text-dim">{label}</span>
        <span className="font-mono-data text-[11px] tabular-nums" style={{ color: '#fb923c' }}>{value.toFixed(decimals)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-0.5 cursor-pointer" style={{ accentColor: '#fb923c' }} />
    </div>
  )
}

export default function GRModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const grMass          = useModuleStore((s) => s.gr.mass)
  const grView          = useModuleStore((s) => s.gr.viewType)
  const setGrMass       = useModuleStore((s) => s.setGrMass)
  const setGrView       = useModuleStore((s) => s.setGrView)
  const resetGr         = useModuleStore((s) => s.resetGr)

  const { domain, primaryEq, derivedEqs } = buildEquations(grView)
  const explanation = buildExplanation(grView)
  const metrics     = buildMetrics(grView, grMass)

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      <style>{`@keyframes umbra-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim hover:text-orange-glow transition-colors duration-200 uppercase flex items-center gap-1.5">
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">General Relativity</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border shrink-0"
            style={{ borderColor: 'rgba(251,146,60,0.25)', background: 'rgba(251,146,60,0.05)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fb923c', boxShadow: '0 0 6px #fb923c', animation: 'umbra-pulse 1.8s ease-in-out infinite' }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(251,146,60,0.7)' }}>LIVE</span>
          </div>
        </div>

        <nav className="flex gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setGrView(v.id)}
              className={[
                'font-mono-data text-[11px] tracking-wider uppercase px-3 py-1 rounded border transition-all duration-200',
                grView === v.id
                  ? 'border-orange-glow text-orange-glow bg-orange-glow/5 shadow-glow-orange'
                  : 'border-border-subtle text-text-dim hover:border-orange-glow/50 hover:text-text-primary',
              ].join(' ')}>
              {v.label}
            </button>
          ))}
        </nav>

        <div className="font-mono-data text-sm tabular-nums" style={{ color: '#fb923c', textShadow: '0 0 8px rgba(251,146,60,0.5)' }}>
          G_μν = 8πT_μν · M = {grMass.toFixed(1)}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel title="Spacetime" domain={domain} primaryEq={primaryEq}
            derivedEqs={derivedEqs} explanation={explanation} metrics={metrics}
            footer="GENERAL RELATIVITY · c = G = 1" accentColor="cyan" />
        </div>

        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={CAMERA[grView]} showGrid={false} minDist={2} maxDist={30}>
            {grView === 'curvature' && <SpacetimeCurvature key="curv" mass={grMass} />}
            {grView === 'geodesics'  && <Geodesics           key="geo"  mass={grMass} />}
            {grView === 'waves'      && <GravitationalWaves  key="wav"  mass={grMass} />}
          </SceneWrapper>
          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {grView === 'curvature' ? 'Schwarzschild Geometry · Exact Solution'
               : grView === 'geodesics' ? 'Geodesic Equation · GR vs Newtonian'
               : 'Gravitational Wave Emission · h₊ Polarization'}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded border pointer-events-none"
            style={{ borderColor: 'rgba(251,146,60,0.18)', background: 'rgba(4,9,12,0.85)' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fb923c', boxShadow: '0 0 4px #fb923c' }} />
            <span className="font-mono-data text-[8px] tracking-[0.2em]" style={{ color: 'rgba(251,146,60,0.5)' }}>SIM ACTIVE</span>
          </div>
          <div className="absolute bottom-4 right-4 font-mono-data text-[8px] tracking-[0.12em] pointer-events-none"
            style={{ color: 'rgba(251,146,60,0.28)' }}>
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </main>

        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ backgroundColor: '#fb923c', boxShadow: '0 0 4px 1px rgba(251,146,60,0.6)' }} />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">Parameters</span>
            </div>
            <button onClick={resetGr}
              className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-orange-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-orange-glow/40 rounded">
              RST
            </button>
          </div>

          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto thin-scroll">
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">View</p>
              <div className="flex flex-col gap-1.5">
                {VIEWS.map((v) => (
                  <button key={v.id} onClick={() => setGrView(v.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded border font-mono-data text-[11px] tracking-wide transition-all duration-150',
                      grView === v.id
                        ? 'border-orange-glow/60 bg-orange-glow/5 text-text-primary'
                        : 'border-border-subtle text-text-dim hover:border-orange-glow/30',
                    ].join(' ')}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-3">Mass</p>
              <Slider label="M  mass" value={grMass} min={0.5} max={5} step={0.1} decimals={1} onChange={setGrMass} />
            </div>
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[9px] text-text-dim tracking-wider">
              GR · GEOMETRIC UNITS · G = c = 1
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
