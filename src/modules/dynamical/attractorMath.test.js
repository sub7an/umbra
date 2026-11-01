import { describe, it, expect } from 'vitest'
import { ATTRACTOR_DEFS, attractorStep } from './attractorMath'

describe('Lorenz system', () => {
  const p = ATTRACTOR_DEFS.lorenz.defaultParams
  it('the wing-centre equilibria C± are stationary', () => {
    const s = Math.sqrt(p.beta * (p.rho - 1))
    for (const sign of [1, -1]) {
      const [x, y, z] = attractorStep('lorenz', sign * s, sign * s, p.rho - 1, p, 0.01)
      expect(x).toBeCloseTo(sign * s, 10)
      expect(y).toBeCloseTo(sign * s, 10)
      expect(z).toBeCloseTo(p.rho - 1, 10)
    }
  })
  it('stays on a bounded attractor after a long run', () => {
    let [x, y, z] = [0.5, 0.5, 20]
    for (let i = 0; i < 20000; i++) [x, y, z] = attractorStep('lorenz', x, y, z, p, 0.005)
    expect(Math.abs(x)).toBeLessThan(30)
    expect(z).toBeGreaterThan(0)
    expect(z).toBeLessThan(60)
  })
  it('shows sensitive dependence: nearby starts separate', () => {
    let a = [1, 1, 20], b = [1 + 1e-8, 1, 20]
    for (let i = 0; i < 8000; i++) {
      a = attractorStep('lorenz', ...a, p, 0.005)
      b = attractorStep('lorenz', ...b, p, 0.005)
    }
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1)
  })
})

describe('RK4 integrator', () => {
  it('is fourth-order accurate (halving dt cuts the error ~16×)', () => {
    // Compare against a very fine reference over the same time span
    const p = ATTRACTOR_DEFS.thomas.defaultParams
    const run = (dt, steps) => {
      let s = [0.1, 0.2, 0.3]
      for (let i = 0; i < steps; i++) s = attractorStep('thomas', ...s, p, dt)
      return s
    }
    const ref = run(0.0005, 4000)
    const err = (s) => Math.hypot(s[0] - ref[0], s[1] - ref[1], s[2] - ref[2])
    const ratio = err(run(0.04, 50)) / err(run(0.02, 100))
    expect(ratio).toBeGreaterThan(12)
    expect(ratio).toBeLessThan(20)
  })
})
