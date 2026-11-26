import AreaShell from './AreaShell'
import JoinForm from './join/JoinForm'
import './classroom.css'

export default function JoinArea({ route }) {
  return (
    <AreaShell>
      <div className="cr cr-stack">
        <div>
          <h1>Join a class</h1>
          <p className="cr-lede">Use the code your teacher gives you, or the login card they printed for you.</p>
        </div>
        <JoinForm initialCode={route?.code} />
      </div>
    </AreaShell>
  )
}
