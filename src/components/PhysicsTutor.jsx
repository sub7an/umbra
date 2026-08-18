import { useState, useRef, useEffect, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import useModuleStore from '../store/useModuleStore'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

// ── Starter questions per module + view ───────────────────────────────────────
const STARTERS = {
  'physics-sandbox':    ['What creates spiral galaxy patterns?',  'How do attractors and repulsors combine?',  'What is an emergent field?'],
  'wave-mechanics':     ['What causes destructive interference?', 'How does wavelength affect diffraction?',   'What is a standing wave?'],
  'optics':             ['Why does glass split white light?',      'What is total internal reflection?',        'How does a lens form an image?'],
  'special-relativity': ['Why does time slow at high speeds?',    'What is a light cone?',                     'What is length contraction?'],
  'quantum-mechanics':  ['What is the Bloch sphere showing?',     'Why does measuring collapse the wave?',     'What is quantum tunneling?'],
  'frontier-physics':   ['What evidence exists for dark matter?', 'What is Hubble expansion?',                 'Why do galaxy rotation curves flatten?'],
  'dynamical-systems':  ['What makes a system chaotic?',          'What is a strange attractor?',              'What is the butterfly effect?'],
  'electromagnetism':   ['How does a Halbach array work?',        'What is the Biot-Savart law?',              'Why do field lines never cross?'],
  'general-relativity': ['How does mass curve spacetime?',        'What are geodesics?',                       'What carries gravitational waves?'],
  'thermodynamics':     ['Why does entropy always increase?',     'What makes the Carnot cycle special?',      'What is Maxwell-Boltzmann distribution?'],
  'fluid-dynamics':     ['What causes vortex shedding?',          'What is the Reynolds number?',              'How does SPH simulate fluids?'],
  'acoustic-physics':   ['Why does sand form these patterns?',    'How are musical intervals related to geometry?', 'What is the harmonic series?'],
}

// ── Derive rich context from store state ──────────────────────────────────────
function buildContext(moduleId, s) {
  switch (moduleId) {
    case 'special-relativity': {
      const γ = 1 / Math.sqrt(1 - s.sr.velocity ** 2)
      return `Velocity β = ${s.sr.velocity.toFixed(3)}c, Lorentz factor γ = ${γ.toFixed(3)}, time dilation = ${γ.toFixed(3)}×, length contraction = ${(1/γ).toFixed(3)}×`
    }
    case 'quantum-mechanics':
      return `Bloch sphere: θ = ${(s.qm.blochTheta * 180 / Math.PI).toFixed(1)}°, φ = ${(s.qm.blochPhi * 180 / Math.PI).toFixed(1)}°. Particle-in-box quantum number n = ${s.qm.boxN}. Double-slit wavelength λ = ${s.qm.slitWavelength.toFixed(2)}. Which-path measurement: ${s.qm.slitMeasured ? 'ON (decoherence active)' : 'OFF'}. Tunneling: V₀ = ${s.qm.tunnelV0.toFixed(1)}, k₀ = ${s.qm.tunnelK0.toFixed(1)}.`
    case 'frontier-physics':
      return `Orbital radius = ${s.fp.fpRadius.toFixed(2)} (relative), Hubble constant = ${s.fp.hubble.toFixed(2)}× normalized, black hole mass scale = ${s.fp.bhMass.toFixed(2)}.`
    case 'dynamical-systems':
      return `Current attractor: ${s.ds.attractorType}. Van der Pol μ = ${s.ds.phaseMu.toFixed(2)}.`
    case 'electromagnetism':
      return `Magnet configuration: ${s.em.magnetType}.`
    case 'general-relativity':
      return `Central mass scale M = ${s.gr.mass.toFixed(2)}, view: ${s.gr.viewType}.`
    case 'thermodynamics':
      return `Temperature T = ${s.thermo.temperature.toFixed(2)}× normalized, view: ${s.thermo.viewType}.`
    case 'fluid-dynamics':
      return `Flow intensity (Reynolds proxy) = ${s.fluid.reynolds.toFixed(2)}, view: ${s.fluid.viewType}.`
    default:
      return ''
  }
}

function buildSystemPrompt(moduleId, storeContext) {
  const name = moduleId
    ? moduleId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Module Picker'

  return `You are UMBRA AI — the physics tutor built into Umbra Physics Visualizer, a real-time 3D simulation platform. You live inside the app's info panel.

Active module: ${name}
${storeContext ? `Live simulation state: ${storeContext}` : ''}

How to respond:
- 2–4 sentences unless the user explicitly asks for more
- Always anchor your explanation to what's visible in this simulation right now
- Use precise physics vocabulary but make it genuinely intuitive
- Never invent numbers — only cite values from the simulation state above
- Plain text only — no markdown, no bullet points, no headers
- If the question is unrelated to physics, gently redirect back to the simulation`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PhysicsTutor() {
  const store      = useModuleStore()
  const moduleId   = store.activeModule ?? 'physics-sandbox'

  const [open,       setOpen]      = useState(false)
  const [input,      setInput]     = useState('')
  const [messages,   setMessages]  = useState([])
  const [streaming,  setStreaming]  = useState(false)
  const [streamText, setStreamText]= useState('')
  const [error,      setError]     = useState(null)

  const inputRef  = useRef()
  const bottomRef = useRef()
  const streamRef = useRef(null)

  const starters = STARTERS[moduleId] ?? STARTERS['physics-sandbox']

  // Reset chat when module changes
  useEffect(() => {
    setMessages([])
    setStreamText('')
    setError(null)
  }, [moduleId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // '/' shortcut
  useEffect(() => {
    const handler = (e) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 60)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const send = useCallback(async (text) => {
    const question = text.trim()
    if (!question || streaming) return

    setInput('')
    setError(null)
    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setStreaming(true)
    setStreamText('')

    try {
      const ctx    = buildContext(moduleId, store)
      const system = buildSystemPrompt(moduleId, ctx)
      const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }))

      const stream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 320,
        system,
        messages: apiMessages,
      })
      streamRef.current = stream

      let full = ''
      stream.on('text', (t) => {
        full += t
        setStreamText(full)
      })

      await stream.finalMessage()
      setMessages(prev => [...prev, { role: 'assistant', content: full }])
      setStreamText('')
    } catch (e) {
      if (!e.message?.includes('abort')) {
        setError('Could not reach AI — check VITE_ANTHROPIC_API_KEY in .env')
        setMessages(prev => prev.slice(0, -1))
      }
    } finally {
      setStreaming(false)
      streamRef.current = null
    }
  }, [streaming, messages, moduleId, store])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <div style={{ borderTop: '1px solid rgba(0,229,196,0.07)', background: 'rgba(1,6,12,0.97)', flexShrink: 0 }}>

      {/* ── Toggle bar ── */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => open ? null : inputRef.current?.focus(), 60) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Hex icon */}
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1L10.33 3.5V8.5L6 11L1.67 8.5V3.5L6 1Z"
              stroke={open ? '#00e5c4' : 'rgba(0,229,196,0.35)'}
              strokeWidth="1"
              fill={open ? 'rgba(0,229,196,0.08)' : 'none'}
              style={{ transition: 'all .15s' }}
            />
          </svg>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase',
            color: open ? '#00e5c4' : 'rgba(0,229,196,0.38)',
            transition: 'color .15s',
          }}>UMBRA AI</span>

          {streaming && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 7, letterSpacing: '.15em', color: '#00e5c4',
              animation: 'umbra-pulse 0.9s ease-in-out infinite',
            }}>THINKING</span>
          )}

          {messages.length > 0 && !streaming && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 7, letterSpacing: '.12em', color: 'rgba(0,229,196,0.3)',
            }}>{messages.filter(m => m.role === 'user').length} Q</span>
          )}
        </div>

        <span style={{
          fontSize: 8, color: 'rgba(0,229,196,0.25)',
          transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform .2s', display: 'inline-block',
          fontFamily: 'monospace',
        }}>▲</span>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 300 }}>

          {/* Message area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '4px 14px 10px',
            display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0,
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,229,196,0.15) transparent',
          }}>

            {/* Starters */}
            {messages.length === 0 && !streaming && (
              <div style={{ paddingTop: 4 }}>
                <p style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 7, letterSpacing: '.2em', textTransform: 'uppercase',
                  color: 'rgba(0,229,196,0.28)', marginBottom: 8,
                }}>TRY ASKING</p>
                {starters.map((q, i) => (
                  <button key={i} onClick={() => send(q)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    color: 'rgba(0,229,196,0.5)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '5px 0',
                    borderBottom: '1px solid rgba(0,229,196,0.05)',
                    transition: 'color .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00e5c4'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,229,196,0.5)'}
                  >→ {q}</button>
                ))}
              </div>
            )}

            {/* History */}
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === 'user' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 7, letterSpacing: '.15em', color: 'rgba(255,255,255,0.2)',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>YOU</span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5,
                    }}>{m.content}</span>
                  </div>
                ) : (
                  <div style={{
                    paddingLeft: 10,
                    borderLeft: '2px solid rgba(0,229,196,0.25)',
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 11, color: 'rgba(210,235,230,0.88)', lineHeight: 1.65,
                  }}>{m.content}</div>
                )}
              </div>
            ))}

            {/* Streaming */}
            {streamText && (
              <div style={{
                paddingLeft: 10,
                borderLeft: '2px solid rgba(0,229,196,0.35)',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 11, color: 'rgba(210,235,230,0.88)', lineHeight: 1.65,
              }}>
                {streamText}
                <span style={{
                  display: 'inline-block', width: 6, height: 11,
                  background: '#00e5c4', marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'umbra-pulse 0.6s ease-in-out infinite',
                }}/>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, color: 'rgba(255,100,100,0.7)', padding: '4px 0',
              }}>{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            borderTop: '1px solid rgba(0,229,196,0.07)',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={streaming ? 'Responding…' : 'Ask about what you\'re seeing  [/]'}
              disabled={streaming}
              style={{
                flex: 1,
                background: 'rgba(0,229,196,0.04)',
                border: '1px solid rgba(0,229,196,0.10)',
                borderRadius: 2, padding: '6px 10px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, color: 'rgba(220,240,235,0.85)',
                outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,229,196,0.30)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(0,229,196,0.10)'}
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 8, letterSpacing: '.15em', textTransform: 'uppercase',
                padding: '6px 11px', borderRadius: 2,
                border: '1px solid rgba(0,229,196,0.18)',
                background: 'rgba(0,229,196,0.05)',
                color: (input.trim() && !streaming) ? '#00e5c4' : 'rgba(0,229,196,0.2)',
                cursor: (input.trim() && !streaming) ? 'pointer' : 'default',
                transition: 'all .1s',
              }}
            >ASK</button>
          </div>

          {/* Shortcut hint */}
          <div style={{
            padding: '4px 14px 7px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 7, letterSpacing: '.12em', color: 'rgba(0,229,196,0.18)',
          }}>
            Press / to focus · Enter to send · Context: {moduleId.replace(/-/g,' ')}
          </div>

        </div>
      )}
    </div>
  )
}
