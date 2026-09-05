import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useModuleStore from '../../store/useModuleStore'
import InfoPanel from '../../components/InfoPanel'
import SandboxScene, { SOURCE_DEFS } from './SandboxScene'
import CinematicEffects from '../../components/CinematicEffects'

const ACCENT = '#84cc16'

const MODES = [
  { id: 'attractor',  ...SOURCE_DEFS.attractor  },
  { id: 'repulsor',   ...SOURCE_DEFS.repulsor    },
  { id: 'vortex_ccw', ...SOURCE_DEFS.vortex_ccw },
  { id: 'vortex_cw',  ...SOURCE_DEFS.vortex_cw  },
  { id: 'erase',      color: '#ef4444', label: 'Erase', symbol: '✕' },
]

let _pid = 100

const PRESETS = [
  {
    name: 'Galaxy',
    icon: '↺',
    desc: 'Attractor + vortex — spiraling infall',
    sources: [
      { type: 'attractor',  x:  0,    y:  0   },
      { type: 'vortex_ccw', x:  0,    y:  0   },
    ],
  },
  {
    name: 'Binary Star',
    icon: '⊙⊙',
    desc: 'Two attractors — orbiting figure-eight',
    sources: [
      { type: 'attractor', x: -2.2, y:  0 },
      { type: 'attractor', x:  2.2, y:  0 },
    ],
  },
  {
    name: 'Dipole',
    icon: '◉⊘',
    desc: 'Attractor + repulsor — field lines visible',
    sources: [
      { type: 'attractor', x: -2.5, y:  0 },
      { type: 'repulsor',  x:  2.5, y:  0 },
    ],
  },
  {
    name: 'Vortex Ring',
    icon: '↺↻',
    desc: 'Alternating vortices — co-rotating pattern',
    sources: [
      { type: 'vortex_ccw', x: -3.2, y:  0   },
      { type: 'vortex_cw',  x:  3.2, y:  0   },
      { type: 'vortex_ccw', x:  0,   y:  2.8 },
      { type: 'vortex_cw',  x:  0,   y: -2.8 },
    ],
  },
  {
    name: 'Chaos',
    icon: '⊘⊘⊙',
    desc: 'Three repulsors trap particles between attractors',
    sources: [
      { type: 'repulsor',  x: -4,  y: -2.5 },
      { type: 'repulsor',  x:  4,  y: -2.5 },
      { type: 'repulsor',  x:  0,  y:  3.5 },
      { type: 'attractor', x: -1.5, y:  0  },
      { type: 'attractor', x:  1.5, y:  0  },
    ],
  },
  {
    name: 'Spiral Arms',
    icon: '↺↺',
    desc: 'Two offset galaxy cores — tidal streams',
    sources: [
      { type: 'attractor',  x: -2, y:  1 },
      { type: 'vortex_ccw', x: -2, y:  1 },
      { type: 'attractor',  x:  2, y: -1 },
      { type: 'vortex_ccw', x:  2, y: -1 },
    ],
  },
]

const EQUATIONS = {
  domain: 'PHYSICS SANDBOX · INTERACTIVE FIELD',
  primaryEq: `\\mathbf{F}_i = \\sum_k \\frac{G_k\\,\\hat{r}_{ik} + \\Gamma_k\\,\\hat{r}_{ik}^\\perp}{|r_{ik}|^2 + \\varepsilon^2}`,
  derivedEqs: [
    { label: 'Attractor',  eq: `G > 0:\\; \\mathbf{a} = G\\,\\mathbf{r}/r^3` },
    { label: 'Vortex',     eq: `\\mathbf{a} = \\Gamma\\,\\mathbf{r}^\\perp/r^2` },
  ],
}

const EXPLANATION =
  `Place sources anywhere on the field and watch 900 tracer particles respond. ` +
  `Each attractor pulls particles inward with inverse-square gravity. ` +
  `Repulsors push them out. Vortices apply a tangential Biot-Savart force, spinning particles ` +
  `around the source without attracting them. ` +
  `All forces superpose — mix an attractor with a vortex to create a spiral galaxy, ` +
  `pair two vortices to watch them co-rotate, or trap particles between a repulsor and two attractors. ` +
  `Particle color encodes speed: deep blue = slow, cyan = medium, orange = fast, white = maximum.`

