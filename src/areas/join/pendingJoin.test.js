import { describe, it, expect, beforeEach } from 'vitest'
import { pending, PENDING_MAX_AGE_MS } from './pendingJoin'

const KEY = 'umbra.join.pending'

beforeEach(() => {
  const data = new Map()
  globalThis.sessionStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
})

describe('pending join (sessionStorage)', () => {
  it('stores the code and name with a timestamp and reads them back', () => {
    pending.set({ code: 'K7M2PQ', name: 'Amira' }, 1000)
    expect(JSON.parse(sessionStorage.getItem(KEY))).toEqual({ code: 'K7M2PQ', name: 'Amira', at: 1000 })
    expect(pending.get(1000 + 60_000)).toEqual({ code: 'K7M2PQ', name: 'Amira' })
  })

  it('ignores and clears an entry older than 10 minutes', () => {
    expect(PENDING_MAX_AGE_MS).toBe(10 * 60 * 1000)
    pending.set({ code: 'K7M2PQ', name: 'Amira' }, 1000)
    expect(pending.get(1000 + PENDING_MAX_AGE_MS + 1)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('ignores and clears an entry without a timestamp (written by an older version)', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ code: 'K7M2PQ', name: 'Amira' }))
    expect(pending.get()).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('returns null for nothing stored or unreadable JSON', () => {
    expect(pending.get()).toBeNull()
    sessionStorage.setItem(KEY, '{nope')
    expect(pending.get()).toBeNull()
  })
})
