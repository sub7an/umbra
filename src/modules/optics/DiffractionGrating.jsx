import { useRef, useEffect, useState, useCallback } from 'react'

const ACCENT = '#fcd34d'

// Wavelength → RGB for rendering the spectrum
function wlToRGB(wl) {
  let r, g, b
  if      (wl >= 380 && wl < 440) { r = -(wl-440)/60; g = 0; b = 1 }
  else if (wl < 490)               { r = 0; g = (wl-440)/50; b = 1 }
  else if (wl < 510)               { r = 0; g = 1; b = -(wl-510)/20 }
  else if (wl < 580)               { r = (wl-510)/70; g = 1; b = 0 }
  else if (wl < 645)               { r = 1; g = -(wl-645)/65; b = 0 }
  else if (wl <= 750)              { r = 1; g = 0; b = 0 }
  else                             { r = 0; g = 0; b = 0 }
  const fac = wl < 420 ? 0.3 + 0.7*(wl-380)/40 : wl > 700 ? 0.3 + 0.7*(750-wl)/50 : 1
  return [Math.max(0,Math.min(1,r*fac)), Math.max(0,Math.min(1,g*fac)), Math.max(0,Math.min(1,b*fac))]
}

// Multi-slit intensity: I(θ) = sinc²(β/2) * (sin(N*δ/2)/sin(δ/2))²
// β = 2π*a*sin(θ)/λ  (single slit diffraction envelope)
// δ = 2π*d*sin(θ)/λ  (multi-slit interference)
// a = slit width, d = slit spacing, N = number of slits, λ = wavelength
function intensity(sinTheta, a, d, N, lambda) {
  const beta  = Math.PI * a * sinTheta / lambda
  const delta = Math.PI * d * sinTheta / lambda
  const singleSlit = beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2
  let multiSlit
  if (Math.abs(Math.sin(delta)) < 1e-10) {
    multiSlit = N * N
  } else {
    multiSlit = (Math.sin(N * delta) / Math.sin(delta)) ** 2
  }
  return (singleSlit * multiSlit) / (N * N)  // normalize to 1
}

const labelStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)', marginBottom: 5,
}
const valueStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
  color: ACCENT, marginBottom: 12,
}

