import { useRef, useEffect, useState, useCallback } from 'react'

const ACCENT = '#fcd34d'
const MAX_DEPTH = 8
const PI = Math.PI

// ── Math helpers ─────────────────────────────────────────────────────────────

function normalize(dx, dy) {
  const l = Math.sqrt(dx * dx + dy * dy)
  return l < 1e-12 ? [0, 0] : [dx / l, dy / l]
}

// Outward normal of segment AB (points left of A→B direction)
function segNormal(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  // Left perpendicular of (dx/len, dy/len) = (-dy/len, dx/len)
  return [-dy / len, dx / len]
}

// Ray-segment intersection parameter t (returns null if no hit)
function raySegT(ox, oy, dx, dy, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay
  const denom = dx * ey - dy * ex
  if (Math.abs(denom) < 1e-10) return null
  const t = ((ax - ox) * ey - (ay - oy) * ex) / denom
  const s = ((ax - ox) * dy - (ay - oy) * dx) / denom
  if (t > 1e-5 && s >= -1e-6 && s <= 1 + 1e-6) return t
  return null
}

// Snell's law refraction
// nx,ny: outward surface normal (pointing into medium 1 = incident side)
// Returns refracted direction or null (TIR)
function snellRefract(dx, dy, nx, ny, n1, n2) {
  const cosI = -(dx * nx + dy * ny)
  if (cosI < 0) {
    // Ray coming from wrong side — flip normal
    nx = -nx; ny = -ny
    const cosI2 = -(dx * nx + dy * ny)
    return snellRefractInner(dx, dy, nx, ny, n1, n2, cosI2)
  }
  return snellRefractInner(dx, dy, nx, ny, n1, n2, cosI)
}

function snellRefractInner(dx, dy, nx, ny, n1, n2, cosI) {
  const eta = n1 / n2
  const cosT2 = 1 - eta * eta * (1 - cosI * cosI)
  if (cosT2 < 0) return null  // TIR
  const cosT = Math.sqrt(cosT2)
  const [rx, ry] = normalize(
    eta * dx + (eta * cosI - cosT) * nx,
    eta * dy + (eta * cosI - cosT) * ny
  )
  return [rx, ry]
}

function reflectDir(dx, dy, nx, ny) {
  const dot = dx * nx + dy * ny
  return normalize(dx - 2 * dot * nx, dy - 2 * dot * ny)
}

// Wavelength (nm) → visual RGB (0-1 each)
function wlToRGB(wl) {
  let r, g, b
  if      (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; g = 0; b = 1 }
  else if (wl < 490)               { r = 0; g = (wl - 440) / 50; b = 1 }
  else if (wl < 510)               { r = 0; g = 1; b = -(wl - 510) / 20 }
  else if (wl < 580)               { r = (wl - 510) / 70; g = 1; b = 0 }
  else if (wl < 645)               { r = 1; g = -(wl - 645) / 65; b = 0 }
  else if (wl <= 750)              { r = 1; g = 0; b = 0 }
  else                             { r = 0; g = 0; b = 0 }
  const fac = wl < 420 ? 0.3 + 0.7 * (wl - 380) / 40
            : wl > 700 ? 0.3 + 0.7 * (750 - wl) / 50
            : 1
  return [
    Math.max(0, Math.min(1, r * fac)),
    Math.max(0, Math.min(1, g * fac)),
    Math.max(0, Math.min(1, b * fac)),
  ]
}

function wlToCSS(wl, alpha = 0.9) {
  const [r, g, b] = wlToRGB(wl)
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
}

// Cauchy refractive index for borosilicate glass (BK7-ish)
function cauchyN(wl, A = 1.5168, B = 4200) {
  // wl in nm, B in nm²
  return A + B / (wl * wl)
}

// ── Scene builders ─────────────────────────────────────────────────────────

// Each scene returns an array of "elements"
// element: { type, segs: [[ax,ay,bx,by], ...], n: refractive_index, normal_flip: bool }

