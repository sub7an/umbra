import { useRef, useEffect, useState, useCallback } from 'react'

const GW = 260   // grid width
const GH = 180   // grid height
const C2 = 0.45  // wave speed² (must be < 0.5 for numerical stability)
const BORDER = 22 // absorbing sponge thickness

// Precompute damping mask once at module load
const DAMP = new Float32Array(GW * GH)
;(function buildDamp() {
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const ex = Math.min(i, GW - 1 - i) / BORDER
      const ey = Math.min(j, GH - 1 - j) / BORDER
      const t  = Math.min(ex, ey, 1)
      // cosine window: 0 at edge, 1 in interior
      DAMP[j * GW + i] = 0.5 - 0.5 * Math.cos(Math.PI * t)
    }
  }
})()

// Colormap: negative = deep blue, zero = near-black, positive = cyan
function waveToClamped(v) {
  const a = Math.tanh(v * 4.5)  // compress: ±1 after tanh
  let r, g, b
  if (a >= 0) {
    r = Math.round(4 * (1 - a))
    g = Math.round(9 + 220 * a)
    b = Math.round(12 + 184 * a)
  } else {
    const n = -a
    r = Math.round(4 + 18 * n)
    g = Math.round(9 + 40 * n)
    b = Math.round(12 + 188 * n)
  }
  return [r, g, b]
}

function makeSource(nx, ny, freq, amp = 1) {
  return { nx, ny, freq, amp, id: Math.random().toString(36).slice(2) }
}

const PRESET_SOURCES = {
  single: (W, H) => [makeSource(W / 2, H / 2, 0.18)],
  two: (W, H) => [
    makeSource(W * 0.35, H / 2, 0.18),
    makeSource(W * 0.65, H / 2, 0.18),
  ],
  three: (W, H) => [
    makeSource(W / 2, H * 0.28, 0.18),
    makeSource(W * 0.3, H * 0.72, 0.18),
    makeSource(W * 0.7, H * 0.72, 0.18),
  ],
  four: (W, H) => [
    makeSource(W * 0.3, H * 0.3, 0.18),
    makeSource(W * 0.7, H * 0.3, 0.18),
    makeSource(W * 0.3, H * 0.7, 0.18),
    makeSource(W * 0.7, H * 0.7, 0.18),
  ],
}

const ACCENT = '#22d3ee'

const S = (obj) => obj  // identity for inline styles

