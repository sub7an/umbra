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

const VALUE_COLOR = {
  cyan: 'text-cyan-mid',
  amber: 'text-amber-glow',
  rose: 'text-rose-glow',
  dim: 'text-text-dim',
}

function DataRow({ label, value, unit, color = 'cyan' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border-subtle last:border-0">
      <dt className="text-[13px] text-text-dim">{label}</dt>
      <dd className={`font-mono-data text-[14px] tabular-nums text-right ${VALUE_COLOR[color] ?? VALUE_COLOR.cyan}`}>
        {value}
        {unit && <span className="text-text-dim text-xs ml-0.5">{unit}</span>}
      </dd>
    </div>
  )
}

function Section({ label, children, className = '' }) {
  return (
    <section className={`px-5 py-4 border-b border-border-subtle ${className}`}>
      {label && <h3 className="ui-eyebrow mb-2.5">{label}</h3>}
      {children}
    </section>
  )
}

// Lesson panel: what you're looking at (topic + syllabus), the governing
// equation, live values, a plain-language explanation, guided prompts and a
// predict-first checkpoint. Module-specific extras render via `children`.
// The AI tutor and phase diagram dock at the bottom.
export default function InfoPanel({
  domain = '',
  primaryEq = '',
  derivedEqs = [],
  formula = '',
  explanation = '',
  metrics = [],
  syllabus = '',
  tryThis = [],
  checkpoint = null,
  children = null,
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { setRevealed(false) }, [checkpoint?.q])

  return (
    <aside className="flex flex-col flex-1 min-h-0 bg-panel" aria-label="Lesson">
      <div className="flex-1 overflow-y-auto thin-scroll flex flex-col min-h-0">

        {/* Topic + curriculum reference */}
        {(domain || syllabus) && (
          <div className="px-5 pt-5 pb-3">
            {domain && (
              <p className="text-[13px] font-medium leading-snug text-text-accent">{domain}</p>
            )}
            {syllabus && (
              <span
                className="inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium text-text-dim bg-ground border border-border-subtle"
                title="Curriculum reference"
              >
                {syllabus}
              </span>
            )}
          </div>
        )}

        {/* Governing equation */}
        {primaryEq && (
          <div className="mx-5 mb-4 px-3 py-4 rounded-lg bg-ground border border-border-subtle">
            <div className="flex justify-center overflow-x-auto text-[15px] leading-normal text-text-primary">
              <KatexMath tex={primaryEq} block />
            </div>
          </div>
        )}

        {!primaryEq && formula && (
          <div className="mx-5 mb-4 px-3 py-3 rounded-lg bg-ground border border-border-subtle">
            <p className="font-mono-data text-[14px] leading-relaxed text-cyan-mid text-center">{formula}</p>
          </div>
        )}

        {/* Derived / conserved quantities */}
        {derivedEqs.length > 0 && (
          <Section className="space-y-3 border-t">
            {derivedEqs.map((d, i) => (
              <div key={i}>
                {d.label && <p className="text-[12px] font-medium text-text-dim mb-1">{d.label}</p>}
                <div className="overflow-x-auto text-[14px] leading-relaxed text-text-primary">
                  <KatexMath tex={d.eq} block={false} />
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Live values */}
        {metrics.length > 0 && (
          <Section label="Live values">
            <dl>
              {metrics.map((m) => (
                <DataRow key={m.label} label={m.label} value={m.value} unit={m.unit} color={m.color} />
              ))}
            </dl>
          </Section>
        )}

        {/* Explanation */}
        {explanation && (
          <Section label="What's happening">
            <p className="text-[15px] leading-relaxed text-text-primary">{explanation}</p>
          </Section>
        )}

        {/* Guided exploration */}
        {tryThis.length > 0 && (
          <Section label="Try this">
            <ol className="space-y-2.5">
              {tryThis.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-text-primary">
                  <span className="flex items-center justify-center w-5 h-5 mt-px rounded-full shrink-0 text-[11px] font-semibold text-cyan-mid bg-cyan-glow/10">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Predict-first checkpoint */}
        {checkpoint && (
          <Section label="Predict first">
            <div className="rounded-lg p-3.5 bg-cyan-glow/[0.06] border border-cyan-glow/20">
              <p className="text-[15px] leading-snug text-text-primary">{checkpoint.q}</p>
              {revealed ? (
                <p className="mt-2.5 pt-2.5 border-t border-cyan-glow/20 text-[15px] leading-snug text-cyan-mid">
                  {checkpoint.a}
                </p>
              ) : (
                <button type="button" onClick={() => setRevealed(true)} className="ui-btn mt-3 h-8">
                  Reveal answer
                </button>
              )}
            </div>
          </Section>
        )}

        {children}
      </div>

      <div className="shrink-0 border-t border-border-subtle">
        <PhysicsTutor />
        <PhaseDiagram />
      </div>
    </aside>
  )
}
