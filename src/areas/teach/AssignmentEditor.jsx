import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listTopics, listItems, listAssignments, createAssignment, updateAssignment, deleteAssignment, countAttempts,
  assignmentState, formatDue,
} from '../../lib/assignmentsApi'
import { plainMath } from '../../lib/mathText'
import { PlusIcon } from '../icons'

const DIFFICULTY = ['', 'Foundation', 'Core', 'Stretch', 'Challenge', 'Olympiad']
const difficultyLabel = (d) => DIFFICULTY[d] ?? `Level ${d}`

// <input type="datetime-local"> value for a Date in local time
const localInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const defaultDue = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(9, 0, 0, 0)
  return localInput(d)
}

// The class's assignments, and the editor that sets a new one.
// An assignment students have answered can't be deleted (attempts keep their link to
// it: FK on delete restrict), so it only offers a due-date change.
export default function Assignments({ classId, archived, onChange }) {
  const [list, setList] = useState(null)
  const [counts, setCounts] = useState({})
  const [catalogue, setCatalogue] = useState(null) // { topics, items }
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const newRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const rows = await listAssignments(classId)
      setList(rows)
      const n = await Promise.all(rows.map((r) => countAttempts(r.id)))
      setCounts(Object.fromEntries(rows.map((r, i) => [r.id, n[i]])))
    } catch (e) { setError(e.message); setList([]) }
  }, [classId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    Promise.all([listTopics(), listItems()]).then(([topics, items]) => setCatalogue({ topics, items }))
      .catch((e) => setError(e.message))
  }, [])

  const itemsById = useMemo(() => Object.fromEntries((catalogue?.items ?? []).map((i) => [i.id, i])), [catalogue])

  return (
    <section className="cr-panel" aria-labelledby="assign-title">
      <div className="cr-spread" style={{ marginBottom: 16 }}>
        <h2 id="assign-title" style={{ margin: 0 }}>Assignments</h2>
        {!archived && !editing && (
          <button type="button" ref={newRef} className="cr-btn cr-btn--primary" onClick={() => setEditing(true)}>
            <PlusIcon /> New assignment
          </button>
        )}
      </div>
      {error && <p className="cr-error" role="alert">{error}</p>}

      {editing && (
        <Editor classId={classId} catalogue={catalogue}
          onCancel={() => { setEditing(false); requestAnimationFrame(() => newRef.current?.focus()) }}
          onCreated={async () => { setEditing(false); await load(); onChange?.() }} />
      )}

      {list === null ? <p className="cr-muted" role="status">Loading…</p> : list.length === 0 ? (
        !editing && <p className="cr-muted">No assignments yet. Pick questions by topic and set a due date.</p>
      ) : (
        <ul className="ae-list">
          {list.map((a) => (
            <AssignmentRow key={a.id} a={a} attempts={counts[a.id]} itemsById={itemsById} onChange={load} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AssignmentRow({ a, attempts, itemsById, onChange }) {
  const [mode, setMode] = useState('idle') // idle | due | saving | confirm | deleting
  const [due, setDue] = useState(a.due_at ? localInput(new Date(a.due_at)) : '')
  const [error, setError] = useState('')
  const state = assignmentState(a)
  const topics = [...new Set(a.item_ids.flatMap((id) => itemsById[id]?.topic_ids ?? []))]

  const saveDue = async (e) => {
    e.preventDefault()
    setMode('saving'); setError('')
    try {
      await updateAssignment(a.id, { due_at: due ? new Date(due).toISOString() : null })
      setMode('idle'); await onChange()
    } catch (err) { setError(err.message); setMode('due') }
  }
  const remove = async () => {
    setMode('deleting'); setError('')
    try { await deleteAssignment(a.id); await onChange() } catch (err) { setError(err.message); setMode('idle'); onChange() }
  }

  return (
    <li className="ae-row">
      <div className="ae-row__main">
        <div className="ae-row__title">{a.title}</div>
        <div className="cr-class__meta">
          {a.item_ids.length} {a.item_ids.length === 1 ? 'question' : 'questions'}
          {topics.length > 0 && ` · ${topics.length} ${topics.length === 1 ? 'topic' : 'topics'}`}
          {' · '}{a.due_at ? `${state === 'past_due' ? 'Was due' : 'Due'} ${formatDue(a.due_at)}` : 'No due date'}
          {attempts !== undefined && ` · ${attempts} ${attempts === 1 ? 'answer' : 'answers'}`}
        </div>
      </div>
      {mode === 'due' || mode === 'saving' ? (
        <form className="cr-row" onSubmit={saveDue}>
          <label className="cr-sr" htmlFor={`due-${a.id}`}>Due date for {a.title}</label>
          <input id={`due-${a.id}`} type="datetime-local" className="cr-input" style={{ width: 'auto' }}
            value={due} onChange={(e) => setDue(e.target.value)} />
          <button type="submit" className="cr-btn cr-btn--primary" disabled={mode === 'saving'}>Save</button>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setMode('idle')}>Cancel</button>
        </form>
      ) : mode === 'confirm' || mode === 'deleting' ? (
        <span className="cr-row">
          <button type="button" className="cr-btn cr-btn--danger" onClick={remove} disabled={mode === 'deleting'} autoFocus>Delete “{a.title}”</button>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setMode('idle')}>Cancel</button>
        </span>
      ) : (
        <span className="cr-row">
          <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setMode('due')}
            aria-label={`Change due date for ${a.title}`}>Change due date</button>
          {attempts === 0 && (
            <button type="button" className="cr-btn cr-btn--ghost ae-del" onClick={() => setMode('confirm')}
              aria-label={`Delete ${a.title}`}>Delete</button>
          )}
        </span>
      )}
      {attempts > 0 && mode === 'idle' && (
        <p className="cr-hint ae-row__note">Students have answered this, so it stays on record. Change the due date to close it.</p>
      )}
      {error && <p className="cr-error ae-row__note" role="alert">{error}</p>}
    </li>
  )
}

// --------------------------------------------------------------- editor
function Editor({ classId, catalogue, onCancel, onCreated }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(defaultDue)
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('')
  const [picked, setPicked] = useState([]) // item ids, in the order chosen
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  const topicTitle = useMemo(() => Object.fromEntries((catalogue?.topics ?? []).map((t) => [t.id, t.title])), [catalogue])
  const shown = (catalogue?.items ?? []).filter((i) =>
    (!topic || i.topic_ids.includes(topic)) && (!level || i.difficulty === Number(level)))

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!title.trim()) errs.title = 'Give the assignment a title.'
    if (!picked.length) errs.items = 'Pick at least one question.'
    if (due && Date.parse(due) < Date.now()) errs.due = 'The due date is in the past.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await createAssignment({ classId, title, itemIds: picked, dueAt: due ? new Date(due).toISOString() : null })
      await onCreated()
    } catch (err) {
      setErrors({ form: err.message }); setBusy(false)
    }
  }

  return (
    <form className="ae-editor" onSubmit={submit} noValidate aria-labelledby="ae-title">
      <h3 id="ae-title">New assignment</h3>
      <div className="cr-grid2" style={{ gap: 16 }}>
        <div className="cr-field">
          <label htmlFor="ae-name">Title</label>
          <input id="ae-name" ref={titleRef} className="cr-input" value={title} maxLength={80}
            onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'ae-name-err' : undefined} placeholder="Waves homework" />
          {errors.title && <span id="ae-name-err" className="cr-error">{errors.title}</span>}
        </div>
        <div className="cr-field">
          <label htmlFor="ae-due">Due</label>
          <input id="ae-due" type="datetime-local" className="cr-input" value={due}
            onChange={(e) => setDue(e.target.value)} aria-invalid={!!errors.due}
            aria-describedby={`ae-due-hint${errors.due ? ' ae-due-err' : ''}`} />
          <span id="ae-due-hint" className="cr-hint">Leave blank for no due date.</span>
          {errors.due && <span id="ae-due-err" className="cr-error">{errors.due}</span>}
        </div>
      </div>

      <fieldset className="ae-pick" aria-describedby={errors.items ? 'ae-items-err' : undefined}>
        <legend>Questions {picked.length > 0 && <span className="cr-tag" style={{ marginLeft: 8 }}>{picked.length} picked</span>}</legend>
        <div className="cr-row" style={{ marginBottom: 12 }}>
          <div className="cr-field" style={{ margin: 0 }}>
            <label htmlFor="ae-topic">Topic</label>
            <select id="ae-topic" className="cr-select" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All topics</option>
              {(catalogue?.topics ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="cr-field" style={{ margin: 0 }}>
            <label htmlFor="ae-level">Difficulty</label>
            <select id="ae-level" className="cr-select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Any difficulty</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} · {difficultyLabel(d)}</option>)}
            </select>
          </div>
        </div>
        {errors.items && <p id="ae-items-err" className="cr-error" role="alert">{errors.items}</p>}
        {!catalogue ? <p className="cr-muted" role="status">Loading questions…</p> : shown.length === 0 ? (
          <p className="cr-muted">No questions match. Try another topic or difficulty.</p>
        ) : (
          <ul className="ae-items">
            {shown.map((i) => {
              const n = picked.indexOf(i.id)
              const stem = plainMath(i.public?.stem)
              return (
                <li key={i.id}>
                  <label className={`ae-item${n >= 0 ? ' ae-item--on' : ''}`}>
                    <input type="checkbox" checked={n >= 0} onChange={() => toggle(i.id)}
                      aria-label={`${i.topic_ids.map((t) => topicTitle[t] ?? t).join(', ')}: ${stem.slice(0, 90)}`} />
                    <span className="ae-item__order" aria-hidden="true">{n >= 0 ? n + 1 : ''}</span>
                    <span className="ae-item__body">
                      <span className="ae-item__meta">
                        {i.topic_ids.map((t) => topicTitle[t] ?? t).join(', ')}
                        {' · '}<span aria-label={`difficulty ${i.difficulty} of 5`}>{'●'.repeat(i.difficulty)}<span className="ae-dim">{'●'.repeat(5 - i.difficulty)}</span></span>
                        {' · '}{i.public?.parts?.length ?? 0} parts
                        {i.public?.sim_preset && ' · has simulation'}
                      </span>
                      <span className="ae-item__stem">{stem}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      {errors.form && <p className="cr-error" role="alert">{errors.form}</p>}
      <div className="cr-row" style={{ marginTop: 16 }}>
        <button type="submit" className="cr-btn cr-btn--primary" disabled={busy}>
          {busy ? <><span className="cr-spinner" aria-hidden="true" /> Setting…</> : `Set assignment${picked.length ? ` (${picked.length} ${picked.length === 1 ? 'question' : 'questions'})` : ''}`}
        </button>
        <button type="button" className="cr-btn cr-btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
