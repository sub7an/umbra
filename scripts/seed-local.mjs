#!/usr/bin/env node
// Seeds the LOCAL Supabase stack with a teacher for development and e2e tests.
//
//   node scripts/seed-local.mjs
//
// - Refuses to run unless SUPABASE_URL (and VITE_SUPABASE_URL, when set) point at
//   localhost / 127.0.0.1. It never talks to the hosted project.
// - Reads .env.local. Missing local keys (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are filled from `supabase status`.
//   SEED_TEACHER_PASSWORD is generated if absent. Both are written back to .env.local,
//   which is git-ignored. The password is never printed.
// - Creates (or re-uses) teacher@example.test with that password, a school
//   "Example Sixth Form" with the teacher as admin, and one class "13Q" (OCR A).
// - Resets the seed school to that state on every run: other classes and the card
//   students it issued are removed, so repeated e2e runs never hit the seat cap.
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'

export const SEED_TEACHER_EMAIL = 'teacher@example.test'
const SEED_SCHOOL = 'Example Sixth Form'
const SEED_CLASS = { name: '13Q', syllabus: 'ocr_a', year_group: '13' }
const ENV_FILE = '.env.local'

const isLocal = (url) => {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

function readEnvFile() {
  return existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}
}

function supabaseStatus() {
  const candidates = [process.env.SUPABASE_CLI, join(homedir(), '.local/supabase-cli/supabase'), 'supabase']
  for (const bin of candidates.filter(Boolean)) {
    try {
      const out = execFileSync(bin, ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      return JSON.parse(out.slice(out.indexOf('{')))
    } catch { /* try the next one */ }
  }
  return null
}

// Fills missing local keys and the seed password into .env.local; returns the env.
export function ensureLocalEnv() {
  const env = readEnvFile()
  const add = {}
  const needKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  if (needKeys.some((k) => !env[k])) {
    const status = supabaseStatus()
    if (!status?.API_URL) throw new Error('Local Supabase is not running: run `supabase start` first.')
    const fill = {
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      VITE_SUPABASE_URL: status.API_URL,
      VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
    }
    for (const k of needKeys) if (!env[k]) add[k] = fill[k]
  }
  if (!env.SEED_TEACHER_PASSWORD) add.SEED_TEACHER_PASSWORD = randomBytes(18).toString('base64url')

  const merged = { ...env, ...add }
  if (!isLocal(merged.SUPABASE_URL) || (merged.VITE_SUPABASE_URL && !isLocal(merged.VITE_SUPABASE_URL))) {
    throw new Error('seed-local refuses to run: SUPABASE_URL / VITE_SUPABASE_URL in .env.local are not local.')
  }
  if (Object.keys(add).length) {
    const lines = Object.entries(add).map(([k, v]) => `${k}=${v}`).join('\n')
    const prev = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : ''
    const sep = prev && !prev.endsWith('\n') ? '\n' : ''
    appendFileSync(ENV_FILE, `${sep}# Local Supabase (scripts/seed-local.mjs)\n${lines}\n`)
  }
  return merged
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

const must = ({ data, error }) => { if (error) throw error; return data }

export async function seed() {
  const env = ensureLocalEnv()
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Teacher
  let user = await findUserByEmail(admin, SEED_TEACHER_EMAIL)
  if (user) {
    must(await admin.auth.admin.updateUserById(user.id, { password: env.SEED_TEACHER_PASSWORD }))
  } else {
    user = must(await admin.auth.admin.createUser({
      email: SEED_TEACHER_EMAIL, password: env.SEED_TEACHER_PASSWORD, email_confirm: true,
    })).user
  }

  // School (admin staff row)
  const staffRows = must(await admin.from('staff').select('school_id, schools(name)').eq('user_id', user.id))
  let schoolId = staffRows.find((r) => r.schools?.name === SEED_SCHOOL)?.school_id
  if (!schoolId) {
    // An approved school (R32): schools made through create_school start 'pending'.
    schoolId = must(await admin.from('schools').insert({ name: SEED_SCHOOL, country: 'GB', plan: 'pilot' }).select('id').single()).id
    must(await admin.from('staff').insert({ user_id: user.id, school_id: schoolId, role: 'admin' }))
  } else {
    must(await admin.from('schools').update({ plan: 'pilot' }).eq('id', schoolId))
  }

  // Reset: card students issued by the seed school, then its classes.
  const cards = must(await admin.from('students').select('user_id').eq('card_school_id', schoolId))
  for (const { user_id } of cards) must(await admin.auth.admin.deleteUser(user_id))
  must(await admin.from('classes').delete().eq('school_id', schoolId))

  // One class, inserted with the service role (create_class needs auth.uid()).
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[randomBytes(1)[0] % 31]).join('')
  must(await admin.from('classes').insert({ ...SEED_CLASS, school_id: schoolId, code, created_by: user.id }))

  return { email: SEED_TEACHER_EMAIL, schoolId }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  seed()
    .then(({ email }) => console.log(`Seeded local teacher ${email} (password in .env.local).`))
    .catch((e) => { console.error(e.message || e); process.exit(1) })
}
