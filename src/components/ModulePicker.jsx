import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import useModuleStore from '../store/useModuleStore'
import PhysicsBg from './PhysicsBg'
import { useGesture } from '../context/GestureContext'

const SECRET_PHRASE = 'sabrina'
const STORE_KEY     = 'umbra_unlocked'

function checkUnlocked() {
  if (sessionStorage.getItem(STORE_KEY) === '1') return true
  if (window.location.hash === '#sabrina') {
    sessionStorage.setItem(STORE_KEY, '1')
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return true
  }
  return false
}

const MODULES = [
  {
    id: 'special-relativity',
    name: 'Special Relativity',
    abbr: 'SR',
    tagline: 'Light cones · Time dilation · Length contraction',
    description:
      'Lorentz transform at relativistic velocities. Clocks slow, rods shrink as β → 1. Light cone geometry in Minkowski space.',
    color: 'cyan',
    formula: 'γ = 1/√(1−β²)',
  },
  {
    id: 'quantum-mechanics',
    name: 'Quantum Mechanics',
    abbr: 'QM',
    tagline: 'Wave functions · Uncertainty · Entanglement',
    description:
      'Probability amplitudes, the Schrödinger equation, and quantum superposition visualized in Hilbert space. Bloch sphere and double-slit.',
    color: 'amber',
    formula: 'iℏ ∂ψ/∂t = Ĥψ',
  },
  {
    id: 'frontier-physics',
    name: 'Frontier Physics',
    abbr: 'FP',
    tagline: 'Dark matter · Hubble expansion · Rotation curves',
    description:
      'Galaxy kinematics vs. Keplerian predictions. What the data shows, what is inferred, and what remains unknown.',
    color: 'rose',
    formula: 'v_obs ≫ v_kep',
  },
  {
    id: 'dynamical-systems',
    name: 'Dynamical Systems',
    abbr: 'DS',
    tagline: 'Strange attractors · Chaos · Phase space',
    description:
      '1,800 RK4-integrated particles tracing Lorenz, Rössler, Thomas, and Aizawa attractors. Adjust σ, ρ, β live.',
    color: 'emerald',
    formula: 'dX/dt = F(X)',
  },
  {
    id: 'electromagnetism',
    name: 'Electromagnetism',
    abbr: 'EM',
    tagline: '3D field lines · Biot-Savart · Halbach arrays',
    description:
      'Real Biot-Savart field computation in 3D. RK4-traced field lines for dipole, bar magnet, solenoid, and Halbach array.',
    color: 'violet',
    formula: 'B = μ₀/4π ∮ Idℓ×r̂/r²',
  },
  {
    id: 'general-relativity',
    name: 'General Relativity',
    abbr: 'GR',
    tagline: 'Spacetime curvature · Geodesics · Gravitational waves',
    description:
      'Einstein\'s field equations. Spacetime warp under mass, geodesic precession, and gravitational wave emission from a binary.',
    color: 'orange',
    formula: 'G_μν + Λg_μν = 8πT_μν',
  },
  {
    id: 'thermodynamics',
    name: 'Thermodynamics',
    abbr: 'TD',
    tagline: 'Maxwell-Boltzmann · Entropy · Heat engines',
    description:
      'Statistical mechanics in motion. Gas particles colliding in real time, entropy increasing as order dissolves, Carnot cycles on a PV diagram.',
    color: 'sky',
    formula: 'S = k_B ln Ω',
  },
  {
    id: 'fluid-dynamics',
    name: 'Fluid Dynamics',
    abbr: 'FD',
    tagline: 'Streamlines · Vortex shedding · SPH',
    description:
      'Potential flow, Kármán vortex street via discrete vortex method, and smoothed particle hydrodynamics dam break.',
    color: 'teal',
    formula: 'ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u',
  },
]

// Accent hex per color name (for inline styles only)
const ACCENT_HEX = {
  cyan:    '#00e5c4',
  amber:   '#f59e0b',
  rose:    '#e040fb',
  emerald: '#10b981',
  violet:  '#a855f7',
  orange:  '#fb923c',
  sky:     '#38bdf8',
  teal:    '#2dd4bf',
}

