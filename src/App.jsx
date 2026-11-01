import { Component, useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import useModuleStore from './store/useModuleStore'
import ModulePicker from './components/ModulePicker'
import GestureHUD from './components/GestureHUD'
import GestureEventBridge from './components/GestureEventBridge'
import TransitionOverlay from './components/TransitionOverlay'
import BootScreen from './components/BootScreen'
import CursorAura from './components/CursorAura'
import CommandPalette from './components/CommandPalette'
import { decodeShareState, applySharedState } from './components/ShareButton'
import FloatingToolbar from './components/FloatingToolbar'
import { GestureProvider } from './context/GestureContext'
import CheckoutBanner from './components/CheckoutBanner'
import { track } from '@vercel/analytics'
import { warp, startDrone, stopDrone } from './lib/sound'
import { prefersReducedMotion } from './lib/motion'
import { SITE, bySimId } from './content/simulations'
import { viewIdForSlug } from './content/simulationPages'

// Overlay panels, fetched after first paint (each renders nothing until opened)
const Challenges = lazy(() => import('./components/Challenges'))
const ExplainMode = lazy(() => import('./components/ExplainMode'))
const StoryMode = lazy(() => import('./components/StoryMode'))
const MultiplayerRoom = lazy(() => import('./components/MultiplayerRoom'))
const GuideModal = lazy(() => import('./components/GuideModal'))
const ProfilePanel = lazy(() => import('./components/ProfilePanel'))
const SurpriseMe = lazy(() => import('./components/SurpriseMe'))
const PricingPanel = lazy(() => import('./components/PricingPanel'))
const AboutPanel = lazy(() => import('./components/AboutPanel'))
const AuthPanel = lazy(() => import('./components/AuthPanel'))
const TelescopeLive = lazy(() => import('./components/TelescopeLive'))
const TelescopeContextBanner = lazy(() => import('./components/TelescopeContextBanner'))

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
      background: '#0b0d12',
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

// Catches a module that fails to load (chunk fetch failed — offline, server down,
// or a redeploy replaced the chunk) or crashes while rendering, so one module
// can't black out the whole app. React.lazy caches the rejected import, so
// "retry" reloads the page; the URL hash reopens the same module.
class ModuleErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Module failed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const isLoadError = /dynamically imported module|Importing a module script failed|Loading chunk/i
      .test(String(this.state.error?.message))
    const btn = {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
      padding: '8px 16px', borderRadius: 2, cursor: 'pointer', background: 'transparent',
    }
    return (
      <div role="alert" style={{
        width: '100%', height: '100%', background: '#0b0d12',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', padding: 16,
      }}>
        <div style={{ fontSize: 13, letterSpacing: '0.22em', color: 'rgba(34,211,238,0.85)' }}>
          {isLoadError ? "COULDN'T LOAD THIS MODULE" : 'THIS MODULE HIT AN ERROR'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', maxWidth: 360, lineHeight: 1.6 }}>
          {isLoadError
            ? 'Check your connection, or the site may have just updated. Retrying will fetch the latest version.'
            : 'Something went wrong inside the simulation. Retry, or pick another module.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.location.reload()} style={{
            ...btn, color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)',
          }}>RETRY</button>
          <button onClick={() => useModuleStore.getState().setActiveModule(null)} style={{
            ...btn, color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)',
          }}>← MODULES</button>
        </div>
      </div>
    )
  }
}

const OUT_MS = 180
const IN_MS  = 220

// ?embed=1 → bare simulation for iframe embedding (LMS, Notion, blogs)
const IS_EMBED = new URLSearchParams(window.location.search).get('embed') === '1'

// Modules with their own page at /simulations/<id> (old #<id> links still work)
const ROUTABLE = [
  'physics-sandbox', 'wave-mechanics', 'optics',
  'special-relativity', 'quantum-mechanics',
  'frontier-physics', 'dynamical-systems', 'electromagnetism',
  'general-relativity', 'thermodynamics', 'fluid-dynamics',
  'acoustic-physics',
]

const modulePath = (id) => `/simulations/${id}`

const SIM_PATH = /^\/simulations\/([a-z-]+)(?:\/([a-z0-9-]+))?\/?$/

