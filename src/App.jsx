import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
import TransitionOverlay from './components/TransitionOverlay'
import BootScreen from './components/BootScreen'
import { GestureProvider } from './context/GestureContext'

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

function ModuleFallback() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#04090c',
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

const OUT_MS = 380
const IN_MS  = 400

// Modules that can be deep-linked via URL hash
const ROUTABLE = [
  'physics-sandbox', 'wave-mechanics', 'optics',
  'special-relativity', 'quantum-mechanics',
  'frontier-physics', 'dynamical-systems', 'electromagnetism',
  'general-relativity', 'thermodynamics', 'fluid-dynamics',
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
  else return <ModulePicker />

  return <Suspense fallback={<ModuleFallback />}>{inner}</Suspense>
}

export default function App() {
  const activeModule  = useModuleStore((s) => s.activeModule)
  const setModule     = useModuleStore((s) => s.setActiveModule)

  const [rendered,    setRendered]  = useState(activeModule)
  const [phase,       setPhase]     = useState('idle')
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

  // ── URL routing: init from hash on mount ───────────────────────────────────
  useEffect(() => {
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

  // ── Transition orchestration ───────────────────────────────────────────────
  useEffect(() => {
    if (activeModule === prevRef.current) return
    const dest = activeModule
    prevRef.current = dest
    setTarget(dest)
    setPhase('out')
    const t1 = setTimeout(() => { setRendered(dest); setPhase('in') }, OUT_MS)
    const t2 = setTimeout(() => { setPhase('idle') }, OUT_MS + IN_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [activeModule])

  return (
    <GestureProvider>
      <div style={{ width: '100%', height: '100%' }}>
        {renderModule(rendered)}
      </div>
      <GestureHUD />
      <GestureEventBridge />
      <TransitionOverlay phase={phase} targetModule={transTarget} />
      {!booted && <BootScreen onComplete={handleBoot} />}
    </GestureProvider>
  )
}
