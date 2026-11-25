import { describe, it, expect } from 'vitest'
import { BKT, REVIEW_DAYS, bktUpdate, nextReview } from './mastery'

const DAY = 86400000

describe('bktUpdate', () => {
  it('correct, guess 0.2 from prior 0.2', () => {
    expect(Math.abs(bktUpdate(0.2, true, 0.2) - 0.6)).toBeLessThan(1e-4)
  })
  it('wrong, guess 0.2 from prior 0.2', () => {
    expect(Math.abs(bktUpdate(0.2, false, 0.2) - 0.1758)).toBeLessThan(1e-4)
  })
  it('correct, guess 0.05 from 0.6', () => {
    expect(Math.abs(bktUpdate(0.6, true, 0.05) - 0.9696)).toBeLessThan(1e-4)
  })
  it('matches the SQL vector: numeric, prior 0.2, correct', () => {
    expect(Math.abs(bktUpdate(BKT.prior, true, BKT.guess.numeric) - 0.8455)).toBeLessThan(1e-4)
  })
})

describe('nextReview', () => {
  const now = new Date('2026-12-01T09:00:00Z')
  it('schedules +1 day once mastered', () => {
    const r = nextReview(0, true, 0.96, now)
    expect(r.at.getTime()).toBe(now.getTime() + DAY)
    expect(r.step).toBe(1)
  })
  it('has no date below the mastery threshold', () => {
    expect(nextReview(0, true, 0.9, now).at).toBeNull()
  })
  it('wrong answer steps back one, floor 0', () => {
    expect(nextReview(2, false, 0.97, now).step).toBe(1)
    expect(nextReview(0, false, 0.97, now).step).toBe(0)
  })
  it('correct answer caps at step 4', () => {
    expect(nextReview(4, true, 0.99, now).step).toBe(4)
    expect(nextReview(4, true, 0.99, now).at.getTime()).toBe(now.getTime() + REVIEW_DAYS[4] * DAY)
  })
})
