// Service-role Supabase client for serverless functions. Server only.
//
// Env vars (Vercel → Project → Settings → Environment Variables; locally .env.local):
//   SUPABASE_URL               — the project URL (falls back to VITE_SUPABASE_URL, the same
//                                public URL the browser uses, as api/stripe-webhook.js does)
//   SUPABASE_SERVICE_ROLE_KEY  — SECRET, bypasses RLS; never prefix with VITE_
import { createClient } from '@supabase/supabase-js'

let client

// Test hook: forget the cached client so env changes take effect.
export function resetAdminForTests() {
  client = undefined
}

export function getAdmin() {
  if (client) return client
  // The URL is public, so the VITE_ copy is a safe fallback. The key never falls back:
  // only SUPABASE_SERVICE_ROLE_KEY is read.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}
