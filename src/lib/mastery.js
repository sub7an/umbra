// Bayesian Knowledge Tracing. The SQL twin lives in
// supabase/migrations/20261201000300_mastery.sql; both are checked against the
// same vectors (see mastery.test.js and supabase/tests/mastery_test.sql).
export const BKT = {
  prior: 0.2,
  learn: 0.15,
  slip: 0.1,
  // guess keyed by the attempted part's answer_type
  guess: { choice: 0.2, numeric: 0.05, expression: 0.05, order: 0.2 },
  hintGuess: 0.5,
  mastered: 0.95,
}

export const REVIEW_DAYS = [1, 3, 7, 16, 35]

export function bktUpdate(p, correct, guess, slip = BKT.slip, learn = BKT.learn) {
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess))
  return posterior + (1 - posterior) * learn
}

// The interval used is the one for the step the answer was given at (correct)
// or the step fallen back to (wrong). `at` is null until p >= mastered.
export function nextReview(step, correct, p, now) {
  const max = REVIEW_DAYS.length - 1
  const newStep = correct ? Math.min(step + 1, max) : Math.max(step - 1, 0)
  if (p < BKT.mastered) return { step: newStep, at: null }
  const days = REVIEW_DAYS[correct ? step : newStep]
  return { step: newStep, at: new Date(now.getTime() + days * 86400000) }
}
