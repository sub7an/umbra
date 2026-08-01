// ── Galaxy Rotation Curves ──────────────────────────────────────────────────
//
// The "missing mass" problem: galaxies rotate as if they contain far more mass
// than visible matter can account for. The discrepancy is enormous at large r.
// Dark matter is the leading inference, not an observation.

// Keplerian prediction: v = sqrt(G*M(r)/r) where M(r) = visible enclosed mass.
// Visible mass is modelled as a Plummer sphere (bulge-dominated profile):
//   M(r) = M_vis * r³ / (r² + a²)^(3/2)
// G = 1, M_vis = 1, a = 0.8 in normalized units.
// At large r: M(r) → M_vis (constant), so v → 1/sqrt(r) — the Keplerian drop-off.
export function keplerianVelocity(r, M_vis = 1.0, a = 0.8) {
  if (r <= 0) return 0
  const M_enclosed = M_vis * Math.pow(r, 3) / Math.pow(r * r + a * a, 1.5)
  return Math.sqrt(M_enclosed / r)
}

// Observed rotation velocity — empirical approximation to actual galactic data.
// Real galaxy rotation curves are roughly FLAT far beyond the visible disk.
// This is NOT derived from a known mechanism. It is a fit to observations.
// Freeman-disk-inspired form: v_obs ≈ v_flat * sqrt(1 − exp(−r / r_s))
// v_flat ≈ 0.85 in normalized units (~220 km/s Milky Way scale), r_s = 0.7.
export function observedRotationVelocity(r, vFlat = 0.85, rs = 0.7) {
  if (r <= 0) return 0
  return vFlat * Math.sqrt(1 - Math.exp(-r / rs))
}

// Signed discrepancy: positive means observed is faster than Keplerian predicts.
// Large positive values at r > 2 define the "missing mass" problem.
// Inferred invisible mass: M_dark(r) ∝ r * (v_obs² − v_kep²).
// What makes up that mass is genuinely unknown.
export function rotationDiscrepancy(r) {
  return observedRotationVelocity(r) - keplerianVelocity(r)
}

// Inferred dark matter fraction at radius r.
// If total mass = v_obs² * r and visible mass = v_kep² * r, then
// M_dark / M_total = 1 − (v_kep / v_obs)².
export function darkMatterFraction(r) {
  if (r <= 0) return 0
  const vk = keplerianVelocity(r)
  const vo = observedRotationVelocity(r)
  if (vo < 0.001) return 0
  return Math.max(0, 1 - (vk / vo) ** 2)
}

// ── Hubble Expansion ─────────────────────────────────────────────────────────
//
// Recession velocity as a direct observation: v = H0 × d.
// H0 ≈ 70 km/s/Mpc (Planck 2018) or ~73 km/s/Mpc (local distance ladder).
// The ~5σ tension between these two measurements is unresolved as of 2024.
// WHY the expansion is accelerating is attributed to a "cosmological constant"
// or "dark energy", but the underlying mechanism is completely unknown.

// v = H0 * d — Hubble's law. d in comoving Mpc, H0 in km/s/Mpc.
// Here both are dimensionless (slider units).
export function hubbleExpansion(distance, hubbleConstant) {
  return hubbleConstant * distance
}

// Convert dimensionless H0 slider (1.0 = nominal) to km/s/Mpc equivalent.
export function toHubbleUnits(h0Slider) {
  return Math.round(h0Slider * 70)
}

// Exponential scale factor for expansion animation.
// a(t) = exp(H0 * t * 0.08) — de Sitter–like growth, slowed for visual clarity.
export function scaleFactor(t, H0) {
  return Math.exp(H0 * t * 0.08)
}
