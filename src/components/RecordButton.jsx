import { useState, useRef, useEffect, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function getBestMime() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

export default function RecordButton() {
  const activeModule  = useModuleStore(s => s.activeModule)
  const [recording,  setRecording]  = useState(false)
  const [elapsed,    setElapsed]    = useState(0)
  const [done,       setDone]       = useState(false) // brief "SAVED" flash
  const [error,      setError]      = useState(null)
  const recorderRef  = useRef(null)
  const chunksRef    = useRef([])
  const timerRef     = useRef(null)

  const MAX_SECS = 30

  const stopRecording = useCallback((cancel = false) => {
    clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    setRecording(false)
    setElapsed(0)
    if (!cancel) { setDone(true); setTimeout(() => setDone(false), 2200) }
  }, [])

  // Auto-stop at MAX_SECS
  useEffect(() => {
    if (elapsed >= MAX_SECS) stopRecording()
  }, [elapsed, stopRecording])

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
  }, [])

  const startRecording = useCallback(() => {
    setError(null)
    try {
      // Find the largest canvas (the main Three.js canvas)
      const canvases = [...document.querySelectorAll('canvas')]
      const canvas = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]
      if (!canvas) { setError('No canvas found'); return }

      const stream = canvas.captureStream(30)
      const mime = getBestMime()
      if (!mime) { setError('Recording not supported in this browser'); return }

      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        if (chunksRef.current.length === 0) return
        const ext = mime.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `umbra-${activeModule}-${Date.now()}.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }

      recorderRef.current = recorder
      recorder.start(200) // collect data every 200ms
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)
    } catch (e) {
      setError(e.message)
    }
  }, [activeModule])

  if (!activeModule) return null

  if (recording) {
    const pct = (elapsed / MAX_SECS) * 100
    return (
      <button
        onClick={() => stopRecording()}
        title="Stop recording and download"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 224,
          zIndex: 9980,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 13px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: '#ef4444',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 4,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar behind */}
        <div style={{
          position: 'absolute', inset: 0, left: 0,
          width: `${pct}%`,
          background: 'rgba(239,68,68,0.10)',
          transition: 'width 1s linear',
          pointerEvents: 'none',
        }} />
        {/* Pulsing red dot */}
        <span style={{
          display: 'inline-block', width: 7, height: 7,
          borderRadius: '50%', background: '#ef4444',
          boxShadow: '0 0 8px rgba(239,68,68,0.8)',
          animation: 'umbra-pulse 0.9s ease-in-out infinite',
          flexShrink: 0,
        }} />
        {fmt(elapsed)} / {fmt(MAX_SECS)} · STOP
      </button>
    )
  }

  return (
    <button
      onClick={startRecording}
      title="Record simulation (up to 30 s, downloads as WebM)"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 224,
        zIndex: 9980,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.12em',
        color: done
          ? '#ef4444'
          : error
          ? 'rgba(239,68,68,0.5)'
          : 'rgba(239,68,68,0.45)',
        background: done
          ? 'rgba(239,68,68,0.08)'
          : 'rgba(8,9,10,0.72)',
        border: `1px solid ${done ? 'rgba(239,68,68,0.38)' : error ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.14)'}`,
        borderRadius: 4,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!done && !error) {
          e.currentTarget.style.color = 'rgba(239,68,68,0.9)'
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'
        }
      }}
      onMouseLeave={e => {
        if (!done && !error) {
          e.currentTarget.style.color = 'rgba(239,68,68,0.45)'
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.14)'
        }
      }}
    >
      {done ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5L4.5 8L9 3" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          SAVED
        </>
      ) : error ? (
        'ERROR'
      ) : (
        <>
          <span style={{
            display: 'inline-block', width: 7, height: 7,
            borderRadius: '50%', background: 'rgba(239,68,68,0.55)',
            flexShrink: 0,
          }} />
          REC
        </>
      )}
    </button>
  )
}
