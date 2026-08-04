import { useEffect, useRef } from 'react'
import { useGesture } from '../context/GestureContext'

// Watches for quick pinch gestures and fires DOM click events at the cursor position.
// This makes every button / card on the page clickable via gesture without touching
// individual components.
export default function GestureEventBridge() {
  const { enabled, pointerRef, pinchingRef } = useGesture()

  const wasPinchRef     = useRef(false)
  const pinchStartRef   = useRef(0)          // timestamp
  const pinchStartPosRef = useRef(null)      // { x, y } screen px

  useEffect(() => {
    if (!enabled) {
      wasPinchRef.current = false
      return
    }

    let rafId

    const tick = () => {
      const ptr      = pointerRef.current
      const pinching = pinchingRef.current

      if (ptr) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight

        if (pinching && !wasPinchRef.current) {
          // Pinch started
          wasPinchRef.current     = true
          pinchStartRef.current   = performance.now()
          pinchStartPosRef.current = { x: sx, y: sy }
        } else if (!pinching && wasPinchRef.current) {
          // Pinch released — check if it counts as a click
          wasPinchRef.current = false
          const duration = performance.now() - pinchStartRef.current
          const start    = pinchStartPosRef.current
          const moved    = start ? Math.hypot(sx - start.x, sy - start.y) : 999

          if (duration < 400 && moved < 55) {
            // Find the deepest element at the pointer, walk up to the first clickable
            let el = document.elementFromPoint(sx, sy)
            while (el && el !== document.body) {
              const tag = el.tagName
              if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || el.role === 'button') break
              el = el.parentElement
            }
            if (el && el !== document.body) {
              el.dispatchEvent(new MouseEvent('click', {
                clientX: sx, clientY: sy,
                bubbles: true, cancelable: true,
              }))
            }
          }
        }
      } else {
        wasPinchRef.current = false
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, pointerRef, pinchingRef])

  return null
}
