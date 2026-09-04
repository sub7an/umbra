import { useState, useEffect, useRef, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'
import { encodeShareState, decodeShareState, applySharedState } from './ShareButton'

// Stable per-tab identity
const MY_ID = Math.random().toString(36).slice(2, 9)
const ADJECTIVES = ['Quantum','Photon','Lepton','Baryon','Quark','Gluon','Boson','Hadron','Meson','Axion']
const NOUNS      = ['Observer','Pioneer','Explorer','Analyst','Scholar','Architect','Engineer']
const MY_NAME = `${ADJECTIVES[Math.floor(Math.random()*ADJECTIVES.length)]} ${NOUNS[Math.floor(Math.random()*NOUNS.length)]}`

const EMOJIS = ['⚡','🌌','⚛️','🔭','💫','🌊','🔥','❄️']

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ── Presence heartbeat helpers ────────────────────────────────────────────────
function useRoom(roomCode) {
  const [members, setMembers] = useState([])  // [{id, name, lastSeen}]
  const channelRef = useRef(null)
  const membersRef = useRef({})
  const suppressRef = useRef(false)
  const setModule = useModuleStore(s => s.setActiveModule)

  const broadcast = useCallback((msg) => {
    channelRef.current?.postMessage(msg)
  }, [])

  useEffect(() => {
    if (!roomCode) { channelRef.current = null; setMembers([]); return }

    const ch = new BroadcastChannel(`umbra_room_${roomCode}`)
    channelRef.current = ch

    // Announce join
    ch.postMessage({ type: 'join', id: MY_ID, name: MY_NAME })

    ch.onmessage = ({ data }) => {
      if (!data?.type) return

      if (data.type === 'join' || data.type === 'ping') {
        membersRef.current[data.id] = { id: data.id, name: data.name, lastSeen: Date.now() }
        setMembers(Object.values(membersRef.current))
        // Reply with our own ping so they know we exist
        if (data.type === 'join' && data.id !== MY_ID) {
          ch.postMessage({ type: 'ping', id: MY_ID, name: MY_NAME })
        }
      }

      if (data.type === 'leave') {
        delete membersRef.current[data.id]
        setMembers(Object.values(membersRef.current))
      }

      if (data.type === 'state' && data.senderId !== MY_ID) {
        const decoded = decodeShareState(data.encoded)
        if (decoded) {
          suppressRef.current = true
          applySharedState(decoded)
          setTimeout(() => { suppressRef.current = false }, 80)
        }
      }

      if (data.type === 'module' && data.senderId !== MY_ID) {
        suppressRef.current = true
        setModule(data.module)
        setTimeout(() => { suppressRef.current = false }, 80)
      }
    }

    // Heartbeat every 4s
    const beat = setInterval(() => {
      ch.postMessage({ type: 'ping', id: MY_ID, name: MY_NAME })
      // Prune stale members
      const now = Date.now()
      Object.keys(membersRef.current).forEach(id => {
        if (id !== MY_ID && now - membersRef.current[id].lastSeen > 10000) {
          delete membersRef.current[id]
        }
      })
      setMembers(Object.values(membersRef.current))
    }, 4000)

    return () => {
      ch.postMessage({ type: 'leave', id: MY_ID, name: MY_NAME })
      clearInterval(beat)
      ch.close()
      channelRef.current = null
      membersRef.current = {}
      setMembers([])
    }
  }, [roomCode, setModule])

  // Sync state changes to room
  useEffect(() => {
    if (!roomCode) return
    const unsub = useModuleStore.subscribe((state, prev) => {
      if (suppressRef.current) return
      if (!channelRef.current) return

      // Module switch
      if (state.activeModule !== prev.activeModule) {
        channelRef.current.postMessage({ type: 'module', module: state.activeModule, senderId: MY_ID })
      }

      // Parameter change — only when a module is active
      if (state.activeModule) {
        const encoded = encodeShareState()
        if (encoded) {
          channelRef.current.postMessage({ type: 'state', encoded, senderId: MY_ID })
        }
      }
    })
    return unsub
  }, [roomCode])

  return { members, broadcast }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Avatar({ name, size = 24 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2)
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,35%)`,
      border: `1px solid hsl(${hue},55%,55%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, monospace', fontSize: size * 0.35,
      color: `hsl(${hue},80%,85%)`, fontWeight: 700,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}

function ReactionBurst({ reactions }) {
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 10400, pointerEvents: 'none', display: 'flex', gap: 8 }}>
      {reactions.map(r => (
        <div key={r.key} style={{
          fontSize: 28,
          animation: 'umbra-float-up 1.4s ease forwards',
        }}>{r.emoji}</div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MultiplayerRoom() {
  const activeModule = useModuleStore(s => s.activeModule)

  const [panelOpen, setPanelOpen] = useState(false)
  const [roomCode, setRoomCode] = useState(null)
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState('')
  const [copied, setCopied] = useState(false)
  const [reactions, setReactions] = useState([])
  const channelRef2 = useRef(null)

  const { members, broadcast } = useRoom(roomCode)

  const inRoom = Boolean(roomCode)
  const memberCount = members.filter(m => m.id !== MY_ID).length + (inRoom ? 1 : 0)

  // Read room code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('room')
    if (code && /^[A-Z0-9]{6}$/i.test(code)) {
      setRoomCode(code.toUpperCase())
    }
  }, [])

  // Update URL when room code changes
  useEffect(() => {
    const url = new URL(window.location.href)
    if (roomCode) {
      url.searchParams.set('room', roomCode)
    } else {
      url.searchParams.delete('room')
    }
    window.history.replaceState(null, '', url.toString())
  }, [roomCode])

  // Reaction channel (separate — so reactions work even during state suppression)
  useEffect(() => {
    if (!roomCode) return
    const ch = new BroadcastChannel(`umbra_reactions_${roomCode}`)
    channelRef2.current = ch
    ch.onmessage = ({ data }) => {
      if (data?.type === 'reaction') {
        const key = Math.random().toString(36).slice(2)
        setReactions(r => [...r, { emoji: data.emoji, key }])
        setTimeout(() => setReactions(r => r.filter(x => x.key !== key)), 1500)
      }
    }
    return () => { ch.close(); channelRef2.current = null }
  }, [roomCode])

  const createRoom = () => {
    const code = genCode()
    setRoomCode(code)
    setPanelOpen(false)
  }

  const joinRoom = () => {
    const code = joinInput.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setJoinError('Room codes are 6 characters (letters/numbers)')
      return
    }
    setRoomCode(code)
    setJoinInput('')
    setJoinError('')
    setPanelOpen(false)
  }

  const leaveRoom = () => {
    setRoomCode(null)
    setPanelOpen(false)
  }

  const copyLink = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomCode)
    // Clear any ?s= so link is purely a room join
    url.searchParams.delete('s')
    await navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendReaction = (emoji) => {
    channelRef2.current?.postMessage({ type: 'reaction', emoji })
    // Also show locally
    const key = Math.random().toString(36).slice(2)
    setReactions(r => [...r, { emoji, key }])
    setTimeout(() => setReactions(r => r.filter(x => x.key !== key)), 1500)
  }

  // Keyboard: M to toggle panel
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'm' && e.key !== 'M') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (window.__UMBRA_PALETTE_OPEN) return
      setPanelOpen(v => !v)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      {/* Reaction burst */}
      <ReactionBurst reactions={reactions} />

      {/* Floating room badge — visible when in a room while inside a module */}
      {inRoom && activeModule && (
        <div
          onClick={() => setPanelOpen(v => !v)}
          style={{
            position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10150,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
            color: 'rgba(180,77,255,0.8)',
            background: 'rgba(7,4,26,0.85)',
            border: '1px solid rgba(180,77,255,0.22)',
            borderRadius: 20,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
        >
          {/* Live dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#b44dff', boxShadow: '0 0 6px #b44dff',
            animation: 'umbra-pulse 1.2s ease-in-out infinite', flexShrink: 0,
          }} />
          ROOM {roomCode}
          <div style={{ display: 'flex', marginLeft: 2, gap: -4 }}>
            {members.slice(0, 3).map(m => (
              <div key={m.id} style={{ marginLeft: -4 }}>
                <Avatar name={m.name} size={18} />
              </div>
            ))}
          </div>
          <span style={{ color: 'rgba(180,77,255,0.5)' }}>{memberCount} online</span>
        </div>
      )}

      {/* ROOMS button — on home screen */}
      {!activeModule && (
        <button
          onClick={() => setPanelOpen(v => !v)}
          title="Multiplayer rooms — collaborate in real-time (M)"
          style={{
            position: 'fixed', top: 20, left: 140, zIndex: 10100,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 13px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em',
            color: inRoom ? '#b44dff' : panelOpen ? 'rgba(200,230,220,0.8)' : 'rgba(200,230,220,0.45)',
            background: inRoom ? 'rgba(180,77,255,0.07)' : panelOpen ? 'rgba(255,255,255,0.04)' : 'rgba(7,4,26,0.72)',
            border: `1px solid ${inRoom ? 'rgba(180,77,255,0.3)' : panelOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 5,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {/* People icon */}
          <svg width="12" height="11" viewBox="0 0 12 11" fill="none">
            <circle cx="4.5" cy="3" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M1 10c0-1.93 1.567-3.5 3.5-3.5S8 8.07 8 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="9" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.1" opacity="0.6"/>
            <path d="M11 9.5c0-1.38-.895-2.5-2-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>
          </svg>
          ROOMS
          {inRoom && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              background: '#b44dff', color: '#07041a',
              fontSize: 8, fontWeight: 700,
            }}>{memberCount}</span>
          )}
        </button>
      )}

      {/* Main panel */}
      {panelOpen && (
        <div style={{
          position: 'fixed',
          top: activeModule ? 50 : 56,
          left: activeModule ? '50%' : 140,
          transform: activeModule ? 'translateX(-50%)' : 'none',
          zIndex: 10150,
          width: 320,
          background: 'rgba(7,4,26,0.97)',
          border: '1px solid rgba(180,77,255,0.14)',
          borderRadius: 10,
          boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(180,77,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(180,77,255,0.65)', marginBottom: 4 }}>MULTIPLAYER</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e8f4f0' }}>
                {inRoom ? `Room ${roomCode}` : 'Collaboration Rooms'}
              </div>
            </div>
            <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>

          {inRoom ? (
            /* ── In-room view ── */
            <div style={{ padding: '14px 16px' }}>
              {/* Room code + copy */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(180,77,255,0.04)', border: '1px solid rgba(180,77,255,0.12)',
                borderRadius: 6, padding: '10px 12px', marginBottom: 14,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(180,77,255,0.65)', marginBottom: 4 }}>ROOM CODE</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#b44dff', letterSpacing: '0.25em' }}>{roomCode}</div>
                </div>
                <button
                  onClick={copyLink}
                  style={{
                    padding: '7px 12px',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.10em',
                    color: copied ? '#07041a' : 'rgba(180,77,255,0.7)',
                    background: copied ? '#b44dff' : 'rgba(180,77,255,0.08)',
                    border: '1px solid rgba(180,77,255,0.25)', borderRadius: 5,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{copied ? '✓ COPIED' : 'COPY LINK'}</button>
              </div>

              {/* Members */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(200,230,220,0.55)', marginBottom: 8 }}>
                  {memberCount} ONLINE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Me */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar name={MY_NAME} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#e8f4f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{MY_NAME}</div>
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(180,77,255,0.70)', letterSpacing: '0.1em' }}>YOU</span>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#b44dff', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 5px #b44dff' }} />
                  </div>
                  {/* Others */}
                  {members.filter(m => m.id !== MY_ID).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar name={m.name} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(200,230,220,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      </div>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                    </div>
                  ))}
                  {members.filter(m => m.id !== MY_ID).length === 0 && (
                    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(200,230,220,0.45)', padding: '4px 0', letterSpacing: '-0.01em' }}>
                      Share the link to invite collaborators
                    </div>
                  )}
                </div>
              </div>

              {/* Reactions */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(200,230,220,0.55)', marginBottom: 8 }}>REACTIONS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => sendReaction(e)}
                      style={{
                        width: 34, height: 34, borderRadius: 7,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer', fontSize: 16,
                        transition: 'transform 0.1s, background 0.1s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e2 => { e2.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e2.currentTarget.style.transform = 'scale(1.15)' }}
                      onMouseLeave={e2 => { e2.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e2.currentTarget.style.transform = 'scale(1)' }}
                    >{e}</button>
                  ))}
                </div>
              </div>

              {/* How it works note */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 5, padding: '8px 10px', marginBottom: 14,
              }}>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(200,230,220,0.55)', lineHeight: 1.7, letterSpacing: '-0.01em' }}>
                  All participants see the same simulation in real-time. Module switches and parameter changes sync instantly across all connected tabs.
                </div>
              </div>

              {/* Leave */}
              <button
                onClick={leaveRoom}
                style={{
                  width: '100%', padding: '9px 0',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
                  color: 'rgba(239,68,68,0.75)',
                  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 5, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)' }}
              >LEAVE ROOM</button>
            </div>
          ) : (
            /* ── Lobby view ── */
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(237,233,255,0.65)', lineHeight: 1.7, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
                Create a room and share the link. Anyone who opens it joins your session — all parameter changes and module switches sync in real-time.
              </p>

              {/* Create */}
              <button
                onClick={createRoom}
                style={{
                  width: '100%', padding: '11px 0', marginBottom: 12,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
                  color: '#07041a', background: '#b44dff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontWeight: 700, boxShadow: '0 4px 18px rgba(180,77,255,0.3)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >+ CREATE NEW ROOM</button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.12em' }}>OR JOIN</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Join input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  value={joinInput}
                  onChange={e => { setJoinInput(e.target.value.toUpperCase().slice(0, 6)); setJoinError('') }}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  style={{
                    flex: 1, padding: '9px 12px',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.22em',
                    color: '#e8f4f0', background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${joinError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 5, outline: 'none',
                  }}
                />
                <button
                  onClick={joinRoom}
                  style={{
                    padding: '9px 14px',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.10em',
                    color: 'rgba(180,77,255,0.8)',
                    background: 'rgba(180,77,255,0.07)', border: '1px solid rgba(180,77,255,0.22)',
                    borderRadius: 5, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >JOIN</button>
              </div>
              {joinError && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(239,68,68,0.80)', marginBottom: 8 }}>{joinError}</div>
              )}

              {/* Info */}
              <div style={{
                marginTop: 14, padding: '10px 12px',
                background: 'rgba(180,77,255,0.03)', border: '1px solid rgba(180,77,255,0.08)',
                borderRadius: 5,
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(180,77,255,0.65)', marginBottom: 6 }}>HOW IT WORKS</div>
                {['Create a room — get a 6-character code', 'Share the link — anyone can join by clicking it', 'Explore together — all changes sync instantly', 'React with emoji — visible to all participants'].map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(180,77,255,0.55)', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(237,233,255,0.62)', lineHeight: 1.5, letterSpacing: '-0.01em' }}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(180,77,255,0.06)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: 'rgba(200,230,220,0.38)', letterSpacing: '0.10em', textAlign: 'center',
          }}>
            PRESS M TO TOGGLE · REAL-TIME SYNC · NO ACCOUNT NEEDED
          </div>
        </div>
      )}
    </>
  )
}
