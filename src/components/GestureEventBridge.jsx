import { useEffect, useRef } from 'react'
import { useGesture } from '../context/GestureContext'

const PINCH_CLICK_MS = 500   // max press duration that still counts as a click
const PINCH_MOVE_THR = 48    // px of drift allowed during a click press

/**
 * GestureEventBridge — the virtual mouse.
 *
 * Renders the hand cursor (indigo reticle in the site's design language) and
 * translates pinches into UI actions:
 *
 *   pinch on a button  → click (fires on release, targets the element that
 *                        was under the cursor when the press STARTED)
 *   pinch on a slider  → drag it
 *   pinch elsewhere    → claimed by nothing: SceneWrapper orbits the camera
 *
 * It also mirrors hover: buttons light up as the cursor passes, exactly as
 * they do for the mouse, so targeting feels native.
 */

function findClickable(el) {
  while (el && el !== document.body) {
    const tag = el.tagName
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || el.role === 'button') return el
    el = el.parentElement
  }
  return null
}

function spawnRipple(sx, sy, color = '#5e6ad2') {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'fixed', left: `${sx}px`, top: `${sy}px`,
    width: '44px', height: '44px', borderRadius: '50%',
    border: `2px solid ${color}`, pointerEvents: 'none', zIndex: '10000',
    animation: 'umbra-ripple 0.42s ease-out forwards',
  })
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

function makeCursor() {
  const root = document.createElement('div')
  Object.assign(root.style, {
    position: 'fixed', top: '0', left: '0', width: '34px', height: '34px',
    marginLeft: '-17px', marginTop: '-17px',
    pointerEvents: 'none', zIndex: '10020', opacity: '0',
    transition: 'opacity 0.2s',
    willChange: 'transform',
  })
  root.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 34 34" style="display:block">
      <circle data-ring cx="17" cy="17" r="12" fill="none"
        stroke="rgba(94,106,210,0.9)" stroke-width="1.5"
        style="transition: r 0.12s, stroke 0.12s"/>
      <circle data-fill cx="17" cy="17" r="0" fill="rgba(94,106,210,0.28)"
        style="transition: r 0.12s"/>
      <circle cx="17" cy="17" r="2.2" fill="#5e6ad2"/>
    </svg>`
  document.body.appendChild(root)
  return {
    root,
    ring: root.querySelector('[data-ring]'),
    fill: root.querySelector('[data-fill]'),
  }
}

export default function GestureEventBridge() {
  const { enabled, pointerRef, pinchingRef, uiBusyRef } = useGesture()

  const cursorRef        = useRef(null)
  const wasPinchRef      = useRef(false)
  const pinchStartRef    = useRef(0)
  const pinchStartPosRef = useRef(null)
  const pinchTargetRef   = useRef(null)
  const hoverElRef       = useRef(null)
  const sliderDragRef    = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const cursor = makeCursor()
    cursorRef.current = cursor
    let rafId

    const setHover = (el) => {
      const prev = hoverElRef.current
      if (el === prev) return
      if (prev) prev.dispatchEvent(new MouseEvent('mouseout',  { bubbles: true }))
      if (el)   el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      hoverElRef.current = el
    }

    const tick = () => {
      const ptr      = pointerRef.current
      const pinching = pinchingRef.current

      if (!ptr) {
        // Hand lost: release everything cleanly
        cursor.root.style.opacity = '0'
        wasPinchRef.current    = false
        sliderDragRef.current  = null
        pinchTargetRef.current = null
        setHover(null)
        rafId = requestAnimationFrame(tick)
        return
      }

      const sx = ((ptr.x + 1) / 2) * window.innerWidth
      const sy = ((1 - ptr.y) / 2) * window.innerHeight

      // ── Cursor visual ─────────────────────────────────────────────────────
      cursor.root.style.opacity   = '1'
      cursor.root.style.transform = `translate(${sx}px, ${sy}px)`
      cursor.ring.setAttribute('r', pinching ? '8' : '12')
      cursor.fill.setAttribute('r', pinching ? '7' : '0')
      cursor.ring.setAttribute('stroke', pinching ? '#8b9cf7' : 'rgba(94,106,210,0.9)')

      if (pinching) {
        if (!wasPinchRef.current) {
          // ── Press ───────────────────────────────────────────────────────
          wasPinchRef.current      = true
          pinchStartRef.current    = performance.now()
          pinchStartPosRef.current = { x: sx, y: sy }

          const el     = document.elementFromPoint(sx, sy)
          const slider = el?.closest('input[type="range"]') ?? (el?.type === 'range' ? el : null)
          pinchTargetRef.current = findClickable(el)

          // Claim UI pinches so the camera stays still during them
          uiBusyRef.current = !!(slider || pinchTargetRef.current)

          if (slider) {
            sliderDragRef.current = {
              el:         slider,
              startX:     sx,
              startValue: parseFloat(slider.value),
              min:        parseFloat(slider.min  ?? 0),
              max:        parseFloat(slider.max  ?? 1),
              step:       parseFloat(slider.step ?? 0.001),
              rect:       slider.getBoundingClientRect(),
            }
          }
        } else if (sliderDragRef.current) {
          // ── Slider drag ─────────────────────────────────────────────────
          const { el, startX, startValue, min, max, step, rect } = sliderDragRef.current
          const sliderW  = rect.width || window.innerWidth * 0.25
          const newValue = Math.max(min, Math.min(max,
            startValue + ((sx - startX) / sliderW) * (max - min)))
          const stepped  = Math.round(newValue / step) * step
          el.value = stepped
          el.dispatchEvent(new Event('input',  { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      } else {
        if (wasPinchRef.current) {
          // ── Release: click if it was quick and steady ────────────────────
          wasPinchRef.current = false
          const duration = performance.now() - pinchStartRef.current
          const start    = pinchStartPosRef.current
          const moved    = start ? Math.hypot(sx - start.x, sy - start.y) : 999

          if (!sliderDragRef.current && duration < PINCH_CLICK_MS && moved < PINCH_MOVE_THR) {
            const target = pinchTargetRef.current
            if (target && document.contains(target)) {
              target.dispatchEvent(new MouseEvent('click', {
                clientX: start.x, clientY: start.y, bubbles: true, cancelable: true,
              }))
              spawnRipple(start.x, start.y)
            }
          }
          sliderDragRef.current  = null
          pinchTargetRef.current = null
        }

        // ── Hover mirroring (only while not pressing) ─────────────────────
        setHover(findClickable(document.elementFromPoint(sx, sy)))
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      setHover(null)
      cursor.root.remove()
      cursorRef.current = null
      wasPinchRef.current    = false
      sliderDragRef.current  = null
      pinchTargetRef.current = null
    }
  }, [enabled, pointerRef, pinchingRef, uiBusyRef])

  return null
}
