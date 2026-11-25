import { describe, it, expect, vi } from 'vitest'
import {
  readLocalProgress, mergeProgress, writeLocalProgress, migrateProgress, MIGRATED_KEY,
} from './progressMerge'

function mem(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    _m: m,
  }
}
const empty = { challenges: [], streak: 0, storyXp: 0, story: {} }

describe('readLocalProgress', () => {
  it('maps the real keys', () => {
    const s = mem({
      umbra_challenges: JSON.stringify({ date: '2026-11-25', completed: { b: 50, a: 80 }, streak: 3 }),
      umbra_story_xp: '120',
      umbra_story: JSON.stringify({ j1: { step: 2 }, j2: { completed: true, step: 4 } }),
    })
    expect(readLocalProgress(s)).toEqual({
      challenges: ['a', 'b'], streak: 3, storyXp: 120,
      story: { j1: { step: 2 }, j2: { completed: true, step: 4 } },
    })
  })
  it('corrupted JSON gives empty defaults without throwing', () => {
    const s = mem({ umbra_challenges: '{nope', umbra_story: '[[', umbra_story_xp: 'abc' })
    expect(readLocalProgress(s)).toEqual(empty)
  })
  it('throwing storage gives empty defaults', () => {
    const s = { getItem() { throw new Error('denied') } }
    expect(readLocalProgress(s)).toEqual(empty)
  })
})

describe('mergeProgress', () => {
  it('unions challenge ids, sorted', () => {
    const r = mergeProgress({ ...empty, challenges: ['a', 'b'] }, { ...empty, challenges: ['b', 'c'] })
    expect(r.challenges).toEqual(['a', 'b', 'c'])
  })
  it('takes max XP and streak', () => {
    const r = mergeProgress({ ...empty, storyXp: 120, streak: 1 }, { ...empty, storyXp: 80, streak: 4 })
    expect(r.storyXp).toBe(120)
    expect(r.streak).toBe(4)
  })
  it('empty local returns remote unchanged', () => {
    const remote = { challenges: ['a'], streak: 2, storyXp: 10, story: { j: { step: 1 } } }
    expect(mergeProgress(empty, remote)).toEqual(remote)
  })
  it('handles remote {} and partial', () => {
    const local = { challenges: ['a'], streak: 2, storyXp: 10, story: { j: { step: 1 } } }
    expect(mergeProgress(local, {})).toEqual(local)
    expect(mergeProgress(local, { streak: 5 }).streak).toBe(5)
    expect(mergeProgress(local, null)).toEqual(local)
  })
  it('story: union of keys, further chapter wins, completed beats any step', () => {
    const local = { ...empty, story: { a: { step: 3 }, b: { step: 1 }, c: { completed: true, step: 4 } } }
    const remote = { ...empty, story: { a: { step: 1 }, b: { completed: true, step: 4 }, d: { step: 0 }, c: { step: 2 } } }
    expect(mergeProgress(local, remote).story).toEqual({
      a: { step: 3 }, b: { completed: true, step: 4 }, c: { completed: true, step: 4 }, d: { step: 0 },
    })
  })
})

describe('writeLocalProgress', () => {
  it('writes xp, story and streak back, keeping today challenges', () => {
    const s = mem({ umbra_challenges: JSON.stringify({ date: 'd', completed: { a: 80 }, streak: 1 }) })
    writeLocalProgress({ challenges: ['a', 'z'], streak: 4, storyXp: 90, story: { j: { step: 2 } } }, s)
    expect(JSON.parse(s.getItem('umbra_challenges'))).toEqual({ date: 'd', completed: { a: 80 }, streak: 4 })
    expect(s.getItem('umbra_story_xp')).toBe('90')
    expect(JSON.parse(s.getItem('umbra_story'))).toEqual({ j: { step: 2 } })
  })
  it('does not throw on broken storage', () => {
    expect(() => writeLocalProgress(empty, { getItem() { throw new Error() }, setItem() { throw new Error() } })).not.toThrow()
  })
})

function client(remote, { selectError, updateError } = {}) {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: updateError ?? null })) }))
  return {
    update,
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: async () => (selectError ? { data: null, error: selectError } : { data: { progress: remote }, error: null }) }) }),
      update,
    })),
  }
}
const user = { id: 'u1', app_metadata: {} }

describe('migrateProgress', () => {
  it('merges, saves and marks the device', async () => {
    const s = mem({ umbra_story_xp: '120' })
    const c = client({ storyXp: 80, challenges: ['x'] })
    await migrateProgress(c, user, s)
    const saved = c.update.mock.calls[0][0].progress
    expect(saved.storyXp).toBe(120)
    expect(saved.challenges).toEqual(['x'])
    expect(s.getItem(MIGRATED_KEY)).toBe('u1')
    expect(s.getItem('umbra_story_xp')).toBe('120')
  })
  it('skips card users', async () => {
    const c = client({})
    await migrateProgress(c, { id: 'k', app_metadata: { umbra_card: true } }, mem())
    expect(c.from).not.toHaveBeenCalled()
  })
  it('skips when already migrated for this user, runs for a different user', async () => {
    const s = mem({ [MIGRATED_KEY]: 'u1' })
    const c = client({})
    await migrateProgress(c, user, s)
    expect(c.from).not.toHaveBeenCalled()
    await migrateProgress(c, { id: 'u2', app_metadata: {} }, s)
    expect(c.from).toHaveBeenCalled()
  })
  it('save failure: no marker, no throw', async () => {
    const s = mem()
    await expect(migrateProgress(client({}, { updateError: { message: 'x' } }), user, s)).resolves.toBeUndefined()
    expect(s.getItem(MIGRATED_KEY)).toBeNull()
  })
  it('read failure: no marker, no throw', async () => {
    const s = mem()
    await migrateProgress(client({}, { selectError: { message: 'x' } }), user, s)
    expect(s.getItem(MIGRATED_KEY)).toBeNull()
  })
})
