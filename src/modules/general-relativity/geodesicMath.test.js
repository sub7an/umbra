import { describe, it, expect } from 'vitest'
import { SIZE, ORBIT_DPHI, integrateGeodesic, newtonianOrbit, integrateLightRay } from './geodesicMath'

const radius = (p) => Math.hypot(p[0], p[2])

// Angles (in φ) at which the orbit passes periapsis (local minima of r)
function periapsisAngles(pts) {
  const out = []
  for (let i = 1; i < pts.length - 1; i++) {
    const r0 = radius(pts[i - 1]), r1 = radius(pts[i]), r2 = radius(pts[i + 1])
    if (r1 < r0 && r1 <= r2) out.push(i * ORBIT_DPHI)
  }
  return out
}

describe('massive-particle geodesics', () => {
  // Regression: a missing M/L² term once sent every "orbit" off to infinity
  it('orbits stay bound for several turns', () => {
    for (const mass of [0.5, 2, 5]) {
      const pts = integrateGeodesic(mass, 5, 8.4, 4)
      expect(pts.length).toBeGreaterThan(0.95 * (4 * 2 * Math.PI) / ORBIT_DPHI)
      for (const p of pts) expect(radius(p)).toBeLessThan(SIZE)
    }
  })
  it('turns around exactly at the chosen periapsis and apoapsis', () => {
    const pts = integrateGeodesic(2, 3, 6.5, 4)
    const rs = pts.map(radius)
    expect(Math.min(...rs)).toBeCloseTo(3, 2)
    expect(Math.max(...rs)).toBeCloseTo(6.5, 2)
  })
  it('precesses by about 6πM/p per orbit in a weak field', () => {
    const mass = 0.5, rp = 5, ra = 8.4
    const M = mass * 0.15, p = (2 * rp * ra) / (rp + ra)
    const peri = periapsisAngles(integrateGeodesic(mass, rp, ra, 4))
    const advance = peri[0] - 2 * Math.PI
    expect(advance).toBeGreaterThan(0)
    expect(advance / ((6 * Math.PI * M) / p)).toBeGreaterThan(0.85)
    expect(advance / ((6 * Math.PI * M) / p)).toBeLessThan(1.25)
  })
  it('precession grows with mass', () => {
    const advance = (mass) => periapsisAngles(integrateGeodesic(mass, 5, 8.4, 3))[0] - 2 * Math.PI
    expect(advance(2)).toBeGreaterThan(advance(0.5))
  })
})

describe('Newtonian reference', () => {
  it('is a closed ellipse between periapsis and apoapsis', () => {
    const pts = newtonianOrbit(3, 6.5, 2)
    const first = pts[0], last = pts[pts.length - 1]
    expect(Math.hypot(first[0] - last[0], first[2] - last[2])).toBeLessThan(1e-9)
    const rs = pts.map(radius)
    expect(Math.min(...rs)).toBeCloseTo(3, 6)
    expect(Math.max(...rs)).toBeCloseTo(6.5, 2)
  })
})

describe('light rays', () => {
  it('bend toward the mass, and bend more when they pass closer', () => {
    const deflection = (bScale) => {
      const pts = integrateLightRay(2, bScale)
      const dir = (a, b) => Math.atan2(b[2] - a[2], b[0] - a[0])
      const n = pts.length
      // Angle between the incoming and outgoing directions (0 for a straight line)
      const d = dir(pts[n - 2], pts[n - 1]) - dir(pts[0], pts[1])
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))
    }
    const far = deflection(3.8), near = deflection(1.3)
    expect(far).toBeGreaterThan(0)
    expect(near).toBeGreaterThan(far)
    // Far ray: close to the weak-field result 4M/b (M = 0.3, b = 3.8 · 3√3 M)
    const M = 2 * 0.15, b = 3.8 * 3 * Math.sqrt(3) * M
    expect(far / ((4 * M) / b)).toBeGreaterThan(0.8)
    expect(far / ((4 * M) / b)).toBeLessThan(1.5)
  })
})
