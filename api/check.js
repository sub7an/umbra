// Vercel serverless function: server-side answer checking.
//
// POST /api/check { attempt_id: uuid, item_id, part_id, response: string | string[],
//                   assignment_id?: uuid, hints_used?: int, time_ms?: int }
//   → 200 { correct, reason, feedback?: string, solution?: string[] }
//
// The answer key (item_keys.private) is read with the service role and never leaves
// this function: the body carries only the verdict, the matched wrong-answer feedback
// (when incorrect) and the worked solution, but only once this student has an attempt on
// EVERY part of the item (this one included). The solution covers all parts, so one
// guess on part (a) must not unlock the working for (b) and (c).
//
// After the solution has been unlocked (every part attempted BEFORE this attempt), a new
// attempt is stored with hints_used >= 1, so the mastery trigger treats it as assisted
// (guess 0.5) rather than as unaided evidence.
//
// Idempotent: the client picks attempt_id. The attempt is inserted with
// `on conflict (id) do nothing`; a replay of an existing id returns the stored verdict,
// but only to the student who made it, for the same item and part (else 409).
//
// Caller: a signed-in student (a students row; 403 not_student otherwise).
// assignment_id, if given, must be an open assignment of a class the student is
// enrolled in and must list item_id (403 not_assigned otherwise).
// Rate limit: 30 recorded attempts per student per minute, counted in the database so
// it holds across serverless instances (429 rate_limited). Replays are not counted.
//
// Logs only fixed labels and error codes: never a response, key or solution.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only, never VITE_).

import { getAdmin } from './_lib/supabaseAdmin.js'
import { HttpError, requireUser } from './_lib/auth.js'
import { checkResponse, matchWrongAnswer } from '../src/lib/check/index.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ITEM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const PART_RE = /^[A-Za-z0-9_-]{1,20}$/
const MAX_RESPONSE_CHARS = 500   // of the stored text (arrays as JSON)
const MAX_ORDER_ITEMS = 50
const MAX_HINTS = 100
const MAX_TIME_MS = 24 * 3600 * 1000
export const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 1000

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 20_000) throw new HttpError(413, 'body_too_large')
  }
  return raw ? JSON.parse(raw) : {}
}

const optInt = (v, max) => v === undefined || v === null || (Number.isInteger(v) && v >= 0 && v <= max)

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const { attempt_id, item_id, part_id, response, assignment_id, hints_used, time_ms } = body
  if (typeof attempt_id !== 'string' || !UUID_RE.test(attempt_id)) return null
  if (typeof item_id !== 'string' || !ITEM_RE.test(item_id)) return null
  if (typeof part_id !== 'string' || !PART_RE.test(part_id)) return null
  let text
  if (typeof response === 'string') {
    text = response
  } else if (Array.isArray(response) && response.length >= 1 && response.length <= MAX_ORDER_ITEMS
      && response.every((x) => typeof x === 'string')) {
    text = JSON.stringify(response)
  } else {
    return null
  }
  if (text.length > MAX_RESPONSE_CHARS) return null
  if (assignment_id !== undefined && assignment_id !== null
      && (typeof assignment_id !== 'string' || !UUID_RE.test(assignment_id))) return null
  if (!optInt(hints_used, MAX_HINTS) || !optInt(time_ms, MAX_TIME_MS)) return null
  return {
    attemptId: attempt_id.toLowerCase(),
    itemId: item_id,
    partId: part_id,
    response,
    text,
    assignmentId: assignment_id ? assignment_id.toLowerCase() : null,
    hintsUsed: hints_used ?? 0,
    timeMs: time_ms ?? null,
  }
}

function logFailure(label, err) {
  console.error(`check: ${label}`, err?.code || err?.status || 'error')
}

// The part's public definition and private key, or null if either is missing.
async function loadPart(admin, itemId, partId) {
  const [item, keys] = await Promise.all([
    admin.from('items').select('id, version, public').eq('id', itemId).maybeSingle(),
    admin.from('item_keys').select('version, private').eq('item_id', itemId).maybeSingle(),
  ])
  if (item.error) throw item.error
  if (keys.error) throw keys.error
  if (!item.data || !keys.data) return null
  const parts = Array.isArray(item.data.public?.parts) ? item.data.public.parts : []
  const part = parts.find((p) => p && p.id === partId)
  const priv = keys.data.private
  const key = priv?.key && typeof priv.key === 'object' ? priv.key[partId] : undefined
  if (!part || key === undefined || key === null) return null
  const partIds = parts.filter((p) => p && typeof p.id === 'string').map((p) => p.id)
  return { answerType: part.answer_type, key, priv, partIds }
}

// Parts of this item the student has at least one recorded attempt on.
async function attemptedParts(admin, studentId, itemId) {
  const { data, error } = await admin.from('attempts').select('part_id')
    .eq('student_id', studentId).eq('item_id', itemId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.part_id))
}

const allAttempted = (partIds, attempted) => partIds.length > 0 && partIds.every((p) => attempted.has(p))

