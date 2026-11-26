import AreaShell from './AreaShell'
import TeachHome from './teach/TeachHome'
import ClassPage from './teach/ClassPage'
import Dashboard from './teach/Dashboard'
import './classroom.css'

// /teach                        → sign-in, school onboarding, or the class list
// /teach/classes/:id            → one class: roster, login cards, assignments
// /teach/classes/:id/progress   → the class dashboard: mastery, completion, most missed
export default function TeachArea({ route }) {
  const [section, id, sub] = route?.rest || []
  let body = <TeachHome />
  if (section === 'classes' && id) body = sub === 'progress' ? <Dashboard classId={id} /> : <ClassPage classId={id} />
  return <AreaShell>{body}</AreaShell>
}
