import { describe, it, expect } from 'vitest'
import { mulberry32, integrate } from './helpers.js'
import {
  maxwellBoltzmannPdf, meanSpeed, binaryEntropy, idealGasPressure, carnotEfficiency,
  isingEnergy, isingMagnetisation, isingSweep, entropyMixing,
} from '../../src/modules/thermodynamics/thermoMath.js'

function randomGrid(L, rng) {
  const g = new Int8Array(L * L)
  for (let i = 0; i < g.length; i++) g[i] = rng() < 0.5 ? 1 : -1
  return g
}

function runFrom(grid, L, beta, sweeps, rng) {
  for (let s = 0; s < sweeps; s++) isingSweep(grid, L, beta, rng)
  return Math.abs(isingMagnetisation(grid, L))
}

describe('thermodynamics validation', () => {
  it('[gas] analytic: MB pdf integrates to 1', () => {
    const area = integrate((v) => maxwellBoltzmannPdf(v, 1, 1), 0, 20)
    expect(Math.abs(area - 1)).toBeLessThan(1e-6)
  })

  it('[gas] analytic: mean speed √(8kT/πm)', () => {
    const num = integrate((v) => v * maxwellBoltzmannPdf(v, 1, 1), 0, 20)
    expect(Math.abs(num - meanSpeed(1, 1))).toBeLessThan(1e-6)
    expect(meanSpeed(1, 1)).toBeCloseTo(Math.sqrt(8 / Math.PI), 12)
  })

  it('[gas] analytic: ideal gas pressure NkT/V', () => {
    expect(idealGasPressure(100, 2, 50)).toBeCloseTo(4, 12)
  })

  it('[engine] analytic: Carnot η', () => {
    expect(carnotEfficiency(300, 500)).toBeCloseTo(0.4, 12)
  })

  it('[ising] analytic: ground-state energy', () => {
    const L = 16
    const g = new Int8Array(L * L).fill(1)
    expect(isingEnergy(g, L)).toBe(-2 * L * L)
    expect(isingMagnetisation(g, L)).toBe(1)
  })

  it('[ising] invariant: low-T order', () => {
    const L = 16
    const g = new Int8Array(L * L).fill(1)
    expect(runFrom(g, L, 1.0, 400, mulberry32(7))).toBeGreaterThan(0.9)
  })

  it('[ising] invariant: high-T disorder', () => {
    const L = 32
    const ms = []
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed)
      ms.push(runFrom(randomGrid(L, rng), L, 0.2, 400, rng))
    }
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length
    expect(mean).toBeLessThan(0.15)
  })

  it('[entropy] analytic: mixing entropy ln C(n, k)', () => {
    expect(entropyMixing(2, 2)).toBeCloseTo(Math.log(6), 10)
    expect(entropyMixing(50, 50)).toBeCloseTo(Math.log(1.00891344545564e29), 8)
    expect(entropyMixing(0, 10)).toBeCloseTo(0, 12)
  })

  it('[entropy] analytic: binary entropy', () => {
    expect(Math.abs(binaryEntropy(0.5) - Math.LN2)).toBeLessThan(1e-12)
    expect(binaryEntropy(0)).toBeCloseTo(0, 12)
    expect(binaryEntropy(1)).toBeCloseTo(0, 12)
    expect(Math.abs(binaryEntropy(0.3) - binaryEntropy(0.7))).toBeLessThan(1e-12)
    const n = 10000, k = 3000
    expect(Math.abs(binaryEntropy(k / n) - entropyMixing(k, n - k) / n)).toBeLessThan(1e-2)
  })
})
