import { useEffect, useState } from 'react'
import { navigate } from '../../lib/routes'
import {
  listMyAssignments, listMyAttempts, getItems, assignmentParts, latestByPart, partKey, assignmentState, formatDue,
} from '../../lib/assignmentsApi'

const assignmentPath = (id) => ({ area: 'learn', rest: ['assignments', id], search: '' })

// The student's assignments across their classes, with progress per assignment.
export default function AssignmentList() {
  const [data, setData] = useState(null) // { assignments, itemsById, latest }
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const assignments = await listMyAssignments()
        const ids = [...new Set(assignments.flatMap((a) => a.item_ids))]
        const [items, attempts] = await Promise.all([getItems(ids), listMyAttempts(assignments.map((a) => a.id))])
        const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
        const latest = {}
        for (const a of assignments) latest[a.id] = latestByPart(attempts.filter((t) => t.assignment_id === a.id))
        if (live) setData({ assignments, itemsById, latest })
      } catch (e) {
        if (live) setError(e.message)
      }
    })()
    return () => { live = false }
  }, [])

  if (error) return <p className="cr-error" role="alert">{error}</p>
  if (!data) return <p className="cr-muted" role="status">Loading your work…</p>

  const visible = data.assignments.filter((a) => assignmentState(a) !== 'upcoming')
  if (visible.length === 0) {
    return <div className="cr-empty">No assignments yet. When your teacher sets work, it appears here.</div>
  }

  return (
    <ul className="cr-classes" aria-label="Assignments">
      {visible.map((a) => {
        const parts = assignmentParts(a, data.itemsById)
        const latest = data.latest[a.id]
        const done = parts.filter((p) => latest[partKey(p.itemId, p.partId)]).length
        const right = parts.filter((p) => latest[partKey(p.itemId, p.partId)]?.correct).length
        const state = assignmentState(a)
        const complete = parts.length > 0 && done === parts.length
        return (
          <li key={a.id} className="cr-class al-row">
            <div>
              <div className="cr-class__name">
                <a href={`/learn/assignments/${a.id}`}
                  onClick={(e) => { e.preventDefault(); navigate(assignmentPath(a.id)) }}>{a.title}</a>
              </div>
              <div className="cr-class__meta">
                {a.classes?.name}
                {' · '}{a.item_ids.length} {a.item_ids.length === 1 ? 'question' : 'questions'}
                {a.due_at && <> · <span className={state === 'past_due' ? 'al-late' : ''}>
                  {state === 'past_due' ? 'Was due' : 'Due'} {formatDue(a.due_at)}</span></>}
              </div>
            </div>
            <div className="al-progress" aria-label={`${done} of ${parts.length} parts answered, ${right} correct`}>
              <div className="al-bar" aria-hidden="true"><span style={{ width: `${parts.length ? (done / parts.length) * 100 : 0}%` }} /></div>
              <span className="cr-small">{complete ? 'All parts answered' : `${done} of ${parts.length} parts`}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
