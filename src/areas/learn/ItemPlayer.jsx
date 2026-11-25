import { useId, useRef, useState } from 'react'
import MathText from '../MathText'
import { submitAnswer, reasonText, numericHint, CheckError } from '../../lib/checkClient'
import { simLink } from '../../lib/assignmentsApi'

// One item: the shared stem, then each part with an input for its answer_type.
// Answers are graded by POST /api/check (server side). Each submission gets ONE
// client attempt id (crypto.randomUUID()); network retries reuse it, and so does a
// manual "Try again" of the same response after a network failure, so a lost
// response is never counted twice.
//
// `prior` is the student's latest stored attempt per part ({ [partId]: row }).
export default function ItemPlayer({ item, assignmentId, prior = {}, onAnswered }) {
  const pub = item.public ?? {}
  const parts = Array.isArray(pub.parts) ? pub.parts : []
  const [solution, setSolution] = useState(null)
  const sim = simLink(pub.sim_preset)

  return (
    <article className="ip" aria-labelledby={`stem-${item.id}`}>
      <div className="ip-stem" id={`stem-${item.id}`}>
        <MathText text={pub.stem} />
      </div>
      {sim && (
        <a className="cr-btn ip-sim" href={sim.href} target="_blank" rel="noopener">
          <SimIcon /> Open in simulation: {sim.name}
          <span className="cr-sr"> (opens in a new tab)</span>
        </a>
      )}
      <ol className="ip-parts">
        {parts.map((p) => (
          <li key={`${item.id}:${p.id}`}>
            <Part item={item} part={p} assignmentId={assignmentId} prior={prior[p.id]}
              onVerdict={(v, row) => { if (v.solution) setSolution(v.solution); onAnswered?.(row) }} />
          </li>
        ))}
      </ol>
      {solution && (
        <details className="ip-solution">
          <summary>Show the worked solution</summary>
          <ol>{solution.map((s, i) => <li key={i}><MathText text={s} /></li>)}</ol>
        </details>
      )}
    </article>
  )
}

const initialResponse = (part) =>
  part.answer_type === 'order' ? [...(part.choices ?? [])] : ''

function priorVerdict(row) {
  if (!row) return null
  return { correct: row.correct, reason: row.reason, stored: true, response: row.response }
}

