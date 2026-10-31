export function Slider({ label, min, max, step, value, onChange, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100
  const shown = typeof value === 'number' ? value.toFixed(step < 0.01 ? 3 : 2) : value

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-text-primary">{label}</span>
        <span className="font-mono-data text-[14px] tabular-nums text-cyan-mid">
          {shown}
          {unit && <span className="text-text-dim text-xs ml-0.5">{unit}</span>}
        </span>
      </div>

      {/* Visual track + native range on top (keeps keyboard + screen-reader support) */}
      <div className="relative flex items-center h-6">
        <div className="absolute inset-x-0 h-1 rounded-full bg-border-subtle" />
        <div className="absolute left-0 h-1 rounded-full bg-cyan-glow" style={{ width: `${pct}%` }} />
        <div
          className="absolute w-4 h-4 rounded-full bg-text-primary border-2 border-cyan-glow pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
          aria-valuetext={`${shown}${unit ? ' ' + unit : ''}`}
        />
      </div>

      <div className="flex justify-between font-mono-data text-[12px] text-text-dim">
        <span>{+Number(min).toFixed(2)}</span>
        <span>{+Number(max).toFixed(2)}</span>
      </div>
    </div>
  )
}

// Labelled group inside a panel
export function ControlGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-3">
      {label && <h3 className="ui-eyebrow">{label}</h3>}
      {children}
    </div>
  )
}

// On/off switch row (display layers, overlays…)
export function ToggleRow({ label, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full h-10 px-3 rounded-md border border-border-subtle bg-ground/40 text-[14px] text-text-primary hover:bg-panel-hover transition-colors duration-150"
    >
      {label}
      <span className={`relative w-8 h-[18px] rounded-full transition-colors duration-150 ${value ? 'bg-cyan-glow' : 'bg-border-subtle'}`}>
        <span className={`absolute top-[3px] w-3 h-3 rounded-full bg-text-primary transition-transform duration-150 ${value ? 'translate-x-[17px]' : 'translate-x-[3px]'}`} />
      </span>
    </button>
  )
}

// Pick-one list of options with an optional one-line description
export function OptionList({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex flex-col items-start w-full px-3 py-2 rounded-md border text-left transition-colors duration-150 ${
              active
                ? 'border-cyan-glow/60 bg-cyan-glow/10'
                : 'border-border-subtle bg-ground/40 hover:bg-panel-hover'
            }`}
          >
            <span className={`text-[14px] font-medium ${active ? 'text-text-primary' : 'text-text-primary/90'}`}>{o.label}</span>
            {o.desc && <span className="text-[12px] text-text-dim leading-snug mt-0.5">{o.desc}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default function ControlPanel({ title = 'Controls', controls = [], onReset, footer = 'Natural units · c = 1', children = null }) {
  return (
    <aside className="flex flex-col h-full bg-panel" aria-label={title}>
      <div className="flex items-center justify-between h-12 px-5 border-b border-border-subtle shrink-0">
        <h2 className="ui-eyebrow">{title}</h2>
        {onReset && (
          <button type="button" onClick={onReset} className="ui-btn-ghost h-8 px-2 text-[13px]" aria-label="Reset controls to defaults">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-5 py-5 flex flex-col gap-7">
        {controls.map((ctrl) => (
          <Slider
            key={ctrl.label}
            label={ctrl.label}
            min={ctrl.min}
            max={ctrl.max}
            step={ctrl.step}
            value={ctrl.value}
            onChange={ctrl.onChange}
            unit={ctrl.unit}
          />
        ))}
        {children}
        {controls.length === 0 && !children && (
          <p className="text-sm text-text-dim">This view has no adjustable parameters. Interact with the scene directly.</p>
        )}
      </div>

      {footer && (
        <div className="px-5 py-3 border-t border-border-subtle shrink-0">
          <p className="text-[12px] text-text-dim">{footer}</p>
        </div>
      )}
    </aside>
  )
}
