// Special Relativity: pure Lorentz-transform functions
// v is always expressed as β = v/c, a fraction in [0, 1)
// All formulas verified against standard SR derivations.

/**
 * Lorentz factor  γ = 1 / √(1 − β²)
 * Approaches infinity as β → 1; equals 1 when β = 0 (rest frame).
 */
export function lorentzFactor(v) {
  const beta = clampBeta(v)
  return 1 / Math.sqrt(1 - beta * beta)
}

/**
 * Time dilation  t′ = γ · t₀
 * A moving clock recording proper time t₀ appears to tick
 * t′ seconds in the lab frame — always t′ ≥ t₀.
 */
export function dilatedTime(t0, v) {
  return lorentzFactor(v) * t0
}

/**
 * Length contraction  L′ = L₀ / γ
 * A rod of proper length L₀ appears contracted to L′ in the
 * lab frame when moving at speed β along its own axis.
 */
export function contractedLength(L0, v) {
  return L0 / lorentzFactor(v)
}

/**
 * Relativistic velocity addition  u′ = (u + v) / (1 + u·v/c²)
 * Combines two speeds expressed as fractions of c;
 * result stays below 1 by construction.
 */
export function addVelocities(u, v) {
  const bu = clampBeta(u)
  const bv = clampBeta(v)
  return (bu + bv) / (1 + bu * bv)
}

/**
 * Determines whether a spacetime event at (x, t) is timelike,
 * lightlike, or spacelike relative to the origin.
 * (Natural units: c = 1, so the light cone is |t| = |x|.)
 *
 * Returns 'timelike' | 'lightlike' | 'spacelike'
 */
export function coneRegion(x, t) {
  const s2 = t * t - x * x // spacetime interval squared
  if (Math.abs(s2) < 1e-6) return 'lightlike'
  return s2 > 0 ? 'timelike' : 'spacelike'
}

// Clamp β strictly below 1 to avoid division by zero
function clampBeta(v) {
  return Math.min(0.9999, Math.max(0, v))
}
