import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: null }))
import { firstByPart, latestByPart, isLate } from './assignmentsApi'

const rows = [
  { item_id: 'i', part_id: 'a', correct: true, created_at: '2026-11-25T10:02:00Z' },
  { item_id: 'i', part_id: 'a', correct: false, created_at: '2026-11-25T10:00:00Z' },
  { item_id: 'i', part_id: 'b', correct: true, created_at: '2026-11-25T10:01:00Z' },
]

describe('attempt helpers', () => {
  it('firstByPart keeps the earliest attempt of each part (a later correct retry does not count)', () => {
    const f = firstByPart(rows)
    expect(f['i:a'].correct).toBe(false)
    expect(f['i:b'].correct).toBe(true)
  })
  it('latestByPart keeps the newest', () => {
    expect(latestByPart(rows)['i:a'].correct).toBe(true)
  })
  it('isLate compares with the due date; no due date is never late', () => {
    expect(isLate(rows[0], { due_at: '2026-11-25T10:01:00Z' })).toBe(true)
    expect(isLate(rows[1], { due_at: '2026-11-25T10:01:00Z' })).toBe(false)
    expect(isLate(rows[0], { due_at: null })).toBe(false)
  })
})
