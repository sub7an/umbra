// Client for POST /api/check: answer checking happens on the server, never here.
//
// Idempotency: the caller makes ONE attempt id per submission (crypto.randomUUID())
// and every retry of that submission reuses it, so a request whose response was lost
// is recorded once; the retry gets the stored verdict back.
// Network failures (fetch rejects) and gateway errors (502/503/504: the function may
// have recorded the attempt before the proxy lost the reply) are retried, up to
// MAX_RETRIES times, with the same id. Other HTTP errors are answers and are final.
import { supabase } from './supabase'

export const MAX_RETRIES = 3
const GATEWAY = new Set([502, 503, 504])

const MESSAGES = {
  network: "We couldn't reach Umbra, so your answer wasn't checked. Check your connection and try again.",
  not_authenticated: 'Your session has ended. Sign in again to keep going.',
  not_student: 'Only student accounts can submit answers.',
  not_assigned: "This question isn't open to you in this assignment.",
  not_found: "We couldn't find this question.",
  rate_limited: "That's a lot of answers in a minute. Take a breath, then try again.",
  attempt_id_conflict: 'Something went wrong. Please submit again.',
  invalid_body: 'That answer is too long or in a format we can’t read.',
}

export class CheckError extends Error {
  constructor(code, status) {
    super(MESSAGES[code] ?? 'Something went wrong checking your answer. Please try again.')
    this.code = code
    this.status = status
  }
}

// Student-facing text for the checker's reason codes (src/lib/check).
export const REASON_TEXT = {
  ok: 'Correct',
  value: 'Check your working and try again.',
  unit: 'Check your unit: the value may be right but the unit is wrong or missing.',
  sig_figs: 'Right value, wrong number of significant figures.',
  format: "We couldn't read that answer. Check the format.",
}
export const reasonText = (r) => REASON_TEXT[r] ?? REASON_TEXT.value

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export function makeCheckClient({
  getToken,
  fetchImpl = (...a) => globalThis.fetch(...a),
  backoff = (n) => wait(250 * 2 ** n),
} = {}) {
  return async function submitAnswer(body) {
    if (!body?.attempt_id) throw new Error('attempt_id required')
    const token = await getToken()
    if (!token) throw new CheckError('not_authenticated', 401)
    for (let n = 0; ; n++) {
      let res
      try {
        res = await fetchImpl('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } catch {
        if (n >= MAX_RETRIES) throw new CheckError('network')
        await backoff(n)
        continue
      }
      if (GATEWAY.has(res.status) && n < MAX_RETRIES) { await backoff(n); continue }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new CheckError(res.status === 401 ? 'not_authenticated' : (json.error ?? 'server_error'), res.status)
      return json
    }
  }
}

export const submitAnswer = makeCheckClient({
  getToken: async () => {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token ?? null
  },
})

// After a failed submission, may the attempt have been recorded? Then a resubmission
// of the same response must reuse its attempt id (network loss, or any 5xx: the
// server may have inserted the row before failing or before the reply was lost).
export const mayHaveBeenRecorded = (err) => err?.code === 'network' || (Number(err?.status) >= 500)

// The attempt id for a submission of `text`: the pending one if it is the same
// response, else a fresh one.
export function attemptIdFor(pending, text, makeId = () => crypto.randomUUID()) {
  return pending && pending.text === text ? pending.id : makeId()
}

// Hint under a numeric input. The key is private, so this reads the part's stem:
// stems that want a bare number say "Give a number only"; a few quantities have no
// unit by nature (a Lorentz factor, a redshift, an order). Otherwise ask for the unit.
const UNITLESS = /\b(lorentz factor|redshift|highest order|ratio|how many|number of)\b/i
export function numericHint(stem) {
  const s = String(stem ?? '')
  if (/give a number only/i.test(s)) return { unit: false, text: 'Number only: leave the unit off.' }
  if (UNITLESS.test(s)) return { unit: false, text: 'Number only: this quantity has no unit.' }
  return { unit: true, text: 'Include the unit, for example 4.2 m s^-1 or 350 nm.' }
}
