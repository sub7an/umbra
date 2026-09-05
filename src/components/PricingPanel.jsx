import { useEffect, useState, useCallback } from 'react'
import { track } from '@vercel/analytics'

const TIERS = [
  {
    id: 'free',
    name: 'EXPLORER',
    price: 'Free',
    sub: 'forever',
    accent: '#10b981',
    cta: 'You already have it',
    ctaDisabled: true,
    features: [
      'All 13 physics modules',
      'AI tutor & click-to-explain',
      'Guided story journeys',
      'Daily challenges & XP',
      'Multiplayer rooms',
      'Share links & 30s recordings',
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$6',
    sub: '/month · early-bird, locked for life',
    accent: '#5e6ad2',
    cta: 'Join the waitlist →',
    highlight: true,
    features: [
      'Everything in Explorer',
      '4K snapshot & video export, no watermark',
      'Unlimited recording length',
      'Priority AI tutor (faster, longer answers)',
      'Private multiplayer rooms',
      'Early access to new modules',
    ],
  },
  {
    id: 'school',
    name: 'CLASSROOM',
    price: 'Custom',
    sub: 'per school / district',
    accent: '#f59e0b',
    cta: 'Talk to us →',
    features: [
      'Everything in Pro, for every student',
      'LMS embeds (Canvas, Moodle, Schoology)',
      'Teacher dashboard & assignment mode',
      'Student progress tracking',
      'Onboarding & curriculum mapping',
      'Invoiced billing, FERPA-friendly',
    ],
  },
]

const CONTACT_EMAIL = 'hamzahatef09@gmail.com'

export default function PricingPanel() {
  const [open, setOpen] = useState(false)
  const [copiedTier, setCopiedTier] = useState(null)
  const [proLoading, setProLoading] = useState(false)

  useEffect(() => {
    const h = () => { setOpen(true); track('pricing_opened') }
    window.addEventListener('umbra-pricing-open', h)
    return () => window.removeEventListener('umbra-pricing-open', h)
  }, [])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  // Fall back to the email/clipboard flow (school tier, or Pro before Stripe
  // is fully configured). mailto silently no-ops without a mail client, so the
  // copied email is the reliable path and mailto is a best-effort bonus.
  const contactFallback = useCallback(async (tier) => {
    const subject = tier.id === 'pro' ? 'Umbra Pro' : 'Umbra Classroom license'
    try { await navigator.clipboard.writeText(CONTACT_EMAIL) } catch { /* clipboard denied */ }
    setCopiedTier(tier.id)
    setTimeout(() => setCopiedTier(null), 5000)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
  }, [])

  const onCta = useCallback(async (tier) => {
    if (tier.id === 'pro') {
      track('pro_checkout_click')
      setProLoading(true)
      try {
        const r = await fetch('/api/checkout', { method: 'POST' })
        const data = await r.json().catch(() => ({}))
        if (r.ok && data.url) {
          window.location.href = data.url   // → Stripe Checkout
          return
        }
        // Stripe not configured yet — fall back to contact so nothing breaks.
        await contactFallback(tier)
      } catch {
        await contactFallback(tier)
      } finally {
        setProLoading(false)
      }
    } else if (tier.id === 'school') {
      track('school_license_click')
      await contactFallback(tier)
    }
  }, [contactFallback])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10150,
        background: 'rgba(8,9,10,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '6vh 16px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1020, animation: 'umbra-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.28em', color: 'rgba(94,106,210,0.70)', marginBottom: 12 }}>
            SIMPLE PRICING · CANCEL ANYTIME
          </div>
          <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 'clamp(28px,4vw,44px)', color: '#f7f8f8' }}>
            Free for the curious.
          </div>
          <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 'clamp(28px,4vw,44px)', color: '#5e6ad2', textShadow: '0 0 32px rgba(94,106,210,0.3)' }}>
            Powerful for the serious.
          </div>
        </div>

        {/* Tiers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {TIERS.map((t) => (
            <div key={t.id} style={{
              position: 'relative',
              background: 'rgba(17,17,19,0.92)',
              border: `1px solid ${t.highlight ? 'rgba(94,106,210,0.55)' : t.accent + '26'}`,
              boxShadow: t.highlight ? '0 0 40px rgba(94,106,210,0.15)' : 'none',
              borderRadius: 6, padding: '26px 24px',
              display: 'flex', flexDirection: 'column',
            }}>
              {t.highlight && (
                <div style={{
                  position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.18em',
                  color: '#08090a', background: '#5e6ad2', borderRadius: 3, padding: '3px 10px',
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.22em', color: t.accent, marginBottom: 14 }}>
                {t.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 20 }}>
                <span style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 38, color: '#f7f8f8' }}>{t.price}</span>
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{t.sub}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                {t.features.map((f) => (
                  <div key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ color: t.accent, fontSize: 11, lineHeight: '19px', flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, lineHeight: 1.45, color: 'rgba(247,248,248,0.72)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onCta(t)}
                disabled={t.ctaDisabled}
                style={{
                  width: '100%', padding: '11px', borderRadius: 4,
                  cursor: t.ctaDisabled ? 'default' : 'pointer',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em',
                  color: t.ctaDisabled ? 'rgba(255,255,255,0.35)' : t.highlight ? '#08090a' : t.accent,
                  background: t.ctaDisabled ? 'rgba(255,255,255,0.04)' : t.highlight ? '#5e6ad2' : `${t.accent}0f`,
                  border: t.ctaDisabled ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${t.highlight ? '#5e6ad2' : t.accent + '40'}`,
                  transition: 'filter 0.15s',
                }}
                onMouseEnter={(e) => { if (!t.ctaDisabled) e.currentTarget.style.filter = 'brightness(1.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
              >
                {t.id === 'pro' && proLoading ? 'STARTING CHECKOUT…' : copiedTier === t.id ? '✓ EMAIL COPIED' : t.cta}
              </button>
              {copiedTier === t.id && (
                <div style={{
                  marginTop: 8, textAlign: 'center',
                  fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12,
                  color: 'rgba(247,248,248,0.70)', animation: 'umbra-slide-up 0.25s ease',
                }}>
                  Email <span style={{ color: t.accent, fontWeight: 600 }}>{CONTACT_EMAIL}</span> — it's on your clipboard
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
            Pro launches soon — waitlist members lock the early-bird price for life. · ESC to close
          </span>
        </div>
      </div>
    </div>
  )
}
