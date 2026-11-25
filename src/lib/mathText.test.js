import { describe, it, expect } from 'vitest'
import { splitMath, plainMath } from '../lib/mathText'

describe('splitMath', () => {
  it('splits inline maths from text', () => {
    expect(splitMath('A $2.0\\ \\text{m}$ rod')).toEqual([
      { math: false, text: 'A ' }, { math: true, text: '2.0\\ \\text{m}' }, { math: false, text: ' rod' },
    ])
  })
  it('keeps an unmatched $ as text', () => {
    expect(splitMath('costs $5')).toEqual([{ math: false, text: 'costs $5' }])
  })
  it('makes a readable plain preview', () => {
    expect(plainMath('length $0.80\\ \\text{m}$ fixed')).toBe('length 0.80 m fixed')
  })
})
