// Seeds the local Supabase teacher before the e2e run. If local Supabase is not
// available the classroom specs skip themselves; the other specs still run.
//
// The assignment spec also needs the pilot items. A `supabase db reset` wipes them,
// so when the catalogue is empty and ../umbra-content is next to this repo, its sync
// script is run against the LOCAL stack (it refuses non-local URLs itself). Answers
// stay in umbra-content and the local database; nothing is written into this repo.
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { seed, ensureLocalEnv } from '../../scripts/seed-local.mjs'

const CONTENT_SYNC = resolve('../umbra-content/scripts/sync.mjs')

async function ensureItems() {
  const env = ensureLocalEnv()
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const count = async () => {
    const { count: n, error } = await admin.from('items').select('id', { count: 'exact', head: true })
    if (error) throw error
    return n ?? 0
  }
  if (await count() > 0) return
  if (!existsSync(CONTENT_SYNC)) {
    console.warn('[e2e] no items and no ../umbra-content: the assignment spec will skip')
    process.env.UMBRA_ITEMS_MISSING = '1'
    return
  }
  execFileSync(process.execPath, [CONTENT_SYNC], {
    cwd: resolve('../umbra-content'),
    env: { ...process.env, SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  if (await count() === 0) process.env.UMBRA_ITEMS_MISSING = '1'
}

export default async function globalSetup() {
  try {
    await seed()
  } catch (e) {
    console.warn(`[e2e] local Supabase seed skipped: ${e.message || e}`)
    process.env.UMBRA_SEED_SKIPPED = '1'
    return
  }
  try {
    await ensureItems()
  } catch (e) {
    console.warn(`[e2e] pilot items unavailable: ${e.message || e}`)
    process.env.UMBRA_ITEMS_MISSING = '1'
  }
}