// Module named by the URL: /simulations/<id>[/<view>], or a legacy #<id> link
function moduleFromLocation() {
  const m = window.location.pathname.match(SIM_PATH)
  if (m && ROUTABLE.includes(m[1])) return m[1]
  const hash = window.location.hash.slice(1)
  return ROUTABLE.includes(hash) ? hash : null
}

// View named by /simulations/<id>/<view>, as the module's internal view id
function viewFromLocation(id) {
  const m = window.location.pathname.match(SIM_PATH)
  return m && m[1] === id && m[2] ? viewIdForSlug(id, m[2]) : null
}

// Open a module (and the view its URL names, if any)
function openFromLocation(setModule) {
  const id = moduleFromLocation()
  const view = id && viewFromLocation(id)
  useModuleStore.getState().setPendingView(view ? { module: id, view } : null)
  setModule(id)
}

// Tab title and description follow in-app navigation. The canonical tag is
// left as served: crawlers read it from the prerendered HTML.
function applyPageMeta(id) {
  const page = bySimId[id]
  document.title = page ? page.title : SITE.title
  document.querySelector('meta[name="description"]')?.setAttribute('content', page ? page.description : SITE.description)
}

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

  return (
    <ModuleErrorBoundary key={id}>
      <Suspense fallback={<ModuleFallback />}>{inner}</Suspense>
    </ModuleErrorBoundary>
  )
}

