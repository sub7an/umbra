// Vercel serverless function: student login cards.
//
// POST  /api/class-cards { class_id, names: string[] (1–60) }
//   → 201 { cards: [{ student_id, display_name, username, passphrase }] }
// PATCH /api/class-cards { student_id }
//   → 200 { username, passphrase }   (passphrase reset)
//
// Card students have no real email: each gets an auth user with
// `<username>@students.umbra.invalid`, email_confirm, and app_metadata.umbra_card = true
// (only the service role can set app_metadata; the database refuses that email domain
// without the flag). The passphrase is returned once and never stored or logged.
//
// Caller: a signed-in member of staff (Authorization: Bearer <access token>) of the
// class's school (POST), or of the school that issued the card (PATCH): a card
// student belongs to its issuing school (students.card_school_id), so staff of some
// other school whose class the student joined cannot reset the passphrase.
//
// Caps: card students per school ≤ schools.seats (409 seat_limit), checked here for
// the whole batch and again per card in the database (enrol_card_student).
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only, never VITE_).

import { getAdmin } from './_lib/supabaseAdmin.js'
import { HttpError, requireUser } from './_lib/auth.js'
import { WORDS } from './_lib/words.js'

export const CARD_DOMAIN = 'students.umbra.invalid'
const MAX_NAMES = 60
const MAX_NAME_CHARS = 40
const USERNAME_TRIES = 20      // per makeUsername call
const CREATE_TRIES = 5         // createUser "already registered" retries per card
const CONCURRENCY = 4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const defaultRand = (arr) => globalThis.crypto.getRandomValues(arr)

// Uniform integer in [0, n) from 32-bit random values, rejecting the tail past the
// last whole multiple of n so there is no modulo bias.
function randomBelow(n, rand) {
  const limit = Math.floor(2 ** 32 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    rand(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

export function slug(name) {
  const first = String(name ?? '').trim().split(/\s+/)[0] || ''
  const s = first.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '').slice(0, 12)
  return s || 'student'
}

export async function makeUsername(displayName, taken, rand = defaultRand) {
  const base = slug(displayName)
  for (let i = 0; i < USERNAME_TRIES; i++) {
    const u = `${base}-${String(randomBelow(10000, rand)).padStart(4, '0')}`
    if (!(await taken(u))) return u
  }
  throw new Error('username_exhausted')
}

export function makePassphrase(rand = defaultRand) {
  return Array.from({ length: 3 }, () => WORDS[randomBelow(WORDS.length, rand)]).join('-')
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 100_000) throw new HttpError(413, 'body_too_large')
  }
  return raw ? JSON.parse(raw) : {}
}

function validatePost(body) {
  if (!body || typeof body !== 'object') return null
  const { class_id, names } = body
  if (typeof class_id !== 'string' || !UUID_RE.test(class_id)) return null
  if (!Array.isArray(names) || names.length < 1 || names.length > MAX_NAMES) return null
  const trimmed = []
  for (const n of names) {
    if (typeof n !== 'string') return null
    const t = n.trim()
    if (t.length < 1 || t.length > MAX_NAME_CHARS) return null
    trimmed.push(t)
  }
  return { classId: class_id, names: trimmed }
}

const isAlreadyRegistered = (e) =>
  e && (e.code === 'email_exists' || e.code === 'user_already_exists'
    || /already (been )?registered|already exists/i.test(e.message || ''))

// Logs only a fixed label and an error code: never a passphrase or a request body.
function logFailure(label, err) {
  console.error(`class-cards: ${label}`, err?.code || err?.status || 'error')
}

async function isStaffOf(admin, userId, schoolId) {
  const { data, error } = await admin.from('staff').select('school_id')
    .eq('user_id', userId).eq('school_id', schoolId).maybeSingle()
  if (error) throw error
  return !!data
}

