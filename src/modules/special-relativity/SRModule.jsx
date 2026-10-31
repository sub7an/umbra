import { useState, useEffect, useRef } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import ControlPanel from '../../components/ControlPanel'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell from '../../components/ModuleShell'
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
      return `The light cone divides spacetime into three regions. Your event is currently ${
        region === 'timelike'
          ? 'inside the cone (timelike interval) — a signal slower than light can connect these events; causality holds.'
          : region === 'spacelike'
          ? 'outside the cone (spacelike interval) — no signal can connect them; they share no causal link.'
          : 'on the cone surface (lightlike interval) — only a photon traveling at c can connect them.'
      } The magenta dashed axes are the boosted frame (ct′, x′) of an observer moving at β = ${velocity.toFixed(2)}c. Use the velocity slider to see simultaneity lines tilt: events that are simultaneous in the lab (horizontal line) are not simultaneous in the moving frame (tilted). Drag the octahedron to explore all three causal regions.`

    case 'timedilation':
      return `At β = ${velocity.toFixed(3)}, the moving clock runs ${pct}% slower than the lab clock. After ${gamma.toFixed(2)} lab seconds, the moving clock has ticked just 1 second. This is a real physical effect, not a signaling delay. If you brought both clocks together afterward, the moving one would show less elapsed time.`

    case 'lengthcontraction':
      return `The rest-frame rod is L₀ = 3.0 units long. At β = ${velocity.toFixed(3)}, it shrinks to L′ = ${Lc.toFixed(3)} units: ${contractionPct}% shorter along the direction of motion. This is a genuine physical contraction, not an optical effect. Only the travel axis is affected; width and height stay the same.`

    default:
      return ''
  }
}

