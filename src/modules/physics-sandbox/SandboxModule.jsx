import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useModuleStore from '../../store/useModuleStore'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption, Legend } from '../../components/ModuleShell'
import ControlPanel, { ControlGroup } from '../../components/ControlPanel'
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
  syllabus: 'A-level fields · inverse-square superposition',
  primaryEq: `\\mathbf{F}_i = \\sum_k \\frac{G_k\\,\\hat{r}_{ik} + \\Gamma_k\\,\\hat{r}_{ik}^\\perp}{|r_{ik}|^2 + \\varepsilon^2}`,
  derivedEqs: [
    { label: 'Attractor',  eq: `G > 0:\\; \\mathbf{a} = G\\,\\mathbf{r}/r^3` },
    { label: 'Vortex',     eq: `\\mathbf{a} = \\Gamma\\,\\mathbf{r}^\\perp/r^2` },
  ],
  tryThis: [
    'Drop one attractor, then add a vortex beside it — the particles wind up into a spiral galaxy.',
    'Place two attractors and watch particles thread orbits between them, like a two-body field.',
  ],
  checkpoint: {
    q: 'Each attractor pulls with an inverse-square force. Move a particle twice as far away — what happens to the pull?',
    a: 'It drops to a quarter. F ∝ 1/r², so doubling r divides the force by 2² = 4. The same law governs both gravity and electrostatics.',
  },
}

const EXPLANATION =
  `Place sources anywhere on the field and watch 5,000 tracer particles respond. ` +
  `Each attractor pulls particles inward with inverse-square gravity. ` +
  `Repulsors push them out. Vortices apply a tangential Biot-Savart force, spinning particles ` +
  `around the source without attracting them. ` +
  `All forces superpose — mix an attractor with a vortex to create a spiral galaxy, ` +
  `pair two vortices to watch them co-rotate, or trap particles between a repulsor and two attractors. ` +
  `Particle color encodes speed: deep blue = slow, cyan = medium, orange = fast, white = maximum.`


function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`
}


export default function SandboxModule() {
  const [sources,  setSources]  = useState([])
  const mode        = useModuleStore((s) => s.sandbox.mode)
  const strength    = useModuleStore((s) => s.sandbox.strength)
  const setMode     = useModuleStore((s) => s.setSandboxMode)
  const setStrength = useModuleStore((s) => s.setSandboxStrength)

  const addSource    = useCallback((src) => setSources((s) => [...s, src]), [])
  const removeSource = useCallback((id)  => setSources((s) => s.filter((x) => x.id !== id)), [])
  const clearAll     = useCallback(() => setSources([]), [])
  const loadPreset   = useCallback((preset) => {
    setSources(preset.sources.map((s) => ({ ...s, id: _pid++ })))
  }, [])

  const metrics = [
    { label: 'Particles',  value: '5,000',            color: 'cyan'  },
    { label: 'Sources',    value: `${sources.length}`, color: 'amber' },
    { label: 'Softening ε', value: '0.55',            color: 'cyan'  },
    { label: 'Mode',       value: MODES.find(m => m.id === mode)?.label ?? mode, color: 'dim' },
  ]

  return (
    <ModuleShell
      title="Physics Sandbox"
      accent={ACCENT}
      readout={<>{sources.length} source{sources.length === 1 ? '' : 's'} · 5,000 particles</>}
      lesson={
        <InfoPanel
          domain={EQUATIONS.domain}
          syllabus={EQUATIONS.syllabus}
          primaryEq={EQUATIONS.primaryEq}
          derivedEqs={EQUATIONS.derivedEqs}
          explanation={EXPLANATION}
          tryThis={EQUATIONS.tryThis}
          checkpoint={EQUATIONS.checkpoint}
          metrics={metrics}
        />
      }
      controls={
        <ControlPanel
          title="Build a field"
          footer="Superposition · 2D field · 5,000 tracers"
          controls={[{ label: 'Source strength', min: 0.2, max: 3.0, step: 0.05, value: strength, onChange: setStrength }]}
        >
          <ControlGroup label="Place">
            <div role="radiogroup" aria-label="Source type" className="grid grid-cols-2 gap-1.5">
              {MODES.map((m) => {
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(m.id)}
                    className={`flex items-center gap-2 h-10 px-2.5 rounded-md border text-[13px] font-medium transition-colors duration-150 ${
                      active ? 'border-cyan-glow/60 bg-cyan-glow/10 text-text-primary' : 'border-border-subtle bg-ground/40 text-text-dim hover:text-text-primary hover:bg-panel-hover'
                    }`}
                  >
                    <span style={{ color: m.color }} aria-hidden="true">{m.symbol}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </ControlGroup>

          <ControlGroup label="Presets">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => loadPreset(p)} title={p.desc} className="ui-btn justify-start h-9 px-2.5 text-[13px]">
                  <span className="text-text-dim" aria-hidden="true">{p.icon}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup label="Particle speed">
            <Legend items={[
              { color: '#3b4a9a', label: 'Slow' },
              { color: '#7c8cff', label: 'Medium' },
              { color: '#fb923c', label: 'Fast' },
              { color: '#ffffff', label: 'Maximum' },
            ]} />
          </ControlGroup>

          {sources.length > 0 && (
            <ControlGroup label={`Placed sources (${sources.length})`}>
              <ul className="flex flex-col gap-1">
                {sources.map((src) => {
                  const def = SOURCE_DEFS[src.type]
                  return (
                    <li key={src.id} className="flex items-center justify-between h-8 px-2 rounded-md bg-ground/40 border border-border-subtle">
                      <span className="flex items-center gap-2 text-[13px] text-text-primary">
                        <span style={{ color: def.color }} aria-hidden="true">{def.symbol}</span>
                        {def.label}
                      </span>
                      <button type="button" onClick={() => removeSource(src.id)} aria-label={`Remove ${def.label}`}
                        className="w-7 h-7 rounded text-text-dim hover:text-red-400 hover:bg-panel-hover">✕</button>
                    </li>
                  )
                })}
              </ul>
              <button type="button" onClick={clearAll} className="ui-btn w-full hover:text-red-300">Clear all</button>
            </ControlGroup>
          )}
        </ControlPanel>
      }
    >
      <Canvas className="sim-dark"
        camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 100 }}
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#0b0d12' }}
      >
        <color attach="background" args={['#0b0d12']} />
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

      <SceneCaption>
        {mode === 'erase'
          ? 'Erase mode · click a source to remove it'
          : `Placing ${MODES.find((m) => m.id === mode)?.label?.toLowerCase()} · click anywhere`}
      </SceneCaption>

      {sources.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-5 py-4 rounded-lg bg-ground/60 border border-border-subtle backdrop-blur-sm">
            <p className="text-[15px] font-medium text-text-primary">Click anywhere to place a source</p>
            <p className="text-[13px] text-text-dim mt-1">or load a preset from Controls</p>
          </div>
        </div>
      )}
    </ModuleShell>
  )
}
