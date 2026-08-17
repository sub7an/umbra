import { useEffect, useRef, useCallback } from 'react'
import { useGesture } from '../context/GestureContext'

const PALM_HOLD_MS = 820
const TRAIL_LEN    = 9

// ── Per-finger connection groups ─────────────────────────────────────────────
const FINGER_SEGS = [
  { key: 'palm',   color: 'rgba(255,255,255,0.28)', pairs: [[0,1],[0,5],[5,9],[9,13],[13,17],[0,17]] },
  { key: 'thumb',  color: '#fb923c',                pairs: [[1,2],[2,3],[3,4]] },
  { key: 'index',  color: '#00e5c4',                pairs: [[5,6],[6,7],[7,8]] },
  { key: 'middle', color: '#60a5fa',                pairs: [[9,10],[10,11],[11,12]] },
  { key: 'ring',   color: '#a78bfa',                pairs: [[13,14],[14,15],[15,16]] },
  { key: 'pinky',  color: '#f472b6',                pairs: [[17,18],[18,19],[19,20]] },
]

const TIP_COLORS = { 4: '#fb923c', 8: '#00e5c4', 12: '#60a5fa', 16: '#a78bfa', 20: '#f472b6' }

const STATUS_COLOR = {
  idle:       'rgba(255,255,255,0.22)',
  pointing:   'rgba(255,255,255,0.65)',
  pinching:   '#00e5c4',
  peace:      '#60a5fa',
  fist:       '#fb923c',
  open_palm:  '#a78bfa',
}

const STATUS_LABEL = {
  idle: 'IDLE', pointing: 'POINT', pinching: 'PINCH',
  peace: 'PEACE', fist: 'FIST', open_palm: 'PALM',
}

const STATUS_TO_GUIDE = {
  pointing: 'point', pinching: 'pinch', peace: 'peace',
  fist: 'fist', open_palm: 'hold', idle: null,
}

const GESTURE_GUIDE = [
  ['👆', 'Point',  'aim cursor',     'point'],
  ['🤏', 'Pinch',  'click · drag',   'pinch'],
  ['✌️', 'Peace',  'orbit scene',    'peace'],
  ['✊', 'Fist',   'reset sim',      'fist'],
  ['🖐', 'Hold',   '← back',         'hold'],
  ['⚡', 'Swipe',  'change view',    'swipe'],
]

