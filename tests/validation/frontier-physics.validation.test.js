import { describe, it, expect } from 'vitest'
import {
  leapfrogStep, totalEnergy, rk4Step, totalEnergy3D,
  photonSphereRadius, iscoRadius,
  keplerianVelocity, observedRotationVelocity, rotationDiscrepancy, darkMatterFraction,
  hubbleExpansion, toHubbleUnits, scaleFactor,
} from '../../src/modules/frontier/frontierMath.js'
import { relErr, convergenceOrder } from './helpers.js'

// Two-body circular orbit about the centre of mass, separation r, G = 1.
function circularPair(m1, m2, r) {
  const M = m1 + m2
  const v = Math.sqrt(M / r)             // relative speed uses the total mass
  return [
    { x: -r * m2 / M, y: 0, vx: 0, vy: -v * m2 / M, m: m1 },
    { x: r * m1 / M, y: 0, vx: 0, vy: v * m1 / M, m: m2 },
  ]
}

describe('frontier physics validation', () => {
  it('[nbody] invariant: energy drift', () => {
    const bodies = circularPair(1, 1e-3, 1)
    const E0 = totalEnergy(bodies)
    let worst = 0
    for (let i = 0; i < 1e4; i++) {
      leapfrogStep(bodies, 1e-3)
      worst = Math.max(worst, relErr(totalEnergy(bodies), E0))
    }
    expect(worst).toBeLessThan(1e-5)
  })

  it('[nbody] invariant: momentum conserved, softened energy conserved', () => {
    const bodies = circularPair(1, 0.5, 1.2)
    bodies.push({ x: 0.3, y: 2, vx: 0.2, vy: 0, m: 0.1 })
    const P = (k) => bodies.reduce((s, b) => s + b.m * b[k], 0)
    const [px0, py0] = [P('vx'), P('vy')]
    const E0 = totalEnergy(bodies, 1, 0.05)
    for (let i = 0; i < 2000; i++) leapfrogStep(bodies, 1e-3, 1, 0.05)
    expect(Math.abs(P('vx') - px0)).toBeLessThan(1e-12)
    expect(Math.abs(P('vy') - py0)).toBeLessThan(1e-12)
    expect(relErr(totalEnergy(bodies, 1, 0.05), E0)).toBeLessThan(1e-5)
  })

  it('[nbody] analytic: Kepler period', () => {
    const [m1, m2, r] = [1, 1e-3, 1]
    const bodies = circularPair(m1, m2, r)
    const dt = 1e-3
    const expected = 2 * Math.PI * Math.sqrt(r ** 3 / (m1 + m2))
    // Unwrapped polar angle of the separation vector; time to sweep 2π.
    let angle = 0
    let prev = Math.atan2(bodies[1].y - bodies[0].y, bodies[1].x - bodies[0].x)
    let period = null
    for (let i = 1; i <= 8000 && period === null; i++) {
      leapfrogStep(bodies, dt)
      const a = Math.atan2(bodies[1].y - bodies[0].y, bodies[1].x - bodies[0].x)
      let d = a - prev
      if (d < -Math.PI) d += 2 * Math.PI
      if (d > Math.PI) d -= 2 * Math.PI
      const before = angle
      angle += d
      prev = a
      if (angle >= 2 * Math.PI) period = (i - 1 + (2 * Math.PI - before) / (angle - before)) * dt
    }
    expect(period).not.toBeNull()
    expect(relErr(period, expected)).toBeLessThan(1e-3)
  })

  it('[nbody] convergence: second order', () => {
    // Eccentric orbit so the energy error is not trivially small; compare the
    // worst energy error up to the same physical time t = 2 for both step sizes.
    const run = (dt) => {
      const bodies = [
        { x: 0, y: 0, vx: 0, vy: 0, m: 1 },
        { x: 1, y: 0, vx: 0, vy: 0.8, m: 1e-3 },
      ]
      const E0 = totalEnergy(bodies)
      const steps = Math.round(2 / dt)
      let worst = 0
      for (let i = 0; i < steps; i++) {
        leapfrogStep(bodies, dt)
        worst = Math.max(worst, relErr(totalEnergy(bodies), E0))
      }
      return worst
    }
    const order = convergenceOrder(run(2e-3), run(1e-3))
    expect(Math.abs(order - 2)).toBeLessThan(0.3)
  })

  it('[nbody] convergence: RK4 scene integrator is fourth order', () => {
    // Test particle on a circular orbit about a fixed-ish heavy mass (G M = 1,
    // r = 1, omega = 1). Compare to the exact position at the same time t = 4.
    const run = (dt) => {
      let pos = [[0, 0, 0], [1, 0, 0]]
      let vel = [[0, 0, 0], [0, 0, 1]]
      const masses = [1, 0]
      const steps = Math.round(4 / dt)
      for (let i = 0; i < steps; i++) ({ pos, vel } = rk4Step(pos, vel, masses, 1, 0, dt))
      return Math.hypot(pos[1][0] - Math.cos(4), pos[1][2] - Math.sin(4))
    }
    const order = convergenceOrder(run(0.2), run(0.1))
    expect(order).toBeGreaterThan(3.5)
    expect(order).toBeLessThan(4.5)
  })

  it('[blackhole] analytic: photon sphere and ISCO', () => {
    expect(photonSphereRadius(1)).toBe(3)
    expect(iscoRadius(1)).toBe(6)
    // 1.5 r_s and 3 r_s with r_s = 2M
    expect(photonSphereRadius(2)).toBe(1.5 * (2 * 2))
    expect(iscoRadius(2)).toBe(3 * (2 * 2))
  })

  it('[expansion] analytic: Hubble law', () => {
    expect(hubbleExpansion(100, 70)).toBe(7000)
    expect(toHubbleUnits(1)).toBe(70)
  })

  it('[expansion] analytic: scale factor is de Sitter exponential', () => {
    expect(scaleFactor(0, 1)).toBe(1)
    expect(relErr(scaleFactor(5, 2), Math.exp(0.8))).toBeLessThan(1e-12)
  })

  it('[rotationcurve] analytic: Keplerian falloff', () => {
    // r >> softening a = 0.8, so v ∝ r^(-1/2): v(4r)/v(r) → 0.5.
    const a = 0.8
    for (const r of [100 * a, 400 * a]) {
      expect(Math.abs(keplerianVelocity(4 * r) / keplerianVelocity(r) - 0.5)).toBeLessThan(1e-3)
    }
  })

  it('[rotationcurve] analytic: observed curve is flat, discrepancy and dark fraction follow', () => {
    expect(observedRotationVelocity(50)).toBeCloseTo(0.85, 6)
    expect(observedRotationVelocity(0)).toBe(0)
    const r = 5
    expect(rotationDiscrepancy(r)).toBeCloseTo(observedRotationVelocity(r) - keplerianVelocity(r), 12)
    expect(rotationDiscrepancy(r)).toBeGreaterThan(0)
    const frac = 1 - (keplerianVelocity(r) / observedRotationVelocity(r)) ** 2
    expect(darkMatterFraction(r)).toBeCloseTo(frac, 12)
    expect(darkMatterFraction(0)).toBe(0)
  })
})
