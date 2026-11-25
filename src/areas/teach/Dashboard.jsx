import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { navigate } from '../../lib/routes'
import { getClass, listRoster } from '../../lib/classroomApi'
import {
  listAssignments, listAssignmentAttempts, listMastery, listClassItemStats, listTopics, getItems,
  assignmentParts, latestByPart, partKey,
} from '../../lib/assignmentsApi'
import { heatmapColour, MASTERY_LEVELS, MASTERY_ORDER } from './heatmapColour'
import { plainMath } from '../../lib/mathText'
import TeacherSignIn from './TeacherSignIn'
import { ArrowLeftIcon, RefreshIcon } from '../icons'

const MOST_MISSED = 5
const THRESHOLDS = { low: 'below 40%', developing: '40–69%', secure: '70–94%', mastered: '95% and up' }
const pct = (x) => `${Math.round(x * 100)}%`

// Teacher dashboard for one class: mastery heatmap (topics × students), completion
// of each assignment, and the most-missed questions with their most common wrong answer.
export default function Dashboard({ classId }) {
  const { configured, loading, roleLoading, user } = useAuth()
  const [data, setData] = useState(undefined) // undefined loading, null not found
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const titleRef = useRef(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const cls = await getClass(classId)
      if (!cls) { setData(null); return }
      const [roster, assignments, topics, stats] = await Promise.all([
        listRoster(classId), listAssignments(classId), listTopics(), listClassItemStats(classId),
      ])
      const itemIds = [...new Set([...assignments.flatMap((a) => a.item_ids), ...stats.map((s) => s.item_id)])]
      const [items, attempts, mastery] = await Promise.all([
        getItems(itemIds), listAssignmentAttempts(assignments.map((a) => a.id)), listMastery(roster.map((s) => s.id)),
      ])
      setData({ cls, roster, assignments, topics, stats, items, attempts, mastery })
      setError('')
    } catch (e) {
      setError(e.message)
      setData((d) => d ?? null)
    } finally {
      setBusy(false)
    }
  }, [classId])

  useEffect(() => { if (user) load() }, [user, load])
  const loadedId = data?.cls?.id
  useEffect(() => { if (loadedId) titleRef.current?.focus({ preventScroll: true }) }, [loadedId])

  if (configured && (loading || (user && roleLoading))) return <div className="cr cr-muted" role="status">Loading…</div>
  if (!user) return <div className="cr cr-stack"><h1>Teacher dashboard</h1><TeacherSignIn /></div>

  const back = (
    <a className="cr-back" href={`/teach/classes/${classId}`}
      onClick={(e) => { e.preventDefault(); navigate({ area: 'teach', rest: ['classes', classId], search: '' }) }}>
      <ArrowLeftIcon size={18} /> Back to class
    </a>
  )
  if (data === undefined) return <div className="cr cr-muted" role="status">{back}<p>Loading progress…</p></div>
  if (data === null) {
    return (
      <div className="cr cr-stack">
        {back}
        <div><h1>Class not found</h1><p className="cr-lede">{error || "This class doesn't exist, or it belongs to a school you're not staff at."}</p></div>
      </div>
    )
  }

  return (
    <div className="cr cr-stack db">
      <div>
        {back}
        <div className="cr-spread" style={{ marginTop: 12 }}>
          <div>
            <h1 ref={titleRef} tabIndex={-1}>{data.cls.name} progress</h1>
            <p className="cr-lede" style={{ margin: 0 }}>
              {data.roster.length} {data.roster.length === 1 ? 'student' : 'students'} · {data.assignments.length} {data.assignments.length === 1 ? 'assignment' : 'assignments'}
            </p>
          </div>
          <button type="button" className="cr-btn" onClick={load} disabled={busy}>
            <RefreshIcon size={18} /> {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error && <p className="cr-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      </div>
      <Heatmap data={data} />
      <div className="db-grid">
        <Completion data={data} />
        <MostMissed data={data} />
      </div>
    </div>
  )
}

