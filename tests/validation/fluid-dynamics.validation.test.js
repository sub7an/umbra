import { describe, it, expect } from 'vitest'
import { mulberry32, integrate } from './helpers.js'
import {
  cubicSplineKernel2D, poly6Kernel3D, spikyGradient3D, viscosityLaplacian3D,
  cylinderFlowVelocity, sheddingFrequency, initSphParticles, sphStep,
  SPH_H, SPH_MASS, SPH_BOUNDS, SPH_MAX_SPEED,
} from '../../src/modules/fluid-dynamics/fluidMath.js'
import { VALIDATION_LIMITS } from '../../src/content/validationLimits.js'

describe('fluid dynamics validation', () => {
  it('[sph] analytic: kernel normalisation', () => {
    const h = 0.7
    const total = integrate((r) => cubicSplineKernel2D(r, h) * 2 * Math.PI * r, 0, 2 * h)
    expect(Math.abs(total - 1)).toBeLessThan(1e-3)
  })

  it('[sph] analytic: poly6 density kernel normalises in 3D', () => {
    const total = integrate((r) => poly6Kernel3D(r * r) * 4 * Math.PI * r * r, 0, SPH_H)
    expect(Math.abs(total - 1)).toBeLessThan(1e-6)
    expect(poly6Kernel3D(SPH_H * SPH_H)).toBe(0)
  })

  it('[sph] analytic: spiky gradient is the derivative of the spiky kernel', () => {
    const W = (r) => (15 / (Math.PI * SPH_H ** 6)) * (SPH_H - r) ** 3
    for (const r of [0.1, 0.3, 0.5, 0.8]) {
      const d = 1e-6
      const numeric = (W(r + d) - W(r - d)) / (2 * d)
      expect(Math.abs(spikyGradient3D(r) - numeric) / Math.abs(numeric)).toBeLessThan(1e-6)
    }
    expect(spikyGradient3D(SPH_H)).toBe(0)
  })

  it('[sph] analytic: viscosity laplacian matches the Müller viscosity kernel', () => {
    const h = SPH_H
    const W = (r) => (15 / (2 * Math.PI * h ** 3)) * (-(r ** 3) / (2 * h ** 3) + (r * r) / (h * h) + h / (2 * r) - 1)
    const lap = (r) => {
      const d = 1e-4
      const flux = (s) => s * s * ((W(s + d) - W(s - d)) / (2 * d))
      return (flux(r + d) - flux(r - d)) / (2 * d) / (r * r)
    }
    for (const r of [0.2, 0.4, 0.6, 0.8]) {
      expect(Math.abs(viscosityLaplacian3D(r) - lap(r)) / viscosityLaplacian3D(r)).toBeLessThan(1e-3)
    }
    expect(viscosityLaplacian3D(SPH_H)).toBe(0)
  })

  it('[sph] invariant: mass conserved', () => {
    const rng = mulberry32(7)
    const p = initSphParticles(rng)
    const n0 = p.n
    for (let s = 0; s < 500; s++) sphStep(p, { g: 9.5, dt: 0.011 }, rng)
    expect(p.n).toBe(n0)
    expect(p.pos.length).toBe(n0 * 3)
    expect(p.n * SPH_MASS).toBe(216)
  })

  it('[sph] invariant: particles stay finite, in the tank and under the speed cap', () => {
    const rng = mulberry32(11)
    const p = initSphParticles(rng)
    const b = SPH_BOUNDS
    for (let s = 0; s < 500; s++) sphStep(p, { g: 9.5, dt: 0.011 }, rng)
    for (let i = 0; i < p.n; i++) {
      const [x, y, z] = [p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]]
      expect(Number.isFinite(x + y + z)).toBe(true)
      expect(x >= b.xmin && x <= b.xmax && y >= b.ymin && y <= b.ymax && z >= b.zmin && z <= b.zmax).toBe(true)
      expect(Math.hypot(p.vel[i * 3], p.vel[i * 3 + 1], p.vel[i * 3 + 2])).toBeLessThanOrEqual(SPH_MAX_SPEED + 1e-4)
    }
  })

  it('[sph] invariant: same seed gives the same run', () => {
    const run = () => {
      const rng = mulberry32(3)
      const p = initSphParticles(rng)
      for (let s = 0; s < 50; s++) sphStep(p, { g: 9, dt: 0.01 }, rng)
      return Array.from(p.pos)
    }
    expect(run()).toEqual(run())
  })

  it('[streamlines] analytic: no flow through the surface', () => {
    const R = 1.2, U = 1.7
    for (let k = 0; k < 12; k++) {
      const th = (k * 2 * Math.PI) / 12 + 0.1
      const [vx, vy] = cylinderFlowVelocity(R * Math.cos(th), R * Math.sin(th), U, R)
      const vr = vx * Math.cos(th) + vy * Math.sin(th)
      expect(Math.abs(vr)).toBeLessThan(1e-12)
    }
  })

  it('[streamlines] analytic: far field', () => {
    const R = 1.2, U = 1
    const [vx, vy] = cylinderFlowVelocity(50 * R, 0, U, R)
    expect(Math.abs(vx - U)).toBeLessThan(1e-3)
    expect(Math.abs(vy)).toBeLessThan(1e-3)
  })

  it('[streamlines] analytic: stagnation points, shoulder speed 2U, zero inside', () => {
    const R = 1.2, U = 1
    const e = 1e-9 // the surface itself counts as inside, so probe just outside
    const [sx] = cylinderFlowVelocity(-R - e, 0, U, R)
    expect(Math.abs(sx)).toBeLessThan(1e-6)
    const [tx, ty] = cylinderFlowVelocity(0, R + e, U, R)
    expect(Math.abs(tx - 2 * U)).toBeLessThan(1e-6)
    expect(Math.abs(ty)).toBeLessThan(1e-6)
    expect(cylinderFlowVelocity(0.3, 0.2, U, R)).toEqual([0, 0])
  })

  it('[vortex] reference: Strouhal', () => {
    expect(sheddingFrequency(1, 0.1)).toBeCloseTo(2, 12)
    expect(sheddingFrequency(2, 0.1, 0.25)).toBeCloseTo(5, 12)
  })

  it('[vortex] reference: stated validation limits cover fluid views', () => {
    expect(VALIDATION_LIMITS.sph).toMatch(/Qualitative/)
    expect(VALIDATION_LIMITS.vortex).toMatch(/Strouhal/)
  })
})
