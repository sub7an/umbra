import { useRef, useEffect, useState, useCallback } from 'react'

const ACCENT = '#fcd34d'

const labelStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)', marginBottom: 5,
}
const valueStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
  color: ACCENT, marginBottom: 12,
}
const infoStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
  letterSpacing: '0.10em', color: 'rgba(255,255,255,0.50)', lineHeight: 1.8,
}

function drawArrow(ctx, x, y, h, color) {
  // Object arrow: vertical arrow at (x, axis_y) with height h
  // h > 0 means pointing up from axis
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle   = color
  ctx.lineWidth   = 2
  ctx.shadowBlur  = 6
  ctx.shadowColor = color
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - h)
  ctx.stroke()
  // Arrowhead
  const dir = h > 0 ? -1 : 1
  ctx.beginPath()
  ctx.moveTo(x, y - h)
  ctx.lineTo(x - 5, y - h + dir * 10)
  ctx.lineTo(x + 5, y - h + dir * 10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLensSymbol(ctx, lx, cy, radius, f) {
  ctx.save()
  ctx.strokeStyle = 'rgba(150,200,255,0.65)'
  ctx.lineWidth   = 2
  ctx.shadowBlur  = 8
  ctx.shadowColor = 'rgba(150,200,255,0.5)'
  ctx.beginPath()
  ctx.moveTo(lx, cy - radius)
  ctx.lineTo(lx, cy + radius)
  ctx.stroke()
  // Arrows on lens
  const dir = f > 0 ? 1 : -1
  const drawTip = (ty, up) => {
    ctx.beginPath()
    ctx.moveTo(lx - 10 * dir, ty + (up ? -10 : 10))
    ctx.lineTo(lx, ty)
    ctx.lineTo(lx + 10 * dir, ty + (up ? -10 : 10))
    ctx.stroke()
  }
  drawTip(cy - radius, true)
  drawTip(cy + radius, false)
  ctx.restore()
}

function drawRayLine(ctx, x1, y1, x2, y2, color, dashed = false) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.4
  ctx.shadowBlur  = 6
  ctx.shadowColor = color
  if (dashed) ctx.setLineDash([5, 8])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

export default function LensLab() {
  const canvasRef = useRef()
  const ctxRef    = useRef()
  const sizeRef   = useRef({ W: 800, H: 480 })
  const renderRef = useRef(null)

  const [focalLength, setFocalLength] = useState(180)   // px (positive = converging)
  const [objectDist,  setObjectDist]  = useState(280)   // |do| in px from lens
  const [objHeight,   setObjHeight]   = useState(80)    // px (object arrow height)
  const [showLabels,  setShowLabels]  = useState(true)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx    = ctxRef.current
    if (!canvas || !ctx) return
    const { W, H } = sizeRef.current
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, W * dpr, H * dpr)
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#04090c'
    ctx.fillRect(0, 0, W, H)

    const cy  = H / 2          // optical axis y
    const lx  = W / 2          // lens x
    const f   = focalLength
    const do_ = objectDist
    const di  = f * do_ / (do_ - f)   // thin lens: 1/f = 1/do + 1/di  → di = f*do/(do-f)
    const m   = -di / do_             // magnification
    const oh  = objHeight
    const ih  = oh * Math.abs(m)      // image height (px)

    const objX = lx - do_
    const imgX = lx + di

    // ── Optical axis ──────────────────────────────────────────────────────
    ctx.save()
    ctx.setLineDash([4, 10])
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()
    ctx.restore()

    // ── Lens ──────────────────────────────────────────────────────────────
    drawLensSymbol(ctx, lx, cy, Math.min(H * 0.38, 150), f)

    // ── Focal points ─────────────────────────────────────────────────────
    ;[lx + f, lx - f].forEach((fx, i) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(fx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle   = 'rgba(150,200,255,0.65)'
      ctx.shadowBlur  = 8
      ctx.shadowColor = 'rgba(150,200,255,0.8)'
      ctx.fill()
      ctx.restore()
      if (showLabels) {
        ctx.save()
        ctx.fillStyle = 'rgba(150,200,255,0.45)'
        ctx.font = '9px JetBrains Mono'
        ctx.fillText(i === 0 ? 'F' : 'F\'', fx + 5, cy - 8)
        ctx.restore()
      }
    })

    // ── Object arrow ─────────────────────────────────────────────────────
    if (objX > 10 && objX < W - 10) {
      drawArrow(ctx, objX, cy, oh, 'rgba(255,255,255,0.80)')
    }

    // ── Principal rays ────────────────────────────────────────────────────
    const tipX = objX, tipY = cy - oh   // tip of object arrow (in world coords)

    // Ray 1: Parallel to axis → bends through focal point (F)
    const r1color = 'rgba(252,211,77,0.75)'
    // From tip, go parallel to axis until lens
    drawRayLine(ctx, tipX, tipY, lx, tipY, r1color)
    // After lens: goes through far focal point (lx + f, cy) or extension
    if (di !== Infinity && !isNaN(di)) {
      // Refracted ray from (lx, tipY) toward (lx+f, cy)
      const dx = lx + f - lx, dy = cy - tipY
      const len = Math.sqrt(dx * dx + dy * dy)
      const endX = lx + (dx / len) * 1200
      const endY = tipY + (dy / len) * 1200
      const isDiverging = f < 0
      drawRayLine(ctx, lx, tipY, endX, endY, r1color, false)
      // If virtual (diverging lens), draw dashed extension
      if (isDiverging) {
        drawRayLine(ctx, lx, tipY, lx - (dx / len) * 600, tipY - (dy / len) * 600, r1color, true)
      }
    }

    // Ray 2: Through center → straight (undeviated)
    const r2color = 'rgba(34,211,238,0.70)'
    const dx2 = lx - tipX, dy2 = cy - tipY
    const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
    drawRayLine(ctx, tipX, tipY, lx, cy, r2color)
    // Extend same direction
    drawRayLine(ctx, lx, cy, lx + (dx2 / l2) * 1000, cy + (dy2 / l2) * 1000, r2color)

    // Ray 3: Through front focal point → exits parallel
    const r3color = 'rgba(192,132,252,0.70)'
    // Goes from tip through front focal point (lx - f, cy) to lens
    const fxFront = lx - f, fyFront = cy
    const dx3 = lx - fxFront, dy3 = tipY - fyFront  // just proportional
    // Parametric: tip→frontF → extended to lens x
    // line through (tipX, tipY) and (fxFront, fyFront): x = tipX + t*(fxFront-tipX), y = tipY + t*(fyFront-tipY)
    // At x = lx: t = (lx - tipX)/(fxFront - tipX)  ... but if fxFront == tipX avoid division
    if (Math.abs(fxFront - tipX) > 1) {
      const tl = (lx - tipX) / (fxFront - tipX)
      const lyAtLens = tipY + tl * (fyFront - tipY)
      drawRayLine(ctx, tipX, tipY, lx, lyAtLens, r3color)
      // After lens: exits parallel to axis
      drawRayLine(ctx, lx, lyAtLens, W, lyAtLens, r3color)
    }

    // ── Image arrow ───────────────────────────────────────────────────────
    if (!isNaN(di) && Math.abs(di) < W && imgX > 5 && imgX < W - 5) {
      const isVirtual = di < 0
      // Image height: positive = erect, negative = inverted
      const imageH = oh * m  // m = -di/do (positive m = erect for virtual)
      const imgColor = isVirtual
        ? 'rgba(255,255,255,0.35)'
        : 'rgba(255,255,255,0.70)'
      drawArrow(ctx, imgX, cy, imageH, imgColor)
      if (isVirtual) {
        ctx.save()
        ctx.setLineDash([2, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.20)'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(imgX, cy); ctx.lineTo(imgX, cy - imageH); ctx.stroke()
        ctx.restore()
      }
      if (showLabels) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.30)'
        ctx.font = '9px JetBrains Mono'
        ctx.fillText(isVirtual ? 'IMAGE (virtual)' : 'IMAGE', imgX + 5, cy - imageH - 8)
        ctx.restore()
      }
    }

    // ── Dimension labels ─────────────────────────────────────────────────
    if (showLabels) {
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.20)'
      ctx.font = '9px JetBrains Mono'
      // do label
      if (objX > 10) {
        ctx.fillText(`dₒ`, objX + 5, cy + 16)
      }
      // |f| lines
      ctx.fillStyle = 'rgba(150,200,255,0.30)'
      ctx.fillText(`f`, lx + f / 2 - 4, cy + 16)
      ctx.restore()
    }

    ctx.restore()
  }, [focalLength, objectDist, objHeight, showLabels])

  useEffect(() => { renderRef.current = render }, [render])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ctxRef.current = canvas.getContext('2d')
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        const dpr = window.devicePixelRatio || 1
        canvas.width  = width  * dpr
        canvas.height = height * dpr
        sizeRef.current = { W: width, H: height }
        if (renderRef.current) renderRef.current()
      }
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { render() }, [render])

  // Compute derived quantities for display
  const f  = focalLength
  const do_ = objectDist
  const di  = f * do_ / (do_ - f)
  const m   = -di / do_
  const isVirtual = di < 0
  const isErect   = m > 0

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div style={{
        width: 230, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(252,211,77,0.1)',
        padding: '20px 18px', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ ...labelStyle, color: ACCENT, fontSize: 11, marginBottom: 4 }}>
          Thin Lens Lab
        </div>
        <div style={{ ...infoStyle, fontSize: 9, color: 'rgba(255,255,255,0.22)', marginBottom: 16 }}>
          Three principal rays trace the image location. Yellow: parallel→focal. Cyan: through center. Purple: through front focal→parallel.
        </div>

        <div style={labelStyle}>Focal Length</div>
        <input type="range" min={-300} max={300} step={10} value={focalLength}
          onChange={(e) => { const v = +e.target.value; setFocalLength(v === 0 ? 10 : v) }}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>f = {focalLength > 0 ? '+' : ''}{focalLength} px</div>

        <div style={labelStyle}>Object Distance (dₒ)</div>
        <input type="range" min={50} max={500} step={5} value={objectDist}
          onChange={(e) => setObjectDist(+e.target.value)}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>{objectDist} px</div>

        <div style={labelStyle}>Object Height</div>
        <input type="range" min={20} max={130} step={5} value={objHeight}
          onChange={(e) => setObjHeight(+e.target.value)}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>{objHeight} px</div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          marginBottom: 20,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
        }}>
          <input type="checkbox" checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            style={{ accentColor: ACCENT }} />
          Show Labels
        </label>

        {/* Live readout */}
        <div style={{
          borderTop: '1px solid rgba(252,211,77,0.12)',
          paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          <div style={{ color: ACCENT, fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
            Live Readout
          </div>
          {[
            ['1/f = 1/dₒ + 1/dᵢ', ''],
            ['dᵢ', isNaN(di) || !isFinite(di) ? '∞' : di.toFixed(1) + ' px'],
            ['m = −dᵢ/dₒ', isNaN(m) ? '—' : m.toFixed(3)],
            ['Image type', isVirtual ? 'Virtual' : 'Real'],
            ['Orientation', isErect ? 'Erect' : 'Inverted'],
          ].map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              letterSpacing: '0.08em',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>{k}</span>
              <span style={{ color: v ? ACCENT : 'rgba(255,255,255,0.12)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
