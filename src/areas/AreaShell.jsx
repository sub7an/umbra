import { navigate } from '../lib/routes'

export default function AreaShell({ children }) {
  return (
    <div style={{ minHeight: '100%', background: '#08090a', color: '#e8eaed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.14em', fontSize: 12, color: 'rgba(124,140,255,0.9)' }}>⬡ UMBRA</span>
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate({ area: 'home', search: '' }) }}
          style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
        >
          Back to simulations
        </a>
      </header>
      <main style={{ padding: '32px 24px' }}>{children}</main>
    </div>
  )
}
