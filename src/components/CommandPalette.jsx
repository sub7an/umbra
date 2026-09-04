import { useState, useEffect, useRef, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'

const PALETTE_MODULES = [
  { id: 'physics-sandbox',    name: 'Physics Sandbox',    abbr: 'Σ',  color: '#84cc16', formula: 'F = Σ G·M/r²',           tags: ['sandbox','particles','field','attractor','gravity'] },
  { id: 'wave-mechanics',     name: 'Wave Mechanics',     abbr: '≋',  color: '#22d3ee', formula: '∂²u/∂t² = c²∇²u',       tags: ['wave','ripple','interference','diffraction','schrodinger'] },
  { id: 'optics',             name: 'Optics',             abbr: '◈',  color: '#fcd34d', formula: 'n₁sinθ₁ = n₂sinθ₂',     tags: ['light','prism','lens','refraction','snell'] },
  { id: 'special-relativity', name: 'Special Relativity', abbr: 'SR', color: '#f59e0b', formula: 'γ = 1/√(1−β²)',          tags: ['relativity','lorentz','time dilation','length contraction','minkowski'] },
  { id: 'quantum-mechanics',  name: 'Quantum Mechanics',  abbr: 'QM', color: '#f59e0b', formula: 'iℏ ∂ψ/∂t = Ĥψ',         tags: ['quantum','wave function','uncertainty','schrodinger','tunneling','bloch'] },
  { id: 'frontier-physics',   name: 'Frontier Physics',   abbr: 'FP', color: '#e040fb', formula: 'v_obs ≫ v_kep',          tags: ['dark matter','galaxy','frontier','hubble','rotation curves'] },
  { id: 'dynamical-systems',  name: 'Dynamical Systems',  abbr: 'DS', color: '#10b981', formula: 'dX/dt = F(X)',           tags: ['chaos','lorenz','attractor','bifurcation','rossler'] },
  { id: 'electromagnetism',   name: 'Electromagnetism',   abbr: 'EM', color: '#a855f7', formula: 'B = μ₀/4π ∮ Idℓ×r̂/r²', tags: ['magnetic','electric','field','biot-savart','maxwell','halbach'] },
  { id: 'general-relativity', name: 'General Relativity', abbr: 'GR', color: '#fb923c', formula: 'G_μν + Λg_μν = 8πT_μν', tags: ['einstein','spacetime','geodesic','black hole','gravitational waves'] },
  { id: 'thermodynamics',     name: 'Thermodynamics',     abbr: 'TD', color: '#38bdf8', formula: 'S = k_B ln Ω',          tags: ['entropy','temperature','boltzmann','heat','carnot','maxwell'] },
  { id: 'fluid-dynamics',     name: 'Fluid Dynamics',     abbr: 'FD', color: '#2dd4bf', formula: 'ρ(∂u/∂t + u·∇u) = −∇p', tags: ['fluid','flow','vortex','navier-stokes','turbulence','sph'] },
  { id: 'acoustic-physics',   name: 'Acoustic Physics',   abbr: '♪',  color: '#a855f7', formula: 'f_n = nf₀',             tags: ['sound','chladni','harmonics','lissajous','resonance'] },
]

function score(text, query) {
  if (!query) return 0
  const t = text.toLowerCase(), q = query.toLowerCase()
  if (t === q)        return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q))  return 60
  let qi = 0, s = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { s++; qi++ }
  }
  return qi === q.length ? s * 2 : 0
}

function rankModule(mod, query) {
  if (!query.trim()) return 1
  return Math.max(
    score(mod.name,    query) * 3,
    score(mod.abbr,    query) * 2,
    ...mod.tags.map(t => score(t, query)),
  )
}

