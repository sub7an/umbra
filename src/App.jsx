import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
import TransitionOverlay from './components/TransitionOverlay'
import BootScreen from './components/BootScreen'
import CursorAura from './components/CursorAura'
import CommandPalette from './components/CommandPalette'
import ShareButton, { decodeShareState, applySharedState } from './components/ShareButton'
import FloatingToolbar from './components/FloatingToolbar'
import Challenges from './components/Challenges'
import ExplainMode from './components/ExplainMode'
import StoryMode from './components/StoryMode'
import MultiplayerRoom from './components/MultiplayerRoom'
import GuideModal from './components/GuideModal'
import PhysicsTutor from './components/PhysicsTutor'
import ProfilePanel from './components/ProfilePanel'
import SurpriseMe from './components/SurpriseMe'
import { GestureProvider } from './context/GestureContext'
import SoundToggle from './components/SoundToggle'
import { warp, startDrone, stopDrone } from './lib/sound'

// Ambient drone base frequency per module — each world has its own tone
const MOD_DRONE = {
  'special-relativity': 49, 'quantum-mechanics': 55, 'frontier-physics': 41.2,
  'dynamical-systems': 61.7, 'electromagnetism': 46.2, 'general-relativity': 36.7,
  'thermodynamics': 65.4, 'fluid-dynamics': 51.9, 'acoustic-physics': 82.4,
  'wave-mechanics': 58.3, 'optics': 73.4, 'physics-sandbox': 55, 'sabrina': 87.3,
}

const MOD_GLOW = {
  'special-relativity':  '245,166,35',
  'quantum-mechanics':   '168,85,247',
  'frontier-physics':    '139,92,246',
  'dynamical-systems':   '34,197,94',
  'electromagnetism':    '59,130,246',
  'general-relativity':  '249,115,22',
  'thermodynamics':      '239,68,68',
  'fluid-dynamics':      '14,165,233',
  'acoustic-physics':    '20,184,166',
  'wave-mechanics':      '99,102,241',
  'optics':              '251,191,36',
  'physics-sandbox':     '0,229,196',
}

function AmbientGlow() {
  const [rgb, setRgb] = useState('0,229,196')
  useEffect(() => {
    const unsub = useModuleStore.subscribe(s => {
      setRgb(MOD_GLOW[s.activeModule] || '0,229,196')
    })
    return unsub
  }, [])
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      background: `radial-gradient(ellipse 70% 45% at 50% -5%, rgba(${rgb},0.055) 0%, transparent 70%)`,
      transition: 'background 1.8s ease',
    }} />
  )
}

// Lazy-load all heavy modules — each becomes its own JS chunk fetched on demand
const SRModule             = lazy(() => import('./modules/special-relativity/SRModule'))
const QuantumModule        = lazy(() => import('./modules/quantum/QuantumModule'))
const FrontierModule       = lazy(() => import('./modules/frontier/FrontierModule'))
const ElectromagnetismModule = lazy(() => import('./modules/electromagnetism/ElectromagnetismModule'))
const DynamicalModule      = lazy(() => import('./modules/dynamical/DynamicalModule'))
const SabrinaModule        = lazy(() => import('./modules/sabrina/SabrinaModule'))
const GRModule             = lazy(() => import('./modules/general-relativity/GRModule'))
const ThermoModule         = lazy(() => import('./modules/thermodynamics/ThermoModule'))
const FluidModule          = lazy(() => import('./modules/fluid-dynamics/FluidModule'))
const SandboxModule        = lazy(() => import('./modules/physics-sandbox/SandboxModule'))
const WaveModule           = lazy(() => import('./modules/wave/WaveModule'))
const OpticsModule         = lazy(() => import('./modules/optics/OpticsModule'))
const AcousticModule       = lazy(() => import('./modules/acoustic/AcousticModule'))

function ModuleFallback() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#08090a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10, letterSpacing: '0.22em',
        color: 'rgba(34,211,238,0.35)',
        animation: 'umbra-pulse 1.4s ease-in-out infinite',
      }}>
        LOADING
      </div>
    </div>
  )
}

const OUT_MS = 520
const IN_MS  = 560

// Modules that can be deep-linked via URL hash
const ROUTABLE = [
  'physics-sandbox', 'wave-mechanics', 'optics',
  'special-relativity', 'quantum-mechanics',
  'frontier-physics', 'dynamical-systems', 'electromagnetism',
  'general-relativity', 'thermodynamics', 'fluid-dynamics',
  'acoustic-physics',
]

function renderModule(id) {
  let inner = null
  if (id === 'physics-sandbox')     inner = <SandboxModule />
  else if (id === 'wave-mechanics')      inner = <WaveModule />
  else if (id === 'optics')              inner = <OpticsModule />
  else if (id === 'special-relativity')  inner = <SRModule />
  else if (id === 'quantum-mechanics')   inner = <QuantumModule />
  else if (id === 'frontier-physics')    inner = <FrontierModule />
  else if (id === 'electromagnetism')    inner = <ElectromagnetismModule />
  else if (id === 'dynamical-systems')   inner = <DynamicalModule />
  else if (id === 'sabrina') {
    if (sessionStorage.getItem('umbra_unlocked') !== '1') return null
    inner = <SabrinaModule />
  }
  else if (id === 'general-relativity')  inner = <GRModule />
  else if (id === 'thermodynamics')      inner = <ThermoModule />
  else if (id === 'fluid-dynamics')      inner = <FluidModule />
  else if (id === 'acoustic-physics')    inner = <AcousticModule />
  else return <ModulePicker />

  return <Suspense fallback={<ModuleFallback />}>{inner}</Suspense>
}