function Part({ item, part, assignmentId, prior, onVerdict }) {
  const uid = useId()
  const [response, setResponse] = useState(() => initialResponse(part))
  const [verdict, setVerdict] = useState(() => priorVerdict(prior))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(null) // { id, text } of a submission whose result we never got
  const started = useRef(Date.now())
  const verdictRef = useRef(null)

  const label = `Your answer to part ${part.id}`
  const hintId = `${uid}-hint`
  const errId = `${uid}-err`
  const locked = verdict?.correct === true
  const showing = Boolean(verdict)
  const empty = Array.isArray(response) ? response.length === 0 : !response.trim()

  const submit = async (e) => {
    e.preventDefault()
    if (busy || locked) return
    if (empty) { setError(part.answer_type === 'choice' ? 'Choose an answer first.' : 'Type an answer first.'); return }
    const text = Array.isArray(response) ? JSON.stringify(response) : response.trim()
    // Same response after a network failure: same attempt id, so it is recorded once
    const id = pending.current?.text === text ? pending.current.id : crypto.randomUUID()
    pending.current = { id, text }
    setBusy(true); setError('')
    try {
      const v = await submitAnswer({
        attempt_id: id,
        item_id: item.id,
        part_id: part.id,
        response: Array.isArray(response) ? response : response.trim(),
        ...(assignmentId ? { assignment_id: assignmentId } : {}),
        time_ms: Math.min(Date.now() - started.current, 24 * 3600 * 1000),
      })
      pending.current = null
      setVerdict({ ...v, response: text })
      onVerdict(v, { id, item_id: item.id, part_id: part.id, correct: v.correct, reason: v.reason, response: text, created_at: new Date().toISOString() })
      requestAnimationFrame(() => verdictRef.current?.focus())
    } catch (err) {
      if (!(err instanceof CheckError && err.code === 'network')) pending.current = null
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const retry = () => {
    setVerdict(null)
    started.current = Date.now()
  }

  return (
    <form className={`ip-part${locked ? ' ip-part--done' : ''}`} onSubmit={submit} noValidate aria-labelledby={`${uid}-q`}>
      <div className="ip-part__head">
        <span className="ip-part__id" aria-hidden="true">{part.id}</span>
        <div id={`${uid}-q`} className="ip-part__stem">
          <span className="cr-sr">Part {part.id}: </span><MathText text={part.stem} />
        </div>
        <span className="ip-marks">{part.marks} {part.marks === 1 ? 'mark' : 'marks'}</span>
      </div>

      <fieldset className="ip-answer" disabled={busy || locked || showing}>
        <legend className="cr-sr">{label}</legend>
        <AnswerInput part={part} value={response} onChange={(v) => { setResponse(v); setError('') }}
          label={label} name={uid} hintId={hintId} errId={error ? errId : null} />
      </fieldset>

      <div role="alert">{error && <p id={errId} className="cr-error">{error}</p>}</div>

      {showing ? (
        <Verdict verdict={verdict} refEl={verdictRef} onRetry={locked ? null : retry} partId={part.id} />
      ) : (
        <button type="submit" className="cr-btn cr-btn--primary" disabled={busy}>
          {busy ? <><span className="cr-spinner" aria-hidden="true" /> Checking…</> : `Check part ${part.id}`}
        </button>
      )}
    </form>
  )
}

function Verdict({ verdict, refEl, onRetry, partId }) {
  const ok = verdict.correct === true
  return (
    <div className={`ip-verdict ip-verdict--${ok ? 'ok' : 'no'}`} role="status" tabIndex={-1} ref={refEl}>
      <span className="ip-verdict__icon" aria-hidden="true">{ok ? '✓' : '✕'}</span>
      <div style={{ flex: 1 }}>
        <p className="ip-verdict__title">{ok ? 'Correct' : reasonTitle(verdict.reason)}</p>
        {!ok && <p className="ip-verdict__body">{reasonText(verdict.reason)}</p>}
        {!ok && verdict.feedback && <p className="ip-verdict__body"><MathText text={verdict.feedback} /></p>}
        {verdict.stored && verdict.response && (
          <p className="cr-small cr-muted" style={{ margin: 0 }}>Your answer: <span className="cr-mono">{displayResponse(verdict.response)}</span></p>
        )}
      </div>
      {onRetry && (
        <button type="button" className="cr-btn" onClick={onRetry}>Try part {partId} again</button>
      )}
    </div>
  )
}

const reasonTitle = (r) => ({ unit: 'Check your unit', sig_figs: 'Check your significant figures', format: 'Check the format' }[r] ?? 'Not quite')

function displayResponse(text) {
  try {
    const v = JSON.parse(text)
    if (Array.isArray(v)) return v.join(' → ')
  } catch { /* plain text */ }
  return text
}

// ----------------------------------------------------------------- inputs
function AnswerInput({ part, value, onChange, label, name, hintId, errId }) {
  const describedBy = [hintId, errId].filter(Boolean).join(' ')
  switch (part.answer_type) {
    case 'choice':
      return (
        <div role="radiogroup" aria-label={label} aria-describedby={errId || undefined} className="ip-choices">
          {(part.choices ?? []).map((c, i) => (
            <label key={i} className="ip-choice">
              <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} />
              <span><MathText text={c} /></span>
            </label>
          ))}
        </div>
      )
    case 'order':
      return <OrderInput items={value} onChange={onChange} label={label} hintId={hintId} />
    case 'expression':
      return (
        <div className="cr-field" style={{ marginBottom: 8 }}>
          <input className="cr-input cr-input--mono" type="text" aria-label={label} value={value}
            onChange={(e) => onChange(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
            aria-describedby={describedBy} aria-invalid={!!errId} />
          <span id={hintId} className="cr-hint">
            Type an expression: <span className="cr-mono">*</span> to multiply, <span className="cr-mono">^</span> for powers,{' '}
            <span className="cr-mono">sqrt(…)</span>, <span className="cr-mono">cos(theta)</span>, and the variable names in the question.
          </span>
        </div>
      )
    default: {
      const hint = numericHint(part.stem)
      return (
        <div className="cr-field" style={{ marginBottom: 8 }}>
          <input className="cr-input ip-numeric" type="text" inputMode={hint.unit ? 'text' : 'decimal'} aria-label={label}
            value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false}
            placeholder={hint.unit ? 'e.g. 4.8 × 10^-7 m' : 'e.g. 23.4'}
            aria-describedby={describedBy} aria-invalid={!!errId} />
          <span id={hintId} className="cr-hint">{hint.text} Powers of ten: <span className="cr-mono">4.8e-7</span> or <span className="cr-mono">4.8 × 10^-7</span>.</span>
        </div>
      )
    }
  }
}

// Reorderable list with keyboard-accessible Move up / Move down buttons.
function OrderInput({ items, onChange, label, hintId }) {
  const [said, setSaid] = useState('')
  const refs = useRef({})
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setSaid(`${items[i]} moved to position ${j + 1} of ${items.length}`)
    // Keep focus on the same control of the moved row
    requestAnimationFrame(() => refs.current[`${items[i]}:${d}`]?.focus())
  }
  return (
    <div>
      <p id={hintId} className="cr-hint" style={{ marginTop: 0 }}>Use the arrows to put these in order, first at the top.</p>
      <ol className="ip-order" aria-label={label} aria-describedby={hintId}>
        {items.map((c, i) => (
          <li key={c} className="ip-order__row">
            <span className="ip-order__n" aria-hidden="true">{i + 1}</span>
            <span className="ip-order__text"><MathText text={c} /></span>
            <button type="button" className="cr-btn cr-btn--ghost ip-order__btn" disabled={i === 0}
              ref={(el) => { refs.current[`${c}:-1`] = el }}
              aria-label={`Move “${c}” up`} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="cr-btn cr-btn--ghost ip-order__btn" disabled={i === items.length - 1}
              ref={(el) => { refs.current[`${c}:1`] = el }}
              aria-label={`Move “${c}” down`} onClick={() => move(i, 1)}>↓</button>
          </li>
        ))}
      </ol>
      <span className="cr-sr" aria-live="polite">{said}</span>
    </div>
  )
}

function SimIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  )
}
