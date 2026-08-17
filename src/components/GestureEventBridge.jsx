import { useEffect, useRef } from 'react'
import { useGesture } from '../context/GestureContext'

function spawnRipple(sx, sy) {
  const el = document.createElement('div')
  el.className = 'umbra-ripple-el'
  el.style.left = `${sx}px`
  el.style.top  = `${sy}px`
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

function clickResetButton() {
  const btns = [...document.querySelectorAll('button')]
  const rst  = btns.find(b => /^(rst|reset)$/i.test(b.textContent?.trim()))
  rst?.click()
}

export default function GestureEventBridge() {
  const { enabled, pointerRef, pinchingRef, fistRef } = useGesture()

  const wasPinchRef      = useRef(false)
  const pinchStartRef    = useRef(0)
  const pinchStartPosRef = useRef(null)
  const wasFistRef       = useRef(false)

  // ── Swipe → cycle module view tabs ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const dir  = e.detail.dir
      const tabs = [...document.querySelectorAll('[role="tab"]')]
      if (tabs.length < 2) return

      // Find the active tab: aria-selected or active styling class
      const activeIdx = tabs.findIndex(t =>
        t.getAttribute('aria-selected') === 'true' ||
        t.classList.contains('text-sky-glow')
      )
      if (activeIdx === -1) return

      // Mirror: swipe right = previous tab, swipe left = next tab (camera is mirrored)
      const delta   = dir === 'right' ? -1 : 1
      const nextIdx = (activeIdx + delta + tabs.length) % tabs.length
      tabs[nextIdx].click()
    }
    window.addEventListener('umbra-swipe', handler)
    return () => window.removeEventListener('umbra-swipe', handler)
  }, [])

  // ── Main frame loop: pinch-click + fist-reset ─────────────────────────────
  useEffect(() => {
    if (!enabled) {
      wasPinchRef.current = false
      wasFistRef.current  = false
      return
    }

    let rafId

    const tick = () => {
      const ptr      = pointerRef.current
      const pinching = pinchingRef.current
      const fist     = fistRef.current

      // ── Fist: click Reset button on leading edge ─────────────────────────
      if (fist && !wasFistRef.current) {
        clickResetButton()
      }
      wasFistRef.current = fist

      // ── Pinch-to-click ───────────────────────────────────────────────────
      if (ptr) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight

        if (pinching && !wasPinchRef.current) {
          wasPinchRef.current      = true
          pinchStartRef.current    = performance.now()
          pinchStartPosRef.current = { x: sx, y: sy }
        } else if (!pinching && wasPinchRef.current) {
          wasPinchRef.current = false
          const duration = performance.now() - pinchStartRef.current
          const start    = pinchStartPosRef.current
          const moved    = start ? Math.hypot(sx - start.x, sy - start.y) : 999

          if (duration < 400 && moved < 55) {
            let el = document.elementFromPoint(sx, sy)
            while (el && el !== document.body) {
              const tag = el.tagName
              if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || el.role === 'button') break
              el = el.parentElement
            }
            if (el && el !== document.body) {
              el.dispatchEvent(new MouseEvent('click', { clientX: sx, clientY: sy, bubbles: true, cancelable: true }))
              spawnRipple(sx, sy)
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
  }, [enabled, pointerRef, pinchingRef, fistRef])

  return null
}
