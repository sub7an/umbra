import { useState, useEffect } from 'react'

const MODULE_LABELS = {
  'special-relativity':  'Special Relativity',
  'quantum-mechanics':   'Quantum Mechanics',
  'dynamical-systems':   'Dynamical Systems',
  'electromagnetism':    'Electromagnetism',
  'frontier-physics':    'Frontier Physics',
  'general-relativity':  'General Relativity',
  'thermodynamics':      'Thermodynamics',
  'fluid-dynamics':      'Fluid Dynamics',
  'wave-mechanics':      'Wave Mechanics',
  'optics':              'Optics',
  'acoustic-physics':    'Acoustic Physics',
  'physics-sandbox':     'Physics Sandbox',
}

const JOURNEY_LABELS = {
  'birth-of-light':      'Birth of Light',
  'quantum-leap':        'The Quantum Leap',
  'edge-of-chaos':       'Edge of Chaos',
  'curved-universe':     'Curved Universe',
  'thermodynamic-arrow': 'Fire and Ice',
}

const JOURNEY_COLORS = {
  'birth-of-light':      '#f59e0b',
  'quantum-leap':        '#a855f7',
  'edge-of-chaos':       '#22c55e',
  'curved-universe':     '#f97316',
  'thermodynamic-arrow': '#ef4444',
}

const XP_PER_LEVEL = 150

function getLevel(xp) { return Math.floor(xp / XP_PER_LEVEL) + 1 }
function getLevelXP(xp) { return xp % XP_PER_LEVEL }
function getLevelColor(level) {
  if (level >= 15) return '#f59e0b'  // gold
  if (level >= 10) return '#a855f7'  // purple
  if (level >= 5)  return '#f59e0b'  // cyan
  return 'rgba(200,230,220,0.5)'      // white
}
function getLevelTitle(level) {
  if (level >= 15) return 'GRAND UNIFIED THEORIST'
  if (level >= 12) return 'QUANTUM ARCHITECT'
  if (level >= 9)  return 'SPACETIME NAVIGATOR'
  if (level >= 6)  return 'FIELD THEORIST'
  if (level >= 3)  return 'PHYSICS APPRENTICE'
  return 'EXPLORER'
}

function XPBar({ xp, color }) {
  const pct = (getLevelXP(xp) / XP_PER_LEVEL) * 100
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: 2,
        background: color,
        boxShadow: `0 0 8px ${color}60`,
        transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </div>
  )
}

function ModuleDot({ id, visited }) {
  const isVisited = visited.includes(id)
  const firstChar = (MODULE_LABELS[id] || id).slice(0, 2).toUpperCase()
  return (
    <div
      title={MODULE_LABELS[id] || id}
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: isVisited ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isVisited ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
        color: isVisited ? '#f59e0b' : 'rgba(255,255,255,0.15)',
        cursor: 'default',
      }}
    >{firstChar}</div>
  )
}

