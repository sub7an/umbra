import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'

const STATS = [
  { value: '13', label: 'Interactive physics worlds' },
  { value: '50+', label: 'Distinct simulations' },
  { value: '100%', label: 'Runs in the browser · zero installs' },
  { value: '$0', label: 'Server cost per simulation (GPU-local)' },
]

const PILLARS = [
  {
    tag: 'THE PRODUCT',
    title: 'Physics you can touch, not just read',
    body: 'Thirteen GPU-accelerated worlds — black holes, quantum tunneling, chaos, electromagnetism — rendered live in the browser. Every parameter is a slider; every result updates in real time. No downloads, no plugins, no lab budget.',
    accent: '#5e6ad2',
  },
  {
    tag: 'THE WEDGE',
    title: 'Real-time 3D + AI-native + embeddable',
    body: 'Existing physics tools are static diagrams (textbooks), pre-baked videos (YouTube), or heavyweight desktop software (Mathematica). Umbra is the only one that is simultaneously live-interactive, AI-tutored, gesture-controlled, and drops into any LMS with one line of embed code.',
    accent: '#22d3ee',
  },
  {
    tag: 'THE MARKET',
    title: 'Interactive STEM is a proven category',
    body: 'Brilliant.org built a nine-figure business on interactive STEM lessons. PhET (Colorado) serves 100M+ simulations a year on grant funding alone. The demand is validated; what has been missing is a real-time 3D, AI-native product priced for individual learners and licensed to schools.',
    accent: '#f59e0b',
  },
  {
    tag: 'THE MODEL',
    title: 'Free for learners, licensed to institutions',
    body: 'Individuals use everything free — that is the growth engine. Revenue comes from Pro (power features) and Classroom licenses (per-school). Every embedded simulation a teacher pastes into Canvas or Notion is a distribution beachhead into that classroom.',
    accent: '#10b981',
  },
]

const TRACTION = [
  'Live in production at umbrasandbox.com — not a prototype',
  'Full analytics funnel instrumented (module entries, embeds, waitlist intent)',
  'Embeddable simulation mode shipped — the classroom distribution channel',
  'Assessed curriculum: 5 guided journeys, 24 steps, quiz-gated progression',
  'AI physics tutor answering questions about exactly what is on screen',
]

export default function AboutPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const h = () => { setOpen(true); track('about_opened') }
    window.addEventListener('umbra-about-open', h)
    return () => window.removeEventListener('umbra-about-open', h)
  }, [])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10150,
        background: 'rgba(8,9,10,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '6vh 16px 56px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 980, animation: 'umbra-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.3em', color: 'rgba(94,106,210,0.7)', marginBottom: 14 }}>
            ⬡ UMBRA · THE STORY
          </div>
          <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 'clamp(28px,4.5vw,50px)', color: '#f7f8f8', lineHeight: 1.05 }}>
            The physics lab that fits
          </div>
          <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 'clamp(28px,4.5vw,50px)', color: '#5e6ad2', lineHeight: 1.05, textShadow: '0 0 32px rgba(94,106,210,0.3)' }}>
            in a browser tab.
          </div>
          <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 15, color: 'rgba(247,248,248,0.6)', maxWidth: 560, margin: '18px auto 0', lineHeight: 1.6 }}>
            Umbra turns the hardest ideas in physics into things you can grab, tune, and break — live, in 3D, with an AI tutor watching over your shoulder.
          </p>
        </div>

        {/* Stats band */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1,
          background: 'rgba(94,106,210,0.12)', border: '1px solid rgba(94,106,210,0.12)',
          borderRadius: 8, overflow: 'hidden', marginBottom: 20,
        }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: 'rgba(17,17,19,0.95)', padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 30, color: '#5e6ad2' }}>{s.value}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, letterSpacing: '0.1em', color: 'rgba(247,248,248,0.5)', marginTop: 6, lineHeight: 1.4, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
          {PILLARS.map((p) => (
            <div key={p.tag} style={{
              background: 'rgba(17,17,19,0.92)', border: `1px solid ${p.accent}26`,
              borderRadius: 8, padding: '22px 22px',
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: p.accent, marginBottom: 10 }}>{p.tag}</div>
              <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 18, color: '#f7f8f8', marginBottom: 8, lineHeight: 1.25 }}>{p.title}</div>
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13.5, color: 'rgba(247,248,248,0.62)', lineHeight: 1.65, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>

        {/* Traction */}
        <div style={{
          background: 'rgba(17,17,19,0.92)', border: '1px solid rgba(94,106,210,0.2)',
          borderRadius: 8, padding: '22px 24px', marginBottom: 28,
        }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(94,106,210,0.75)', marginBottom: 14 }}>
            WHERE WE ARE TODAY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TRACTION.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#10b981', fontSize: 12, lineHeight: '20px', flexShrink: 0 }}>✓</span>
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13.5, color: 'rgba(247,248,248,0.72)', lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('umbra-pricing-open')) }}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em',
              color: '#08090a', background: '#5e6ad2', border: 'none', borderRadius: 5,
              padding: '11px 22px', cursor: 'pointer', fontWeight: 700,
            }}
          >
            SEE PRICING →
          </button>
          <button
            onClick={() => { track('about_contact_click'); navigator.clipboard?.writeText('hamzahatef09@gmail.com').catch(() => {}); }}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em',
              color: '#5e6ad2', background: 'rgba(94,106,210,0.08)',
              border: '1px solid rgba(94,106,210,0.4)', borderRadius: 5,
              padding: '11px 22px', cursor: 'pointer',
            }}
            title="Copy contact email"
          >
            INVESTORS & PARTNERSHIPS
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            hamzahatef09@gmail.com · ESC to close
          </span>
        </div>
      </div>
    </div>
  )
}
