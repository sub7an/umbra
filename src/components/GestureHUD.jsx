import { useEffect, useRef, useCallback, useState } from 'react'
import { useGesture } from '../context/GestureContext'

// ── JARVIS color palette ───────────────────────────────────────────────────────

const J_BLUE  = '#00CFFF'   // primary icy blue
const J_WHITE = '#E8F4FF'   // hot white with blue tint
const J_GOLD  = '#FFB347'   // warm accent / warning
const J_DIM   = 'rgba(0,160,220,0.22)'
const J_BG    = 'rgba(0,6,18,0.92)'

// ── Constants ─────────────────────────────────────────────────────────────────

const PALM_HOLD_MS      = 820
const TRAIL_LEN         = 11
const TIP_TRAIL_LEN     = 28
const ECHO_FRAMES       = 5
const PARTICLE_CNT      = 55
const LOG_MAX           = 6
const PINCH_TENSION_THR = 0.21
const SONAR_PERIOD      = 2.2

// Per-finger colors — shifted to JARVIS-compatible icy palette
const FS_SEGS = [
  { color: 'rgba(140,200,255,0.30)', pairs: [[0,1],[0,5],[5,9],[9,13],[13,17],[0,17]] },
  { color: '#88AAFF', pairs: [[1,2],[2,3],[3,4]] },   // thumb  — periwinkle
  { color: '#00CFFF', pairs: [[5,6],[6,7],[7,8]] },   // index  — JARVIS blue
  { color: '#0099EE', pairs: [[9,10],[10,11],[11,12]] },// middle — deeper blue
  { color: '#6677FF', pairs: [[13,14],[14,15],[15,16]] },// ring  — violet-blue
  { color: '#AABBFF', pairs: [[17,18],[18,19],[19,20]] },// pinky — pale blue
]
const TIP_COLORS_FS = { 4:'#88AAFF', 8:'#00CFFF', 12:'#0099EE', 16:'#6677FF', 20:'#AABBFF' }
const TIP_INDICES   = [4, 8, 12, 16, 20]
const TIP_COLOR_ARR = ['#88AAFF', '#00CFFF', '#0099EE', '#6677FF', '#AABBFF']

const GESTURE_COLORS = {
  idle:      J_DIM,
  pointing:  J_BLUE,
  pinching:  J_WHITE,
  peace:     '#4499FF',
  fist:      J_GOLD,
  open_palm: '#9966FF',
  thumbsup:  '#44DDAA',
  twopinch:  '#CC99FF',
}

const STATUS_LABEL = {
  idle: 'STANDBY', pointing: 'TRACKING', pinching: 'ENGAGING',
  peace: 'ORBIT MODE', fist: 'RESET', open_palm: 'RETURN',
  thumbsup: 'GUIDE', twopinch: 'ZOOM',
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
  ['🤲', '2 Hands', 'zoom scene',    'twopinch'],
]

const CONF_BARS = [
  { key: 'pinch',   label: 'ENGAGE', color: J_BLUE   },
  { key: 'peace',   label: 'ORBIT',  color: '#4499FF' },
  { key: 'fist',    label: 'RESET',  color: J_GOLD   },
  { key: 'palm',    label: 'RETURN', color: '#9966FF' },
  { key: 'thumbup', label: 'GUIDE',  color: '#44DDAA' },
]

// JARVIS-style analysis tokens (replace hex cascade)
const JARVIS_TOKENS = [
  'KINEMATIC', 'VELOCITY', 'LOCK·ON', 'TRACKING',
  'SERVO·ACK', 'SYNC·OK', 'ANALYZING', 'JOINT·REF',
  'DEPTH·OK', 'CONF·HIGH', 'ENGAGE', 'ACQUIRE',
  'NEURAL·OK', 'MOTION+', 'DELTA·V', 'STANDBY',
]

// ── Utility ───────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function lmsSnapshot(lms) {
  return lms ? lms.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })) : null
}

function diamond(ctx, x, y, r) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
}

// ── Precision scan sweep ───────────────────────────────────────────────────────

function drawScanSweep(ctx, W, H, t) {
  const period = 7
  const y = ((t / period) % 1) * H

  // Very thin, sharp leading line
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = J_WHITE
  ctx.lineWidth   = 1
  ctx.setLineDash([8, 6])
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  ctx.setLineDash([])

  // Short tick marks at edges
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = J_BLUE
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(18, y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - 18, y); ctx.lineTo(W, y); ctx.stroke()

  // Faint trailing gradient
  const g = ctx.createLinearGradient(0, y - 60, 0, y)
  g.addColorStop(0, 'rgba(0,180,255,0)')
  g.addColorStop(1, 'rgba(0,180,255,0.04)')
  ctx.globalAlpha = 1
  ctx.fillStyle   = g
  ctx.fillRect(0, y - 60, W, 60)

  ctx.restore()
}

// ── Arc reactor at palm ───────────────────────────────────────────────────────

function drawArcReactor(ctx, lms, W, H, t, pinching) {
  if (!lms?.[9]) return
  const cx = (1 - lms[9].x) * W, cy = lms[9].y * H
  const energy = pinching ? 1.0 : 0.55

  ctx.save()

  // 5 concentric rings — alternating CW / CCW rotation
  const rings = [
    { r: 16, lw: 0.7, speed:  0.30, ticks: 0,  alpha: 0.08 },
    { r: 28, lw: 0.5, speed: -0.20, ticks: 0,  alpha: 0.07 },
    { r: 40, lw: 1.2, speed:  0.15, ticks: 12, alpha: 0.10 },
    { r: 54, lw: 0.5, speed: -0.10, ticks: 0,  alpha: 0.07 },
    { r: 68, lw: 0.8, speed:  0.08, ticks: 24, alpha: 0.06 },
  ]

  rings.forEach(({ r, lw, speed, ticks, alpha }) => {
    const rot = t * speed
    ctx.strokeStyle = J_BLUE
    ctx.lineWidth   = lw
    ctx.globalAlpha = alpha * energy
    ctx.shadowBlur  = pinching ? 10 : 0
    ctx.shadowColor = J_BLUE

    // Main ring
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

    // Tick marks
    if (ticks > 0) {
      ctx.lineWidth = 0.6
      for (let i = 0; i < ticks; i++) {
        const a    = rot + (i / ticks) * Math.PI * 2
        const len  = i % (ticks / 4) === 0 ? 5 : 2.5
        const iLen = i % (ticks / 4) === 0 ? 6 : 3
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len))
        ctx.lineTo(cx + Math.cos(a) * (r + iLen * 0.5), cy + Math.sin(a) * (r + iLen * 0.5))
        ctx.stroke()
      }
    }
  })

  // Central core dot
  ctx.globalAlpha = 0.45 * energy
  ctx.shadowBlur  = 16
  ctx.shadowColor = J_WHITE
  ctx.fillStyle   = J_WHITE
  ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill()

  // 4 cardinal markers
  ctx.shadowBlur = 0
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const inner = 42, outer = 48
    ctx.strokeStyle = J_BLUE
    ctx.lineWidth   = 1
    ctx.globalAlpha = 0.25 * energy
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
    ctx.stroke()
  }

  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Skeleton echo ghosts ──────────────────────────────────────────────────────

