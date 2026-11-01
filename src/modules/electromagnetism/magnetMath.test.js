import { describe, it, expect } from 'vitest'
import { dipoleBField, totalBField, traceFieldLine, mag3, dot3, norm3 } from './magnetMath'

describe('dipole field', () => {
  it('on the axis B = 2m/r³ along the moment', () => {
    for (const r of [0.5, 1, 2, 3]) {
      const B = dipoleBField([0, r, 0])
      expect(B[1]).toBeCloseTo(2 / r ** 3, 10)
      expect(B[0]).toBeCloseTo(0, 12)
    }
  })
  it('in the equatorial plane B = −m/r³', () => {
    for (const r of [0.5, 1, 2]) {
      const B = dipoleBField([r, 0, 0])
      expect(B[1]).toBeCloseTo(-1 / r ** 3, 10)
    }
  })
})

describe('every magnet obeys ∇·B = 0', () => {
  const h = 1e-4
  const div = (type, p) => {
    let s = 0
    for (let k = 0; k < 3; k++) {
      const a = [...p], b = [...p]
      a[k] += h; b[k] -= h
      s += (totalBField(a, type)[k] - totalBField(b, type)[k]) / (2 * h)
    }
    return s
  }
  // Points well away from the sources, where the field is smooth
  const points = [[1.7, 0.9, 0.4], [-2.2, 1.4, -0.8], [0.6, -2.5, 1.9], [3, 0.2, -1.1]]
  for (const type of ['dipole', 'bar', 'solenoid', 'halbach']) {
    it(type, () => {
      for (const p of points) {
        const scale = mag3(totalBField(p, type)) / mag3(p)
        expect(Math.abs(div(type, p)) / scale).toBeLessThan(1e-3)
      }
    })
  }
})

describe('field-line tracer', () => {
  it('each step follows the local field direction and stops at the south pole', () => {
    const bFunc = (p) => totalBField(p, 'bar')
    const line = traceFieldLine([0.3, 0.85, 0], bFunc, 180, 0.09, true)
    expect(line.length).toBeGreaterThan(20)
    for (let i = 1; i < line.length; i++) {
      const step = norm3(line[i].map((v, k) => v - line[i - 1][k]))
      const mid = line[i - 1].map((v, k) => (v + line[i][k]) / 2)
      expect(dot3(step, norm3(bFunc(mid)))).toBeGreaterThan(0.98)
    }
    // Ends at the south pole (0, −0.8, 0) instead of jittering there
    const end = line[line.length - 1]
    expect(Math.hypot(end[0], end[1] + 0.8, end[2])).toBeLessThan(0.15)
    expect(line.length).toBeLessThan(180)
  })
})
