import { useState, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'

const MOD_SLICE = {
  'special-relativity': 'sr',
  'quantum-mechanics':  'qm',
  'dynamical-systems':  'ds',
  'electromagnetism':   'em',
  'frontier-physics':   'fp',
  'general-relativity': 'gr',
  'thermodynamics':     'thermo',
  'fluid-dynamics':     'fluid',
}

export function encodeShareState() {
  const s = useModuleStore.getState()
  const { activeModule } = s
  if (!activeModule) return null
  const payload = { m: activeModule }
  const key = MOD_SLICE[activeModule]
  if (key) payload.s = s[key]
  return btoa(JSON.stringify(payload))
}

export function decodeShareState(encoded) {
  try {
    return JSON.parse(atob(encoded))
  } catch {
    return null
  }
}

export function applySharedState(decoded) {
  if (!decoded?.m) return
  const store = useModuleStore.getState()
  store.setActiveModule(decoded.m)
  if (!decoded.s) return

  const key = MOD_SLICE[decoded.m]
  if (key === 'sr' && decoded.s) {
    if (decoded.s.velocity !== undefined) store.setSrVelocity(decoded.s.velocity)
    if (decoded.s.eventX !== undefined && decoded.s.eventT !== undefined)
      store.setSrEvent(decoded.s.eventX, decoded.s.eventT)
  } else if (key === 'qm' && decoded.s) {
    if (decoded.s.blochTheta  !== undefined) store.setBlochTheta(decoded.s.blochTheta)
    if (decoded.s.blochPhi    !== undefined) store.setBlochPhi(decoded.s.blochPhi)
    if (decoded.s.boxN        !== undefined) store.setBoxN(decoded.s.boxN)
    if (decoded.s.slitWavelength !== undefined) store.setSlitWavelength(decoded.s.slitWavelength)
    if (decoded.s.slitMeasured   !== undefined) store.setSlitMeasured(decoded.s.slitMeasured)
    if (decoded.s.boxVizMode     !== undefined) store.setBoxVizMode(decoded.s.boxVizMode)
    if (decoded.s.blochVizMode   !== undefined) store.setBlochVizMode(decoded.s.blochVizMode)
    if (decoded.s.entangleAlpha  !== undefined) store.setEntangleAlpha(decoded.s.entangleAlpha)
    if (decoded.s.tunnelV0       !== undefined) store.setTunnelV0(decoded.s.tunnelV0)
    if (decoded.s.tunnelK0       !== undefined) store.setTunnelK0(decoded.s.tunnelK0)
  } else if (key === 'ds' && decoded.s) {
    if (decoded.s.attractorType !== undefined) store.setDsAttractorType(decoded.s.attractorType)
    if (decoded.s.phaseMu       !== undefined) store.setDsPhaseMu(decoded.s.phaseMu)
  } else if (key === 'em' && decoded.s) {
    if (decoded.s.magnetType !== undefined) store.setEmMagnetType(decoded.s.magnetType)
  } else if (key === 'fp' && decoded.s) {
    if (decoded.s.fpRadius !== undefined) store.setFpRadius(decoded.s.fpRadius)
    if (decoded.s.hubble   !== undefined) store.setFpHubble(decoded.s.hubble)
    if (decoded.s.bhMass   !== undefined) store.setFpBhMass(decoded.s.bhMass)
  } else if (key === 'gr' && decoded.s) {
    if (decoded.s.mass     !== undefined) store.setGrMass(decoded.s.mass)
    if (decoded.s.viewType !== undefined) store.setGrView(decoded.s.viewType)
  } else if (key === 'thermo' && decoded.s) {
    if (decoded.s.temperature !== undefined) store.setThermoTemp(decoded.s.temperature)
    if (decoded.s.viewType    !== undefined) store.setThermoView(decoded.s.viewType)
  } else if (key === 'fluid' && decoded.s) {
    if (decoded.s.viewType !== undefined) store.setFluidView(decoded.s.viewType)
    if (decoded.s.reynolds !== undefined) store.setFluidReynolds(decoded.s.reynolds)
  }
}

export default function ShareButton() {
  const activeModule = useModuleStore(s => s.activeModule)
  const [status, setStatus] = useState('idle') // 'idle' | 'copied' | 'error'

  const handleShare = useCallback(async () => {
    const encoded = encodeShareState()
    if (!encoded) return
    const url = new URL(window.location.href)
    url.search = `?s=${encoded}`
    url.hash = ''
    try {
      await navigator.clipboard.writeText(url.toString())
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 2200)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2200)
    }
  }, [])

  if (!activeModule) return null

  return (
    <button
      onClick={handleShare}
      title="Copy shareable link"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9980,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.12em',
        color: status === 'copied' ? '#f59e0b' : 'rgba(245,158,11,0.45)',
        background: status === 'copied' ? 'rgba(245,158,11,0.08)' : 'rgba(8,6,4,0.72)',
        border: `1px solid ${status === 'copied' ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.14)'}`,
        borderRadius: 4,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (status === 'idle') {
          e.currentTarget.style.color = 'rgba(245,158,11,0.85)'
          e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'
        }
      }}
      onMouseLeave={e => {
        if (status === 'idle') {
          e.currentTarget.style.color = 'rgba(245,158,11,0.45)'
          e.currentTarget.style.borderColor = 'rgba(245,158,11,0.14)'
        }
      }}
    >
      {status === 'copied' ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5L4.5 8L9 3" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          COPIED
        </>
      ) : status === 'error' ? (
        'COPY FAILED'
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M4.5 3H3C2.45 3 2 3.45 2 4V8.5C2 9.05 2.45 9.5 3 9.5H7.5C8.05 9.5 8.5 9.05 8.5 8.5V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M6 2H9V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 2L5.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          SHARE
        </>
      )}
    </button>
  )
}
