import { describe, it, expect } from 'vitest'
import { integrate, relErr, convergenceOrder } from './helpers.js'
import {
  stringModeFrequency, doubleSlitIntensity, waveStep, waveEnergy,
  membraneModeOmega, membraneModeShape,
} from '../../src/modules/wave/waveMath.js'

function gaussian(nx, ny, cx, cy, s) {
  const u = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) u[j * nx + i] = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (2 * s * s))
  }
  return u
}

describe('wave mechanics validation', () => {
  it('[modes] analytic: fundamental', () => {
    expect(Math.abs(stringModeFrequency(1, 0.5, 100, 0.01) - 100)).toBeLessThan(1e-12)
  })

  it('[modes] analytic: harmonics are integer multiples', () => {
    const f1 = stringModeFrequency(1, 0.5, 100, 0.01)
    for (let n = 2; n <= 5; n++) {
      expect(Math.abs(stringModeFrequency(n, 0.5, 100, 0.01) - n * f1)).toBeLessThan(1e-9)
    }
  })

  it('[modes] analytic: membrane ω ∝ √(m²+n²), degenerate (1,2)=(2,1)', () => {
    expect(membraneModeOmega(1, 1, 1, 1)).toBeCloseTo(Math.PI * Math.SQRT2, 12)
    expect(membraneModeOmega(1, 2)).toBe(membraneModeOmega(2, 1))
    expect(membraneModeOmega(3, 3) / membraneModeOmega(1, 1)).toBeCloseTo(3, 12)
    // the component's setting: c = 0.85
    expect(membraneModeOmega(2, 2, 0.85)).toBeCloseTo(Math.PI * Math.sqrt(8) * 0.85, 12)
  })

  it('[modes] analytic: membrane shape vanishes on edges and nodal line', () => {
    expect(Math.abs(membraneModeShape(2, 3, 0, 0.3))).toBeLessThan(1e-12)
    expect(Math.abs(membraneModeShape(2, 3, 1, 0.3))).toBeLessThan(1e-12)
    expect(Math.abs(membraneModeShape(2, 3, 0.5, 0.4))).toBeLessThan(1e-12) // x = 1/2 nodal for m = 2
    expect(membraneModeShape(1, 1, 0.5, 0.5)).toBeCloseTo(1, 12)
  })

  it('[modes] invariant: distinct membrane modes are orthogonal', () => {
    const inner = (a, b) => integrate((x) => integrate((y) => (
      membraneModeShape(a[0], a[1], x, y) * membraneModeShape(b[0], b[1], x, y)), 0, 1, 40), 0, 1, 40)
    expect(Math.abs(inner([1, 2], [2, 1]))).toBeLessThan(1e-9)
    expect(Math.abs(inner([1, 1], [3, 1]))).toBeLessThan(1e-9)
    expect(inner([2, 3], [2, 3])).toBeCloseTo(0.25, 9)
  })

  it('[slit] analytic: bright fringe at d sinθ = λ', () => {
    const v = doubleSlitIntensity(Math.asin(500e-9 / 2e-6), 2e-6, 0, 500e-9)
    expect(Math.abs(v - 1)).toBeLessThan(1e-9)
  })

  it('[slit] analytic: dark fringe at d sinθ = λ/2', () => {
    const v = doubleSlitIntensity(Math.asin(250e-9 / 2e-6), 2e-6, 0, 500e-9)
    expect(v).toBeLessThan(1e-12)
  })

  it('[slit] analytic: central maximum is 1 and fringe spacing is λ/d', () => {
    expect(doubleSlitIntensity(0, 2e-6, 0.5e-6, 500e-9)).toBeCloseTo(1, 12)
    // a = 0 -> pure cos²: zeros at sinθ = (m+1/2)λ/d
    const lam = 500e-9, d = 2e-6
    for (let m = 0; m < 4; m++) {
      expect(doubleSlitIntensity(Math.asin((m + 0.5) * lam / d), d, 0, lam)).toBeLessThan(1e-12)
    }
  })

  it('[slit] analytic: single-slit envelope zero at a sinθ = λ', () => {
    const lam = 500e-9, a = 1e-6
    expect(doubleSlitIntensity(Math.asin(lam / a), 3e-6, a, lam)).toBeLessThan(1e-12)
  })

  it('[ripple] invariant: energy drift', () => {
    const nx = 96, ny = 96, c = 1, dx = 1, dt = 0.5 // CFL 0.5
    let prev = gaussian(nx, ny, 48, 48, 4)
    let cur = Float32Array.from(prev)
    let next = new Float32Array(nx * ny)
    waveStep(cur, prev, next, nx, ny, c, dt, dx)
    ;[prev, cur, next] = [cur, next, prev]
    const e0 = waveEnergy(cur, prev, nx, ny, c, dt, dx)
    for (let s = 0; s < 2000; s++) {
      waveStep(cur, prev, next, nx, ny, c, dt, dx)
      ;[prev, cur, next] = [cur, next, prev]
    }
    const e1 = waveEnergy(cur, prev, nx, ny, c, dt, dx)
    expect(e0).toBeGreaterThan(0)
    expect(relErr(e1, e0)).toBeLessThan(0.02)
  })

  it('[ripple] convergence: standing mode is second order', () => {
    const omega = Math.PI * Math.SQRT2
    const T = 0.5
    const run = (n) => {
      const dx = 1 / n, dt = 0.5 * dx, steps = Math.round(T / dt)
      const phi = new Float32Array((n + 1) * (n + 1))
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) phi[j * (n + 1) + i] = Math.sin(Math.PI * i * dx) * Math.sin(Math.PI * j * dx)
      }
      let cur = Float64Array.from(phi)
      let prev = cur.map((v) => v * Math.cos(omega * dt))
      let next = new Float64Array(cur.length)
      for (let s = 0; s < steps; s++) {
        waveStep(cur, prev, next, n + 1, n + 1, 1, dt, dx)
        ;[prev, cur, next] = [cur, next, prev]
      }
      let err = 0
      const exact = Math.cos(omega * steps * dt)
      for (let k = 0; k < cur.length; k++) err = Math.max(err, Math.abs(cur[k] - phi[k] * exact))
      return err
    }
    const e16 = run(16), e32 = run(32)
    expect(convergenceOrder(e16, e32)).toBeGreaterThan(1.8)
    expect(convergenceOrder(e16, e32)).toBeLessThan(2.2)
  })

  it('[ripple] invariant: barrier cells stay zero, damping removes energy', () => {
    const nx = 48, ny = 48
    const barrier = new Uint8Array(nx * ny)
    for (let j = 0; j < ny; j++) barrier[j * nx + 24] = 1
    let prev = gaussian(nx, ny, 12, 24, 3)
    let cur = Float32Array.from(prev)
    let next = new Float32Array(nx * ny)
    let last = Infinity
    for (let s = 0; s < 200; s++) {
      waveStep(cur, prev, next, nx, ny, 1, 0.5, 1, { damp: 0.99, barrier })
      ;[prev, cur, next] = [cur, next, prev]
      for (let j = 0; j < ny; j++) expect(cur[j * nx + 24]).toBe(0)
      if (s % 50 === 49) {
        const e = waveEnergy(cur, prev, nx, ny, 1, 0.5, 1)
        expect(e).toBeLessThan(last)
        last = e
      }
    }
  })
})
