// Thin client wrappers for the classroom: schools, classes, login cards, joining.
// Database writes go through the RPCs (create_school, create_class, join_class);
// login cards go through /api/class-cards with the caller's access token.
//
// Passphrases returned by issueCards/resetCard are handed straight back to the
// caller. Nothing here stores or logs them.
import { supabase } from './supabase'

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6
export const CARD_EMAIL_DOMAIN = 'students.umbra.invalid'
export const MAX_CARD_NAMES = 60
export const MAX_NAME_CHARS = 40

export const SYLLABUSES = [
  { id: 'aqa', label: 'AQA' },
  { id: 'ocr_a', label: 'OCR A' },
  { id: 'edexcel', label: 'Edexcel' },
  { id: 'ib', label: 'IB' },
  { id: 'cie', label: 'Cambridge International' },
]
export const syllabusLabel = (id) => SYLLABUSES.find((s) => s.id === id)?.label ?? id

export const YEAR_GROUPS = [
  { id: '12', label: 'Year 12' }, { id: '13', label: 'Year 13' },
  { id: 'IB1', label: 'IB year 1' }, { id: 'IB2', label: 'IB year 2' },
]
export const yearLabel = (id) => YEAR_GROUPS.find((y) => y.id === id)?.label ?? id

export const BAD_CODE_CHARS = "codes don't use O, I, L, 0 or 1"

// Plain-English messages for the errors the RPCs and the cards API return.
const MESSAGES = {
  invalid_code: "We couldn't find that class code",
  bad_code_chars: BAD_CODE_CHARS,
  code_too_short: 'Class codes have 6 characters',
  class_archived: 'That class has been archived. Ask your teacher for a new code.',
  card_school_only: 'Your login card only works for classes at the school that gave it to you.',
  school_limit: 'You can set up at most 3 schools. Ask a colleague who is already an admin to add you instead.',
  seat_limit: "Your school has used all its student places. Contact us to add more.",
  not_staff: "You're not a member of staff at this school.",
  not_authenticated: 'Please sign in first.',
  invalid_name: 'Please enter a name.',
  invalid_display_name: 'Please enter your name (up to 40 characters).',
  invalid_country: 'Please choose a country.',
  invalid_body: 'Please check the names: one per line, up to 60 names of at most 40 characters.',
  forbidden: "You don't have access to that class.",
  invalid_card: "That username and passphrase don't match. Check the card and try again.",
  network: "We couldn't reach Umbra. Check your connection and try again.",
  rate_limited: 'Too many sign-ins from this network — wait a minute and try again.',
  school_pending: "This class isn't open yet — ask your teacher.",
  school_awaiting_approval: "Your school is awaiting approval — we'll email you when it's ready. You can set up classes meanwhile, but students can't join and cards can't be issued yet.",
  not_configured: 'Accounts are not set up on this copy of Umbra.',
}

