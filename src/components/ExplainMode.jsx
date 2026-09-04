import { useState, useEffect, useCallback, useRef } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import useModuleStore from '../store/useModuleStore'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MODULE_CONTEXT = {
  'special-relativity':  'Special Relativity — Minkowski spacetime, light cones, Lorentz transforms, time dilation, length contraction',
  'quantum-mechanics':   'Quantum Mechanics — Bloch sphere, particle-in-a-box wave functions, double-slit interference, quantum entanglement, tunneling',
  'dynamical-systems':   'Dynamical Systems — strange attractors (Lorenz, Rössler, Thomas), chaotic flows, phase space portraits',
  'electromagnetism':    'Electromagnetism — 3D magnetic field lines, Biot-Savart law, dipoles, solenoids, Halbach arrays',
  'frontier-physics':    'Frontier Physics — galaxy rotation curves, dark matter evidence, Hubble expansion, black hole Schwarzschild radius',
  'general-relativity':  'General Relativity — spacetime curvature tensor, geodesics, gravitational waves from binary systems',
  'thermodynamics':      'Thermodynamics — Maxwell-Boltzmann distribution, entropy evolution, Carnot PV cycles, gas particle collisions',
  'fluid-dynamics':      'Fluid Dynamics — potential flow, Kármán vortex street, smoothed particle hydrodynamics',
  'wave-mechanics':      'Wave Mechanics — 3D wave equation on a membrane, interference patterns, double-slit diffraction',
  'optics':              'Optics — ray tracing through prisms, Snell refraction, biconvex lenses, diffraction gratings',
  'acoustic-physics':    'Acoustic Physics — Chladni nodal patterns, harmonic series, Lissajous figures',
  'physics-sandbox':     'Physics Sandbox — particle field with gravity/repulsion/vortex attractors',
}

function getMainCanvas() {
  return [...document.querySelectorAll('canvas')]
    .sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

// Floating explanation card
function ExplainCard({ text, position, loading, onClose }) {
  const { x, y } = position
  // Keep card on screen
  const left = Math.min(x + 14, window.innerWidth - 340)
  const top  = y > window.innerHeight * 0.6 ? y - 160 : y + 14

  return (
    <div
      style={{
        position: 'fixed',
        left, top,
        zIndex: 10300,
        width: 300,
        background: 'rgba(6,10,16,0.97)',
        border: '1px solid rgba(0,229,196,0.2)',
        borderRadius: 5,
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid rgba(0,229,196,0.08)',
        background: 'rgba(0,229,196,0.04)',
      }}>
        <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#00e5c4', boxShadow:'0 0 6px #00e5c4', animation: loading ? 'umbra-pulse 0.8s ease-in-out infinite' : 'none', flexShrink:0 }} />
        <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8, letterSpacing:'0.18em', color:'rgba(0,229,196,0.5)', flex:1 }}>
          {loading ? 'ANALYZING…' : 'UMBRA EXPLAINS'}
        </span>
        <button
          onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(0,229,196,0.3)', fontSize:14, lineHeight:1, padding:0 }}
        >×</button>
      </div>
      {/* Body */}
      <div style={{ padding: '12px' }}>
        {loading ? (
          <div style={{ display:'flex', gap:4 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display:'inline-block', width:4, height:4, borderRadius:'50%', background:'rgba(0,229,196,0.4)', animation:`umbra-pulse 1s ease-in-out ${i*0.18}s infinite` }} />
            ))}
          </div>
        ) : (
          <p style={{ fontFamily:"'Inter', system-ui, sans-serif", fontSize:13, color:'rgba(223,242,237,0.9)', lineHeight:1.65, margin:0 }}>
            {text}
          </p>
        )}
      </div>
    </div>
  )
}

// Crosshair cursor overlay
function ExplainCursor({ active }) {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  useEffect(() => {
    if (!active) return
    const h = (e) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [active])
  if (!active) return null
  return (
    <div style={{
      position: 'fixed', left: pos.x - 14, top: pos.y - 14,
      width: 28, height: 28, zIndex: 10250,
      pointerEvents: 'none',
    }}>
      {/* Crosshair */}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="5" stroke="#00e5c4" strokeWidth="1" opacity="0.7"/>
        <line x1="14" y1="0" x2="14" y2="8"  stroke="#00e5c4" strokeWidth="1" opacity="0.7"/>
        <line x1="14" y1="20" x2="14" y2="28" stroke="#00e5c4" strokeWidth="1" opacity="0.7"/>
        <line x1="0" y1="14" x2="8"  y2="14" stroke="#00e5c4" strokeWidth="1" opacity="0.7"/>
        <line x1="20" y1="14" x2="28" y2="14" stroke="#00e5c4" strokeWidth="1" opacity="0.7"/>
      </svg>
    </div>
  )
}

export default function ExplainMode({ active, onToggle }) {
  const activeModule = useModuleStore(s => s.activeModule)
  const [card, setCard] = useState(null) // { text, position, loading }
  const pendingRef = useRef(false)

  // Hide card when mode turns off or module changes
  useEffect(() => { setCard(null) }, [active, activeModule])

  const handleClick = useCallback(async (e) => {
    if (!active || !activeModule) return
    if (pendingRef.current) return
    // Don't explain if clicking UI buttons
    if (e.target.closest('button, input, select, [data-no-explain]')) return

    const canvas = getMainCanvas()
    if (!canvas) return

    const position = { x: e.clientX, y: e.clientY }
    setCard({ text: '', position, loading: true })
    pendingRef.current = true

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65)
      const base64  = dataUrl.split(',')[1]

      // Click position as percentage of viewport
      const xPct = Math.round((e.clientX / window.innerWidth) * 100)
      const yPct = Math.round((e.clientY / window.innerHeight) * 100)

      const context = MODULE_CONTEXT[activeModule] || activeModule
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            {
              type: 'text',
              text: `This is the Umbra physics visualizer showing: ${context}. The user clicked at approximately ${xPct}% from the left, ${yPct}% from the top of the screen. In 2-3 sentences of plain English (no equations, no jargon), explain what they are looking at and one surprising real-world connection. Be vivid and specific to what is visible.`,
            },
          ],
        }],
      })

      const text = msg.content[0]?.text?.trim() || 'Could not analyze this area.'
      setCard({ text, position, loading: false })
    } catch (err) {
      setCard({ text: `Could not analyze: ${err.message}`, position, loading: false })
    } finally {
      pendingRef.current = false
    }
  }, [active, activeModule])

  useEffect(() => {
    if (!active) return
    window.addEventListener('click', handleClick, true)
    return () => window.removeEventListener('click', handleClick, true)
  }, [active, handleClick])

  return (
    <>
      <ExplainCursor active={active && Boolean(activeModule)} />
      {card && (
        <ExplainCard
          text={card.text}
          position={card.position}
          loading={card.loading}
          onClose={() => setCard(null)}
        />
      )}
    </>
  )
}
