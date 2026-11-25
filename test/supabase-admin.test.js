import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createClient = vi.fn((url, key) => ({ url, key }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const { getAdmin, resetAdminForTests } = await import('../api/_lib/supabaseAdmin.js')

const KEYS = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY']
let saved

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
  resetAdminForTests()
  createClient.mockClear()
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  resetAdminForTests()
})

describe('getAdmin env', () => {
  it('uses SUPABASE_URL when set', () => {
    process.env.SUPABASE_URL = 'https://a.example'
    process.env.VITE_SUPABASE_URL = 'https://b.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk'
    expect(getAdmin()).toMatchObject({ url: 'https://a.example', key: 'srk' })
  })

  it('falls back to VITE_SUPABASE_URL when SUPABASE_URL is unset', () => {
    process.env.VITE_SUPABASE_URL = 'https://b.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk'
    expect(getAdmin()).toMatchObject({ url: 'https://b.example', key: 'srk' })
  })

  it('never falls back for the service key', () => {
    process.env.VITE_SUPABASE_URL = 'https://b.example'
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = 'leaked'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon'
    expect(() => getAdmin()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('throws when no URL is set at all', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk'
    expect(() => getAdmin()).toThrow(/SUPABASE_URL/)
  })
})
