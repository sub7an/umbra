import { useEffect, useRef, useCallback, useState } from 'react'
import { useGesture } from '../context/GestureContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const PALM_HOLD_MS      = 820
const TRAIL_LEN         = 11
const TIP_TRAIL_LEN     = 32
const ECHO_FRAMES       = 6
const PARTICLE_CNT      = 64
const LOG_MAX           = 6
const CYAN              = '#00f0ff'
const SCAN_PERIOD       = 9
const PINCH_TENSION_THR = 0.21
const SONAR_PERIOD      = 1.6

const HEX_CHARS = '0123456789ABCDEF◈○□△⬡∑∇∞·÷≈'

const GESTURE_COLORS = {
  idle:      'rgba(0,240,255,0.25)',
  pointing:  'rgba(0,240,255,0.8)',
  pinching:  '#00f0ff',
  peace:     '#4488ff',
  fist:      '#ff6600',
  open_palm: '#9955ff',
  thumbsup:  '#00ff88',
  twopinch:  '#ee88ff',
}

const STATUS_LABEL = {
  idle: 'STANDBY', pointing: 'TRACKING', pinching: 'ENGAGE',
  peace: 'ORBIT', fist: 'RESET', open_palm: 'BACK',
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

const FS_SEGS = [
  { color: 'rgba(255,255,255,0.35)', pairs: [[0,1],[0,5],[5,9],[9,13],[13,17],[0,17]] },
  { color: '#ff9944', pairs: [[1,2],[2,3],[3,4]] },
  { color: '#00f0ff', pairs: [[5,6],[6,7],[7,8]] },
  { color: '#4488ff', pairs: [[9,10],[10,11],[11,12]] },
  { color: '#9955ff', pairs: [[13,14],[14,15],[15,16]] },
  { color: '#ff44aa', pairs: [[17,18],[18,19],[19,20]] },
]

const TIP_COLORS_FS = { 4:'#ff9944', 8:'#00f0ff', 12:'#4488ff', 16:'#9955ff', 20:'#ff44aa' }
const TIP_INDICES   = [4, 8, 12, 16, 20]
const TIP_COLOR_ARR = ['#ff9944', '#00f0ff', '#4488ff', '#9955ff', '#ff44aa']

// ── Confidence bar config ─────────────────────────────────────────────────────

const CONF_BARS = [
  { key: 'pinch',   label: 'PINCH', color: '#00f0ff' },
  { key: 'peace',   label: 'ORBIT', color: '#4488ff' },
  { key: 'fist',    label: 'RESET', color: '#ff6600' },
  { key: 'palm',    label: 'BACK',  color: '#9955ff' },
  { key: 'thumbup', label: 'GUIDE', color: '#00ff88' },
]

// ── Utility ───────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y,         x + r, y)
  ctx.closePath()
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function lmsSnapshot(lms) {
  return lms ? lms.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })) : null
}

// ── Scan line ─────────────────────────────────────────────────────────────────

function drawScanLine(ctx, W, H, t) {
  const y = ((t / SCAN_PERIOD) % 1) * (H + 80) - 40
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 50)
  g.addColorStop(0,    'rgba(0,240,255,0)')
  g.addColorStop(0.42, 'rgba(0,240,255,0.025)')
  g.addColorStop(0.5,  'rgba(0,240,255,0.08)')
  g.addColorStop(0.58, 'rgba(0,240,255,0.025)')
  g.addColorStop(1,    'rgba(0,240,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = CYAN
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(0, y + 6); ctx.lineTo(W, y + 6); ctx.stroke()
  // Glitch band
  const seed = Math.floor(t * 3)
  const rng  = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  if (rng(1) > 0.60) {
    ctx.globalAlpha = 0.05 + rng(3) * 0.07
    ctx.fillStyle   = CYAN
    ctx.fillRect(0, y - 20 + rng(2) * 40, W, 2 + rng(4) * 4)
  }
  ctx.globalAlpha = 1
}

// ── Skeleton echo ghosts ──────────────────────────────────────────────────────

function drawEchoBones(ctx, lms, W, H, alpha) {
  if (!lms) return
  const toX = (lm) => (1 - lm.x) * W
  const toY = (lm) => lm.y * H
  ctx.globalAlpha = alpha
  ctx.strokeStyle = CYAN
  ctx.lineWidth   = 1
  ctx.shadowBlur  = 0
  for (const { pairs } of FS_SEGS) {
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo(toX(lms[a]), toY(lms[a]))
      ctx.lineTo(toX(lms[b]), toY(lms[b]))
    }
    ctx.stroke()
  }
}

function drawSkeletonEchoes(ctx, history, W, H) {
  const len = history.length
  if (len < 2) return
  ctx.save()
  for (let i = 0; i < len - 1; i++) {
    const frac  = (i + 1) / len
    const alpha = frac * frac * 0.11
    drawEchoBones(ctx, history[i], W, H, alpha)
  }
  ctx.restore()
}

// ── Neural mesh ───────────────────────────────────────────────────────────────

