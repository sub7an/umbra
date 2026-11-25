import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { navigate } from '../../lib/routes'
import {
  SYLLABUSES, YEAR_GROUPS, syllabusLabel, yearLabel, createSchool, createClass, listClasses, listSchools, errorMessage,
} from '../../lib/classroomApi'
import TeacherSignIn from './TeacherSignIn'
import { PlusIcon } from '../icons'

const COUNTRIES = [
  ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['AE', 'United Arab Emirates'], ['HK', 'Hong Kong'],
  ['SG', 'Singapore'], ['IN', 'India'], ['NL', 'Netherlands'], ['DE', 'Germany'], ['ES', 'Spain'],
  ['CH', 'Switzerland'], ['US', 'United States'], ['ZZ', 'Another country'],
]

const SCHOOL_KEY = 'umbra.teach.school' // last school picked (id only)
const store = {
  get: () => { try { return localStorage.getItem(SCHOOL_KEY) } catch { return null } },
  set: (v) => { try { localStorage.setItem(SCHOOL_KEY, v) } catch { /* private mode */ } },
}

const classPath = (id) => ({ area: 'teach', rest: ['classes', id], search: '' })

function Loading({ label = 'Loading' }) {
  return (
    <div className="cr-row cr-muted" role="status">
      <span className="cr-spinner" aria-hidden="true" /> {label}…
    </div>
  )
}

export default function TeachHome() {
  const { configured, loading, roleLoading, user, role } = useAuth()

  if (configured && (loading || (user && roleLoading))) return <div className="cr"><Loading /></div>

  if (!user) {
    return (
      <div className="cr cr-stack">
        <div>
          <h1>Teacher dashboard</h1>
          <p className="cr-lede">
            Set up your classes, print login cards for students without school Google accounts,
            and see who has joined. No student emails are collected.
          </p>
        </div>
        <TeacherSignIn />
      </div>
    )
  }

  if (role === 'student') {
    return (
      <div className="cr cr-stack">
        <div>
          <h1>Teacher dashboard</h1>
          <p className="cr-lede">You're signed in with a student account. This area is for teachers.</p>
        </div>
        <a className="cr-btn cr-btn--primary" href="/learn"
          onClick={(e) => { e.preventDefault(); navigate({ area: 'learn', rest: [], search: '' }) }}>
          Go to your learning
        </a>
      </div>
    )
  }

  if (role !== 'teacher') return <SchoolSetup />
  return <ClassList />
}

// ----------------------------------------------------------- onboarding
function SchoolSetup() {
  const { reloadRole, user } = useAuth()
  const [name, setName] = useState('')
  const [country, setCountry] = useState('GB')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Enter your school or college name.'); return }
    setBusy(true); setError('')
    try {
      const id = await createSchool(name, country)
      store.set(id)
      await reloadRole()
    } catch (err) {
      setError(err.message || errorMessage(err.code))
      setBusy(false)
    }
  }

  return (
    <div className="cr cr-stack">
      <div>
        <h1>Set up your school</h1>
        <p className="cr-lede">
          One step before your first class. You'll be the school's admin on Umbra; colleagues can be
          added later. Signed in as {user?.email}.
        </p>
      </div>
      <form className="cr-panel cr-panel--accent" onSubmit={submit} noValidate style={{ maxWidth: 620 }}>
        <div className="cr-field">
          <label htmlFor="school-name">School or college name</label>
          <input id="school-name" className="cr-input" value={name} maxLength={120} autoComplete="organization"
            onChange={(e) => setName(e.target.value)} aria-invalid={!!error && !name.trim()}
            aria-describedby={error ? 'school-error' : undefined} />
        </div>
        <div className="cr-field">
          <label htmlFor="school-country">Country</label>
          <select id="school-country" className="cr-select" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="cr-hint">Pupil data for UK and EU schools is hosted in the UK/EU.</span>
        </div>
        <div role="alert">{error && <p id="school-error" className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}</div>
        <button type="submit" className="cr-btn cr-btn--primary" disabled={busy}>
          {busy ? 'Setting up…' : 'Create school'}
        </button>
      </form>
    </div>
  )
}

