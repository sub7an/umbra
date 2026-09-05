import { useEffect, useRef } from 'react'

// Accent color per module id
const MODULE_COLOR = {
  null:                 '#5e6ad2',
  'physics-sandbox':    '#84cc16',
  'wave-mechanics':     '#22d3ee',
  'optics':             '#fcd34d',
  'special-relativity': '#5e6ad2',
  'quantum-mechanics':  '#f59e0b',
  'frontier-physics':   '#e040fb',
  'dynamical-systems':  '#10b981',
  'electromagnetism':   '#a855f7',
  'general-relativity': '#fb923c',
  'thermodynamics':     '#38bdf8',
  'fluid-dynamics':     '#2dd4bf',
  'sabrina':            '#ff69b4',
}

function hexRgb(hex) {
  const n = parseInt((hex ?? '#5e6ad2').replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const N_STARS = 260
const OUT_DUR = 520
const IN_DUR  = 560

/**
 * Hyperspace warp: radial light-streaks accelerate outward to a flash on
 * exit ('out'), then decelerate and settle on arrival ('in').
 */
export default function TransitionOverlay({ phase, targetModule }) {
  const canvasRef = useRef()
  const rafRef    = useRef()

  useEffect(() => {
    if (phase === 'idle') return
    cancelAnimationFrame(rafRef.current)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    const [r, g, b] = hexRgb(MODULE_COLOR[targetModule])

    // Star field: random positions, depth factor controls speed + thickness
    const px = new Float32Array(N_STARS)
    const py = new Float32Array(N_STARS)
    const dz = new Float32Array(N_STARS) // pseudo-depth 0.3–1.3

    const seed = (i) => {
      const a = Math.random() * Math.PI * 2
      const d = 10 + Math.random() * Math.hypot(W, H) * 0.5
      px[i] = cx + Math.cos(a) * d
      py[i] = cy + Math.sin(a) * d
      dz[i] = 0.3 + Math.random()
    }
    for (let i = 0; i < N_STARS; i++) seed(i)

    const dur   = phase === 'out' ? OUT_DUR : IN_DUR
    const start = performance.now()

    const tick = () => {
      const elapsed = performance.now() - start
      const t = Math.min(elapsed / dur, 1)

      // Background: hard fade to black going out, release coming in
      const bgAlpha = phase === 'out' ? Math.min(t * 1.6, 1) * 0.97 : (1 - t) * 0.97
      ctx.fillStyle = `rgba(6,7,9,${bgAlpha})`
      ctx.fillRect(0, 0, W, H)

      // Warp speed curve: exponential ramp out, exponential decay in
      const ramp = phase === 'out' ? Math.pow(t, 2.4) : Math.pow(1 - t, 2.4)
      const speed = 2 + ramp * 58

      const starAlpha = phase === 'out' ? Math.min(t * 2.5, 1) : Math.min((1 - t) * 2.5, 1)

      ctx.lineCap = 'round'
      for (let i = 0; i < N_STARS; i++) {
        const dx = px[i] - cx, dy = py[i] - cy
        const dist = Math.hypot(dx, dy) + 0.001
        const ux = dx / dist, uy = dy / dist
        const spd = speed * dz[i] * (0.5 + dist / Math.hypot(W, H))

        px[i] += ux * spd
        py[i] += uy * spd
        if (px[i] < -80 || px[i] > W + 80 || py[i] < -80 || py[i] > H + 80) seed(i)

        const len = Math.min(spd * 2.4, 300)
        const a = starAlpha * (0.35 + dz[i] * 0.45)

        // Colored streak
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.lineWidth = dz[i] * 2.2
        ctx.beginPath()
        ctx.moveTo(px[i], py[i])
        ctx.lineTo(px[i] - ux * len, py[i] - uy * len)
        ctx.stroke()

        // White-hot core
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.55})`
        ctx.lineWidth = dz[i] * 0.8
        ctx.beginPath()
        ctx.moveTo(px[i], py[i])
        ctx.lineTo(px[i] - ux * len * 0.55, py[i] - uy * len * 0.55)
        ctx.stroke()
      }

      // Flash: peak of 'out' / first instants of 'in'
      const flashT = phase === 'out'
        ? Math.max(0, (t - 0.78) / 0.22)
        : Math.max(0, 1 - t / 0.25)
      if (flashT > 0) {
        const R = Math.max(W, H) * 0.55
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
        grad.addColorStop(0, `rgba(255,255,255,${flashT * 0.85})`)
        grad.addColorStop(0.25, `rgba(${r},${g},${b},${flashT * 0.5})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, targetModule])

  if (phase === 'idle') return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        inset:          0,
        zIndex:         5000,
        pointerEvents: 'none',
        display:       'block',
      }}
    />
  )
}
