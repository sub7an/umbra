import { useState, useEffect, useRef, useCallback } from 'react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
import TransitionOverlay from './components/TransitionOverlay'
import BootScreen from './components/BootScreen'
import { GestureProvider } from './context/GestureContext'
import SRModule from './modules/special-relativity/SRModule'
import QuantumModule from './modules/quantum/QuantumModule'
import FrontierModule from './modules/frontier/FrontierModule'
import ElectromagnetismModule from './modules/electromagnetism/ElectromagnetismModule'
import DynamicalModule from './modules/dynamical/DynamicalModule'
import SabrinaModule from './modules/sabrina/SabrinaModule'
import GRModule from './modules/general-relativity/GRModule'
import ThermoModule from './modules/thermodynamics/ThermoModule'
import FluidModule from './modules/fluid-dynamics/FluidModule'
import SandboxModule from './modules/physics-sandbox/SandboxModule'
import WaveModule from './modules/wave/WaveModule'

const OUT_MS = 380
const IN_MS  = 400

// Modules that can be deep-linked via URL hash
const ROUTABLE = [
  'physics-sandbox', 'wave-mechanics', 'special-relativity', 'quantum-mechanics',
  'frontier-physics', 'dynamical-systems', 'electromagnetism',
  'general-relativity', 'thermodynamics', 'fluid-dynamics',
]

function renderModule(id) {
  if (id === 'physics-sandbox')     return <SandboxModule />
  if (id === 'wave-mechanics')      return <WaveModule />
  if (id === 'special-relativity')  return <SRModule />
  if (id === 'quantum-mechanics')   return <QuantumModule />
  if (id === 'frontier-physics')    return <FrontierModule />
  if (id === 'electromagnetism')    return <ElectromagnetismModule />
  if (id === 'dynamical-systems')   return <DynamicalModule />
  if (id === 'sabrina') {
    if (sessionStorage.getItem('umbra_unlocked') !== '1') return null
    return <SabrinaModule />
  }
  if (id === 'general-relativity')  return <GRModule />
  if (id === 'thermodynamics')      return <ThermoModule />
  if (id === 'fluid-dynamics')      return <FluidModule />
  return <ModulePicker />
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
