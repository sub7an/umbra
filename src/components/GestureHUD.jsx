import { useEffect, useRef, useCallback } from 'react'
import { useGesture } from '../context/GestureContext'
import { HAND_CONNECTIONS } from '../hooks/useHandGesture'

// Draw video frame + hand skeleton onto the preview canvas
function drawFrame(ctx, video, landmarks, W, H, pinching) {
  ctx.clearRect(0, 0, W, H)

  // Mirror the video frame
  if (video && video.readyState >= 2) {
    ctx.save()
    ctx.translate(W, 0)
    ctx.scale(-1, 1)
    ctx.globalAlpha = 0.6
    ctx.drawImage(video, 0, 0, W, H)
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

function drawSkeleton(ctx, landmarks, W, H, pinching) {

  if (!landmarks.length) return

  const toX = (lm) => (1 - lm.x) * W   // mirrored (CSS scaleX(-1) mirrors video)
  const toY = (lm) => lm.y * H

  // Connections
  ctx.lineWidth = 1.5
  ctx.strokeStyle = pinching ? 'rgba(0,229,196,0.9)' : 'rgba(0,229,196,0.5)'
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(toX(landmarks[a]), toY(landmarks[a]))
    ctx.lineTo(toX(landmarks[b]), toY(landmarks[b]))
  }
  ctx.stroke()

  // All landmark dots
  for (let i = 0; i < landmarks.length; i++) {
    const x = toX(landmarks[i])
    const y = toY(landmarks[i])
    ctx.beginPath()
    ctx.arc(x, y, i === 8 || i === 4 ? 4 : 2, 0, Math.PI * 2)
    ctx.fillStyle = i === 8
      ? '#00e5c4'
      : i === 4
      ? (pinching ? '#00e5c4' : '#fb923c')
      : 'rgba(255,255,255,0.5)'
    ctx.fill()
  }

  // Pinch line
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
  const { enabled, status, toggle, initError, videoRef, landmarksRef, pinchingRef, pointerRef } = useGesture()
  const skeletonRef  = useRef(null)
  const cursorRef    = useRef(null)
  const rafRef       = useRef(null)

  // Update skeleton canvas + cursor position every frame
  const tick = useCallback(() => {
    // Video frame + skeleton
    const canvas = skeletonRef.current
    if (canvas && enabled) {
      const ctx = canvas.getContext('2d')
      drawFrame(ctx, videoRef.current, landmarksRef.current, canvas.width, canvas.height, pinchingRef.current)
      drawSkeleton(ctx, landmarksRef.current, canvas.width, canvas.height, pinchingRef.current)
    }

    // Cursor ring
    const cursor = cursorRef.current
    if (cursor) {
      const ptr = pointerRef.current
      if (ptr && enabled) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight
        cursor.style.transform = `translate(${sx}px, ${sy}px)`
        cursor.style.opacity   = '1'
        cursor.style.width     = pinchingRef.current ? '18px' : '32px'
        cursor.style.height    = pinchingRef.current ? '18px' : '32px'
        cursor.style.borderColor = pinchingRef.current ? 'rgba(0,229,196,1)' : 'rgba(0,229,196,0.7)'
        cursor.style.boxShadow   = pinchingRef.current
          ? '0 0 12px 4px rgba(0,229,196,0.6), inset 0 0 8px rgba(0,229,196,0.3)'
          : '0 0 8px 2px rgba(0,229,196,0.35)'
      } else {
        cursor.style.opacity = '0'
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [enabled, landmarksRef, pinchingRef, pointerRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  return (
    <>
      {/* Video always in DOM so videoRef.current is available before enabled state updates */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      {/* ── Full-screen gesture cursor ring ── */}
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
          transition:    'width 0.1s, height 0.1s, border-color 0.1s, box-shadow 0.1s',
        }}
      />

      {/* ── HUD panel (bottom-right) ── */}
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
        {/* Preview canvas (video drawn into it in tick()) */}
        {enabled && (
          <div
            style={{
              position:     'relative',
              width:        '160px',
              height:       '90px',
              borderRadius: '4px',
              overflow:     'hidden',
              border:       '1px solid rgba(0,229,196,0.25)',
              background:   '#04090c',
            }}
          >
            <canvas
              ref={skeletonRef}
              width={160}
              height={90}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
            {/* Status badge */}
            <div style={{
              position:   'absolute',
              top:        '4px',
              left:       '4px',
              fontFamily: 'monospace',
              fontSize:   '8px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:  status === 'pinching' ? '#00e5c4' : status === 'pointing' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
              padding: '1px 4px',
              background: 'rgba(4,9,12,0.7)',
              borderRadius: '2px',
            }}>
              {status}
            </div>
          </div>
        )}

        {/* Error message */}
        {initError && (
          <div style={{
            fontFamily:  'monospace',
            fontSize:    '9px',
            color:       '#fb923c',
            background:  'rgba(4,9,12,0.85)',
            border:      '1px solid rgba(251,146,60,0.3)',
            padding:     '4px 8px',
            borderRadius: '4px',
            maxWidth:    '160px',
            pointerEvents: 'auto',
          }}>
            {initError}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          style={{
            pointerEvents: 'auto',
            fontFamily:  'monospace',
            fontSize:    '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding:     '5px 10px',
            borderRadius: '4px',
            cursor:      'pointer',
            border:      enabled
              ? '1px solid rgba(0,229,196,0.6)'
              : '1px solid rgba(255,255,255,0.12)',
            background:  enabled
              ? 'rgba(0,229,196,0.08)'
              : 'rgba(4,9,12,0.85)',
            color:       enabled ? '#00e5c4' : 'rgba(255,255,255,0.4)',
            boxShadow:   enabled ? '0 0 8px rgba(0,229,196,0.2)' : 'none',
            transition:  'all 0.2s',
          }}
          title={enabled ? 'Disable hand gestures' : 'Enable hand gestures (requires webcam)'}
        >
          {enabled ? '✋ GESTURE ON' : '✋ GESTURE'}
        </button>
      </div>
    </>
  )
}