export default function RippleTank({ globalFreq = 0.18 }) {
  const canvasRef  = useRef()
  const stateRef   = useRef({
    u0: new Float32Array(GW * GH),
    u1: new Float32Array(GW * GH),
    u2: new Float32Array(GW * GH),
    t:  0,
    sources: PRESET_SOURCES.two(GW, GH),
    erasing: false,
    freq: globalFreq,
  })
  const rafRef      = useRef()
  const [sources,   setSources]   = useState(stateRef.current.sources)
  const [erasing,   setErasing]   = useState(false)
  const [freq,      setFreq]      = useState(0.18)
  const [amp,       setAmp]       = useState(1.0)
  const [speed,     setSpeed]     = useState(1.0)
  const [showRings, setShowRings] = useState(true)

  // Keep stateRef in sync with React state (avoid stale closures in rAF)
  useEffect(() => { stateRef.current.sources = sources }, [sources])
  useEffect(() => { stateRef.current.erasing = erasing }, [erasing])
  useEffect(() => {
    stateRef.current.freq = freq
    // Update all existing sources' frequencies
    setSources((prev) => prev.map((s) => ({ ...s, freq })))
  }, [freq])
  useEffect(() => {
    setSources((prev) => prev.map((s) => ({ ...s, amp })))
  }, [amp])

  // Physics + render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(GW, GH)
    const d   = img.data

    const tick = () => {
      const { u0, u1, u2, sources, freq } = stateRef.current
      const t = stateRef.current.t
      const sp = speed

      // Multiple steps per frame for higher wave speed (speed slider = step count)
      const steps = Math.round(1 + sp * 2)

      for (let s = 0; s < steps; s++) {
        const tt = t + s * 0.016

        // Wave equation
        for (let j = 1; j < GH - 1; j++) {
          for (let i = 1; i < GW - 1; i++) {
            const idx = j * GW + i
            u2[idx] = (2 * u1[idx] - u0[idx]
              + C2 * (u1[idx + 1] + u1[idx - 1] + u1[idx + GW] + u1[idx - GW] - 4 * u1[idx])
            ) * DAMP[idx]
          }
        }

        // Inject sources
        for (const src of sources) {
          const ix = Math.round(Math.min(Math.max(src.nx, 1), GW - 2))
          const iy = Math.round(Math.min(Math.max(src.ny, 1), GH - 2))
          u2[iy * GW + ix] = src.amp * Math.sin(src.freq * 60 * tt)
        }

        u0.set(u1)
        u1.set(u2)
      }
      stateRef.current.t += steps * 0.016

      // Render
      for (let k = 0; k < GW * GH; k++) {
        const [r, g, b] = waveToClamped(u1[k])
        const base = k * 4
        d[base]     = r
        d[base + 1] = g
        d[base + 2] = b
        d[base + 3] = 255
      }
      ctx.putImageData(img, 0, 0)

      // Draw source markers on top
      if (showRings) {
        ctx.save()
        for (const src of stateRef.current.sources) {
          const pulse = 0.55 + 0.45 * Math.sin(stateRef.current.t * src.freq * 60)
          ctx.beginPath()
          ctx.arc(src.nx, src.ny, 4 + pulse * 3, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(34,211,238,${0.6 + 0.4 * pulse})`
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(src.nx, src.ny, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
        }
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // Re-run effect only when speed changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, showRings])

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect  = canvas.getBoundingClientRect()
    const scaleX = GW / rect.width
    const scaleY = GH / rect.height
    const nx = (e.clientX - rect.left) * scaleX
    const ny = (e.clientY - rect.top)  * scaleY

    if (stateRef.current.erasing) {
      setSources((prev) => prev.filter((s) => {
        const dx = s.nx - nx, dy = s.ny - ny
        return Math.sqrt(dx * dx + dy * dy) > 12
      }))
    } else {
      const newSrc = makeSource(nx, ny, freq, amp)
      setSources((prev) => [...prev, newSrc])
    }
  }, [freq, amp])

  const handleRightClick = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect  = canvas.getBoundingClientRect()
    const scaleX = GW / rect.width
    const scaleY = GH / rect.height
    const nx = (e.clientX - rect.left) * scaleX
    const ny = (e.clientY - rect.top)  * scaleY
    setSources((prev) => prev.filter((s) => {
      const dx = s.nx - nx, dy = s.ny - ny
      return Math.sqrt(dx * dx + dy * dy) > 14
    }))
  }, [])

  const clearAll = useCallback(() => {
    setSources([])
    const { u0, u1, u2 } = stateRef.current
    u0.fill(0); u1.fill(0); u2.fill(0)
    stateRef.current.t = 0
  }, [])

  const loadPreset = useCallback((key) => {
    const newSrcs = PRESET_SOURCES[key](GW, GH).map((s) => ({ ...s, freq, amp }))
    setSources(newSrcs)
    const { u0, u1, u2 } = stateRef.current
    u0.fill(0); u1.fill(0); u2.fill(0)
    stateRef.current.t = 0
  }, [freq, amp])

  const labelStyle = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 9, letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  }
  const valueStyle = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, color: ACCENT,
    marginBottom: 10,
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={GW}
          height={GH}
          onClick={handleCanvasClick}
          onContextMenu={handleRightClick}
          style={{
            width: '100%', height: '100%',
            imageRendering: 'pixelated',
            display: 'block',
            cursor: erasing ? 'cell' : 'crosshair',
          }}
        />
        {/* Instructions overlay */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.22)', pointerEvents: 'none',
          lineHeight: 1.7,
        }}>
          {erasing ? 'CLICK SOURCE TO ERASE' : 'CLICK TO ADD SOURCE · RIGHT-CLICK TO ERASE'}
        </div>
      </div>

      {/* Controls panel */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(34,211,238,0.1)',
        padding: '20px 18px',
        display: 'flex', flexDirection: 'column', gap: 0,
        overflowY: 'auto',
      }}>
        {/* Source count */}
        <div style={{ marginBottom: 18 }}>
          <div style={labelStyle}>Sources active</div>
          <div style={{ ...valueStyle, fontSize: 22, fontWeight: 700 }}>{sources.length}</div>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Frequency</div>
          <input type="range" min={0.04} max={0.38} step={0.01}
            value={freq}
            onChange={(e) => setFreq(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>{(freq * 60).toFixed(1)} rad/s</div>
        </div>

        {/* Amplitude */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Amplitude</div>
          <input type="range" min={0.2} max={2.0} step={0.1}
            value={amp}
            onChange={(e) => setAmp(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>{amp.toFixed(1)}</div>
        </div>

        {/* Wave speed */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Wave Speed</div>
          <input type="range" min={0.2} max={2.0} step={0.1}
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>{speed.toFixed(1)}×</div>
        </div>

        {/* Erase toggle */}
        <button
          onClick={() => setErasing((e) => !e)}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '7px 0', marginBottom: 8,
            background: erasing ? 'rgba(239,68,68,0.18)' : 'rgba(34,211,238,0.08)',
            border: `1px solid ${erasing ? 'rgba(239,68,68,0.4)' : 'rgba(34,211,238,0.2)'}`,
            color: erasing ? '#ef4444' : 'rgba(255,255,255,0.55)',
            borderRadius: 3, cursor: 'pointer', width: '100%',
          }}
        >
          {erasing ? '◉ ERASE MODE ON' : '◯ ERASE MODE'}
        </button>

        <button
          onClick={clearAll}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '7px 0', marginBottom: 20,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.35)',
            borderRadius: 3, cursor: 'pointer', width: '100%',
          }}
        >
          ✕ CLEAR ALL
        </button>

        {/* Presets */}
        <div style={labelStyle}>Presets</div>
        {[
          { key: 'single', label: 'Single Source', icon: '◉' },
          { key: 'two',    label: 'Two Sources',   icon: '◉◉' },
          { key: 'three',  label: 'Triangle',      icon: '△' },
          { key: 'four',   label: 'Square Array',  icon: '□' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => loadPreset(key)}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, letterSpacing: '0.10em',
              padding: '8px 10px',
              marginBottom: 6,
              background: 'rgba(34,211,238,0.05)',
              border: '1px solid rgba(34,211,238,0.12)',
              color: 'rgba(255,255,255,0.55)',
              borderRadius: 3, cursor: 'pointer',
              width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(34,211,238,0.12)'
              e.currentTarget.style.color = '#22d3ee'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(34,211,238,0.05)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
            }}
          >
            <span style={{ color: ACCENT }}>{icon}</span>
            {label}
          </button>
        ))}

        {/* Source markers toggle */}
        <div style={{ marginTop: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={showRings}
              onChange={(e) => setShowRings(e.target.checked)}
              style={{ accentColor: ACCENT }}
            />
            Show Source Rings
          </label>
        </div>
      </div>
    </div>
  )
}
