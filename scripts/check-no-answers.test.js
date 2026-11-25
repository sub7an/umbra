import { describe, it, expect } from 'vitest'
import { hasAnswerKey } from './check-no-answers.mjs'

describe('hasAnswerKey', () => {
  it('flags key + solution', () => expect(hasAnswerKey({ key: {}, solution: [] })).toBe(true))
  it('ignores key alone', () => expect(hasAnswerKey({ key: 'x' })).toBe(false))
  it('ignores nested and non-objects', () => {
    expect(hasAnswerKey({ a: { key: 1, solution: 2 } })).toBe(false)
    expect(hasAnswerKey([{ key: 1, solution: 2 }])).toBe(false)
    expect(hasAnswerKey(null)).toBe(false)
  })
})