// Creates one card: auth user, then enrol_card_student (students row with username and
// card_school_id, and the enrolment, in one transaction). On any failure after
// createUser the new auth user is deleted (students/enrolments rows cascade with it).
async function createCard(admin, classId, name, reserved) {
  const taken = async (u) => {
    if (reserved.has(u)) return true
    const { data, error } = await admin.from('students').select('user_id').eq('username', u).maybeSingle()
    if (error) throw error
    return !!data
  }
  for (let attempt = 1; attempt <= CREATE_TRIES; attempt++) {
    const username = await makeUsername(name, taken)
    reserved.add(username)
    const passphrase = makePassphrase()
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@${CARD_DOMAIN}`,
      password: passphrase,
      email_confirm: true,
      app_metadata: { umbra_card: true },
    })
    if (error) {
      if (isAlreadyRegistered(error)) continue // never reuse an existing user
      throw error
    }
    const userId = data.user.id
    try {
      const enrol = await admin.rpc('enrol_card_student',
        { p_class: classId, p_user: userId, p_name: name, p_username: username })
      if (enrol.error) {
        // students.username unique: someone took it between the check and the insert.
        if (enrol.error.code === '23505') { await deleteQuietly(admin, userId); continue }
        throw enrol.error
      }
    } catch (e) {
      await deleteQuietly(admin, userId)
      throw e
    }
    return { student_id: userId, display_name: name, username, passphrase }
  }
  throw new Error('username_retries_exhausted')
}

async function deleteQuietly(admin, userId) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) logFailure('orphan delete failed', error)
}

async function handlePost(admin, user, body, res) {
  const input = validatePost(body)
  if (!input) return res.status(400).json({ error: 'invalid_body' })

  const { data: cls, error } = await admin.from('classes').select('id, school_id, archived_at')
    .eq('id', input.classId).maybeSingle()
  if (error) throw error
  // Unknown class and someone else's class look the same to the caller.
  if (!cls || !(await isStaffOf(admin, user.id, cls.school_id))) {
    return res.status(403).json({ error: 'forbidden' })
  }
  if (cls.archived_at) return res.status(409).json({ error: 'class_archived' })

  const [school, used] = await Promise.all([
    admin.from('schools').select('seats').eq('id', cls.school_id).maybeSingle(),
    admin.from('students').select('user_id', { count: 'exact', head: true }).eq('card_school_id', cls.school_id),
  ])
  if (school.error) throw school.error
  if (used.error) throw used.error
  if (!school.data || (used.count ?? 0) + input.names.length > school.data.seats) {
    return res.status(409).json({ error: 'seat_limit' })
  }

  // All or nothing: if any card fails, every card made by this request is removed.
  const reserved = new Set()
  const cards = new Array(input.names.length)
  let next = 0
  let failed = null
  const worker = async () => {
    while (!failed && next < input.names.length) {
      const i = next++
      try {
        cards[i] = await createCard(admin, cls.id, input.names[i], reserved)
      } catch (e) {
        failed = failed || e
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, input.names.length) }, worker))
  if (failed) {
    logFailure('card creation failed', failed)
    await Promise.all(cards.filter(Boolean).map((c) => deleteQuietly(admin, c.student_id)))
    if (failed.message === 'seat_limit') return res.status(409).json({ error: 'seat_limit' })
    return res.status(500).json({ error: 'card_creation_failed' })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(201).json({ cards })
}

async function handlePatch(admin, user, body, res) {
  const studentId = body?.student_id
  if (typeof studentId !== 'string' || !UUID_RE.test(studentId)) {
    return res.status(400).json({ error: 'invalid_body' })
  }

  // Only staff of the issuing school may reset. Unknown students and Google
  // students (no card_school_id) look the same as someone else's: 403.
  const { data: row, error: rowErr } = await admin.from('students').select('username, card_school_id')
    .eq('user_id', studentId).maybeSingle()
  if (rowErr) throw rowErr
  if (!row?.card_school_id || !(await isStaffOf(admin, user.id, row.card_school_id))) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(studentId)
  if (getErr || !target?.user) throw getErr || new Error('unknown_user')
  if (target.user.app_metadata?.umbra_card !== true) {
    return res.status(400).json({ error: 'not_a_card_student' })
  }

  const passphrase = makePassphrase()
  const { error: updErr } = await admin.auth.admin.updateUserById(studentId, { password: passphrase })
  if (updErr) throw updErr
  // Sign the student out everywhere: deleting auth.sessions cascades to refresh tokens.
  // Access tokens already issued stay valid until they expire (JWT lifetime).
  // If this fails the passphrase has already changed; the teacher sees an error, gets
  // no new passphrase, and can simply reset again.
  const { error: revokeErr } = await admin.rpc('revoke_user_sessions', { p_user: studentId })
  if (revokeErr) {
    logFailure('session revoke failed', revokeErr)
    return res.status(500).json({ error: 'session_revoke_failed' })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ username: row.username, passphrase })
}

export function createHandler(getAdminClient = getAdmin) {
  return async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      res.setHeader('Allow', 'POST, PATCH')
      return res.status(405).json({ error: 'method_not_allowed' })
    }
    try {
      const admin = getAdminClient()
      const { user } = await requireUser(req, admin)
      let body
      try { body = await readBody(req) } catch (e) {
        if (e instanceof HttpError) throw e
        return res.status(400).json({ error: 'invalid_json' })
      }
      return req.method === 'POST'
        ? await handlePost(admin, user, body, res)
        : await handlePatch(admin, user, body, res)
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.code })
      logFailure('request failed', e)
      return res.status(500).json({ error: 'server_error' })
    }
  }
}

export default createHandler()
