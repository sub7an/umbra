import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { navigate } from '../../lib/routes'
import {
  getClass, listRoster, issueCards, resetCard, updateClass, syllabusLabel, yearLabel,
  parseNames, namesProblem, MAX_CARD_NAMES,
} from '../../lib/classroomApi'
import TeacherSignIn from './TeacherSignIn'
import { AlertIcon, ArrowLeftIcon, KeyIcon, PrinterIcon, ProjectorIcon, RefreshIcon } from '../icons'

// One class: join code, roster, issuing login cards, and the printable card sheet.
//
// Passphrases live only in this component's state (`sheet`). They are never put in
// localStorage/sessionStorage or logged; leaving the page loses them, so the teacher
// is warned (beforeunload and the in-app back link) until the sheet is dismissed.
export default function ClassPage({ classId }) {
  const { configured, loading, roleLoading, user } = useAuth()
  const [cls, setCls] = useState(undefined) // undefined = loading, null = not found
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState([]) // [{ student_id, display_name, username, passphrase }]
  const [projecting, setProjecting] = useState(false)
  const titleRef = useRef(null)
  const loadedId = cls?.id
  // Move focus to the class name when a class opens (client-side navigation)
  useEffect(() => { if (loadedId) titleRef.current?.focus({ preventScroll: true }) }, [loadedId])

  const load = useCallback(async () => {
    try {
      const c = await getClass(classId)
      setCls(c ?? null)
      if (c) setRoster(await listRoster(classId))
    } catch (e) {
      setError(e.message)
      setCls(null)
    }
  }, [classId])

  useEffect(() => { if (user) load() }, [user, load])

  // Warn before the tab closes or reloads while unprinted passphrases are on screen
  useEffect(() => {
    if (!sheet.length) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sheet.length])

  const leave = (e) => {
    e.preventDefault()
    if (sheet.length && !window.confirm('Leave this page? The passphrases on these cards will not be shown again.')) return
    navigate({ area: 'teach', rest: [], search: '' })
  }

  if (configured && (loading || (user && roleLoading))) return <div className="cr cr-muted" role="status">Loading…</div>
  if (!user) return <div className="cr cr-stack"><h1>Teacher dashboard</h1><TeacherSignIn /></div>

  const back = (
    <a className="cr-back cr-noprint" href="/teach" onClick={leave}><ArrowLeftIcon size={18} /> All classes</a>
  )

  if (cls === undefined) return <div className="cr cr-muted" role="status">{back}<p>Loading class…</p></div>
  if (cls === null) {
    return (
      <div className="cr cr-stack">
        {back}
        <div>
          <h1>Class not found</h1>
          <p className="cr-lede">{error || "This class doesn't exist, or it belongs to a school you're not staff at."}</p>
        </div>
      </div>
    )
  }

  const archived = Boolean(cls.archived_at)
  const addToSheet = (cards) => setSheet((prev) => [...prev.filter((p) => !cards.some((c) => c.student_id === p.student_id)), ...cards])

  return (
    <div className="cr cr-stack">
      <div className="cr-noprint">
        {back}
        <div className="cr-classhead" style={{ marginTop: 12 }}>
          <div>
            <h1 ref={titleRef} tabIndex={-1}>{cls.name}</h1>
            <p className="cr-lede" style={{ margin: 0 }}>
              {syllabusLabel(cls.syllabus)}{cls.year_group ? ` · ${yearLabel(cls.year_group)}` : ''}
              {roster ? ` · ${roster.length} ${roster.length === 1 ? 'student' : 'students'}` : ''}
              {archived ? ' · Archived' : ''}
            </p>
          </div>
          {!archived && (
            <div className="cr-codebox">
              <span className="cr-label" id="code-label">Join code</span>
              <div className="cr-code cr-code--hero" data-testid="class-code">{cls.code}</div>
              <button type="button" className="cr-btn cr-btn--ghost" style={{ marginTop: 10 }} onClick={() => setProjecting(true)}>
                <ProjectorIcon /> Show on the board
              </button>
            </div>
          )}
        </div>
      </div>

      {sheet.length > 0 && (
        <CardSheet cls={cls} cards={sheet} onDone={() => setSheet([])} />
      )}

      <div className="cr-grid2 cr-noprint">
        {archived ? (
          <section className="cr-panel" aria-labelledby="archived-title">
            <h2 id="archived-title">This class is archived</h2>
            <p className="cr-muted">Students can't join with its code and you can't issue new cards.</p>
            <ArchiveButton cls={cls} onChange={load} />
          </section>
        ) : (
          <IssueCards classId={cls.id} onIssued={(cards) => { addToSheet(cards); load() }} />
        )}
        <Roster roster={roster} archived={archived} onReset={addToSheet} />
      </div>

      {!archived && (
        <section className="cr-noprint" aria-labelledby="manage-title">
          <h2 id="manage-title" className="cr-small cr-muted" style={{ fontSize: 16 }}>Manage class</h2>
          <ArchiveButton cls={cls} onChange={load} />
        </section>
      )}

      {projecting && <ProjectCode code={cls.code} name={cls.name} onClose={() => setProjecting(false)} />}
    </div>
  )
}

