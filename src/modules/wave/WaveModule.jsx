import { useState } from 'react'
import useModuleStore from '../../store/useModuleStore'
import RippleTank from './RippleTank'
import DoubleSlit from './DoubleSlit'
import NormalModes from './NormalModes'

const ACCENT = '#22d3ee'

const VIEWS = [
  { id: 'ripple', label: 'RIPPLE TANK'   },
  { id: 'slit',   label: 'DOUBLE SLIT'   },
  { id: 'modes',  label: 'NORMAL MODES'  },
]

const DESCRIPTIONS = {
  ripple: 'Click anywhere to place oscillating wave sources. Watch constructive and destructive interference form in real time.',
  slit:   'A plane wave passes through two apertures in a barrier. The resulting interference pattern is the signature of wave nature.',
  modes:  'Standing wave modes on a 2D rectangular membrane. Frequencies are ω_mn = π√(m²+n²). Select any (m,n) mode from the grid.',
}

export default function WaveModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const [view, setView] = useState('ripple')

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#04090c',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 22px',
        borderBottom: '1px solid rgba(34,211,238,0.1)',
        flexShrink: 0,
      }}>
        {/* Back */}
        <button
          onClick={() => setActiveModule(null)}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: `rgba(34,211,238,0.55)`,
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          ← MODULES
        </button>

        {/* Title */}
        <div style={{
          fontSize: 11, letterSpacing: '0.30em',
          textTransform: 'uppercase', color: ACCENT,
          fontWeight: 700,
        }}>
          Wave Mechanics
        </div>

        {/* Description */}
        <div style={{
          fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.22)',
          marginLeft: 8, maxWidth: 360,
        }}>
          {DESCRIPTIONS[view]}
        </div>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '6px 14px',
                background: view === v.id ? 'rgba(34,211,238,0.12)' : 'transparent',
                border: `1px solid ${view === v.id ? 'rgba(34,211,238,0.40)' : 'rgba(255,255,255,0.08)'}`,
                color: view === v.id ? ACCENT : 'rgba(255,255,255,0.35)',
                borderRadius: 3, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (view !== v.id) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(34,211,238,0.22)'
                }
              }}
              onMouseLeave={(e) => {
                if (view !== v.id) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'ripple' && <RippleTank />}
        {view === 'slit'   && <DoubleSlit />}
        {view === 'modes'  && <NormalModes />}
      </div>
    </div>
  )
}
