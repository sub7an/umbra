import { useEffect, useRef, useCallback, useState } from 'react'
import { useGesture } from '../context/GestureContext'

// ── PENUMBRA palette — eclipse / deep-space ───────────────────────────────────
// Penumbra: the partial shadow surrounding the umbra of an eclipse.
// Primary = deep-space cyan · Accent = solar corona gold · Shadow = umbra violet

const P_CYAN   = '#00D4FF'   // deep space cyan
const P_GOLD   = '#FFD166'   // solar corona gold
const P_PURPLE = '#9B5CF6'   // umbra shadow violet
const P_WHITE  = '#F0F6FF'   // starlight
const P_EMBER  = '#FF6B35'   // coronal mass ejection
const P_DIM    = 'rgba(0,180,220,0.18)'
const P_BG     = 'rgba(0,2,10,0.94)'  // deep space black

// ── Constants ─────────────────────────────────────────────────────────────────

const PALM_HOLD_MS      = 820
const TRAIL_LEN         = 11
const TIP_TRAIL_LEN     = 36
const ECHO_FRAMES       = 6
const PARTICLE_CNT      = 70
const LOG_MAX           = 6
const PINCH_TENSION_THR = 0.21
const NEBULA_COLORS = [P_CYAN, '#4499FF', P_PURPLE, '#6644FF', '#00AACC', '#BB66FF']

// ── Skeleton config — constellation aesthetic ─────────────────────────────────

const CON_SEGS = [
  { color: 'rgba(160,200,255,0.28)', pairs: [[0,1],[0,5],[5,9],[9,13],[13,17],[0,17]] },
  { color: '#88AAFF', pairs: [[1,2],[2,3],[3,4]] },
  { color: P_CYAN,   pairs: [[5,6],[6,7],[7,8]] },
  { color: '#3399FF', pairs: [[9,10],[10,11],[11,12]] },
  { color: P_PURPLE, pairs: [[13,14],[14,15],[15,16]] },
  { color: '#AACCFF', pairs: [[17,18],[18,19],[19,20]] },
]
const TIP_COLORS_MAP = { 4:'#AABBFF', 8:P_CYAN, 12:'#3399FF', 16:P_PURPLE, 20:'#AACCFF' }
const TIP_INDICES    = [4, 8, 12, 16, 20]
const TIP_COLOR_ARR  = ['#AABBFF', P_CYAN, '#3399FF', P_PURPLE, '#AACCFF']

// Landmark "magnitude" — larger = brighter star
const LM_MAG = {
  0: 2.5, 5: 1.8, 9: 1.8, 13: 1.8, 17: 1.8,
  4: 2.8, 8: 3.0, 12: 2.8, 16: 2.5, 20: 2.5,
}

const GESTURE_COLORS = {
  idle:      P_DIM,
  pointing:  P_CYAN,
  pinching:  P_WHITE,
  peace:     '#4499FF',
  fist:      P_EMBER,
  open_palm: P_PURPLE,
  thumbsup:  '#44DDAA',
  twopinch:  P_GOLD,
}

const STATUS_LABEL = {
  idle:      'DORMANT',
  pointing:  'TRACKING',
  pinching:  'ENGAGING',
  peace:     'ORBIT MODE',
  fist:      'RESET',
  open_palm: 'RETURNING',
  thumbsup:  'GUIDE',
  twopinch:  'ECLIPSE ZOOM',
}

const STATUS_TO_GUIDE = {
  pointing: 'point', pinching: 'pinch', peace: 'peace',
  fist: 'fist', open_palm: 'hold', thumbsup: 'thumbup',
  twopinch: 'twopinch', idle: null,
}

const GUIDE_ROWS = [
  ['👆', 'Point',   'aim cursor',    'point'],
  ['🤏', 'Pinch',   'select · drag', 'pinch'],
  ['✌️', 'Peace',   'orbit scene',   'peace'],
  ['✊', 'Fist',    'reset sim',     'fist'],
  ['🖐', 'Hold 1s', '← back',        'hold'],
  ['⚡', 'Swipe',   'change view',   'swipe'],
  ['👍', 'Thumb',   'hide guide',    'thumbup'],
  ['🤲', '2 Hands', 'eclipse zoom',  'twopinch'],
]

const CONF_BARS = [
  { key: 'pinch',   label: 'ENGAGE', color: P_CYAN   },
  { key: 'peace',   label: 'ORBIT',  color: '#4499FF' },
  { key: 'fist',    label: 'RESET',  color: P_EMBER  },
  { key: 'palm',    label: 'RETURN', color: P_PURPLE },
  { key: 'thumbup', label: 'GUIDE',  color: '#44DDAA' },
]

const PENUMBRA_TOKENS = [
  'KINEMATIC', 'UMBRA·REF', 'CORONA·OK', 'TRACKING',
  'PHASE·LOCK', 'ECLIPSE·ON', 'SHADOW·MAP', 'DEPTH·SYNC',
  'PENUMBRA', 'LIMINAL', 'STELLAR·OK', 'AETHER',
  'CORONA·ARC', 'NEXUS·ACK', 'VECTOR·V', 'ALIGN',
]

// ── Utility ───────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
}

function lmsSnapshot(lms) {
  return lms ? lms.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })) : null
}

function star(ctx, x, y, r, pts = 4) {
  ctx.beginPath()
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2
    const d = i % 2 === 0 ? r : r * 0.35
    i === 0 ? ctx.moveTo(x + Math.cos(a)*d, y + Math.sin(a)*d)
            : ctx.lineTo(x + Math.cos(a)*d, y + Math.sin(a)*d)
  }
  ctx.closePath()
}

// ── Perspective radar grid ────────────────────────────────────────────────────

function drawRadarGrid(ctx, W, H, t) {
  const vpX = W / 2, vpY = H * 0.55
  ctx.save()
  ctx.strokeStyle = P_PURPLE; ctx.lineWidth = 0.4

  // Radial spokes
  const spokes = 24
  for (let i = 0; i < spokes; i++) {
    const ang = (i / spokes) * Math.PI * 2
    ctx.globalAlpha = 0.025
    ctx.beginPath(); ctx.moveTo(vpX, vpY)
    ctx.lineTo(vpX + Math.cos(ang) * W, vpY + Math.sin(ang) * W)
    ctx.stroke()
  }

  // Concentric ellipses
  for (let r = 0; r < 5; r++) {
    const rad = 120 + r * 110
    ctx.globalAlpha = 0.018 + Math.sin(t * 0.4 + r * 0.8) * 0.006
    ctx.beginPath(); ctx.ellipse(vpX, vpY, rad, rad * 0.38, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = 1; ctx.restore()
}

// ── Precision scan sweep ──────────────────────────────────────────────────────

function drawScanSweep(ctx, W, H, t) {
  const y = ((t / 8) % 1) * H
  ctx.save()

  // Trailing gradient (umbra shadow above)
  const g = ctx.createLinearGradient(0, y - 80, 0, y)
  g.addColorStop(0, 'rgba(0,100,180,0)')
  g.addColorStop(1, 'rgba(0,130,200,0.03)')
  ctx.fillStyle = g; ctx.fillRect(0, y - 80, W, 80)

  // Sharp edge line
  ctx.globalAlpha = 0.20; ctx.strokeStyle = P_GOLD; ctx.lineWidth = 0.8
  ctx.setLineDash([10, 8])
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  ctx.setLineDash([])

  // Edge ticks
  ctx.globalAlpha = 0.45; ctx.strokeStyle = P_CYAN; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(22, y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - 22, y); ctx.lineTo(W, y); ctx.stroke()

  ctx.globalAlpha = 1; ctx.restore()
}

// ── Deep space nebula particles ───────────────────────────────────────────────

function initParticles(W, H) {
  return Array.from({ length: PARTICLE_CNT }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
    r: 0.5 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
    color: NEBULA_COLORS[i % NEBULA_COLORS.length],
    twinkle: 0.8 + Math.random() * 1.8,
  }))
}

