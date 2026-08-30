import { useState, useRef, useCallback, useEffect } from 'react'
import useModuleStore from '../store/useModuleStore'

// ── Palette interpolation ─────────────────────────────────────────────────────
const PALETTES = {
  plasma:  [[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],
  viridis: [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],
  magma:   [[0,0,4],[28,16,68],[120,28,109],[232,98,60],[252,253,191]],
  inferno: [[0,0,4],[40,11,84],[101,21,110],[196,65,56],[252,255,164]],
  cyan:    [[2,12,20],[0,60,80],[0,160,140],[0,229,196],[200,255,245]],
}

function sample(t, name) {
  const stops = PALETTES[name] || PALETTES.plasma
  const c = Math.max(0, Math.min(1, t))
  const n = stops.length - 1
  const i = Math.min(Math.floor(c * n), n - 1)
  const f = c * n - i
  const [r1,g1,b1] = stops[i], [r2,g2,b2] = stops[Math.min(i+1,n)]
  return [r1+f*(r2-r1), g1+f*(g2-g1), b1+f*(b2-b1)]
}

// ── Physics functions ─────────────────────────────────────────────────────────

function tunnelingT(V0, k0) {
  const E = k0 * k0
  if (V0 <= 0) return 1
  if (E < 1e-9) return 0
  if (Math.abs(E - V0) < 1e-6) return 4*E / (4*E + V0*V0)
  if (E < V0) {
    const kp = Math.sqrt(V0 - E)
    if (kp > 18) return 0
    const sh = Math.sinh(kp)
    return 1 / (1 + V0*V0 * sh*sh / (4*E*(V0-E)))
  }
  const kp = Math.sqrt(E - V0)
  const s = Math.sin(kp)
  const denom = 4*E*(E-V0)
  if (denom < 1e-9) return 1
  return 1 / (1 + V0*V0 * s*s / denom)
}

function lorenzRK4(x,y,z,s,r,b,dt) {
  const f=(x,y,z)=>[s*(y-x), x*(r-z)-y, x*y-b*z]
  const [a1,b1,c1]=f(x,y,z)
  const [a2,b2,c2]=f(x+a1*dt/2, y+b1*dt/2, z+c1*dt/2)
  const [a3,b3,c3]=f(x+a2*dt/2, y+b2*dt/2, z+c2*dt/2)
  const [a4,b4,c4]=f(x+a3*dt,   y+b3*dt,   z+c3*dt)
  return [x+dt*(a1+2*a2+2*a3+a4)/6, y+dt*(b1+2*b2+2*b3+b4)/6, z+dt*(c1+2*c2+2*c3+c4)/6]
}

function lorenzChaos(sigma, rho) {
  if (sigma <= 0 || rho <= 0) return 0
  const beta = 8/3, dt = 0.015
  let [x,y,z] = [0.1, 0.1, 0.1]
  const vals = []
  for (let i = 0; i < 500; i++) {
    ;[x,y,z] = lorenzRK4(x,y,z,sigma,rho,beta,dt)
    if (i > 300) vals.push(x)
  }
  const range = Math.max(...vals) - Math.min(...vals)
  return Math.min(range / 40, 1)
}

function grOrbit(M, r) {
  if (M <= 0 || r <= 0) return 0
  const rs = 2*M
  if (r <= rs)         return 0          // inside event horizon
  if (r <= 3*M)        return 0.15       // photon sphere (no stable orbit)
  if (r <= 6*M)        return 0.42       // unstable massive-particle orbits
  const frac = Math.min(1, (r-6*M)/(40*M))
  return 0.55 + 0.45*frac               // stable orbits → brighter with distance
}

function maxwellBoltzmann(T, E) {
  if (T <= 0 || E < 0) return 0
  const norm = 2 / (Math.sqrt(Math.PI) * Math.pow(T, 1.5))
  return Math.min(norm * Math.sqrt(E) * Math.exp(-E/T) * 2.5, 1)
}

function twinProperTime(b1, b2) {
  const g1 = Math.sqrt(Math.max(0, 1 - b1*b1))
  const g2 = Math.sqrt(Math.max(0, 1 - b2*b2))
  return (g1 + g2) / 2
}

function fresnelT(n1, thetaDeg) {
  const n2 = 1.5
  const ti = thetaDeg * Math.PI / 180
  const sinT = n1 * Math.sin(ti) / n2
  if (Math.abs(sinT) > 1) return 0  // total internal reflection
  const tt = Math.asin(sinT)
  const cos_i = Math.cos(ti), cos_t = Math.cos(tt)
  const rs = Math.pow((n1*cos_i - n2*cos_t)/(n1*cos_i + n2*cos_t), 2)
  const rp = Math.pow((n2*cos_i - n1*cos_t)/(n2*cos_i + n1*cos_t), 2)
  return 1 - (rs + rp) / 2
}

// ── Module configurations ─────────────────────────────────────────────────────
const CONFIGS = {
  'quantum-mechanics': {
    title: 'TUNNELING LANDSCAPE',
    subtitle: 'Transmission probability · barrier height × incident momentum',
    xLabel: 'Barrier height V₀',  xMin: 0.2, xMax: 6.0,
    yLabel: 'Incident momentum k₀', yMin: 0.2, yMax: 4.0,
    metricLabel: 'T(V₀, k₀)',
    fn: tunnelingT,
    palette: 'plasma',
    boundary: { label: 'E = V₀ (k₀² = V₀)', fn: (x) => Math.sqrt(x) }, // y = √x
    getX: s => s.qm?.tunnelV0 ?? 3,
    getY: s => s.qm?.tunnelK0 ?? 2,
    setX: v => useModuleStore.getState().setTunnelV0(v),
    setY: v => useModuleStore.getState().setTunnelK0(v),
  },
  'dynamical-systems': {
    title: 'LORENZ CHAOS BOUNDARY',
    subtitle: 'Chaos intensity · σ (Prandtl) × ρ (Rayleigh) · β = 8/3',
    xLabel: 'σ — Prandtl number', xMin: 0.5, xMax: 25,
    yLabel: 'ρ — Rayleigh number', yMin: 0.5, yMax: 50,
    metricLabel: 'Chaos intensity',
    fn: lorenzChaos,
    palette: 'magma',
    getX: () => 10,
    getY: () => 28,
    setX: null,
    setY: null,
  },
  'general-relativity': {
    title: 'GEODESIC PHASE MAP',
    subtitle: 'Orbit classification · central mass × orbital radius · G = c = 1',
    xLabel: 'Central mass M', xMin: 0.2, xMax: 5,
    yLabel: 'Orbital radius r', yMin: 0.5, yMax: 32,
    metricLabel: 'Orbit stability',
    fn: grOrbit,
    palette: 'viridis',
    getX: s => s.gr?.mass ?? 2,
    getY: () => 10,
    setX: v => useModuleStore.getState().setGrMass(v),
    setY: null,
  },
  'thermodynamics': {
    title: 'MAXWELL-BOLTZMANN MAP',
    subtitle: 'Probability density f(E,T) · temperature × particle energy',
    xLabel: 'Temperature T',     xMin: 0.1, xMax: 3.0,
    yLabel: 'Particle energy E', yMin: 0.0, yMax: 8.0,
    metricLabel: 'f(E, T)',
    fn: maxwellBoltzmann,
    palette: 'inferno',
    getX: s => s.thermo?.temperature ?? 1,
    getY: () => 1,
    setX: v => useModuleStore.getState().setThermoTemp(v),
    setY: null,
  },
  'special-relativity': {
    title: 'TWIN PARADOX DIAGRAM',
    subtitle: 'Proper time fraction · outbound velocity × return velocity',
    xLabel: 'Outbound β₁', xMin: 0, xMax: 0.99,
    yLabel: 'Return β₂',   yMin: 0, yMax: 0.99,
    metricLabel: 'τ/T (proper/coord)',
    fn: twinProperTime,
    palette: 'cyan',
    getX: s => s.sr?.velocity ?? 0.5,
    getY: s => s.sr?.velocity ?? 0.5,
    setX: v => useModuleStore.getState().setSrVelocity(v),
    setY: null,
  },
  'optics': {
    title: 'FRESNEL PHASE MAP',
    subtitle: 'Transmittance · refractive index × incidence angle · n₂ = 1.5',
    xLabel: 'Incident n₁', xMin: 1.0, xMax: 2.5,
    yLabel: 'Angle θᵢ (°)', yMin: 0, yMax: 90,
    metricLabel: 'Transmittance T',
    fn: fresnelT,
    palette: 'cyan',
    getX: () => 1.0,
    getY: () => 30,
    setX: null,
    setY: null,
  },
}

const RES = 56  // grid resolution (RES × RES)

// ── Component ─────────────────────────────────────────────────────────────────
export default function PhaseDiagram() {
  const store = useModuleStore()
  const moduleId = store.activeModule ?? 'physics-sandbox'
  const cfg = CONFIGS[moduleId]

  const [open, setOpen]       = useState(false)
  const [state, setState]     = useState('idle') // idle | computing | done
  const [tooltip, setTooltip] = useState(null)   // { x, y, val }

  const heatRef  = useRef()   // heatmap canvas
  const overRef  = useRef()   // overlay canvas (crosshair + boundary)
  const gridRef  = useRef(null)
  const abortRef = useRef(false)

  // ── Compute ──────────────────────────────────────────────────────────────────
  const compute = useCallback(async () => {
    if (!cfg || state === 'computing') return
    abortRef.current = false
    setState('computing')
    gridRef.current = null

    const grid = new Float32Array(RES * RES)
    let minV = Infinity, maxV = -Infinity

    for (let j = 0; j < RES; j++) {
      if (abortRef.current) { setState('idle'); return }
      for (let i = 0; i < RES; i++) {
        const xv = cfg.xMin + (i / (RES-1)) * (cfg.xMax - cfg.xMin)
        const yv = cfg.yMin + (j / (RES-1)) * (cfg.yMax - cfg.yMin)
        const v  = cfg.fn(xv, yv)
        grid[j * RES + i] = v
        if (v < minV) minV = v
        if (v > maxV) maxV = v
      }
      if (j % 6 === 5) await new Promise(r => setTimeout(r, 0))
    }

    gridRef.current = { grid, minV, maxV }
    renderHeat()
    renderOverlay()
    setState('done')
  }, [cfg, state])

  // ── Render heatmap ────────────────────────────────────────────────────────
  const renderHeat = useCallback(() => {
    const c = heatRef.current
    if (!c || !gridRef.current || !cfg) return
    const { grid, minV, maxV } = gridRef.current
    c.width = RES; c.height = RES
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(RES, RES)
    const range = maxV - minV || 1
    for (let i = 0; i < grid.length; i++) {
      const t  = (grid[i] - minV) / range
      const [r,g,b] = sample(t, cfg.palette)
      img.data[i*4]   = r; img.data[i*4+1] = g
      img.data[i*4+2] = b; img.data[i*4+3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [cfg])

  // ── Render overlay (crosshair + boundary curve) ───────────────────────────
  const renderOverlay = useCallback(() => {
    const c = overRef.current
    if (!c || !cfg) return
    const W = c.width, H = c.height
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    const s = useModuleStore.getState()
    const cx = cfg.getX(s), cy = cfg.getY(s)
    const px = ((cx - cfg.xMin) / (cfg.xMax - cfg.xMin)) * W
    const py = ((cy - cfg.yMin) / (cfg.yMax - cfg.yMin)) * H

    // Crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(px, 0); ctx.lineTo(px, H)
    ctx.moveTo(0, py); ctx.lineTo(W, py)
    ctx.stroke()
    ctx.setLineDash([])

    // Dot at current position
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI*2)
    ctx.fill()

    // Physics boundary curve (e.g., E = V₀ for QM)
    if (cfg.boundary) {
      ctx.strokeStyle = 'rgba(0,229,196,0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (let i = 0; i <= W; i++) {
        const xv = cfg.xMin + (i/W) * (cfg.xMax - cfg.xMin)
        const yv = cfg.boundary.fn(xv)
        if (yv < cfg.yMin || yv > cfg.yMax) { started = false; continue }
        const bx = i
        const by = ((yv - cfg.yMin) / (cfg.yMax - cfg.yMin)) * H
        if (!started) { ctx.moveTo(bx, by); started = true }
        else ctx.lineTo(bx, by)
      }
      ctx.stroke()
    }
  }, [cfg])

  // Re-render overlay when store changes (crosshair tracks sim)
  useEffect(() => {
    if (state !== 'done') return
    const unsub = useModuleStore.subscribe(() => renderOverlay())
    return unsub
  }, [state, renderOverlay])

  // Reset on module change
  useEffect(() => {
    abortRef.current = true
    setState('idle')
    gridRef.current = null
    setTooltip(null)
  }, [moduleId])

  // ── Mouse interaction ────────────────────────────────────────────────────
  const toParams = useCallback((e) => {
    if (!overRef.current) return null
    const r = overRef.current.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top)  / r.height
    const xv = cfg.xMin + fx * (cfg.xMax - cfg.xMin)
    const yv = cfg.yMin + fy * (cfg.yMax - cfg.yMin)
    return { xv, yv, fx, fy }
  }, [cfg])

  const handleClick = useCallback((e) => {
    if (!cfg || state !== 'done') return
    const p = toParams(e)
    if (!p) return
    if (cfg.setX) cfg.setX(Math.max(cfg.xMin, Math.min(cfg.xMax, p.xv)))
    if (cfg.setY) cfg.setY(Math.max(cfg.yMin, Math.min(cfg.yMax, p.yv)))
    renderOverlay()
  }, [cfg, state, toParams, renderOverlay])

  const handleMove = useCallback((e) => {
    if (!cfg || state !== 'done' || !gridRef.current) return
    const p = toParams(e)
    if (!p) return
    const ix = Math.round(p.fx * (RES-1))
    const iy = Math.round(p.fy * (RES-1))
    const idx = Math.max(0,Math.min(RES-1,iy)) * RES + Math.max(0,Math.min(RES-1,ix))
    const val = gridRef.current.grid[idx] ?? 0
    setTooltip({ xv: p.xv, yv: p.yv, val })
  }, [cfg, state, toParams])

  const handleLeave = () => setTooltip(null)

  // ── Collapsed toggle ──────────────────────────────────────────────────────
  const accentColor = cfg ? 'rgba(0,229,196,0.6)' : 'rgba(255,255,255,0.15)'

  return (
    <div style={{ borderTop: '1px solid rgba(0,229,196,0.06)', background: 'rgba(1,6,12,0.97)', flexShrink: 0 }}>
      {/* Toggle bar */}
      <button
        onClick={() => cfg && setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 14px', background:'none', border:'none',
          cursor: cfg ? 'pointer' : 'default',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <svg width="9" height="9" viewBox="0 0 10 10">
            <polygon points="5,1 9,3.5 9,6.5 5,9 1,6.5 1,3.5"
              fill="none" stroke={accentColor} strokeWidth="1.2" />
          </svg>
          <span style={{
            fontFamily:'JetBrains Mono,monospace', fontSize:8,
            letterSpacing:'.2em', color: accentColor, userSelect:'none',
          }}>
            PHASE DIAGRAM{!cfg ? ' — N/A' : ''}
          </span>
        </div>
        {cfg && (
          <svg width="9" height="6" viewBox="0 0 10 6"
            style={{ color: accentColor, transform: open ? 'rotate(0)' : 'rotate(180deg)', transition:'transform .2s' }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        )}
      </button>

      {open && cfg && (
        <div style={{ padding:'0 14px 14px' }}>

          {/* Title */}
          <p style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9,
            letterSpacing:'.18em', color:'rgba(0,229,196,0.9)', margin:'0 0 3px' }}>
            {cfg.title}
          </p>
          <p style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8,
            color:'rgba(255,255,255,0.3)', margin:'0 0 10px', lineHeight:1.5 }}>
            {cfg.subtitle}
          </p>

          {/* Compute button */}
          {state !== 'done' && (
            <button
              onClick={compute}
              disabled={state === 'computing'}
              style={{
                width:'100%', padding:'7px', marginBottom:10,
                background: state === 'computing' ? 'rgba(0,229,196,0.06)' : 'rgba(0,229,196,0.09)',
                border:'1px solid rgba(0,229,196,0.25)',
                color:'rgba(0,229,196,0.9)', fontFamily:'JetBrains Mono,monospace',
                fontSize:9, letterSpacing:'.2em', cursor: state === 'computing' ? 'default' : 'pointer',
                borderRadius:2, transition:'all .15s',
              }}
            >
              {state === 'computing' ? '◌  COMPUTING…' : '◈  COMPUTE FIELD'}
            </button>
          )}

          {/* Canvas area */}
          {(state === 'computing' || state === 'done') && (
            <div style={{ position:'relative', width:'100%', paddingBottom:'100%', background:'#010914', borderRadius:3, overflow:'hidden' }}>

              {/* Heatmap canvas */}
              <canvas ref={heatRef}
                width={RES} height={RES}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', imageRendering:'auto' }}
              />

              {/* Overlay canvas (crosshair, boundary) */}
              <canvas ref={overRef}
                width={200} height={200}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                onClick={handleClick}
                style={{
                  position:'absolute', inset:0, width:'100%', height:'100%',
                  cursor: (cfg.setX || cfg.setY) && state === 'done' ? 'crosshair' : 'default',
                }}
              />

              {/* Axis labels */}
              <div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)',
                fontFamily:'JetBrains Mono,monospace', fontSize:7, color:'rgba(255,255,255,0.4)',
                letterSpacing:'.1em', pointerEvents:'none', whiteSpace:'nowrap' }}>
                {cfg.xLabel}
              </div>
              <div style={{ position:'absolute', top:'50%', left:-2, transform:'translateY(-50%) rotate(-90deg)',
                fontFamily:'JetBrains Mono,monospace', fontSize:7, color:'rgba(255,255,255,0.4)',
                letterSpacing:'.1em', pointerEvents:'none', whiteSpace:'nowrap', transformOrigin:'left center' }}>
                {cfg.yLabel}
              </div>

              {/* Corner values */}
              <span style={{ position:'absolute', top:3, left:4, fontFamily:'JetBrains Mono,monospace',
                fontSize:7, color:'rgba(255,255,255,0.25)', pointerEvents:'none' }}>
                {cfg.yMax.toFixed(1)}
              </span>
              <span style={{ position:'absolute', bottom:14, left:4, fontFamily:'JetBrains Mono,monospace',
                fontSize:7, color:'rgba(255,255,255,0.25)', pointerEvents:'none' }}>
                {cfg.yMin.toFixed(1)}
              </span>
              <span style={{ position:'absolute', bottom:14, left:4, fontFamily:'JetBrains Mono,monospace',
                fontSize:7, color:'rgba(255,255,255,0.25)', pointerEvents:'none',
                transform:'translateX(0)' }}>
              </span>

              {/* Computing overlay */}
              {state === 'computing' && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                  justifyContent:'center', background:'rgba(1,6,12,0.75)' }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9,
                    color:'rgba(0,229,196,0.7)', letterSpacing:'.2em',
                    animation:'umbra-pulse 1.2s ease-in-out infinite' }}>
                    COMPUTING…
                  </span>
                </div>
              )}

              {/* Tooltip */}
              {tooltip && state === 'done' && (
                <div style={{
                  position:'absolute', top:5, right:5, background:'rgba(1,6,12,0.92)',
                  border:'1px solid rgba(0,229,196,0.2)', borderRadius:2,
                  padding:'4px 7px', pointerEvents:'none',
                }}>
                  <p style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8,
                    color:'rgba(0,229,196,0.9)', margin:0, lineHeight:1.8 }}>
                    x: {tooltip.xv.toFixed(3)}<br/>
                    y: {tooltip.yv.toFixed(3)}<br/>
                    <span style={{ color:'rgba(248,149,64,0.9)' }}>
                      {cfg.metricLabel}: {tooltip.val.toFixed(4)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Legend + recompute */}
          {state === 'done' && (
            <div style={{ marginTop:8 }}>
              {/* Color scale */}
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:7,
                  color:'rgba(255,255,255,0.3)' }}>0</span>
                <div style={{
                  flex:1, height:5, borderRadius:2,
                  background: `linear-gradient(to right, ${
                    PALETTES[cfg.palette].map((c,i,a) =>
                      `rgb(${c.join(',')}) ${(i/(a.length-1)*100).toFixed(0)}%`
                    ).join(', ')
                  })`,
                }} />
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:7,
                  color:'rgba(255,255,255,0.3)' }}>1</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:7,
                  color:'rgba(255,255,255,0.25)', letterSpacing:'.1em' }}>
                  {cfg.metricLabel}
                  {(cfg.setX || cfg.setY) && ' · click to set'}
                </span>
                <button onClick={() => setState('idle')} style={{
                  background:'none', border:'none', fontFamily:'JetBrains Mono,monospace',
                  fontSize:7, color:'rgba(0,229,196,0.4)', cursor:'pointer', letterSpacing:'.1em',
                }}>
                  ↺ RECOMPUTE
                </button>
              </div>
              {cfg.boundary && (
                <p style={{ fontFamily:'JetBrains Mono,monospace', fontSize:7,
                  color:'rgba(0,229,196,0.5)', margin:'5px 0 0', letterSpacing:'.08em' }}>
                  ─── {cfg.boundary.label}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