export default function App() {
  const activeModule  = useModuleStore((s) => s.activeModule)
  const setModule     = useModuleStore((s) => s.setActiveModule)

  const [rendered,    setRendered]  = useState(activeModule)
  const [phase,       setPhase]     = useState('idle')
  const [explainOn,   setExplainOn] = useState(false)
  const [transTarget, setTarget]    = useState(activeModule)
  const [booted,      setBooted]    = useState(
    () => sessionStorage.getItem('umbra_booted') === '1'
  )
  const prevRef    = useRef(activeModule)
  const popRef     = useRef(false)   // flag: change originated from popstate

  // ── Boot complete ──────────────────────────────────────────────────────────
  const handleBoot = useCallback(() => {
    sessionStorage.setItem('umbra_booted', '1')
    setBooted(true)
  }, [])

  // ── URL routing: init from hash on mount, or from shared ?s= state ────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('s')
    if (shared) {
      const decoded = decodeShareState(shared)
      if (decoded) {
        applySharedState(decoded)
        // Clean the ?s= from the URL so refreshes don't re-apply it
        window.history.replaceState(null, '', window.location.pathname + '#' + decoded.m)
        return
      }
    }
    const hash = window.location.hash.slice(1)
    if (ROUTABLE.includes(hash)) {
      setModule(hash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── URL routing: sync hash when module changes ─────────────────────────────
  useEffect(() => {
    if (popRef.current) { popRef.current = false; return }
    const hash = ROUTABLE.includes(activeModule) ? `#${activeModule}` : ''
    if (hash) {
      window.history.pushState(null, '', window.location.pathname + hash)
    } else {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [activeModule])

  // ── URL routing: back/forward button ──────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.slice(1)
      popRef.current = true
      setModule(ROUTABLE.includes(hash) ? hash : null)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [setModule])

  // ── Gesture: open-palm hold fires umbra-back → return to picker ───────────
  useEffect(() => {
    const handler = () => setModule(null)
    window.addEventListener('umbra-back', handler)
    return () => window.removeEventListener('umbra-back', handler)
  }, [setModule])

  // ── Track recently visited modules in localStorage ─────────────────────────
  useEffect(() => {
    if (!activeModule) return
    try {
      const prev = JSON.parse(localStorage.getItem('umbra_recent') || '[]')
      const next = [activeModule, ...prev.filter(x => x !== activeModule)].slice(0, 6)
      localStorage.setItem('umbra_recent', JSON.stringify(next))
    } catch {}
  }, [activeModule])

  // ── Escape key → go back to picker (only when not in command palette) ──────
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        if (window.__UMBRA_PALETTE_OPEN) return
        if (useModuleStore.getState().activeModule) setModule(null)
      } else if (e.key === 'e' || e.key === 'E') {
        if (window.__UMBRA_PALETTE_OPEN) return
        if (useModuleStore.getState().activeModule) setExplainOn(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setModule])

  // ── Transition orchestration ───────────────────────────────────────────────
  useEffect(() => {
    if (activeModule === prevRef.current) return
    const dest = activeModule
    prevRef.current = dest
    setTarget(dest)
    setPhase('out')
    warp()
    if (dest) startDrone(MOD_DRONE[dest] ?? 55)
    else stopDrone()
    const t1 = setTimeout(() => { setRendered(dest); setPhase('in') }, OUT_MS)
    const t2 = setTimeout(() => { setPhase('idle') }, OUT_MS + IN_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [activeModule])

  return (
    <GestureProvider>
      <AmbientGlow />
      <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
        {renderModule(rendered)}
      </div>
      <GestureHUD />
      <GestureEventBridge />
      <TransitionOverlay phase={phase} targetModule={transTarget} />
      {!booted && <BootScreen onComplete={handleBoot} />}
      <CursorAura />
      <SoundToggle />
      <CommandPalette />
      <FloatingToolbar explainActive={explainOn} onExplainToggle={() => setExplainOn(v => !v)} />
      <ExplainMode active={explainOn} onToggle={() => setExplainOn(v => !v)} />
      <StoryMode />
      <MultiplayerRoom />
      <GuideModal />
      {!activeModule && <ProfilePanel />}
      {!activeModule && <SurpriseMe />}
      {/* PhysicsTutor: fixed bottom-right, expands upward when open */}
      {activeModule && (
        <div style={{
          position: 'fixed', bottom: 72, right: 20, zIndex: 10080,
          width: 360, maxHeight: 'calc(100vh - 120px)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 16px 60px rgba(0,0,0,0.8)',
        }}>
          <PhysicsTutor />
        </div>
      )}
      <Challenges />
    </GestureProvider>
  )
}
