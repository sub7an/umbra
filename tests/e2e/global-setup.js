// Seeds the local Supabase teacher before the e2e run. If local Supabase is not
// available the classroom spec skips itself; the other specs still run.
import { seed } from '../../scripts/seed-local.mjs'

export default async function globalSetup() {
  try {
    await seed()
  } catch (e) {
    console.warn(`[e2e] local Supabase seed skipped: ${e.message || e}`)
    process.env.UMBRA_SEED_SKIPPED = '1'
  }
}
