import { useEffect, useRef, useState } from 'react'
import useModuleStore from '../store/useModuleStore'

// Shared frame for every module screen: one top bar (back · title · view tabs ·
// live readout · panel toggles), a lesson panel on the left, the simulation in
// the middle and a controls panel on the right. On wide screens the panels
// dock beside the scene; below 1024px they become slide-over drawers so the
// simulation keeps the full width. Either panel can be hidden to give the
// scene the whole screen (useful when projecting).

const WIDE = '(min-width: 1024px)'

function useIsWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const h = (e) => setWide(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return wide
}

function PanelToggle({ label, open, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      title={`${open ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      className={`ui-btn-ghost h-9 px-2.5 ${open ? 'text-text-primary bg-panel-hover' : ''}`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}

const LessonIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)
const ControlsIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4.5h12M2 11.5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="10.5" cy="4.5" r="1.8" fill="rgb(var(--c-ground))" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="5.5" cy="11.5" r="1.8" fill="rgb(var(--c-ground))" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)

// Scene view tabs. Scrolls sideways when they don't fit, keeping the active
// tab in view.
function ViewTabs({ views, activeView, onViewChange, label, className = '' }) {
  const navRef = useRef(null)
  useEffect(() => {
    navRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeView])
  return (
    <nav ref={navRef} className={`items-center gap-1 min-w-0 overflow-x-auto thin-scroll px-1 ${className}`} role="tablist" aria-label={label}>
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={activeView === v.id}
          title={v.title}
          onClick={() => onViewChange?.(v.id)}
          className="ui-tab shrink-0"
        >
          {v.label}
        </button>
      ))}
    </nav>
  )
}

export default function ModuleShell({
  title,
  accent = 'rgb(var(--c-brand))',
  views = [],
  activeView,
  onViewChange,
  viewsLabel = 'Scene views',
  readout = null,
  lesson = null,
  controls = null,
  children,
}) {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const wide = useIsWide()
  const [lessonOpen, setLessonOpen] = useState(wide)
  const [controlsOpen, setControlsOpen] = useState(wide)

  // Re-dock both panels when the window grows past the breakpoint, and fold
  // them away into drawers when it shrinks.
  useEffect(() => {
    setLessonOpen(wide)
    setControlsOpen(wide)
  }, [wide])

  const closeDrawers = () => {
    if (wide) return
    setLessonOpen(false)
    setControlsOpen(false)
  }

  const drawer = !wide
  const lessonCls = drawer
    ? 'absolute inset-y-0 left-0 z-30 w-[min(340px,88vw)] shadow-card'
    : 'relative w-80 shrink-0'
  const controlsCls = drawer
    ? 'absolute inset-y-0 right-0 z-30 w-[min(300px,88vw)] shadow-card'
    : 'relative w-72 shrink-0'

  return (
    <div className="flex flex-col w-full h-full bg-ground text-text-primary">
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 h-14 px-3 sm:px-4 bg-panel border-b border-border-subtle shrink-0">
        <button
          type="button"
          onClick={() => setActiveModule(null)}
          className="ui-btn-ghost h-9 px-2 -ml-1 shrink-0"
          aria-label="Back to all modules"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Modules</span>
        </button>

        <div className="w-px h-6 bg-border-subtle shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-2 min-w-0 shrink-0 max-w-[45%]">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }} aria-hidden="true" />
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] truncate">{title}</h1>
        </div>

        {views.length > 0 && (
          <ViewTabs views={views} activeView={activeView} onViewChange={onViewChange} label={viewsLabel}
            className="hidden md:flex mx-auto" />
        )}
        <div className={`flex-1 ${views.length > 0 ? 'md:hidden' : ''}`} />

        {readout && (
          <div className="hidden md:flex items-center h-8 px-2.5 rounded-md bg-ground border border-border-subtle font-mono-data text-[13px] tabular-nums text-text-primary shrink-0">
            {readout}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {lesson && (
            <PanelToggle label="Lesson" icon={LessonIcon} open={lessonOpen}
              onClick={() => { setLessonOpen((o) => !o); if (drawer) setControlsOpen(false) }} />
          )}
          {controls && (
            <PanelToggle label="Controls" icon={ControlsIcon} open={controlsOpen}
              onClick={() => { setControlsOpen((o) => !o); if (drawer) setLessonOpen(false) }} />
          )}
        </div>
      </header>

      {/* Phones: views get their own full-width row instead of a clipped strip */}
      {views.length > 0 && (
        <div className="md:hidden flex items-center h-11 px-2 bg-panel border-b border-border-subtle shrink-0">
          <ViewTabs views={views} activeView={activeView} onViewChange={onViewChange} label={viewsLabel} className="flex w-full" />
        </div>
      )}

      {/* ── Body ── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {lesson && lessonOpen && (
          <div className={`${lessonCls} flex flex-col min-h-0 pb-16 bg-panel border-r border-border-subtle`}>
            {lesson}
          </div>
        )}

        <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden" aria-label={`${title} simulation`}>
          {children}
        </main>

        {controls && controlsOpen && (
          <div className={`${controlsCls} flex flex-col min-h-0 pb-16 bg-panel border-l border-border-subtle`}>
            {controls}
          </div>
        )}

        {drawer && (lessonOpen || controlsOpen) && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={closeDrawers}
            className="absolute inset-0 z-20 bg-ground/50 cursor-default"
          />
        )}
      </div>
    </div>
  )
}

// Small caption pinned to the top-left of the scene (what you're looking at)
export function SceneCaption({ children }) {
  return (
    <div className="absolute top-3 left-3 max-w-[calc(100%-24px)] pointer-events-none px-2.5 py-1 rounded-md bg-ground/70 border border-border-subtle text-[12px] text-text-dim backdrop-blur-sm">
      {children}
    </div>
  )
}

// Colour key for a scene: [{ color, symbol, label }]
export function Legend({ items }) {
  return (
    <ul className="space-y-1.5 text-[13px] text-text-dim">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className="w-4 text-center" style={{ color: it.color, opacity: it.opacity ?? 1 }} aria-hidden="true">{it.symbol ?? '●'}</span>
          {it.label}
        </li>
      ))}
    </ul>
  )
}
