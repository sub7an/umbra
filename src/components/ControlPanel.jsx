function Slider({ label, min, max, step, value, onChange, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="group flex flex-col gap-2">
      {/* Label + live value */}
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xs tracking-widest uppercase text-text-dim group-hover:text-text-primary transition-colors duration-200">
          {label}
        </span>
        <span className="font-mono-data text-sm text-cyan-glow glow-cyan tabular-nums">
          {typeof value === 'number' ? value.toFixed(step < 0.01 ? 3 : 2) : value}
          {unit && <span className="text-text-dim text-xs ml-0.5">{unit}</span>}
        </span>
      </div>

      {/* Custom track + native input overlay */}
      <div className="relative flex items-center h-4">
        {/* Track background */}
        <div className="absolute inset-x-0 h-0.5 rounded-full bg-border-subtle" />
        {/* Filled portion */}
        <div
          className="absolute left-0 h-0.5 rounded-full bg-cyan-glow"
          style={{ width: `${pct}%`, boxShadow: '0 0 4px 1px rgba(245,158,11,0.5)' }}
        />
        {/* Native range (transparent overlay for interaction) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
          aria-label={label}
        />
        {/* Thumb */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-cyan-glow pointer-events-none z-20 transition-shadow duration-150 group-hover:shadow-glow-cyan-strong"
          style={{
            left: `calc(${pct}% - 7px)`,
            boxShadow: '0 0 8px 2px rgba(245,158,11,0.5)',
          }}
        />
      </div>

      {/* Min / max ticks */}
      <div className="flex justify-between">
        <span className="font-mono-data text-[10px] text-text-dim">{min}</span>
        <span className="font-mono-data text-[10px] text-text-dim">{max}</span>
      </div>
    </div>
  )
}

export default function ControlPanel({ title = 'Controls', controls = [], onReset }) {
  return (
    <aside className="flex flex-col h-full bg-panel osc-grid border-l border-border-subtle">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow shadow-glow-cyan animate-pulse-glow" />
          <span className="font-display text-xs tracking-[0.18em] uppercase text-text-dim">
            {title}
          </span>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="font-mono-data text-[10px] tracking-wider text-text-dim hover:text-cyan-glow transition-colors duration-200 uppercase px-2 py-1 border border-border-subtle hover:border-cyan-dim rounded"
            aria-label="Reset controls"
          >
            RST
          </button>
        )}
      </div>

      {/* Sliders */}
      <div className="flex-1 overflow-y-auto thin-scroll px-4 py-5 flex flex-col gap-7">
        {controls.length === 0 ? (
          <p className="font-mono-data text-xs text-text-dim text-center mt-4">
            No controls configured.
          </p>
        ) : (
          controls.map((ctrl) => (
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
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="font-mono-data text-[10px] text-text-dim leading-relaxed">
          NATURAL UNITS · c = 1
        </p>
      </div>
    </aside>
  )
}
