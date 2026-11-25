import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { roleFromQueries } from '../lib/role'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  // 'teacher' (has a staff row) | 'student' (has a students row) | 'public'
  const [role, setRole] = useState('public')
  const [roleLoading, setRoleLoading] = useState(isSupabaseConfigured)
  // True when the last role check failed; `role` then keeps its previous value
  const [roleError, setRoleError] = useState(false)
  const pollRef = useRef(null)
  const roleReq = useRef(0)
  const lastUid = useRef(undefined)

  const user = session?.user ?? null
  const isPro = Boolean(profile?.is_pro)

  const loadProfile = useCallback(async (u) => {
    const uid = u?.id
    if (!supabase || !uid) { setProfile(null); return }
    // Login-card students have no profiles row by design (no email is stored for
    // them): never create one from the client.
    if (u.app_metadata?.umbra_card) { setProfile(null); return }
    // Ensure a row exists, then read it (upsert keeps this idempotent)
    await supabase.from('profiles').upsert({ id: uid }, { onConflict: 'id', ignoreDuplicates: true })
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data ?? null)
  }, [])

  const loadRole = useCallback(async (u) => {
    const req = ++roleReq.current
    if (!supabase || !u) { setRole('public'); setRoleError(false); setRoleLoading(false); return }
    setRoleLoading(true)
    let result
    try {
      const [staff, student] = await Promise.all([
        supabase.from('staff').select('school_id').eq('user_id', u.id).limit(1),
        supabase.from('students').select('user_id').eq('user_id', u.id).limit(1),
      ])
      result = roleFromQueries(staff, student)
    } catch (error) {
      result = { error }
    }
    if (req !== roleReq.current) return // a newer sign-in / sign-out won
    if (result.error) setRoleError(true) // keep the previous role
    else { setRole(result.role); setRoleError(false) }
    setRoleLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); setRoleLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      lastUid.current = data.session?.user?.id ?? null
      loadProfile(data.session?.user)
      loadRole(data.session?.user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // Same user (e.g. token refresh): nothing to reload
      if ((s?.user?.id ?? null) === lastUid.current) return
      lastUid.current = s?.user?.id ?? null
      if (s?.user) setRoleLoading(true)
      // Deferred: awaiting Supabase calls inside this callback can deadlock the client
      setTimeout(() => { loadProfile(s?.user); loadRole(s?.user) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile, loadRole])

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
    roleReq.current++
    lastUid.current = null
    setSession(null); setProfile(null); setRole('public'); setRoleError(false); setRoleLoading(false)
  }, [])

  const value = {
    configured: isSupabaseConfigured,
    loading, session, user, profile, isPro,
    role, roleLoading, roleError,
    signOut, refreshUntilPro,
    reloadProfile: () => loadProfile(user),
    reloadRole: () => loadRole(user),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
