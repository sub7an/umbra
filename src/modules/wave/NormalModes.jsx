import { useRef, useEffect, useState } from 'react'

const GW = 260
const GH = 180
const ACCENT = '#22d3ee'

// Analytical 2D rectangular membrane mode: u(x,y,t) = sin(mπx)sin(nπy)cos(ωt)
// ω = π√(m²+n²)

function renderMode(ctx, m, n, t, W, H) {
  const img  = ctx.createImageData(GW, GH)
  const d    = img.data
  const omega = Math.PI * Math.sqrt(m * m + n * n)
  const cosT  = Math.cos(omega * t)

  for (let pj = 0; pj < GH; pj++) {
    const y  = pj / (GH - 1)
    const sy = Math.sin(n * Math.PI * y)
    for (let pi = 0; pi < GW; pi++) {
      const x  = pi / (GW - 1)
      const sx = Math.sin(m * Math.PI * x)
      const v  = sx * sy * cosT  // -1 to 1

      let r, g, b
      if (v >= 0) {
        r = Math.round(4 * (1 - v))
        g = Math.round(9  + 220 * v)
        b = Math.round(12 + 184 * v)
      } else {
        const a = -v
        r = Math.round(4 + 18 * a)
        g = Math.round(9 + 40 * a)
        b = Math.round(12 + 188 * a)
      }
      const base = (pj * GW + pi) * 4
      d[base]     = r
      d[base + 1] = g
      d[base + 2] = b
      d[base + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Draw nodal lines (where the mode is always zero)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 0.5
  // Vertical nodal lines: sin(mπx)=0 → x = k/m for k=1..m-1
  for (let k = 1; k < m; k++) {
    const px = (k / m) * GW
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, GH); ctx.stroke()
  }
  // Horizontal nodal lines: sin(nπy)=0 → y = k/n for k=1..n-1
  for (let k = 1; k < n; k++) {
    const py = (k / n) * GH
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(GW, py); ctx.stroke()
  }
  ctx.restore()
}

const MODES = []
for (let m = 1; m <= 5; m++) {
  for (let n = 1; n <= 4; n++) {
    MODES.push({ m, n })
  }
}

const labelStyle = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9, letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 6,
}

export default function NormalModes() {
  const canvasRef = useRef()
  const rafRef    = useRef()
  const tRef      = useRef(0)
  const [m, setM]       = useState(1)
  const [n, setN]       = useState(2)
  const [speed, setSpeed] = useState(0.4)

  const mRef = useRef(m)
  const nRef = useRef(n)
  const speedRef = useRef(speed)
  useEffect(() => { mRef.current = m }, [m])
  useEffect(() => { nRef.current = n }, [n])
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const tick = () => {
      tRef.current += speedRef.current * 0.016
      renderMode(ctx, mRef.current, nRef.current, tRef.current, GW, GH)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const omega = (Math.PI * Math.sqrt(m * m + n * n)).toFixed(3)

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
        {/* Mode label overlay */}
        <div style={{
          position: 'absolute', top: 12, left: 14, pointerEvents: 'none',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          letterSpacing: '0.12em', color: 'rgba(34,211,238,0.6)',
        }}>
          m={m}, n={n} · ω = {omega}
        </div>
        <div style={{
          position: 'absolute', bottom: 12, left: 12, pointerEvents: 'none',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '0.14em', color: 'rgba(255,255,255,0.22)',
        }}>
          CLICK A MODE FROM THE GRID ON THE RIGHT
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: 260, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(34,211,238,0.1)',
        padding: '18px 14px',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{ ...labelStyle, color: ACCENT, fontSize: 11, marginBottom: 8 }}>
          Normal Modes
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.10em', lineHeight: 1.7,
          marginBottom: 16,
        }}>
          2D membrane · u = sin(mπx)sin(nπy)cos(ωt)
        </div>

        {/* Mode grid */}
        <div style={labelStyle}>Select Mode (m, n)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 18 }}>
          {MODES.map(({ m: mi, n: ni }) => {
            const active = mi === m && ni === n
            return (
              <button
                key={`${mi}-${ni}`}
                onClick={() => { setM(mi); setN(ni); tRef.current = 0 }}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9, padding: '4px 2px',
                  background: active ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: active ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                  borderRadius: 2, cursor: 'pointer',
                }}
              >
                {mi},{ni}
              </button>
            )
          })}
        </div>

        {/* Speed */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Animation Speed</div>
          <input type="range" min={0.05} max={1.5} step={0.05}
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
            style={{ width: '100%', accentColor: ACCENT }}
          />
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, color: ACCENT, marginBottom: 10,
          }}>{speed.toFixed(2)}×</div>
        </div>

        {/* Physics info */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.20)',
          lineHeight: 1.8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 14,
        }}>
          <div style={{ color: ACCENT, marginBottom: 4 }}>EIGENFREQUENCY</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
            ω_mn = π√(m²+n²)
          </div>
          <div>Degenerate modes (same ω) occur when m²+n² is equal — e.g. (1,2) and (2,1).</div>
          <div style={{ marginTop: 8 }}>White lines mark nodal lines where displacement is always zero.</div>
        </div>
      </div>
    </div>
  )
}
