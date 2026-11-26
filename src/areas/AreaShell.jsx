import { navigate } from '../lib/routes'
import { useAuth } from '../context/AuthContext'

export default function AreaShell({ children }) {
  const { user, signOut } = useAuth()
  const linkStyle = { fontSize: 15, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px' }
  return (
    <div className="umbra-area" style={{ height: '100%', overflowY: 'auto', background: '#08090a', color: '#e8eaed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="cr-noprint" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.14em', fontSize: 12, color: 'rgba(124,140,255,0.9)' }}>⬡ UMBRA</span>
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate({ area: 'home', search: '' }) }}
          style={{ ...linkStyle, marginLeft: 'auto' }}
        >
          Back to simulations
        </a>
        {user && (
          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ area: 'home', search: '' }) }}
            style={{ ...linkStyle, background: 'none', border: 0, font: 'inherit', fontSize: 15 }}
          >
            Sign out
          </button>
        )}
      </header>
      <main style={{ padding: '40px 24px 64px' }}>{children}</main>
    </div>
  )
}