function drawFrame(ctx, video, W, H) {
  ctx.clearRect(0, 0, W, H)
  if (video?.readyState >= 2) {
    ctx.save()
    ctx.translate(W, 0)
    ctx.scale(-1, 1)
    ctx.globalAlpha = 0.5
    ctx.drawImage(video, 0, 0, W, H)
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

function drawSkeleton(ctx, landmarks, W, H, pinching) {
  if (!landmarks.length) return
  const toX = (lm) => (1 - lm.x) * W
  const toY = (lm) => lm.y * H

  // Per-finger colored connections
  for (const { color, pairs } of FINGER_SEGS) {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6
    for (const [a, b] of pairs) {
      ctx.moveTo(toX(landmarks[a]), toY(landmarks[a]))
      ctx.lineTo(toX(landmarks[b]), toY(landmarks[b]))
    }
    ctx.stroke()
  }

  // Landmark dots — tips colored per finger, others white
  for (let i = 0; i < landmarks.length; i++) {
    const x = toX(landmarks[i])
    const y = toY(landmarks[i])
    const isTip = i in TIP_COLORS
    ctx.beginPath()
    ctx.arc(x, y, isTip ? 4.5 : 2, 0, Math.PI * 2)
    ctx.fillStyle = TIP_COLORS[i] ?? 'rgba(255,255,255,0.4)'
    ctx.fill()
  }

  // Pinch line
  if (pinching && landmarks[4] && landmarks[8]) {
    ctx.beginPath()
    ctx.moveTo(toX(landmarks[4]), toY(landmarks[4]))
    ctx.lineTo(toX(landmarks[8]), toY(landmarks[8]))
    ctx.strokeStyle = 'rgba(0,229,196,0.95)'
    ctx.lineWidth = 2.2
    ctx.stroke()
  }
}

export default function GestureHUD() {
  const {
    enabled, status, toggle, initError,
    videoRef, landmarksRef, pinchingRef, peaceRef, fistRef, openPalmRef, pointerRef,
  } = useGesture()

  const skeletonRef  = useRef(null)
  const cursorRef    = useRef(null)
  const dwellRef     = useRef(null)
  const trailEls     = useRef([])
  const rafRef       = useRef(null)

  // Smooth velocity for cursor stretch
  const smoothVelRef    = useRef({ x: 0, y: 0 })
  const prevCursorRef   = useRef(null)
  // Trail buffer
  const trailPosRef     = useRef([])
  // Palm hold tracking (local copy)
  const palmStartRef    = useRef(null)

  // Inject global CSS for ripple + dwell
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'umbra-gesture-css'
    style.textContent = `
      @keyframes umbra-ripple {
        0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 1; }
        100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
      }
      .umbra-ripple-el {
        position: fixed; pointer-events: none; z-index: 10000;
        width: 44px; height: 44px; border-radius: 50%;
        border: 2px solid #00e5c4;
        animation: umbra-ripple 0.42s ease-out forwards;
      }
      @keyframes umbra-dwell-ring {
        0%   { box-shadow: 0 0 0 0 rgba(0,229,196,0.55); }
        100% { box-shadow: 0 0 0 6px rgba(0,229,196,0); }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('umbra-gesture-css')?.remove()
  }, [])

  const tick = useCallback(() => {
    const pinching = pinchingRef.current
    const peace    = peaceRef.current
    const fist     = fistRef.current
    const openPalm = openPalmRef.current
    const ptr      = pointerRef.current

    // ── Skeleton canvas ──────────────────────────────────────────────────────
    const canvas = skeletonRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      drawFrame(ctx, videoRef.current, canvas.width, canvas.height)
      drawSkeleton(ctx, landmarksRef.current, canvas.width, canvas.height, pinching)
    }

    // ── Compute gesture color ─────────────────────────────────────────────────
    const color = pinching  ? '#00e5c4'
                : fist      ? '#fb923c'
                : openPalm  ? '#a78bfa'
                : peace     ? '#60a5fa'
                : 'rgba(0,229,196,0.7)'

    // ── Cursor ring ──────────────────────────────────────────────────────────
    const cursor = cursorRef.current
    const dwell  = dwellRef.current
    if (cursor) {
      if (ptr && enabled) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight

        // Screen-space velocity for stretch
        const prev = prevCursorRef.current
        const rawVx = prev ? sx - prev.x : 0
        const rawVy = prev ? sy - prev.y : 0
        prevCursorRef.current = { x: sx, y: sy }
        smoothVelRef.current.x = smoothVelRef.current.x * 0.72 + rawVx * 0.28
        smoothVelRef.current.y = smoothVelRef.current.y * 0.72 + rawVy * 0.28
        const svx = smoothVelRef.current.x
        const svy = smoothVelRef.current.y
        const speed = Math.sqrt(svx*svx + svy*svy)
        const stretch = 1 + Math.min(speed / 16, 1.1)
        const angle   = speed > 0.6 ? Math.atan2(svy, svx) * 180 / Math.PI : 0

        // Trail
        trailPosRef.current.push({ x: sx, y: sy, color })
        if (trailPosRef.current.length > TRAIL_LEN) trailPosRef.current.shift()
        const trail = trailPosRef.current
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailEls.current[i]
          if (!el) continue
          const ti = trail.length - TRAIL_LEN + i
          if (ti < 0) { el.style.opacity = '0'; continue }
          const tp  = trail[ti]
          const frac = (i + 1) / TRAIL_LEN
          const sz  = 3 + frac * 8
          el.style.transform    = `translate(${tp.x}px, ${tp.y}px)`
          el.style.width        = `${sz}px`
          el.style.height       = `${sz}px`
          el.style.marginLeft   = `${-sz / 2}px`
          el.style.marginTop    = `${-sz / 2}px`
          el.style.background   = tp.color
          el.style.opacity      = `${frac * 0.45}`
        }

        // Cursor style
        const size = pinching ? 18 : fist ? 14 : openPalm ? 36 : peace ? 28 : 32
        cursor.style.width       = `${size}px`
        cursor.style.height      = `${size}px`
        cursor.style.marginLeft  = `${-size / 2}px`
        cursor.style.marginTop   = `${-size / 2}px`
        cursor.style.borderColor = color
        cursor.style.boxShadow   = pinching
          ? `0 0 14px 5px rgba(0,229,196,0.55), inset 0 0 8px rgba(0,229,196,0.25)`
          : `0 0 8px 2px ${color}55`
        cursor.style.transform   = `translate(${sx}px, ${sy}px) rotate(${angle}deg) scaleX(${stretch})`
        cursor.style.opacity     = '1'

        // ── Palm hold dwell arc ─────────────────────────────────────────────
        if (dwell) {
          dwell.style.transform = `translate(${sx}px, ${sy}px)`
          if (openPalm) {
            if (!palmStartRef.current) palmStartRef.current = performance.now()
            const t = Math.min(1, (performance.now() - palmStartRef.current) / PALM_HOLD_MS)
            dwell.style.opacity = '1'
            const c = dwell.getContext('2d')
            c.clearRect(0, 0, 56, 56)
            c.beginPath()
            c.arc(28, 28, 23, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2, false)
            c.strokeStyle = `rgba(167,139,250,${0.38 + t * 0.56})`
            c.lineWidth   = 3.5
            c.lineCap     = 'round'
            c.stroke()
          } else {
            palmStartRef.current = null
            dwell.style.opacity  = '0'
          }
        }
      } else {
        cursor.style.opacity = '0'
        trailPosRef.current  = []
        smoothVelRef.current = { x: 0, y: 0 }
        prevCursorRef.current = null
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailEls.current[i]
          if (el) el.style.opacity = '0'
        }
        if (dwell) { dwell.style.opacity = '0'; palmStartRef.current = null }
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [enabled, videoRef, landmarksRef, pinchingRef, peaceRef, fistRef, openPalmRef, pointerRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  const statusColor   = STATUS_COLOR[status] ?? 'rgba(255,255,255,0.3)'
  const activeGuideId = STATUS_TO_GUIDE[status] ?? null

  return (
    <>
      {/* Hidden video element */}
      <video
        ref={videoRef}
        muted playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      {/* Trail dots — pre-rendered, updated via refs in tick */}
      {Array.from({ length: TRAIL_LEN }, (_, i) => (
        <div
          key={i}
          ref={el => { trailEls.current[i] = el }}
          style={{
            position: 'fixed', top: 0, left: 0,
            width: '8px', height: '8px',
            marginLeft: '-4px', marginTop: '-4px',
            borderRadius: '50%',
            background: 'rgba(0,229,196,0.8)',
            pointerEvents: 'none',
            zIndex: 9996,
            opacity: 0,
          }}
        />
      ))}

      {/* Cursor ring — velocity-stretched ellipse */}
      <div
        ref={cursorRef}
        style={{
          position:      'fixed',
          top:            0,
          left:           0,
          width:          '32px',
          height:         '32px',
          marginLeft:    '-16px',
          marginTop:     '-16px',
          borderRadius:  '50%',
          border:        '2px solid rgba(0,229,196,0.7)',
          boxShadow:     '0 0 8px 2px rgba(0,229,196,0.35)',
          pointerEvents: 'none',
          zIndex:         9999,
          opacity:        0,
          transition:    'width 0.07s, height 0.07s, border-color 0.12s, box-shadow 0.12s',
        }}
      />

      {/* Palm hold dwell arc */}
      <canvas
        ref={dwellRef}
        width={56} height={56}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '56px', height: '56px',
          marginLeft: '-28px', marginTop: '-28px',
          pointerEvents: 'none',
          zIndex: 9998,
          opacity: 0,
        }}
      />

      {/* HUD panel — bottom right */}
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px',
        zIndex: 9998,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
        pointerEvents: 'none',
      }}>

        {enabled && (
          <>
            {/* Camera feed */}
            <div style={{
              position: 'relative', width: '200px', height: '112px',
              borderRadius: '5px', overflow: 'hidden',
              border: `1px solid ${statusColor}44`,
              background: '#04090c',
              transition: 'border-color 0.25s',
            }}>
              <canvas
                ref={skeletonRef}
                width={200} height={112}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
              {/* Status badge */}
              <div style={{
                position: 'absolute', top: '5px', left: '5px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '8px', letterSpacing: '0.14em',
                color: statusColor,
                padding: '1px 5px',
                background: 'rgba(4,9,12,0.75)',
                borderRadius: '2px', transition: 'color 0.2s',
              }}>
                {STATUS_LABEL[status] ?? status.toUpperCase()}
              </div>
            </div>

            {/* Gesture guide */}
            <div style={{
              width: '200px',
              background: 'rgba(4,9,12,0.88)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px', padding: '8px 10px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '7px', letterSpacing: '0.20em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.20)', marginBottom: '7px',
              }}>
                Gesture Guide
              </div>
              {GESTURE_GUIDE.map(([icon, gesture, action, id]) => {
                const isActive = id === activeGuideId
                return (
                  <div
                    key={gesture}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      marginBottom: '4px',
                      opacity: isActive ? 1 : 0.42,
                      transition: 'opacity 0.18s',
                      background: isActive ? 'rgba(0,229,196,0.05)' : 'transparent',
                      borderRadius: '2px',
                      padding: isActive ? '1px 3px' : '1px 3px',
                    }}
                  >
                    <span style={{ fontSize: '11px', width: '16px', textAlign: 'center', lineHeight: 1 }}>{icon}</span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '8px', letterSpacing: '0.06em',
                      color: isActive ? statusColor : 'rgba(0,229,196,0.65)',
                      width: '42px', flexShrink: 0, transition: 'color 0.18s',
                    }}>
                      {gesture}
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '7px',
                      color: isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)',
                      transition: 'color 0.18s',
                    }}>
                      {action}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {initError && (
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
            color: '#fb923c',
            background: 'rgba(4,9,12,0.88)', border: '1px solid rgba(251,146,60,0.3)',
            padding: '4px 8px', borderRadius: '4px', maxWidth: '200px',
            pointerEvents: 'auto',
          }}>
            {initError}
          </div>
        )}

        <button
          onClick={toggle}
          style={{
            pointerEvents: 'auto',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: '4px', cursor: 'pointer',
            border: enabled ? '1px solid rgba(0,229,196,0.6)' : '1px solid rgba(255,255,255,0.12)',
            background: enabled ? 'rgba(0,229,196,0.08)' : 'rgba(4,9,12,0.85)',
            color: enabled ? '#00e5c4' : 'rgba(255,255,255,0.4)',
            boxShadow: enabled ? '0 0 8px rgba(0,229,196,0.2)' : 'none',
            transition: 'all 0.2s',
          }}
          title={enabled ? 'Disable hand gestures' : 'Enable hand gestures (requires webcam)'}
        >
          {enabled ? '✋ GESTURE ON' : '✋ GESTURE'}
        </button>
      </div>
    </>
  )
}