function JourneyBubble({ id, data, color }) {
  const done = data?.completed
  const stepsDone = data?.step ?? -1
  const total = 4
  return (
    <div title={JOURNEY_LABELS[id]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: done ? `rgba(${color === '#f59e0b' ? '245,158,11' : color === '#a855f7' ? '168,85,247' : color === '#22c55e' ? '34,197,94' : color === '#f97316' ? '249,115,22' : '239,68,68'},0.15)` : 'rgba(255,255,255,0.03)',
        border: `2px solid ${done ? color : stepsDone >= 0 ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {done
          ? <span style={{ fontSize: 16 }}>✓</span>
          : stepsDone >= 0
          ? <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color, fontWeight: 700 }}>{stepsDone + 1}/{total}</span>
          : <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>—</span>
        }
      </div>
      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9, color: done ? color : 'rgba(255,255,255,0.35)', letterSpacing: '0.01em', textAlign: 'center', maxWidth: 60 }}>
        {JOURNEY_LABELS[id].split(' ').slice(0, 2).join(' ')}
      </span>
    </div>
  )
}

function StatBlock({ label, value, color = '#f59e0b' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 6, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(200,230,220,0.45)', letterSpacing: '0.10em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function ProfilePanel() {
  const [open, setOpen] = useState(false)

  // ? key shortcut - P key
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'p' && e.key !== 'P') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (window.__UMBRA_PALETTE_OPEN) return
      setOpen(v => !v)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Derived data from localStorage
  const totalXP    = parseInt(localStorage.getItem('umbra_story_xp') || '0', 10)
  const level      = getLevel(totalXP)
  const levelXP    = getLevelXP(totalXP)
  const levelColor = getLevelColor(level)
  const levelTitle = getLevelTitle(level)

  const storyData  = JSON.parse(localStorage.getItem('umbra_story') || '{}')
  const recent     = JSON.parse(localStorage.getItem('umbra_recent') || '[]')
  const challengeRaw = JSON.parse(localStorage.getItem('umbra_challenges') || '{}')
  const streak     = parseInt(localStorage.getItem('umbra_challenge_streak') || '0', 10)

  const journeyIds   = Object.keys(JOURNEY_LABELS)
  const completedJourneys = journeyIds.filter(id => storyData[id]?.completed).length
  const moduleIds    = Object.keys(MODULE_LABELS)

  // Count challenge completions
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayProgress = challengeRaw[todayKey] || {}
  const challengesDoneToday = Object.values(todayProgress).filter(Boolean).length

  // Count unique badges (5 per journey × completed journeys)
  const badgeCount = journeyIds.reduce((acc, id) => {
    const d = storyData[id]
    if (!d) return acc
    if (d.completed) return acc + 5
    return acc + Math.max(0, (d.step ?? -1) + 1)
  }, 0)

  return (
    <>
      {/* PROFILE button — shown on home screen */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Your profile — level, XP, badges, progress (P)"
        style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10100,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 13px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
          color: open ? '#f59e0b' : 'rgba(200,230,220,0.55)',
          background: open ? 'rgba(245,158,11,0.07)' : 'rgba(8,6,4,0.72)',
          border: `1px solid ${open ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 5,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {/* Level badge */}
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: `${levelColor}20`, border: `1px solid ${levelColor}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: 700,
          color: levelColor, lineHeight: 1,
        }}>{level}</div>
        PROFILE
        {totalXP > 0 && (
          <span style={{ color: levelColor, fontWeight: 700 }}>{totalXP} XP</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', top: 56, right: 20, zIndex: 10100,
          width: 320,
          background: 'rgba(8,6,4,0.97)',
          border: '1px solid rgba(245,158,11,0.12)',
          borderRadius: 10,
          boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
          {/* Header — level badge */}
          <div style={{
            padding: '20px 20px 16px',
            background: `linear-gradient(135deg, ${levelColor}10 0%, transparent 60%)`,
            borderBottom: '1px solid rgba(245,158,11,0.07)',
            position: 'sticky', top: 0, backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Big level ring */}
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                  background: `${levelColor}14`,
                  border: `2px solid ${levelColor}60`,
                  boxShadow: `0 0 20px ${levelColor}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 1,
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: levelColor, lineHeight: 1 }}>{level}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: `${levelColor}cc`, marginBottom: 4 }}>LEVEL {level} · {levelTitle}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e8f4f0' }}>{totalXP} XP</div>
                  <XPBar xp={totalXP} color={levelColor} />
                  <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'rgba(200,230,220,0.50)', marginTop: 3, letterSpacing: '-0.01em' }}>
                    {levelXP} / {XP_PER_LEVEL} to Lv {level + 1}
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>

          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <StatBlock label="BADGES" value={badgeCount} color={levelColor} />
              <StatBlock label="JOURNEYS" value={`${completedJourneys}/5`} color="#f59e0b" />
              <StatBlock label="STREAK" value={streak > 0 ? `🔥${streak}` : '—'} color="#f59e0b" />
            </div>

            {/* Journeys */}
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(245,158,11,0.60)', marginBottom: 10 }}>GUIDED JOURNEYS</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                {journeyIds.map(id => (
                  <JourneyBubble key={id} id={id} data={storyData[id]} color={JOURNEY_COLORS[id]} />
                ))}
              </div>
            </div>

            {/* Modules explored */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(245,158,11,0.60)' }}>MODULES EXPLORED</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(200,230,220,0.50)' }}>{recent.length} / {moduleIds.length}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {moduleIds.map(id => <ModuleDot key={id} id={id} visited={recent} />)}
              </div>
            </div>

            {/* Today's challenges */}
            <div style={{
              background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.08)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(245,158,11,0.60)' }}>TODAY'S CHALLENGES</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: challengesDoneToday === 5 ? '#22c55e' : '#f59e0b' }}>
                  {challengesDoneToday}/5
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(challengesDoneToday / 5) * 100}%`,
                  background: challengesDoneToday === 5 ? '#22c55e' : '#f59e0b',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {streak > 0 && (
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: '#f59e0b', marginTop: 8, letterSpacing: '-0.01em' }}>
                  🔥 {streak}-day streak — keep it going!
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid rgba(245,158,11,0.07)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: 'rgba(200,230,220,0.38)', letterSpacing: '0.10em', textAlign: 'center',
          }}>PRESS P TO TOGGLE · PROGRESS AUTO-SAVED</div>
        </div>
      )}
    </>
  )
}
