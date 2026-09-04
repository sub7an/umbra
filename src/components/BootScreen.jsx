import { useState, useEffect, useCallback } from 'react'

const LINES = [
  { t: 80,   text: '> UMBRA v1.0 · physics visualizer',   bright: true  },
  { t: 380,  text: '> loading subsystems...',              bright: false },
  { t: 560,  text: '  WebGL renderer           OK',       bright: false },
  { t: 700,  text: '  particle engine          OK',       bright: false },
  { t: 840,  text: '  gesture layer            STANDBY',  bright: false },
  { t: 1000, text: '  10 modules               ONLINE',   bright: true  },
  { t: 1180, text: '> c = ℏ = G = 1  ·  natural units',  bright: false },
]

const LOGO_T  = 1450
const READY_T = 1950
const AUTO_T  = 2800

export default function BootScreen({ onComplete }) {
  const [lines,     setLines]     = useState([])
  const [showLogo,  setShowLogo]  = useState(false)
  const [showReady, setShowReady] = useState(false)
  const [fading,    setFading]    = useState(false)

  const finish = useCallback(() => {
    setFading(true)
    setTimeout(onComplete, 480)
  }, [onComplete])

  useEffect(() => {
    const ids = []
    LINES.forEach(({ t, text, bright }) => {
      ids.push(setTimeout(() => setLines((l) => [...l, { text, bright }]), t))
    })
    ids.push(setTimeout(() => setShowLogo(true),  LOGO_T))
    ids.push(setTimeout(() => setShowReady(true), READY_T))
    ids.push(setTimeout(finish, AUTO_T))

    const onKey = () => finish()
    window.addEventListener('keydown',  onKey, { once: true })

    return () => {
      ids.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
    }
  }, [finish])

  return (
    <>
      <style>{`
        @keyframes boot-line {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes umbra-in {
          from { opacity: 0; transform: scale(0.93) translateY(8px); filter: blur(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   filter: blur(0);   }
        }
        @keyframes sub-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ready-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.85; }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div
        onClick={finish}
        style={{
          position:   'fixed', inset: 0, zIndex: 9000,
          background: '#07041a',
          display:    'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          opacity:    fading ? 0 : 1,
          transition: 'opacity 0.48s ease',
          cursor:     'pointer',
          userSelect: 'none',
        }}
      >
        {/* CRT scanlines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,77,255,0.018) 2px, rgba(180,77,255,0.018) 4px)',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 60%, rgba(7,4,26,0.7) 100%)',
        }} />

        {/* Terminal lines — top-left */}
        <div style={{
          position: 'absolute', top: 44, left: 52,
          display: 'flex', flexDirection: 'column', gap: 5, zIndex: 2,
        }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              fontFamily:    'JetBrains Mono, monospace',
              fontSize:       11,
              letterSpacing: '0.10em',
              color:          l.bright ? '#b44dff' : 'rgba(255,255,255,0.26)',
              animation:     'boot-line 0.18s ease both',
              whiteSpace:    'nowrap',
            }}>
              {l.text}
            </div>
          ))}

          {/* Blinking cursor after last line */}
          {lines.length > 0 && lines.length < LINES.length && (
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: '#b44dff',
              animation: 'cursor-blink 0.9s step-end infinite',
            }}>▋</div>
          )}
        </div>

        {/* UMBRA logo */}
        {showLogo && (
          <div style={{ textAlign: 'center', zIndex: 2, animation: 'umbra-in 0.65s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{
              fontFamily:    'Chakra Petch, sans-serif',
              fontSize:      'clamp(56px, 9vw, 112px)',
              fontWeight:    800,
              letterSpacing: '0.20em',
              color:         '#b44dff',
              textShadow:    '0 0 30px rgba(180,77,255,0.7), 0 0 70px rgba(180,77,255,0.35), 0 0 130px rgba(180,77,255,0.15)',
              lineHeight:     1,
            }}>
              UMBRA
            </div>
            <div style={{
              marginTop:     14,
              fontFamily:    'JetBrains Mono, monospace',
              fontSize:       10,
              letterSpacing: '0.38em',
              textTransform: 'uppercase',
              color:         'rgba(255,255,255,0.30)',
              animation:     'sub-in 0.5s ease 0.3s both',
            }}>
              Physics Visualizer · Interactive 3D
            </div>
          </div>
        )}

        {/* Enter prompt */}
        {showReady && (
          <div style={{
            position:      'absolute', bottom: 48,
            fontFamily:    'JetBrains Mono, monospace',
            fontSize:       10,
            letterSpacing: '0.30em',
            textTransform: 'uppercase',
            color:         'rgba(180,77,255,0.55)',
            animation:     'ready-pulse 1.3s ease-in-out infinite',
            zIndex:         2,
          }}>
            press any key to continue
          </div>
        )}

        {/* Build stamp — bottom right */}
        <div style={{
          position:      'absolute', bottom: 44, right: 52,
          fontFamily:    'JetBrains Mono, monospace',
          fontSize:       9,
          letterSpacing: '0.18em',
          color:         'rgba(255,255,255,0.10)',
          zIndex:         2,
        }}>
          BUILD 2026 · SUB7AN
        </div>
      </div>
    </>
  )
}
