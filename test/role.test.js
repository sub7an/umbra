import { describe, it, expect } from 'vitest'
import { roleFromQueries } from '../src/lib/role'

const ok = (rows) => ({ data: rows, error: null })
const fail = { data: null, error: { message: 'Failed to fetch' } }

describe('roleFromQueries', () => {
  it('is teacher with a staff row, student with a students row, else public', () => {
    expect(roleFromQueries(ok([{ school_id: 's' }]), ok([]))).toEqual({ role: 'teacher' })
    expect(roleFromQueries(ok([]), ok([{ user_id: 'u' }]))).toEqual({ role: 'student' })
    expect(roleFromQueries(ok([]), ok([]))).toEqual({ role: 'public' })
  })

  it('reports an error, never public, when either query fails', () => {
    expect(roleFromQueries(fail, ok([]))).toHaveProperty('error')
    expect(roleFromQueries(ok([]), fail)).toHaveProperty('error')
    expect(roleFromQueries(fail, ok([])).role).toBeUndefined()
    expect(roleFromQueries(undefined, ok([]))).toHaveProperty('error')
  })
})
