import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import LightCone from './LightCone'
import TimeDilation from './TimeDilation'
import LengthContraction from './LengthContraction'
import useModuleStore from '../../store/useModuleStore'
import { lorentzFactor, contractedLength, coneRegion } from './srMath'

const VIEWS = [
  { id: 'lightcone', label: 'Light Cone' },
  { id: 'timedilation', label: 'Time Dilation' },
  { id: 'lengthcontraction', label: 'Length Contraction' },
]

const CAMERA_POSITIONS = {
  lightcone: [0, 2, 9],
  timedilation: [0, 1, 8],
  lengthcontraction: [0, 1.5, 8],
}

function buildExplanation(view, velocity, gamma, eventX, eventT) {
  const region = coneRegion(eventX, eventT)
  const Lc = contractedLength(3, velocity)
  const pct = ((1 - 1 / gamma) * 100).toFixed(1)
  const contractionPct = ((1 - Lc / 3) * 100).toFixed(1)

  switch (view) {
    case 'lightcone':
      return `The light cone divides spacetime into three regions. Your event (the glowing octahedron) is currently ${
        region === 'timelike'
          ? 'inside the cone — a timelike interval. A signal slower than light could connect these events, so causality is preserved.'
          : region === 'spacelike'
          ? 'outside the cone — a spacelike interval. No signal can travel fast enough to connect these events; they cannot be causally related.'
          : 'exactly on the cone surface — a lightlike interval. Only a photon could connect these events.'
      } Drag the event to explore the three regions.`

    case 'timedilation':
      return `At β = ${velocity.toFixed(3)} (${(velocity * 100).toFixed(1)}% of c), the Lorentz factor γ = ${gamma.toFixed(4)}. The moving clock runs ${pct}% slower than the stationary lab clock. After ${gamma.toFixed(2)} seconds in the lab frame, the moving clock has ticked only 1 second. This is not a trick of signal travel time — the moving clock genuinely measures less elapsed time.`

    case 'lengthcontraction':
      return `The rod at rest has proper length L₀ = 3.0 units. Moving at β = ${velocity.toFixed(3)}, it contracts to L′ = ${Lc.toFixed(3)} units — a ${contractionPct}% compression along the axis of motion. The rod itself is physically shorter in the lab frame; this is not a perspective effect. Perpendicular dimensions are unchanged.`

    default:
      return ''
  }
}

export default function SRModule() {
  const [activeView, setActiveView] = useState('lightcone')

  const velocity = useModuleStore((s) => s.sr.velocity)
  const eventX = useModuleStore((s) => s.sr.eventX)
  const eventT = useModuleStore((s) => s.sr.eventT)
  const setSrVelocity = useModuleStore((s) => s.setSrVelocity)
  const resetSr = useModuleStore((s) => s.resetSr)
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  const gamma = lorentzFactor(velocity)
  const Lc = contractedLength(3.0, velocity)
  const region = coneRegion(eventX, eventT)

  const metrics = [
    { label: 'β  (v/c)', value: velocity.toFixed(4), color: 'cyan' },
    { label: 'γ  (Lorentz)', value: gamma.toFixed(4), color: 'amber' },
    { label: "t′ / t₀", value: gamma.toFixed(4), unit: '×', color: 'cyan' },
    { label: "L′  contracted", value: Lc.toFixed(3), unit: ' u', color: 'rose' },
    {
      label: 'Event region',
      value: region.toUpperCase(),
      color: region === 'timelike' ? 'cyan' : region === 'spacelike' ? 'rose' : 'amber',
    },
  ]

  const controls = [
    {
      label: 'Velocity β',
      min: 0,
      max: 0.99,
      step: 0.001,
      value: velocity,
      onChange: setSrVelocity,
      unit: 'c',
    },
  ]

  const explanation = buildExplanation(activeView, velocity, gamma, eventX, eventT)
  const camPos = CAMERA_POSITIONS[activeView]

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
            Special Relativity
          </h1>
        </div>

        {/* View selector tabs */}
        <nav className="flex gap-1" role="tablist" aria-label="Scene views">
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
                    ? 'border-cyan-glow text-cyan-glow shadow-glow-cyan bg-cyan-glow/5'
                    : 'border-border-subtle text-text-dim hover:border-cyan-dim hover:text-text-primary',
                ].join(' ')}
              >
                {v.label}
              </button>
            )
          })}
        </nav>

        <div className="font-mono-data text-sm text-amber-glow glow-amber tabular-nums">
          γ = {gamma.toFixed(4)}
        </div>
      </header>

      {/* ── Main layout: Info | Scene | Controls ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-56 shrink-0 flex flex-col overflow-hidden">
          <InfoPanel
            title="Analysis"
            explanation={explanation}
            metrics={metrics}
          />
        </div>

        {/* Single persistent Canvas — swap content, never remount */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <SceneWrapper cameraPosition={camPos}>
            {activeView === 'lightcone' && <LightCone />}
            {activeView === 'timedilation' && <TimeDilation />}
            {activeView === 'lengthcontraction' && <LengthContraction />}
          </SceneWrapper>

          {/* Scene label */}
          <div className="absolute top-3 left-4 pointer-events-none">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-text-dim">
              {VIEWS.find((v) => v.id === activeView)?.label}
            </span>
          </div>
        </main>

        <div className="w-52 shrink-0 flex flex-col overflow-hidden">
          <ControlPanel title="Parameters" controls={controls} onReset={resetSr} />
        </div>
      </div>
    </div>
  )
}
