import { useEffect, useState } from 'react'
import AreaShell from './AreaShell'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../lib/routes'
import { listMyClasses, syllabusLabel } from '../lib/classroomApi'
import './classroom.css'

export default function LearnArea() {
  const { user, role, roleLoading } = useAuth()
  const [classes, setClasses] = useState(null)

  useEffect(() => {
    if (!user || roleLoading || role !== 'student') return
    let live = true
    listMyClasses().then((c) => live && setClasses(c)).catch(() => live && setClasses([]))
    return () => { live = false }
  }, [user, role, roleLoading])

  return (
    <AreaShell>
      <div className="cr cr-stack">
        <h1>Your learning</h1>
        {role === 'student' && classes && (
          <section aria-labelledby="my-classes">
            <h2 id="my-classes">Your classes</h2>
            {classes.length === 0 ? <p className="cr-muted">You're not in any classes yet.</p> : (
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
        )}
        {!user && (
          <p className="cr-lede">
            <a href="/join" style={{ color: 'rgb(var(--c-brand-text))' }}
              onClick={(e) => { e.preventDefault(); navigate({ area: 'join', search: '' }) }}>Join a class</a> to see your work here.
          </p>
        )}
      </div>
    </AreaShell>
  )
}
