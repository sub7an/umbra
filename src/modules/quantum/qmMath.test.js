import { describe, it, expect } from 'vitest'
import { blochCoordinates, prob0, prob1, particleInBoxWavefunction as psi, particleInBoxEnergy, interferenceIntensity } from './qmMath'

// Midpoint-rule integral over [0, 1]
function integrate(f, n = 20000) {
  let s = 0
  for (let i = 0; i < n; i++) s += f((i + 0.5) / n)
  return s / n
}

describe('particle in a box', () => {
  it('every state is normalised: ∫|ψₙ|² dx = 1', () => {
    for (let n = 1; n <= 6; n++) expect(integrate((x) => psi(n, x) ** 2)).toBeCloseTo(1, 4)
  })
  it('different states are orthogonal', () => {
    expect(integrate((x) => psi(1, x) * psi(2, x))).toBeCloseTo(0, 6)
    expect(integrate((x) => psi(2, x) * psi(5, x))).toBeCloseTo(0, 6)
  })
  it('ψₙ has n − 1 nodes inside the box', () => {
    for (let n = 1; n <= 6; n++) {
      let crossings = 0
      let prev = psi(n, 0.0005)
      for (let i = 1; i < 2000; i++) {
        const cur = psi(n, (i + 0.5) / 2000)
        if (Math.sign(cur) !== Math.sign(prev)) crossings++
        prev = cur
      }
      expect(crossings).toBe(n - 1)
    }
  })
  it('is zero at the walls', () => {
    expect(psi(3, 0)).toBe(0)
    expect(psi(3, 1)).toBe(0)
  })
  it('energies scale as n²', () => {
    const E1 = particleInBoxEnergy(1)
    for (let n = 2; n <= 6; n++) expect(particleInBoxEnergy(n) / E1).toBeCloseTo(n * n, 10)
  })
})

describe('Bloch sphere', () => {
  it('pure states lie on the unit sphere', () => {
    for (const [t, p] of [[0, 0], [1.05, 0.79], [Math.PI / 2, 2], [Math.PI, 5]]) {
      const { x, y, z } = blochCoordinates(t, p)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10)
    }
  })
  it('Born-rule probabilities add to 1 and match cos²(θ/2)', () => {
    for (const t of [0, 0.4, 1.05, Math.PI / 2, 2.8, Math.PI]) {
      expect(prob0(t) + prob1(t)).toBeCloseTo(1, 10)
      expect(prob0(t)).toBeCloseTo(Math.cos(t / 2) ** 2, 10)
    }
    expect(prob0(Math.PI / 2)).toBeCloseTo(0.5, 10)
  })
})

describe('two-slit interference', () => {
  const d = 1, lambda = 0.6, D = 4
  it('is brightest in the centre', () => {
    expect(interferenceIntensity(d, lambda, 0, D)).toBeCloseTo(1, 10)
  })
  it('is dark half a fringe out and bright again one fringe out (Δy = λD/d)', () => {
    const dy = (lambda * D) / d
    expect(interferenceIntensity(d, lambda, dy / 2, D)).toBeCloseTo(0, 10)
    expect(interferenceIntensity(d, lambda, dy, D)).toBeCloseTo(1, 10)
  })
})
