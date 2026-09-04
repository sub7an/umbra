import { useState, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'

// Curated cinematic physics scenes
const SCENES = [
  { label: 'Twin Paradox', desc: 'Lorentz factor γ = 7 — clocks almost stop', module: 'special-relativity', apply: s => { s.setSrVelocity(0.99) } },
  { label: 'Near Light Speed', desc: 'β = 0.995c — extreme time dilation', module: 'special-relativity', apply: s => { s.setSrVelocity(0.995) } },
  { label: 'Lorenz Chaos Onset', desc: 'Strange attractor at critical bifurcation', module: 'dynamical-systems', apply: s => { s.setDsAttractorType('lorenz') } },
  { label: 'Rössler Spiral', desc: 'Continuous chaotic spiral attractor', module: 'dynamical-systems', apply: s => { s.setDsAttractorType('rossler') } },
  { label: 'Thomas Attractor', desc: 'Labyrinthine symmetric chaos', module: 'dynamical-systems', apply: s => { s.setDsAttractorType('thomas') } },
  { label: 'Van der Pol Limit Cycle', desc: 'Maximum nonlinear oscillation μ = 3', module: 'dynamical-systems', apply: s => { s.setDsAttractorType('vanderpol'); s.setDsPhaseMu(3.0) } },
  { label: 'Quantum Superposition', desc: 'Qubit on the equator of the Bloch sphere', module: 'quantum-mechanics', apply: s => { s.setBlochTheta(Math.PI / 2); s.setBlochPhi(Math.PI / 4) } },
  { label: 'High-Energy Tunneling', desc: 'Particle tunnels a near-opaque barrier', module: 'quantum-mechanics', apply: s => { s.setTunnelV0(5.5); s.setTunnelK0(2.0) } },
  { label: 'Resonant Tunneling', desc: 'Barrier height = k₀² — peak transmission', module: 'quantum-mechanics', apply: s => { s.setTunnelK0(2.5); s.setTunnelV0(6.25) } },
  { label: 'Quantum State n=6', desc: 'Particle in a box — highest energy mode', module: 'quantum-mechanics', apply: s => { s.setBoxN(6) } },
  { label: 'Extreme Black Hole', desc: 'Maximum Schwarzschild radius warp', module: 'frontier-physics', apply: s => { s.setFpBhMass(1.5) } },
  { label: 'Hubble Expansion', desc: 'Universe expanding at 2.5× the Hubble constant', module: 'frontier-physics', apply: s => { s.setFpHubble(2.5) } },
  { label: 'Extreme Spacetime Warp', desc: 'Black hole at maximum GR mass parameter', module: 'general-relativity', apply: s => { s.setGrMass(5.0) } },
  { label: 'Flat Spacetime', desc: 'Minkowski metric — nearly zero curvature', module: 'general-relativity', apply: s => { s.setGrMass(0.5) } },
  { label: 'Plasma Temperature', desc: 'Gas at 3× room temperature — Maxwell-Boltzmann tail', module: 'thermodynamics', apply: s => { s.setThermoTemp(3.0) } },
  { label: 'Near Absolute Zero', desc: 'Gas approaching quantum statistical regime', module: 'thermodynamics', apply: s => { s.setThermoTemp(0.2) } },
  { label: 'Turbulent Flow', desc: 'Reynolds number 2.5 — Kármán vortex street', module: 'fluid-dynamics', apply: s => { s.setFluidReynolds(2.5) } },
  { label: 'Laminar Flow', desc: 'Low Re — perfectly smooth streamlines', module: 'fluid-dynamics', apply: s => { s.setFluidReynolds(0.3) } },
  { label: 'Halbach Array', desc: 'Field-focusing permanent magnet array', module: 'electromagnetism', apply: s => { s.setEmMagnetType('halbach') } },
  { label: 'Solenoid Field', desc: 'Uniform magnetic field inside solenoid', module: 'electromagnetism', apply: s => { s.setEmMagnetType('solenoid') } },
  { label: 'Magnetic Dipole', desc: 'Classic two-pole field topology', module: 'electromagnetism', apply: s => { s.setEmMagnetType('dipole') } },
  { label: 'Optics Lab', desc: 'Light splitting through a prism', module: 'optics', apply: () => {} },
  { label: 'Wave Interference', desc: 'Double-slit interference on a membrane', module: 'wave-mechanics', apply: () => {} },
  { label: 'Chladni Patterns', desc: 'Sand nodal patterns at resonance', module: 'acoustic-physics', apply: () => {} },
  { label: 'Gravity Field', desc: 'Particle sandbox with gravitational attractor', module: 'physics-sandbox', apply: () => {} },
]

function Toast({ scene }) {
  return (
    <div style={{
      position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10500,
      background: 'rgba(8,6,4,0.96)',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 8,
      padding: '10px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 16px 50px rgba(0,0,0,0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      animation: 'umbra-slide-up 0.3s ease',
      pointerEvents: 'none',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: '#f59e0b', boxShadow: '0 0 8px #f59e0b',
        animation: 'umbra-pulse 1s ease-in-out infinite',
      }} />
      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#e8f4f0' }}>{scene.label}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(200,230,220,0.5)', marginTop: 2 }}>{scene.desc}</div>
      </div>
    </div>
  )
}

export default function SurpriseMe() {
  const setModule = useModuleStore(s => s.setActiveModule)
  const store     = useModuleStore()
  const [toast, setToast] = useState(null)
  const [spinning, setSpinning] = useState(false)

  const go = useCallback(() => {
    if (spinning) return
    setSpinning(true)

    const scene = SCENES[Math.floor(Math.random() * SCENES.length)]
    setModule(scene.module)

    // Apply params after module mount settles
    setTimeout(() => {
      try { scene.apply(store) } catch {}
      setSpinning(false)
      setToast(scene)
      setTimeout(() => setToast(null), 2800)
    }, 350)
  }, [spinning, setModule, store])

  return (
    <>
      {toast && <Toast scene={toast} />}

      <button
        onClick={go}
        disabled={spinning}
        title="Jump to a dramatic random physics scene"
        style={{
          position: 'fixed', bottom: 20, left: '50%',
          transform: `translateX(calc(-50% + 240px))`,
          zIndex: 10040,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em',
          color: spinning ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.55)',
          background: 'rgba(8,6,4,0.72)',
          border: '1px solid rgba(245,158,11,0.12)',
          borderRadius: 5,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          cursor: spinning ? 'wait' : 'pointer',
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { if (!spinning) { e.currentTarget.style.color = 'rgba(245,158,11,0.9)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)' }}}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,158,11,0.55)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.12)' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
          style={{ animation: spinning ? 'umbra-spin 0.6s linear infinite' : 'none' }}>
          <path d="M9 2H7M9 2V4M9 2L6.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 9h2M2 9V7M2 9l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.5 1.5L8 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
          <path d="M3 7l2.5-2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
        </svg>
        SURPRISE ME
      </button>
    </>
  )
}
