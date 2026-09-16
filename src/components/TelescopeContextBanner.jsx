import { useEffect, useState } from 'react'
import { quickAI } from '../lib/ai'

// When a user jumps from the Live panel into a module, greet them in-context:
// "You're here because JWST is observing <target> — <why this physics matters>."
export default function TelescopeContextBanner() {
  const [ctx, setCtx] = useState(null)   // { target, category, keywords, instrument }
  const [line, setLine] = useState('')

  useEffect(() => {
    const onJump = async (e) => {
      const d = e.detail || {}
      setCtx(d)
      setLine(d.explainText || '')
      if (!d.explainText) {
        const text = await quickAI(
          `The James Webb Space Telescope is observing "${d.target}" (category: ${d.category || 'unknown'}; keywords: ${d.keywords || 'none'}). In ONE vivid sentence, say why the physics in this simulation is what governs that object. No preamble.`,
          120,
        )
        setLine(text)
      }
    }
    window.addEventListener('umbra-telescope-jump', onJump)
    return () => window.removeEventListener('umbra-telescope-jump', onJump)
  }, [])

  // Auto-dismiss a while after it appears
  useEffect(() => {
    if (!ctx) return
    const t = setTimeout(() => setCtx(null), 20000)
    return () => clearTimeout(t)
  }, [ctx, line])

  if (!ctx) return null

  return (
    <div style={{
      position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10120, width: 'min(560px, 92vw)',
      background: 'rgba(8,9,10,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(94,106,210,0.35)', borderRadius: 8, padding: '12px 16px',
      boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      animation: 'umbra-slide-up 0.4s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: line ? 6 : 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'umbra-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: '#8b9cf7' }}>
          JWST IS OBSERVING <span style={{ color: '#f7f8f8' }}>{ctx.target}</span> — SIMULATING IT HERE
        </span>
        <button onClick={() => setCtx(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(247,248,248,0.4)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      {line
        ? <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, lineHeight: 1.55, color: 'rgba(247,248,248,0.8)', margin: 0 }}>{line}</p>
        : <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(94,106,210,0.5)', margin: 0, animation: 'umbra-pulse 1.2s ease-in-out infinite' }}>UMBRA AI IS CONNECTING THE DOTS…</p>}
    </div>
  )
}