function tickParticles(ctx, particles, W, H, lms, status, t) {
  const pointing = status === 'pointing', fisting = status === 'fist'
  const attX = (pointing && lms?.[8]) ? (1 - lms[8].x) * W : null
  const attY = (pointing && lms?.[8]) ? lms[8].y * H       : null
  const repX = (fisting  && lms?.[9]) ? (1 - lms[9].x) * W : null
  const repY = (fisting  && lms?.[9]) ? lms[9].y * H       : null
  ctx.save()
  for (const p of particles) {
    if (attX !== null) {
      const dx = attX - p.x, dy = attY - p.y, d = Math.hypot(dx, dy) + 1
      if (d < 260) { const f = 0.08 * (1 - d / 260); p.vx += dx/d*f; p.vy += dy/d*f }
    }
    if (repX !== null) {
      const dx = p.x - repX, dy = p.y - repY, d = Math.hypot(dx, dy) + 1
      if (d < 180) { const f = 0.14 * (1 - d / 180); p.vx += dx/d*f; p.vy += dy/d*f }
    }
    p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0

    const nearAtt = (attX !== null) ? Math.max(0, 1 - Math.hypot(attX-p.x, attY-p.y) / 150) : 0
    const twinkle = 0.5 + Math.sin(t * p.twinkle + p.ph) * 0.5
    ctx.globalAlpha = (0.06 + twinkle * 0.05 + nearAtt * 0.35)
    ctx.fillStyle   = p.color
    ctx.shadowBlur  = nearAtt > 0.1 ? 6 : (twinkle > 0.85 ? 3 : 0)
    ctx.shadowColor = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + nearAtt * 1.8), 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Skeleton echoes ───────────────────────────────────────────────────────────

function drawEchoBones(ctx, lms, W, H, alpha) {
  if (!lms) return
  ctx.globalAlpha = alpha; ctx.strokeStyle = P_CYAN; ctx.lineWidth = 0.7
  for (const { pairs } of CON_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo((1-lms[a].x)*W, lms[a].y*H); ctx.lineTo((1-lms[b].x)*W, lms[b].y*H)
    }
    ctx.stroke()
  }
}

function drawSkeletonEchoes(ctx, history, W, H) {
  const len = history.length; if (len < 2) return
  ctx.save()
  for (let i = 0; i < len - 1; i++)
    drawEchoBones(ctx, history[i], W, H, ((i+1)/len) ** 2 * 0.08)
  ctx.restore()
}

// ── Neural mesh ───────────────────────────────────────────────────────────────