function drawEchoBones(ctx, lms, W, H, alpha) {
  if (!lms) return
  ctx.globalAlpha = alpha; ctx.strokeStyle = J_BLUE; ctx.lineWidth = 0.8
  for (const { pairs } of FS_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo((1 - lms[a].x) * W, lms[a].y * H)
      ctx.lineTo((1 - lms[b].x) * W, lms[b].y * H)
    }
    ctx.stroke()
  }
}

function drawSkeletonEchoes(ctx, history, W, H) {
  const len = history.length; if (len < 2) return
  ctx.save()
  for (let i = 0; i < len - 1; i++)
    drawEchoBones(ctx, history[i], W, H, ((i + 1) / len) ** 2 * 0.09)
  ctx.restore()
}

// ── Neural mesh ───────────────────────────────────────────────────────────────

function drawNeuralMesh(ctx, lms, W, H) {
  if (!lms?.length) return
  ctx.save()
  ctx.strokeStyle = J_BLUE; ctx.lineWidth = 0.3
  for (let i = 0; i < lms.length; i++) {
    for (let j = i + 1; j < lms.length; j++) {
      const d = Math.hypot(lms[i].x - lms[j].x, lms[i].y - lms[j].y)
      if (d < 0.16) {
        ctx.globalAlpha = 0.055 * (1 - d / 0.16)
        ctx.beginPath()
        ctx.moveTo((1 - lms[i].x) * W, lms[i].y * H)
        ctx.lineTo((1 - lms[j].x) * W, lms[j].y * H)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Ambient particles ─────────────────────────────────────────────────────────

function initParticles(W, H) {
  return Array.from({ length: PARTICLE_CNT }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
    r: 0.6 + Math.random() * 1.2, ph: Math.random() * Math.PI * 2,
  }))
}

function tickParticles(ctx, particles, W, H, lms, status, t) {
  const pointing = status === 'pointing', fisting = status === 'fist'
  const attX = (pointing && lms?.[8]) ? (1 - lms[8].x) * W : null
  const attY = (pointing && lms?.[8]) ? lms[8].y * H       : null
  const repX = (fisting  && lms?.[9]) ? (1 - lms[9].x) * W : null
  const repY = (fisting  && lms?.[9]) ? lms[9].y * H       : null
  ctx.save(); ctx.fillStyle = J_BLUE
  for (const p of particles) {
    if (attX !== null) {
      const dx = attX - p.x, dy = attY - p.y, d = Math.hypot(dx, dy) + 1
      if (d < 240) { const f = 0.07 * (1 - d / 240); p.vx += dx/d*f; p.vy += dy/d*f }
    }
    if (repX !== null) {
      const dx = p.x - repX, dy = p.y - repY, d = Math.hypot(dx, dy) + 1
      if (d < 160) { const f = 0.12 * (1 - d / 160); p.vx += dx/d*f; p.vy += dy/d*f }
    }
    p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
    const nearAtt = (attX !== null) ? Math.max(0, 1 - Math.hypot(attX - p.x, attY - p.y) / 140) : 0
    ctx.globalAlpha = 0.07 + Math.sin(t * 0.6 + p.ph) * 0.02 + nearAtt * 0.30
    ctx.shadowBlur  = nearAtt > 0.15 ? 5 : 0; ctx.shadowColor = J_WHITE
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + nearAtt), 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Tip trails ────────────────────────────────────────────────────────────────

function pushTipTrail(trails, lms, W, H) {
  TIP_INDICES.forEach((tipIdx, fi) => {
    if (!lms?.[tipIdx]) return
    const arr = trails[fi]
    arr.push({ sx: (1 - lms[tipIdx].x) * W, sy: lms[tipIdx].y * H })
    if (arr.length > TIP_TRAIL_LEN) arr.shift()
  })
}

function drawTipTrails(ctx, trails) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  TIP_INDICES.forEach((_, fi) => {
    const trail = trails[fi]; if (trail.length < 2) return
    const color = TIP_COLOR_ARR[fi]; ctx.shadowColor = color
    for (let i = 1; i < trail.length; i++) {
      const frac = i / trail.length
      ctx.globalAlpha = frac * frac * 0.55
      ctx.strokeStyle = color; ctx.lineWidth = 0.7 + frac * 2.8; ctx.shadowBlur = frac * 10
      ctx.beginPath(); ctx.moveTo(trail[i-1].sx, trail[i-1].sy); ctx.lineTo(trail[i].sx, trail[i].sy); ctx.stroke()
    }
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── JARVIS hand skeleton ──────────────────────────────────────────────────────

function drawJarvisHand(ctx, lms, W, H, color, t, isPinching = false, alpha = 1) {
  if (!lms?.length) return
  const toX  = (lm) => (1 - lm.x) * W
  const toY  = (lm) => lm.y * H
  const zFac = (lm) => Math.max(0.5, Math.min(1.5, 1 - (lm.z ?? 0) * 7))

  ctx.save(); ctx.globalAlpha = alpha

  // Glow pass
  ctx.shadowBlur = 14
  for (const { color: c, pairs } of FS_SEGS) {
    ctx.strokeStyle = c; ctx.shadowColor = c; ctx.globalAlpha = alpha * 0.38; ctx.lineWidth = 3.5
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b]))
    }
    ctx.stroke()
  }

  // Sharp pass
  ctx.shadowBlur = 0
  for (const { color: c, pairs } of FS_SEGS) {
    ctx.strokeStyle = c; ctx.globalAlpha = alpha * 0.88
    for (const [a, b] of pairs) {
      const zf = (zFac(lms[a]) + zFac(lms[b])) / 2
      ctx.lineWidth = 1.4 * zf; ctx.beginPath()
      ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b])); ctx.stroke()
    }
  }

  // Joint indicators: diamonds at tips, circles elsewhere
  ctx.globalAlpha = alpha; ctx.shadowBlur = 12
  for (let i = 0; i < lms.length; i++) {
    const isTip = i in TIP_COLORS_FS
    const zf    = zFac(lms[i])
    const x     = toX(lms[i]), y = toY(lms[i])
    const c     = TIP_COLORS_FS[i] ?? 'rgba(180,220,255,0.5)'
    ctx.shadowColor = c

    if (isTip) {
      // Diamond shape
      const r = 6 * zf
      ctx.fillStyle = c; ctx.shadowBlur = 16
      // Outer halo diamond
      ctx.globalAlpha = alpha * 0.18
      diamond(ctx, x, y, r + 5); ctx.fill()
      // Core diamond
      ctx.globalAlpha = alpha
      ctx.shadowBlur  = 14
      diamond(ctx, x, y, r); ctx.fill()
      // Inner bright center
      ctx.fillStyle   = J_WHITE; ctx.globalAlpha = alpha * 0.65; ctx.shadowBlur = 8
      diamond(ctx, x, y, r * 0.38); ctx.fill()
    } else {
      // Small ring
      const r = 2.5 * zf
      ctx.globalAlpha  = alpha * 0.7; ctx.shadowBlur = 6
      ctx.strokeStyle  = c; ctx.lineWidth = 1; ctx.fillStyle = 'transparent'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle    = c; ctx.globalAlpha = alpha * 0.25
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Orbit particles at fingertips
  ctx.shadowBlur = 6
  TIP_INDICES.forEach((tipIdx, fi) => {
    const lm = lms[tipIdx]; if (!lm) return
    const cx_ = toX(lm), cy_ = toY(lm)
    const pc  = TIP_COLOR_ARR[fi], zf = zFac(lm)
    ctx.shadowColor = pc
    for (let p = 0; p < 2; p++) {
      const phase = t * 2.2 + fi * 1.257 + p * Math.PI
      const r     = (12 + fi * 2 + p * 4) * zf
      ctx.beginPath(); ctx.arc(cx_ + Math.cos(phase) * r, cy_ + Math.sin(phase) * r, (2.5 - p * 0.5) * zf, 0, Math.PI * 2)
      ctx.fillStyle = pc; ctx.globalAlpha = alpha * (0.65 - p * 0.20); ctx.fill()
    }
  })

  // Electric arc on pinch
  if (isPinching && lms[4] && lms[8]) {
    const x0 = toX(lms[4]), y0 = toY(lms[4]), x1 = toX(lms[8]), y1 = toY(lms[8])
    const segs = 10
    ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = J_WHITE
    ctx.lineWidth = 1.8; ctx.shadowBlur = 28; ctx.shadowColor = J_WHITE
    ctx.beginPath(); ctx.moveTo(x0, y0)
    for (let s = 1; s < segs; s++) {
      const frac = s / segs
      const mx = x0 + (x1 - x0) * frac, my = y0 + (y1 - y0) * frac
      const pLen = Math.hypot(x1 - x0, y1 - y0) || 1
      const nx = -(y1 - y0) / pLen, ny = (x1 - x0) / pLen
      ctx.lineTo(mx + nx * (Math.random() - 0.5) * 22, my + ny * (Math.random() - 0.5) * 22)
    }
    ctx.lineTo(x1, y1); ctx.stroke()

    // "ENGAGING" label at midpoint
    ctx.font = '8px JetBrains Mono, monospace'; ctx.textAlign = 'center'
    ctx.fillStyle = J_WHITE; ctx.globalAlpha = 0.8; ctx.shadowBlur = 10
    ctx.fillText('ENGAGING', (x0 + x1) / 2, (y0 + y1) / 2 - 18)
  }

  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
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
    const scale = Math.min(spd * 1.6, 50), nx = dx / spd, ny = dy / spd
    const ex = tip.sx + nx * scale, ey = tip.sy + ny * scale
    const ang = Math.atan2(dy, dx), alpha = Math.min(0.80, spd / 16), hs = 5
    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.lineWidth   = 1.2; ctx.globalAlpha = alpha
    ctx.shadowBlur  = 8; ctx.shadowColor  = color
    ctx.beginPath(); ctx.moveTo(tip.sx, tip.sy); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - Math.cos(ang - 0.5) * hs, ey - Math.sin(ang - 0.5) * hs)
    ctx.lineTo(ex - Math.cos(ang + 0.5) * hs, ey - Math.sin(ang + 0.5) * hs)
    ctx.closePath(); ctx.fill()
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Pre-pinch tension ─────────────────────────────────────────────────────────

function drawPinchTension(ctx, lms, W, H, t, isPinching) {
  if (!lms?.[4] || !lms?.[8] || isPinching) return
  const dist    = Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
  const tension = Math.max(0, 1 - dist / PINCH_TENSION_THR)
  if (tension < 0.06) return
  const mx = (1 - (lms[4].x + lms[8].x) / 2) * W, my = ((lms[4].y + lms[8].y) / 2) * H
  ctx.save()
  // Converging square brackets instead of circles — more JARVIS
  const sz = (1 - tension) * 28 + 8
  const bColor = tension > 0.7 ? J_WHITE : J_BLUE
  ctx.strokeStyle = bColor; ctx.lineWidth = 1.5
  ctx.globalAlpha = tension * 0.85; ctx.shadowBlur = 12; ctx.shadowColor = bColor
  const br = 8
  // Top-left
  ctx.beginPath(); ctx.moveTo(mx - sz, my - sz + br); ctx.lineTo(mx - sz, my - sz); ctx.lineTo(mx - sz + br, my - sz); ctx.stroke()
  // Top-right
  ctx.beginPath(); ctx.moveTo(mx + sz - br, my - sz); ctx.lineTo(mx + sz, my - sz); ctx.lineTo(mx + sz, my - sz + br); ctx.stroke()
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(mx - sz, my + sz - br); ctx.lineTo(mx - sz, my + sz); ctx.lineTo(mx - sz + br, my + sz); ctx.stroke()
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(mx + sz - br, my + sz); ctx.lineTo(mx + sz, my + sz); ctx.lineTo(mx + sz, my + sz - br); ctx.stroke()
  // Tension percentage
  if (tension > 0.4) {
    ctx.font = '8px JetBrains Mono, monospace'; ctx.fillStyle = bColor
    ctx.globalAlpha = (tension - 0.4) * 1.6 * 0.7; ctx.textAlign = 'center'
    ctx.shadowBlur = 8; ctx.fillText(`${(tension * 100).toFixed(0)}%`, mx, my - sz - 8)
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Pinch burst ───────────────────────────────────────────────────────────────

function drawPinchBurst(ctx, burst, now) {
  if (!burst) return false
  const age = (now - burst.t0) / 1000, dur = 0.5; if (age > dur) return false
  const prog = age / dur
  ctx.save()
  // 8 precise rays + 4 cardinal longer rays
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const isCardinal = i % 3 === 0
    const inner = 10 + prog * 20, outer = (isCardinal ? 28 : 18) + prog * (isCardinal ? 70 : 45)
    ctx.globalAlpha = (1 - prog) * (isCardinal ? 0.9 : 0.6)
    ctx.strokeStyle = isCardinal ? J_WHITE : J_BLUE
    ctx.lineWidth   = isCardinal ? 1.5 : 0.8
    ctx.shadowBlur  = isCardinal ? 18 : 8; ctx.shadowColor = J_WHITE
    ctx.beginPath()
    ctx.moveTo(burst.cx + Math.cos(angle) * inner, burst.cy + Math.sin(angle) * inner)
    ctx.lineTo(burst.cx + Math.cos(angle) * outer, burst.cy + Math.sin(angle) * outer)
    ctx.stroke()
  }
  // Lock text
  if (prog < 0.4) {
    ctx.font = `${10 + prog * 6}px JetBrains Mono, monospace`
    ctx.fillStyle = J_WHITE; ctx.globalAlpha = (0.4 - prog) / 0.4
    ctx.textAlign = 'center'; ctx.shadowBlur = 14; ctx.shadowColor = J_WHITE
    ctx.fillText('LOCKED', burst.cx, burst.cy - 28 - prog * 20)
  }
  ctx.restore()
  return true
}

// ── JARVIS data stream ────────────────────────────────────────────────────────

function updateDataStream(stream, lms, W, H, isPointing) {
  for (const p of stream) { p.y += p.vy; p.alpha *= 0.91 }
  if (isPointing && lms?.[8]) {
    const tx = (1 - lms[8].x) * W, ty = lms[8].y * H
    if (Math.random() < 0.28)
      stream.push({ text: JARVIS_TOKENS[Math.floor(Math.random() * JARVIS_TOKENS.length)],
        x: tx + (Math.random() - 0.5) * 30, y: ty + 14,
        alpha: 0.45 + Math.random() * 0.30, vy: 0.9 + Math.random() * 1.5 })
  }
  let w = 0
  for (let i = 0; i < stream.length; i++)
    if (stream[i].alpha > 0.012 && stream[i].y < H + 20) stream[w++] = stream[i]
  stream.length = w
}

function drawDataStream(ctx, stream) {
  if (!stream.length) return
  ctx.save()
  ctx.font = '7px JetBrains Mono, monospace'; ctx.shadowColor = J_BLUE
  ctx.shadowBlur = 6; ctx.fillStyle = J_BLUE; ctx.textAlign = 'center'
  for (const p of stream) { ctx.globalAlpha = p.alpha; ctx.fillText(p.text, p.x, p.y) }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Hand hex bounding ─────────────────────────────────────────────────────────

function drawHandHex(ctx, lms, W, H, t) {
  if (!lms?.length) return
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const lm of lms) {
    minX = Math.min(minX, lm.x); maxX = Math.max(maxX, lm.x)
    minY = Math.min(minY, lm.y); maxY = Math.max(maxY, lm.y)
  }
  const pad = 0.06; minX -= pad; maxX += pad; minY -= pad; maxY += pad
  const cx = (1 - (minX + maxX) / 2) * W, cy = ((minY + maxY) / 2) * H
  const rx = (maxX - minX) / 2 * W * 1.1, ry = (maxY - minY) / 2 * H * 1.05
  ctx.save()
  ctx.globalAlpha = 0.14 + Math.sin(t * 1.2) * 0.03
  ctx.strokeStyle = J_BLUE; ctx.lineWidth = 0.8
  ctx.setLineDash([4, 10]); ctx.shadowBlur = 4; ctx.shadowColor = J_BLUE
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath(); ctx.stroke()
  ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore()
}

// ── Circular arc gauges ───────────────────────────────────────────────────────

function computeConfidences(lms) {
  if (!lms?.length) return { pinch: 0, peace: 0, fist: 0, palm: 0, thumbup: 0 }
  const w = lms[0], dist = (a) => Math.hypot(lms[a].x - w.x, lms[a].y - w.y)
  const pairs = [[5,8],[9,12],[13,16],[17,20]]
  const pinchD = Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
  const pinch  = Math.max(0, 1 - pinchD / 0.20)
  const peace  = Math.min(1, Math.max(0,
    (dist(8)>dist(6)*1.12?0.30:0)+(dist(12)>dist(10)*1.12?0.30:0)+
    (dist(6)*1.05>dist(16)?0.20:0)+(dist(18)*1.05>dist(20)?0.20:0)))
  const fist   = pairs.filter(([m,t]) => lms[t].y > lms[m].y + 0.01).length / 4
  const palm   = pairs.filter(([m,t]) => lms[t].y < lms[m].y - 0.04).length / 4
  const thumbup = Math.min(1, Math.max(0,
    (lms[2].y-lms[4].y>0.06?0.40:0)+(lms[8].y-lms[6].y>0.015?0.15:0)+
    (lms[12].y-lms[10].y>0.015?0.15:0)+(lms[16].y-lms[14].y>0.015?0.15:0)+
    (lms[20].y-lms[18].y>0.015?0.15:0)))
  return { pinch, peace, fist, palm, thumbup }
}

function drawArcGauges(ctx, W, H, conf) {
  const startX = W - 48, startY = 50, spacing = 52, r = 18
  ctx.save()
  CONF_BARS.forEach(({ key, label, color }, i) => {
    const cx = startX, cy = startY + i * spacing
    const val = Math.max(0, Math.min(1, conf[key] ?? 0))
    const isActive = val > 0.70

    // Background track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,150,220,0.10)'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7; ctx.stroke()

    // Value arc (12 o'clock → CW)
    if (val > 0.01) {
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + val * Math.PI * 2, false)
      ctx.strokeStyle = color; ctx.lineWidth = 2.5
      ctx.globalAlpha = 0.25 + val * 0.65
      ctx.shadowBlur  = isActive ? 10 : 0; ctx.shadowColor = color
      ctx.stroke(); ctx.shadowBlur = 0
    }

    // 12 o'clock tick
    ctx.strokeStyle = 'rgba(0,200,255,0.28)'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5
    ctx.beginPath(); ctx.moveTo(cx, cy - r + 3); ctx.lineTo(cx, cy - r - 3); ctx.stroke()

    // Center label
    ctx.font = '6.5px JetBrains Mono, monospace'; ctx.textAlign = 'center'
    ctx.fillStyle = isActive ? J_WHITE : color
    ctx.globalAlpha = 0.25 + val * 0.65
    ctx.shadowBlur  = isActive ? 8 : 0; ctx.shadowColor = color
    ctx.fillText(label, cx, cy + 2.5)

    // Percentage (right of gauge)
    if (val > 0.06) {
      ctx.font = '6px JetBrains Mono, monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = color; ctx.globalAlpha = 0.20 + val * 0.55; ctx.shadowBlur = 0
      ctx.fillText(`${(val * 100).toFixed(0)}`, cx + r + 5, cy + 2)
    }
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Wrist data badge ──────────────────────────────────────────────────────────

function drawWristBadge(ctx, lms, W, H, velX, velY, fps) {
  if (!lms?.[0]) return
  const wx = (1 - lms[0].x) * W, wy = lms[0].y * H
  const speed = (Math.hypot(velX ?? 0, velY ?? 0) * 1200).toFixed(0)
  const depth = ((-(lms[0].z ?? 0)) * 80).toFixed(1)
  const bx = wx - 54, by = wy + 16, bw = 108, bh = 38
  ctx.save(); ctx.globalAlpha = 0.75
  ctx.strokeStyle = `${J_BLUE}33`; ctx.lineWidth = 1; ctx.setLineDash([3, 6])
  ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx, by); ctx.stroke(); ctx.setLineDash([])
  ctx.shadowBlur = 10; ctx.shadowColor = `${J_BLUE}55`
  ctx.fillStyle  = J_BG; roundRect(ctx, bx, by, bw, bh, 3); ctx.fill()
  ctx.strokeStyle = `${J_BLUE}33`; ctx.lineWidth = 1; ctx.shadowBlur = 0
  roundRect(ctx, bx, by, bw, bh, 3); ctx.stroke()
  ctx.font = '7px JetBrains Mono, monospace'; ctx.textAlign = 'center'
  ctx.fillStyle = `${J_BLUE}AA`; ctx.fillText(`VEL ${speed} · Z ${depth}`, wx, by + 13)
  ctx.fillStyle = `${J_BLUE}66`; ctx.fillText(`FPS ${fps} · LM 21`, wx, by + 26)
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Corner data ───────────────────────────────────────────────────────────────

function drawCornerData(ctx, W, H, fps, hasHand, hasTwo, status) {
  ctx.save(); ctx.font = '8px JetBrains Mono, monospace'
  ctx.shadowBlur = 4; ctx.shadowColor = J_BLUE; ctx.fillStyle = J_BLUE
  ctx.textAlign = 'left'; ctx.globalAlpha = 0.35
  ctx.fillText('J.A.R.V.I.S · GESTURE INTERFACE', 18, H - 38)
  ctx.globalAlpha = 0.20
  ctx.fillText(`FPS ${fps} · ${hasHand ? (hasTwo ? 'DUAL HAND · LM 42' : 'SINGLE HAND · LM 21') : 'NO HAND DETECTED'}`, 18, H - 24)
  ctx.fillText('MEDIAPIPE HANDLANDMARKER · GPU DELEGATE · v1.0.1', 18, H - 10)
  ctx.textAlign = 'right'; ctx.globalAlpha = 0.18
  ctx.fillText(`SYSTEM STATUS ${status.toUpperCase()}`, W - 18, H - 24)
  ctx.fillText('STARK INDUSTRIES · NATURAL UNITS c = ℏ = G = 1', W - 18, H - 10)
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore()
}

// ── JARVIS corner decoration ──────────────────────────────────────────────────

function CornerBracket({ pos }) {
  const isTop = pos[0] === 't', isLeft = pos[1] === 'l'
  const SZ = 24, TH = 1.5, clr = `${J_BLUE}88`
  return (
    <div style={{
      position: 'fixed',
      [isTop ? 'top' : 'bottom']: 16,
      [isLeft ? 'left' : 'right']: 16,
      width: SZ, height: SZ, borderStyle: 'solid', borderColor: clr,
      borderTopWidth: isTop ? TH : 0, borderLeftWidth: isLeft ? TH : 0,
      borderBottomWidth: !isTop ? TH : 0, borderRightWidth: !isLeft ? TH : 0,
      pointerEvents: 'none', zIndex: 9994,
    }}>
      {/* Inner tick */}
      <div style={{
        position: 'absolute',
        [isTop ? 'top' : 'bottom']: -1,
        [isLeft ? 'left' : 'right']: -1,
        width: isLeft ? 6 : undefined, height: !isLeft ? 6 : undefined,
        right: isLeft ? undefined : -1, left: isLeft ? -1 : undefined,
        background: clr,
      }} />
    </div>
  )
}

// ── Targeting cursor (JARVIS style) ───────────────────────────────────────────

function JarvisCursor({ wrapRef, dotRef, labelRef, trailRefs }) {
  const SZ = 18
  return (
    <div ref={wrapRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999, opacity: 0 }}>
      {/* Trail dots */}
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} ref={el => { trailRefs.current[i] = el }}
          style={{
            position: 'absolute', width: 6, height: 6,
            marginLeft: -3, marginTop: -3, borderRadius: '50%',
            background: J_BLUE, opacity: 0,
          }} />
      ))}
      {/* 4 corner targeting brackets */}
      {[['tl', -SZ, -SZ], ['tr', SZ, -SZ], ['bl', -SZ, SZ], ['br', SZ, SZ]].map(([id, ox, oy]) => {
        const isR = ox > 0, isB = oy > 0
        return (
          <div key={id} style={{
            position: 'absolute',
            left: ox - (isR ? SZ / 2 : -SZ / 2), top: oy - (isB ? SZ / 2 : -SZ / 2),
            width: SZ / 2, height: SZ / 2,
            borderTop:    !isB ? `1.5px solid ${J_BLUE}` : 'none',
            borderBottom:  isB ? `1.5px solid ${J_BLUE}` : 'none',
            borderLeft:   !isR ? `1.5px solid ${J_BLUE}` : 'none',
            borderRight:   isR ? `1.5px solid ${J_BLUE}` : 'none',
            boxShadow: `0 0 8px ${J_BLUE}66, 0 0 2px ${J_BLUE}`,
          }} />
        )
      })}
      {/* Center crosshair dot */}
      <div ref={dotRef} style={{
        position: 'absolute', width: 4, height: 4, left: -2, top: -2,
        borderRadius: '50%', background: J_WHITE,
        boxShadow: `0 0 8px ${J_WHITE}, 0 0 20px ${J_BLUE}`,
      }} />
      {/* Thin crosshair lines */}
      <div style={{ position: 'absolute', width: 1, height: 10, left: -0.5, top: -SZ - 10, background: `${J_BLUE}99` }} />
      <div style={{ position: 'absolute', width: 1, height: 10, left: -0.5, top: SZ,       background: `${J_BLUE}99` }} />
      <div style={{ position: 'absolute', height: 1, width: 10, top: -0.5,  left: -SZ - 10, background: `${J_BLUE}99` }} />
      <div style={{ position: 'absolute', height: 1, width: 10, top: -0.5,  left: SZ,       background: `${J_BLUE}99` }} />
      {/* Status label below reticle */}
      <div ref={labelRef} style={{
        position: 'absolute', top: SZ + 14, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '7px',
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: J_BLUE, whiteSpace: 'nowrap',
        textShadow: `0 0 8px ${J_BLUE}`,
      }}>TRACKING</div>
    </div>
  )
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
  const cursorWrapRef = useRef(null)
  const innerDotRef   = useRef(null)
  const cursorLblRef  = useRef(null)
  const flashElRef    = useRef(null)
  const statusLblRef  = useRef(null)
  const dwellRef      = useRef(null)
  const trailEls      = useRef([])
  const rafRef        = useRef(null)

  const palmStartRef  = useRef(null)
  const trailPosRef   = useRef([])
  const flashState    = useRef({ label: '', opacity: 0, startT: 0 })
  const prevStatus    = useRef('idle')

  const tipTrailsRef  = useRef(TIP_INDICES.map(() => []))
  const tipTrails2Ref = useRef(TIP_INDICES.map(() => []))
  const skelHistRef   = useRef([])
  const dataStreamRef = useRef([])
  const pinchBurstRef = useRef(null)
  const prevPinchRef  = useRef(false)
  const particlesRef  = useRef(null)
  const confRef       = useRef({ pinch: 0, peace: 0, fist: 0, palm: 0, thumbup: 0 })
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
    const color = GESTURE_COLORS[status] ?? J_BLUE
    const label = STATUS_LABEL[status] ?? status
    setGestureLog(prev => [{ label, color, id: Date.now() }, ...prev].slice(0, LOG_MAX))
    flashState.current = { label, opacity: 1, startT: performance.now() }
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
      @keyframes umbra-corner-pulse { 0%,100%{opacity:.40} 50%{opacity:.90} }
      @keyframes umbra-ripple {
        0%  {transform:translate(-50%,-50%) scale(0.3);opacity:1}
        100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}
      }
      .umbra-ripple-el {
        position:fixed;pointer-events:none;z-index:10000;
        width:44px;height:44px;border-radius:50%;
        border:1.5px solid ${J_BLUE};
        animation:umbra-ripple 0.42s ease-out forwards;
      }
    `
    document.head.appendChild(s)
    return () => document.getElementById('umbra-gesture-css')?.remove()
  }, [])

  const tick = useCallback(() => {
    const now = performance.now(), t = now / 1000
    const W   = window.innerWidth, H = window.innerHeight

    const dt = now - lastTickRef.current
    lastTickRef.current = now
    fpsRef.current = Math.round(fpsRef.current * 0.92 + (1000 / (dt || 16)) * 0.08)

    const lms      = landmarksRef.current
    const lms2     = hand2LandmarksRef.current
    const ptr      = pointerRef.current
    const pinching = pinchingRef.current
    const palm     = openPalmRef.current
    const vel      = velocityRef?.current ?? { x: 0, y: 0 }
    const color    = GESTURE_COLORS[status] ?? J_BLUE
    const isPointing = status === 'pointing'
    const hasHand  = lms?.length > 0
    const hasSecond = lms2?.length > 0

    if (pinching && !prevPinchRef.current && lms?.[4] && lms?.[8]) {
      pinchBurstRef.current = {
        t0: now, cx: (1 - (lms[4].x + lms[8].x) / 2) * W, cy: ((lms[4].y + lms[8].y) / 2) * H,
      }
    }
    prevPinchRef.current = pinching

    if (!hasHand) {
      tipTrailsRef.current = TIP_INDICES.map(() => [])
      tipTrails2Ref.current = TIP_INDICES.map(() => [])
      skelHistRef.current = []; dataStreamRef.current = []
    }
    if (hasHand) {
      pushTipTrail(tipTrailsRef.current, lms, W, H)
      skelHistRef.current.push(lmsSnapshot(lms))
      if (skelHistRef.current.length > ECHO_FRAMES + 1) skelHistRef.current.shift()
      confRef.current = computeConfidences(lms)
    }
    if (hasSecond) pushTipTrail(tipTrails2Ref.current, lms2, W, H)
    updateDataStream(dataStreamRef.current, lms, W, H, isPointing)
    if (!particlesRef.current) particlesRef.current = initParticles(W, H)

    const canvas = overlayRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      drawScanSweep(ctx, W, H, t)
      tickParticles(ctx, particlesRef.current, W, H, lms, status, t)
      if (hasHand)   drawSkeletonEchoes(ctx, skelHistRef.current, W, H)
      if (hasSecond) drawTipTrails(ctx, tipTrails2Ref.current)
      if (hasHand)   drawTipTrails(ctx, tipTrailsRef.current)
      if (hasHand)   drawNeuralMesh(ctx, lms, W, H)
      if (hasHand)   drawHandHex(ctx, lms, W, H, t)
      if (hasHand)   drawArcReactor(ctx, lms, W, H, t, pinching)
      if (hasSecond) drawJarvisHand(ctx, lms2, W, H, '#CC99FF', t, false, 0.35)
      if (hasHand)   drawJarvisHand(ctx, lms, W, H, color, t, pinching, 1)
      if (hasHand)   drawVelocityVectors(ctx, tipTrailsRef.current)
      if (hasHand)   drawPinchTension(ctx, lms, W, H, t, pinching)
      drawDataStream(ctx, dataStreamRef.current)
      if (hasHand) drawWristBadge(ctx, lms, W, H, vel.x, vel.y, fpsRef.current)
      if (pinchBurstRef.current) {
        const alive = drawPinchBurst(ctx, pinchBurstRef.current, now)
        if (!alive) pinchBurstRef.current = null
      }
      if (hasHand) drawArcGauges(ctx, W, H, confRef.current)
      drawCornerData(ctx, W, H, fpsRef.current, hasHand, hasSecond, status)
    }

    // Gesture flash
    const flashEl = flashElRef.current
    if (flashEl) {
      const fl = flashState.current
      if (fl.opacity > 0) {
        const age = now - fl.startT
        fl.opacity = age < 200 ? 1 : Math.max(0, 1 - (age - 200) / 500)
        flashEl.textContent = fl.label
        flashEl.style.opacity    = fl.opacity
        flashEl.style.color      = GESTURE_COLORS[status] ?? J_BLUE
        flashEl.style.textShadow = `0 0 30px ${GESTURE_COLORS[status] ?? J_BLUE}`
      } else { flashEl.style.opacity = '0' }
    }

    // Status bar label
    const slbl = statusLblRef.current
    if (slbl) { slbl.textContent = STATUS_LABEL[status] ?? 'STANDBY'; slbl.style.color = color }

    // Cursor reticle
    const wrap = cursorWrapRef.current
    if (wrap) {
      if (ptr && enabled) {
        const sx = ((ptr.x + 1) / 2) * W, sy = ((1 - ptr.y) / 2) * H
        trailPosRef.current.push({ x: sx, y: sy, color })
        if (trailPosRef.current.length > TRAIL_LEN) trailPosRef.current.shift()
        const trail = trailPosRef.current
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailEls.current[i]; if (!el) continue
          const ti = trail.length - TRAIL_LEN + i
          if (ti < 0) { el.style.opacity = '0'; continue }
          const tp = trail[ti], frac = (i + 1) / TRAIL_LEN, sz = 2 + frac * 5
          el.style.transform  = `translate(${tp.x}px,${tp.y}px)`
          el.style.width = el.style.height = `${sz}px`
          el.style.marginLeft = el.style.marginTop = `${-sz/2}px`
          el.style.background = J_BLUE; el.style.opacity = `${frac * 0.4}`
        }
        wrap.style.transform = `translate(${sx}px,${sy}px)`; wrap.style.opacity = '1'

        // Cursor label
        const lbl = cursorLblRef.current
        if (lbl) { lbl.textContent = STATUS_LABEL[status] ?? 'TRACKING'; lbl.style.color = color }

        // Center dot changes on pinch
        const dot = innerDotRef.current
        if (dot) {
          dot.style.background = pinching ? J_WHITE : J_BLUE
          dot.style.boxShadow  = pinching
            ? `0 0 10px ${J_WHITE}, 0 0 20px ${J_BLUE}`
            : `0 0 6px ${J_BLUE}`
        }

        // Palm hold arc
        const dwell = dwellRef.current
        if (dwell) {
          dwell.style.transform = `translate(${sx}px,${sy}px)`
          if (palm) {
            if (!palmStartRef.current) palmStartRef.current = now
            const prog = Math.min(1, (now - palmStartRef.current) / PALM_HOLD_MS)
            dwell.style.opacity = '1'
            const dc = dwell.getContext('2d')
            dc.clearRect(0, 0, 72, 72)
            dc.beginPath(); dc.arc(36, 36, 30, 0, Math.PI * 2)
            dc.strokeStyle = 'rgba(100,100,255,0.10)'; dc.lineWidth = 3; dc.stroke()
            dc.beginPath()
            dc.arc(36, 36, 30, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2)
            dc.strokeStyle = `rgba(153,102,255,${0.4 + prog * 0.55})`
            dc.lineWidth = 3; dc.lineCap = 'round'
            dc.shadowBlur = 10; dc.shadowColor = '#9966ff'; dc.stroke()
          } else { palmStartRef.current = null; dwell.style.opacity = '0' }
        }
      } else {
        wrap.style.opacity = '0'; trailPosRef.current = []
        for (let i = 0; i < TRAIL_LEN; i++) { const el = trailEls.current[i]; if (el) el.style.opacity = '0' }
        if (dwellRef.current) { dwellRef.current.style.opacity = '0'; palmStartRef.current = null }
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [enabled, status, landmarksRef, hand2LandmarksRef, pinchingRef, openPalmRef, pointerRef, velocityRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  const activeGuideId = STATUS_TO_GUIDE[status] ?? null
  const statusColor   = GESTURE_COLORS[status] ?? J_BLUE

  return (
    <>
      <video ref={videoRef} muted playsInline
        style={{ position:'fixed', top:-9999, left:-9999, width:1, height:1, opacity:0 }}
      />

      <canvas ref={overlayRef} style={{
        position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9993,
        opacity: enabled ? 1 : 0, transition: 'opacity 0.8s ease',
      }} />

      {/* Trail dots rendered as children of cursor wrap via JarvisCursor */}
      <JarvisCursor wrapRef={cursorWrapRef} dotRef={innerDotRef} labelRef={cursorLblRef} trailRefs={trailEls} />

      <canvas ref={dwellRef} width={72} height={72} style={{
        position:'fixed', top:0, left:0, width:'72px', height:'72px',
        marginLeft:'-36px', marginTop:'-36px', pointerEvents:'none', zIndex:9998, opacity:0,
      }} />

      {enabled && ['tl','tr','bl','br'].map(p => <CornerBracket key={p} pos={p} />)}

      {/* Gesture name flash */}
      <div ref={flashElRef} style={{
        position:'fixed', top:'41%', left:'50%', transform:'translateX(-50%)',
        fontFamily:'JetBrains Mono, monospace', fontSize:'clamp(28px,4vw,48px)',
        fontWeight:700, letterSpacing:'0.45em', textTransform:'uppercase',
        pointerEvents:'none', zIndex:9997, opacity:0, whiteSpace:'nowrap', userSelect:'none',
      }} />

      {/* Top bar */}
      {enabled && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, height:30,
          background:'linear-gradient(to bottom,rgba(0,6,18,0.97) 0%,rgba(0,6,18,0.72) 100%)',
          borderBottom:`1px solid ${J_BLUE}22`,
          display:'flex', alignItems:'center', paddingLeft:52, paddingRight:52, gap:16,
          fontFamily:'JetBrains Mono, monospace', fontSize:'8px',
          letterSpacing:'0.22em', textTransform:'uppercase', color:`${J_BLUE}66`,
          pointerEvents:'none', zIndex:9994,
        }}>
          <div style={{
            width:6, height:6, borderRadius:'50%', background:statusColor,
            boxShadow:`0 0 8px ${statusColor}`,
            animation:'umbra-corner-pulse 2s ease-in-out infinite', flexShrink:0,
          }} />
          <span style={{ color:`${J_BLUE}99` }}>J.A.R.V.I.S · INTERFACE</span>
          <span style={{ opacity:0.25 }}>|</span>
          <span ref={statusLblRef} style={{ color:statusColor, transition:'color 0.25s', fontWeight:700 }}>STANDBY</span>
          <span style={{ opacity:0.25 }}>|</span>
          <span>LM 21</span>
          {hasTwo && <><span style={{ opacity:0.25 }}>|</span><span style={{ color:'#CC99FF' }}>DUAL HAND ●</span></>}
          <span style={{ marginLeft:'auto', opacity:0.22 }}>STARK INDUSTRIES · MEDIAPIPE v1.0.1</span>
        </div>
      )}

      {/* Right panel */}
      <div style={{
        position:'fixed', bottom:20, right:20, zIndex:9998,
        display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, pointerEvents:'none',
      }}>
        {enabled && guideVisible && (
          <div style={{
            width:200, background:J_BG,
            border:`1px solid ${J_BLUE}22`, borderRadius:3, padding:'10px 12px',
            boxShadow:`0 0 30px ${J_BLUE}0a, 0 4px 40px rgba(0,0,0,0.7)`,
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between', marginBottom:7,
              fontFamily:'JetBrains Mono, monospace', fontSize:'7px', letterSpacing:'0.20em', textTransform:'uppercase',
            }}>
              <span style={{ color:`${J_BLUE}55` }}>◈ COMMAND REFERENCE</span>
              <span style={{ color:`${J_BLUE}28`, fontSize:'6px' }}>👍 HIDE</span>
            </div>
            <div style={{ height:1, background:`${J_BLUE}18`, marginBottom:7 }} />
            {GUIDE_ROWS.map(([icon, name, action, id]) => {
              const isActive = id === activeGuideId
              return (
                <div key={id} style={{
                  display:'flex', alignItems:'center', gap:8, marginBottom:4,
                  opacity: isActive ? 1 : 0.32, transition:'opacity 0.15s',
                  background: isActive ? `${J_BLUE}0a` : 'transparent',
                  borderRadius:2, padding:'1px 3px',
                  borderLeft: isActive ? `2px solid ${statusColor}` : '2px solid transparent',
                }}>
                  <span style={{ fontSize:'10px', width:14, textAlign:'center', flexShrink:0 }}>{icon}</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'7.5px', letterSpacing:'0.06em', color: isActive ? statusColor : `${J_BLUE}88`, width:50, flexShrink:0, transition:'color 0.15s' }}>{name}</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'6.5px', color: isActive ? J_WHITE+'88' : J_WHITE+'22', transition:'color 0.15s' }}>{action}</span>
                </div>
              )
            })}
          </div>
        )}

        {enabled && gestureLog.length > 0 && (
          <div style={{
            width:200, background:J_BG, border:`1px solid ${J_BLUE}18`, borderRadius:3, padding:'7px 12px',
          }}>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'6.5px', letterSpacing:'0.20em', textTransform:'uppercase', color:`${J_BLUE}30`, marginBottom:5 }}>EVENT LOG</div>
            {gestureLog.map((e, i) => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, opacity:Math.max(0.10, 1 - i * 0.18) }}>
                <div style={{ width:4, height:4, borderRadius:'50%', background:e.color, flexShrink:0, boxShadow: i === 0 ? `0 0 6px ${e.color}` : 'none' }} />
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'7.5px', letterSpacing:'0.08em', color: i === 0 ? e.color : J_WHITE+'44' }}>{e.label}</span>
              </div>
            ))}
          </div>
        )}

        {initError && (
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'8px', color:'#ff5555', background:J_BG, border:'1px solid rgba(255,80,80,0.3)', padding:'4px 10px', borderRadius:3, maxWidth:200, pointerEvents:'auto' }}>
            {initError}
          </div>
        )}

        <button onClick={toggle} style={{
          pointerEvents:'auto', fontFamily:'JetBrains Mono, monospace',
          fontSize:'8px', letterSpacing:'0.22em', textTransform:'uppercase',
          padding:'7px 16px', borderRadius:2, cursor:'pointer',
          border: enabled ? `1px solid ${J_BLUE}99` : `1px solid ${J_BLUE}22`,
          background: enabled ? `${J_BLUE}12` : J_BG,
          color: enabled ? J_BLUE : `${J_BLUE}44`,
          boxShadow: enabled ? `0 0 16px ${J_BLUE}22, inset 0 0 16px ${J_BLUE}06` : 'none',
          transition:'all 0.2s',
        }}>
          {enabled ? '◈ INTERFACE ONLINE' : '◈ ACTIVATE JARVIS'}
        </button>
      </div>
    </>
  )
}