export default function App() {
  const activeModule  = useModuleStore((s) => s.activeModule)
  const setModule     = useModuleStore((s) => s.setActiveModule)

  const [rendered,    setRendered]  = useState(activeModule)
  const [phase,       setPhase]     = useState('idle')
  const [explainOn,   setExplainOn] = useState(false)
  const [present,     setPresent]   = useState(false)
  const presentRef = useRef(false)
  const [transTarget, setTarget]    = useState(activeModule)
  const [booted,      setBooted]    = useState(
    // Visitors landing straight on a simulation (search, shared links) go
    // directly into it; the boot splash is for the homepage
    () => sessionStorage.getItem('umbra_booted') === '1' || prefersReducedMotion() || moduleFromLocation() !== null
  )
  const prevRef    = useRef(activeModule)
  const popRef     = useRef(false)   // flag: change originated from popstate
  const firstInteractionCleanup = useRef(null)

  // ── Boot complete ──────────────────────────────────────────────────────────
  const handleBoot = useCallback(() => {
    sessionStorage.setItem('umbra_booted', '1')
    setBooted(true)
  }, [])

  // ── URL routing: init from the path (or a shared ?s= state) on mount ──────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('s')
    if (shared) {
      const decoded = decodeShareState(shared)
      if (decoded) {
        applySharedState(decoded)
        // Drop ?s= so refreshes don't re-apply it
        params.delete('s')
        const qs = params.toString()
        window.history.replaceState(null, '', (ROUTABLE.includes(decoded.m) ? modulePath(decoded.m) : '/') + (qs ? `?${qs}` : ''))
        return
      }
    }
    if (moduleFromLocation()) openFromLocation(setModule)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── URL routing: keep the path in step with the open module ───────────────
  // The first sync replaces the entry (normalising a legacy #hash link);
  // later ones push, so Back returns to the previous screen.
  const firstSync = useRef(true)
  useEffect(() => {
    // The served page already has the right title on first load
    if (!firstSync.current) applyPageMeta(activeModule)
    if (popRef.current) { popRef.current = false; return }
    const { pathname, search } = window.location
    const onModulePath = SIM_PATH.test(pathname)
    // Already on this module's page or one of its view pages
    const inSync = ROUTABLE.includes(activeModule) && pathname.match(SIM_PATH)?.[1] === activeModule
    let target = null
    if (ROUTABLE.includes(activeModule)) target = inSync ? null : modulePath(activeModule)
    else if (!activeModule && (onModulePath || window.location.hash)) target = '/'
    if (target && (target !== pathname || window.location.hash)) {
      const replace = firstSync.current || !activeModule
      window.history[replace ? 'replaceState' : 'pushState'](null, '', target + search)
    }
    firstSync.current = false
  }, [activeModule])

  // ── URL routing: back/forward button ──────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const id = moduleFromLocation()
      // Only flag a pop that actually changes the module; otherwise the flag
      // would linger and swallow the next real navigation
      if (id === useModuleStore.getState().activeModule) return
      popRef.current = true
      openFromLocation(setModule)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
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
        if (presentRef.current) { setPresent(false); return }
        if (useModuleStore.getState().activeModule) setModule(null)
      } else if (e.key === 'e' || e.key === 'E') {
        if (window.__UMBRA_PALETTE_OPEN) return
        if (useModuleStore.getState().activeModule) setExplainOn(v => !v)
      } else if (e.key === 'p' || e.key === 'P') {
        if (window.__UMBRA_PALETTE_OPEN) return
        if (useModuleStore.getState().activeModule) setPresent(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setModule])

  // ── Presentation mode: fullscreen, chrome hidden ───────────────────────────
  useEffect(() => {
    presentRef.current = present
    if (present) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [present])

  // Exiting browser fullscreen (F11 chrome, Esc) drops presentation mode too
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setPresent(false) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // ── Transition orchestration ───────────────────────────────────────────────
  useEffect(() => {
    if (activeModule === prevRef.current) return
    const dest = activeModule
    prevRef.current = dest
    setTarget(dest)
    setPhase('out')
    if (!IS_EMBED) {
      warp()
      if (dest) startDrone(MOD_DRONE[dest] ?? 55)
      else stopDrone()
    }
    if (dest) track('module_enter', { module: dest })
    if (dest) {
      // First real interaction with the simulation or its controls on this visit
      const startedAt = performance.now()
      const onFirst = (e) => {
        if (!e.target.closest?.('main, [role="toolbar"], aside')) return
        track('first_interaction', { module: dest, seconds: Math.round((performance.now() - startedAt) / 1000) })
        window.removeEventListener('pointerdown', onFirst, true)
      }
      window.addEventListener('pointerdown', onFirst, true)
      firstInteractionCleanup.current?.()
      firstInteractionCleanup.current = () => window.removeEventListener('pointerdown', onFirst, true)
    }
    const t1 = setTimeout(() => { setRendered(dest); setPhase('in') }, OUT_MS)
    const t2 = setTimeout(() => { setPhase('idle') }, OUT_MS + IN_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [activeModule])

  // ── Embed mode: bare simulation + attribution badge, no app chrome ────────
  if (IS_EMBED) {
    return (
      <GestureProvider>
        <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
          {renderModule(rendered)}
        </div>
        <a
          href={`https://umbrasandbox.com/${ROUTABLE.includes(activeModule) ? '#' + activeModule : ''}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'fixed', bottom: 10, right: 12, zIndex: 10000,
            display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
            color: 'rgba(124,140,255,0.85)', background: 'rgba(8,9,10,0.8)',
            border: '1px solid rgba(124,140,255,0.3)', borderRadius: 4, padding: '5px 10px',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⬡ UMBRA
        </a>
      </GestureProvider>
    )
  }

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
      {!prefersReducedMotion() && <CursorAura />}
      <CommandPalette />
      {!present && <FloatingToolbar explainActive={explainOn} onExplainToggle={() => setExplainOn(v => !v)} />}
      <Suspense fallback={null}>
      <ExplainMode active={explainOn} onToggle={() => setExplainOn(v => !v)} />
      {!present && <StoryMode />}
      {!present && <MultiplayerRoom />}
      {!present && <GuideModal />}
      {!activeModule && <ProfilePanel />}
      {!activeModule && <SurpriseMe />}
      {/* PhysicsTutor lives docked in each module's InfoPanel (left column) —
          the TUTOR toolbar button and click-to-explain both drive it there.
          No floating copy: it used to overlap the right-side controls. */}
      {!present && <Challenges />}
      <PricingPanel />
      <AboutPanel />
      <AuthPanel />
      <TelescopeLive />
      <TelescopeContextBanner />
      </Suspense>
      <CheckoutBanner />
      {present && (
        <div style={{
          position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '0.14em', color: 'rgba(255,255,255,0.30)',
          pointerEvents: 'none', animation: 'umbra-slide-up 0.4s ease',
        }}>
          PRESENTATION MODE · P TO EXIT
        </div>
      )}
    </GestureProvider>
  )
}