function buildPrismScene(W, H, apexAngle, n) {
  const cx = W * 0.52, cy = H * 0.5
  const s  = Math.min(W, H) * 0.36       // side length
  const h  = s * Math.sqrt(3) / 2         // height of equilateral triangle

  // Apex pointing left, base on right (apex toward beam)
  const half = (apexAngle / 2) * PI / 180
  const bh   = s * Math.tan(half)         // half-height of base

  // Vertices
  const vApex = [cx - s * Math.cos(half),      cy]
  const vTop  = [cx + s * (1 - Math.cos(half)), cy - bh]
  const vBot  = [cx + s * (1 - Math.cos(half)), cy + bh]

  // Actually: simpler equilateral with apex at left
  // apex at (cx - h*2/3, cy), base-top at (cx + h/3, cy - s/2), base-bot at (cx + h/3, cy + s/2)
  const ax = cx - h * 0.55, ay = cy
  const tx = cx + h * 0.45, ty = cy - s * 0.5
  const bx = cx + h * 0.45, by = cy + s * 0.5

  return {
    verts: [[ax, ay], [tx, ty], [bx, by]],
    segs: [
      [ax, ay, tx, ty],   // top face
      [ax, ay, bx, by],   // bottom face
      [tx, ty, bx, by],   // right base
    ],
    n,
    cx: (ax + tx + bx) / 3,
    cy: (ay + ty + by) / 3,
  }
}

// ── Ray tracing ────────────────────────────────────────────────────────────

// Trace a single ray through a prism (with refraction)
// Returns array of {x1,y1,x2,y2,color,alpha}
function tracePrismRay(ox, oy, dx, dy, prism, wavelength) {
  const { segs, n } = prism
  const color  = wlToCSS(wavelength)
  const points = [[ox, oy]]
  let [cx, cy] = [ox, oy]
  let [cdx, cdy] = [dx, dy]
  let insideGlass = false

  for (let bounce = 0; bounce < MAX_DEPTH; bounce++) {
    let nearT = Infinity, nearSeg = null

    for (const [ax, ay, bx, by] of segs) {
      const t = raySegT(cx, cy, cdx, cdy, ax, ay, bx, by)
      if (t !== null && t < nearT) {
        nearT = t; nearSeg = [ax, ay, bx, by]
      }
    }

    if (!nearT || nearT === Infinity || nearT > 4000) {
      // Ray goes off screen
      const endX = cx + cdx * 1500
      const endY = cy + cdy * 1500
      points.push([endX, endY])
      break
    }

    const hitX = cx + cdx * nearT
    const hitY = cy + cdy * nearT
    points.push([hitX, hitY])

    const [ax, ay, bx, by] = nearSeg
    let [nx, ny] = segNormal(ax, ay, bx, by)

    // Determine which side of the face we're on
    const dot = cdx * nx + cdy * ny
    // Outward normal should oppose incoming ray
    if (dot > 0) { nx = -nx; ny = -ny }

    const n1 = insideGlass ? n : 1.0
    const n2 = insideGlass ? 1.0 : n

    const refr = snellRefract(cdx, cdy, nx, ny, n1, n2)
    if (refr) {
      ;[cdx, cdy] = refr
      insideGlass = !insideGlass
    } else {
      // TIR
      ;[cdx, cdy] = reflectDir(cdx, cdy, nx, ny)
    }

    cx = hitX + cdx * 0.5  // nudge past surface
    cy = hitY + cdy * 0.5
  }

  const segments = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ x1: points[i][0], y1: points[i][1], x2: points[i+1][0], y2: points[i+1][1], color })
  }
  return segments
}