async function mayUseAssignment(admin, studentId, assignmentId, itemId) {
  const { data: a, error } = await admin.from('assignments').select('id, class_id, item_ids, opens_at')
    .eq('id', assignmentId).maybeSingle()
  if (error) throw error
  if (!a || !Array.isArray(a.item_ids) || !a.item_ids.includes(itemId)) return false
  if (a.opens_at && Date.parse(a.opens_at) > Date.now()) return false
  const { data: enr, error: enrErr } = await admin.from('enrolments').select('class_id')
    .eq('class_id', a.class_id).eq('student_id', studentId).maybeSingle()
  if (enrErr) throw enrErr
  return !!enr
}

async function findAttempt(admin, attemptId) {
  const { data, error } = await admin.from('attempts')
    .select('id, student_id, item_id, part_id, response, correct, reason')
    .eq('id', attemptId).maybeSingle()
  if (error) throw error
  return data
}

const sameOwner = (row, userId, input) =>
  row.student_id === userId && row.item_id === input.itemId && row.part_id === input.partId

// Builds the reply from a verdict. `response` is what was graded (string or string[]).
// `unlocked`: every part of the item has an attempt, so the solution may be shown.
function verdictBody(verdict, response, partId, priv, unlocked) {
  const body = { correct: verdict.correct === true, reason: String(verdict.reason) }
  if (!body.correct) {
    const wrong = priv?.wrong_answers?.[partId]
    const id = matchWrongAnswer(response, wrong)
    const hit = id != null && Array.isArray(wrong) ? wrong.find((w) => w?.feedback_id === id) : null
    if (hit && typeof hit.feedback === 'string') body.feedback = hit.feedback
  }
  if (unlocked && Array.isArray(priv?.solution) && priv.solution.every((s) => typeof s === 'string')) {
    body.solution = priv.solution
  }
  return body
}

// Replays answer from the stored row. The graded response is the request's when it
// serialises to the stored text, else the stored text itself.
async function replay(admin, row, userId, input, res) {
  if (!sameOwner(row, userId, input)) return res.status(409).json({ error: 'attempt_id_conflict' })
  const part = await loadPart(admin, input.itemId, input.partId)
  const graded = row.response === input.text ? input.response : row.response
  const unlocked = part ? allAttempted(part.partIds, await attemptedParts(admin, userId, input.itemId)) : false
  return res.status(200).json(verdictBody(row, graded, input.partId, part?.priv, unlocked))
}

async function handlePost(admin, user, body, res) {
  const input = validate(body)
  if (!input) return res.status(400).json({ error: 'invalid_body' })

  const { data: student, error: stErr } = await admin.from('students').select('user_id')
    .eq('user_id', user.id).maybeSingle()
  if (stErr) throw stErr
  if (!student) return res.status(403).json({ error: 'not_student' })

  // An existing attempt_id: answer from the stored row, never re-grade or re-count it.
  const existing = await findAttempt(admin, input.attemptId)
  if (existing) return replay(admin, existing, user.id, input, res)

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const recent = await admin.from('attempts').select('id', { count: 'exact', head: true })
    .eq('student_id', user.id).gt('created_at', since)
  if (recent.error) throw recent.error
  if ((recent.count ?? 0) >= RATE_LIMIT) return res.status(429).json({ error: 'rate_limited' })

  const part = await loadPart(admin, input.itemId, input.partId)
  if (!part) return res.status(404).json({ error: 'not_found' })

  if (input.assignmentId && !(await mayUseAssignment(admin, user.id, input.assignmentId, input.itemId))) {
    return res.status(403).json({ error: 'not_assigned' })
  }

  // Was the worked solution already unlocked before this attempt?
  const before = await attemptedParts(admin, user.id, input.itemId)
  const assisted = allAttempted(part.partIds, before)
  const after = new Set(before).add(input.partId)

  const result = checkResponse(part.answerType, part.key, input.response)
  const verdict = { correct: result.correct === true, reason: result.reason || 'format' }

  const { data: inserted, error: insErr } = await admin.from('attempts').upsert({
    id: input.attemptId,
    student_id: user.id,
    item_id: input.itemId,
    part_id: input.partId,
    assignment_id: input.assignmentId,
    response: input.text,
    correct: verdict.correct,
    reason: verdict.reason,
    hints_used: assisted ? Math.max(input.hintsUsed, 1) : input.hintsUsed,
    time_ms: input.timeMs,
  }, { onConflict: 'id', ignoreDuplicates: true }).select('id')
  if (insErr) throw insErr

  if (!inserted || inserted.length === 0) {
    // Lost a race with a concurrent request carrying the same attempt_id.
    const row = await findAttempt(admin, input.attemptId)
    if (!row) throw new Error('attempt_vanished')
    return replay(admin, row, user.id, input, res)
  }
  return res.status(200).json(verdictBody(verdict, input.response, input.partId, part.priv, allAttempted(part.partIds, after)))
}

export function createHandler(getAdminClient = getAdmin) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method_not_allowed' })
    }
    res.setHeader('Cache-Control', 'no-store')
    try {
      const admin = getAdminClient()
      const { user } = await requireUser(req, admin)
      let body
      try { body = await readBody(req) } catch (e) {
        if (e instanceof HttpError) throw e
        return res.status(400).json({ error: 'invalid_json' })
      }
      return await handlePost(admin, user, body, res)
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.code })
      logFailure('request failed', e)
      return res.status(500).json({ error: 'server_error' })
    }
  }
}

export default createHandler()
