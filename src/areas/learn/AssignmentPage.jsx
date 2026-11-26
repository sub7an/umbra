import { useCallback, useEffect, useRef, useState } from 'react'
import { navigate } from '../../lib/routes'
import { getAssignment, getItems, listMyAttempts, latestByPart, assignmentState, formatDue } from '../../lib/assignmentsApi'
import ItemPlayer from './ItemPlayer'
import { ArrowLeftIcon } from '../icons'

// One assignment for a student: question navigation and the item player.
export default function AssignmentPage({ assignmentId }) {
  const [a, setA] = useState(undefined) // undefined loading, null not found
  const [items, setItems] = useState([])
  const [attempts, setAttempts] = useState([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const titleRef = useRef(null)
  const qRef = useRef(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const row = await getAssignment(assignmentId)
        if (!row) { if (live) setA(null); return }
        const [its, mine] = await Promise.all([getItems(row.item_ids), listMyAttempts([row.id])])
        const byId = Object.fromEntries(its.map((i) => [i.id, i]))
        if (!live) return
        setItems(row.item_ids.map((id) => byId[id]).filter(Boolean))
        setAttempts(mine)
        setA(row)
      } catch (e) {
        if (live) { setError(e.message); setA(null) }
      }
    })()
    return () => { live = false }
  }, [assignmentId])

  useEffect(() => { if (a) titleRef.current?.focus({ preventScroll: true }) }, [a])

  const onAnswered = useCallback((row) => setAttempts((prev) => [...prev, row]), [])

  const back = (
    <a className="cr-back" href="/learn"
      onClick={(e) => { e.preventDefault(); navigate({ area: 'learn', rest: [], search: '' }) }}>
      <ArrowLeftIcon size={18} /> Your learning
    </a>
  )

  if (a === undefined) return <div className="cr cr-muted" role="status">{back}<p>Loading assignment…</p></div>
  if (a === null) {
    return (
      <div className="cr cr-stack">
        {back}
        <div>
          <h1>Assignment not found</h1>
          <p className="cr-lede">{error || "This assignment doesn't exist, or it isn't set for a class you're in."}</p>
        </div>
      </div>
    )
  }

  const latest = latestByPart(attempts)
  const state = assignmentState(a)
  const go = (i) => { setIndex(i); requestAnimationFrame(() => qRef.current?.focus({ preventScroll: false })) }
  const item = items[index]
  const status = (it) => {
    const ps = it.public?.parts ?? []
    const done = ps.filter((p) => latest[`${it.id}:${p.id}`]).length
    const right = ps.filter((p) => latest[`${it.id}:${p.id}`]?.correct).length
    return { done, right, total: ps.length }
  }
  const prior = item ? Object.fromEntries((item.public?.parts ?? []).map((p) => [p.id, latest[`${item.id}:${p.id}`]]).filter(([, v]) => v)) : {}

  return (
    <div className="cr cr-stack">
      <div>
        {back}
        <h1 ref={titleRef} tabIndex={-1} style={{ marginTop: 12 }}>{a.title}</h1>
        <p className="cr-lede" style={{ margin: 0 }}>
          {a.classes?.name}
          {a.due_at && ` · ${state === 'past_due' ? 'Was due' : 'Due'} ${formatDue(a.due_at)}`}
        </p>
      </div>

      {state === 'upcoming' ? (
        <div className="cr-empty">This assignment opens {formatDue(a.opens_at)}.</div>
      ) : items.length === 0 ? (
        <div className="cr-empty">This assignment has no questions.</div>
      ) : (
        <>
          <nav aria-label="Questions" className="ap-nav">
            <ol>
              {items.map((it, i) => {
                const s = status(it)
                const mark = s.total && s.right === s.total ? 'all correct' : s.done ? `${s.done} of ${s.total} answered` : 'not started'
                return (
                  <li key={it.id}>
                    <button type="button" className={`ap-q${i === index ? ' ap-q--on' : ''}${s.total && s.right === s.total ? ' ap-q--done' : ''}`}
                      aria-current={i === index ? 'step' : undefined} onClick={() => go(i)}
                      aria-label={`Question ${i + 1}, ${mark}`}>
                      <span className="ap-q__n">{i + 1}</span>
                      <span className="ap-q__s" aria-hidden="true">{s.total && s.right === s.total ? '✓' : `${s.done}/${s.total}`}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <section aria-labelledby="q-title">
            <h2 id="q-title" ref={qRef} tabIndex={-1}>Question {index + 1} of {items.length}</h2>
            <ItemPlayer key={item.id} item={item} assignmentId={a.id} prior={prior} onAnswered={onAnswered} />
          </section>

          <div className="cr-spread">
            <button type="button" className="cr-btn" disabled={index === 0} onClick={() => go(index - 1)}>Previous question</button>
            {index < items.length - 1 ? (
              <button type="button" className="cr-btn cr-btn--primary" onClick={() => go(index + 1)}>Next question</button>
            ) : (
              <button type="button" className="cr-btn cr-btn--primary"
                onClick={() => navigate({ area: 'learn', rest: [], search: '' })}>Finish</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
