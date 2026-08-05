import { useRef, useEffect, useState, useCallback } from 'react'

const GW = 320
const GH = 200
const C2 = 0.44

const BORDER = 20
const DAMP = new Float32Array(GW * GH)
;(function buildDamp() {
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const ex = Math.min(i, GW - 1 - i) / BORDER
      const ey = Math.min(j, GH - 1 - j) / BORDER
      const t  = Math.min(ex, ey, 1)
      DAMP[j * GW + i] = 0.5 - 0.5 * Math.cos(Math.PI * t)
    }
  }
})()

const ACCENT = '#22d3ee'

function waveToClamped(v) {
  const a = Math.tanh(v * 5.5)
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

// Build wall mask: true = wall (blocked), false = open
function buildWalls(slitY1, slitY2, slitWidth, wallX) {
  const walls = new Uint8Array(GW * GH)
  for (let j = 0; j < GH; j++) {
    const open = (
      (j >= slitY1 && j <= slitY1 + slitWidth) ||
      (j >= slitY2 && j <= slitY2 + slitWidth)
    )
    if (!open) {
      walls[j * GW + wallX] = 1
    }
  }
  return walls
}

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
  marginBottom: 12,
}

export default function DoubleSlit() {
  const canvasRef = useRef()
  const stateRef  = useRef({
    u0: new Float32Array(GW * GH),
    u1: new Float32Array(GW * GH),
    u2: new Float32Array(GW * GH),
    t: 0,
    walls: null,
  })
  const rafRef = useRef()

  const [slitSep,   setSlitSep]   = useState(38)   // center-to-center px
  const [slitWidth, setSlitWidth] = useState(10)    // slit opening width px
  const [freq,      setFreq]      = useState(0.20)
  const [showWall,  setShowWall]  = useState(true)

  const WALL_X = Math.round(GW * 0.36)

  // Rebuild walls when params change
  useEffect(() => {
    const cy    = GH / 2
    const slitY1 = Math.round(cy - slitSep / 2 - slitWidth)
    const slitY2 = Math.round(cy + slitSep / 2)
    stateRef.current.walls = buildWalls(slitY1, slitY2, slitWidth, WALL_X)
    // Reset simulation on param change
    stateRef.current.u0.fill(0)
    stateRef.current.u1.fill(0)
    stateRef.current.u2.fill(0)
    stateRef.current.t = 0
  }, [slitSep, slitWidth])

  // Sync freq
  const freqRef = useRef(freq)
  useEffect(() => { freqRef.current = freq }, [freq])

  // Physics + render loop
  useEffect(() => {
    // Build initial walls
    const cy    = GH / 2
    const slitY1 = Math.round(cy - slitSep / 2 - slitWidth)
    const slitY2 = Math.round(cy + slitSep / 2)
    stateRef.current.walls = buildWalls(slitY1, slitY2, slitWidth, WALL_X)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(GW, GH)
    const d   = img.data

    const tick = () => {
      const { u0, u1, u2, walls } = stateRef.current
      const t  = stateRef.current.t
      const f  = freqRef.current

      // 2 steps per frame for speed
      for (let s = 0; s < 2; s++) {
        const tt = t + s * 0.016

        // Wave equation
        for (let j = 1; j < GH - 1; j++) {
          for (let i = 1; i < GW - 1; i++) {
            const idx = j * GW + i
            if (walls && walls[idx]) { u2[idx] = 0; continue }
            u2[idx] = (2 * u1[idx] - u0[idx]
              + C2 * (u1[idx + 1] + u1[idx - 1] + u1[idx + GW] + u1[idx - GW] - 4 * u1[idx])
            ) * DAMP[idx]
          }
        }

        // Plane wave source: column at x=10, all rows
        const src = Math.sin(f * 60 * tt)
        for (let j = 2; j < GH - 2; j++) {
          u2[j * GW + 8] = src
        }

        // Enforce wall to 0
        if (walls) {
          for (let k = 0; k < GW * GH; k++) {
            if (walls[k]) u2[k] = 0
          }
        }

        u0.set(u1)
        u1.set(u2)
      }
      stateRef.current.t += 2 * 0.016

      // Render pixels
      for (let k = 0; k < GW * GH; k++) {
        const [r, g, b] = waveToClamped(u1[k])
        const base = k * 4
        d[base]     = r
        d[base + 1] = g
        d[base + 2] = b
        d[base + 3] = 255
      }
      ctx.putImageData(img, 0, 0)

      // Draw wall overlay
      if (showWall && stateRef.current.walls) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        for (let j = 0; j < GH; j++) {
          if (stateRef.current.walls[j * GW + WALL_X]) {
            ctx.fillRect(WALL_X - 1, j, 3, 1)
          }
        }
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWall])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={GW}
          height={GH}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
        />
        {/* Labels */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, pointerEvents: 'none',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '0.14em', color: 'rgba(255,255,255,0.22)', lineHeight: 1.7,
        }}>
          PLANE WAVE → BARRIER → DOUBLE SLIT → INTERFERENCE
        </div>
      </div>

      {/* Controls */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(34,211,238,0.1)',
        padding: '20px 18px',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...labelStyle, color: ACCENT, fontSize: 11, marginBottom: 4 }}>
            Double-Slit Experiment
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.22)', lineHeight: 1.7,
          }}>
            Watch interference fringes form as the wave diffracts through two apertures.
          </div>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Wavelength</div>
          <input type="range" min={0.08} max={0.34} step={0.01}
            value={freq}
            onChange={(e) => setFreq(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>λ ∝ {(1 / (freq * 60)).toFixed(3)}</div>
        </div>

        {/* Slit separation */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Slit Separation</div>
          <input type="range" min={12} max={72} step={2}
            value={slitSep}
            onChange={(e) => setSlitSep(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>{slitSep} units</div>
        </div>

        {/* Slit width */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Slit Width</div>
          <input type="range" min={4} max={24} step={1}
            value={slitWidth}
            onChange={(e) => setSlitWidth(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={valueStyle}>{slitWidth} units</div>
        </div>

        {/* Show wall */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          cursor: 'pointer', marginBottom: 24,
        }}>
          <input
            type="checkbox"
            checked={showWall}
            onChange={(e) => setShowWall(e.target.checked)}
            style={{ accentColor: ACCENT }}
          />
          Show Barrier
        </label>

        {/* Physics notes */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.20)',
          lineHeight: 1.8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 16,
        }}>
          <div style={{ color: ACCENT, marginBottom: 4 }}>YOUNG'S FORMULA</div>
          <div>Fringe spacing:</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', margin: '4px 0' }}>
            Δy = λL / d
          </div>
          <div style={{ marginTop: 8 }}>More slits → sharper fringes. Narrower slit → wider diffraction envelope.</div>
        </div>
      </div>
    </div>
  )
}
