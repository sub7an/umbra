import { useState } from 'react'
import useModuleStore from '../../store/useModuleStore'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import RippleTank from './RippleTank'
import DoubleSlit from './DoubleSlit'
import NormalModes, { MODES } from './NormalModes'

const ACCENT = '#22d3ee'

const VIEWS = [
  { id: 'ripple', label: 'RIPPLE TANK' },
  { id: 'slit',   label: 'DOUBLE SLIT' },
  { id: 'modes',  label: 'NORMAL MODES' },
]

const CAMERA = {
  ripple: [0, 11, 9],
  slit:   [2, 9, 9],
  modes:  [0, 12, 8],
}

function buildEquations(view) {
  switch (view) {
    case 'ripple': return {
      domain: 'WAVE MECHANICS · WAVE EQUATION',
      primaryEq: `\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u`,
      derivedEqs: [
        { label: 'Superposition', eq: `u = \\textstyle\\sum_i A_i \\cos(kr_i - \\omega t)` },
        { label: 'Interference',  eq: `\\Delta = r_2 - r_1` },
      ],
    }
    case 'slit': return {
      domain: 'WAVE MECHANICS · DOUBLE SLIT',
      primaryEq: `I \\propto \\cos^2\\!\\left(\\frac{\\pi d \\sin\\theta}{\\lambda}\\right)`,
      derivedEqs: [
        { label: 'Maxima',        eq: `d \\sin\\theta = m\\lambda` },
        { label: 'Fringe spacing', eq: `\\Delta y = \\lambda L / d` },
      ],
    }
    case 'modes': return {
      domain: 'WAVE MECHANICS · NORMAL MODES',
      primaryEq: `u_{mn} = A \\sin\\!\\frac{m\\pi x}{L}\\sin\\!\\frac{n\\pi y}{L}\\cos(\\omega_{mn}t)`,
      derivedEqs: [
        { label: 'Eigenfreq.', eq: `\\omega_{mn} = \\pi c\\sqrt{m^2{+}n^2}/L` },
        { label: 'Nodes',      eq: `x = kL/m,\\quad y = kL/n` },
      ],
    }
    default: return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'ripple': return 'Click anywhere on the surface to place a wave source. Waves propagate outward and interfere — crest+crest gives constructive interference (peaks), crest+trough gives destructive (nodes). Solved via finite differences on a 128×128 grid. Sponge layers at the boundary absorb outgoing energy so reflections don\'t pollute the pattern.'
    case 'slit': return 'A plane wave passes through two slits separated by d, creating two coherent point sources. Their superposed wavefronts form a standing interference pattern. Bright fringes where path difference Δ = mλ (constructive). Dark fringes where Δ = (m+½)λ (destructive). Fringe spacing scales as Δy = λL/d.'
    case 'modes': return 'A rectangular membrane fixed at all edges can only vibrate in quantized normal modes (m, n). Each mode has a characteristic nodal grid: m−1 nodal lines in x, n−1 in y. Frequency scales as √(m²+n²). Mode (1,1) is the fundamental; (2,1) and (1,2) are degenerate. Click a mode to see its pattern.'
    default: return ''
  }
}

export default function WaveModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const [view, setView]         = useState('ripple')
  const [sourceCount, setCount] = useState(1)
  const [modeIdx, setModeIdx]   = useState(0)

  const eq = buildEquations(view)
  const [m, n] = MODES[modeIdx]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#04090c',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <style>{`
        @keyframes umbra-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 18px',
        borderBottom: '1px solid rgba(34,211,238,0.10)',
        background: 'rgba(4,9,12,0.97)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveModule(null)}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(34,211,238,0.5)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >← MODULES</button>

        <div style={{ width: 1, height: 14, background: 'rgba(34,211,238,0.12)' }} />

        <span style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700 }}>
          Wave Mechanics
        </span>

        {/* LIVE badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          border: '1px solid rgba(34,211,238,0.28)',
          borderRadius: 2,
          background: 'rgba(34,211,238,0.05)',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`,
            animation: 'umbra-pulse 1.8s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 8, letterSpacing: '0.2em', color: ACCENT }}>LIVE</span>
        </div>

        {/* Stat readout */}
        <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(34,211,238,0.45)' }}>
          {view === 'ripple' && `SOURCES: ${sourceCount}`}
          {view === 'modes'  && `MODE: (${m},${n})  ω = π·${Math.sqrt(m*m+n*n).toFixed(2)}c/L`}
        </span>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '5px 12px',
              background: view === v.id ? 'rgba(34,211,238,0.09)' : 'transparent',
              border: `1px solid ${view === v.id ? 'rgba(34,211,238,0.33)' : 'rgba(255,255,255,0.07)'}`,
              color: view === v.id ? ACCENT : 'rgba(255,255,255,0.33)',
              borderRadius: 2, cursor: 'pointer',
            }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Info panel */}
        <div style={{ width: 235, flexShrink: 0, borderRight: '1px solid rgba(34,211,238,0.07)' }}>
          <InfoPanel
            title="Wave Equation"
            domain={eq.domain}
            primaryEq={eq.primaryEq}
            derivedEqs={eq.derivedEqs}
            explanation={buildExplanation(view)}
            accentColor="cyan"
            footer="WAVE MECHANICS · UMBRA"
          />
        </div>

        {/* 3D scene */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <SceneWrapper
            cameraPosition={CAMERA[view]}
            showGrid={false}
            minDist={4}
            maxDist={28}
          >
            {view === 'ripple' && <RippleTank onSourceCount={setCount} />}
            {view === 'slit'   && <DoubleSlit />}
            {view === 'modes'  && <NormalModes modeIdx={modeIdx} />}
          </SceneWrapper>

          {/* SIM ACTIVE badge */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 10px',
            border: '1px solid rgba(34,211,238,0.18)',
            borderRadius: 2,
            background: 'rgba(4,9,12,0.88)',
            pointerEvents: 'none',
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 4px ${ACCENT}` }} />
            <span style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(34,211,238,0.55)' }}>SIM ACTIVE</span>
          </div>

          {/* Ripple hint */}
          {view === 'ripple' && (
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              fontSize: 8, letterSpacing: '0.12em', color: 'rgba(34,211,238,0.3)',
              pointerEvents: 'none',
            }}>
              CLICK SURFACE · ADD SOURCE
            </div>
          )}

          {/* Normal mode selector */}
          {view === 'modes' && (
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
              pointerEvents: 'all',
            }}>
              {MODES.map(([mm, nn], i) => (
                <button key={i} onClick={() => setModeIdx(i)} style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 8, letterSpacing: '0.08em',
                  padding: '4px 6px',
                  background: modeIdx === i ? 'rgba(34,211,238,0.12)' : 'rgba(4,9,12,0.85)',
                  border: `1px solid ${modeIdx === i ? 'rgba(34,211,238,0.4)' : 'rgba(34,211,238,0.12)'}`,
                  color: modeIdx === i ? ACCENT : 'rgba(34,211,238,0.4)',
                  borderRadius: 2, cursor: 'pointer',
                }}>
                  {mm},{nn}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
