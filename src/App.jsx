import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
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

function AppInner() {
  const activeModule = useModuleStore((s) => s.activeModule)

  if (activeModule === 'physics-sandbox')      return <SandboxModule />
  if (activeModule === 'special-relativity')  return <SRModule />
  if (activeModule === 'quantum-mechanics')   return <QuantumModule />
  if (activeModule === 'frontier-physics')    return <FrontierModule />
  if (activeModule === 'electromagnetism')    return <ElectromagnetismModule />
  if (activeModule === 'dynamical-systems')   return <DynamicalModule />
  if (activeModule === 'sabrina') {
    if (sessionStorage.getItem('umbra_unlocked') !== '1') return null
    return <SabrinaModule />
  }
  if (activeModule === 'general-relativity')  return <GRModule />
  if (activeModule === 'thermodynamics')      return <ThermoModule />
  if (activeModule === 'fluid-dynamics')      return <FluidModule />

  return <ModulePicker />
}

export default function App() {
  return (
    <GestureProvider>
      <AppInner />
      <GestureHUD />
      <GestureEventBridge />
    </GestureProvider>
  )
}
