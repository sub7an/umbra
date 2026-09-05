import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'

// Shows a confirmation after Stripe Checkout redirects back with
// ?checkout=success | ?checkout=cancelled, then cleans the URL.
export default function CheckoutBanner() {
  const [state, setState] = useState(null) // 'success' | 'cancelled'

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = p.get('checkout')
    if (c !== 'success' && c !== 'cancelled') return
    setState(c)
    if (c === 'success') track('pro_checkout_success')
    // Strip the checkout params but keep any module hash
    p.delete('checkout'); p.delete('session_id')
    const qs = p.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash)
    const t = setTimeout(() => setState(null), 7000)
    return () => clearTimeout(t)
  }, [])

  if (!state) return null
  const ok = state === 'success'

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10200, padding: '12px 20px', borderRadius: 6,
      background: 'rgba(8,9,10,0.95)', backdropFilter: 'blur(12px)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.45)' : 'rgba(94,106,210,0.35)'}`,
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'umbra-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)', maxWidth: '92vw',
    }}>
      <span style={{ fontSize: 15 }}>{ok ? '✓' : '○'}</span>
      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(247,248,248,0.9)' }}>
        {ok
          ? 'Welcome to Umbra Pro — your subscription is active. Thank you!'
          : 'Checkout cancelled — no charge was made.'}
      </span>
    </div>
  )
}