function drawNeuralMesh(ctx, lms, W, H) {
  if (!lms?.length) return
  ctx.save(); ctx.strokeStyle = P_PURPLE; ctx.lineWidth = 0.3
  for (let i = 0; i < lms.length; i++) {
    for (let j = i + 1; j < lms.length; j++) {
      const d = Math.hypot(lms[i].x - lms[j].x, lms[i].y - lms[j].y)
      if (d < 0.16) {
        ctx.globalAlpha = 0.05 * (1 - d / 0.16)
        ctx.beginPath()
        ctx.moveTo((1-lms[i].x)*W, lms[i].y*H); ctx.lineTo((1-lms[j].x)*W, lms[j].y*H)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Shadow hand (Umbra projection) ───────────────────────────────────────────

function drawShadowHand(ctx, lms, W, H) {
  if (!lms?.length) return
  const ox = 18, oy = 28  // shadow offset (light from top-left)
  ctx.save()
  ctx.globalAlpha = 0.07; ctx.strokeStyle = '#220044'; ctx.lineWidth = 2.5
  ctx.shadowBlur = 0
  for (const { pairs } of CON_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo((1-lms[a].x)*W + ox, lms[a].y*H + oy)
      ctx.lineTo((1-lms[b].x)*W + ox, lms[b].y*H + oy)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Constellation hand skeleton ───────────────────────────────────────────────

function drawConstellationHand(ctx, lms, W, H, color, t, isPinching = false, alpha = 1) {
  if (!lms?.length) return
  const toX  = (lm) => (1 - lm.x) * W
  const toY  = (lm) => lm.y * H
  const zFac = (lm) => Math.max(0.45, Math.min(1.55, 1 - (lm.z ?? 0) * 7))

  ctx.save(); ctx.globalAlpha = alpha

  // Glow pass
  ctx.shadowBlur = 16
  for (const { color: c, pairs } of CON_SEGS) {
    ctx.strokeStyle = c; ctx.shadowColor = c
    ctx.globalAlpha = alpha * 0.35; ctx.lineWidth = 3.5
    ctx.setLineDash([])
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b]))
    }
    ctx.stroke()
  }

  // Constellation dotted lines (star chart look)
  ctx.shadowBlur = 0; ctx.setLineDash([3, 5])
  for (const { color: c, pairs } of CON_SEGS) {
    ctx.strokeStyle = c; ctx.globalAlpha = alpha * 0.55
    for (const [a, b] of pairs) {
      const zf = (zFac(lms[a]) + zFac(lms[b])) / 2
      ctx.lineWidth = 1.2 * zf
      ctx.beginPath(); ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b])); ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // Star nodes — magnitude-based, 4-point stars at tips
  ctx.globalAlpha = alpha
  for (let i = 0; i < lms.length; i++) {
    const isTip = i in TIP_COLORS_MAP
    const mag   = LM_MAG[i] ?? 1.2
    const zf    = zFac(lms[i])
    const r     = mag * zf
    const c     = TIP_COLORS_MAP[i] ?? 'rgba(180,220,255,0.5)'
    const x     = toX(lms[i]), y = toY(lms[i])
    ctx.shadowColor = c

    if (isTip) {
      // 4-point star for fingertips
      const twinkle = 1 + Math.sin(t * 2 + i * 0.7) * 0.15
      ctx.shadowBlur = 18; ctx.fillStyle = c
      // Outer halo
      ctx.globalAlpha = alpha * 0.15; star(ctx, x, y, r * 2.8 * twinkle, 4); ctx.fill()
      // Star body
      ctx.globalAlpha = alpha * 0.9; ctx.shadowBlur = 14
      star(ctx, x, y, r * 2 * twinkle, 4); ctx.fill()
      // Bright core
      ctx.fillStyle = P_WHITE; ctx.shadowColor = P_WHITE; ctx.shadowBlur = 8
      ctx.globalAlpha = alpha * 0.75
      ctx.beginPath(); ctx.arc(x, y, r * 0.5 * zf, 0, Math.PI * 2); ctx.fill()
    } else {
      // Simple glow dot for other joints
      ctx.shadowBlur = 6; ctx.fillStyle = c
      ctx.globalAlpha = alpha * 0.5
      ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = alpha * (i === 0 ? 0.55 : 0.35)
      ctx.strokeStyle = c; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.stroke()
    }
  }

  // Orbit particles
  ctx.shadowBlur = 5
  TIP_INDICES.forEach((tipIdx, fi) => {
    const lm = lms[tipIdx]; if (!lm) return
    const cx_ = toX(lm), cy_ = toY(lm)
    const pc  = TIP_COLOR_ARR[fi], zf = zFac(lm)
    ctx.shadowColor = pc
    for (let p = 0; p < 2; p++) {
      const phase = t * 2.0 + fi * 1.257 + p * Math.PI
      const rad   = (11 + fi * 1.5 + p * 4) * zf
      ctx.beginPath(); ctx.arc(cx_ + Math.cos(phase)*rad, cy_ + Math.sin(phase)*rad, (2-p*0.3)*zf, 0, Math.PI*2)
      ctx.fillStyle = pc; ctx.globalAlpha = alpha * (0.55 - p*0.18); ctx.fill()
    }
  })

  // Electric arc on pinch
  if (isPinching && lms[4] && lms[8]) {
    const x0 = toX(lms[4]), y0 = toY(lms[4]), x1 = toX(lms[8]), y1 = toY(lms[8])
    ctx.globalAlpha = alpha * 0.95; ctx.strokeStyle = P_GOLD
    ctx.lineWidth = 2; ctx.shadowBlur = 30; ctx.shadowColor = P_GOLD
    ctx.beginPath(); ctx.moveTo(x0, y0)
    for (let s = 1; s < 10; s++) {
      const frac = s / 10, mx = x0+(x1-x0)*frac, my = y0+(y1-y0)*frac
      const pLen = Math.hypot(x1-x0,y1-y0)||1
      const nx = -(y1-y0)/pLen, ny = (x1-x0)/pLen
      ctx.lineTo(mx + nx*(Math.random()-0.5)*22, my + ny*(Math.random()-0.5)*22)
    }
    ctx.lineTo(x1, y1); ctx.stroke()
    ctx.font = '8px JetBrains Mono, monospace'; ctx.textAlign = 'center'
    ctx.fillStyle = P_GOLD; ctx.globalAlpha = 0.9; ctx.shadowBlur = 12
    ctx.fillText('ENGAGING', (x0+x1)/2, (y0+y1)/2 - 20)
  }

  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Chromatic aberration (velocity-driven) ─────────────────────────────────────

function drawChromaticAberration(ctx, lms, W, H, velX, velY) {
  if (!lms?.length) return
  const speed  = Math.hypot(velX ?? 0, velY ?? 0)
  const offset = Math.min(speed * 90, 14)
  if (offset < 0.8) return
  ctx.save()
  // Red channel offset (opposite to velocity)
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#FF0044'; ctx.lineWidth = 1.8; ctx.shadowBlur = 0
  for (const { pairs } of CON_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo((1-lms[a].x)*W - offset, lms[a].y*H)
      ctx.lineTo((1-lms[b].x)*W - offset, lms[b].y*H)
    }
    ctx.stroke()
  }
  // Blue channel offset (with velocity)
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#0044FF'
  for (const { pairs } of CON_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo((1-lms[a].x)*W + offset, lms[a].y*H)
      ctx.lineTo((1-lms[b].x)*W + offset, lms[b].y*H)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Eclipse corona at palm ────────────────────────────────────────────────────

function drawEclipseCorona(ctx, lms, W, H, t, pinching) {
  if (!lms?.[9]) return
  const cx = (1 - lms[9].x) * W, cy = lms[9].y * H
  const energy = pinching ? 1.2 : 0.65
  ctx.save()

  // Outer fading glow rings
  for (let r = 0; r < 4; r++) {
    const rad = 38 + r * 15
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.strokeStyle = P_GOLD; ctx.lineWidth = 0.6
    ctx.globalAlpha = energy * (0.07 - r * 0.015)
    ctx.shadowBlur = 0; ctx.stroke()
  }

  // Corona rays (16 alternating long/short)
  for (let i = 0; i < 16; i++) {
    const ang  = (i / 16) * Math.PI * 2 + t * 0.08
    const isLong = i % 4 === 0
    const len  = (isLong ? 22 : 10) + Math.sin(t * 1.8 + i * 0.6) * 4
    const inner = 28, outer = inner + len
    ctx.globalAlpha = energy * (isLong ? 0.45 : 0.22)
    ctx.strokeStyle = P_GOLD; ctx.lineWidth = isLong ? 1.2 : 0.6
    ctx.shadowBlur  = isLong ? 10 : 0; ctx.shadowColor = P_GOLD
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang)*inner, cy + Math.sin(ang)*inner)
    ctx.lineTo(cx + Math.cos(ang)*outer, cy + Math.sin(ang)*outer); ctx.stroke()
  }

  // Main corona ring
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.strokeStyle = P_GOLD; ctx.lineWidth = pinching ? 2.5 : 1.8
  ctx.globalAlpha = energy * 0.65
  ctx.shadowBlur  = 22; ctx.shadowColor = P_GOLD; ctx.stroke()

  // Dark umbra core
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2)
  ctx.fillStyle   = 'rgba(0,2,10,0.80)'
  ctx.globalAlpha = energy * 0.7; ctx.shadowBlur = 0; ctx.fill()

  // Bright center star
  ctx.fillStyle   = P_WHITE; ctx.shadowBlur = 12; ctx.shadowColor = P_WHITE
  ctx.globalAlpha = energy * 0.5
  star(ctx, cx, cy, 5, 4); ctx.fill()

  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Comet tip trails ──────────────────────────────────────────────────────────

function pushTipTrail(trails, lms, W, H) {
  TIP_INDICES.forEach((tipIdx, fi) => {
    if (!lms?.[tipIdx]) return
    const arr = trails[fi]
    arr.push({ sx: (1 - lms[tipIdx].x) * W, sy: lms[tipIdx].y * H })
    if (arr.length > TIP_TRAIL_LEN) arr.shift()
  })
}

function drawCometTrails(ctx, trails) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  TIP_INDICES.forEach((_, fi) => {
    const trail = trails[fi]; if (trail.length < 2) return
    const color = TIP_COLOR_ARR[fi]; ctx.shadowColor = color
    for (let i = 1; i < trail.length; i++) {
      const frac = i / trail.length
      // Comet: bright head, dim tail — uses quadratic fade
      ctx.globalAlpha = frac * frac * frac * 0.80
      ctx.strokeStyle = frac > 0.85 ? P_WHITE : color
      ctx.lineWidth   = 0.5 + frac * 3.8
      ctx.shadowBlur  = frac > 0.75 ? frac * 18 : 0
      ctx.beginPath(); ctx.moveTo(trail[i-1].sx, trail[i-1].sy)
      ctx.lineTo(trail[i].sx, trail[i].sy); ctx.stroke()
    }
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Pressure impact rings ─────────────────────────────────────────────────────

function updateImpactRings(rings, lms, prevZ, now, W, H) {
  if (!lms) return
  TIP_INDICES.forEach((tipIdx, fi) => {
    const lm = lms[tipIdx]; if (!lm) return
    const pz = prevZ[fi] ?? lm.z
    const dz = pz - (lm.z ?? 0)  // positive = approaching camera
    if (dz > 0.012) {  // threshold for "pressure"
      rings.push({ cx: (1-lm.x)*W, cy: lm.y*H, t0: now, maxR: 35 + dz*200, color: TIP_COLOR_ARR[fi] })
    }
    prevZ[fi] = lm.z ?? 0
  })
}

function drawImpactRings(ctx, rings, now) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i], age = (now - ring.t0) / 1000, dur = 0.55
    if (age > dur) { rings.splice(i, 1); continue }
    const prog = age / dur, r = Math.max(1, prog * ring.maxR)
    ctx.save()
    ctx.beginPath(); ctx.arc(ring.cx, ring.cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = ring.color; ctx.lineWidth = 1.5 * (1 - prog)
    ctx.globalAlpha = (1 - prog) * 0.7; ctx.shadowBlur = 8; ctx.shadowColor = ring.color
    ctx.stroke(); ctx.restore()
  }
}

// ── Velocity vectors ──────────────────────────────────────────────────────────

function drawVelocityVectors(ctx, trails) {
  ctx.save()
  TIP_INDICES.forEach((_, fi) => {
    const trail = trails[fi]; if (trail.length < 5) return
    const len = trail.length
    const dx = trail[len-1].sx - trail[len-5].sx, dy = trail[len-1].sy - trail[len-5].sy
    const spd = Math.hypot(dx, dy); if (spd < 4) return
    const color = TIP_COLOR_ARR[fi], tip = trail[len-1]
    const scale = Math.min(spd * 1.8, 55), nx = dx/spd, ny = dy/spd
    const ex = tip.sx + nx*scale, ey = tip.sy + ny*scale
    const ang = Math.atan2(dy, dx), alpha = Math.min(0.85, spd/16), hs = 5
    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.lineWidth = 1.2; ctx.globalAlpha = alpha
    ctx.shadowBlur = 10; ctx.shadowColor = color
    ctx.beginPath(); ctx.moveTo(tip.sx, tip.sy); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - Math.cos(ang-0.5)*hs, ey - Math.sin(ang-0.5)*hs)
    ctx.lineTo(ex - Math.cos(ang+0.5)*hs, ey - Math.sin(ang+0.5)*hs)
    ctx.closePath(); ctx.fill()
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Pre-pinch: golden converging brackets ─────────────────────────────────────

function drawPinchTension(ctx, lms, W, H, t, isPinching) {
  if (!lms?.[4] || !lms?.[8] || isPinching) return
  const dist    = Math.hypot(lms[4].x-lms[8].x, lms[4].y-lms[8].y)
  const tension = Math.max(0, 1 - dist / PINCH_TENSION_THR)
  if (tension < 0.06) return
  const mx = (1-(lms[4].x+lms[8].x)/2)*W, my = ((lms[4].y+lms[8].y)/2)*H
  const sz = (1-tension)*26 + 7
  const br = 7, bColor = tension > 0.6 ? P_GOLD : P_CYAN
  ctx.save()
  ctx.strokeStyle = bColor; ctx.lineWidth = 1.5
  ctx.globalAlpha = tension * 0.9; ctx.shadowBlur = 14; ctx.shadowColor = bColor
  // 4 corner L-brackets converging
  const draw = (ox, oy, sx, sy) => {
    ctx.beginPath()
    ctx.moveTo(mx+ox*sz, my+oy*sz+sy*br); ctx.lineTo(mx+ox*sz, my+oy*sz); ctx.lineTo(mx+ox*sz+sx*br, my+oy*sz)
    ctx.stroke()
  }
  draw(-1,-1, 1, 1); draw(1,-1,-1, 1); draw(-1, 1, 1,-1); draw(1, 1,-1,-1)
  if (tension > 0.4) {
    ctx.font = '8px JetBrains Mono, monospace'; ctx.fillStyle = bColor; ctx.textAlign = 'center'
    ctx.globalAlpha = (tension-0.4)*1.6*0.75; ctx.shadowBlur = 10
    ctx.fillText(`CORONA ${(tension*100).toFixed(0)}%`, mx, my - sz - 10)
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Eclipse burst on pinch ────────────────────────────────────────────────────

function drawEclipseBurst(ctx, burst, now) {
  if (!burst) return false
  const age = (now - burst.t0)/1000, dur = 0.8; if (age > dur) return false
  const prog = age / dur, r = 4 + prog * 88
  ctx.save()
  // Expanding dark moon
  ctx.beginPath(); ctx.arc(burst.cx, burst.cy, r * 0.82, 0, Math.PI*2)
  ctx.fillStyle = 'rgba(0,2,10,0.72)'; ctx.globalAlpha = (1-prog)*0.75; ctx.fill()
  // Golden corona ring
  ctx.beginPath(); ctx.arc(burst.cx, burst.cy, r, 0, Math.PI*2)
  ctx.strokeStyle = P_GOLD; ctx.lineWidth = 2.5*(1-prog*0.7)
  ctx.globalAlpha = (1-prog)*0.9; ctx.shadowBlur = 25*(1-prog); ctx.shadowColor = P_GOLD; ctx.stroke()
  // Corona rays
  for (let i = 0; i < 16; i++) {
    const ang = (i/16)*Math.PI*2, isLong = i%4===0
    const inner = r, outer = r + (isLong ? 35 : 18)*(1-prog)
    ctx.globalAlpha = (1-prog)*(isLong ? 0.8 : 0.4)
    ctx.strokeStyle = P_GOLD; ctx.lineWidth = isLong ? 1.5 : 0.7; ctx.shadowBlur = isLong ? 12 : 0
    ctx.beginPath()
    ctx.moveTo(burst.cx+Math.cos(ang)*inner, burst.cy+Math.sin(ang)*inner)
    ctx.lineTo(burst.cx+Math.cos(ang)*outer, burst.cy+Math.sin(ang)*outer); ctx.stroke()
  }
  // "ECLIPSE" label rising up
  if (prog < 0.55) {
    ctx.font = `700 ${11+prog*7}px JetBrains Mono, monospace`
    ctx.fillStyle = P_GOLD; ctx.globalAlpha = (0.55-prog)/0.55
    ctx.textAlign = 'center'; ctx.shadowBlur = 18; ctx.shadowColor = P_GOLD
    ctx.fillText('ECLIPSE', burst.cx, burst.cy - r - 12 - prog*22)
  }
  ctx.restore(); return true
}

// ── Hand hex bounding ─────────────────────────────────────────────────────────

function drawHandHex(ctx, lms, W, H, t) {
  if (!lms?.length) return
  let mnX=1,mxX=0,mnY=1,mxY=0
  for (const lm of lms) {
    mnX=Math.min(mnX,lm.x); mxX=Math.max(mxX,lm.x)
    mnY=Math.min(mnY,lm.y); mxY=Math.max(mxY,lm.y)
  }
  const pad=0.06; mnX-=pad; mxX+=pad; mnY-=pad; mxY+=pad
  const cx=(1-(mnX+mxX)/2)*W, cy=((mnY+mxY)/2)*H
  const rx=(mxX-mnX)/2*W*1.1, ry=(mxY-mnY)/2*H*1.05
  ctx.save()
  ctx.globalAlpha = 0.12 + Math.sin(t*1.1)*0.04
  ctx.strokeStyle = P_PURPLE; ctx.lineWidth = 0.7
  ctx.setLineDash([4,12]); ctx.shadowBlur = 4; ctx.shadowColor = P_PURPLE
  ctx.beginPath()
  for (let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2-Math.PI/2
    const x=cx+Math.cos(a)*rx, y=cy+Math.sin(a)*ry
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
  }
  ctx.closePath(); ctx.stroke()
  ctx.setLineDash([]); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore()
}

// ── PENUMBRA data stream ──────────────────────────────────────────────────────

function updateDataStream(stream, lms, W, H, isPointing) {
  for (const p of stream) { p.y += p.vy; p.alpha *= 0.90 }
  if (isPointing && lms?.[8]) {
    const tx=(1-lms[8].x)*W, ty=lms[8].y*H
    if (Math.random() < 0.30)
      stream.push({ text: PENUMBRA_TOKENS[Math.floor(Math.random()*PENUMBRA_TOKENS.length)],
        x: tx+(Math.random()-0.5)*32, y: ty+14, alpha: 0.50+Math.random()*0.28, vy: 0.8+Math.random()*1.4 })
  }
  let w=0
  for (let i=0;i<stream.length;i++)
    if (stream[i].alpha>0.012 && stream[i].y<H+20) stream[w++]=stream[i]
  stream.length=w
}

function drawDataStream(ctx, stream) {
  if (!stream.length) return
  ctx.save()
  ctx.font='7px JetBrains Mono, monospace'; ctx.shadowColor=P_PURPLE; ctx.shadowBlur=6
  ctx.fillStyle=P_PURPLE; ctx.textAlign='center'
  for (const p of stream) { ctx.globalAlpha=p.alpha; ctx.fillText(p.text,p.x,p.y) }
  ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore()
}

// ── Wrist badge ───────────────────────────────────────────────────────────────

function drawWristBadge(ctx, lms, W, H, velX, velY, fps) {
  if (!lms?.[0]) return
  const wx=(1-lms[0].x)*W, wy=lms[0].y*H
  const speed=(Math.hypot(velX??0,velY??0)*1200).toFixed(0)
  const depth=((-(lms[0].z??0))*80).toFixed(1)
  const bx=wx-54, by=wy+18, bw=108, bh=38
  ctx.save(); ctx.globalAlpha=0.78
  ctx.strokeStyle=`${P_CYAN}30`; ctx.lineWidth=1; ctx.setLineDash([3,6])
  ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(wx,by); ctx.stroke(); ctx.setLineDash([])
  ctx.shadowBlur=8; ctx.shadowColor=`${P_CYAN}44`
  ctx.fillStyle=P_BG; roundRect(ctx,bx,by,bw,bh,3); ctx.fill()
  ctx.strokeStyle=`${P_CYAN}30`; ctx.lineWidth=1; ctx.shadowBlur=0
  roundRect(ctx,bx,by,bw,bh,3); ctx.stroke()
  ctx.font='7px JetBrains Mono, monospace'; ctx.textAlign='center'
  ctx.fillStyle=`${P_CYAN}AA`; ctx.fillText(`VEL ${speed} · DEPTH ${depth}cm`,wx,by+13)
  ctx.fillStyle=`${P_CYAN}66`; ctx.fillText(`FPS ${fps} · LM 21`,wx,by+26)
  ctx.globalAlpha=1; ctx.restore()
}

// ── Circular arc gauges ───────────────────────────────────────────────────────

function computeConfidences(lms) {
  if (!lms?.length) return {pinch:0,peace:0,fist:0,palm:0,thumbup:0}
  const w=lms[0], dist=(a)=>Math.hypot(lms[a].x-w.x,lms[a].y-w.y)
  const pairs=[[5,8],[9,12],[13,16],[17,20]]
  const pinchD=Math.hypot(lms[4].x-lms[8].x,lms[4].y-lms[8].y)
  return {
    pinch: Math.max(0,1-pinchD/0.20),
    peace: Math.min(1,Math.max(0,(dist(8)>dist(6)*1.12?0.30:0)+(dist(12)>dist(10)*1.12?0.30:0)+(dist(6)*1.05>dist(16)?0.20:0)+(dist(18)*1.05>dist(20)?0.20:0))),
    fist:  pairs.filter(([m,tip])=>lms[tip].y>lms[m].y+0.01).length/4,
    palm:  pairs.filter(([m,tip])=>lms[tip].y<lms[m].y-0.04).length/4,
    thumbup: Math.min(1,Math.max(0,(lms[2].y-lms[4].y>0.06?0.40:0)+(lms[8].y-lms[6].y>0.015?0.15:0)+(lms[12].y-lms[10].y>0.015?0.15:0)+(lms[16].y-lms[14].y>0.015?0.15:0)+(lms[20].y-lms[18].y>0.015?0.15:0))),
  }
}

function drawArcGauges(ctx, W, H, conf) {
  const x0=W-48, y0=50, sp=52, r=18
  ctx.save()
  CONF_BARS.forEach(({key,label,color},i) => {
    const cx=x0, cy=y0+i*sp, val=Math.max(0,Math.min(1,conf[key]??0)), active=val>0.70
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2)
    ctx.strokeStyle='rgba(0,150,220,0.08)'; ctx.lineWidth=2.5; ctx.globalAlpha=0.7; ctx.stroke()
    if (val>0.01) {
      ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+val*Math.PI*2,false)
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.globalAlpha=0.25+val*0.68
      ctx.shadowBlur=active?12:0; ctx.shadowColor=color; ctx.stroke(); ctx.shadowBlur=0
    }
    ctx.strokeStyle=`${P_CYAN}44`; ctx.lineWidth=1; ctx.globalAlpha=0.5
    ctx.beginPath(); ctx.moveTo(cx,cy-r+3); ctx.lineTo(cx,cy-r-3); ctx.stroke()
    ctx.font='6px JetBrains Mono, monospace'; ctx.textAlign='center'
    ctx.fillStyle=active?P_WHITE:color; ctx.globalAlpha=0.20+val*0.70
    ctx.shadowBlur=active?8:0; ctx.shadowColor=color
    ctx.fillText(label,cx,cy+2.5); ctx.shadowBlur=0
    if (val>0.06) {
      ctx.font='6px JetBrains Mono, monospace'; ctx.textAlign='left'
      ctx.fillStyle=color; ctx.globalAlpha=0.20+val*0.55
      ctx.fillText(`${(val*100).toFixed(0)}`,cx+r+5,cy+2)
    }
  })
  ctx.globalAlpha=1; ctx.restore()
}

// ── Corner data ───────────────────────────────────────────────────────────────

function drawCornerData(ctx, W, H, fps, hasHand, hasTwo, status) {
  ctx.save(); ctx.font='8px JetBrains Mono, monospace'
  ctx.shadowBlur=4; ctx.shadowColor=P_CYAN; ctx.fillStyle=P_CYAN
  ctx.textAlign='left'; ctx.globalAlpha=0.32
  ctx.fillText('PENUMBRA · UMBRA GESTURE INTERFACE', 18, H-38)
  ctx.globalAlpha=0.18
  ctx.fillText(`FPS ${fps} · ${hasHand?(hasTwo?'DUAL HAND · LM 42':'SINGLE HAND · LM 21'):'NO HAND'}`, 18, H-24)
  ctx.fillText('MEDIAPIPE HANDLANDMARKER v1.0.1 · GPU', 18, H-10)
  ctx.textAlign='right'; ctx.globalAlpha=0.16
  ctx.fillText(`PHASE ${status.toUpperCase()}`, W-18, H-24)
  ctx.fillText('UMBRA PHYSICS VISUALIZER · PENUMBRA v1.0', W-18, H-10)
  ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore()
}

// ── Eclipse cursor (canvas-drawn) ─────────────────────────────────────────────

function drawEclipseCursor(cc, velX, velY, pinching, status) {
  const cx=50, cy=50, r=22
  const dc = cc.getContext('2d')
  dc.clearRect(0,0,100,100)
  const color = GESTURE_COLORS[status] ?? P_CYAN
  const velAngle = Math.atan2(velY??0, velX??0)
  const gapSize  = pinching ? 0.2 : 0.55

  // Outer eclipse ring with velocity-aligned gap
  dc.strokeStyle = P_GOLD; dc.lineWidth = 1.8
  dc.shadowBlur = 14; dc.shadowColor = P_GOLD; dc.globalAlpha = 0.75
  dc.beginPath()
  dc.arc(cx, cy, r, velAngle + gapSize, velAngle + Math.PI*2 - gapSize, false)
  dc.stroke()

  // Inner spinning ring
  dc.strokeStyle = color; dc.lineWidth = 1; dc.shadowBlur = 8; dc.shadowColor = color
  dc.globalAlpha = 0.65
  dc.beginPath(); dc.arc(cx, cy, r*0.55, 0, Math.PI*2); dc.stroke()

  // Center 4-point star
  dc.fillStyle = P_WHITE; dc.shadowBlur = 12; dc.shadowColor = P_WHITE; dc.globalAlpha = 0.9
  star(dc, cx, cy, 4.5, 4); dc.fill()

  // Cardinal ticks
  dc.shadowBlur=0; dc.strokeStyle=`${P_CYAN}88`; dc.lineWidth=0.8; dc.globalAlpha=0.6
  for (let i=0;i<4;i++) {
    const a=(i/4)*Math.PI*2, inner=r+4, outer=r+11
    dc.beginPath(); dc.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner)
    dc.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer); dc.stroke()
  }
  dc.globalAlpha=1; dc.shadowBlur=0
}

// ── Corner bracket ────────────────────────────────────────────────────────────

function CornerBracket({ pos }) {
  const isTop=pos[0]==='t', isLeft=pos[1]==='l'
  const SZ=22, TH=1.5, clr=`${P_GOLD}66`
  return <div style={{
    position:'fixed', [isTop?'top':'bottom']:16, [isLeft?'left':'right']:16,
    width:SZ, height:SZ, borderStyle:'solid', borderColor:clr,
    borderTopWidth:isTop?TH:0, borderLeftWidth:isLeft?TH:0,
    borderBottomWidth:!isTop?TH:0, borderRightWidth:!isLeft?TH:0,
    pointerEvents:'none', zIndex:9994,
    boxShadow:`${isLeft?3:-3}px ${isTop?3:-3}px 12px ${P_GOLD}18`,
  }} />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GestureHUD() {
  const gesture = useGesture()
  const {
    enabled, status, toggle, initError, videoRef,
    landmarksRef, hand2LandmarksRef, pinchingRef,
    openPalmRef, pointerRef, velocityRef,
  } = gesture

  const [gestureLog,   setGestureLog]   = useState([])
  const [guideVisible, setGuideVisible] = useState(true)
  const [hasTwo,       setHasTwo]       = useState(false)

  const overlayRef    = useRef(null)
  const cursorCvsRef  = useRef(null)   // eclipse cursor canvas
  const cursorWrapRef = useRef(null)
  const cursorLblRef  = useRef(null)
  const flashElRef    = useRef(null)
  const statusLblRef  = useRef(null)
  const dwellRef      = useRef(null)
  const trailEls      = useRef([])
  const rafRef        = useRef(null)

  const palmStartRef  = useRef(null)
  const trailPosRef   = useRef([])
  const flashState    = useRef({ label:'', opacity:0, startT:0 })
  const prevStatus    = useRef('idle')

  const tipTrailsRef  = useRef(TIP_INDICES.map(()=>[]))
  const tipTrails2Ref = useRef(TIP_INDICES.map(()=>[]))
  const skelHistRef   = useRef([])
  const dataStreamRef = useRef([])
  const impactRingsRef= useRef([])
  const prevTipZRef   = useRef({})
  const pinchBurstRef = useRef(null)
  const prevPinchRef  = useRef(false)
  const particlesRef  = useRef(null)
  const confRef       = useRef({pinch:0,peace:0,fist:0,palm:0,thumbup:0})
  const fpsRef        = useRef(60)
  const lastTickRef   = useRef(performance.now())

  useEffect(() => {
    const resize = () => {
      const c = overlayRef.current
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight }
      particlesRef.current = null
    }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (status === prevStatus.current) return
    prevStatus.current = status
    setHasTwo(hand2LandmarksRef.current?.length > 0)
    if (status === 'idle' || status === 'pointing') return
    const color = GESTURE_COLORS[status] ?? P_CYAN
    const label = STATUS_LABEL[status] ?? status
    setGestureLog(prev => [{label,color,id:Date.now()},...prev].slice(0,LOG_MAX))
    flashState.current = { label, opacity:1, startT:performance.now() }
  }, [status, enabled, hand2LandmarksRef])

  useEffect(() => {
    const h = () => setGuideVisible(v => !v)
    window.addEventListener('umbra-thumbsup', h)
    return () => window.removeEventListener('umbra-thumbsup', h)
  }, [])

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'umbra-gesture-css'
    s.textContent = `
      @keyframes pen-pulse { 0%,100%{opacity:.38} 50%{opacity:.85} }
      @keyframes umbra-ripple {
        0%  {transform:translate(-50%,-50%) scale(0.3);opacity:1}
        100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}
      }
      .umbra-ripple-el {
        position:fixed;pointer-events:none;z-index:10000;
        width:44px;height:44px;border-radius:50%;
        border:1.5px solid ${P_GOLD};
        animation:umbra-ripple 0.45s ease-out forwards;
      }
    `
    document.head.appendChild(s)
    return () => document.getElementById('umbra-gesture-css')?.remove()
  }, [])

  const tick = useCallback(() => {
    const now = performance.now(), t = now/1000
    const W   = window.innerWidth, H = window.innerHeight

    const dt = now - lastTickRef.current; lastTickRef.current = now
    fpsRef.current = Math.round(fpsRef.current*0.92 + (1000/(dt||16))*0.08)

    const lms      = landmarksRef.current
    const lms2     = hand2LandmarksRef.current
    const ptr      = pointerRef.current
    const pinching = pinchingRef.current
    const palm     = openPalmRef.current
    const vel      = velocityRef?.current ?? {x:0,y:0}
    const color    = GESTURE_COLORS[status] ?? P_CYAN
    const hasHand  = lms?.length > 0
    const hasSecond= lms2?.length > 0
    const isPointing = status === 'pointing'

    if (pinching && !prevPinchRef.current && lms?.[4] && lms?.[8]) {
      pinchBurstRef.current = {
        t0:now, cx:(1-(lms[4].x+lms[8].x)/2)*W, cy:((lms[4].y+lms[8].y)/2)*H,
      }
    }
    prevPinchRef.current = pinching

    if (!hasHand) {
      tipTrailsRef.current  = TIP_INDICES.map(()=>[]); tipTrails2Ref.current = TIP_INDICES.map(()=>[])
      skelHistRef.current   = []; dataStreamRef.current = []; prevTipZRef.current = {}
    }
    if (hasHand) {
      pushTipTrail(tipTrailsRef.current, lms, W, H)
      skelHistRef.current.push(lmsSnapshot(lms))
      if (skelHistRef.current.length > ECHO_FRAMES+1) skelHistRef.current.shift()
      confRef.current = computeConfidences(lms)
      updateImpactRings(impactRingsRef.current, lms, prevTipZRef.current, now, W, H)
    }
    if (hasSecond) pushTipTrail(tipTrails2Ref.current, lms2, W, H)
    updateDataStream(dataStreamRef.current, lms, W, H, isPointing)
    if (!particlesRef.current) particlesRef.current = initParticles(W, H)

    // ── Main canvas ──────────────────────────────────────────────────────────
    const canvas = overlayRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      // Background layers
      if (hasHand) drawRadarGrid(ctx, W, H, t)
      drawScanSweep(ctx, W, H, t)
      tickParticles(ctx, particlesRef.current, W, H, lms, status, t)

      // Skeleton depth layers (back to front)
      if (hasHand) drawShadowHand(ctx, lms, W, H)
      if (hasHand) drawSkeletonEchoes(ctx, skelHistRef.current, W, H)
      if (hasHand) drawChromaticAberration(ctx, lms, W, H, vel.x, vel.y)

      // Trails
      if (hasSecond) drawCometTrails(ctx, tipTrails2Ref.current)
      if (hasHand)   drawCometTrails(ctx, tipTrailsRef.current)

      // Mesh + geometry
      if (hasHand) drawNeuralMesh(ctx, lms, W, H)
      if (hasHand) drawHandHex(ctx, lms, W, H, t)

      // Eclipse corona BEFORE main skeleton
      if (hasHand) drawEclipseCorona(ctx, lms, W, H, t, pinching)

      // Main skeletons
      if (hasSecond) drawConstellationHand(ctx, lms2, W, H, '#CC99FF', t, false, 0.32)
      if (hasHand)   drawConstellationHand(ctx, lms,  W, H, color,    t, pinching, 1)

      // Annotations
      if (hasHand) drawVelocityVectors(ctx, tipTrailsRef.current)
      if (hasHand) drawPinchTension(ctx, lms, W, H, t, pinching)
      drawImpactRings(ctx, impactRingsRef.current, now)
      drawDataStream(ctx, dataStreamRef.current)
      if (hasHand) drawWristBadge(ctx, lms, W, H, vel.x, vel.y, fpsRef.current)

      // Events
      if (pinchBurstRef.current) {
        const alive = drawEclipseBurst(ctx, pinchBurstRef.current, now)
        if (!alive) pinchBurstRef.current = null
      }

      // UI overlays
      if (hasHand) drawArcGauges(ctx, W, H, confRef.current)
      drawCornerData(ctx, W, H, fpsRef.current, hasHand, hasSecond, status)
    }

    // ── Eclipse cursor canvas ────────────────────────────────────────────────
    const cc = cursorCvsRef.current
    if (cc && ptr && enabled) drawEclipseCursor(cc, vel.x, vel.y, pinching, status)

    // ── Gesture flash ────────────────────────────────────────────────────────
    const flashEl = flashElRef.current
    if (flashEl) {
      const fl = flashState.current
      if (fl.opacity > 0) {
        const age = now - fl.startT
        fl.opacity = age < 180 ? 1 : Math.max(0, 1-(age-180)/550)
        flashEl.textContent = fl.label
        flashEl.style.opacity    = fl.opacity
        flashEl.style.color      = GESTURE_COLORS[status] ?? P_GOLD
        flashEl.style.textShadow = `0 0 40px ${GESTURE_COLORS[status]??P_GOLD}, 0 0 80px ${P_GOLD}44`
      } else { flashEl.style.opacity='0' }
    }

    // ── Status label ──────────────────────────────────────────────────────────
    const slbl = statusLblRef.current
    if (slbl) { slbl.textContent=STATUS_LABEL[status]??'DORMANT'; slbl.style.color=color }

    // ── Cursor positioning ───────────────────────────────────────────────────
    const wrap = cursorWrapRef.current
    if (wrap) {
      if (ptr && enabled) {
        const sx=((ptr.x+1)/2)*W, sy=((1-ptr.y)/2)*H

        // Trail dots
        trailPosRef.current.push({x:sx,y:sy,color})
        if (trailPosRef.current.length>TRAIL_LEN) trailPosRef.current.shift()
        for (let i=0;i<TRAIL_LEN;i++) {
          const el=trailEls.current[i]; if(!el) continue
          const ti=trailPosRef.current.length-TRAIL_LEN+i
          if(ti<0){el.style.opacity='0';continue}
          const tp=trailPosRef.current[ti], frac=(i+1)/TRAIL_LEN, sz=1.5+frac*5
          el.style.transform=`translate(${tp.x}px,${tp.y}px)`
          el.style.width=el.style.height=`${sz}px`
          el.style.marginLeft=el.style.marginTop=`${-sz/2}px`
          el.style.background=P_GOLD; el.style.opacity=`${frac*0.35}`
        }

        wrap.style.transform=`translate(${sx}px,${sy}px)`; wrap.style.opacity='1'
        if (cc) { cc.style.transform=`translate(${sx}px,${sy}px)` }

        // Cursor label
        const lbl = cursorLblRef.current
        if (lbl) { lbl.textContent=STATUS_LABEL[status]??'TRACKING'; lbl.style.color=color }

        // Palm hold arc
        const dwell = dwellRef.current
        if (dwell) {
          dwell.style.transform=`translate(${sx}px,${sy}px)`
          if (palm) {
            if (!palmStartRef.current) palmStartRef.current=now
            const prog=Math.min(1,(now-palmStartRef.current)/PALM_HOLD_MS)
            dwell.style.opacity='1'
            const dc=dwell.getContext('2d')
            dc.clearRect(0,0,72,72)
            dc.beginPath(); dc.arc(36,36,30,0,Math.PI*2)
            dc.strokeStyle=`${P_PURPLE}22`; dc.lineWidth=3; dc.stroke()
            dc.beginPath(); dc.arc(36,36,30,-Math.PI/2,-Math.PI/2+prog*Math.PI*2)
            dc.strokeStyle=`rgba(155,92,246,${0.45+prog*0.5})`
            dc.lineWidth=3; dc.lineCap='round'; dc.shadowBlur=10; dc.shadowColor=P_PURPLE; dc.stroke()
          } else { palmStartRef.current=null; dwell.style.opacity='0' }
        }
      } else {
        wrap.style.opacity='0'; if(cc) cc.style.opacity='0.0'
        trailPosRef.current=[]
        for (let i=0;i<TRAIL_LEN;i++){const el=trailEls.current[i];if(el)el.style.opacity='0'}
        if(dwellRef.current){dwellRef.current.style.opacity='0';palmStartRef.current=null}
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [enabled, status, landmarksRef, hand2LandmarksRef, pinchingRef, openPalmRef, pointerRef, velocityRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  const activeGuideId = STATUS_TO_GUIDE[status] ?? null
  const statusColor   = GESTURE_COLORS[status] ?? P_CYAN

  return (
    <>
      <video ref={videoRef} muted playsInline
        style={{position:'fixed',top:-9999,left:-9999,width:1,height:1,opacity:0}} />

      {/* Main overlay canvas */}
      <canvas ref={overlayRef} style={{
        position:'fixed',top:0,left:0,pointerEvents:'none',zIndex:9993,
        opacity:enabled?1:0,transition:'opacity 0.9s ease',
      }} />

      {/* Trail dots */}
      {Array.from({length:TRAIL_LEN},(_,i) => (
        <div key={i} ref={el=>{trailEls.current[i]=el}} style={{
          position:'fixed',top:0,left:0,width:'6px',height:'6px',
          marginLeft:'-3px',marginTop:'-3px',borderRadius:'50%',
          background:P_GOLD,pointerEvents:'none',zIndex:9996,opacity:0,
        }} />
      ))}

      {/* Eclipse cursor canvas */}
      <canvas ref={cursorCvsRef} width={100} height={100} style={{
        position:'fixed',top:0,left:0,width:'100px',height:'100px',
        marginLeft:'-50px',marginTop:'-50px',
        pointerEvents:'none',zIndex:9999,opacity:enabled?1:0,
      }} />

      {/* Cursor label */}
      <div ref={cursorWrapRef} style={{position:'fixed',top:0,left:0,pointerEvents:'none',zIndex:9998,opacity:0}}>
        <div ref={cursorLblRef} style={{
          position:'absolute',top:55,left:'50%',transform:'translateX(-50%)',
          fontFamily:'JetBrains Mono, monospace',fontSize:'6.5px',
          letterSpacing:'0.22em',textTransform:'uppercase',
          color:P_CYAN,whiteSpace:'nowrap',
          textShadow:`0 0 8px ${P_CYAN}`,
        }}>TRACKING</div>
      </div>

      {/* Palm hold arc */}
      <canvas ref={dwellRef} width={72} height={72} style={{
        position:'fixed',top:0,left:0,width:'72px',height:'72px',
        marginLeft:'-36px',marginTop:'-36px',pointerEvents:'none',zIndex:9997,opacity:0,
      }} />

      {enabled && ['tl','tr','bl','br'].map(p => <CornerBracket key={p} pos={p} />)}

      {/* Phase flash */}
      <div ref={flashElRef} style={{
        position:'fixed',top:'41%',left:'50%',transform:'translateX(-50%)',
        fontFamily:'JetBrains Mono, monospace',fontSize:'clamp(26px,3.8vw,46px)',
        fontWeight:700,letterSpacing:'0.50em',textTransform:'uppercase',
        pointerEvents:'none',zIndex:9997,opacity:0,whiteSpace:'nowrap',userSelect:'none',
      }} />

      {/* Top status bar */}
      {enabled && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,height:30,
          background:'linear-gradient(to bottom,rgba(0,2,10,0.98) 0%,rgba(0,2,10,0.75) 100%)',
          borderBottom:`1px solid ${P_GOLD}18`,
          display:'flex',alignItems:'center',paddingLeft:52,paddingRight:52,gap:16,
          fontFamily:'JetBrains Mono, monospace',fontSize:'8px',
          letterSpacing:'0.22em',textTransform:'uppercase',color:`${P_CYAN}55`,
          pointerEvents:'none',zIndex:9994,
        }}>
          <div style={{
            width:6,height:6,borderRadius:'50%',background:statusColor,
            boxShadow:`0 0 8px ${statusColor}`,
            animation:'pen-pulse 2s ease-in-out infinite',flexShrink:0,
          }} />
          <span style={{color:`${P_GOLD}99`}}>UMBRA</span>
          <span style={{opacity:0.25}}>·</span>
          <span style={{color:`${P_CYAN}88`}}>PENUMBRA INTERFACE</span>
          <span style={{opacity:0.25}}>|</span>
          <span ref={statusLblRef} style={{color:statusColor,transition:'color 0.25s',fontWeight:700}}>DORMANT</span>
          <span style={{opacity:0.25}}>|</span>
          <span>PHASE LOCK</span>
          {hasTwo && <><span style={{opacity:0.25}}>|</span><span style={{color:P_PURPLE}}>DUAL ECLIPSE ◈</span></>}
          <span style={{marginLeft:'auto',opacity:0.20}}>MEDIAPIPE HANDLANDMARKER · GPU DELEGATE</span>
        </div>
      )}

      {/* Right panel */}
      <div style={{
        position:'fixed',bottom:20,right:20,zIndex:9998,
        display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,pointerEvents:'none',
      }}>
        {enabled && guideVisible && (
          <div style={{
            width:205,background:P_BG,
            border:`1px solid ${P_GOLD}18`,borderRadius:3,padding:'10px 12px',
            boxShadow:`0 0 30px ${P_GOLD}08,0 4px 40px rgba(0,0,0,0.8)`,
          }}>
            <div style={{
              display:'flex',justifyContent:'space-between',marginBottom:7,
              fontFamily:'JetBrains Mono, monospace',fontSize:'7px',letterSpacing:'0.20em',textTransform:'uppercase',
            }}>
              <span style={{color:`${P_GOLD}55`}}>◈ PENUMBRA COMMANDS</span>
              <span style={{color:`${P_GOLD}25`,fontSize:'6px'}}>👍 DISMISS</span>
            </div>
            <div style={{height:1,background:`${P_GOLD}15`,marginBottom:7}} />
            {GUIDE_ROWS.map(([icon,name,action,id]) => {
              const isActive = id === activeGuideId
              return (
                <div key={id} style={{
                  display:'flex',alignItems:'center',gap:8,marginBottom:4,
                  opacity:isActive?1:0.28,transition:'opacity 0.15s',
                  background:isActive?`${P_GOLD}08`:'transparent',
                  borderRadius:2,padding:'1px 3px',
                  borderLeft:isActive?`2px solid ${statusColor}`:'2px solid transparent',
                }}>
                  <span style={{fontSize:'10px',width:14,textAlign:'center',flexShrink:0}}>{icon}</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace',fontSize:'7px',letterSpacing:'0.06em',color:isActive?statusColor:`${P_CYAN}77`,width:52,flexShrink:0,transition:'color 0.15s'}}>{name}</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace',fontSize:'6.5px',color:isActive?`${P_WHITE}77`:`${P_WHITE}20`,transition:'color 0.15s'}}>{action}</span>
                </div>
              )
            })}
          </div>
        )}

        {enabled && gestureLog.length > 0 && (
          <div style={{width:205,background:P_BG,border:`1px solid ${P_GOLD}12`,borderRadius:3,padding:'7px 12px'}}>
            <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:'6.5px',letterSpacing:'0.20em',textTransform:'uppercase',color:`${P_GOLD}28`,marginBottom:5}}>PHASE LOG</div>
            {gestureLog.map((e,i) => (
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,opacity:Math.max(0.09,1-i*0.18)}}>
                <div style={{width:4,height:4,borderRadius:'50%',background:e.color,flexShrink:0,boxShadow:i===0?`0 0 6px ${e.color}`:'none'}} />
                <span style={{fontFamily:'JetBrains Mono, monospace',fontSize:'7px',letterSpacing:'0.08em',color:i===0?e.color:`${P_WHITE}38`}}>{e.label}</span>
              </div>
            ))}
          </div>
        )}

        {initError && (
          <div style={{fontFamily:'JetBrains Mono, monospace',fontSize:'8px',color:'#ff5555',background:P_BG,border:'1px solid rgba(255,80,80,0.3)',padding:'4px 10px',borderRadius:3,maxWidth:205,pointerEvents:'auto'}}>
            {initError}
          </div>
        )}

        <button onClick={toggle} style={{
          pointerEvents:'auto',fontFamily:'JetBrains Mono, monospace',
          fontSize:'8px',letterSpacing:'0.22em',textTransform:'uppercase',
          padding:'7px 16px',borderRadius:2,cursor:'pointer',
          border:enabled?`1px solid ${P_GOLD}88`:`1px solid ${P_GOLD}18`,
          background:enabled?`${P_GOLD}0E`:P_BG,
          color:enabled?P_GOLD:`${P_GOLD}38`,
          boxShadow:enabled?`0 0 18px ${P_GOLD}18,inset 0 0 14px ${P_GOLD}06`:'none',
          transition:'all 0.25s',
        }}>
          {enabled ? '◈ PENUMBRA ACTIVE' : '◈ ACTIVATE PENUMBRA'}
        </button>
      </div>
    </>
  )
}
