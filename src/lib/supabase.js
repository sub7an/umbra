import { createClient } from '@supabase/supabase-js'

// Public, client-safe keys (anon key is designed to be exposed; row-level
// security in Postgres is what actually protects data).
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anon)

// null until the project env vars are set — callers guard on isSupabaseConfigured
// so the app runs fine before accounts are wired up.
export const supabase = isSupabaseConfigured
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