function ModeButton({ m, active, onClick }) {
  return (
    <button
      onClick={() => onClick(m.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 4,
        border: `1px solid ${active ? m.color : 'rgba(255,255,255,0.07)'}`,
        background: active ? `rgba(${hexToRgb(m.color)},0.10)` : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{
        fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
        color: m.color, textShadow: active ? `0 0 8px ${m.color}` : 'none',
        width: 20, textAlign: 'center',
      }}>
        {m.symbol}
      </span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: active ? m.color : 'rgba(255,255,255,0.35)',
      }}>
        {m.label}
      </span>
    </button>
  )
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`
}

function Slider({ label, value, min, max, step, decimals, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: ACCENT }}>{value.toFixed(decimals)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 2, cursor: 'pointer', accentColor: ACCENT }} />
    </div>
  )
}

export default function SandboxModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const [sources,  setSources]  = useState([])
  const [mode,     setMode]     = useState('attractor')
  const [strength, setStrength] = useState(1.0)

  const addSource    = useCallback((src) => setSources((s) => [...s, src]), [])
  const removeSource = useCallback((id)  => setSources((s) => s.filter((x) => x.id !== id)), [])
  const clearAll     = useCallback(() => setSources([]), [])
  const loadPreset   = useCallback((preset) => {
    setSources(preset.sources.map((s) => ({ ...s, id: _pid++ })))
  }, [])

  const metrics = [
    { label: 'Particles',  value: '900',              color: 'cyan'  },
    { label: 'Sources',    value: `${sources.length}`, color: 'amber' },
    { label: 'Softening ε', value: '0.55',            color: 'cyan'  },
    { label: 'Mode',       value: MODES.find(m => m.id === mode)?.label ?? mode, color: 'dim' },
  ]

  return (
    <div className="flex flex-col w-full h-full bg-ground">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-5 py-2 bg-panel border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveModule(null)}
            className="font-mono-data text-[11px] tracking-widest text-text-dim uppercase flex items-center gap-1.5"
            style={{ color: 'rgba(132,204,22,0.6)' }}
          >
            ← MODULES
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <h1 className="font-display text-base font-semibold text-text-primary tracking-wide">Physics Sandbox</h1>
          <span className="font-mono-data text-[9px] tracking-wider uppercase px-2 py-0.5 border rounded"
            style={{ borderColor: 'rgba(132,204,22,0.3)', color: 'rgba(132,204,22,0.6)', background: 'rgba(132,204,22,0.05)' }}>
            Click to place · Emergent fields
          </span>
        </div>
        <div className="font-mono-data text-sm tabular-nums" style={{ color: ACCENT }}>
          {sources.length} sources · 900 particles
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* ── Left: Info panel ── */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Physics Sandbox"
            domain={EQUATIONS.domain}
            primaryEq={EQUATIONS.primaryEq}
            derivedEqs={EQUATIONS.derivedEqs}
            explanation={EXPLANATION}
            metrics={metrics}
            footer="SANDBOX · INTERACTIVE · 900 PARTICLES"
            accentColor="cyan"
          />
        </div>

        {/* ── Center: Canvas ── */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <Canvas className="sim-dark"
            camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 100 }}
            gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
            style={{ width: '100%', height: '100%', display: 'block', background: '#08090a' }}
          >
            <color attach="background" args={['#08090a']} />
            <SandboxScene
              sources={sources}
              mode={mode}
              strength={strength}
              onAdd={addSource}
              onRemove={removeSource}
            />
            <OrbitControls
              enableRotate={false}
              enablePan
              enableZoom
              panSpeed={0.8}
              zoomSpeed={0.8}
              minDistance={4}
              maxDistance={28}
            />
            <CinematicEffects dof={false} bloomIntensity={1.0} />
          </Canvas>

          {/* Mode overlay */}
          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {mode === 'erase'
                ? 'ERASE MODE · Click a source to remove it'
                : `PLACING: ${MODES.find(m => m.id === mode)?.label} · Click anywhere`}
            </span>
          </div>

          {/* Empty state hint */}
          {sources.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.12)',
                textAlign: 'center',
                lineHeight: 2,
              }}>
                <div style={{ fontSize: 28, marginBottom: 8, color: ACCENT, opacity: 0.4 }}>◎</div>
                Click to place a source
              </div>
            </div>
          )}
        </main>

        {/* ── Right: Controls ── */}
        <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-panel osc-grid border-l border-border-subtle">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 4px 1px rgba(132,204,22,0.6)` }} />
              <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">Source Type</span>
            </div>
            <button
              onClick={clearAll}
              className="font-mono-data text-[10px] tracking-wider text-text-dim uppercase px-2 py-1 border border-border-subtle rounded"
              style={{ '--hover-color': '#ef4444' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = '' }}
            >
              CLR
            </button>
          </div>

          <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto thin-scroll">
            {/* Mode selector */}
            <div className="flex flex-col gap-1.5">
              {MODES.map((m) => (
                <ModeButton key={m.id} m={m} active={mode === m.id} onClick={setMode} />
              ))}
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Strength slider */}
            <Slider
              label="Strength"
              value={strength} min={0.2} max={3.0} step={0.05} decimals={2}
              onChange={setStrength}
            />

            <div className="h-px bg-border-subtle" />

            {/* Presets */}
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">Presets</p>
              <div className="flex flex-col gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(p)}
                    title={p.desc}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '5px 8px',
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `rgba(132,204,22,0.35)`
                      e.currentTarget.style.background = `rgba(132,204,22,0.06)`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: ACCENT, width: 22, textAlign: 'center', flexShrink: 0 }}>
                      {p.icon}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Color legend */}
            <div>
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">Speed</p>
              <div className="flex flex-col gap-1">
                {[
                  { color: '#0b1247', label: 'Slow' },
                  { color: '#5e6ad2', label: 'Medium' },
                  { color: '#fb923c', label: 'Fast' },
                  { color: '#ffffff', label: 'Maximum' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    <span className="font-mono-data text-[9px] text-text-dim">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Placed sources list */}
            {sources.length > 0 && (
              <div>
                <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase text-text-dim mb-2">
                  Active ({sources.length})
                </p>
                <div className="flex flex-col gap-1">
                  {sources.map((src) => {
                    const def = SOURCE_DEFS[src.type]
                    return (
                      <div key={src.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: def.color, fontSize: 11 }}>{def.symbol}</span>
                          <span className="font-mono-data text-[9px] text-text-dim">{def.label}</span>
                        </div>
                        <button
                          onClick={() => removeSource(src.id)}
                          className="font-mono-data text-[9px] text-text-dim"
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-border-subtle">
            <p className="font-mono-data text-[9px] text-text-dim tracking-wider">
              SANDBOX · SUPERPOSITION · 2D
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
