import { useEffect, useRef } from 'react'

// Accent color per module id
const MODULE_COLOR = {
  null:                 '#00e5c4',
  'physics-sandbox':    '#84cc16',
  'wave-mechanics':     '#22d3ee',
  'special-relativity': '#00e5c4',
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
  const n = parseInt((hex ?? '#00e5c4').replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const N_PARTICLES = 180

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

    // Particle state
    const px = new Float32Array(N_PARTICLES)
    const py = new Float32Array(N_PARTICLES)
    const vx = new Float32Array(N_PARTICLES)
    const vy = new Float32Array(N_PARTICLES)
    const sz = new Float32Array(N_PARTICLES)

    const maxR = Math.hypot(W, H) * 0.55

    if (phase === 'out') {
      // Scatter across screen, will converge to center
      for (let i = 0; i < N_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist  = maxR * (0.25 + Math.random() * 0.75)
        px[i] = cx + Math.cos(angle) * dist
        py[i] = cy + Math.sin(angle) * dist
        vx[i] = 0; vy[i] = 0
        sz[i] = 1.2 + Math.random() * 2.8
      }
    } else {
      // Start clustered at center, will scatter outward
      for (let i = 0; i < N_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2
        px[i] = cx + Math.cos(angle) * 15
        py[i] = cy + Math.sin(angle) * 15
        const spd = 4 + Math.random() * 12
        vx[i] = Math.cos(angle) * spd
        vy[i] = Math.sin(angle) * spd
        sz[i] = 1.2 + Math.random() * 2.8
      }
    }

    const OUT_DUR = 380
    const IN_DUR  = 400
    const dur     = phase === 'out' ? OUT_DUR : IN_DUR
    const start   = performance.now()

    const tick = () => {
      const elapsed = performance.now() - start
      const t = Math.min(elapsed / dur, 1)

      // Background fade
      const bgAlpha = phase === 'out' ? t * 0.97 : (1 - t) * 0.97
      ctx.fillStyle = `rgba(4,9,12,${bgAlpha})`
      ctx.fillRect(0, 0, W, H)

      // Scanline sweep (every 14px, faint, moves with t)
      if (t > 0.15 && t < 0.85) {
        const scanAlpha = Math.sin((t - 0.15) / 0.7 * Math.PI) * 0.04
        ctx.strokeStyle = `rgba(${r},${g},${b},${scanAlpha})`
        ctx.lineWidth = 1
        const offset = (t * H * 0.8) % 14
        for (let y = offset; y < H; y += 14) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
        }
      }

      // Particles
      const pAlpha = phase === 'out' ? Math.min(t * 3, 1) : 1 - t * t

      for (let i = 0; i < N_PARTICLES; i++) {
        if (phase === 'out') {
          // Converge toward center with accelerating pull
          const dx  = cx - px[i], dy = cy - py[i]
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
          const f    = (1.5 + t * 12) / dist
          vx[i] += dx * f * 0.015
          vy[i] += dy * f * 0.015
          vx[i] *= 0.91; vy[i] *= 0.91
        }

        px[i] += vx[i]
        py[i] += vy[i]

        const a = pAlpha * (0.5 + 0.5 * Math.random())
        ctx.beginPath()
        ctx.arc(px[i], py[i], sz[i], 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fill()
      }

      // Central glow burst at peak of 'out' and start of 'in'
      const glowT = phase === 'out'
        ? Math.max(0, (t - 0.75) / 0.25)
        : Math.max(0, 1 - t / 0.3)
      if (glowT > 0) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180)
        grad.addColorStop(0, `rgba(${r},${g},${b},${glowT * 0.9})`)
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${glowT * 0.25})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(cx, cy, 180, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
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
