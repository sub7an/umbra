import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Full-screen sign-in overlay. Opens on the 'umbra-auth-open' event.
export default function AuthPanel() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('magic')   // 'magic' | 'password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null)   // null | 'sending' | 'sent' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener('umbra-auth-open', h)
    return () => window.removeEventListener('umbra-auth-open', h)
  }, [])

  // Close automatically once signed in
  useEffect(() => { if (user) setOpen(false) }, [user])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined

  const sendMagic = useCallback(async () => {
    if (!supabase || !email) return
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) { setStatus('error'); setMessage(error.message) }
    else { setStatus('sent'); setMessage(`Check ${email} for your sign-in link.`) }
  }, [email, redirectTo])

  const passwordAuth = useCallback(async (signUp) => {
    if (!supabase || !email || !password) return
    setStatus('sending')
    const fn = signUp
      ? supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
      : supabase.auth.signInWithPassword({ email, password })
    const { error } = await fn
    if (error) { setStatus('error'); setMessage(error.message) }
    else if (signUp) { setStatus('sent'); setMessage(`Check ${email} to confirm your account.`) }
    else setStatus(null)
  }, [email, password, redirectTo])

  const google = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  }, [redirectTo])

  if (!open) return null

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 5, marginBottom: 10,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(94,106,210,0.25)',
    color: '#f7f8f8', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, outline: 'none',
  }
  const btn = (primary) => ({
    width: '100%', padding: '11px', borderRadius: 5, cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em',
    color: primary ? '#08090a' : '#5e6ad2',
    background: primary ? '#5e6ad2' : 'rgba(94,106,210,0.08)',
    border: primary ? 'none' : '1px solid rgba(94,106,210,0.4)', fontWeight: 700,
  })

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10160,
        background: 'rgba(8,9,10,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 380, background: 'rgba(17,17,19,0.98)',
        border: '1px solid rgba(94,106,210,0.3)', borderRadius: 8, padding: '28px 26px',
        animation: 'umbra-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.28em', color: 'rgba(94,106,210,0.7)', marginBottom: 8 }}>
          ⬡ UMBRA ACCOUNT
        </div>
        <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 22, color: '#f7f8f8', marginBottom: 4 }}>
          Sign in to save your progress
        </div>
        <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, color: 'rgba(247,248,248,0.55)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Sync your XP, journeys, and Pro across devices.
        </p>

        {!isSupabaseConfigured ? (
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(252,165,165,0.9)', lineHeight: 1.6 }}>
            Accounts aren’t enabled yet. (Supabase env vars not configured.)
          </div>
        ) : status === 'sent' ? (
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: '#86efac', lineHeight: 1.6, padding: '10px 0' }}>
            ✓ {message}
          </div>
        ) : (
          <>
            <button onClick={google} style={{ ...btn(false), marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>
              CONTINUE WITH GOOGLE
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <input type="email" placeholder="you@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

            {mode === 'password' && (
              <input type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            )}

            {mode === 'magic' ? (
              <button onClick={sendMagic} disabled={status === 'sending'} style={btn(true)}>
                {status === 'sending' ? 'SENDING…' : 'EMAIL ME A SIGN-IN LINK'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => passwordAuth(false)} disabled={status === 'sending'} style={{ ...btn(true), flex: 1 }}>
                  {status === 'sending' ? '…' : 'SIGN IN'}
                </button>
                <button onClick={() => passwordAuth(true)} disabled={status === 'sending'} style={{ ...btn(false), flex: 1 }}>
                  SIGN UP
                </button>
              </div>
            )}

            {status === 'error' && (
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(252,165,165,0.9)', marginTop: 10 }}>{message}</p>
            )}

            <button
              onClick={() => { setMode(mode === 'magic' ? 'password' : 'magic'); setStatus(null) }}
              style={{ width: '100%', marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(94,106,210,0.6)' }}
            >
              {mode === 'magic' ? 'USE EMAIL + PASSWORD INSTEAD' : 'USE A MAGIC LINK INSTEAD'}
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>ESC to close</span>
        </div>
      </div>
    </div>
  )
}