// -------------------------------------------------------------- heatmap
function Heatmap({ data }) {
  const { roster, topics, items, assignments, mastery } = data
  const byStudent = useMemo(() => {
    const m = {}
    for (const r of mastery) (m[r.student_id] ??= {})[r.topic_id] = r.p_known
    return m
  }, [mastery])
  // Topics the class has been set, plus any topic a student already has a value for
  const cols = useMemo(() => {
    const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
    const set = new Set(assignments.flatMap((a) => a.item_ids.flatMap((id) => itemsById[id]?.topic_ids ?? [])))
    for (const r of mastery) set.add(r.topic_id)
    return topics.filter((t) => set.has(t.id))
  }, [topics, items, assignments, mastery])

  return (
    <section className="cr-panel" aria-labelledby="hm-title">
      <div className="cr-spread" style={{ marginBottom: 16 }}>
        <div>
          <h2 id="hm-title" style={{ margin: 0 }}>Mastery by topic</h2>
          <p className="cr-muted cr-small" style={{ margin: '4px 0 0' }}>
            Each cell is the chance a student has mastered the topic, estimated from every answer they've given.
          </p>
        </div>
        <Legend />
      </div>
      {roster.length === 0 ? <p className="cr-muted">No students yet.</p> : cols.length === 0 ? (
        <div className="cr-empty">Set an assignment and mastery appears here as students answer.</div>
      ) : (
        <div className="db-scroll" tabIndex={0} role="region" aria-labelledby="hm-title">
          <table className="db-heat">
            <caption className="cr-sr">Mastery by topic: students in rows, topics in columns. Cells give a percentage and a level.</caption>
            <thead>
              <tr>
                <th scope="col" className="db-heat__corner">Student</th>
                {cols.map((t) => <th scope="col" key={t.id}><span>{t.title}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  {cols.map((t) => {
                    const p = byStudent[s.id]?.[t.id]
                    const level = heatmapColour(p)
                    const L = MASTERY_LEVELS[level]
                    return (
                      <td key={t.id} data-topic={t.id} data-level={level} className={`db-cell db-cell--${level}`}
                        style={{ '--cell-bg': L.bg, '--cell-ink': L.ink }}>
                        {level === 'none' ? (
                          <><span aria-hidden="true">–</span><span className="cr-sr">{L.label}</span></>
                        ) : (
                          <><span className="db-cell__v">{pct(p)}</span><span className="db-cell__l">{L.label}</span></>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Legend() {
  return (
    <ul className="db-legend" aria-label="Mastery levels">
      {MASTERY_ORDER.map((k) => (
        <li key={k}>
          <span className={`db-swatch db-cell--${k}`} style={{ '--cell-bg': MASTERY_LEVELS[k].bg }} aria-hidden="true" />
          <span><strong>{MASTERY_LEVELS[k].label}</strong> <span className="cr-muted">{THRESHOLDS[k]}</span></span>
        </li>
      ))}
      <li>
        <span className="db-swatch db-cell--none" aria-hidden="true" />
        <span><strong>–</strong> <span className="cr-muted">not started</span></span>
      </li>
    </ul>
  )
}

// ----------------------------------------------------------- completion
function Completion({ data }) {
  const { roster, assignments, attempts, items } = data
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])
  const latest = useMemo(() => {
    const m = {}
    for (const a of assignments) {
      for (const s of roster) {
        m[`${a.id}:${s.id}`] = latestByPart(attempts.filter((t) => t.assignment_id === a.id && t.student_id === s.id))
      }
    }
    return m
  }, [assignments, roster, attempts])

  return (
    <section className="cr-panel" aria-labelledby="done-title">
      <h2 id="done-title">Completion</h2>
      {assignments.length === 0 || roster.length === 0 ? (
        <p className="cr-muted">{assignments.length === 0 ? 'No assignments yet.' : 'No students yet.'}</p>
      ) : (
        <div className="db-scroll" tabIndex={0} role="region" aria-labelledby="done-title">
          <table className="cr-table db-done">
            <caption className="cr-sr">Parts answered and parts correct per student and assignment</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                {assignments.map((a) => <th scope="col" key={a.id}>{a.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  {assignments.map((a) => {
                    const parts = assignmentParts(a, itemsById)
                    const l = latest[`${a.id}:${s.id}`]
                    const done = parts.filter((p) => l[partKey(p.itemId, p.partId)]).length
                    const right = parts.filter((p) => l[partKey(p.itemId, p.partId)]?.correct).length
                    return (
                      <td key={a.id} data-assignment={a.id}>
                        <span className="db-done__n">{done}/{parts.length}</span>
                        <span className="db-done__r"> answered · {right} right</span>
                        <span className="db-meter" aria-hidden="true">
                          <span className="db-meter__right" style={{ width: `${parts.length ? (right / parts.length) * 100 : 0}%` }} />
                          <span className="db-meter__wrong" style={{ width: `${parts.length ? ((done - right) / parts.length) * 100 : 0}%` }} />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------- most missed
function MostMissed({ data }) {
  const { stats, items, topics } = data
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
  const topicTitle = Object.fromEntries(topics.map((t) => [t.id, t.title]))
  const rows = stats.filter((s) => s.attempts > 0 && s.correct_rate < 1)
    .sort((a, b) => a.correct_rate - b.correct_rate || b.attempts - a.attempts)
    .slice(0, MOST_MISSED)

  return (
    <section className="cr-panel" aria-labelledby="missed-title">
      <h2 id="missed-title">Most missed</h2>
      {rows.length === 0 ? <p className="cr-muted">Nothing missed yet. Questions that students get wrong show up here.</p> : (
        <ol className="db-missed">
          {rows.map((s) => {
            const it = itemsById[s.item_id]
            const stem = plainMath(it?.public?.stem ?? s.item_id)
            const part = it?.public?.parts?.find((p) => p.id === s.top_wrong_part)
            return (
              <li key={s.item_id} data-item={s.item_id}>
                <div className="db-missed__rate"><strong>{pct(s.correct_rate)}</strong><span>right</span></div>
                <div style={{ minWidth: 0 }}>
                  <div className="cr-class__meta">{(it?.topic_ids ?? []).map((t) => topicTitle[t] ?? t).join(', ')} · {s.attempts} {s.attempts === 1 ? 'answer' : 'answers'}</div>
                  <p className="db-missed__stem">{stem.length > 140 ? `${stem.slice(0, 140)}…` : stem}</p>
                  {s.top_wrong_response != null && (
                    <p className="db-missed__wrong">
                      Most common wrong answer{part ? ` (part ${part.id})` : ''}:{' '}
                      <span className="cr-mono db-missed__resp">{displayResponse(s.top_wrong_response)}</span>
                      {s.top_wrong_count > 1 && <span className="cr-muted"> × {s.top_wrong_count}</span>}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function displayResponse(text) {
  try {
    const v = JSON.parse(text)
    if (Array.isArray(v)) return v.join(' → ')
  } catch { /* plain text */ }
  return text
}
