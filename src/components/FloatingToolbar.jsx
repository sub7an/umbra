import { useState, useRef, useEffect, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { track } from '@vercel/analytics'
import useModuleStore from '../store/useModuleStore'
import { encodeShareState, decodeShareState, applySharedState } from './ShareButton'
import { isMuted, setMuted, tick as sndTick, click as sndClick } from '../lib/sound'

// ── Physics scenario AI client ────────────────────────────────────────────────
const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const NL_SYSTEM = `You are a physics simulation router. Respond with ONLY valid JSON — no explanation, no markdown.

Available modules and settable parameters:
- special-relativity: velocity (0–0.99, ratio v/c)
- quantum-mechanics: boxN (1–6), blochTheta (0–3.14), blochPhi (0–6.28), tunnelV0 (0.5–6), tunnelK0 (0.5–4), slitWavelength (0.3–1.2), slitMeasured (true/false)
- dynamical-systems: attractorType ("lorenz"|"rossler"|"thomas"|"aizawa"|"vanderpol")
- electromagnetism: magnetType ("dipole"|"bar"|"solenoid"|"halbach")
- frontier-physics: fpRadius (0.2–6.5), hubble (0.2–2.5), bhMass (0.3–1.5)
- general-relativity: mass (0.5–5), viewType ("curvature"|"geodesics"|"waves")
- thermodynamics: temperature (0.2–3.0), viewType ("gas"|"entropy"|"engine")
- fluid-dynamics: viewType ("streamlines"|"vortex"|"sph"), reynolds (0.3–2.5)
- wave-mechanics, optics, acoustic-physics, physics-sandbox: no settable params

Respond: { "module": "<id>", "params": {}, "label": "<4-6 words>", "reason": "<one sentence>" }`

const NL_EXAMPLES = [
  'Black hole 3× solar mass',
  'Electron tunneling barrier',
  'Lorenz attractor chaos',
  'Spaceship at 99% light speed',
  'Gas at extreme temperature',
  'Solenoid magnetic field',
]

function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

function getBestMime() {
  const types = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4']
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

// ── Individual action buttons ─────────────────────────────────────────────────
function Btn({ label, icon, onClick, active, color = '#5e6ad2', title }) {
  const base = `rgba(${color === '#5e6ad2' ? '94,106,210' : color === '#a855f7' ? '168,85,247' : '239,68,68'},`
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.10em',
        color: active ? color : `${base}0.45)`,
        background: active ? `${base}0.10)` : `rgba(8,9,10,0.0)`,
        border: 'none', borderRadius: 3, cursor: 'pointer',
        transition: 'color 0.15s, background 0.15s',
        userSelect: 'none', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${base}0.08)` }}
      onMouseLeave={e => { e.currentTarget.style.color = active ? color : `${base}0.45)`; e.currentTarget.style.background = active ? `${base}0.10)` : 'transparent' }}
    >
      {icon}
      {label}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'rgba(94,106,210,0.1)', flexShrink: 0 }} />
}

// ── Share action ──────────────────────────────────────────────────────────────
function ShareAction({ activeModule }) {
  const [status, setStatus] = useState('idle')

  const handle = useCallback(async () => {
    const encoded = encodeShareState()
    if (!encoded) return
    const url = new URL(window.location.href)
    url.search = `?s=${encoded}`; url.hash = ''
    try {
      await navigator.clipboard.writeText(url.toString())
      track('share_copied', {})
      setStatus('copied'); setTimeout(() => setStatus('idle'), 2000)
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2000) }
  }, [])

  if (!activeModule) return null
  return (
    <Btn
      onClick={handle}
      active={status === 'copied'}
      color="#5e6ad2"
      title="Copy shareable link to this exact simulation state"
      icon={status === 'copied'
        ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M4 2.5H3C2.45 2.5 2 2.95 2 3.5V7.5C2 8.05 2.45 8.5 3 8.5H7C7.55 8.5 8 8.05 8 7.5V6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><path d="M5.5 1.5H8.5V4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 1.5L5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
      }
      label={status === 'copied' ? 'COPIED' : status === 'error' ? 'ERROR' : 'SHARE'}
    />
  )
}

// ── Sound toggle + global UI sound wiring ────────────────────────────────────
function SoundAction() {
  const [muted, set] = useState(isMuted())

  useEffect(() => {
    const onOver  = (e) => { if (e.target.closest?.('button, [role="button"], a')) sndTick() }
    const onClick = (e) => { if (e.target.closest?.('button, [role="button"], a')) sndClick() }
    document.addEventListener('pointerover', onOver,  { passive: true })
    document.addEventListener('pointerdown', onClick, { passive: true })
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onClick)
    }
  }, [])

  return (
    <Btn
      onClick={() => { const m = !muted; setMuted(m); set(m) }}
      active={false}
      color="#5e6ad2"
      title={muted ? 'Unmute interface sounds' : 'Mute interface sounds'}
      icon={<svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1.5 4V7H3.5L6 9.5V1.5L3.5 4H1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>{muted ? <path d="M7.5 4L10 6.5M10 4L7.5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/> : <path d="M7.5 3.5C8.3 4.3 8.3 6.7 7.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>}</svg>}
      label={muted ? 'MUTED' : 'SND'}
    />
  )
}

// ── Embed action: copy an <iframe> snippet for LMS / Notion / blogs ──────────
function EmbedAction({ activeModule }) {
  const [status, setStatus] = useState('idle')

  const handle = useCallback(async () => {
    const snippet = `<iframe src="https://umbrasandbox.com/?embed=1#${activeModule}" width="800" height="520" style="border:0;border-radius:8px;overflow:hidden" title="Umbra — interactive physics simulation" allowfullscreen></iframe>`
    try {
      await navigator.clipboard.writeText(snippet)
      track('embed_copied', { module: activeModule })
      setStatus('copied'); setTimeout(() => setStatus('idle'), 2000)
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2000) }
  }, [activeModule])

  if (!activeModule) return null
  return (
    <Btn
      onClick={handle}
      active={status === 'copied'}
      color="#5e6ad2"
      title="Copy iframe embed code — paste into Notion, Canvas, Moodle, or any web page"
      icon={status === 'copied'
        ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 3L1.5 5L3.5 7M6.5 3L8.5 5L6.5 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      }
      label={status === 'copied' ? 'COPIED' : 'EMBED'}
    />
  )
}

// ── Record action ─────────────────────────────────────────────────────────────
function RecordAction({ activeModule }) {
  const [recording, setRecording] = useState(false)
  const [elapsed,   setElapsed]   = useState(0)
  const [done,      setDone]      = useState(false)
  const recRef   = useRef(null)
  const chunksRef = useRef([])
  const timerRef  = useRef(null)
  const MAX = 30

  const stop = useCallback((cancel = false) => {
    clearInterval(timerRef.current)
    if (recRef.current?.state !== 'inactive') recRef.current?.stop()
    setRecording(false); setElapsed(0)
    if (!cancel) { setDone(true); setTimeout(() => setDone(false), 2000) }
  }, [])

  useEffect(() => { if (elapsed >= MAX) stop() }, [elapsed, stop])
  useEffect(() => () => { clearInterval(timerRef.current); recRef.current?.state !== 'inactive' && recRef.current?.stop() }, [])

  const start = useCallback(() => {
    const canvas = [...document.querySelectorAll('canvas')].sort((a,b) => b.width*b.height - a.width*a.height)[0]
    if (!canvas) return
    const mime = getBestMime(); if (!mime) return
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      if (!chunksRef.current.length) return
      const ext = mime.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: `umbra-${activeModule}-${Date.now()}.${ext}` })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
    recRef.current = rec; rec.start(200)
    setRecording(true); setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
  }, [activeModule])

  if (!activeModule) return null
  const pct = (elapsed / MAX) * 100

  return (
    <div style={{ position: 'relative' }}>
      {recording && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 3,
          width: `${pct}%`, background: 'rgba(239,68,68,0.12)',
          transition: 'width 1s linear', pointerEvents: 'none',
        }} />
      )}
      <Btn
        onClick={recording ? () => stop() : start}
        active={recording || done}
        color="#ef4444"
        title={recording ? 'Stop recording and download' : 'Record simulation (up to 30s, downloads WebM)'}
        icon={done
          ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : recording
          ? <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 6px #ef4444', animation:'umbra-pulse 0.9s ease-in-out infinite' }} />
          : <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'rgba(239,68,68,0.55)' }} />
        }
        label={done ? 'SAVED' : recording ? `${fmt(elapsed)} STOP` : 'REC'}
      />
    </div>
  )
}

// ── ASK / NL input action ─────────────────────────────────────────────────────
function AskAction() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)
  const inputRef = useRef()
  const setActiveModule = useModuleStore(s => s.setActiveModule)

  useEffect(() => {
    const h = (e) => {
      if (e.key !== '/' || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (window.__UMBRA_PALETTE_OPEN) return
      e.preventDefault(); setOpen(true)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setResult(null); setError(null); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const submit = useCallback(async (q) => {
    const text = (q || query).trim(); if (!text || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const msg = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, system: NL_SYSTEM, messages: [{ role: 'user', content: text }] })
      const raw = msg.content[0]?.text?.trim() || ''
      const json = raw.startsWith('{') ? raw : raw.match(/\{[\s\S]*\}/)?.[0]
      if (!json) throw new Error('No JSON in response')
      const parsed = JSON.parse(json)
      if (!parsed.module) throw new Error('No module in response')
      applySharedState({ m: parsed.module, s: parsed.params || {} })
      if (!parsed.params || !Object.keys(parsed.params).length) setActiveModule(parsed.module)
      setResult({ label: parsed.label, reason: parsed.reason })
      setTimeout(() => setOpen(false), 1400)
    } catch (e) { setError(e.message?.includes('API') ? 'API key error' : `Error: ${e.message}`) }
    finally { setLoading(false) }
  }, [query, loading, setActiveModule])

  return (
    <>
      <Btn
        onClick={() => setOpen(true)}
        color="#a855f7"
        title="Describe a physics scenario in plain English (press /)"
        icon={<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="3.8" stroke="currentColor" strokeWidth="1.1"/><path d="M3.5 4C3.5 3.1 4.2 2.5 5 2.5C5.8 2.5 6.4 3.1 6.4 4C6.4 4.7 5.9 5.1 5 5.4V6.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="5" cy="7.5" r="0.5" fill="currentColor"/></svg>}
        label="ASK"
      />
      {open && (
        <div
          style={{ position:'fixed',inset:0,zIndex:10100,background:'rgba(8,9,10,0.80)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'15vh' }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ width:'100%',maxWidth:600,margin:'0 16px',background:'rgba(10,10,12,0.98)',border:'1px solid rgba(168,85,247,0.22)',boxShadow:'0 32px 80px rgba(0,0,0,0.8)',borderRadius:6,overflow:'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding:'11px 16px',borderBottom:'1px solid rgba(168,85,247,0.09)',display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:10,letterSpacing:'0.15em',color:'rgba(168,85,247,0.70)' }}>DESCRIBE A PHYSICS SCENARIO</span>
              <kbd style={{ marginLeft:'auto',fontFamily:'JetBrains Mono, monospace',fontSize:9,color:'rgba(168,85,247,0.25)',border:'1px solid rgba(168,85,247,0.12)',borderRadius:3,padding:'2px 5px' }}>ESC</kbd>
            </div>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid rgba(168,85,247,0.07)' }}>
              <input
                ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="e.g. Black hole 3× solar mass, electron tunneling through a barrier…"
                disabled={loading}
                style={{ width:'100%',background:'none',border:'none',outline:'none',fontFamily:'JetBrains Mono, monospace',fontSize:13,color:'#f7f8f8',letterSpacing:'0.02em',opacity:loading?0.5:1 }}
              />
            </div>
            {loading && <div style={{ padding:'12px 16px',display:'flex',alignItems:'center',gap:8 }}><span style={{ display:'inline-block',width:6,height:6,borderRadius:'50%',background:'rgba(168,85,247,0.7)',animation:'umbra-pulse 0.9s ease-in-out infinite' }}/><span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:11,letterSpacing:'0.12em',color:'rgba(168,85,247,0.65)' }}>ROUTING TO MODULE…</span></div>}
            {result && <div style={{ padding:'12px 16px' }}><div style={{ fontFamily:'Chakra Petch, sans-serif',fontSize:13,color:'#a855f7',fontWeight:600 }}>✓ {result.label}</div><div style={{ fontFamily:"'Inter', system-ui, sans-serif",fontSize:12,color:'rgba(168,85,247,0.60)',marginTop:4 }}>{result.reason}</div></div>}
            {error && <div style={{ padding:'12px 16px' }}><span style={{ fontFamily:'JetBrains Mono, monospace',fontSize:9,color:'rgba(239,68,68,0.65)' }}>{error}</span></div>}
            {!loading && !result && !error && (
              <div style={{ padding:'8px 16px 10px',display:'flex',flexWrap:'wrap',gap:5 }}>
                {NL_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setQuery(ex); submit(ex) }} style={{ fontFamily:"'Inter', system-ui, sans-serif",fontSize:11,letterSpacing:'0.01em',color:'rgba(168,85,247,0.55)',border:'1px solid rgba(168,85,247,0.14)',borderRadius:3,padding:'4px 10px',cursor:'pointer',background:'transparent' }}
                    onMouseEnter={e=>{e.currentTarget.style.color='rgba(168,85,247,0.85)';e.currentTarget.style.borderColor='rgba(168,85,247,0.30)'}}
                    onMouseLeave={e=>{e.currentTarget.style.color='rgba(168,85,247,0.55)';e.currentTarget.style.borderColor='rgba(168,85,247,0.14)'}}
                  >{ex}</button>
                ))}
              </div>
            )}
            <div style={{ padding:'7px 16px',borderTop:'1px solid rgba(168,85,247,0.07)',display:'flex',alignItems:'center',gap:12 }}>
              {[['↵','launch'],['ESC','close']].map(([k,l]) => (
                <div key={k} style={{ display:'flex',alignItems:'center',gap:4 }}>
                  <kbd style={{ fontFamily:'JetBrains Mono, monospace',fontSize:10,color:'rgba(168,85,247,0.50)',border:'1px solid rgba(168,85,247,0.18)',borderRadius:3,padding:'2px 5px' }}>{k}</kbd>
                  <span style={{ fontFamily:"'Inter', system-ui, sans-serif",fontSize:11,color:'rgba(168,85,247,0.38)' }}>{l}</span>
                </div>
              ))}
              <span style={{ marginLeft:'auto',fontFamily:"'Inter', system-ui, sans-serif",fontSize:11,color:'rgba(168,85,247,0.35)' }}>powered by claude</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Snapshot action — exports canvas as branded PNG card ─────────────────────
function SnapshotAction({ activeModule }) {
  const [status, setStatus] = useState('idle')

  const snap = useCallback(async () => {
    const canvas = [...document.querySelectorAll('canvas')]
      .sort((a, b) => b.width * b.height - a.width * a.height)[0]
    if (!canvas) return
    setStatus('saving')

    try {
      const W = canvas.width, H = canvas.height
      const BAR = Math.round(H * 0.065)
      const off = Object.assign(document.createElement('canvas'), { width: W, height: H + BAR })
      const ctx = off.getContext('2d')

      // Draw simulation
      ctx.drawImage(canvas, 0, 0)

      // Footer bar
      ctx.fillStyle = 'rgba(8,9,10,0.96)'
      ctx.fillRect(0, H, W, BAR)

      // Teal accent line
      ctx.fillStyle = '#5e6ad2'
      ctx.fillRect(0, H, W, 2)

      const scale = W / 1920
      const fs = n => Math.round(n * scale)

      // UMBRA wordmark
      ctx.font = `700 ${fs(18)}px "JetBrains Mono", monospace`
      ctx.fillStyle = '#5e6ad2'
      ctx.fillText('UMBRA', fs(24), H + BAR * 0.65)

      // Module name
      const label = (activeModule || '').replace(/-/g, ' ').toUpperCase()
      ctx.font = `${fs(13)}px "JetBrains Mono", monospace`
      ctx.fillStyle = 'rgba(220,242,235,0.75)'
      const lw = ctx.measureText(label).width
      ctx.fillText(label, W - lw - fs(24), H + BAR * 0.65)

      // URL watermark
      ctx.font = `${fs(10)}px "JetBrains Mono", monospace`
      ctx.fillStyle = 'rgba(125,138,242,0.65)'
      ctx.fillText('umbrasandbox.com', fs(24), H + BAR * 0.92)

      const blob = await new Promise(res => off.toBlob(res, 'image/png'))
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `umbra-${activeModule}-${Date.now()}.png`,
      })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setStatus('done'); setTimeout(() => setStatus('idle'), 2000)
      track('snapshot', { module: activeModule })
    } catch { setStatus('idle') }
  }, [activeModule])

  if (!activeModule) return null
  return (
    <Btn
      onClick={snap}
      active={status === 'done'}
      color="#5e6ad2"
      title="Download simulation as PNG (with Umbra watermark)"
      icon={
        status === 'done'
          ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1.5" y="1.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1"/><circle cx="5" cy="4" r="1.2" stroke="currentColor" strokeWidth="1"/><path d="M1.5 8.5h7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
      }
      label={status === 'saving' ? '…' : status === 'done' ? 'SAVED' : 'SNAP'}
    />
  )
}

// ── TUTOR action — opens/closes PhysicsTutor panel ───────────────────────────
function TutorAction() {
  const [active, setActive] = useState(false)
  const activeModule = useModuleStore(s => s.activeModule)
  if (!activeModule) return null

  const toggle = () => {
    setActive(v => !v)
    window.dispatchEvent(new CustomEvent('umbra-tutor-toggle'))
  }

  return (
    <Btn
      onClick={toggle}
      active={active}
      color="#a855f7"
      title="Open UMBRA AI physics tutor — ask anything, control the simulation (T)"
      icon={
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L10.33 3.5V8.5L6 11L1.67 8.5V3.5L6 1Z"
            stroke={active ? 'rgba(168,85,247,0.9)' : 'rgba(168,85,247,0.6)'}
            strokeWidth="1"
            fill={active ? 'rgba(168,85,247,0.12)' : 'none'}
          />
        </svg>
      }
      label="TUTOR"
    />
  )
}

// ── Main export: unified floating toolbar ─────────────────────────────────────
export default function FloatingToolbar({ explainActive, onExplainToggle }) {
  const activeModule = useModuleStore(s => s.activeModule)
  const hasModule = Boolean(activeModule)

  // T key for tutor
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 't' && e.key !== 'T') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (window.__UMBRA_PALETTE_OPEN) return
      if (!useModuleStore.getState().activeModule) return
      window.dispatchEvent(new CustomEvent('umbra-tutor-toggle'))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10050,
      display: 'flex',
      alignItems: 'center',
      background: 'rgba(8,9,10,0.82)',
      border: '1px solid rgba(94,106,210,0.10)',
      borderRadius: 5,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    }}>
      <SoundAction />
      <Divider />
      <AskAction />
      {hasModule && <><Divider /><TutorAction /></>}
      {hasModule && (
        <>
          <Divider />
          <Btn
            onClick={onExplainToggle}
            active={explainActive}
            color="#5e6ad2"
            title="Click anywhere in the simulation to get a plain English explanation (E)"
            icon={<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1"/><path d="M5 3v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5" cy="7.2" r="0.55" fill="currentColor"/></svg>}
            label={explainActive ? 'CLICK ANYTHING' : 'EXPLAIN'}
          />
        </>
      )}
      {hasModule && <><Divider /><SnapshotAction activeModule={activeModule} /></>}
      {hasModule && <><Divider /><RecordAction activeModule={activeModule} /></>}
      {hasModule && <><Divider /><ShareAction activeModule={activeModule} /></>}
      {hasModule && <><Divider /><EmbedAction activeModule={activeModule} /></>}
    </div>
  )
}
