import { useState, useEffect } from 'react'
import katex from 'katex'
import PhysicsTutor from './PhysicsTutor'
import PhaseDiagram from './PhaseDiagram'

function KatexMath({ tex, block = false }) {
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: block,
    trust: true,
    strict: false,
  })
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={block ? 'block' : 'inline'}
    />
  )
}

function DataRow({ label, value, unit, color = 'cyan' }) {
  const colorMap = {
    cyan: 'text-cyan-glow glow-cyan',
    amber: 'text-amber-glow glow-amber',
    rose: 'text-rose-glow glow-rose',
    dim: 'text-text-dim',
  }
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">
      <span className="font-display text-[13px] tracking-widest uppercase text-text-dim shrink-0">
        {label}
      </span>
      <span className={`font-mono-data text-sm tabular-nums ${colorMap[color]}`}>
        {value}
        {unit && <span className="text-text-dim text-xs ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

export default function InfoPanel({
  title = 'Analysis',
  domain = '',
  primaryEq = '',
  derivedEqs = [],
  formula = '',
  explanation = '',
  metrics = [],
  syllabus = '',
  tryThis = [],
  checkpoint = null,
  footer = 'SPECIAL RELATIVITY · SR MODULE',
  isOpen: defaultOpen = true,
  accentColor = 'amber',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { setRevealed(false) }, [checkpoint?.q])

  const accentDotClass =
    { amber: 'bg-amber-glow shadow-glow-amber', cyan: 'bg-cyan-glow shadow-glow-cyan', rose: 'bg-rose-glow shadow-glow-rose' }[accentColor]
    ?? 'bg-amber-glow shadow-glow-amber'

  return (
    <aside className="flex flex-col flex-1 min-h-0 bg-panel osc-grid border-r border-border-subtle">
      {/* Header / collapse toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-border-subtle group focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-glow shrink-0"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse-glow ${accentDotClass}`} />
          <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim group-hover:text-text-primary transition-colors duration-200">
            {title}
          </span>
        </div>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          className={`text-text-dim group-hover:text-cyan-glow transition-all duration-200 ${isOpen ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="flex-1 overflow-y-auto thin-scroll flex flex-col min-h-0">

          {/* Physics domain label */}
          {domain && (
            <div className="px-4 pt-3 pb-1.5">
              <p className="font-mono-data text-[11px] tracking-[0.22em] uppercase leading-snug" style={{ color: '#8b9cf7' }}>
                {domain}
              </p>
              {syllabus && (
                <span
                  className="inline-block mt-1.5 px-1.5 py-0.5 rounded-sm font-mono-data text-[11px] tracking-[0.12em] uppercase"
                  style={{ color: '#9aa7ff', background: 'rgba(94,106,210,0.10)', border: '1px solid rgba(94,106,210,0.25)' }}
                  title="Curriculum reference"
                >
                  {syllabus}
                </span>
              )}
            </div>
          )}

          {/* Primary governing equation — KaTeX display mode */}
          {primaryEq && (
            <div className="px-3 py-4 border-b border-border-subtle">
              <div
                className="flex justify-center overflow-x-auto"
                style={{ fontSize: '13px', color: '#f7f8f8', lineHeight: 1.5 }}
              >
                <KatexMath tex={primaryEq} block />
              </div>
            </div>
          )}

          {/* Legacy plain-text formula — shown only when no KaTeX primary */}
          {!primaryEq && formula && (
            <div className="px-4 py-3 border-b border-border-subtle">
              <p
                className="font-mono-data text-[13px] leading-relaxed text-cyan-glow text-center"
                style={{ textShadow: '0 0 8px rgba(94,106,210,0.45)' }}
              >
                {formula}
              </p>
            </div>
          )}

          {/* Derived / conserved quantities */}
          {derivedEqs.length > 0 && (
            <div className="px-3 py-3 border-b border-border-subtle space-y-3">
              {derivedEqs.map((d, i) => (
                <div key={i}>
                  {d.label && (
                    <p className="font-mono-data text-[11px] tracking-[0.18em] uppercase mb-1 leading-tight" style={{ color: '#8b9cf7' }}>
                      {d.label}
                    </p>
                  )}
                  <div
                    className="overflow-x-auto"
                    style={{ fontSize: '11px', color: '#f7f8f8', lineHeight: 1.7 }}
                  >
                    <KatexMath tex={d.eq} block={false} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live metrics */}
          {metrics.length > 0 && (
            <div className="px-4 py-3 border-b border-border-subtle">
              {metrics.map((m) => (
                <DataRow key={m.label} label={m.label} value={m.value} unit={m.unit} color={m.color} />
              ))}
            </div>
          )}

          {/* Explanation text */}
          {explanation && (
            <div className="px-4 py-4">
              <p className="font-body text-[14px] leading-relaxed text-text-primary">{explanation}</p>
            </div>
          )}

          {/* Try this — guided exploration prompts */}
          {tryThis.length > 0 && (
            <div className="px-4 pb-4 border-b border-border-subtle">
              <p className="font-mono-data text-[11px] tracking-[0.18em] uppercase mb-2" style={{ color: '#8b9cf7' }}>
                Try this
              </p>
              <ul className="space-y-1.5">
                {tryThis.map((t, i) => (
                  <li key={i} className="flex gap-2 font-body text-[14px] leading-snug text-text-primary">
                    <span style={{ color: '#9aa7ff' }}>→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Predict-first checkpoint */}
          {checkpoint && (
            <div className="px-4 py-4 flex-1">
              <p className="font-mono-data text-[11px] tracking-[0.18em] uppercase mb-2" style={{ color: '#8b9cf7' }}>
                Predict
              </p>
              <p className="font-body text-[14px] leading-snug text-text-primary mb-2">{checkpoint.q}</p>
              {revealed ? (
                <p className="font-body text-[14px] leading-snug" style={{ color: '#9aa7ff' }}>{checkpoint.a}</p>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="font-mono-data text-[11px] tracking-[0.14em] uppercase px-2 py-1 rounded-sm"
                  style={{ color: '#9aa7ff', background: 'rgba(94,106,210,0.10)', border: '1px solid rgba(94,106,210,0.25)' }}
                >
                  Reveal answer
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <PhysicsTutor />
      <PhaseDiagram />

      <div className="px-4 py-3 border-t border-border-subtle shrink-0">
        <p className="font-mono-data text-[12px] text-text-dim leading-relaxed">{footer}</p>
      </div>
    </aside>
  )
}
