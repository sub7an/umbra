import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import SRModule from './modules/special-relativity/SRModule'
import QuantumModule from './modules/quantum/QuantumModule'
import FrontierModule from './modules/frontier/FrontierModule'
import ElectromagnetismModule from './modules/electromagnetism/ElectromagnetismModule'
import DynamicalModule from './modules/dynamical/DynamicalModule'

export default function App() {
  const activeModule = useModuleStore((s) => s.activeModule)

  if (activeModule === 'special-relativity') return <SRModule />
  if (activeModule === 'quantum-mechanics') return <QuantumModule />
  if (activeModule === 'frontier-physics') return <FrontierModule />
  if (activeModule === 'electromagnetism') return <ElectromagnetismModule />
  if (activeModule === 'dynamical-systems') return <DynamicalModule />

  return <ModulePicker />
}
