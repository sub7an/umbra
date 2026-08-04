import { useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'
import Hero from './Hero'

const MODULES = [
  {
    id: 'special-relativity',
    name: 'Special Relativity',
    abbr: 'SR',
    tagline: 'Light cones · Time dilation · Length contraction',
    description:
      'Explore the Lorentz transform at relativistic velocities. Watch clocks slow and rods shrink as β → 1.',
    status: 'active',
    color: 'cyan',
    formula: 'γ = 1/√(1−β²)',
  },
  {
    id: 'quantum-mechanics',
    name: 'Quantum Mechanics',
    abbr: 'QM',
    tagline: 'Wave functions · Uncertainty · Entanglement',
    description:
      'Probability amplitudes, the Schrödinger equation, and quantum superposition visualized in Hilbert space.',
    status: 'active',
    color: 'amber',
    formula: 'iℏ ∂ψ/∂t = Ĥψ',
  },
  {
    id: 'frontier-physics',
    name: 'Frontier Physics',
    abbr: 'FP',
    tagline: 'Dark matter · Hubble expansion · Rotation curves',
    description:
      'Galaxy kinematics vs. Keplerian predictions. Hubble expansion as direct measurement. What the data shows, what is inferred, and what remains unknown.',
    status: 'active',
    color: 'rose',
    formula: 'v_obs ≫ v_kep  |  v = H₀·d',
  },
  {
    id: 'dynamical-systems',
    name: 'Dynamical Systems',
    abbr: 'DS',
    tagline: 'Strange attractors · Chaos · Phase space',
    description:
      '1,800 RK4-integrated particles tracing Lorenz, Rössler, Thomas, and Aizawa attractors in real time. Adjust σ, ρ, β live and watch chaos emerge as ρ crosses the Hopf bifurcation threshold at 24.74.',
    status: 'active',
    color: 'emerald',
    formula: 'dX/dt = F(X)',
  },
  {
    id: 'electromagnetism',
    name: 'Electromagnetism',
    abbr: 'EM',
    tagline: '3D field lines · Biot-Savart · Halbach arrays',
    description:
      'Real Biot-Savart field computation in 3D. RK4-traced magnetic field lines for dipole, bar magnet, solenoid, and Halbach array. Heatmap cross-sections and animated particle streams.',
    status: 'active',
    color: 'violet',
    formula: 'B = μ₀/4π ∮ (I dℓ × r̂) / r²',
  },
]

const colorConfig = {
  cyan: {
    border: 'border-cyan-glow',
    glow: 'shadow-glow-cyan',
    abbr: 'text-cyan-glow glow-cyan',
    tag: 'bg-cyan-glow/10 text-cyan-glow border-cyan-glow/30',
    formula: 'text-cyan-glow glow-cyan',
    hover: 'hover:border-cyan-glow hover:shadow-glow-cyan',
  },
  amber: {
    border: 'border-amber-glow/40',
    glow: 'shadow-glow-amber',
    abbr: 'text-amber-glow glow-amber',
    tag: 'bg-amber-glow/10 text-amber-glow border-amber-glow/30',
    formula: 'text-amber-glow',
    hover: 'hover:border-amber-glow hover:shadow-glow-amber',
  },
  rose: {
    border: 'border-rose-glow/40',
    glow: 'shadow-glow-rose',
    abbr: 'text-rose-glow',
    tag: 'bg-rose-glow/10 text-rose-glow border-rose-glow/30',
    formula: 'text-rose-glow',
    hover: 'hover:border-rose-glow hover:shadow-glow-rose',
  },
  violet: {
    border: 'border-violet-glow/40',
    glow: 'shadow-glow-violet',
    abbr: 'text-violet-glow glow-violet',
    tag: 'bg-violet-glow/10 text-violet-glow border-violet-glow/30',
    formula: 'text-violet-glow',
    hover: 'hover:border-violet-glow hover:shadow-glow-violet',
  },
  emerald: {
    border: 'border-emerald-glow/40',
    glow: 'shadow-glow-emerald',
    abbr: 'text-emerald-glow glow-emerald',
    tag: 'bg-emerald-glow/10 text-emerald-glow border-emerald-glow/30',
    formula: 'text-emerald-glow',
    hover: 'hover:border-emerald-glow hover:shadow-glow-emerald',
  },
}

function ModuleCard({ module, onClick }) {
  const cc = colorConfig[module.color]
  const isActive = module.status === 'active'

  return (
    <button
      onClick={isActive ? onClick : undefined}
      disabled={!isActive}
      className={[
        'relative group flex flex-col text-left p-6 rounded border osc-grid',
        'transition-all duration-300',
        'bg-panel',
        cc.border,
        isActive
          ? `cursor-pointer ${cc.hover} focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-glow`
          : 'cursor-not-allowed opacity-40',
        isActive ? cc.glow : '',
      ].join(' ')}
      aria-label={isActive ? `Enter ${module.name}` : `${module.name} — coming soon`}
    >
      {!isActive && (
        <span className="absolute top-4 right-4 font-mono-data text-[9px] tracking-widest uppercase px-2 py-0.5 border border-border-subtle text-text-dim rounded">
          SOON
        </span>
      )}

      <div className={`font-display text-5xl font-bold mb-3 leading-none ${cc.abbr}`}>
        {module.abbr}
      </div>

      <div className="mb-3">
        <h2 className="font-display text-base font-semibold text-text-primary mb-1 leading-tight">
          {module.name}
        </h2>
        <p className="font-mono-data text-[11px] text-text-dim leading-relaxed">
          {module.tagline}
        </p>
      </div>

      <p className="font-body text-xs text-text-dim leading-relaxed mb-4 flex-1">
        {module.description}
      </p>

      <div className={`self-start font-mono-data text-[11px] px-2 py-1 rounded border ${cc.tag}`}>
        {module.formula}
      </div>

      {isActive && (
        <div className="absolute bottom-4 right-5 font-mono-data text-[10px] tracking-widest uppercase text-cyan-glow opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ENTER →
        </div>
      )}
    </button>
  )
}

export default function ModulePicker() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const scrollToModules = useCallback(() => {
    const container = document.querySelector('[data-scroll-root]')
    const modules = document.querySelector('[data-modules-section]')
    if (!container || !modules) return
    const top =
      container.scrollTop +
      modules.getBoundingClientRect().top -
      container.getBoundingClientRect().top
    container.scrollTo({ top })
  }, [])

  return (
    <div data-scroll-root className="w-full h-full bg-ground overflow-y-auto thin-scroll" style={{ scrollBehavior: 'smooth' }}>
      <Hero onScrollDown={scrollToModules} />

      {/* Modules section */}
      <div
        data-modules-section
        className="flex flex-col items-center px-6 sm:px-8 pb-12"
      >
        {/* Section separator */}
        <div className="w-full max-w-4xl pt-10 pb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="font-mono-data text-[10px] tracking-[0.3em] uppercase text-text-dim px-2">
              Modules
            </span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>
        </div>

        {/* Module grid */}
        <main className="w-full max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onClick={() => setActiveModule(mod.id)}
              />
            ))}

            {/* Sabrina card */}
            <button
              onClick={() => setActiveModule('sabrina')}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column',
                textAlign: 'left', padding: 24, borderRadius: 6,
                border: '1px solid rgba(255,105,180,0.5)',
                background: '#0c1419',
                boxShadow: '0 0 12px 3px rgba(255,20,147,0.22)',
                cursor: 'pointer',
                transition: 'box-shadow 0.3s, border-color 0.3s',
                backgroundImage: 'linear-gradient(rgba(15,31,40,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(15,31,40,0.9) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 20px 6px rgba(255,20,147,0.45)'
                e.currentTarget.style.borderColor = 'rgba(255,105,180,0.9)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 12px 3px rgba(255,20,147,0.22)'
                e.currentTarget.style.borderColor = 'rgba(255,105,180,0.5)'
              }}
            >
              <div style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: 48, fontWeight: 700, lineHeight: 1,
                color: '#ff69b4',
                textShadow: '0 0 12px #ff1493, 0 0 30px #ff1493',
                marginBottom: 12,
              }}>♡</div>

              <div style={{ marginBottom: 12 }}>
                <h2 style={{
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: 16, fontWeight: 600, color: '#dff2ed',
                  marginBottom: 4, lineHeight: 1.2,
                }}>For Sabrina</h2>
                <p style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, color: '#ff69b4', opacity: 0.8,
                  letterSpacing: '0.05em',
                }}>a message · just for you</p>
              </div>

              <p style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: 12, color: '#6aada5', lineHeight: 1.6,
                marginBottom: 16, flex: 1,
              }}>
                something made for you, because you deserve it.
              </p>

              <div style={{
                alignSelf: 'flex-start',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, padding: '4px 8px', borderRadius: 4,
                border: '1px solid rgba(255,105,180,0.35)',
                background: 'rgba(255,105,180,0.08)',
                color: '#ff69b4',
              }}>
                mwah ♥
              </div>

              <div style={{
                position: 'absolute', bottom: 16, right: 20,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, letterSpacing: '0.15em',
                color: '#ff69b4', opacity: 0, textTransform: 'uppercase',
                transition: 'opacity 0.2s',
              }}
              className="enter-hint"
              >
                ENTER →
              </div>
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full max-w-4xl mt-12">
          <div className="h-px w-full bg-border-subtle mb-4" />
          <p className="font-mono-data text-[10px] text-text-dim tracking-wider">
            UMBRA · NATURAL UNITS · c = 1
          </p>
        </footer>
      </div>
    </div>
  )
}
