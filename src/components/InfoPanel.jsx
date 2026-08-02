import { useState } from 'react'
import katex from 'katex'

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
      <span className="font-display text-[11px] tracking-widest uppercase text-text-dim shrink-0">
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
  footer = 'SPECIAL RELATIVITY · SR MODULE',
  isOpen: defaultOpen = true,
  accentColor = 'amber',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const accentDotClass =
    { amber: 'bg-amber-glow shadow-glow-amber', cyan: 'bg-cyan-glow shadow-glow-cyan', rose: 'bg-rose-glow shadow-glow-rose' }[accentColor]
    ?? 'bg-amber-glow shadow-glow-amber'

  return (
    <aside className="flex flex-col h-full bg-panel osc-grid border-r border-border-subtle">
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
              <p className="font-mono-data text-[9px] tracking-[0.22em] uppercase leading-snug" style={{ color: '#4a9090' }}>
                {domain}
              </p>
            </div>
          )}

          {/* Primary governing equation — KaTeX display mode */}
          {primaryEq && (
            <div className="px-3 py-4 border-b border-border-subtle">
              <div
                className="flex justify-center overflow-x-auto"
                style={{ fontSize: '13px', color: '#dff2ed', lineHeight: 1.5 }}
              >
                <KatexMath tex={primaryEq} block />
              </div>
            </div>
          )}

          {/* Legacy plain-text formula — shown only when no KaTeX primary */}
          {!primaryEq && formula && (
            <div className="px-4 py-3 border-b border-border-subtle">
              <p
                className="font-mono-data text-[11px] leading-relaxed text-cyan-glow text-center"
                style={{ textShadow: '0 0 8px rgba(0,229,196,0.45)' }}
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
                    <p className="font-mono-data text-[9px] tracking-[0.18em] uppercase mb-1 leading-tight" style={{ color: '#4a9090' }}>
                      {d.label}
                    </p>
                  )}
                  <div
                    className="overflow-x-auto"
                    style={{ fontSize: '11px', color: '#dff2ed', lineHeight: 1.7 }}
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
            <div className="px-4 py-4 flex-1">
              <p className="font-body text-[13px] leading-relaxed text-text-primary">{explanation}</p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border-subtle shrink-0">
        <p className="font-mono-data text-[10px] text-text-dim leading-relaxed">{footer}</p>
      </div>
    </aside>
  )
}
