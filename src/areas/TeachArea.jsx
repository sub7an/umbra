import AreaShell from './AreaShell'
import TeachHome from './teach/TeachHome'
import ClassPage from './teach/ClassPage'
import './classroom.css'

// /teach            → sign-in, school onboarding, or the class list
// /teach/classes/:id → one class: roster, login cards
export default function TeachArea({ route }) {
  const [section, id] = route?.rest || []
  return (
    <AreaShell>
      {section === 'classes' && id ? <ClassPage classId={id} /> : <TeachHome />}
    </AreaShell>
  )
}
