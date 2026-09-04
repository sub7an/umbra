import { useEffect, useRef } from 'react'

const STAR_COUNT = 170

function initStars(w, h) {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: i < 20 ? 1.1 + Math.random() * 0.8 : 0.3 + Math.random() * 0.9,
    speed: 0.005 + Math.random() * 0.016,
    opacity: i < 20 ? 0.55 + Math.random() * 0.45 : 0.18 + Math.random() * 0.6,
  }))
}

export default function Hero({ onScrollDown }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ stars: [], raf: null })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const state = stateRef.current

    const resize = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      state.stars = initStars(w, h)
    }

    const draw = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      for (const s of state.stars) {
        s.y += s.speed
        if (s.y > h + 2) {
          s.y = -2
          s.x = Math.random() * w
        }
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(223,242,237,${s.opacity})`
        ctx.fill()
      }

      state.raf = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(state.raf)
      ro.disconnect()
    }
  }, [])

  return (
    <section className="relative flex flex-col items-center justify-center w-full min-h-screen overflow-hidden">
      {/* Starfield */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.6 }}
      />

      {/* Measurement grid — very faint, ties hero to the osc world */}
      <div
        aria-hidden="true"
        className="absolute inset-0 osc-grid pointer-events-none"
        style={{ opacity: 0.18 }}
      />

      {/* Radial vignette — pushes darkness to edges, draws eye to center */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 75% 65% at 50% 42%, transparent 15%, rgba(7,11,13,0.75) 65%, #070b0d 90%)',
        }}
      />

      {/* Bottom fade — seamless merge into module section */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #070b0d)' }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto">
        {/* Live system status */}
        <div className="flex items-center gap-2.5 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow shadow-glow-cyan animate-pulse-glow flex-shrink-0" />
          <span className="font-mono-data text-[10px] tracking-[0.28em] uppercase text-text-dim">
            Instrument Array · Online
          </span>
        </div>

        {/* Title */}
        <h1
          className="font-display font-bold text-text-primary leading-none tracking-tight mb-7 glow-cyan"
          style={{ fontSize: 'clamp(4rem, 14vw, 6.5rem)' }}
        >
          Umbra
        </h1>

        {/* Scan-line accent under title */}
        <div
          className="mb-8 h-px w-20"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(0,229,196,0.45), transparent)',
          }}
        />

        {/* Tagline */}
        <p
          className="font-body text-base sm:text-lg leading-relaxed max-w-lg mb-14"
          style={{ color: '#8fc9c0' }}
        >
          Special relativity, quantum mechanics, and the universe's biggest unsolved
          problems — live in 3D, in your browser.
        </p>

        {/* Scroll CTA */}
        <button
          onClick={onScrollDown}
          aria-label="Scroll to explore modules"
          className="group flex flex-col items-center gap-3 cursor-pointer transition-colors duration-300"
          style={{ color: '#4a9090' }}
        >
          <span className="font-mono-data text-[10px] tracking-[0.3em] uppercase group-hover:text-cyan-glow transition-colors duration-300">
            Explore modules
          </span>
          <svg
            width="18"
            height="11"
            viewBox="0 0 18 11"
            fill="none"
            className="animate-float group-hover:text-cyan-glow transition-colors duration-300"
            style={{ opacity: 0.7 }}
          >
            <path
              d="M1 1L9 9.5L17 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  )
}