export default function DiffractionGrating() {
  const canvasRef = useRef()
  const ctxRef    = useRef()
  const sizeRef   = useRef({ W: 800, H: 500 })
  const renderRef = useRef(null)

  const [nSlits,    setNSlits]    = useState(2)       // 1–12
  const [slitWidth, setSlitWidth] = useState(0.3)     // a/d ratio (0.05–0.8)
  const [wavelength, setWavelength] = useState(550)   // nm, 380–720
  const [whiteLight, setWhiteLight] = useState(false) // show all wavelengths
  const [zoom,      setZoom]      = useState(1.0)

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

    const slitAreaH   = Math.round(H * 0.30)
    const patternAreaY = slitAreaH + 20
    const patternH    = H - patternAreaY - 12

    // ── Slit diagram ────────────────────────────────────────────────────────
    const slitD    = 36           // slit-to-slit spacing in px (for diagram)
    const slitA    = Math.round(slitD * slitWidth)
    const totalW   = (nSlits - 1) * slitD + slitA
    const startX   = W / 2 - totalW / 2

    // Barrier background
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, 0, W, slitAreaH)

    // Draw slits (gaps in barrier)
    for (let i = 0; i < nSlits; i++) {
      const sx = startX + i * slitD
      // Clear the slit gap
      ctx.clearRect(sx, 0, slitA, slitAreaH)
      ctx.fillStyle = 'rgba(4,9,12,1)'
      ctx.fillRect(sx, 0, slitA, slitAreaH)
      // Slit outline glow
      ctx.save()
      ctx.strokeStyle = ACCENT + '80'
      ctx.lineWidth = 1
      ctx.strokeRect(sx, 0, slitA, slitAreaH)
      ctx.restore()
    }

    // Barrier label
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = '9px JetBrains Mono'
    ctx.fillText(`${nSlits} SLIT${nSlits > 1 ? 'S' : ''} · a/d = ${slitWidth.toFixed(2)}`, 10, slitAreaH - 8)
    ctx.restore()

    // Separator line
    ctx.save()
    ctx.strokeStyle = 'rgba(252,211,77,0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    ctx.beginPath(); ctx.moveTo(0, slitAreaH + 10); ctx.lineTo(W, slitAreaH + 10); ctx.stroke()
    ctx.restore()

    // ── Intensity pattern ───────────────────────────────────────────────────
    const THETA_MAX = Math.PI / 2 * 0.8 / zoom   // angular range

    // For white light: render multiple wavelengths
    const wavelengths = whiteLight
      ? Array.from({ length: 24 }, (_, i) => 380 + (i / 23) * (720 - 380))
      : [wavelength]

    // Create ImageData for pattern
    const patImg = ctx.createImageData(W, patternH)
    const pd = patImg.data

    for (let xi = 0; xi < W; xi++) {
      const sinT = ((xi / (W - 1)) * 2 - 1) * Math.sin(THETA_MAX)
      const a = slitD * slitWidth  // slit width in units of d

      for (let wlIdx = 0; wlIdx < wavelengths.length; wlIdx++) {
        const wl  = wavelengths[wlIdx]
        // Normalize: slit spacing d = 1 (wavelength in units of d)
        const lambdaNorm = (wl / 550) * 0.18  // adjust scale to show several orders
        const I   = intensity(sinT, a, 1, nSlits, lambdaNorm)
        const [wr, wg, wb] = wlToRGB(wl)
        const bright = I * (whiteLight ? 0.55 : 1.0)

        // Draw a vertical bar of width 1 at xi across patternH
        for (let yi = 0; yi < patternH; yi++) {
          // Intensity envelope: brighter in center, fade toward edges
          const yFrac = Math.abs((yi / patternH) * 2 - 1)
          const envBright = bright * (1 - yFrac * 0.3)
          const idx = (yi * W + xi) * 4
          pd[idx]   = Math.min(255, pd[idx]   + wr * envBright * 255)
          pd[idx+1] = Math.min(255, pd[idx+1] + wg * envBright * 255)
          pd[idx+2] = Math.min(255, pd[idx+2] + wb * envBright * 255)
          pd[idx+3] = 255
        }
      }
    }
    ctx.putImageData(patImg, 0, patternAreaY)

    // Intensity line graph overlay
    if (!whiteLight) {
      const [wr, wg, wb] = wlToRGB(wavelength)
      const color = `rgba(${Math.round(wr*255)},${Math.round(wg*255)},${Math.round(wb*255)},0.8)`
      const a = slitD * slitWidth
      const lambdaNorm = (wavelength / 550) * 0.18

      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.5
      ctx.shadowBlur  = 6
      ctx.shadowColor = color
      ctx.beginPath()
      for (let xi = 0; xi < W; xi++) {
        const sinT = ((xi / (W - 1)) * 2 - 1) * Math.sin(THETA_MAX)
        const I    = intensity(sinT, a, 1, nSlits, lambdaNorm)
        const y    = patternAreaY + patternH * (1 - I * 0.95)
        xi === 0 ? ctx.moveTo(xi, y) : ctx.lineTo(xi, y)
      }
      ctx.stroke()
      ctx.restore()
    }

    // Axis labels
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.20)'
    ctx.font = '9px JetBrains Mono'
    ctx.fillText(`θ = 0°`, W / 2 - 14, H - 4)
    ctx.fillText(`+${(THETA_MAX * 180 / Math.PI).toFixed(0)}°`, W - 40, H - 4)
    ctx.fillText(`−${(THETA_MAX * 180 / Math.PI).toFixed(0)}°`, 4, H - 4)
    ctx.restore()

    ctx.restore()
  }, [nSlits, slitWidth, wavelength, whiteLight, zoom])

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

  // Wavelength → display color
  const [wr, wg, wb] = wlToRGB(wavelength)
  const wlColor = `rgb(${Math.round(wr*200+55)},${Math.round(wg*200+55)},${Math.round(wb*200+55)})`

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div style={{
        width: 230, flexShrink: 0,
        background: 'rgba(4,9,12,0.95)',
        borderLeft: '1px solid rgba(252,211,77,0.1)',
        padding: '20px 18px', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ ...labelStyle, color: ACCENT, fontSize: 11, marginBottom: 4 }}>
          Diffraction Grating
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.22)', lineHeight: 1.7, marginBottom: 16,
        }}>
          Far-field intensity: I(θ) = sinc²(β/2)·[sin(Nδ/2)/sin(δ/2)]²
        </div>

        {/* N slits */}
        <div style={labelStyle}>Number of Slits (N)</div>
        <input type="range" min={1} max={12} step={1} value={nSlits}
          onChange={(e) => setNSlits(+e.target.value)}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>N = {nSlits}</div>

        {/* Slit width */}
        <div style={labelStyle}>Slit Width (a/d)</div>
        <input type="range" min={0.05} max={0.9} step={0.05} value={slitWidth}
          onChange={(e) => setSlitWidth(+e.target.value)}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>{slitWidth.toFixed(2)}</div>

        {/* Wavelength */}
        {!whiteLight && (<>
          <div style={labelStyle}>Wavelength (λ)</div>
          <input type="range" min={380} max={720} step={5} value={wavelength}
            onChange={(e) => setWavelength(+e.target.value)}
            style={{ width: '100%', accentColor: wlColor }} />
          <div style={{ ...valueStyle, color: wlColor }}>{wavelength} nm</div>
        </>)}

        {/* White light toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
        }}>
          <input type="checkbox" checked={whiteLight}
            onChange={(e) => setWhiteLight(e.target.checked)}
            style={{ accentColor: ACCENT }} />
          White Light (all λ)
        </label>

        {/* Zoom */}
        <div style={labelStyle}>Angular Zoom</div>
        <input type="range" min={0.3} max={3.0} step={0.1} value={zoom}
          onChange={(e) => setZoom(+e.target.value)}
          style={{ width: '100%', accentColor: ACCENT }} />
        <div style={valueStyle}>{zoom.toFixed(1)}×</div>

        {/* Physics note */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.18)', lineHeight: 1.8,
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14,
        }}>
          <div style={{ color: ACCENT, marginBottom: 4 }}>GRATING EQUATION</div>
          <div style={{ color: 'rgba(255,255,255,0.40)', margin: '4px 0' }}>d·sin(θ) = m·λ</div>
          <div>Principal maxima at angles where path difference is an integer number of wavelengths. More slits → sharper peaks (better resolving power).</div>
        </div>
      </div>
    </div>
  )
}