export function errorMessage(code) {
  return MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

export class ClassroomError extends Error {
  constructor(code, cause) {
    super(errorMessage(code))
    this.code = code
    if (cause) this.cause = cause
  }
}

// Maps a PostgREST / RPC error (Postgres `raise exception 'code'`) to a known code.
export function errorCode(err) {
  const raw = String(err?.message ?? err?.error ?? '').trim()
  if (MESSAGES[raw]) return raw
  if (err?.code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) return 'invalid_card'
  if (/failed to fetch|network/i.test(raw)) return 'network'
  // GoTrue answers 429 with code over_request_rate_limit when a network signs in too often.
  if (err?.status === 429 || /^over_.*rate_limit$/.test(String(err?.code ?? '')) || /rate limit/i.test(raw)) return 'rate_limited'
  return 'unknown'
}

// ------------------------------------------------------------ class codes
// Strips whitespace, hyphens and zero-width characters, then upper-cases.
const STRIP = /[\s\-​-‍⁠﻿]/g
export function normaliseCode(raw) {
  return String(raw ?? '').replace(STRIP, '').toUpperCase()
}

// null when the code looks valid; otherwise 'bad_code_chars' or 'code_too_short'.
// Characters outside the alphabet are reported as soon as they are typed.
export function codeProblem(raw) {
  const code = normaliseCode(raw)
  if ([...code].some((c) => !CODE_ALPHABET.includes(c))) return 'bad_code_chars'
  if (code.length !== CODE_LENGTH) return 'code_too_short'
  return null
}

// Card sign-in: usernames are lower-case; passphrases are words joined by '-',
// so spaces typed between words become hyphens.
export const normaliseUsername = (raw) => String(raw ?? '').trim().toLowerCase()
export const normalisePassphrase = (raw) =>
  String(raw ?? '').trim().toLowerCase().replace(/[\s\-_.]+/g, '-')

// Names pasted one per line (or from a spreadsheet column): trimmed, blanks dropped.
export function parseNames(text) {
  return String(text ?? '').split(/\r?\n/).map((n) => n.trim()).filter(Boolean)
}

export function namesProblem(names) {
  if (names.length === 0) return 'Type at least one name.'
  if (names.length > MAX_CARD_NAMES) return `At most ${MAX_CARD_NAMES} names at a time.`
  const long = names.find((n) => n.length > MAX_NAME_CHARS)
  if (long) return `"${long.slice(0, 20)}…" is longer than ${MAX_NAME_CHARS} characters.`
  return null
}

// --------------------------------------------------------------- the API
export function makeClassroomApi(client, fetchImpl = (...a) => globalThis.fetch(...a)) {
  const db = () => {
    if (!client) throw new ClassroomError('not_configured')
    return client
  }
  const unwrap = ({ data, error }) => {
    if (error) throw new ClassroomError(errorCode(error), error)
    return data
  }

  async function cardsRequest(method, body) {
    const { data } = await db().auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new ClassroomError('not_authenticated')
    let res
    try {
      res = await fetchImpl('/api/class-cards', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new ClassroomError('network', e)
    }
    const json = await res.json().catch(() => ({}))
    // Only staff call the cards API, so a pending school gets the staff wording.
    const code = json.error === 'school_pending' ? 'school_awaiting_approval' : json.error
    if (!res.ok) throw new ClassroomError(MESSAGES[code] ? code : 'unknown')
    return json
  }

  return {
    async listSchools() {
      const { data: auth } = await db().auth.getUser()
      if (!auth?.user) return []
      const rows = unwrap(await db().from('staff')
        .select('role, schools(id, name, country, seats, plan)').eq('user_id', auth.user.id))
      return rows.filter((r) => r.schools).map((r) => ({ ...r.schools, role: r.role }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    async createSchool(name, country) {
      return unwrap(await db().rpc('create_school', { p_name: name.trim(), p_country: country }))
    },

    async createClass({ schoolId, name, syllabus, year }) {
      const rows = unwrap(await db().rpc('create_class', {
        p_school: schoolId, p_name: name.trim(), p_syllabus: syllabus, p_year: year?.trim() || null,
      }))
      const row = Array.isArray(rows) ? rows[0] : rows
      return { id: row.id, code: row.code }
    },

    async listClasses(schoolId) {
      const rows = unwrap(await db().from('classes')
        .select('id, name, syllabus, year_group, code, archived_at, enrolments(count)')
        .eq('school_id', schoolId).order('name'))
      return rows.map(({ enrolments, ...c }) => ({ ...c, students: enrolments?.[0]?.count ?? 0 }))
    },

    // → class row plus school_pending (true while its school awaits approval), or null.
    async getClass(classId) {
      const row = unwrap(await db().from('classes')
        .select('id, school_id, name, syllabus, year_group, code, archived_at, schools(plan)')
        .eq('id', classId).maybeSingle())
      if (!row) return row
      const { schools, ...cls } = row
      return { ...cls, school_pending: schools?.plan === 'pending' }
    },

    async updateClass(classId, patch) {
      unwrap(await db().from('classes').update(patch).eq('id', classId))
    },

    async listRoster(classId) {
      const rows = unwrap(await db().from('enrolments')
        .select('student_id, joined_at, students(display_name, username, created_via)')
        .eq('class_id', classId))
      return rows.map((r) => ({
        id: r.student_id,
        joinedAt: r.joined_at,
        name: r.students?.display_name ?? '',
        username: r.students?.username ?? null,
        via: r.students?.created_via ?? null,
      })).sort((a, b) => a.name.localeCompare(b.name))
    },

    // → [{ student_id, display_name, username, passphrase }]
    async issueCards(classId, names) {
      const { cards } = await cardsRequest('POST', { class_id: classId, names })
      return cards
    },

    // → { username, passphrase }
    async resetCard(studentId) {
      return cardsRequest('PATCH', { student_id: studentId })
    },

    async joinClass(code, displayName) {
      return unwrap(await db().rpc('join_class', { p_code: normaliseCode(code), p_display_name: displayName.trim() }))
    },

    async listMyClasses() {
      return unwrap(await db().from('classes').select('id, name, syllabus').is('archived_at', null).order('name'))
    },

    async signInWithCard(username, passphrase) {
      const { data, error } = await db().auth.signInWithPassword({
        email: `${normaliseUsername(username)}@${CARD_EMAIL_DOMAIN}`,
        password: normalisePassphrase(passphrase),
      })
      if (error) {
        const code = errorCode(error)
        throw new ClassroomError(code === 'network' || code === 'rate_limited' ? code : 'invalid_card', error)
      }
      return data
    },
  }
}

const api = makeClassroomApi(supabase)
export const {
  listSchools, createSchool, createClass, listClasses, getClass, updateClass, listRoster,
  issueCards, resetCard, joinClass, listMyClasses, signInWithCard,
} = api
