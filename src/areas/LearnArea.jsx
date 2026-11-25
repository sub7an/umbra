import { useEffect, useState } from 'react'
import AreaShell from './AreaShell'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../lib/routes'
import { listMyClasses, syllabusLabel } from '../lib/classroomApi'
import AssignmentList from './learn/AssignmentList'
import AssignmentPage from './learn/AssignmentPage'
import './classroom.css'

// /learn                    → the student's assignments and classes
// /learn/assignments/:id    → one assignment (item player)
export default function LearnArea({ route }) {
  const { configured, loading, user, role, roleLoading, roleError, reloadRole } = useAuth()
  const [section, id] = route?.rest || []

  let body
  if (configured && (loading || (user && roleLoading))) {
    body = <div className="cr cr-row cr-muted" role="status"><span className="cr-spinner" aria-hidden="true" /> Loading…</div>
  } else if (!user) {
    body = (
      <div className="cr cr-stack">
        <h1>Your learning</h1>
        <p className="cr-lede">
          <a href="/join" style={{ color: 'rgb(var(--c-brand-text))' }}
            onClick={(e) => { e.preventDefault(); navigate({ area: 'join', search: '' }) }}>Join a class</a> to see your work here.
        </p>
      </div>
    )
  } else if (roleError && role !== 'student') {
    // A failed role check must not look like an empty page: offer a retry
    body = <RoleRetry onRetry={reloadRole} />
  } else if (role !== 'student') {
    body = (
      <div className="cr cr-stack">
        <div>
          <h1>Your learning</h1>
          <p className="cr-lede">This area is for students in a class. Join one with the code your teacher gives you.</p>
        </div>
        <a className="cr-btn cr-btn--primary" href="/join"
          onClick={(e) => { e.preventDefault(); navigate({ area: 'join', search: '' }) }}>Join a class</a>
      </div>
    )
  } else if (section === 'assignments' && id) {
    body = <AssignmentPage assignmentId={id} />
  } else {
    body = <StudentHome />
  }

  return <AreaShell>{body}</AreaShell>
}

function RoleRetry({ onRetry }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="cr cr-stack">
      <div>
        <h1>Your learning</h1>
        <p className="cr-lede" role="alert">
          We couldn't check your account just now. Check your connection, then try again.
        </p>
      </div>
      <button type="button" className="cr-btn cr-btn--primary" disabled={busy}
        onClick={async () => { setBusy(true); await onRetry(); setBusy(false) }}>
        {busy ? 'Checking…' : 'Try again'}
      </button>
    </div>
  )
}

function StudentHome() {
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    listMyClasses().then((c) => live && setClasses(c)).catch(() => { if (live) { setClasses([]); setError(true) } })
    return () => { live = false }
  }, [])

  return (
    <div className="cr cr-stack">
      <h1>Your learning</h1>
      <section aria-labelledby="my-work">
        <h2 id="my-work">Assignments</h2>
        <AssignmentList />
      </section>
      <section aria-labelledby="my-classes">
        <h2 id="my-classes">Your classes</h2>
        {classes === null ? <p className="cr-muted" role="status">Loading…</p>
          : error ? <p className="cr-error" role="alert">We couldn't load your classes. Refresh to try again.</p>
          : classes.length === 0 ? <p className="cr-muted">You're not in any classes yet.</p> : (
            <ul className="cr-classes">
              {classes.map((c) => (
                <li key={c.id} className="cr-class" style={{ gridTemplateColumns: '1fr' }}>
                  <div>
                    <div className="cr-class__name">{c.name}</div>
                    <div className="cr-class__meta">{syllabusLabel(c.syllabus)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}