function traceMirrorRay(ox, oy, dx, dy, mirrors, color) {
  const points = [[ox, oy]]
  let [cx, cy] = [ox, oy]
  let [cdx, cdy] = [dx, dy]

  for (let bounce = 0; bounce < MAX_DEPTH; bounce++) {
    let nearT = Infinity, nearSeg = null
    for (const [ax, ay, bx, by] of mirrors) {
      const t = raySegT(cx, cy, cdx, cdy, ax, ay, bx, by)
      if (t !== null && t < nearT) { nearT = t; nearSeg = [ax, ay, bx, by] }
    }

    if (nearT === Infinity || nearT > 3000) {
      points.push([cx + cdx * 1500, cy + cdy * 1500])
      break
    }

    const hitX = cx + cdx * nearT, hitY = cy + cdy * nearT
    points.push([hitX, hitY])

    const [ax, ay, bx, by] = nearSeg
    let [nx, ny] = segNormal(ax, ay, bx, by)
    if (cdx * nx + cdy * ny > 0) { nx = -nx; ny = -ny }
    ;[cdx, cdy] = reflectDir(cdx, cdy, nx, ny)
    cx = hitX + cdx * 0.5
    cy = hitY + cdy * 0.5
  }

  const segs = []
  for (let i = 0; i < points.length - 1; i++) {
    segs.push({ x1: points[i][0], y1: points[i][1], x2: points[i+1][0], y2: points[i+1][1], color })
  }
  return segs
}

function traceLensRay(ox, oy, dx, dy, lensX, lensF, W, H, color) {
  // Paraxial thin lens: at x=lensX, shift dy by -y/f
  const segs = []
  // 1. Travel to lens
  if (Math.abs(dx) < 1e-10) return segs
  const t1 = (lensX - ox) / dx
  if (t1 < 0) return segs
  const hitY = oy + dy * t1
  segs.push({ x1: ox, y1: oy, x2: lensX, y2: hitY, color })
  // 2. Apply lens: new dy = dy - hitY/f (paraxial, for dx normalized to 1)
  const newDy = dy - hitY / lensF
  const [ndx, ndy] = normalize(dx, newDy)
  // 3. Trace to screen edge
  const t2 = ndx > 0 ? (W - lensX) / ndx : (-lensX) / ndx
  segs.push({ x1: lensX, y1: hitY, x2: lensX + ndx * t2, y2: hitY + ndy * t2, color })
  return segs
}

// ── Draw helpers ──────────────────────────────────────────────────────────

function drawGlowLine(ctx, x1, y1, x2, y2, color, width = 1.5, blur = 8) {
  ctx.save()
  ctx.shadowBlur   = blur
  ctx.shadowColor  = color
  ctx.strokeStyle  = color
  ctx.lineWidth    = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

function drawPrism(ctx, prism) {
  const { verts } = prism
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(verts[0][0], verts[0][1])
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1])
  ctx.closePath()
  ctx.fillStyle   = 'rgba(150,200,255,0.07)'
  ctx.strokeStyle = 'rgba(150,200,255,0.45)'
  ctx.lineWidth   = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawMirrorSeg(ctx, ax, ay, bx, by) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.70)'
  ctx.lineWidth   = 3
  ctx.shadowBlur  = 5
  ctx.shadowColor = 'rgba(255,255,255,0.3)'
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
  // Hatch marks to indicate mirror backing
  const len = Math.sqrt((bx-ax)**2+(by-ay)**2)
  const nx = -(by-ay)/len, ny = (bx-ax)/len
  ctx.lineWidth = 1
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  for (let t = 0.05; t < 1; t += 0.08) {
    const mx = ax+(bx-ax)*t, my = ay+(by-ay)*t
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx+nx*8, my+ny*8); ctx.stroke()
  }
  ctx.restore()
}

