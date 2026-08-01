import { Analytics } from '@vercel/analytics/react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import SRModule from './modules/special-relativity/SRModule'
import QuantumModule from './modules/quantum/QuantumModule'
import FrontierModule from './modules/frontier/FrontierModule'

export default function App() {
  const activeModule = useModuleStore((s) => s.activeModule)

  let content
  if (activeModule === 'special-relativity') content = <SRModule />
  else if (activeModule === 'quantum-mechanics') content = <QuantumModule />
  else if (activeModule === 'frontier-physics') content = <FrontierModule />
  else content = <ModulePicker />

  return (
    <>
      {content}
      <Analytics />
    </>
  )
}
