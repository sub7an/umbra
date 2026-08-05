import { useState, useEffect, useRef } from 'react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
import TransitionOverlay from './components/TransitionOverlay'
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

const OUT_MS = 380   // how long the "warp out" animation runs before switch
const IN_MS  = 400   // how long the "warp in" animation runs after switch

function renderModule(id) {
  if (id === 'physics-sandbox')      return <SandboxModule />
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
  const activeModule = useModuleStore((s) => s.activeModule)

  // `rendered` lags behind `activeModule` by the transition duration
  const [rendered,  setRendered]  = useState(activeModule)
  const [phase,     setPhase]     = useState('idle')   // 'out' | 'in' | 'idle'
  const [transTarget, setTarget]  = useState(activeModule)
  const prevRef = useRef(activeModule)

  useEffect(() => {
    if (activeModule === prevRef.current) return
    const dest = activeModule
    prevRef.current = dest

    setTarget(dest)
    setPhase('out')

    const t1 = setTimeout(() => {
      setRendered(dest)
      setPhase('in')
    }, OUT_MS)

    const t2 = setTimeout(() => {
      setPhase('idle')
    }, OUT_MS + IN_MS)

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
    </GestureProvider>
  )
}
