import { useEffect, useRef } from 'react'
import useModuleStore from '../store/useModuleStore'

const MOD_COLOR = {
  'special-relativity':  [245, 166,  35],
  'quantum-mechanics':   [168,  85, 247],
  'frontier-physics':    [139,  92, 246],
  'dynamical-systems':   [ 34, 197,  94],
  'electromagnetism':    [ 59, 130, 246],
  'general-relativity':  [249, 115,  22],
  'thermodynamics':      [239,  68,  68],
  'fluid-dynamics':      [ 14, 165, 233],
  'acoustic-physics':    [ 20, 184, 166],
  'wave-mechanics':      [ 99, 102, 241],
  'optics':              [251, 191,  36],
  'physics-sandbox':     [  0, 229, 196],
}
const DEFAULT = [0, 229, 196]

export default function CursorAura() {
  const canvasRef = useRef()
  const particles = useRef([])
  const rafRef    = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e) => {
      const mod = useModuleStore.getState().activeModule
      const col = MOD_COLOR[mod] || DEFAULT
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2
        const spd   = Math.random() * 0.9 + 0.15
        particles.current.push({
          x: e.clientX + (Math.random() - 0.5) * 8,
          y: e.clientY + (Math.random() - 0.5) * 8,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.25,
          r:  Math.random() * 2.8 + 1.0,
          a:  0.45 + Math.random() * 0.35,
          col,
          life:    0,
          maxLife: 380 + Math.random() * 280,
        })
      }
      if (particles.current.length > 180) {
        particles.current.splice(0, particles.current.length - 180)
      }
    }
    window.addEventListener('mousemove', onMove)

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(now - last, 33)
      last = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'screen'

      particles.current = particles.current.filter(p => p.life < p.maxLife)

      for (const p of particles.current) {
        p.life += dt
        p.x += p.vx * dt / 16
        p.y += p.vy * dt / 16
        p.vx *= 0.965
        p.vy *= 0.965

        const t    = p.life / p.maxLife
        const alpha = p.a * (1 - t) * (1 - t)
        if (alpha < 0.004) continue

        const rad = p.r * (1 + t * 1.5) * 4
        const g   = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
        g.addColorStop(0, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${alpha})`)
        g.addColorStop(1, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 9998,
      }}
    />
  )
}