function buildEquations(view, velocity, gamma, Lc) {
  const b = velocity.toFixed(4)
  const g = gamma.toFixed(4)
  const l = Lc.toFixed(3)

  switch (view) {
    case 'lightcone':
      return {
        domain: 'MINKOWSKI SPACETIME · CAUSALITY',
        syllabus: 'AQA (turning points) · IB A.1 · spacetime',
        primaryEq: `ds^2 = -(c\\,dt)^2 + dx^2 + dy^2 + dz^2`,
        derivedEqs: [
          {
            label: 'Lorentz factor',
            eq: `\\textcolor{#7c8cff}{\\gamma} = \\dfrac{1}{\\sqrt{1-\\textcolor{#f59e0b}{\\beta}^2}}`,
          },
          {
            label: 'Current',
            eq: `\\textcolor{#f59e0b}{\\beta} = ${b},\\;\\textcolor{#7c8cff}{\\gamma} = ${g}`,
          },
        ],
        tryThis: [
          'Push β toward 1 and watch the light cone close in — nothing can leave the cone.',
          'Pick two events: are they inside the cone (causally linked) or outside (no signal can connect them)?',
        ],
        checkpoint: {
          q: 'Two events lie outside each other’s light cones. Can one have caused the other?',
          a: 'No. A cause-and-effect link needs a signal travelling at ≤ c, which stays inside the light cone. Spacelike-separated events cannot influence each other.',
        },
      }

    case 'timedilation':
      return {
        domain: 'LORENTZ TRANSFORM · TIME DILATION',
        syllabus: 'AQA (turning points) · IB A.1 · time dilation',
        primaryEq: `\\textcolor{#f59e0b}{t'} = \\textcolor{#7c8cff}{\\gamma}\\,t_0`,
        derivedEqs: [
          {
            label: 'Lorentz factor',
            eq: `\\textcolor{#7c8cff}{\\gamma} = \\dfrac{1}{\\sqrt{1-\\textcolor{#f59e0b}{\\beta}^2}}`,
          },
          {
            label: 'Live values',
            eq: `\\textcolor{#f59e0b}{\\beta}=${b},\\;\\textcolor{#7c8cff}{\\gamma}=${g}`,
          },
        ],
        tryThis: [
          'Set β = 0.87 — γ ≈ 2, so the moving clock ticks at half the rate of yours.',
          'This is real: muons from the upper atmosphere only reach the ground because their clocks run slow.',
        ],
        checkpoint: {
          q: 'A ship flies past at β = 0.6 (γ = 1.25). Whose clock runs slow — yours or the ship’s?',
          a: 'Each sees the other’s clock run slow. t′ = γt₀ applies to whichever clock is moving in your frame; there is no absolute “slow” clock — that is the heart of relativity.',
        },
      }

    case 'lengthcontraction':
      return {
        domain: 'LORENTZ TRANSFORM · LENGTH CONTRACTION',
        syllabus: 'AQA (turning points) · IB A.1 · length contraction',
        primaryEq: `\\textcolor{#e040fb}{L'} = \\dfrac{L_0}{\\textcolor{#7c8cff}{\\gamma}}`,
        derivedEqs: [
          {
            label: 'Proper length',
            eq: `L_0 = 3.000\\text{ u}`,
          },
          {
            label: 'Contracted',
            eq: `\\textcolor{#e040fb}{L'} = ${l}\\text{ u}`,
          },
        ],
        tryThis: [
          'Raise β and watch the rod shrink along its direction of motion — never sideways.',
          'At β = 0.99 the 3 u rod measures under 0.5 u in your frame.',
        ],
        checkpoint: {
          q: 'Does the moving rod contract in all directions, or only one?',
          a: 'Only along the direction of motion. Dimensions perpendicular to the velocity are unchanged — L′ = L₀/γ applies to the length parallel to v.',
        },
      }

    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

// ── Diagnostics panel ──────────────────────────────────────────────────────────

const DIAG_N = 90  // rolling buffer length (~4.5 s at 20 fps)

function drawDiagGraph(ctx, w, h, history) {
  ctx.clearRect(0, 0, w, h)
  if (history.length < 2) return

  const maxE = Math.max(7.5, ...history.map((s) => s.E))
  const pad = 4
  const scale = (h - pad * 2) / maxE
  const toY = (v) => h - pad - v * scale

  // Dashed guide at y = 1 (the invariant m² = 1)
  ctx.strokeStyle = 'rgba(106,173,165,0.28)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(0, toY(1))
  ctx.lineTo(w, toY(1))
  ctx.stroke()
  ctx.setLineDash([])

  const xOf = (i) => ((i - (DIAG_N - history.length)) / (DIAG_N - 1)) * w

  const trace = (color, key, width = 1.5, dash = []) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash)
    ctx.beginPath()
    history.forEach((s, i) => {
      const x = xOf(i)
      const y = toY(s[key])
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  trace('rgba(245,158,11,0.72)', 'p')         // amber: momentum p = γβ
  trace('rgba(124,140,255,0.88)', 'E')           // cyan: energy E = γ
  trace('rgba(106,173,165,0.65)', 'm2', 1, [2, 5])  // dim dashed: invariant m²
}

function DiagnosticsPanel({ velocity, gamma }) {
  const [isOpen, setIsOpen] = useState(true)
  const canvasRef = useRef(null)
  const stateRef = useRef({ gamma, velocity, history: [], lastSample: 0 })

  useEffect(() => {
    stateRef.current.gamma = gamma
    stateRef.current.velocity = velocity
  }, [gamma, velocity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const tick = (ts) => {
      // Sample at ~20 fps
      if (ts - stateRef.current.lastSample > 50) {
        stateRef.current.lastSample = ts
        const g = stateRef.current.gamma
        const v = stateRef.current.velocity
        const E = g
        const p = g * v
        const m2 = E * E - p * p  // invariant — should stay ≈ 1
        const hist = stateRef.current.history
        hist.push({ E, p, m2 })
        if (hist.length > DIAG_N) hist.shift()
      }

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w > 0 && h > 0) {
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr)
          canvas.height = Math.round(h * dpr)
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        drawDiagGraph(ctx, w, h, stateRef.current.history)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Live invariant for readout
  const E = gamma
  const p = gamma * velocity
  const m2 = E * E - p * p

  return (
    <section className="flex flex-col border-b border-border-subtle">
      {/* Header / collapse toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-border-subtle group focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-glow shrink-0"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow shadow-glow-cyan" />
          <span className="ui-eyebrow group-hover:text-text-primary transition-colors duration-200">
            System Diagnostics
          </span>
        </div>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          className={`text-text-dim group-hover:text-cyan-glow transition-all duration-200 ${isOpen ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* γ readout */}
          <div className="px-4 py-3 border-b border-border-subtle">
            <p className="font-mono-data text-[11px] tracking-[0.22em] uppercase mb-1" style={{ color: '#a5b0ff' }}>
              Lorentz factor · live
            </p>
            <span className="font-mono-data text-xl tabular-nums text-amber-glow glow-amber">
              {gamma.toFixed(4)}
            </span>
          </div>

          {/* Rolling 4-momentum graph */}
          <div className="px-3 pt-3 pb-2 border-b border-border-subtle">
            <p className="font-mono-data text-[11px] tracking-[0.22em] uppercase mb-2" style={{ color: '#a5b0ff' }}>
              4-momentum · E² − p²
            </p>
            <div className="relative rounded overflow-hidden" style={{ height: '72px' }}>
              <div className="absolute inset-0 osc-grid" style={{ opacity: 0.35 }} />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ display: 'block' }}
              />
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 font-mono-data text-[11px] text-text-dim">
                <span className="inline-block w-3 rounded" style={{ height: 1.5, background: 'rgba(124,140,255,0.88)' }} />
                E = γ
              </span>
              <span className="flex items-center gap-1.5 font-mono-data text-[11px] text-text-dim">
                <span className="inline-block w-3 rounded" style={{ height: 1.5, background: 'rgba(245,158,11,0.72)' }} />
                p = γβ
              </span>
              <span className="flex items-center gap-1.5 font-mono-data text-[11px] text-text-dim">
                <span className="inline-block w-3 rounded" style={{ height: 1.5, background: 'rgba(106,173,165,0.65)' }} />
                m²
              </span>
            </div>
          </div>

          {/* Invariant check readout */}
          <div className="px-4 py-3">
            <p className="font-mono-data text-[11px] tracking-[0.18em] uppercase mb-2" style={{ color: '#a5b0ff' }}>
              Invariant check
            </p>
            <div className="flex items-baseline justify-between py-1.5 border-b border-border-subtle">
              <span className="font-display text-[13px] tracking-widest uppercase text-text-dim">E² − p²</span>
              <span className="font-mono-data text-sm tabular-nums text-cyan-glow glow-cyan">{m2.toFixed(6)}</span>
            </div>
            <div className="flex items-baseline justify-between py-1.5">
              <span className="font-display text-[13px] tracking-widest uppercase text-text-dim">Expected m²</span>
              <span className="font-mono-data text-sm tabular-nums text-text-dim">1.000000</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// ── Main module ────────────────────────────────────────────────────────────────

export default function SRModule() {
  const [activeView, setActiveView] = useState('lightcone')

  const velocity = useModuleStore((s) => s.sr.velocity)
  const eventX = useModuleStore((s) => s.sr.eventX)
  const eventT = useModuleStore((s) => s.sr.eventT)
  const setSrVelocity = useModuleStore((s) => s.setSrVelocity)
  const resetSr = useModuleStore((s) => s.resetSr)

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
  const { domain, primaryEq, derivedEqs, syllabus, tryThis, checkpoint } = buildEquations(activeView, velocity, gamma, Lc)
  const camPos = CAMERA_POSITIONS[activeView]

  return (
    <ModuleShell
      title="Special Relativity"
      accent="#22d3ee"
      views={VIEWS}
      activeView={activeView}
      onViewChange={setActiveView}
      readout={<>γ = {gamma.toFixed(4)}</>}
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
        >
          <DiagnosticsPanel velocity={velocity} gamma={gamma} />
        </InfoPanel>
      }
      controls={<ControlPanel title="Parameters" controls={controls} onReset={resetSr} />}
    >
      {/* Single persistent Canvas — swap content, never remount */}
      <SceneWrapper cameraPosition={camPos}>
        {activeView === 'lightcone' && <LightCone />}
        {activeView === 'timedilation' && <TimeDilation />}
        {activeView === 'lengthcontraction' && <LengthContraction />}
      </SceneWrapper>
    </ModuleShell>
  )
}
