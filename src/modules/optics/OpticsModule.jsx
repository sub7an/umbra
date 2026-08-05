import { useState } from 'react'
import useModuleStore from '../../store/useModuleStore'
import RayTracer from './RayTracer'
import LensLab from './LensLab'
import DiffractionGrating from './DiffractionGrating'

const ACCENT = '#fcd34d'

const VIEWS = [
  { id: 'ray',       label: 'RAY TRACER'  },
  { id: 'lens',      label: 'LENS LAB'    },
  { id: 'grating',   label: 'DIFFRACTION' },
]

const DESCRIPTIONS = {
  ray:     'Snell\'s law in action. Prism dispersion, mirror reflections, and thin lens convergence — all traced ray-by-ray.',
  lens:    'Thin lens equation: 1/f = 1/dₒ + 1/dᵢ. Drag parameters to see real vs virtual images form via principal rays.',
  grating: 'Multi-slit far-field intensity: I(θ) ∝ sinc²(β)·[sin(Nδ)/sin(δ)]². Control N, slit width, and wavelength.',
}

export default function OpticsModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const [view, setView] = useState('ray')

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
        borderBottom: '1px solid rgba(252,211,77,0.1)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveModule(null)}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(252,211,77,0.55)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          ← MODULES
        </button>

        <div style={{
          fontSize: 11, letterSpacing: '0.30em', textTransform: 'uppercase',
          color: ACCENT, fontWeight: 700,
        }}>
          Optics
        </div>

        <div style={{
          fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.22)',
          marginLeft: 8, maxWidth: 380,
        }}>
          {DESCRIPTIONS[view]}
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '6px 14px',
                background: view === v.id ? 'rgba(252,211,77,0.12)' : 'transparent',
                border: `1px solid ${view === v.id ? 'rgba(252,211,77,0.40)' : 'rgba(255,255,255,0.08)'}`,
                color: view === v.id ? ACCENT : 'rgba(255,255,255,0.35)',
                borderRadius: 3, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (view !== v.id) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(252,211,77,0.22)'
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

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'ray'     && <RayTracer />}
        {view === 'lens'    && <LensLab />}
        {view === 'grating' && <DiffractionGrating />}
      </div>
    </div>
  )
}
