import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { navigate } from '../../lib/routes'
import {
  normaliseCode, codeProblem, errorMessage, joinClass, signInWithCard, CODE_LENGTH, MAX_NAME_CHARS,
} from '../../lib/classroomApi'
import { GoogleMark, KeyIcon } from '../icons'
import { pending } from './pendingJoin'

const toLearn = () => navigate({ area: 'learn', rest: [], search: '' }, { replace: true })

export default function JoinForm({ initialCode }) {
  const { user, reloadRole } = useAuth()
  return (
    <div className="cr-join">
      <CodeJoin initialCode={initialCode} user={user} reloadRole={reloadRole} />
      <CardSignIn user={user} />
    </div>
  )
}

// ----------------------------------------------------- join with a code
function CodeJoin({ initialCode, user, reloadRole }) {
  const [code, setCode] = useState(() => normaliseCode(initialCode).slice(0, CODE_LENGTH + 2))
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const autoJoined = useRef(false)

  const problem = codeProblem(code)
  // Wrong characters show straight away; "too short" only once they try to submit.
  const codeMsg = problem === 'bad_code_chars' || (touched && code && problem) ? errorMessage(problem)
    : touched && !code ? 'Enter the 6-character code from your teacher.' : ''

  const doJoin = async (c, n) => {
    setBusy(true); setError('')
    try {
      await joinClass(c, n)
      pending.clear()
      await reloadRole()
      toLearn()
    } catch (e) {
      pending.clear()
      setError(e.message)
      setBusy(false)
    }
  }

  // Back from Google with a pending join: finish it.
  useEffect(() => {
    const p = pending.get()
    if (!user || !p || autoJoined.current) return
    autoJoined.current = true
    setCode(p.code); setName(p.name)
    doJoin(p.code, p.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (problem || !name.trim()) return
    if (user) return doJoin(code, name)
    if (!isSupabaseConfigured) { setError(errorMessage('not_configured')); return }
    pending.set({ code, name: name.trim() })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/join?code=${code}` },
    })
  }

  const nameMsg = touched && !name.trim() ? 'Enter your name as your teacher knows you.' : ''

  return (
    <form className="cr-panel cr-panel--accent" onSubmit={submit} noValidate aria-labelledby="code-title">
      <h2 id="code-title">Join with a class code</h2>
      <p className="cr-muted cr-small">Your teacher will show you a 6-character code.</p>
      <div className="cr-field">
        <label htmlFor="join-code">Class code</label>
        <input id="join-code" className="cr-input cr-input--code" value={code}
          onChange={(e) => setCode(normaliseCode(e.target.value).slice(0, CODE_LENGTH + 2))}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
          aria-invalid={!!codeMsg} aria-describedby="join-code-msg" />
        <p id="join-code-msg" className="cr-error" role="alert" style={{ minHeight: 24 }}>{codeMsg}</p>
      </div>
      <div className="cr-field">
        <label htmlFor="join-name">Your name (first name is enough)</label>
        <input id="join-name" className="cr-input" value={name} maxLength={MAX_NAME_CHARS} autoComplete="name"
          onChange={(e) => setName(e.target.value)} aria-invalid={!!nameMsg}
          aria-describedby={`join-name-hint${nameMsg ? ' join-name-msg' : ''}`} />
        <span id="join-name-hint" className="cr-hint">As your teacher knows you, so they can find you in the class list.</span>
        {nameMsg && <p id="join-name-msg" className="cr-error">{nameMsg}</p>}
      </div>
      <div role="alert">{error && <p className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}</div>
      <button type="submit" className="cr-btn cr-btn--primary cr-btn--block" disabled={busy}>
        {busy ? 'Joining…' : user ? 'Join class' : <><GoogleMark /> Continue with Google to join</>}
      </button>
      {user && (
        <p className="cr-hint" style={{ marginTop: 10 }}>
          Signed in{user.email && !user.app_metadata?.umbra_card ? ` as ${user.email}` : ' with your login card'}.
        </p>
      )}
    </form>
  )
}

// ------------------------------------------------ sign in with a card
function CardSignIn({ user }) {
  const [username, setUsername] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !passphrase.trim()) { setError('Enter the username and passphrase from your card.'); return }
    setBusy(true); setError('')
    try {
      await signInWithCard(username, passphrase)
      setPassphrase('')
      toLearn()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="cr-panel" onSubmit={submit} noValidate aria-labelledby="card-title">
      <h2 id="card-title">Got a login card?</h2>
      <p className="cr-muted cr-small">Type the username and passphrase printed on it.</p>
      {user?.app_metadata?.umbra_card && (
        <p className="cr-success" style={{ marginBottom: 14 }}>You're already signed in with a card.</p>
      )}
      <div className="cr-field">
        <label htmlFor="card-username">Username</label>
        <input id="card-username" className="cr-input cr-input--mono" value={username} autoComplete="username"
          autoCapitalize="none" spellCheck={false} placeholder="e.g. amira-4821"
          onChange={(e) => setUsername(e.target.value)} aria-describedby={error ? 'card-signin-error' : undefined} />
      </div>
      <div className="cr-field">
        <label htmlFor="card-passphrase">Passphrase</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="card-passphrase" className="cr-input cr-input--mono" type={show ? 'text' : 'password'}
            value={passphrase} autoComplete="current-password" autoCapitalize="none" spellCheck={false}
            onChange={(e) => setPassphrase(e.target.value)} aria-describedby={`card-pass-hint${error ? ' card-signin-error' : ''}`} />
          <button type="button" className="cr-btn" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            Show<span className="cr-sr"> passphrase</span>
          </button>
        </div>
        <span id="card-pass-hint" className="cr-hint">Three words. Spaces or hyphens between them both work.</span>
      </div>
      <div role="alert">{error && <p id="card-signin-error" className="cr-error" style={{ marginBottom: 14 }}>{error}</p>}</div>
      <button type="submit" className="cr-btn cr-btn--primary cr-btn--block" disabled={busy}>
        <KeyIcon /> {busy ? 'Signing in…' : 'Sign in with card'}
      </button>
    </form>
  )
}
