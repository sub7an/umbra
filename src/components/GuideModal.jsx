import { useState, useEffect } from 'react'
import useModuleStore from '../store/useModuleStore'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
    color: '0,229,196',
    label: '12 Physics Simulations',
    desc: 'Click any module card to enter a live interactive simulation — Special Relativity, Quantum Mechanics, Fluid Dynamics, and 9 more. Press Escape or swipe to return.',
    hint: 'Try: Special Relativity → drag the velocity slider to 99% c',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    color: '168,85,247',
    label: 'Command Palette',
    desc: 'Press ⌘K (or Ctrl+K) anywhere to instantly search and jump to any module by name.',
    hint: 'Shortcut: ⌘K',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 10h2M15 10h2M10 3v2M10 15v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      </svg>
    ),
    color: '0,229,196',
    label: 'Click-to-Explain (AI)',
    desc: 'Inside any module, press E or click EXPLAIN in the toolbar. Then click anything in the simulation — Claude Vision explains it in plain English.',
    hint: 'Shortcut: E key · works on every module',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 6h16M2 10h10M2 14h13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '245,158,11',
    label: 'Guided Journeys',
    desc: 'Click JOURNEYS (top-left) to choose from 5 narrative arcs through physics history. Each takes you through 4 modules with guided insights and badges. Earn XP.',
    hint: 'Shortcut: J key · 5 journeys · up to 580 XP each',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M2 16c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="14" cy="8" r="2" stroke="currentColor" strokeWidth="1.1" opacity=".6"/>
        <path d="M18 16c0-1.66-1.34-3-3-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
    color: '99,102,241',
    label: 'Multiplayer Rooms',
    desc: 'Click ROOMS (top-left) to create a room with a 6-character code. Share the link — all participants see the same simulation synced in real-time. Send emoji reactions.',
    hint: 'Shortcut: M key · no account needed',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2v10M10 2l-3 4M10 2l3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 13v3a2 2 0 002 2h10a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '239,68,68',
    label: 'ASK · RECORD · SHARE',
    desc: 'The bottom toolbar (inside any module) lets you: describe a scenario in plain English to jump to the right simulation (ASK), record a 30s clip (REC), or share the exact simulation state via URL (SHARE).',
    hint: 'All three live in the pill toolbar at the bottom of every module',
  },
]

