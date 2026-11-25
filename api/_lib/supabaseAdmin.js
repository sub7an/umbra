// Service-role Supabase client for serverless functions. Server only.
//
// Env vars (Vercel → Project → Settings → Environment Variables; locally .env.local):
//   SUPABASE_URL               — the project URL
//   SUPABASE_SERVICE_ROLE_KEY  — SECRET, bypasses RLS; never prefix with VITE_
import { createClient } from '@supabase/supabase-js'

let client

export function getAdmin() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}
