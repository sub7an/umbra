import { describe, it, expect } from 'vitest'
import { thinLensImage, traceThrough } from './lensMath'

const f = 2.5, h = 0.9

describe('thin lens image', () => {
  it('an object at 2f images at 2f, same size, inverted', () => {
    const { v, m, real } = thinLensImage(2 * f, f)
    expect(v).toBeCloseTo(2 * f, 10)
    expect(m).toBeCloseTo(-1, 10)
    expect(real).toBe(true)
  })
  it('satisfies 1/f = 1/u + 1/v for real and virtual images', () => {
    for (const u of [1.0, 1.5, 3.2, 5, 8]) {
      const { v } = thinLensImage(u, f)
      expect(1 / u + 1 / v).toBeCloseTo(1 / f, 10)
    }
  })
  it('inside f the image is virtual, upright and magnified', () => {
    const { v, m, real } = thinLensImage(1.5, f)
    expect(real).toBe(false)
    expect(v).toBeLessThan(0)
    expect(m).toBeGreaterThan(1)
  })
  it('an object at the focal point images at infinity', () => {
    expect(thinLensImage(f, f).atInfinity).toBe(true)
  })
})

describe('ray tracing', () => {
  // Every ray from the object tip, whatever height it crosses the lens at,
  // must pass through the image tip: this is what the light fan draws.
  it('all rays meet at the real image', () => {
    const u = 5
    const { v, m } = thinLensImage(u, f)
    for (const y0 of [-1.6, -0.5, 0, 0.9, 1.6]) {
      const { sOut } = traceThrough(y0, u, f, h)
      expect(y0 + sOut * v).toBeCloseTo(m * h, 8)
    }
  })
  it('rays traced backwards meet at the virtual image', () => {
    const u = 1.5
    const { v, m } = thinLensImage(u, f)
    for (const y0 of [-1.2, 0, 0.9, 2.25]) {
      const { sOut } = traceThrough(y0, u, f, h)
      expect(y0 + sOut * v).toBeCloseTo(m * h, 8)
    }
  })
  it('the parallel ray passes through the far focal point', () => {
    const { sOut } = traceThrough(h, 4, f, h)
    expect(h + sOut * f).toBeCloseTo(0, 10)
  })
  it('the central ray goes straight through', () => {
    const { sIn, sOut } = traceThrough(0, 4, f, h)
    expect(sOut).toBeCloseTo(sIn, 12)
  })
})
