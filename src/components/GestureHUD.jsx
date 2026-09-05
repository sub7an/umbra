import { useEffect, useRef, useState } from 'react'
import { useGesture } from '../context/GestureContext'
import { HAND_CONNECTIONS } from '../hooks/useHandGesture'

/**
 * GestureHUD — compact tracking dock, bottom-right.
 *
 * Collapsed: a single "GESTURE" pill. Enabled: a small mirrored camera chip
 * with the live hand skeleton, a status line, and the three-rule hint.
 * Styled to match the instrument language of the rest of the site.
 */

const STATUS_LABEL = {
  idle:     'OFF',
  tracking: 'TRACKING',
  pinching: 'PINCH',
  twopinch: 'ZOOM',
}

const CHIP_W = 176
const CHIP_H = 99

export default function GestureHUD() {
  const { enabled, status, initError, toggle, videoRef, allHandsRef, pinchingRef } = useGesture()
  const canvasRef = useRef(null)
  const [showCoach, setShowCoach] = useState(false)

  // One-time coach toast on first enable
  useEffect(() => {
    if (!enabled) return
    if (localStorage.getItem('umbra_gesture_coached') === '1') return
    localStorage.setItem('umbra_gesture_coached', '1')
    setShowCoach(true)
    const t = setTimeout(() => setShowCoach(false), 6000)
    return () => clearTimeout(t)
  }, [enabled])

  // Skeleton overlay on the camera chip
  useEffect(() => {
    if (!enabled) return
    let rafId
    const draw = () => {
      const c = canvasRef.current
      if (c) {
        const ctx = c.getContext('2d')
        ctx.clearRect(0, 0, CHIP_W, CHIP_H)
        const hands = allHandsRef.current
        const pinching = pinchingRef.current
        for (let h = 0; h < hands.length; h++) {
          const lms = hands[h]
          const X = (p) => (1 - p.x) * CHIP_W   // mirror to match the user
          const Y = (p) => p.y * CHIP_H
          ctx.strokeStyle = pinching ? 'rgba(139,156,247,0.9)' : 'rgba(94,106,210,0.55)'
          ctx.lineWidth = 1
          for (const [a, b] of HAND_CONNECTIONS) {
            ctx.beginPath()
            ctx.moveTo(X(lms[a]), Y(lms[a]))
            ctx.lineTo(X(lms[b]), Y(lms[b]))
            ctx.stroke()
          }
          ctx.fillStyle = pinching ? '#8b9cf7' : 'rgba(94,106,210,0.8)'
          for (const p of [lms[4], lms[8]]) {
            ctx.beginPath()
            ctx.arc(X(p), Y(p), 2.4, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, allHandsRef, pinchingRef])

  const live = enabled && status !== 'idle'

  return (
    <>
      {/* Hidden video element — the tracking hook streams the webcam into it */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Dock */}
      <div style={{
        position: 'fixed', bottom: 14, right: 14, zIndex: 10010,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
      }}>
        {live && (
          <div style={{
            width: CHIP_W, borderRadius: 4, overflow: 'hidden',
            border: '1px solid rgba(94,106,210,0.25)',
            background: 'rgba(8,9,10,0.85)', backdropFilter: 'blur(10px)',
            animation: 'umbra-slide-up 0.25s ease',
          }}>
            <div style={{ position: 'relative', width: CHIP_W, height: CHIP_H }}>
              {/* Mirrored preview */}
              <video
                muted playsInline autoPlay
                ref={(el) => {
                  if (el && videoRef.current?.srcObject && el.srcObject !== videoRef.current.srcObject) {
                    el.srcObject = videoRef.current.srcObject
                  }
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: 'scaleX(-1)', opacity: 0.55, display: 'block',
                }}
              />
              <canvas
                ref={canvasRef}
                width={CHIP_W}
                height={CHIP_H}
                style={{ position: 'absolute', inset: 0 }}
              />
              <div style={{
                position: 'absolute', top: 5, left: 7,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                letterSpacing: '0.16em',
                color: status === 'pinching' || status === 'twopinch' ? '#8b9cf7' : 'rgba(94,106,210,0.75)',
              }}>
                {STATUS_LABEL[status] ?? 'TRACKING'}
              </div>
            </div>
            <div style={{
              padding: '5px 8px', borderTop: '1px solid rgba(94,106,210,0.12)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
              letterSpacing: '0.08em', lineHeight: 1.7, color: 'rgba(247,248,248,0.45)',
            }}>
              PINCH = CLICK · DRAG<br />
              EMPTY SPACE = ORBIT · 2 HANDS = ZOOM
            </div>
          </div>
        )}

        <button
          onClick={toggle}
          title={enabled ? 'Turn off hand tracking' : 'Control Umbra with your hand via webcam'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
            color: enabled ? '#8b9cf7' : 'rgba(94,106,210,0.6)',
            background: 'rgba(8,9,10,0.72)', backdropFilter: 'blur(8px)',
            border: `1px solid ${enabled ? 'rgba(139,156,247,0.45)' : 'rgba(94,106,210,0.2)'}`,
            borderRadius: 3, padding: '5px 10px', cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: enabled ? '#8b9cf7' : 'rgba(94,106,210,0.35)',
            boxShadow: enabled ? '0 0 6px #8b9cf7' : 'none',
            animation: enabled ? 'umbra-pulse 1.6s ease-in-out infinite' : 'none',
          }} />
          GESTURE
        </button>

        {initError && (
          <div style={{
            maxWidth: 220, textAlign: 'right',
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11,
            color: 'rgba(239,68,68,0.8)',
          }}>
            {initError}
          </div>
        )}
      </div>

      {/* First-run coach */}
      {showCoach && (
        <div style={{
          position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10120, padding: '18px 26px', borderRadius: 6,
          background: 'rgba(8,9,10,0.95)', border: '1px solid rgba(94,106,210,0.35)',
          backdropFilter: 'blur(12px)', textAlign: 'center',
          animation: 'umbra-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            letterSpacing: '0.24em', color: '#8b9cf7', marginBottom: 10,
          }}>
            HAND TRACKING ON
          </div>
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14,
            lineHeight: 1.8, color: 'rgba(247,248,248,0.85)',
          }}>
            Your hand is the cursor. <b style={{ color: '#8b9cf7' }}>Pinch</b> to click and drag sliders.<br />
            Pinch <b style={{ color: '#8b9cf7' }}>empty space</b> to orbit · pinch with <b style={{ color: '#8b9cf7' }}>both hands</b> to zoom.
          </div>
        </div>
      )}
    </>
  )
}