const SHORTCUTS = [
  { keys: ['⌘K', 'Ctrl+K'], desc: 'Open command palette — search modules' },
  { keys: ['E'], desc: 'Toggle click-to-explain mode (inside a module)' },
  { keys: ['J'], desc: 'Open Guided Journeys panel (home screen)' },
  { keys: ['M'], desc: 'Open Multiplayer Rooms panel' },
  { keys: ['Shift+C'], desc: 'Open Daily Challenges' },
  { keys: ['Esc'], desc: 'Return to module picker from any simulation' },
  { keys: ['?'], desc: 'Open this guide' },
]

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ f, index }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `rgba(${f.color},0.06)` : 'rgba(255,255,255,0.02)',
        border: `1px solid rgba(${f.color},${hov ? 0.3 : 0.1})`,
        borderRadius: 8,
        padding: '14px 14px 12px',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        animation: `umbra-slide-up 0.35s ease both`,
        animationDelay: `${index * 0.06}s`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: `rgba(${f.color},0.1)`,
          border: `1px solid rgba(${f.color},0.22)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: `rgb(${f.color})`,
        }}>{f.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
            color: '#e8f4f0', marginBottom: 5, letterSpacing: '0.02em',
          }}>{f.label}</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'rgba(200,230,220,0.6)', lineHeight: 1.7,
          }}>{f.desc}</div>
          <div style={{
            marginTop: 7,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            color: `rgba(${f.color},0.55)`, letterSpacing: '0.08em',
          }}>{f.hint}</div>
        </div>
      </div>
    </div>
  )
}

// ── Shortcut row ──────────────────────────────────────────────────────────────
function ShortcutRow({ keys, desc, index }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      animation: `umbra-slide-up 0.3s ease both`,
      animationDelay: `${index * 0.05}s`,
    }}>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, minWidth: 110, justifyContent: 'flex-end' }}>
        {keys.map((k, i) => (
          <span key={k}>
            <kbd style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              padding: '3px 7px', borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#e8f4f0', letterSpacing: '0.06em',
            }}>{k}</kbd>
            {i < keys.length - 1 && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)', margin: '0 2px' }}>/</span>
            )}
          </span>
        ))}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
        color: 'rgba(200,230,220,0.55)', lineHeight: 1.5,
      }}>{desc}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GuideModal() {
  const activeModule = useModuleStore(s => s.activeModule)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('features') // 'features' | 'shortcuts'
  const [firstRun, setFirstRun] = useState(false)

  // Show automatically on first visit (after boot screen has completed)
  useEffect(() => {
    const seen = localStorage.getItem('umbra_guide_seen')
    if (!seen) {
      // Delay so boot screen finishes first
      const t = setTimeout(() => {
        setOpen(true)
        setFirstRun(true)
      }, 2400)
      return () => clearTimeout(t)
    }
  }, [])

  // Mark as seen when opened
  useEffect(() => {
    if (open) localStorage.setItem('umbra_guide_seen', '1')
  }, [open])

  // ? key shortcut
  useEffect(() => {
    const h = (e) => {
      if (e.key !== '?' && !(e.key === '/' && e.shiftKey)) return
      if (document.activeElement?.tagName === 'INPUT') return
      if (window.__UMBRA_PALETTE_OPEN) return
      setOpen(v => !v)
      setTab('features')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const close = () => { setOpen(false); setFirstRun(false) }

  return (
    <>
      {/* ? button — home screen only */}
      {!activeModule && (
        <button
          onClick={() => { setOpen(v => !v); setTab('features') }}
          title="Guide — what's on this site? (?)"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 10100,
            width: 34, height: 34, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700,
            color: open ? '#e8f4f0' : 'rgba(200,230,220,0.35)',
            background: open ? 'rgba(255,255,255,0.08)' : 'rgba(4,9,12,0.72)',
            border: `1px solid ${open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >?</button>
      )}

      {/* Modal backdrop */}
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 10200,
            background: 'rgba(2,6,10,0.72)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          {/* Modal */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680,
              maxHeight: 'calc(100vh - 60px)',
              background: 'rgba(4,9,12,0.98)',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 12,
              boxShadow: '0 32px 100px rgba(0,0,0,0.9), 0 0 60px rgba(0,229,196,0.04)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: 'umbra-slide-up 0.25s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(0,229,196,0.08)',
              background: 'linear-gradient(135deg, rgba(0,229,196,0.04) 0%, transparent 50%)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                    letterSpacing: '0.22em', color: 'rgba(0,229,196,0.45)', marginBottom: 6,
                  }}>
                    {firstRun ? 'WELCOME TO UMBRA' : 'UMBRA GUIDE'}
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700,
                    color: '#e8f4f0', letterSpacing: '0.02em',
                  }}>
                    {firstRun ? 'Everything you can do here' : 'Features & Shortcuts'}
                  </div>
                  {firstRun && (
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                      color: 'rgba(200,230,220,0.4)', marginTop: 6, lineHeight: 1.6,
                    }}>
                      12 live physics simulations · AI-powered tools · multiplayer · guided journeys
                    </div>
                  )}
                </div>
                <button
                  onClick={close}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                >×</button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                {[['features', 'Features'], ['shortcuts', 'Shortcuts']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{
                      padding: '5px 14px',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
                      color: tab === id ? '#04090c' : 'rgba(200,230,220,0.4)',
                      background: tab === id ? '#00e5c4' : 'transparent',
                      border: `1px solid ${tab === id ? '#00e5c4' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s',
                      fontWeight: tab === id ? 700 : 400,
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {tab === 'features' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {FEATURES.map((f, i) => (
                    <FeatureCard key={f.label} f={f} index={i} />
                  ))}
                </div>
              ) : (
                <div style={{ paddingTop: 4 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                    letterSpacing: '0.16em', color: 'rgba(0,229,196,0.4)',
                    marginBottom: 12,
                  }}>KEYBOARD SHORTCUTS</div>
                  {SHORTCUTS.map((s, i) => (
                    <ShortcutRow key={s.desc} {...s} index={i} />
                  ))}

                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                      letterSpacing: '0.16em', color: 'rgba(0,229,196,0.4)',
                      marginBottom: 12,
                    }}>INSIDE ANY MODULE</div>
                    {[
                      { keys: ['E'], desc: 'Toggle click-to-explain — click anything to get an AI explanation' },
                      { keys: ['Esc'], desc: 'Exit module and return to the module picker' },
                    ].map((s, i) => <ShortcutRow key={s.desc} {...s} index={i} />)}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                      letterSpacing: '0.16em', color: 'rgba(0,229,196,0.4)',
                      marginBottom: 12,
                    }}>TOOLBAR (BOTTOM OF SCREEN)</div>
                    {[
                      { keys: ['ASK'], desc: 'Describe a physics scenario in plain English — Umbra routes you to the right simulation' },
                      { keys: ['EXPLAIN'], desc: 'Toggle AI vision mode — click anywhere on the simulation canvas' },
                      { keys: ['REC'], desc: 'Record a 30-second video of the simulation (downloads as WebM)' },
                      { keys: ['SHARE'], desc: 'Copy a URL that encodes the exact current simulation state' },
                    ].map((s, i) => <ShortcutRow key={s.desc} {...s} index={i} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid rgba(0,229,196,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
                color: 'rgba(200,230,220,0.2)', letterSpacing: '0.1em',
              }}>
                PRESS ? ANYTIME TO REOPEN · ESC TO CLOSE
              </div>
              <button
                onClick={close}
                style={{
                  padding: '7px 20px',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
                  color: '#04090c', background: '#00e5c4',
                  border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(0,229,196,0.25)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >START EXPLORING</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
