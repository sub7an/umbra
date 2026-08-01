import useModuleStore from '../store/useModuleStore'

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
        isActive ? `cursor-pointer ${cc.hover} focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-glow` : 'cursor-not-allowed opacity-40',
        isActive ? cc.glow : '',
      ].join(' ')}
      aria-label={isActive ? `Enter ${module.name}` : `${module.name} — coming soon`}
    >
      {/* Coming soon badge */}
      {!isActive && (
        <span className="absolute top-4 right-4 font-mono-data text-[9px] tracking-widest uppercase px-2 py-0.5 border border-border-subtle text-text-dim rounded">
          SOON
        </span>
      )}

      {/* Module abbr — large display letterform */}
      <div className={`font-display text-5xl font-bold mb-3 leading-none ${cc.abbr}`}>
        {module.abbr}
      </div>

      {/* Name + tagline */}
      <div className="mb-3">
        <h2 className="font-display text-base font-semibold text-text-primary mb-1 leading-tight">
          {module.name}
        </h2>
        <p className="font-mono-data text-[11px] text-text-dim leading-relaxed">
          {module.tagline}
        </p>
      </div>

      {/* Description */}
      <p className="font-body text-xs text-text-dim leading-relaxed mb-4 flex-1">
        {module.description}
      </p>

      {/* Formula chip */}
      <div className={`self-start font-mono-data text-[11px] px-2 py-1 rounded border ${cc.tag}`}>
        {module.formula}
      </div>

      {/* Active: enter affordance */}
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

  return (
    <div className="flex flex-col items-center justify-start w-full h-full bg-ground px-8 py-10 overflow-y-auto thin-scroll">
      {/* Header */}
      <header className="w-full max-w-4xl mb-12">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-glow shadow-glow-cyan animate-pulse-glow" />
          <span className="font-mono-data text-[11px] tracking-[0.22em] uppercase text-text-dim">
            Instrument Array · Online
          </span>
        </div>
        <h1 className="font-display text-5xl font-bold text-text-primary glow-cyan leading-tight tracking-tight">
          Physics Sandbox
        </h1>
        <p className="font-mono-data text-sm text-text-dim mt-3 max-w-lg leading-relaxed">
          Interactive relativistic and quantum phenomena. Select a module to begin measurement.
        </p>
        {/* Oscilloscope divider */}
        <div className="mt-6 h-px w-full bg-gradient-to-r from-cyan-glow/40 via-cyan-glow/10 to-transparent" />
      </header>

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
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mt-auto pt-10">
        <div className="h-px w-full bg-border-subtle mb-4" />
        <p className="font-mono-data text-[10px] text-text-dim tracking-wider">
          PHYSICS SANDBOX · NATURAL UNITS · c = 1
        </p>
      </footer>
    </div>
  )
}
