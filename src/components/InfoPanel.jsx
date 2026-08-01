import { useState } from 'react'

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
  formula = '',
  explanation = '',
  metrics = [],
  footer = 'SPECIAL RELATIVITY · SR MODULE',
  isOpen: defaultOpen = true,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <aside className="flex flex-col h-full bg-panel osc-grid border-r border-border-subtle">
      {/* Header */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-border-subtle group focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-glow"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-glow shadow-glow-amber animate-pulse-glow" />
          <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim group-hover:text-text-primary transition-colors duration-200">
            {title}
          </span>
        </div>
        <span
          className="font-mono-data text-[10px] text-text-dim group-hover:text-cyan-glow transition-colors duration-200"
          aria-hidden="true"
        >
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="flex-1 overflow-y-auto thin-scroll flex flex-col">
          {/* Live formula readout */}
          {formula && (
            <div className="px-4 py-3 border-b border-border-subtle">
              <p
                className="font-mono-data text-[11px] leading-relaxed text-cyan-glow text-center"
                style={{ textShadow: '0 0 8px rgba(0,229,196,0.45)' }}
              >
                {formula}
              </p>
            </div>
          )}

          {/* Live metrics */}
          {metrics.length > 0 && (
            <div className="px-4 py-3 border-b border-border-subtle">
              {metrics.map((m) => (
                <DataRow
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  unit={m.unit}
                  color={m.color}
                />
              ))}
            </div>
          )}

          {/* Explanation */}
          {explanation && (
            <div className="px-4 py-4 flex-1">
              <p className="font-body text-[13px] leading-relaxed text-text-primary">
                {explanation}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border-subtle mt-auto">
        <p className="font-mono-data text-[10px] text-text-dim leading-relaxed">
          {footer}
        </p>
      </div>
    </aside>
  )
}
