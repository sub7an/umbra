import { useState, useRef, useEffect, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import useModuleStore from '../store/useModuleStore'
import { applySharedState } from './ShareButton'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const SYSTEM = `You are a physics simulation router. The user describes a physics scenario or asks a physics question. You must respond with ONLY valid JSON — no explanation, no markdown.

Available modules and their settable parameters:
- special-relativity: velocity (0 to 0.99, ratio v/c)
- quantum-mechanics: boxN (1-6, quantum number), blochTheta (0-3.14), blochPhi (0-6.28), tunnelV0 (0.5-6), tunnelK0 (0.5-4), slitWavelength (0.3-1.2), slitMeasured (true/false)
- dynamical-systems: attractorType ("lorenz"|"rossler"|"thomas"|"aizawa"|"vanderpol")
- electromagnetism: magnetType ("dipole"|"bar"|"solenoid"|"halbach")
- frontier-physics: fpRadius (0.2-6.5), hubble (0.2-2.5), bhMass (0.3-1.5)
- general-relativity: mass (0.5-5), viewType ("curvature"|"geodesics"|"waves")
- thermodynamics: temperature (0.2-3.0), viewType ("gas"|"entropy"|"engine")
- fluid-dynamics: viewType ("streamlines"|"vortex"|"sph"), reynolds (0.3-2.5)
- wave-mechanics: (no settable params — just navigate there)
- optics: (no settable params — just navigate there)
- acoustic-physics: (no settable params — just navigate there)
- physics-sandbox: (no settable params — just navigate there)

Respond with JSON only:
{
  "module": "<module-id>",
  "params": { <only params to change from default, omit ones not relevant> },
  "label": "<short 4-6 word label for what was set up, e.g. 'Lorenz attractor σ=10 ρ=28'>",
  "reason": "<one sentence why this module fits>"
}

Map common scenarios:
- time dilation, length contraction, Lorentz factor → special-relativity with high velocity
- particle in box, wave function, tunneling → quantum-mechanics
- chaos, lorenz, strange attractor, bifurcation → dynamical-systems
- magnetic field, solenoid, dipole, Biot-Savart → electromagnetism
- dark matter, galaxy rotation, Hubble → frontier-physics
- black hole, spacetime curvature, gravitational waves → general-relativity
- entropy, Boltzmann, gas, heat engine → thermodynamics
- fluid, vortex, turbulence, Navier-Stokes → fluid-dynamics
- wave, interference, ripple → wave-mechanics
- light, refraction, prism, lens → optics
- sound, Chladni, resonance, harmonics → acoustic-physics
- particle field, sandbox → physics-sandbox

For velocity: if user says "90% speed of light" set velocity=0.9, "99%" → 0.99, etc.
For temperature: 1.0=room temp; 3.0=very hot; 0.2=very cold.`

const EXAMPLES = [
  'A particle near a black hole 3× solar mass',
  'Electron tunneling through a high barrier',
  'Lorenz attractor with chaos',
  'Two magnetic dipoles interacting',
  'Gas at extreme temperature',
  'Spaceship at 99% speed of light',
]

export default function PhysicsInput() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null) // { label, reason } after success
  const [error,   setError]   = useState(null)
  const inputRef = useRef()
  const setActiveModule = useModuleStore(s => s.setActiveModule)

  // Open with / key when no input focused
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== '/' || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (window.__UMBRA_PALETTE_OPEN) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery(''); setResult(null); setError(null)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const submit = useCallback(async (q) => {
    const text = (q || query).trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM,
        messages: [{ role: 'user', content: text }],
      })
      const raw = msg.content[0]?.text?.trim() || ''
      const json = raw.startsWith('{') ? raw : raw.match(/\{[\s\S]*\}/)?.[0]
      if (!json) throw new Error('No JSON in response')
      const parsed = JSON.parse(json)
      if (!parsed.module) throw new Error('No module in response')

      // Apply to store
      applySharedState({ m: parsed.module, s: parsed.params || {} })
      if (!parsed.params || Object.keys(parsed.params).length === 0) {
        setActiveModule(parsed.module)
      }

      setResult({ label: parsed.label, reason: parsed.reason })
      setTimeout(() => setOpen(false), 1400)
    } catch (e) {
      setError(e.message?.includes('API') ? 'API error — check VITE_ANTHROPIC_API_KEY' : `Could not parse scenario: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [query, loading, setActiveModule])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Describe a physics scenario (press /)"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 88,
          zIndex: 9980,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 13px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'rgba(168,85,247,0.55)',
          background: 'rgba(4,9,12,0.72)',
          border: '1px solid rgba(168,85,247,0.16)',
          borderRadius: 4,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
          transition: 'color 0.15s, border-color 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(168,85,247,0.9)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.38)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(168,85,247,0.55)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.16)' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="5.5" r="4.2" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M3.5 4.2C3.5 3.1 4.4 2.5 5.5 2.5C6.5 2.5 7.3 3.1 7.3 4.2C7.3 5.0 6.7 5.5 5.5 5.8V6.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <circle cx="5.5" cy="8" r="0.55" fill="currentColor"/>
        </svg>
        ASK
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(4,9,12,0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '16vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '100%', maxWidth: 620, margin: '0 16px',
          background: 'rgba(6,10,16,0.98)',
          border: '1px solid rgba(168,85,247,0.22)',
          boxShadow: '0 0 0 1px rgba(168,85,247,0.05), 0 32px 80px rgba(0,0,0,0.8)',
          borderRadius: 6, overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px 10px',
          borderBottom: '1px solid rgba(168,85,247,0.09)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="rgba(168,85,247,0.7)" strokeWidth="1.2"/>
            <path d="M4.5 5.5C4.5 4.2 5.4 3.5 6.5 3.5C7.5 3.5 8.3 4.2 8.3 5.3C8.3 6.1 7.7 6.7 6.5 7.0V8" stroke="rgba(168,85,247,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6.5" cy="9.5" r="0.6" fill="rgba(168,85,247,0.7)"/>
          </svg>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(168,85,247,0.5)' }}>
            DESCRIBE A PHYSICS SCENARIO
          </span>
          <kbd style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(168,85,247,0.25)', border: '1px solid rgba(168,85,247,0.12)', borderRadius: 3, padding: '2px 5px' }}>ESC</kbd>
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(168,85,247,0.07)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. Black hole 3× solar mass, electron tunneling through a barrier…"
            disabled={loading}
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
              color: '#dff2ed', letterSpacing: '0.02em',
              opacity: loading ? 0.5 : 1,
            }}
          />
        </div>

        {/* Status */}
        {loading && (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(168,85,247,0.7)', animation: 'umbra-pulse 0.9s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(168,85,247,0.45)' }}>
              ROUTING TO MODULE…
            </span>
          </div>
        )}
        {result && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 12, color: '#a855f7', fontWeight: 600 }}>✓ {result.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(168,85,247,0.38)', letterSpacing: '0.06em' }}>{result.reason}</span>
          </div>
        )}
        {error && (
          <div style={{ padding: '12px 16px' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(239,68,68,0.65)', letterSpacing: '0.06em' }}>{error}</span>
          </div>
        )}

        {/* Example chips */}
        {!loading && !result && !error && (
          <div style={{ padding: '10px 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); submit(ex) }}
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                  letterSpacing: '0.06em', color: 'rgba(168,85,247,0.42)',
                  border: '1px solid rgba(168,85,247,0.12)',
                  borderRadius: 3, padding: '4px 8px', cursor: 'pointer',
                  background: 'transparent', transition: 'color 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(168,85,247,0.75)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.28)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(168,85,247,0.42)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.12)' }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '7px 16px',
          borderTop: '1px solid rgba(168,85,247,0.07)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {[['↵', 'launch simulation'], ['ESC', 'close']].map(([key, lbl]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.12)', borderRadius: 3, padding: '2px 5px' }}>{key}</kbd>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(168,85,247,0.18)', letterSpacing: '0.09em' }}>{lbl}</span>
            </div>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(168,85,247,0.18)', letterSpacing: '0.09em' }}>
            powered by claude
          </span>
        </div>
      </div>
    </div>
  )
}
