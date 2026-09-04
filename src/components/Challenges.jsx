import { useState, useEffect, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'
import { applySharedState } from './ShareButton'

// ── Challenge definitions ─────────────────────────────────────────────────────
const CHALLENGES = [
  {
    id: 'sr-extreme',
    module: 'special-relativity',
    title: 'Extreme Time Dilation',
    description: 'Set the spacecraft velocity to β = 0.995 (99.5% light speed). The Lorentz factor must exceed 10. You have 60 seconds.',
    hint: 'Drag the VELOCITY B slider all the way to the right.',
    target: { sr: { velocity: [0.993, 0.999] } },
    verify: (store) => store.sr.velocity >= 0.993,
    points: 120,
    difficulty: 'MEDIUM',
    color: '#00e5c4',
    icon: 'SR',
  },
  {
    id: 'qm-tunneling',
    module: 'quantum-mechanics',
    title: 'Quantum Tunneling',
    description: 'Navigate to TUNNELING view. Set barrier height V₀ above 4.0 and particle momentum k₀ below 1.5. Observe non-zero transmission.',
    hint: 'Use the TUNNELING tab, then set sliders: V₀ high, k₀ low.',
    target: { qm: { tunnelV0: [4.0, 6.0], tunnelK0: [0.5, 1.5] } },
    verify: (store) => store.qm.tunnelV0 >= 4.0 && store.qm.tunnelK0 <= 1.5,
    points: 150,
    difficulty: 'HARD',
    color: '#f59e0b',
    icon: 'QM',
  },
  {
    id: 'gr-massive',
    module: 'general-relativity',
    title: 'Black Hole Geometry',
    description: 'Crank the central mass to maximum (M = 5). Switch to GEODESICS view to see extreme spacetime curvature.',
    hint: 'Drag the MASS slider to 5, then click GEODESICS in the top tabs.',
    target: { gr: { mass: [4.5, 5.0], viewType: 'geodesics' } },
    verify: (store) => store.gr.mass >= 4.5 && store.gr.viewType === 'geodesics',
    points: 130,
    difficulty: 'MEDIUM',
    color: '#fb923c',
    icon: 'GR',
  },
  {
    id: 'ds-lorenz',
    module: 'dynamical-systems',
    title: 'Lorenz Attractor',
    description: 'Select the Lorenz attractor and observe the strange attractor forming. The system must never settle — pure deterministic chaos.',
    hint: 'Pick LORENZ from the attractor selector in the control panel.',
    target: { ds: { attractorType: 'lorenz' } },
    verify: (store) => store.ds.attractorType === 'lorenz',
    points: 80,
    difficulty: 'EASY',
    color: '#10b981',
    icon: 'DS',
  },
  {
    id: 'thermo-hot',
    module: 'thermodynamics',
    title: 'Maximum Entropy',
    description: 'Set temperature to maximum (T = 3.0). Watch the Maxwell-Boltzmann distribution shift and entropy increase rapidly.',
    hint: 'Drag TEMPERATURE all the way to the right.',
    target: { thermo: { temperature: [2.8, 3.0] } },
    verify: (store) => store.thermo.temperature >= 2.8,
    points: 80,
    difficulty: 'EASY',
    color: '#38bdf8',
    icon: 'TD',
  },
]

const STORE_KEY = 'umbra_challenges'
const TODAY = new Date().toISOString().slice(0, 10)

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    if (raw.date !== TODAY) return { date: TODAY, completed: {}, streak: raw.streak || 0 }
    return raw
  } catch { return { date: TODAY, completed: {}, streak: 0 } }
}

function saveProgress(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)) } catch {}
}

function diffLabel(d) {
  if (d === 'EASY')   return { color: '#10b981', bg: 'rgba(16,185,129,0.10)' }
  if (d === 'MEDIUM') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' }
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' }
}

