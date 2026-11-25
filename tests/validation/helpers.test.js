import { describe, it, expect } from 'vitest'
import { mulberry32, relErr, convergenceOrder, integrate } from './helpers.js'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    expect(mulberry32(1)()).toBe(mulberry32(1)())
  })
})

describe('relErr', () => {
  it('is |a - b| / |b|', () => {
    expect(relErr(1.1, 1)).toBeCloseTo(0.1, 12)
  })
})

describe('convergenceOrder', () => {
  it('returns log2(errCoarse / errFine) for ratio 2', () => {
    expect(convergenceOrder(16e-4, 1e-4)).toBeCloseTo(4, 12)
  })
})

describe('integrate', () => {
  it('Simpson integral of sin over [0, pi] is 2 within 1e-9', () => {
    expect(Math.abs(integrate(Math.sin, 0, Math.PI) - 2)).toBeLessThan(1e-9)
  })
})