function drawLens(ctx, lx, W, H, f) {
  const rad = Math.min(H * 0.35, 140)
  ctx.save()
  ctx.strokeStyle = 'rgba(150,200,255,0.55)'
  ctx.lineWidth   = 2
  ctx.shadowBlur  = 8
  ctx.shadowColor = 'rgba(150,200,255,0.4)'
  ctx.beginPath()
  ctx.moveTo(lx, H / 2 - rad)
  ctx.lineTo(lx, H / 2 + rad)
  ctx.stroke()
  // Arrows indicating converging/diverging
  const arrowDir = f > 0 ? 1 : -1
  const arr = (x, y, up) => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 8 * arrowDir, y + (up ? 10 : -10))
    ctx.moveTo(x, y)
    ctx.lineTo(x + 8 * arrowDir, y + (up ? 10 : -10))
    ctx.stroke()
  }
  arr(lx, H / 2 - rad, false)
  arr(lx, H / 2 + rad, true)
  // Focal points
  ;[lx + f, lx - f].forEach((fx) => {
    ctx.beginPath()
    ctx.arc(fx, H / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(150,200,255,0.6)'
    ctx.shadowBlur = 6
    ctx.shadowColor = 'rgba(150,200,255,0.8)'
    ctx.fill()
  })
  // Optical axis
  ctx.setLineDash([4, 8])
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

// ── Main component ────────────────────────────────────────────────────────

const SCENES = [
  { id: 'prism',  label: 'PRISM'   },
  { id: 'mirror', label: 'MIRRORS' },
  { id: 'lens',   label: 'LENS'    },
]

const sliderStyle = { width: '100%', accentColor: ACCENT }
const labelStyle  = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)', marginBottom: 5,
}
const valueStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
  color: ACCENT, marginBottom: 12,
}

