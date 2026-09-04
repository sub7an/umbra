import { useEffect, useRef } from 'react'
import { useGesture } from '../context/GestureContext'

const DWELL_MS       = 1500   // ms hover over a button → auto-click
const DWELL_MOVE_THR = 22     // px — cancel dwell if cursor moves this far
const PINCH_CLICK_MS = 400    // max ms for a pinch to count as click
const PINCH_MOVE_THR = 55     // px

// ── Helpers ───────────────────────────────────────────────────────────────────

function spawnRipple(sx, sy, color = '#00e5c4') {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position:     'fixed',
    left:         `${sx}px`,
    top:          `${sy}px`,
    width:        '44px',
    height:       '44px',
    borderRadius: '50%',
    border:       `2px solid ${color}`,
    pointerEvents:'none',
    zIndex:       '10000',
    animation:    'umbra-ripple 0.42s ease-out forwards',
  })
  el.classList.add('umbra-ripple-el')
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

function findClickable(el) {
  while (el && el !== document.body) {
    const tag = el.tagName
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || el.role === 'button') return el
    el = el.parentElement
  }
  return null
}

function clickResetButton() {
  const rst = [...document.querySelectorAll('button')]
    .find(b => /^(rst|reset)$/i.test(b.textContent?.trim()))
  rst?.click()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GestureEventBridge() {
  const { enabled, pointerRef, pinchingRef, fistRef } = useGesture()

  const wasPinchRef      = useRef(false)
  const pinchStartRef    = useRef(0)
  const pinchStartPosRef = useRef(null)
  const wasFistRef       = useRef(false)

  // Dwell state
  const dwellTargetRef   = useRef(null)
  const dwellStartRef    = useRef(null)
  const dwellOriginRef   = useRef(null)
  const dwellFiredRef    = useRef(false)
  const dwellCanvasRef   = useRef(null)

  // Slider drag state
  const sliderDragRef    = useRef(null)

  // ── Dwell ring canvas ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width  = 64
    canvas.height = 64
    Object.assign(canvas.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '64px',
      height:        '64px',
      marginLeft:    '-32px',
      marginTop:     '-32px',
      pointerEvents: 'none',
      zIndex:        '9997',
      opacity:       '0',
    })
    document.body.appendChild(canvas)
    dwellCanvasRef.current = canvas
    return () => canvas.remove()
  }, [])

  // ── Swipe → tab cycle or page scroll ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const dir  = e.detail.dir
      const tabs = [...document.querySelectorAll('[role="tab"]')]

      if ((dir === 'left' || dir === 'right') && tabs.length >= 2) {
        // Cycle module view tabs
        const activeIdx = tabs.findIndex(t =>
          t.getAttribute('aria-selected') === 'true' ||
          t.classList.contains('text-sky-glow')
        )
        if (activeIdx === -1) return
        const delta   = dir === 'right' ? -1 : 1  // camera is mirrored
        const nextIdx = (activeIdx + delta + tabs.length) % tabs.length
        tabs[nextIdx].click()
      } else if (dir === 'up') {
        window.scrollBy({ top: 300, behavior: 'smooth' })
      } else if (dir === 'down') {
        window.scrollBy({ top: -300, behavior: 'smooth' })
      }
    }
    window.addEventListener('umbra-swipe', handler)
    return () => window.removeEventListener('umbra-swipe', handler)
  }, [])

  // ── Main frame loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      wasPinchRef.current = false
      wasFistRef.current  = false
      dwellTargetRef.current = null
      sliderDragRef.current  = null
      if (dwellCanvasRef.current) dwellCanvasRef.current.style.opacity = '0'
      return
    }

    let rafId

    const tick = () => {
      const ptr      = pointerRef.current
      const pinching = pinchingRef.current
      const fist     = fistRef.current

      // ── Fist: click Reset on leading edge ─────────────────────────────────
      if (fist && !wasFistRef.current) clickResetButton()
      wasFistRef.current = fist

      // ── Pointer-dependent logic ───────────────────────────────────────────
      if (ptr) {
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight

        // ── Pinch-drag for range sliders ───────────────────────────────────
        if (pinching) {
          if (!wasPinchRef.current) {
            // Pinch started — check for slider under cursor
            wasPinchRef.current      = true
            pinchStartRef.current    = performance.now()
            pinchStartPosRef.current = { x: sx, y: sy }

            const el = document.elementFromPoint(sx, sy)
            const slider = el?.closest('input[type="range"]') ?? (el?.type === 'range' ? el : null)
            if (slider) {
              sliderDragRef.current = {
                el,
                startX:     sx,
                startValue: parseFloat(slider.value),
                min:        parseFloat(slider.min  ?? 0),
                max:        parseFloat(slider.max  ?? 1),
                step:       parseFloat(slider.step ?? 0.001),
                rect:       slider.getBoundingClientRect(),
              }
            }
          } else if (sliderDragRef.current) {
            // Slider drag in progress
            const { el, startX, startValue, min, max, step, rect } = sliderDragRef.current
            const sliderW  = rect.width || window.innerWidth * 0.25
            const deltaX   = sx - startX
            const newValue = Math.max(min, Math.min(max, startValue + (deltaX / sliderW) * (max - min)))
            const stepped  = Math.round(newValue / step) * step
            el.value = stepped
            el.dispatchEvent(new Event('input',  { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        } else {
          // ── Pinch released — maybe a click ─────────────────────────────
          if (wasPinchRef.current) {
            wasPinchRef.current = false
            const duration = performance.now() - pinchStartRef.current
            const start    = pinchStartPosRef.current
            const moved    = start ? Math.hypot(sx - start.x, sy - start.y) : 999

            if (!sliderDragRef.current && duration < PINCH_CLICK_MS && moved < PINCH_MOVE_THR) {
              const target = findClickable(document.elementFromPoint(sx, sy))
              if (target) {
                target.dispatchEvent(new MouseEvent('click', { clientX: sx, clientY: sy, bubbles: true, cancelable: true }))
                spawnRipple(sx, sy)
              }
            }
            sliderDragRef.current = null
          }

          // ── Dwell-click: hover 1.5s over a button ────────────────────────
          const hitEl    = document.elementFromPoint(sx, sy)
          const clickable = findClickable(hitEl)
          const dc = dwellCanvasRef.current

          if (clickable && clickable !== document.body) {
            if (dwellTargetRef.current !== clickable) {
              // New target — restart dwell
              dwellTargetRef.current = clickable
              dwellStartRef.current  = performance.now()
              dwellOriginRef.current = { x: sx, y: sy }
              dwellFiredRef.current  = false
            } else {
              const moved   = dwellOriginRef.current
                ? Math.hypot(sx - dwellOriginRef.current.x, sy - dwellOriginRef.current.y)
                : 999
              if (moved > DWELL_MOVE_THR) {
                // Moved too much — cancel
                dwellTargetRef.current = null
                dwellStartRef.current  = null
                if (dc) dc.style.opacity = '0'
              } else {
                const elapsed  = performance.now() - dwellStartRef.current
                const progress = Math.min(1, elapsed / DWELL_MS)

                // Draw dwell arc on canvas
                if (dc) {
                  dc.style.transform = `translate(${sx}px, ${sy}px)`
                  dc.style.opacity   = progress > 0.04 ? '1' : '0'
                  const c = dc.getContext('2d')
                  c.clearRect(0, 0, 64, 64)
                  // Background ring
                  c.beginPath()
                  c.arc(32, 32, 27, 0, Math.PI * 2)
                  c.strokeStyle = 'rgba(0,229,196,0.08)'
                  c.lineWidth   = 3
                  c.stroke()
                  // Progress arc
                  c.beginPath()
                  c.arc(32, 32, 27, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false)
                  c.strokeStyle = `rgba(0,229,196,${0.45 + progress * 0.5})`
                  c.lineWidth   = 3
                  c.lineCap     = 'round'
                  c.stroke()
                }

                if (progress >= 1 && !dwellFiredRef.current) {
                  dwellFiredRef.current = true
                  clickable.click()
                  spawnRipple(sx, sy, '#a78bfa')
                  // Reset after a pause so it doesn't immediately re-trigger
                  setTimeout(() => {
                    dwellTargetRef.current = null
                    dwellStartRef.current  = null
                    dwellFiredRef.current  = false
                    if (dc) dc.style.opacity = '0'
                  }, 1200)
                }
              }
            }
          } else {
            // No clickable under cursor
            if (dwellTargetRef.current) {
              dwellTargetRef.current = null
              dwellStartRef.current  = null
              if (dc) dc.style.opacity = '0'
            }
          }
        }
      } else {
        // No hand detected
        wasPinchRef.current = false
        sliderDragRef.current = null
        dwellTargetRef.current = null
        if (dwellCanvasRef.current) dwellCanvasRef.current.style.opacity = '0'
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, pointerRef, pinchingRef, fistRef])

  return null
}