// ------------------------------------------------------------ class list
function ClassList() {
  const [schools, setSchools] = useState(null)
  const [schoolId, setSchoolId] = useState(null)
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let live = true
    listSchools().then((list) => {
      if (!live) return
      setSchools(list)
      const saved = store.get()
      setSchoolId(list.find((s) => s.id === saved)?.id ?? list[0]?.id ?? null)
    }).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [])

  const load = useCallback(async () => {
    if (!schoolId) return
    try { setClasses(await listClasses(schoolId)) } catch (e) { setError(e.message) }
  }, [schoolId])
  useEffect(() => { setClasses(null); load() }, [load])

  const school = schools?.find((s) => s.id === schoolId)
  const active = classes?.filter((c) => !c.archived_at) ?? []
  const archived = classes?.filter((c) => c.archived_at) ?? []

  return (
    <div className="cr cr-stack">
      <div className="cr-spread">
        <div>
          <h1>Your classes</h1>
          {school && <p className="cr-lede" style={{ margin: 0 }}>{school.name}</p>}
        </div>
        <div className="cr-row">
          {schools?.length > 1 && (
            <div className="cr-field" style={{ margin: 0 }}>
              <label htmlFor="school-pick" className="cr-sr">School</label>
              <select id="school-pick" className="cr-select" value={schoolId ?? ''}
                onChange={(e) => { setSchoolId(e.target.value); store.set(e.target.value) }}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {!creating && (
            <button type="button" className="cr-btn cr-btn--primary" onClick={() => setCreating(true)} disabled={!schoolId}>
              <PlusIcon /> New class
            </button>
          )}
        </div>
      </div>

      {error && <p className="cr-error" role="alert">{error}</p>}

      {creating && schoolId && (
        <NewClassForm schoolId={schoolId} onCancel={() => setCreating(false)} />
      )}

      {classes === null ? <Loading label="Loading classes" /> : active.length === 0 ? (
        <div className="cr-empty">
          <h2 style={{ color: 'rgb(var(--c-text))' }}>No classes yet</h2>
          <p style={{ margin: 0 }}>Create a class to get a join code students can type in, or print them login cards.</p>
        </div>
      ) : (
        <ul className="cr-classes" aria-label="Classes">
          {active.map((c) => <ClassRow key={c.id} c={c} />)}
        </ul>
      )}

      {archived.length > 0 && (
        <details>
          <summary className="cr-btn cr-btn--ghost" style={{ display: 'inline-flex' }}>
            Archived classes ({archived.length})
          </summary>
          <ul className="cr-classes" aria-label="Archived classes" style={{ marginTop: 12 }}>
            {archived.map((c) => <ClassRow key={c.id} c={c} />)}
          </ul>
        </details>
      )}
    </div>
  )
}

function ClassRow({ c }) {
  const href = `/teach/classes/${c.id}`
  return (
    <li className="cr-class">
      <div>
        <div className="cr-class__name">
          <a href={href} onClick={(e) => { e.preventDefault(); navigate(classPath(c.id)) }}>{c.name}</a>
        </div>
        <div className="cr-class__meta">
          {syllabusLabel(c.syllabus)}{c.year_group ? ` · ${yearLabel(c.year_group)}` : ''}{c.archived_at ? ' · Archived' : ''}
        </div>
      </div>
      <div className="cr-code"><span className="cr-sr">Join code </span>{c.code}</div>
      <div className="cr-count"><strong>{c.students}</strong>{c.students === 1 ? 'student' : 'students'}</div>
    </li>
  )
}

function NewClassForm({ schoolId, onCancel }) {
  const [name, setName] = useState('')
  const [syllabus, setSyllabus] = useState('aqa')
  const [year, setYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Give the class a name, for example 12P.'); nameRef.current?.focus(); return }
    setBusy(true); setError('')
    try {
      const { id } = await createClass({ schoolId, name, syllabus, year })
      navigate(classPath(id))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="cr-panel cr-panel--accent" onSubmit={submit} noValidate aria-labelledby="new-class-title">
      <h2 id="new-class-title">New class</h2>
      <div className="cr-grid3">
        <div className="cr-field">
          <label htmlFor="class-name">Class name</label>
          <input id="class-name" ref={nameRef} className="cr-input" value={name} maxLength={60}
            placeholder="e.g. 12P" onChange={(e) => setName(e.target.value)}
            aria-invalid={!!error && !name.trim()} aria-describedby={error ? 'class-error' : undefined} />
        </div>
        <div className="cr-field">
          <label htmlFor="class-syllabus">Syllabus</label>
          <select id="class-syllabus" className="cr-select" value={syllabus} onChange={(e) => setSyllabus(e.target.value)}>
            {SYLLABUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="cr-field">
          <label htmlFor="class-year">Year group</label>
          <select id="class-year" className="cr-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Not set</option>
            {YEAR_GROUPS.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
      </div>
      <div role="alert">{error && <p id="class-error" className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}</div>
      <div className="cr-row">
        <button type="submit" className="cr-btn cr-btn--primary" disabled={busy}>{busy ? 'Creating…' : 'Create class'}</button>
        <button type="button" className="cr-btn cr-btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