export default function RayTracer() {
  const canvasRef   = useRef()
  const ctxRef      = useRef()
  const sizeRef     = useRef({ W: 800, H: 520 })

  const [scene,      setScene]      = useState('prism')
  const [prismN,     setPrismN]     = useState(1.52)
  const [dispersion, setDispersion] = useState(true)
  const [mirrorA,    setMirrorA]    = useState(45)
  const [mirrorB,    setMirrorB]    = useState(135)
  const [sourceY,    setSourceY]    = useState(0.5)  // 0-1 normalized
  const [lensF,      setLensF]      = useState(180)  // can be neg for diverging
  const [nRays,      setNRays]      = useState(64)

  // Store draggable source position for mirror scene
  const sourceRef = useRef({ x: 0.18, y: 0.5 })

  const renderRef = useRef(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx    = ctxRef.current
    if (!canvas || !ctx) return
    const { W, H } = sizeRef.current
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, W * dpr, H * dpr)
    ctx.save()
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#04090c'
    ctx.fillRect(0, 0, W, H)

    if (scene === 'prism') renderPrismScene(ctx, W, H)
    if (scene === 'mirror') renderMirrorScene(ctx, W, H)
    if (scene === 'lens')  renderLensScene(ctx, W, H)

    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, prismN, dispersion, mirrorA, mirrorB, sourceY, lensF, nRays])

  // Store render in ref for use inside resize observer
  useEffect(() => { renderRef.current = render }, [render])

  // ── Prism scene ──────────────────────────────────────────────────────────
  const renderPrismScene = useCallback((ctx, W, H) => {
    const prism = buildPrismScene(W, H, 60, prismN)
    drawPrism(ctx, prism)

    const nColors = dispersion ? 21 : 1
    const yStart  = H * 0.26, yEnd = H * 0.74
    const sourceX = W * 0.06

    for (let i = 0; i < nColors; i++) {
      const wl = dispersion
        ? 380 + (i / (nColors - 1)) * (720 - 380)
        : 550  // monochromatic green
      const n   = cauchyN(wl, prismN, 4200 * (prismN - 1) * 0.5)
      const yy  = yStart + (i / (nColors - 1)) * (yEnd - yStart)
      const pv  = { ...prism, n }
      const segs = tracePrismRay(sourceX, yy, 1, 0, pv, wl)
      const color = dispersion ? wlToCSS(wl, 0.85) : `rgba(255,255,255,0.7)`
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const { x1, y1, x2, y2 } of segs) {
        drawGlowLine(ctx, x1, y1, x2, y2, color, 1.5, 10)
      }
      ctx.restore()
    }

    // "Light in" arrow label
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '9px JetBrains Mono'
    ctx.letterSpacing = '0.1em'
    ctx.fillText('WHITE LIGHT →', W * 0.03, H * 0.18)
    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prismN, dispersion])

  // ── Mirror scene ─────────────────────────────────────────────────────────
  const renderMirrorScene = useCallback((ctx, W, H) => {
    const src = sourceRef.current
    const sx  = src.x * W, sy = src.y * H

    // Build mirrors from angles
    const mirLen = Math.min(W, H) * 0.28
    const toRad  = (deg) => deg * PI / 180

    const m1cx = W * 0.42, m1cy = H * 0.42
    const m2cx = W * 0.65, m2cy = H * 0.58
    const m3cx = W * 0.35, m3cy = H * 0.65

    const makeMirror = (cx, cy, angleDeg) => {
      const a = toRad(angleDeg)
      const hx = Math.cos(a) * mirLen / 2, hy = Math.sin(a) * mirLen / 2
      return [cx - hx, cy - hy, cx + hx, cy + hy]
    }

    const mirrors = [
      makeMirror(m1cx, m1cy, mirrorA),
      makeMirror(m2cx, m2cy, mirrorB),
      makeMirror(m3cx, m3cy, (mirrorA + mirrorB) / 2),
    ]

    mirrors.forEach(([ax, ay, bx, by]) => drawMirrorSeg(ctx, ax, ay, bx, by))

    // Source dot
    ctx.save()
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fcd34d'
    ctx.shadowBlur = 14; ctx.shadowColor = '#fcd34d'
    ctx.fill()
    ctx.restore()

    // Emit rays
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const count = Math.min(nRays, 80)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const [dx, dy] = [Math.cos(angle), Math.sin(angle)]
      const segs = traceMirrorRay(sx, sy, dx, dy, mirrors, `rgba(252,211,77,0.55)`)
      for (const { x1, y1, x2, y2, color } of segs) {
        drawGlowLine(ctx, x1, y1, x2, y2, color, 1.2, 8)
      }
    }
    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorA, mirrorB, nRays])

  // ── Lens scene ────────────────────────────────────────────────────────────
  const renderLensScene = useCallback((ctx, W, H) => {
    const lx = W * 0.50

    drawLens(ctx, lx, W, H, lensF)

    // Parallel beam from left at varying heights
    const beamCount = 20
    const ySpan     = H * 0.62
    const baseY     = H * 0.5
    const color     = 'rgba(252,211,77,0.70)'

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < beamCount; i++) {
      const t  = (i / (beamCount - 1)) - 0.5
      const oy = baseY + t * ySpan
      const segs = traceLensRay(0, oy, 1, 0, lx, lensF, W, H, color)
      for (const { x1, y1, x2, y2 } of segs) {
        drawGlowLine(ctx, x1, y1, x2, y2, color, 1.3, 7)
      }
    }
    ctx.restore()

    // Focal point labels
    const f = lensF
    ctx.save()
    ctx.fillStyle = 'rgba(150,200,255,0.45)'
    ctx.font = '9px JetBrains Mono'
    ;[lx + f, lx - f].forEach((fx, idx) => {
      if (fx > 10 && fx < W - 10) {
        ctx.fillText(idx === 0 ? `f = ${f.toFixed(0)}px` : `−f`, fx + 6, H / 2 - 8)
      }
    })
    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensF])

  // ── Canvas setup & resize ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx

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

  // Re-render on state change
  useEffect(() => { render() }, [render])

  // ── Mouse drag for mirror source ──────────────────────────────────────────
  const dragging = useRef(false)
  const handleMouseDown = useCallback((e) => {
    if (scene !== 'mirror') return
    dragging.current = true
    const rect = canvasRef.current.getBoundingClientRect()
    sourceRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
    render()
  }, [scene, render])

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current || scene !== 'mirror') return
    const rect = canvasRef.current.getBoundingClientRect()
    sourceRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
    render()
  }, [scene, render])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Canvas area */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: scene === 'mirror' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {scene === 'mirror' && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, pointerEvents: 'none',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.14em', color: 'rgba(255,255,255,0.22)',
          }}>
            CLICK / DRAG TO MOVE LIGHT SOURCE
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(252,211,77,0.1)',
        padding: '20px 18px',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Scene tabs */}
        <div style={labelStyle}>Scene</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {SCENES.map((s) => (
            <button key={s.id} onClick={() => setScene(s.id)} style={{
              flex: 1,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.12em',
              padding: '5px 0',
              background: scene === s.id ? 'rgba(252,211,77,0.14)' : 'transparent',
              border: `1px solid ${scene === s.id ? 'rgba(252,211,77,0.45)' : 'rgba(255,255,255,0.08)'}`,
              color: scene === s.id ? ACCENT : 'rgba(255,255,255,0.35)',
              borderRadius: 3, cursor: 'pointer',
            }}>{s.label}</button>
          ))}
        </div>

        {/* Prism controls */}
        {scene === 'prism' && (<>
          <div style={labelStyle}>Glass Index (n)</div>
          <input type="range" min={1.35} max={2.1} step={0.01} value={prismN}
            onChange={(e) => setPrismN(+e.target.value)} style={sliderStyle} />
          <div style={valueStyle}>n = {prismN.toFixed(2)}</div>

          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            marginBottom: 20,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>
            <input type="checkbox" checked={dispersion}
              onChange={(e) => setDispersion(e.target.checked)}
              style={{ accentColor: ACCENT }} />
            Dispersion (white light)
          </label>

          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.18)', lineHeight: 1.8,
            borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14,
          }}>
            <div style={{ color: ACCENT, marginBottom: 4 }}>DISPERSION</div>
            <div>n varies with λ (Cauchy):</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0' }}>n(λ) = A + B/λ²</div>
            <div>Violet bends more than red — each wavelength exits at a different angle.</div>
          </div>
        </>)}

        {/* Mirror controls */}
        {scene === 'mirror' && (<>
          <div style={labelStyle}>Mirror A angle</div>
          <input type="range" min={0} max={180} step={1} value={mirrorA}
            onChange={(e) => setMirrorA(+e.target.value)} style={sliderStyle} />
          <div style={valueStyle}>{mirrorA}°</div>

          <div style={labelStyle}>Mirror B angle</div>
          <input type="range" min={0} max={180} step={1} value={mirrorB}
            onChange={(e) => setMirrorB(+e.target.value)} style={sliderStyle} />
          <div style={valueStyle}>{mirrorB}°</div>

          <div style={labelStyle}>Ray count</div>
          <input type="range" min={8} max={80} step={4} value={nRays}
            onChange={(e) => setNRays(+e.target.value)} style={sliderStyle} />
          <div style={valueStyle}>{nRays}</div>

          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.18)', lineHeight: 1.8,
            borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14,
          }}>
            <div style={{ color: ACCENT, marginBottom: 4 }}>REFLECTION</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0' }}>
              θ_r = θ_i
            </div>
            <div>Angle of reflection equals angle of incidence (measured from normal).</div>
          </div>
        </>)}

        {/* Lens controls */}
        {scene === 'lens' && (<>
          <div style={labelStyle}>Focal Length</div>
          <input type="range" min={-300} max={300} step={10} value={lensF}
            onChange={(e) => {
              const v = +e.target.value
              setLensF(v === 0 ? 10 : v)
            }} style={sliderStyle} />
          <div style={valueStyle}>
            {lensF > 0 ? `f = +${lensF}` : `f = ${lensF}`} px
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'rgba(252,211,77,0.5)', marginBottom: 16, letterSpacing: '0.10em',
          }}>
            {lensF > 0 ? '▸ Converging lens' : '▸ Diverging lens'}
          </div>

          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.18)', lineHeight: 1.8,
            borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14,
          }}>
            <div style={{ color: ACCENT, marginBottom: 4 }}>THIN LENS</div>
            <div>Lensmaker's eq:</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0' }}>
              1/f = 1/dₒ + 1/dᵢ
            </div>
            <div>Positive f → rays converge. Negative f → rays diverge (virtual focal point behind lens).</div>
          </div>
        </>)}
      </div>
    </div>
  )
}
