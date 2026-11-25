// A Google student's pending join survives the OAuth round trip in sessionStorage:
// the class code and the name they typed (their own name, in their own browser).
// Card passphrases are never stored anywhere. An entry older than PENDING_MAX_AGE_MS
// is stale (an abandoned sign-in) and is dropped, so it can't auto-join a later sign-in.
const PENDING_KEY = 'umbra.join.pending'
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const pending = {
  get: (now = Date.now()) => {
    try {
      const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null')
      if (!v) return null
      if (typeof v.at !== 'number' || now - v.at > PENDING_MAX_AGE_MS || now < v.at) {
        sessionStorage.removeItem(PENDING_KEY)
        return null
      }
      return { code: v.code, name: v.name }
    } catch { return null }
  },
  set: (v, now = Date.now()) => {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...v, at: now })) } catch { /* private mode */ }
  },
  clear: () => { try { sessionStorage.removeItem(PENDING_KEY) } catch { /* private mode */ } },
}