function ModuleCard({ module, onEnter, onHoverIn, onHoverOut, cardRef }) {
  const hex    = ACCENT_HEX[module.color]
  const hexRgb = parseInt(hex.slice(1), 16)
  const r = (hexRgb >> 16) & 0xff
  const g = (hexRgb >>  8) & 0xff
  const b =  hexRgb        & 0xff

  return (
    <button
      ref={cardRef}
      onClick={onEnter}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      className="group relative flex flex-col text-left p-5 rounded-sm cursor-pointer focus:outline-none focus-visible:ring-1 transition-all duration-300"
      style={{
        background: `rgba(10, 18, 24, 0.72)`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid rgba(${r},${g},${b},0.18)`,
      }}
      onMouseMove={(e) => {
        e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.7)`
        e.currentTarget.style.boxShadow   = `0 0 18px 2px rgba(${r},${g},${b},0.15), inset 0 1px 0 rgba(${r},${g},${b},0.08)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.18)`
        e.currentTarget.style.boxShadow   = 'none'
        onHoverOut()
      }}
    >
      {/* Abbr */}
      <div
        className="font-display text-[42px] font-bold leading-none mb-3"
        style={{ color: hex, textShadow: `0 0 20px rgba(${r},${g},${b},0.5)` }}
      >
        {module.abbr}
      </div>

      {/* Name + tagline */}
      <div className="mb-2.5">
        <h2 className="font-display text-[13px] font-semibold text-text-primary mb-0.5 leading-tight tracking-wide">
          {module.name}
        </h2>
        <p className="font-mono-data text-[10px] leading-relaxed" style={{ color: `rgba(${r},${g},${b},0.75)` }}>
          {module.tagline}
        </p>
      </div>

      {/* Description */}
      <p className="font-body text-[11px] text-text-dim leading-relaxed mb-4 flex-1">
        {module.description}
      </p>

      {/* Formula tag */}
      <div
        className="self-start font-mono-data text-[10px] px-2 py-0.5 rounded border"
        style={{
          color: hex,
          borderColor: `rgba(${r},${g},${b},0.3)`,
          background: `rgba(${r},${g},${b},0.07)`,
        }}
      >
        {module.formula}
      </div>

      {/* Enter hint */}
      <div
        className="absolute bottom-4 right-4 font-mono-data text-[9px] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color: hex }}
      >
        ENTER →
      </div>
    </button>
  )
}

function SabrinaCard({ onEnter, onHoverIn, onHoverOut, cardRef, bloomIn }) {
  return (
    <>
      {bloomIn && (
        <style>{`
          @keyframes sabrina-bloom {
            0%   { opacity: 0; transform: scale(0.86); filter: brightness(4); }
            55%  { opacity: 1; transform: scale(1.03); filter: brightness(1.6); }
            100% { opacity: 1; transform: scale(1);    filter: brightness(1); }
          }
        `}</style>
      )}
    <button
      ref={cardRef}
      onClick={onEnter}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      className="group relative flex flex-col text-left p-5 rounded-sm cursor-pointer focus:outline-none transition-all duration-300"
      style={{
        background: 'rgba(10, 18, 24, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,105,180,0.18)',
        animation: bloomIn ? 'sabrina-bloom 0.85s cubic-bezier(0.22,1,0.36,1) both' : undefined,
      }}
      onMouseMove={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,105,180,0.75)'
        e.currentTarget.style.boxShadow = '0 0 18px 2px rgba(255,20,147,0.15), inset 0 1px 0 rgba(255,105,180,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,105,180,0.18)'
        e.currentTarget.style.boxShadow = 'none'
        onHoverOut()
      }}
    >
      <div className="font-display text-[42px] font-bold leading-none mb-3"
        style={{ color: '#ff69b4', textShadow: '0 0 20px rgba(255,20,147,0.5)' }}>
        ♡
      </div>
      <div className="mb-2.5">
        <h2 className="font-display text-[13px] font-semibold text-text-primary mb-0.5 leading-tight tracking-wide">
          For Sabrina
        </h2>
        <p className="font-mono-data text-[10px]" style={{ color: 'rgba(255,105,180,0.75)' }}>
          a message · just for you
        </p>
      </div>
      <p className="font-body text-[11px] text-text-dim leading-relaxed mb-4 flex-1">
        something made for you, because you deserve it.
      </p>
      <div className="self-start font-mono-data text-[10px] px-2 py-0.5 rounded border"
        style={{ color: '#ff69b4', borderColor: 'rgba(255,105,180,0.3)', background: 'rgba(255,105,180,0.07)' }}>
        mwah ♥
      </div>
      <div className="absolute bottom-4 right-4 font-mono-data text-[9px] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color: '#ff69b4' }}>
        ENTER →
      </div>
    </button>
    </>
  )
}