export default function CommandPalette() {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [sel,   setSel]   = useState(0)
  const inputRef = useRef()
  const listRef  = useRef()
  const setModule = useModuleStore(s => s.setActiveModule)

  const results = query.trim()
    ? PALETTE_MODULES.map(m => ({ ...m, _s: rankModule(m, query) }))
        .filter(m => m._s > 0).sort((a, b) => b._s - a._s)
    : PALETTE_MODULES

  useEffect(() => {
    const onKey   = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
    }
    const onOpen  = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('umbra-palette-open', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('umbra-palette-open', onOpen)
    }
  }, [])

  useEffect(() => {
    window.__UMBRA_PALETTE_OPEN = open
    if (open) { setQuery(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  useEffect(() => { setSel(0) }, [query])

  const close = useCallback(() => setOpen(false), [])

  const commit = useCallback((mod) => {
    setModule(mod.id)
    close()
  }, [setModule, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape')    { e.stopPropagation(); close() }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel(s => { const n = Math.min(s + 1, results.length - 1); listRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n })
      }
      if (e.key === 'ArrowUp')   {
        e.preventDefault()
        setSel(s => { const n = Math.max(s - 1, 0); listRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n })
      }
      if (e.key === 'Enter' && results[sel]) commit(results[sel])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, sel, commit, close])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(8,6,4,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
      }}
      onClick={close}
    >
      <div
        style={{
          width: '100%', maxWidth: 580, margin: '0 16px',
          background: 'rgba(6,12,16,0.98)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 0 0 1px rgba(245,158,11,0.05), 0 32px 80px rgba(0,0,0,0.75)',
          borderRadius: 6, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '65vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px',
          borderBottom: '1px solid rgba(245,158,11,0.09)',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.38 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="#f59e0b" strokeWidth="1.4"/>
            <path d="M9 9L11.5 11.5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to module…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13, color: '#fef9ec', letterSpacing: '0.02em',
            }}
          />
          <kbd style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'rgba(245,158,11,0.32)',
            border: '1px solid rgba(245,158,11,0.13)',
            borderRadius: 3, padding: '2px 6px', flexShrink: 0,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {results.length === 0 ? (
            <div style={{
              padding: '28px 16px', textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: 'rgba(245,158,11,0.22)', letterSpacing: '0.12em',
            }}>
              NO MODULES MATCH
            </div>
          ) : results.map((mod, i) => (
            <div
              key={mod.id}
              onClick={() => commit(mod)}
              onMouseEnter={() => setSel(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 16px', cursor: 'pointer',
                background: i === sel ? 'rgba(245,158,11,0.045)' : 'transparent',
                borderLeft: `2px solid ${i === sel ? mod.color : 'transparent'}`,
                transition: 'background 0.06s',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 4, flexShrink: 0,
                border: `1px solid ${mod.color}30`,
                background: `${mod.color}0e`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: mod.abbr.length > 2 ? 14 : 13,
                fontWeight: 700, color: mod.color,
              }}>
                {mod.abbr}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Chakra Petch, sans-serif', fontSize: 12, fontWeight: 600,
                  color: i === sel ? '#fef9ec' : 'rgba(223,242,237,0.6)',
                  letterSpacing: '0.04em',
                }}>
                  {mod.name}
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9, marginTop: 2,
                  color: `${mod.color}65`, letterSpacing: '0.04em',
                }}>
                  {mod.formula}
                </div>
              </div>
              {i === sel && (
                <kbd style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  color: 'rgba(245,158,11,0.32)',
                  border: '1px solid rgba(245,158,11,0.13)',
                  borderRadius: 3, padding: '2px 5px', flexShrink: 0,
                }}>↵</kbd>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(245,158,11,0.07)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['⌘K', 'close']].map(([key, lbl]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                color: 'rgba(245,158,11,0.32)',
                border: '1px solid rgba(245,158,11,0.12)',
                borderRadius: 3, padding: '2px 5px',
              }}>{key}</kbd>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                color: 'rgba(245,158,11,0.2)', letterSpacing: '0.09em',
              }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