// --------------------------------------------------------- issue cards
function IssueCards({ classId, onIssued }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const names = parseNames(text)

  const submit = async (e) => {
    e.preventDefault()
    const problem = namesProblem(names)
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    try {
      const cards = await issueCards(classId, names)
      setText('')
      onIssued(cards)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = names.length ? `Make ${names.length} login card${names.length === 1 ? '' : 's'}` : 'Make login cards'

  return (
    <form className="cr-panel" onSubmit={submit} noValidate aria-labelledby="issue-title">
      <h2 id="issue-title">Login cards</h2>
      <p className="cr-muted cr-small">
        For students without a school Google account. Each card has a username and a three-word
        passphrase. Only first names are used in usernames.
      </p>
      <div className="cr-field">
        <label htmlFor="card-names">Student names, one per line</label>
        <textarea id="card-names" className="cr-textarea" value={text} onChange={(e) => setText(e.target.value)}
          spellCheck={false} aria-invalid={!!error} aria-describedby={`card-names-hint${error ? ' card-error' : ''}`} />
        <span id="card-names-hint" className="cr-hint">
          Paste a column from your register. Up to {MAX_CARD_NAMES} at a time, 40 characters each.
        </span>
      </div>
      <div role="alert">{error && <p id="card-error" className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}</div>
      <button type="submit" className="cr-btn cr-btn--primary" disabled={busy}>
        {busy ? <><span className="cr-spinner" aria-hidden="true" /> Making cards…</> : <><KeyIcon /> {label}</>}
      </button>
    </form>
  )
}

// ---------------------------------------------------------- card sheet
function CardSheet({ cls, cards, onDone }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const joinUrl = `${window.location.host}/join`

  const done = () => {
    if (window.confirm('Have you printed the cards? The passphrases will not be shown again.')) onDone()
  }

  return (
    <section className="cr-printable" aria-labelledby="sheet-title">
      <div className="cr-cardsheet-warn cr-noprint">
        <AlertIcon size={24} />
        <div style={{ flex: 1 }}>
          <h2 id="sheet-title" ref={headingRef} tabIndex={-1} style={{ marginBottom: 4 }}>
            Print these {cards.length} card{cards.length === 1 ? '' : 's'} now
          </h2>
          <p style={{ margin: 0 }}>
            Passphrases are shown only once. If you leave this page you'll need to reset a
            student's passphrase to print their card again.
          </p>
        </div>
        <div className="cr-row">
          <button type="button" className="cr-btn cr-btn--primary" onClick={() => window.print()}>
            <PrinterIcon /> Print cards
          </button>
          <button type="button" className="cr-btn" onClick={done}>Done</button>
        </div>
      </div>
      <div className="cr-cards">
        {cards.map((c) => (
          <article key={c.student_id} className="cr-card" aria-label={`Login card for ${c.display_name}`}>
            <div className="cr-card__top">
              <span className="cr-card__brand">UMBRA PHYSICS</span>
              <span>{cls.name}</span>
            </div>
            <div className="cr-card__name">{c.display_name}</div>
            <dl>
              <dt>Username</dt>
              <dd data-testid="card-username">{c.username}</dd>
              <dt>Passphrase</dt>
              <dd data-testid="card-passphrase">{c.passphrase}</dd>
            </dl>
            <div className="cr-card__foot">Sign in at <strong>{joinUrl}</strong>. Keep this card private.</div>
          </article>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------- roster
function Roster({ roster, archived, onReset }) {
  return (
    <section className="cr-panel" aria-labelledby="roster-title">
      <h2 id="roster-title">Students</h2>
      {roster === null ? <p className="cr-muted" role="status">Loading…</p> : roster.length === 0 ? (
        <p className="cr-muted">
          No one has joined yet. Students can type the join code at <strong>{window.location.host}/join</strong>,
          or you can make login cards.
        </p>
      ) : (
        <table className="cr-table">
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Signs in with</th><th scope="col"><span className="cr-sr">Actions</span></th></tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.username ? <span className="cr-mono">{s.username}</span> : <span className="cr-tag">Google</span>}</td>
                <td>{s.username && !archived && <ResetButton student={s} onReset={onReset} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ResetButton({ student, onReset }) {
  const [state, setState] = useState('idle') // idle | confirm | busy | error
  const [error, setError] = useState('')
  const go = async () => {
    setState('busy')
    try {
      const { username, passphrase } = await resetCard(student.id)
      onReset([{ student_id: student.id, display_name: student.name, username, passphrase }])
      setState('idle')
    } catch (e) {
      setError(e.message); setState('error')
    }
  }
  if (state === 'confirm') {
    return (
      <span className="cr-row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="cr-btn cr-btn--danger" onClick={go} autoFocus>
          Reset and sign out
        </button>
        <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setState('idle')}>Cancel</button>
      </span>
    )
  }
  return (
    <span>
      <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setState('confirm')} disabled={state === 'busy'}
        aria-label={`New passphrase for ${student.name}`}>
        <RefreshIcon size={18} /> {state === 'busy' ? 'Resetting…' : 'New passphrase'}
      </button>
      {state === 'error' && <span className="cr-error" role="alert" style={{ display: 'block' }}>{error}</span>}
    </span>
  )
}

// ------------------------------------------------------------- archive
function ArchiveButton({ cls, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const archived = Boolean(cls.archived_at)
  const toggle = async () => {
    if (!archived && !window.confirm(`Archive ${cls.name}? Its join code will stop working.`)) return
    setBusy(true); setError('')
    try {
      await updateClass(cls.id, { archived_at: archived ? null : new Date().toISOString() })
      await onChange()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <button type="button" className={`cr-btn ${archived ? '' : 'cr-btn--danger'}`} onClick={toggle} disabled={busy}>
        {archived ? 'Restore class' : 'Archive class'}
      </button>
      {error && <p className="cr-error" role="alert">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------- project the code
// Full-screen join code for the projector: a native modal <dialog>, so the rest of
// the page is inert and Tab cannot reach it. Esc closes; focus returns to the opener.
function ProjectCode({ code, name, onClose }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const dialog = dialogRef.current
    const prev = document.activeElement
    if (!dialog.open) dialog.showModal()
    // Esc fires `cancel`; let React own the open state instead of the browser
    const onCancel = (e) => { e.preventDefault(); onCloseRef.current() }
    // Keep Tab cycling inside the dialog rather than escaping to the browser UI
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('keydown', onKey)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('keydown', onKey)
      if (dialog.open) dialog.close()
      prev?.focus?.()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className="cr-project cr-noprint" aria-label={`Join code for ${name}`}>
      <div>
        <p style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 700, margin: '0 0 24px' }}>Join {name}</p>
        <div className="cr-project__code">{code}</div>
        <p className="cr-project__url">Go to <strong>{window.location.host}/join</strong> and type this code</p>
        <button type="button" className="cr-btn" style={{ marginTop: 32 }} onClick={() => onCloseRef.current()} autoFocus>
          Close (Esc)
        </button>
      </div>
    </dialog>
  )
}