export default function ModulePicker() {
  const setActiveModule    = useModuleStore((s) => s.setActiveModule)
  const [hoveredModule, setHoveredModule] = useState(null)
  const [unlocked,    setUnlocked]    = useState(checkUnlocked)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const mouseRef  = useRef({ x: 0, y: 0 })
  const cardRefs  = useRef({})
  const gesture   = useGesture()

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = {
      x:  (e.clientX - rect.left)  / rect.width  * 2 - 1,
      y: -((e.clientY - rect.top)  / rect.height * 2 - 1),
    }
  }, [])

  // Secret keyboard unlock — type "sabrina" anywhere
  useEffect(() => {
    let typed = ''
    const onKey = (e) => {
      if (e.key.length !== 1) return
      typed = (typed + e.key.toLowerCase()).slice(-(SECRET_PHRASE.length * 2))
      if (!unlocked && typed.includes(SECRET_PHRASE)) {
        typed = ''
        sessionStorage.setItem(STORE_KEY, '1')
        setUnlocked(true)
        setJustUnlocked(true)
        setTimeout(() => setJustUnlocked(false), 1000)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unlocked])

  // Gesture: sync pointer → mouseRef + hoveredModule, pinch → enter
  useEffect(() => {
    if (!gesture.enabled) return
    let rafId
    const tick = () => {
      const ptr = gesture.pointerRef.current
      if (ptr) {
        // Drive particle background
        mouseRef.current = ptr

        // Hit-test cards
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight
        let hit = null
        for (const [id, el] of Object.entries(cardRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) {
            hit = id; break
          }
        }
        setHoveredModule(hit)

        // Pinch → enter
        if (gesture.justPinchedRef.current && hit) {
          setActiveModule(hit)
          gesture.justPinchedRef.current = false
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [gesture.enabled, gesture.pointerRef, gesture.justPinchedRef, setActiveModule])

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#04090c' }}
      onMouseMove={handleMouseMove}
    >
      {/* ── Live physics background ── */}
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        camera={{ position: [0, 0, 12], fov: 60 }}
        gl={{ antialias: false, alpha: false }}
      >
        <color attach="background" args={['#04090c']} />
        <PhysicsBg mouseRef={mouseRef} hoveredModule={hoveredModule} />
      </Canvas>

      {/* ── Content layer ── */}
      <div
        className="relative flex flex-col h-full overflow-y-auto thin-scroll"
        style={{ zIndex: 10 }}
      >
        {/* Header */}
        <header className="shrink-0 px-8 pt-8 pb-6 flex items-start justify-between">
          <div>
            <h1
              className="font-display text-[28px] font-bold tracking-[0.12em] uppercase leading-none mb-1"
              style={{
                color: '#00e5c4',
                textShadow: '0 0 30px rgba(0,229,196,0.4), 0 0 60px rgba(0,229,196,0.15)',
              }}
            >
              UMBRA
            </h1>
            <p className="font-mono-data text-[10px] tracking-[0.3em] uppercase text-text-dim">
              Physics Visualizer · Interactive 3D
            </p>
          </div>

          <div className="font-mono-data text-[9px] text-text-dim tracking-wider text-right space-y-0.5 pt-1">
            <div>NATURAL UNITS · c = ℏ = G = 1</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-1 h-1 rounded-full bg-cyan-glow animate-pulse-glow" />
              <span>{unlocked ? MODULES.length + 1 : MODULES.length} MODULES ACTIVE</span>
            </div>
          </div>
        </header>

        {/* Divider */}
        <div className="shrink-0 mx-8 flex items-center gap-4 mb-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(0,229,196,0.12)' }} />
          <span className="font-mono-data text-[9px] tracking-[0.28em] uppercase text-text-dim px-1">
            // SELECT MODULE
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,229,196,0.12)' }} />
        </div>

        {/* Module grid */}
        <main className="flex-1 px-8 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                cardRef={(el) => { cardRefs.current[mod.id] = el }}
                onEnter={() => setActiveModule(mod.id)}
                onHoverIn={() => setHoveredModule(mod.id)}
                onHoverOut={() => setHoveredModule(null)}
              />
            ))}
            {unlocked && (
              <SabrinaCard
                cardRef={(el) => { cardRefs.current['sabrina'] = el }}
                onEnter={() => setActiveModule('sabrina')}
                onHoverIn={() => setHoveredModule('sabrina')}
                onHoverOut={() => setHoveredModule(null)}
                bloomIn={justUnlocked}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="shrink-0 px-8 pb-5">
          <div className="h-px mb-3" style={{ background: 'rgba(0,229,196,0.08)' }} />
          <p className="font-mono-data text-[9px] text-text-dim tracking-wider">
            UMBRA · All visualizations run in your browser — no server, no data sent.
          </p>
        </footer>
      </div>

      {/* Hovered module name — ambient overlay */}
      {hoveredModule && (
        <div
          className="absolute bottom-5 right-8 font-mono-data text-[10px] tracking-[0.2em] uppercase text-text-dim pointer-events-none transition-opacity duration-200"
          style={{ zIndex: 20 }}
        >
          {MODULES.find((m) => m.id === hoveredModule)?.name || 'For Sabrina'}
        </div>
      )}
    </div>
  )
}
