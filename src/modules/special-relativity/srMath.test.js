import { describe, it, expect } from 'vitest'
import { lorentzFactor, dilatedTime, contractedLength, addVelocities, coneRegion } from './srMath'

describe('Lorentz factor', () => {
  it('is 1 at rest and matches textbook values', () => {
    expect(lorentzFactor(0)).toBe(1)
    expect(lorentzFactor(0.6)).toBeCloseTo(1.25, 10)
    expect(lorentzFactor(0.8)).toBeCloseTo(5 / 3, 10)
  })
  it('stays finite at β = 1', () => {
    expect(Number.isFinite(lorentzFactor(1))).toBe(true)
  })
})

describe('time dilation and length contraction', () => {
  it('moving clocks run slow by γ', () => {
    expect(dilatedTime(1, 0.8)).toBeCloseTo(5 / 3, 10)
  })
  it('moving rods shrink by 1/γ', () => {
    expect(contractedLength(3, 0.8)).toBeCloseTo(1.8, 10)
  })
})

describe('velocity addition', () => {
  it('0.5c + 0.5c = 0.8c', () => {
    expect(addVelocities(0.5, 0.5)).toBeCloseTo(0.8, 10)
  })
  it('never reaches c', () => {
    expect(addVelocities(0.99, 0.99)).toBeLessThan(1)
  })
  it('opposite velocities cancel', () => {
    expect(addVelocities(-0.5, 0.5)).toBeCloseTo(0, 10)
  })
})

describe('light cone regions', () => {
  it('classifies events relative to the origin', () => {
    expect(coneRegion(0, 1)).toBe('timelike')
    expect(coneRegion(1, 0)).toBe('spacelike')
    expect(coneRegion(1, 1)).toBe('lightlike')
    expect(coneRegion(-2, -2)).toBe('lightlike')
  })
})
