import { describe, it, expect } from 'vitest'
import {
  pipeHarmonics, stringHarmonics, chladniAmplitude, chladniGradient,
  lissajous, stringModeShape, harmonicDisplacement,
} from '../../src/modules/acoustic/acousticMath.js'

describe('acoustic physics validation', () => {
  it('[harmonics] analytic: closed pipe odd harmonics', () => {
    expect(pipeHarmonics(100, 'closed', 3)).toEqual([100, 300, 500])
  })

  it('[harmonics] analytic: open pipe all integer harmonics', () => {
    expect(pipeHarmonics(100, 'open', 3)).toEqual([100, 200, 300])
  })

  it('[harmonics] analytic: string harmonics are integer multiples', () => {
    expect(stringHarmonics(130.8, 8).map((f, i) => f / 130.8 - (i + 1)).every(d => Math.abs(d) < 1e-12)).toBe(true)
    expect(stringHarmonics(100, 4)).toEqual([100, 200, 300, 400])
  })

  it('[harmonics] analytic: string mode n has n-1 interior nodes at k/n', () => {
    for (let n = 1; n <= 8; n++) {
      expect(Math.abs(stringModeShape(n, 0))).toBeLessThan(1e-12)
      expect(Math.abs(stringModeShape(n, 1))).toBeLessThan(1e-12)
      for (let k = 1; k < n; k++) expect(Math.abs(stringModeShape(n, k / n))).toBeLessThan(1e-12)
      expect(Math.abs(stringModeShape(n, 0.5 / n))).toBeCloseTo(1, 12)
    }
  })

  it('[harmonics] analytic: displacement oscillates at n times the base rate', () => {
    // amp·cos(n·ω0·t): full period for mode n is 2π/(n·ω0)
    const w0 = 1.8
    for (let n = 1; n <= 8; n++) {
      const T = (2 * Math.PI) / (n * w0)
      expect(harmonicDisplacement(n, 0.3, 0.37 + T)).toBeCloseTo(harmonicDisplacement(n, 0.3, 0.37), 10)
    }
    expect(harmonicDisplacement(3, 0.5, 0)).toBeCloseTo(0.5, 12)
  })

  it('[cymatics] analytic: diagonal nodal line for m != n', () => {
    for (const [m, n] of [[1, 2], [2, 3], [1, 4], [3, 5], [4, 5]]) {
      for (let i = 0; i < 10; i++) {
        const x = (i + 0.37) / 10
        expect(Math.abs(chladniAmplitude(m, n, x, x))).toBeLessThan(1e-12)
      }
    }
  })

  it('[cymatics] invariant: antisymmetric under swapping modes and under x<->y', () => {
    for (const [x, y] of [[0.2, 0.7], [0.45, 0.1], [0.9, 0.33]]) {
      expect(chladniAmplitude(2, 5, x, y)).toBeCloseTo(-chladniAmplitude(5, 2, x, y), 12)
      expect(chladniAmplitude(2, 5, x, y)).toBeCloseTo(-chladniAmplitude(2, 5, y, x), 12)
    }
  })

  it('[cymatics] analytic: amplitude is zero for m = n (no pattern)', () => {
    expect(chladniAmplitude(3, 3, 0.21, 0.64)).toBe(0)
  })

  it('[cymatics] invariant: analytic gradient matches central differences', () => {
    const h = 1e-6
    for (const [m, n, x, y] of [[1, 2, 0.3, 0.6], [3, 5, 0.71, 0.18], [2, 4, 0.5, 0.9]]) {
      const [gx, gy] = chladniGradient(m, n, x, y)
      const fx = (chladniAmplitude(m, n, x + h, y) - chladniAmplitude(m, n, x - h, y)) / (2 * h)
      const fy = (chladniAmplitude(m, n, x, y + h) - chladniAmplitude(m, n, x, y - h)) / (2 * h)
      expect(Math.abs(gx - fx)).toBeLessThan(1e-6)
      expect(Math.abs(gy - fy)).toBeLessThan(1e-6)
    }
  })

  it('[lissajous] analytic: circle for a=b=1, delta=pi/2', () => {
    for (let i = 0; i < 20; i++) {
      const [x, y] = lissajous(0.31 * i, 1, 1, Math.PI / 2)
      expect(Math.abs(x * x + y * y - 1)).toBeLessThan(1e-12)
    }
  })

  it('[lissajous] analytic: delta=0, a=b=1 gives the diagonal y=x', () => {
    for (let i = 0; i < 10; i++) {
      const [x, y] = lissajous(0.5 * i, 1, 1, 0)
      expect(Math.abs(x - y)).toBeLessThan(1e-12)
    }
  })

  it('[lissajous] invariant: closed curve after 2π for integer a, b; bounded by R', () => {
    const R = 1.5
    for (const [a, b] of [[1, 2], [3, 4], [5, 8]]) {
      for (let i = 0; i < 10; i++) {
        const t = 0.7 * i
        const [x0, y0] = lissajous(t, a, b, 0.4, R)
        const [x1, y1] = lissajous(t + 2 * Math.PI, a, b, 0.4, R)
        expect(Math.abs(x0 - x1)).toBeLessThan(1e-9)
        expect(Math.abs(y0 - y1)).toBeLessThan(1e-9)
        expect(Math.abs(x0)).toBeLessThanOrEqual(R)
        expect(Math.abs(y0)).toBeLessThanOrEqual(R)
      }
    }
  })
})
