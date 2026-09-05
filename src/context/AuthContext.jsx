import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const pollRef = useRef(null)

  const user = session?.user ?? null
  const isPro = Boolean(profile?.is_pro)

  const loadProfile = useCallback(async (uid) => {
    if (!supabase || !uid) { setProfile(null); return }
    // Ensure a row exists, then read it (upsert keeps this idempotent)
    await supabase.from('profiles').upsert({ id: uid }, { onConflict: 'id', ignoreDuplicates: true })
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      loadProfile(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  // After a successful checkout the webhook flips is_pro server-side; poll
  // briefly so the UI reflects Pro without requiring a manual refresh.
  const refreshUntilPro = useCallback((tries = 10) => {
    if (!supabase || !user) return
    clearInterval(pollRef.current)
    let n = 0
    pollRef.current = setInterval(async () => {
      n++
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      if (data?.is_pro || n >= tries) clearInterval(pollRef.current)
    }, 2000)
  }, [user])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null); setProfile(null)
  }, [])

  const value = {
    configured: isSupabaseConfigured,
    loading, session, user, profile, isPro,
    signOut, refreshUntilPro,
    reloadProfile: () => loadProfile(user?.id),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