function drawNeuralMesh(ctx, lms, W, H, color) {
  if (!lms?.length) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = 0.35
  ctx.shadowBlur  = 0
  for (let i = 0; i < lms.length; i++) {
    for (let j = i + 1; j < lms.length; j++) {
      const d = Math.hypot(lms[i].x - lms[j].x, lms[i].y - lms[j].y)
      if (d < 0.16) {
        ctx.globalAlpha = 0.06 * (1 - d / 0.16)
        ctx.beginPath()
        ctx.moveTo((1 - lms[i].x) * W, lms[i].y * H)
        ctx.lineTo((1 - lms[j].x) * W, lms[j].y * H)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Ambient particle field ────────────────────────────────────────────────────

function initParticles(W, H) {
  return Array.from({ length: PARTICLE_CNT }, () => ({
    x:  Math.random() * W,
    y:  Math.random() * H,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r:  0.7 + Math.random() * 1.6,
    ph: Math.random() * Math.PI * 2,
  }))
}

function tickParticles(ctx, particles, W, H, lms, status, t) {
  const pointing = status === 'pointing'
  const fisting  = status === 'fist'
  const attX = (pointing && lms?.[8]) ? (1 - lms[8].x) * W : null
  const attY = (pointing && lms?.[8]) ? lms[8].y * H       : null
  const repX = (fisting  && lms?.[9]) ? (1 - lms[9].x) * W : null
  const repY = (fisting  && lms?.[9]) ? lms[9].y * H       : null

  ctx.save()
  ctx.fillStyle = CYAN

  for (const p of particles) {
    if (attX !== null) {
      const dx = attX - p.x, dy = attY - p.y
      const d  = Math.hypot(dx, dy) + 1
      if (d < 230) { const f = 0.09 * (1 - d / 230); p.vx += dx / d * f; p.vy += dy / d * f }
    }
    if (repX !== null) {
      const dx = p.x - repX, dy = p.y - repY
      const d  = Math.hypot(dx, dy) + 1
      if (d < 170) { const f = 0.14 * (1 - d / 170); p.vx += dx / d * f; p.vy += dy / d * f }
    }
    p.vx *= 0.97; p.vy *= 0.97
    p.x  += p.vx; p.y  += p.vy
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0

    const nearAtt = (attX !== null) ? Math.max(0, 1 - Math.hypot(attX - p.x, attY - p.y) / 130) : 0
    ctx.globalAlpha = 0.10 + Math.sin(t * 0.7 + p.ph) * 0.03 + nearAtt * 0.38
    ctx.shadowBlur  = nearAtt > 0.1 ? 6 : 0
    ctx.shadowColor = CYAN
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * (1 + nearAtt * 1.5), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Tip trails ────────────────────────────────────────────────────────────────

function pushTipTrail(trails, lms, W, H) {
  TIP_INDICES.forEach((tipIdx, fi) => {
    if (!lms?.[tipIdx]) return
    const lm = lms[tipIdx]
    const arr = trails[fi]
    arr.push({ sx: (1 - lm.x) * W, sy: lm.y * H })
    if (arr.length > TIP_TRAIL_LEN) arr.shift()
  })
}

function drawTipTrails(ctx, trails) {
  ctx.save()
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  TIP_INDICES.forEach((_, fi) => {
    const trail = trails[fi]
    if (trail.length < 2) return
    const color = TIP_COLOR_ARR[fi]
    ctx.shadowColor = color
    for (let i = 1; i < trail.length; i++) {
      const frac = i / trail.length
      ctx.globalAlpha = frac * frac * 0.68
      ctx.strokeStyle = color
      ctx.lineWidth   = 0.8 + frac * 3.5
      ctx.shadowBlur  = frac * 12
      ctx.beginPath()
      ctx.moveTo(trail[i-1].sx, trail[i-1].sy)
      ctx.lineTo(trail[i].sx,   trail[i].sy)
      ctx.stroke()
    }
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Velocity vectors ──────────────────────────────────────────────────────────

function drawVelocityVectors(ctx, trails) {
  ctx.save()
  TIP_INDICES.forEach((_, fi) => {
    const trail = trails[fi]
    if (trail.length < 5) return
    const len  = trail.length
    const dx   = trail[len-1].sx - trail[len-5].sx
    const dy   = trail[len-1].sy - trail[len-5].sy
    const spd  = Math.hypot(dx, dy)
    if (spd < 4) return
    const color  = TIP_COLOR_ARR[fi]
    const tip    = trail[len-1]
    const scale  = Math.min(spd * 1.8, 55)
    const nx = dx / spd, ny = dy / spd
    const ex = tip.sx + nx * scale, ey = tip.sy + ny * scale
    const arrowAlpha = Math.min(0.85, spd / 18)
    const ang = Math.atan2(dy, dx)
    const hs  = 5

    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.lineWidth   = 1.5; ctx.globalAlpha = arrowAlpha
    ctx.shadowBlur  = 10; ctx.shadowColor  = color

    ctx.beginPath(); ctx.moveTo(tip.sx, tip.sy); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - Math.cos(ang - 0.5) * hs, ey - Math.sin(ang - 0.5) * hs)
    ctx.lineTo(ex - Math.cos(ang + 0.5) * hs, ey - Math.sin(ang + 0.5) * hs)
    ctx.closePath(); ctx.fill()
  })
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Hand skeleton ─────────────────────────────────────────────────────────────

function drawFullHand(ctx, lms, W, H, color, t, isPinching = false, alpha = 1) {
  if (!lms?.length) return
  const toX  = (lm) => (1 - lm.x) * W
  const toY  = (lm) => lm.y * H
  const zFac = (lm) => Math.max(0.4, Math.min(1.6, 1 - (lm.z ?? 0) * 8))

  ctx.save()
  ctx.globalAlpha = alpha

  // Glow pass
  ctx.shadowBlur = 18
  for (const { color: c, pairs } of FS_SEGS) {
    ctx.strokeStyle = c; ctx.shadowColor = c
    ctx.globalAlpha = alpha * 0.50; ctx.lineWidth = 4
    ctx.beginPath()
    for (const [a, b] of pairs) {
      ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b]))
    }
    ctx.stroke()
  }

  // Sharp pass with z-depth
  ctx.shadowBlur = 0
  for (const { color: c, pairs } of FS_SEGS) {
    ctx.strokeStyle = c; ctx.globalAlpha = alpha * 0.9
    for (const [a, b] of pairs) {
      const zf = (zFac(lms[a]) + zFac(lms[b])) / 2
      ctx.lineWidth = 1.6 * zf
      ctx.beginPath()
      ctx.moveTo(toX(lms[a]), toY(lms[a])); ctx.lineTo(toX(lms[b]), toY(lms[b]))
      ctx.stroke()
    }
  }

  // Nodes
  ctx.globalAlpha = alpha; ctx.shadowBlur = 12
  for (let i = 0; i < lms.length; i++) {
    const isTip = i in TIP_COLORS_FS
    const zf    = zFac(lms[i])
    const r     = (isTip ? 6 : 3) * zf
    const c     = TIP_COLORS_FS[i] ?? 'rgba(255,255,255,0.55)'
    const x     = toX(lms[i]), y = toY(lms[i])
    ctx.shadowColor = c
    if (isTip) {
      const [cr, cg, cb] = hexToRgb(c)
      ctx.beginPath(); ctx.arc(x, y, r + 6 * zf, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.06)`; ctx.shadowBlur = 0; ctx.fill()
    }
    ctx.shadowBlur = 14
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = c; ctx.fill()
  }

  // Orbit particles
  ctx.shadowBlur = 8
  TIP_INDICES.forEach((tipIdx, fi) => {
    const lm = lms[tipIdx]; if (!lm) return
    const cx_ = toX(lm), cy_ = toY(lm)
    const pc  = TIP_COLOR_ARR[fi]
    const zf  = zFac(lm)
    ctx.shadowColor = pc
    for (let p = 0; p < 2; p++) {
      const phase  = t * 2.8 + fi * 1.257 + p * Math.PI
      const radius = (13 + fi * 2 + p * 5) * zf
      ctx.beginPath()
      ctx.arc(cx_ + Math.cos(phase) * radius, cy_ + Math.sin(phase) * radius, (3 - p) * zf, 0, Math.PI * 2)
      ctx.fillStyle   = pc
      ctx.globalAlpha = alpha * (0.75 - p * 0.22)
      ctx.fill()
    }
  })

  // Electric arc on pinch
  if (isPinching && lms[4] && lms[8]) {
    const x0 = toX(lms[4]), y0 = toY(lms[4])
    const x1 = toX(lms[8]), y1 = toY(lms[8])
    const segs = 10
    ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = CYAN
    ctx.lineWidth = 1.5; ctx.shadowBlur = 24; ctx.shadowColor = CYAN
    ctx.beginPath(); ctx.moveTo(x0, y0)
    for (let s = 1; s < segs; s++) {
      const frac = s / segs
      const mx = x0 + (x1 - x0) * frac, my = y0 + (y1 - y0) * frac
      const pLen = Math.hypot(x1 - x0, y1 - y0) || 1
      const nx = -(y1 - y0) / pLen, ny = (x1 - x0) / pLen
      ctx.lineTo(mx + nx * (Math.random() - 0.5) * 24, my + ny * (Math.random() - 0.5) * 24)
    }
    ctx.lineTo(x1, y1); ctx.stroke()
  }

  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Pre-pinch tension ─────────────────────────────────────────────────────────

function drawPinchTension(ctx, lms, W, H, t, isPinching) {
  if (!lms?.[4] || !lms?.[8] || isPinching) return
  const dist    = Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
  const tension = Math.max(0, 1 - dist / PINCH_TENSION_THR)
  if (tension < 0.06) return
  const mx = (1 - (lms[4].x + lms[8].x) / 2) * W
  const my = ((lms[4].y + lms[8].y) / 2) * H
  ctx.save()
  ctx.shadowColor = CYAN
  for (let r = 0; r < 3; r++) {
    const phase  = ((t * 3.5 + r * 0.72) % 1)
    const radius = (1 - phase) * tension * 52 + 6
    ctx.beginPath(); ctx.arc(mx, my, Math.max(1, radius), 0, Math.PI * 2)
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5
    ctx.globalAlpha = tension * (1 - phase) * 0.75
    ctx.shadowBlur  = 12 * tension; ctx.stroke()
  }
  if (tension > 0.5) {
    ctx.font = '8px JetBrains Mono, monospace'; ctx.fillStyle = CYAN
    ctx.globalAlpha = (tension - 0.5) * 2 * 0.6
    ctx.textAlign = 'center'; ctx.shadowBlur = 8
    ctx.fillText(`${(tension * 100).toFixed(0)}%`, mx, my - 28)
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Pinch burst ───────────────────────────────────────────────────────────────

function drawPinchBurst(ctx, burst, now) {
  if (!burst) return false
  const age = (now - burst.t0) / 1000, dur = 0.45
  if (age > dur) return false
  const prog = age / dur
  ctx.save()
  const rays = 12
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2
    const inner = 8 + prog * 18, outer = 18 + prog * 55
    ctx.globalAlpha = (1 - prog) * 0.85
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5 - prog
    ctx.shadowBlur = 12; ctx.shadowColor = CYAN
    ctx.beginPath()
    ctx.moveTo(burst.cx + Math.cos(angle) * inner, burst.cy + Math.sin(angle) * inner)
    ctx.lineTo(burst.cx + Math.cos(angle) * outer, burst.cy + Math.sin(angle) * outer)
    ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(burst.cx, burst.cy, 10 + prog * 60, 0, Math.PI * 2)
  ctx.strokeStyle = CYAN; ctx.lineWidth = 2 * (1 - prog)
  ctx.globalAlpha = (1 - prog) * 0.5; ctx.stroke()
  ctx.restore()
  return true
}

// ── Palm sonar ────────────────────────────────────────────────────────────────

function drawPalmSonar(ctx, lms, W, H, t) {
  if (!lms?.[9]) return
  const px = (1 - lms[9].x) * W, py = lms[9].y * H
  ctx.save()
  ctx.shadowColor = CYAN
  for (let ring = 0; ring < 3; ring++) {
    const phase  = ((t / SONAR_PERIOD + ring / 3) % 1)
    const radius = Math.max(1, phase * 95)
    const alpha  = (1 - phase) * 0.24
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1
    ctx.globalAlpha = alpha; ctx.shadowBlur = 8; ctx.stroke()
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.restore()
}

// ── Wrist badge ───────────────────────────────────────────────────────────────

function drawWristBadge(ctx, lms, W, H, velX, velY, fps) {
  if (!lms?.[0]) return
  const wx = (1 - lms[0].x) * W, wy = lms[0].y * H
  const speed = ((Math.hypot(velX ?? 0, velY ?? 0)) * 1200).toFixed(0)
  const depth = ((-(lms[0].z ?? 0)) * 80).toFixed(1)
  const bx = wx - 52, by = wy + 18, bw = 104, bh = 36

  ctx.save(); ctx.globalAlpha = 0.78
  ctx.strokeStyle = 'rgba(0,240,255,0.18)'; ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx, by); ctx.stroke()
  ctx.setLineDash([])

  ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,240,255,0.25)'
  ctx.fillStyle  = 'rgba(0,5,14,0.88)'
  roundRect(ctx, bx, by, bw, bh, 3); ctx.fill()
  ctx.strokeStyle = 'rgba(0,240,255,0.22)'; ctx.lineWidth = 1; ctx.shadowBlur = 0
  roundRect(ctx, bx, by, bw, bh, 3); ctx.stroke()

  ctx.font = '7.5px JetBrains Mono, monospace'; ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,240,255,0.50)'; ctx.fillText(`VEL ${speed} · Z ${depth}`, wx, by + 13)
  ctx.fillStyle = 'rgba(0,240,255,0.30)'; ctx.fillText(`FPS ${fps} · LM 21`, wx, by + 26)
  ctx.globalAlpha = 1; ctx.restore()
}

// ── Hex stream ────────────────────────────────────────────────────────────────

function updateHexStream(stream, lms, W, H, isPointing) {
  for (const p of stream) { p.y += p.vy; p.alpha *= 0.91 }
  if (isPointing && lms?.[8]) {
    const tx = (1 - lms[8].x) * W, ty = lms[8].y * H
    if (Math.random() < 0.45)
      stream.push({ char: HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)],
        x: tx + (Math.random() - 0.5) * 22, y: ty + 12,
        alpha: 0.55 + Math.random() * 0.35, vy: 1.2 + Math.random() * 2.2 })
  }
  let w = 0
  for (let i = 0; i < stream.length; i++)
    if (stream[i].alpha > 0.015 && stream[i].y < H + 20) stream[w++] = stream[i]
  stream.length = w
}

function drawHexStream(ctx, stream) {
  if (!stream.length) return
  ctx.save()
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.shadowColor = CYAN; ctx.shadowBlur = 8
  ctx.fillStyle = CYAN; ctx.textAlign = 'center'
  for (const p of stream) { ctx.globalAlpha = p.alpha; ctx.fillText(p.char, p.x, p.y) }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

// ── Hand hex ──────────────────────────────────────────────────────────────────

function drawHandHex(ctx, lms, W, H, t) {
  if (!lms?.length) return
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const lm of lms) {
    minX = Math.min(minX, lm.x); maxX = Math.max(maxX, lm.x)
    minY = Math.min(minY, lm.y); maxY = Math.max(maxY, lm.y)
  }
  const pad = 0.055
  minX -= pad; maxX += pad; minY -= pad; maxY += pad
  const cx = (1 - (minX + maxX) / 2) * W, cy = ((minY + maxY) / 2) * H
  const rx = (maxX - minX) / 2 * W, ry = (maxY - minY) / 2 * H
  ctx.save()
  ctx.globalAlpha = 0.18 + Math.sin(t * 1.4) * 0.04
  ctx.strokeStyle = CYAN; ctx.lineWidth = 1
  ctx.setLineDash([5, 9]); ctx.shadowBlur = 6; ctx.shadowColor = CYAN
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(ang) * rx * 1.12, y = cy + Math.sin(ang) * ry * 1.08
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath(); ctx.stroke()
  ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore()
}

// ── Gesture confidence bars ───────────────────────────────────────────────────

function computeConfidences(lms) {
  if (!lms?.length) return { pinch: 0, peace: 0, fist: 0, palm: 0, thumbup: 0 }
  const w = lms[0], dist = (a) => Math.hypot(lms[a].x - w.x, lms[a].y - w.y)
  const fingerPairs = [[5,8],[9,12],[13,16],[17,20]]

  const pinchD  = Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
  const pinch   = Math.max(0, 1 - pinchD / 0.20)

  const peace = Math.min(1, Math.max(0,
    (dist(8)  > dist(6)  * 1.12 ? 0.30 : 0) +
    (dist(12) > dist(10) * 1.12 ? 0.30 : 0) +
    (dist(6)  * 1.05 > dist(16) ? 0.20 : 0) +
    (dist(18) * 1.05 > dist(20) ? 0.20 : 0)
  ))

  const fist = fingerPairs.filter(([m, tip]) => lms[tip].y > lms[m].y + 0.01).length / 4

  const palm = fingerPairs.filter(([m, tip]) => lms[tip].y < lms[m].y - 0.04).length / 4

  const thumbup = Math.min(1, Math.max(0,
    (lms[2].y - lms[4].y > 0.06   ? 0.40 : 0) +
    (lms[8].y  - lms[6].y  > 0.015 ? 0.15 : 0) +
    (lms[12].y - lms[10].y > 0.015 ? 0.15 : 0) +
    (lms[16].y - lms[14].y > 0.015 ? 0.15 : 0) +
    (lms[20].y - lms[18].y > 0.015 ? 0.15 : 0)
  ))

  return { pinch, peace, fist, palm, thumbup }
}

function drawConfidencePanel(ctx, W, H, conf) {
  const panelX = W - 106, panelY = 44
  const barW = 68, barH = 4, gap = 15
  ctx.save()
  ctx.font = '7px JetBrains Mono, monospace'

  CONF_BARS.forEach(({ key, label, color }, i) => {
    const y   = panelY + i * gap
    const val = Math.max(0, Math.min(1, conf[key] ?? 0))

    // Background track
    ctx.fillStyle   = 'rgba(0,240,255,0.04)'
    ctx.globalAlpha = 0.55
    ctx.fillRect(panelX, y, barW, barH)

    // Fill
    ctx.fillStyle   = color
    ctx.globalAlpha = 0.22 + val * 0.68
    ctx.shadowBlur  = val > 0.72 ? 8 : 0
    ctx.shadowColor = color
    ctx.fillRect(panelX, y, Math.max(0, val * barW), barH)
    ctx.shadowBlur  = 0

    // Label left
    ctx.textAlign   = 'right'
    ctx.fillStyle   = color
    ctx.globalAlpha = 0.18 + val * 0.52
    ctx.fillText(label, panelX - 5, y + barH)

    // Pct right
    if (val > 0.08) {
      ctx.textAlign   = 'left'
      ctx.fillStyle   = color
      ctx.globalAlpha = 0.22 + val * 0.55
      ctx.fillText(`${(val * 100).toFixed(0)}`, panelX + barW + 4, y + barH)
    }
  })

  ctx.globalAlpha = 1; ctx.restore()
}

// ── Corner data ───────────────────────────────────────────────────────────────

function drawCornerData(ctx, W, H, fps, hasHand, hasTwo, status) {
  ctx.save()
  ctx.font = '8px JetBrains Mono, monospace'
  ctx.shadowBlur = 6; ctx.shadowColor = CYAN

  ctx.textAlign   = 'left'; ctx.fillStyle = CYAN
  ctx.globalAlpha = 0.38
  ctx.fillText('◈ UMBRA GESTURE v5.0', 18, H - 38)
  ctx.globalAlpha = 0.22
  ctx.fillText(`FPS ${fps} · LM ${hasHand ? (hasTwo ? '42' : '21') : '—'}`, 18, H - 24)
  ctx.fillText('MEDIAPIPE 1.0.1 · GPU DELEGATE', 18, H - 10)

  ctx.textAlign   = 'right'; ctx.globalAlpha = 0.20
  ctx.fillText(`STATUS ${status.toUpperCase()}`, W - 18, H - 24)
  ctx.fillText('NATURAL UNITS c = ℏ = G = 1', W - 18, H - 10)

  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore()
}

// ── Corner bracket ────────────────────────────────────────────────────────────

function CornerBracket({ pos }) {
  const isTop  = pos[0] === 't', isLeft = pos[1] === 'l'
  const SZ = 28, TH = 2, clr = 'rgba(0,240,255,0.55)'
  return (
    <div style={{
      position: 'fixed',
      [isTop  ? 'top'  : 'bottom']: 14,
      [isLeft ? 'left' : 'right']: 14,
      width: SZ, height: SZ, borderStyle: 'solid', borderColor: clr,
      borderTopWidth: isTop ? TH : 0, borderLeftWidth: isLeft ? TH : 0,
      borderBottomWidth: !isTop ? TH : 0, borderRightWidth: !isLeft ? TH : 0,
      pointerEvents: 'none', zIndex: 9994,
      boxShadow: `${isLeft ? 4 : -4}px ${isTop ? 4 : -4}px 14px rgba(0,240,255,0.10)`,
    }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GestureHUD() {
  const gesture = useGesture()
  const {
    enabled, status, toggle, initError, videoRef,
    landmarksRef, hand2LandmarksRef, pinchingRef,
    peaceRef, fistRef, openPalmRef, thumbsUpRef, twoPinchRef,
    pointerRef, velocityRef,
  } = gesture

  const [gestureLog,   setGestureLog]   = useState([])
  const [guideVisible, setGuideVisible] = useState(true)
  const [hasTwo,       setHasTwo]       = useState(false)

  const overlayRef     = useRef(null)
  const cursorWrapRef  = useRef(null)
  const innerDotRef    = useRef(null)
  const flashElRef     = useRef(null)
  const statusLblRef   = useRef(null)
  const dwellRef       = useRef(null)
  const trailEls       = useRef([])
  const rafRef         = useRef(null)

  const palmStartRef   = useRef(null)
  const trailPosRef    = useRef([])
  const flashStateRef  = useRef({ label: '', opacity: 0, startT: 0 })
  const prevStatusRef  = useRef('idle')

  // New feature refs
  const tipTrailsRef   = useRef(TIP_INDICES.map(() => []))
  const tipTrails2Ref  = useRef(TIP_INDICES.map(() => []))
  const skelHistRef    = useRef([])   // primary hand skeleton history
  const hexStreamRef   = useRef([])
  const pinchBurstRef  = useRef(null)
  const prevPinchRef   = useRef(false)
  const particlesRef   = useRef(null)
  const confRef        = useRef({ pinch: 0, peace: 0, fist: 0, palm: 0, thumbup: 0 })
  const fpsRef         = useRef(60)
  const lastTickRef    = useRef(performance.now())

  // ── Resize ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const c = overlayRef.current
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight }
      particlesRef.current = null  // reinit on resize
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ── Status → log + flash ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    if (status === prevStatusRef.current) return
    prevStatusRef.current = status
    setHasTwo(hand2LandmarksRef.current?.length > 0)
    if (status === 'idle' || status === 'pointing') return
    const color = GESTURE_COLORS[status] ?? CYAN
    const label = STATUS_LABEL[status] ?? status
    setGestureLog(prev => [{ label, color, id: Date.now() }, ...prev].slice(0, LOG_MAX))
    flashStateRef.current = { label, opacity: 1, startT: performance.now() }
  }, [status, enabled, hand2LandmarksRef])

  useEffect(() => {
    const h = () => setGuideVisible(v => !v)
    window.addEventListener('umbra-thumbsup', h)
    return () => window.removeEventListener('umbra-thumbsup', h)
  }, [])

  // ── CSS ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'umbra-gesture-css'
    s.textContent = `
      @keyframes umbra-cw   { to { transform: rotate( 360deg); } }
      @keyframes umbra-ccw  { to { transform: rotate(-360deg); } }
      @keyframes umbra-corner-pulse { 0%,100%{opacity:.45} 50%{opacity:.95} }
      @keyframes umbra-ripple {
        0%   { transform:translate(-50%,-50%) scale(0.3); opacity:1; }
        100% { transform:translate(-50%,-50%) scale(2.8); opacity:0; }
      }
      .umbra-ripple-el {
        position:fixed; pointer-events:none; z-index:10000;
        width:44px; height:44px; border-radius:50%;
        border:2px solid #00f0ff;
        animation:umbra-ripple 0.42s ease-out forwards;
      }
    `
    document.head.appendChild(s)
    return () => document.getElementById('umbra-gesture-css')?.remove()
  }, [])

  // ── Main RAF loop ─────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const now = performance.now()
    const t   = now / 1000
    const W   = window.innerWidth, H = window.innerHeight

    // FPS
    const dt = now - lastTickRef.current
    lastTickRef.current = now
    fpsRef.current = Math.round(fpsRef.current * 0.92 + (1000 / (dt || 16)) * 0.08)

    const lms      = landmarksRef.current
    const lms2     = hand2LandmarksRef.current
    const ptr      = pointerRef.current
    const pinching = pinchingRef.current
    const palm     = openPalmRef.current
    const vel      = velocityRef?.current ?? { x: 0, y: 0 }
    const color    = GESTURE_COLORS[status] ?? CYAN
    const isPointing = status === 'pointing'
    const hasHand  = lms?.length > 0
    const hasSecond = lms2?.length > 0

    // Pinch burst trigger
    if (pinching && !prevPinchRef.current && lms?.[4] && lms?.[8]) {
      pinchBurstRef.current = {
        t0: now,
        cx: (1 - (lms[4].x + lms[8].x) / 2) * W,
        cy: ((lms[4].y + lms[8].y) / 2) * H,
      }
    }
    prevPinchRef.current = pinching

    // Clear on hand loss
    if (!hasHand) {
      tipTrailsRef.current  = TIP_INDICES.map(() => [])
      tipTrails2Ref.current = TIP_INDICES.map(() => [])
      skelHistRef.current   = []
      hexStreamRef.current  = []
    }

    // Update buffers
    if (hasHand) {
      pushTipTrail(tipTrailsRef.current, lms, W, H)
      skelHistRef.current.push(lmsSnapshot(lms))
      if (skelHistRef.current.length > ECHO_FRAMES + 1) skelHistRef.current.shift()
      confRef.current = computeConfidences(lms)
    }
    if (hasSecond) pushTipTrail(tipTrails2Ref.current, lms2, W, H)
    updateHexStream(hexStreamRef.current, lms, W, H, isPointing)

    // Init particles lazily
    if (!particlesRef.current) particlesRef.current = initParticles(W, H)

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = overlayRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      drawScanLine(ctx, W, H, t)

      // Particle field (background layer)
      tickParticles(ctx, particlesRef.current, W, H, lms, status, t)

      // Skeleton echoes
      if (hasHand) drawSkeletonEchoes(ctx, skelHistRef.current, W, H)

      // Tip trails
      if (hasSecond) drawTipTrails(ctx, tipTrails2Ref.current)
      if (hasHand)   drawTipTrails(ctx, tipTrailsRef.current)

      // Neural mesh
      if (hasHand) drawNeuralMesh(ctx, lms, W, H, color)

      // Hand hex bounding outline
      if (hasHand) drawHandHex(ctx, lms, W, H, t)

      // Skeletons
      if (hasSecond) drawFullHand(ctx, lms2, W, H, '#cc88ff', t, false, 0.38)
      if (hasHand)   drawFullHand(ctx, lms,  W, H, color,    t, pinching, 1)

      // Velocity arrows
      if (hasHand) drawVelocityVectors(ctx, tipTrailsRef.current)

      // Pre-pinch tension
      if (hasHand) drawPinchTension(ctx, lms, W, H, t, pinching)

      // Palm sonar (always active when hand visible)
      if (hasHand && !pinching) drawPalmSonar(ctx, lms, W, H, t)

      // Hex cascade
      drawHexStream(ctx, hexStreamRef.current)

      // Wrist badge
      if (hasHand) drawWristBadge(ctx, lms, W, H, vel.x, vel.y, fpsRef.current)

      // Pinch burst
      if (pinchBurstRef.current) {
        const alive = drawPinchBurst(ctx, pinchBurstRef.current, now)
        if (!alive) pinchBurstRef.current = null
      }

      // Gesture confidence panel
      if (hasHand) drawConfidencePanel(ctx, W, H, confRef.current)

      // Corner data
      drawCornerData(ctx, W, H, fpsRef.current, hasHand, hasSecond, status)
    }

    // ── Gesture flash ─────────────────────────────────────────────────────────
    const flashEl = flashElRef.current
    if (flashEl) {
      const fl = flashStateRef.current
      if (fl.opacity > 0) {
        const age = now - fl.startT
        fl.opacity = age < 250 ? 1 : Math.max(0, 1 - (age - 250) / 500)
        flashEl.textContent = fl.label
        flashEl.style.opacity    = fl.opacity
        flashEl.style.color      = GESTURE_COLORS[status] ?? CYAN
        flashEl.style.textShadow = `0 0 35px ${GESTURE_COLORS[status] ?? CYAN}, 0 0 70px ${GESTURE_COLORS[status] ?? CYAN}55`
      } else {
        flashEl.style.opacity = '0'
      }
    }

    // ── Status label ──────────────────────────────────────────────────────────
    const slbl = statusLblRef.current
    if (slbl) { slbl.textContent = STATUS_LABEL[status] ?? 'STANDBY'; slbl.style.color = color }

    // ── Cursor ────────────────────────────────────────────────────────────────
    const wrap = cursorWrapRef.current
    if (wrap) {
      if (ptr && enabled) {
        const sx = ((ptr.x + 1) / 2) * W, sy = ((1 - ptr.y) / 2) * H

        trailPosRef.current.push({ x: sx, y: sy, color })
        if (trailPosRef.current.length > TRAIL_LEN) trailPosRef.current.shift()
        const trail = trailPosRef.current
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailEls.current[i]; if (!el) continue
          const ti  = trail.length - TRAIL_LEN + i
          if (ti < 0) { el.style.opacity = '0'; continue }
          const tp  = trail[ti], frac = (i + 1) / TRAIL_LEN
          const sz  = 2.5 + frac * 7.5
          el.style.transform  = `translate(${tp.x}px, ${tp.y}px)`
          el.style.width      = `${sz}px`; el.style.height     = `${sz}px`
          el.style.marginLeft = `${-sz/2}px`; el.style.marginTop  = `${-sz/2}px`
          el.style.background = tp.color; el.style.opacity = `${frac * 0.5}`
          el.style.boxShadow  = i === TRAIL_LEN - 1 ? `0 0 8px ${tp.color}` : 'none'
        }

        wrap.style.transform = `translate(${sx}px, ${sy}px)`; wrap.style.opacity = '1'
        const dot = innerDotRef.current
        if (dot) {
          const sz = pinching ? 5 : 8
          dot.style.width = `${sz}px`; dot.style.height = `${sz}px`
          dot.style.left  = `${-sz/2}px`; dot.style.top = `${-sz/2}px`
          dot.style.background = color
          dot.style.boxShadow  = `0 0 14px ${color}, 0 0 28px ${color}66`
        }

        const dwell = dwellRef.current
        if (dwell) {
          dwell.style.transform = `translate(${sx}px, ${sy}px)`
          if (palm) {
            if (!palmStartRef.current) palmStartRef.current = now
            const prog = Math.min(1, (now - palmStartRef.current) / PALM_HOLD_MS)
            dwell.style.opacity = '1'
            const dc = dwell.getContext('2d')
            dc.clearRect(0, 0, 72, 72)
            dc.beginPath(); dc.arc(36, 36, 30, 0, Math.PI * 2)
            dc.strokeStyle = 'rgba(153,85,255,0.10)'; dc.lineWidth = 4; dc.stroke()
            dc.beginPath()
            dc.arc(36, 36, 30, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false)
            dc.strokeStyle = `rgba(153,85,255,${0.4 + prog * 0.55})`
            dc.lineWidth   = 4; dc.lineCap = 'round'
            dc.shadowBlur  = 12; dc.shadowColor = '#9955ff'; dc.stroke()
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
  const statusColor   = GESTURE_COLORS[status] ?? CYAN

  return (
    <>
      <video ref={videoRef} muted playsInline
        style={{ position:'fixed', top:-9999, left:-9999, width:1, height:1, opacity:0 }}
      />

      <canvas ref={overlayRef} style={{
        position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9993,
        opacity: enabled ? 1 : 0, transition:'opacity 0.7s ease',
      }} />

      {Array.from({ length: TRAIL_LEN }, (_, i) => (
        <div key={i} ref={el => { trailEls.current[i] = el }}
          style={{
            position:'fixed', top:0, left:0, width:'8px', height:'8px',
            marginLeft:'-4px', marginTop:'-4px', borderRadius:'50%',
            background:CYAN, pointerEvents:'none', zIndex:9996, opacity:0,
          }} />
      ))}

      {/* Multi-ring cursor */}
      <div ref={cursorWrapRef} style={{ position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9999, opacity:0 }}>
        <div style={{
          position:'absolute', width:56, height:56, left:-28, top:-28, borderRadius:'50%',
          border:'1px dashed rgba(0,240,255,0.50)', animation:'umbra-ccw 8s linear infinite',
          boxShadow:'0 0 10px rgba(0,240,255,0.08),inset 0 0 10px rgba(0,240,255,0.04)',
        }} />
        <div style={{
          position:'absolute', width:30, height:30, left:-15, top:-15, borderRadius:'50%',
          border:'1.5px solid rgba(0,240,255,0.85)', animation:'umbra-cw 4s linear infinite',
        }} />
        <div ref={innerDotRef} style={{
          position:'absolute', width:8, height:8, left:-4, top:-4,
          borderRadius:'50%', background:CYAN, boxShadow:`0 0 14px ${CYAN}`,
        }} />
        <div style={{ position:'absolute', width:1, height:12, left:-0.5, top:-34,  background:'rgba(0,240,255,0.65)' }} />
        <div style={{ position:'absolute', width:1, height:12, left:-0.5, top:22,   background:'rgba(0,240,255,0.65)' }} />
        <div style={{ position:'absolute', height:1, width:12, top:-0.5,  left:-34, background:'rgba(0,240,255,0.65)' }} />
        <div style={{ position:'absolute', height:1, width:12, top:-0.5,  left:22,  background:'rgba(0,240,255,0.65)' }} />
      </div>

      <canvas ref={dwellRef} width={72} height={72} style={{
        position:'fixed', top:0, left:0, width:'72px', height:'72px',
        marginLeft:'-36px', marginTop:'-36px', pointerEvents:'none', zIndex:9998, opacity:0,
      }} />

      {enabled && ['tl','tr','bl','br'].map(p => <CornerBracket key={p} pos={p} />)}

      {/* Gesture flash */}
      <div ref={flashElRef} style={{
        position:'fixed', top:'42%', left:'50%', transform:'translateX(-50%)',
        fontFamily:'JetBrains Mono, monospace', fontSize:'clamp(30px,4.5vw,52px)',
        fontWeight:700, letterSpacing:'0.40em', textTransform:'uppercase',
        pointerEvents:'none', zIndex:9997, opacity:0, whiteSpace:'nowrap', userSelect:'none',
      }} />

      {/* Top status bar */}
      {enabled && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, height:30,
          background:'linear-gradient(to bottom,rgba(0,5,14,0.95) 0%,rgba(0,5,14,0.70) 100%)',
          borderBottom:'1px solid rgba(0,240,255,0.12)',
          display:'flex', alignItems:'center', paddingLeft:52, paddingRight:52, gap:14,
          fontFamily:'JetBrains Mono, monospace', fontSize:'8.5px',
          letterSpacing:'0.20em', textTransform:'uppercase', color:'rgba(0,240,255,0.45)',
          pointerEvents:'none', zIndex:9994,
        }}>
          <div style={{
            width:6, height:6, borderRadius:'50%', background:statusColor,
            boxShadow:`0 0 8px ${statusColor}`,
            animation:'umbra-corner-pulse 1.8s ease-in-out infinite', flexShrink:0,
          }} />
          <span style={{ color:'rgba(0,240,255,0.55)' }}>UMBRA · GESTURE</span>
          <span style={{ opacity:0.3 }}>|</span>
          <span ref={statusLblRef} style={{ color:statusColor, transition:'color 0.2s' }}>STANDBY</span>
          <span style={{ opacity:0.3 }}>|</span>
          <span>LANDMARKS 21</span>
          {hasTwo && <><span style={{ opacity:0.3 }}>|</span><span style={{ color:'#ee88ff' }}>DUAL HAND ●</span></>}
          <span style={{ marginLeft:'auto', opacity:0.35 }}>MEDIAPIPE HAND LANDMARKER v1.0.1</span>
        </div>
      )}

      {/* Right panel */}
      <div style={{
        position:'fixed', bottom:20, right:20, zIndex:9998,
        display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8,
        pointerEvents:'none',
      }}>
        {enabled && guideVisible && (
          <div style={{
            width:210, background:'rgba(0,5,14,0.92)',
            border:'1px solid rgba(0,240,255,0.14)', borderRadius:4, padding:'10px 12px',
            boxShadow:'0 0 24px rgba(0,240,255,0.06),0 4px 32px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8,
              fontFamily:'JetBrains Mono, monospace', fontSize:'7px', letterSpacing:'0.22em', textTransform:'uppercase',
            }}>
              <span style={{ color:'rgba(0,240,255,0.35)' }}>◈ GESTURE INTERFACE</span>
              <span style={{ color:'rgba(0,240,255,0.18)', fontSize:'6px' }}>👍 HIDE</span>
            </div>
            <div style={{ height:1, background:'rgba(0,240,255,0.10)', marginBottom:8 }} />
            {GUIDE_ROWS.map(([icon, name, action, id]) => {
              const isActive = id === activeGuideId
              const rowColor = isActive ? statusColor : 'rgba(0,240,255,0.55)'
              return (
                <div key={id} style={{
                  display:'flex', alignItems:'center', gap:8, marginBottom:4.5,
                  opacity: isActive ? 1 : 0.38, transition:'opacity 0.15s',
                  background: isActive ? 'rgba(0,240,255,0.04)' : 'transparent',
                  borderRadius:3, padding:'1px 3px',
                  borderLeft: isActive ? `2px solid ${statusColor}` : '2px solid transparent',
                }}>
                  <span style={{ fontSize:'11px', width:16, textAlign:'center', flexShrink:0 }}>{icon}</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'8px', letterSpacing:'0.08em', color:rowColor, width:52, flexShrink:0, transition:'color 0.15s' }}>{name}</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'7px', color: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', transition:'color 0.15s' }}>{action}</span>
                </div>
              )
            })}
          </div>
        )}

        {enabled && gestureLog.length > 0 && (
          <div style={{
            width:210, background:'rgba(0,5,14,0.82)',
            border:'1px solid rgba(0,240,255,0.08)', borderRadius:4, padding:'7px 12px',
          }}>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'7px', letterSpacing:'0.20em', textTransform:'uppercase', color:'rgba(0,240,255,0.20)', marginBottom:5 }}>Event Stream</div>
            {gestureLog.map((e, i) => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, opacity:Math.max(0.12, 1 - i * 0.17) }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:e.color, flexShrink:0, boxShadow: i === 0 ? `0 0 7px ${e.color}` : 'none' }} />
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'8px', letterSpacing:'0.10em', color: i === 0 ? e.color : 'rgba(255,255,255,0.4)' }}>{e.label}</span>
              </div>
            ))}
          </div>
        )}

        {initError && (
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'9px', color:'#ff4444', background:'rgba(0,5,14,0.92)', border:'1px solid rgba(255,68,68,0.35)', padding:'4px 10px', borderRadius:4, maxWidth:210, pointerEvents:'auto' }}>
            {initError}
          </div>
        )}

        <button onClick={toggle} style={{
          pointerEvents:'auto', fontFamily:'JetBrains Mono, monospace',
          fontSize:'9px', letterSpacing:'0.22em', textTransform:'uppercase',
          padding:'6px 14px', borderRadius:3, cursor:'pointer',
          border: enabled ? `1px solid ${CYAN}88` : '1px solid rgba(0,240,255,0.15)',
          background: enabled ? 'rgba(0,240,255,0.07)' : 'rgba(0,5,14,0.88)',
          color: enabled ? CYAN : 'rgba(0,240,255,0.35)',
          boxShadow: enabled ? `0 0 12px rgba(0,240,255,0.18),inset 0 0 20px rgba(0,240,255,0.03)` : 'none',
          transition:'all 0.2s',
        }} title={enabled ? 'Disable gesture interface' : 'Enable gesture interface (webcam)'}>
          {enabled ? '◈ INTERFACE ACTIVE' : '◈ GESTURE MODE'}
        </button>
      </div>
    </>
  )
}