// ── Verify overlay (shows in module) ─────────────────────────────────────────
function VerifyPanel({ challenge, onSuccess, onDismiss }) {
  const store = useModuleStore()
  const [result, setResult] = useState(null) // null | true | false

  const verify = useCallback(() => {
    const pass = challenge.verify(store)
    setResult(pass)
    if (pass) setTimeout(() => onSuccess(), 1200)
  }, [challenge, store, onSuccess])

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10050, width: 380, maxWidth: 'calc(100vw - 32px)',
      background: 'rgba(6,10,16,0.96)', border: '1px solid rgba(0,229,196,0.14)',
      borderRadius: 6, padding: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, flexShrink: 0,
          background: `${challenge.color}14`, border: `1px solid ${challenge.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Chakra Petch, sans-serif', fontSize: 10, fontWeight: 700,
          color: challenge.color,
        }}>{challenge.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 11, fontWeight: 600, color: '#dff2ed', marginBottom: 3 }}>
            {challenge.title}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(0,229,196,0.4)', letterSpacing: '0.08em' }}>
            {challenge.points} PTS
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,229,196,0.3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 10, letterSpacing: '-0.01em' }}>
        {challenge.description}
      </p>
      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(0,229,196,0.3)', lineHeight: 1.5, marginBottom: 12, letterSpacing: '-0.01em' }}>
        HINT: {challenge.hint}
      </p>

      {result === true && (
        <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#10b981', letterSpacing: '0.1em' }}>
          ✓ CORRECT — +{challenge.points} PTS
        </div>
      )}
      {result === false && (
        <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(239,68,68,0.7)', letterSpacing: '0.1em' }}>
          ✗ NOT QUITE — CHECK THE HINT AND TRY AGAIN
        </div>
      )}

      <button
        onClick={verify}
        style={{
          width: '100%', padding: '9px', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
          color: '#00e5c4', background: 'rgba(0,229,196,0.07)',
          border: '1px solid rgba(0,229,196,0.25)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,196,0.13)'; e.currentTarget.style.borderColor = 'rgba(0,229,196,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,196,0.07)'; e.currentTarget.style.borderColor = 'rgba(0,229,196,0.25)' }}
      >
        VERIFY →
      </button>
    </div>
  )
}

// ── Main challenges modal ─────────────────────────────────────────────────────
export default function Challenges() {
  const [open,     setOpen]     = useState(false)
  const [progress, setProgress] = useState(loadProgress)
  const [active,   setActive]   = useState(null) // challenge being attempted
  const setActiveModule = useModuleStore(s => s.setActiveModule)
  const activeModule    = useModuleStore(s => s.activeModule)

  const totalPts   = Object.values(progress.completed).reduce((a, c) => a + c, 0)
  const doneToday  = Object.keys(progress.completed).length
  const allDone    = doneToday === CHALLENGES.length

  const startChallenge = useCallback((ch) => {
    applySharedState({ m: ch.module, s: {} })
    setActiveModule(ch.module)
    setActive(ch)
    setOpen(false)
  }, [setActiveModule])

  const handleSuccess = useCallback(() => {
    if (!active) return
    const next = { ...progress, completed: { ...progress.completed, [active.id]: active.points } }
    if (Object.keys(next.completed).length === CHALLENGES.length) {
      next.streak = (progress.streak || 0) + 1
    }
    setProgress(next)
    saveProgress(next)
    setActive(null)
  }, [active, progress])

  // Only show verify panel when in the right module
  const showVerify = active && activeModule === active.module

  // Keyboard shortcut: Shift+C
  useEffect(() => {
    const h = (e) => { if (e.key === 'C' && e.shiftKey && !window.__UMBRA_PALETTE_OPEN) { e.preventDefault(); setOpen(o => !o) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      {/* Trigger button on home screen */}
      {!activeModule && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10050,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
            color: allDone ? '#10b981' : 'rgba(0,229,196,0.55)',
            background: 'rgba(4,9,12,0.75)',
            border: `1px solid ${allDone ? 'rgba(16,185,129,0.3)' : 'rgba(0,229,196,0.14)'}`,
            borderRadius: 4, cursor: 'pointer', backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = allDone ? '#10b981' : 'rgba(0,229,196,0.9)'; e.currentTarget.style.borderColor = allDone ? 'rgba(16,185,129,0.5)' : 'rgba(0,229,196,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.color = allDone ? '#10b981' : 'rgba(0,229,196,0.55)'; e.currentTarget.style.borderColor = allDone ? 'rgba(16,185,129,0.3)' : 'rgba(0,229,196,0.14)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1L6.8 4H10L7.4 6L8.3 9.5L5.5 7.5L2.7 9.5L3.6 6L1 4H4.2L5.5 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
          CHALLENGES
          {doneToday > 0 && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 3, padding: '1px 5px' }}>
              {doneToday}/{CHALLENGES.length}
            </span>
          )}
        </button>
      )}

      {/* Verify panel when in module */}
      {showVerify && (
        <VerifyPanel challenge={active} onSuccess={handleSuccess} onDismiss={() => setActive(null)} />
      )}

      {/* Main modal */}
      {open && (
        <div
          style={{ position:'fixed',inset:0,zIndex:10200,background:'rgba(4,9,12,0.85)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'8vh',overflowY:'auto' }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ width:'100%',maxWidth:640,margin:'0 16px 32px',background:'rgba(6,10,16,0.98)',border:'1px solid rgba(0,229,196,0.14)',borderRadius:6,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding:'16px 20px',borderBottom:'1px solid rgba(0,229,196,0.08)',display:'flex',alignItems:'center',gap:12 }}>
              <div>
                <div style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:16,fontWeight:700,color:'#dff2ed',letterSpacing:'0.06em' }}>DAILY CHALLENGES</div>
                <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:8,color:'rgba(0,229,196,0.35)',letterSpacing:'0.16em',marginTop:2 }}>{TODAY} · RESETS MIDNIGHT</div>
              </div>
              <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:16 }}>
                {progress.streak > 0 && (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:18,fontWeight:700,color:'#f59e0b' }}>{progress.streak}🔥</div>
                    <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:7,color:'rgba(245,158,11,0.5)',letterSpacing:'0.14em' }}>DAY STREAK</div>
                  </div>
                )}
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:18,fontWeight:700,color:'#00e5c4' }}>{totalPts}</div>
                  <div style={{ fontFamily:'JetBrains Mono, monospace',fontSize:7,color:'rgba(0,229,196,0.4)',letterSpacing:'0.14em' }}>TODAY PTS</div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height:2,background:'rgba(0,229,196,0.06)' }}>
              <div style={{ height:'100%',background:'rgba(0,229,196,0.45)',width:`${(doneToday/CHALLENGES.length)*100}%`,transition:'width 0.4s' }} />
            </div>

            {/* Challenge list */}
            <div style={{ padding:'8px 0' }}>
              {CHALLENGES.map(ch => {
                const done = Boolean(progress.completed[ch.id])
                const diff = diffLabel(ch.difficulty)
                return (
                  <div
                    key={ch.id}
                    style={{
                      display:'flex',alignItems:'center',gap:14,padding:'14px 20px',
                      borderBottom:'1px solid rgba(0,229,196,0.04)',
                      opacity: done ? 0.55 : 1,
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width:40,height:40,borderRadius:5,flexShrink:0,
                      background:done?'rgba(16,185,129,0.08)':`${ch.color}0e`,
                      border:`1px solid ${done?'rgba(16,185,129,0.2)':ch.color+'28'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontFamily:'Chakra Petch, sans-serif',fontSize:11,fontWeight:700,
                      color:done?'#10b981':ch.color,
                    }}>
                      {done ? '✓' : ch.icon}
                    </div>
                    {/* Text */}
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                        <span style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:12,fontWeight:600,color:done?'rgba(16,185,129,0.7)':'#dff2ed' }}>{ch.title}</span>
                        <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:7,letterSpacing:'0.1em',padding:'2px 6px',borderRadius:3,background:diff.bg,color:diff.color,border:`1px solid ${diff.color}30` }}>{ch.difficulty}</span>
                      </div>
                      <div style={{ fontFamily:"'Inter', system-ui, sans-serif",fontSize:13,color:'rgba(255,255,255,0.32)',lineHeight:1.5,letterSpacing:'-0.01em' }}>{ch.description}</div>
                    </div>
                    {/* Points + action */}
                    <div style={{ flexShrink:0,textAlign:'right' }}>
                      <div style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:14,fontWeight:700,color:done?'#10b981':ch.color,marginBottom:6 }}>
                        {done?'+'+ch.points:ch.points} <span style={{ fontSize:9,fontFamily:'JetBrains Mono, monospace',fontWeight:400 }}>PTS</span>
                      </div>
                      {!done && (
                        <button
                          onClick={() => startChallenge(ch)}
                          style={{
                            padding:'5px 12px',borderRadius:3,cursor:'pointer',
                            fontFamily:'JetBrains Mono, monospace',fontSize:9,letterSpacing:'0.1em',
                            color:ch.color,background:`${ch.color}0a`,
                            border:`1px solid ${ch.color}30`,
                            transition:'background 0.1s',
                          }}
                          onMouseEnter={e=>{e.currentTarget.style.background=`${ch.color}1c`}}
                          onMouseLeave={e=>{e.currentTarget.style.background=`${ch.color}0a`}}
                        >
                          START →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(0,229,196,0.06)',display:'flex',alignItems:'center',gap:12 }}>
              <span style={{ fontFamily:"'Inter', system-ui, sans-serif",fontSize:12,color:'rgba(0,229,196,0.22)',letterSpacing:'-0.01em' }}>
                Complete all 5 daily challenges to extend your streak
              </span>
              <kbd style={{ marginLeft:'auto',fontFamily:'JetBrains Mono, monospace',fontSize:8,color:'rgba(0,229,196,0.25)',border:'1px solid rgba(0,229,196,0.12)',borderRadius:3,padding:'2px 5px' }}>SHIFT+C</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
