import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { GoogleMark } from '../icons'

// Teacher sign-in on /teach: Google, email + password, or an emailed link
// (which also creates the account for a new teacher).
export default function TeacherSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const redirectTo = `${window.location.origin}/teach`

  if (!isSupabaseConfigured) {
    return <p className="cr-error" role="alert">Accounts are not set up on this copy of Umbra.</p>
  }

  const signIn = async (e) => {
    e.preventDefault()
    setError(''); setSent('')
    if (!email.trim()) { setError('Enter your school email address.'); return }
    setBusy(true)
    if (password) {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError("That email and password don't match. Try again, or use an email link.")
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } })
      if (err) setError(err.message)
      else setSent(`We've emailed a sign-in link to ${email.trim()}.`)
    }
    setBusy(false)
  }

  const google = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })

  return (
    <section className="cr-panel" aria-labelledby="teacher-signin" style={{ maxWidth: 520 }}>
      <h2 id="teacher-signin">Sign in to teach</h2>
      <p className="cr-muted cr-small">New to Umbra? Use Google or an email link and we'll create your account.</p>
      <button type="button" className="cr-btn cr-btn--block" onClick={google}>
        <GoogleMark /> Continue with Google
      </button>
      <div className="cr-divider">or with email</div>
      <form onSubmit={signIn} noValidate>
        <div className="cr-field">
          <label htmlFor="t-email">Email</label>
          <input id="t-email" className="cr-input" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} aria-describedby={error ? 't-error' : undefined} />
        </div>
        <div className="cr-field">
          <label htmlFor="t-password">Password</label>
          <input id="t-password" className="cr-input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} aria-describedby="t-password-hint" />
          <span id="t-password-hint" className="cr-hint">Leave blank and we'll email you a sign-in link instead.</span>
        </div>
        <div role="alert" aria-live="assertive">
          {error && <p id="t-error" className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}
        </div>
        <div role="status" aria-live="polite">
          {sent && <p className="cr-success" style={{ marginBottom: 14 }}>{sent}</p>}
        </div>
        <button type="submit" className="cr-btn cr-btn--primary cr-btn--block" disabled={busy}>
          {password || !email ? 'Sign in' : 'Email me a sign-in link'}
        </button>
      </form>
    </section>
  )
}
