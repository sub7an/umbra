import { useEffect, useRef, useCallback } from 'react'
import { useGesture } from '../context/GestureContext'
import { HAND_CONNECTIONS } from '../hooks/useHandGesture'

const PALM_HOLD_MS = 820

const STATUS_COLOR = {
  idle:       'rgba(255,255,255,0.22)',
  pointing:   'rgba(255,255,255,0.65)',
  pinching:   '#00e5c4',
  peace:      '#60a5fa',
  fist:       '#fb923c',
  open_palm:  '#a78bfa',
}

const STATUS_LABEL = {
  idle:       'IDLE',
  pointing:   'POINT',
  pinching:   'PINCH',
  peace:      'PEACE',
  fist:       'FIST',
  open_palm:  'PALM',
}

const GESTURE_GUIDE = [
  ['👆', 'Point',  'aim cursor'],
  ['🤏', 'Pinch',  'click / select'],
  ['✌️', 'Peace',  'orbit scene'],
  ['✊', 'Fist',   'reset sim'],
  ['🖐', 'Hold',   '← back to menu'],
  ['⚡', 'Swipe',  'change view'],
]

function drawFrame(ctx, video, W, H) {
  ctx.clearRect(0, 0, W, H)
  if (video && video.readyState >= 2) {
    ctx.save()
    ctx.translate(W, 0)
    ctx.scale(-1, 1)
    ctx.globalAlpha = 0.55
    ctx.drawImage(video, 0, 0, W, H)
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

function drawSkeleton(ctx, landmarks, W, H, pinching, peace, fist, openPalm) {
  if (!landmarks.length) return
  const toX = (lm) => (1 - lm.x) * W
  const toY = (lm) => lm.y * H

  const lineColor = fist      ? 'rgba(251,146,60,0.85)'
                  : openPalm  ? 'rgba(167,139,250,0.85)'
                  : peace     ? 'rgba(96,165,250,0.85)'
                  : pinching  ? 'rgba(0,229,196,0.9)'
                  : 'rgba(0,229,196,0.5)'

  ctx.lineWidth = 1.5
  ctx.strokeStyle = lineColor
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(toX(landmarks[a]), toY(landmarks[a]))
    ctx.lineTo(toX(landmarks[b]), toY(landmarks[b]))
  }
  ctx.stroke()

  for (let i = 0; i < landmarks.length; i++) {
    const x = toX(landmarks[i])
    const y = toY(landmarks[i])
    ctx.beginPath()
    ctx.arc(x, y, i === 8 || i === 4 ? 4 : 2, 0, Math.PI * 2)
    ctx.fillStyle = i === 8 ? '#00e5c4'
      : i === 4 ? (pinching ? '#00e5c4' : '#fb923c')
      : 'rgba(255,255,255,0.45)'
    ctx.fill()
  }

  if (pinching) {
    ctx.beginPath()
    ctx.moveTo(toX(landmarks[4]), toY(landmarks[4]))
    ctx.lineTo(toX(landmarks[8]), toY(landmarks[8]))
    ctx.strokeStyle = 'rgba(0,229,196,0.9)'
    ctx.lineWidth = 2
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
  const rafRef       = useRef(null)
  const palmStartRef = useRef(null)

  // Inject global CSS for ripple animation
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

    // Skeleton canvas
    const canvas = skeletonRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      drawFrame(ctx, videoRef.current, W, H)
      drawSkeleton(ctx, landmarksRef.current, W, H, pinching, peace, fist, openPalm)
    }

    // Cursor ring
    const cursor = cursorRef.current
    const dwell  = dwellRef.current
    if (cursor) {
      if (ptr && enabled) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight

        const transform = `translate(${sx}px,${sy}px)`
        cursor.style.transform = transform

        const color = pinching  ? '#00e5c4'
                    : fist      ? '#fb923c'
                    : openPalm  ? '#a78bfa'
                    : peace     ? '#60a5fa'
                    : 'rgba(0,229,196,0.7)'

        const size = pinching ? 18 : fist ? 14 : openPalm ? 36 : peace ? 28 : 32
        cursor.style.width  = `${size}px`
        cursor.style.height = `${size}px`
        cursor.style.marginLeft  = `${-size / 2}px`
        cursor.style.marginTop   = `${-size / 2}px`
        cursor.style.borderColor = color
        cursor.style.boxShadow   = pinching
          ? `0 0 14px 5px rgba(0,229,196,0.55), inset 0 0 8px rgba(0,229,196,0.25)`
          : `0 0 8px 2px ${color}55`
        cursor.style.opacity = '1'

        // Dwell arc for open palm
        if (dwell) {
          dwell.style.transform = transform
          if (openPalm) {
            if (!palmStartRef.current) palmStartRef.current = performance.now()
            const t = Math.min(1, (performance.now() - palmStartRef.current) / PALM_HOLD_MS)
            dwell.style.opacity = '1'
            const c = dwell.getContext('2d')
            c.clearRect(0, 0, 56, 56)
            if (t > 0.01) {
              c.beginPath()
              c.arc(28, 28, 23, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2, false)
              c.strokeStyle = `rgba(167,139,250,${0.4 + t * 0.55})`
              c.lineWidth = 3.5
              c.lineCap = 'round'
              c.stroke()
            }
          } else {
            palmStartRef.current = null
            dwell.style.opacity = '0'
          }
        }
      } else {
        cursor.style.opacity = '0'
        if (dwell) { dwell.style.opacity = '0'; palmStartRef.current = null }
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [enabled, videoRef, landmarksRef, pinchingRef, peaceRef, fistRef, openPalmRef, pointerRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  const statusColor = STATUS_COLOR[status] ?? 'rgba(255,255,255,0.3)'

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      {/* Cursor ring */}
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
          transition:    'width 0.08s, height 0.08s, border-color 0.12s, box-shadow 0.12s',
        }}
      />

      {/* Dwell arc canvas — positioned at same cursor location */}
      <canvas
        ref={dwellRef}
        width={56}
        height={56}
        style={{
          position:      'fixed',
          top:            0,
          left:           0,
          width:         '56px',
          height:        '56px',
          marginLeft:    '-28px',
          marginTop:     '-28px',
          pointerEvents: 'none',
          zIndex:         9998,
          opacity:        0,
        }}
      />

      {/* HUD panel bottom-right */}
      <div
        style={{
          position:   'fixed',
          bottom:     '20px',
          right:      '20px',
          zIndex:     9998,
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap:        '8px',
          pointerEvents: 'none',
        }}
      >
        {enabled && (
          <>
            {/* Camera feed */}
            <div style={{
              position:     'relative',
              width:        '200px',
              height:       '112px',
              borderRadius: '5px',
              overflow:     'hidden',
              border:       `1px solid ${statusColor}44`,
              background:   '#04090c',
              transition:   'border-color 0.25s',
            }}>
              <canvas
                ref={skeletonRef}
                width={200}
                height={112}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
              {/* Status badge */}
              <div style={{
                position:      'absolute',
                top:           '5px',
                left:          '5px',
                fontFamily:    'JetBrains Mono, monospace',
                fontSize:      '8px',
                letterSpacing: '0.14em',
                color:         statusColor,
                padding:       '1px 5px',
                background:    'rgba(4,9,12,0.75)',
                borderRadius:  '2px',
                transition:    'color 0.2s',
              }}>
                {STATUS_LABEL[status] ?? status.toUpperCase()}
              </div>
            </div>

            {/* Gesture guide */}
            <div style={{
              width:        '200px',
              background:   'rgba(4,9,12,0.88)',
              border:       '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              padding:      '8px 10px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '7px', letterSpacing: '0.20em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.22)', marginBottom: '7px',
              }}>
                Gesture Guide
              </div>
              {GESTURE_GUIDE.map(([icon, gesture, action]) => (
                <div key={gesture} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', width: '16px', textAlign: 'center', lineHeight: 1 }}>{icon}</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '8px', letterSpacing: '0.06em',
                    color: 'rgba(0,229,196,0.72)', width: '42px', flexShrink: 0,
                  }}>
                    {gesture}
                  </span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '7px', color: 'rgba(255,255,255,0.32)',
                  }}>
                    {action}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {initError && (
          <div style={{
            fontFamily:  'JetBrains Mono, monospace',
            fontSize:    '9px',
            color:       '#fb923c',
            background:  'rgba(4,9,12,0.88)',
            border:      '1px solid rgba(251,146,60,0.3)',
            padding:     '4px 8px',
            borderRadius: '4px',
            maxWidth:    '200px',
            pointerEvents: 'auto',
          }}>
            {initError}
          </div>
        )}

        <button
          onClick={toggle}
          style={{
            pointerEvents: 'auto',
            fontFamily:    'JetBrains Mono, monospace',
            fontSize:      '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding:       '5px 10px',
            borderRadius:  '4px',
            cursor:        'pointer',
            border:        enabled
              ? '1px solid rgba(0,229,196,0.6)'
              : '1px solid rgba(255,255,255,0.12)',
            background:    enabled ? 'rgba(0,229,196,0.08)' : 'rgba(4,9,12,0.85)',
            color:         enabled ? '#00e5c4' : 'rgba(255,255,255,0.4)',
            boxShadow:     enabled ? '0 0 8px rgba(0,229,196,0.2)' : 'none',
            transition:    'all 0.2s',
          }}
          title={enabled ? 'Disable hand gestures' : 'Enable hand gestures (requires webcam)'}
        >
          {enabled ? '✋ GESTURE ON' : '✋ GESTURE'}
        </button>
      </div>
    </>
  )
}
