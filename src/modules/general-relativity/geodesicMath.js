// Pure orbit maths for the Geodesics view (no rendering), so it can be tested.
// Geometric units with G = c = 1; the scene uses M = mass · 0.15.

export const SIZE = 10

// ─── Physics helpers ────────────────────────────────────────────────────────

export function warpY(x, z, mass) {
  const r = Math.sqrt(x * x + z * z)
  return -mass / (r + 0.6)
}

// Massive-particle geodesic (Schwarzschild orbit equation, u = 1/r):
//     d²u/dφ² = M/L² − u + 3Mu²
// The 3Mu² term is GR's correction; without it the orbit is a closed ellipse.
// Orbits are specified by periapsis/apoapsis. Equal effective potential
// (1 − 2M/r)(1 + L²/r²) at both turning points fixes L exactly; the orbit
// starts at periapsis with du/dφ = 0 and is integrated with RK4 in φ.
export const ORBIT_DPHI = 0.01
export function orbitL(mass, rp, ra) {
  const M = mass * 0.15
  const num = 2 * M * (1 / rp - 1 / ra)
  const den = (1 - 2 * M / rp) / (rp * rp) - (1 - 2 * M / ra) / (ra * ra)
  return Math.sqrt(Math.max(num / den, 1e-6))
}
export function integrateGeodesic(mass, rp, ra, turns = 6) {
  const M = mass * 0.15
  const L = orbitL(mass, rp, ra)
  const k = M / (L * L)
  const f = (u) => k - u + 3 * M * u * u
  let u = 1 / rp, w = 0
  const h = ORBIT_DPHI
  const pts = []
  const n = Math.round((turns * Math.PI * 2) / h)
  for (let i = 0; i < n; i++) {
    const phi = i * h
    if (u <= 0 || 1 / u < M * 2.05) break        // plunged through the horizon
    const r = 1 / u
    if (r > SIZE - 0.8) break
    const x = r * Math.cos(phi), z = r * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
    const k1u = w, k1w = f(u)
    const k2u = w + 0.5 * h * k1w, k2w = f(u + 0.5 * h * k1u)
    const k3u = w + 0.5 * h * k2w, k3w = f(u + 0.5 * h * k2u)
    const k4u = w + h * k3w, k4w = f(u + h * k3u)
    u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u)
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)
  }
  return pts
}

// Null geodesic (light): d²u/dφ² = 3Mu² - u
export function integrateLightRay(mass, bScale, phiOffset = 0) {
  const M  = mass * 0.15
  const bCrit = 5.196 * M          // critical impact parameter
  const b  = bCrit * bScale         // bScale > 1 → escapes, < 1 → captured

  const rStart = 14
  const u0     = 1 / rStart
  const disc   = 1 / (b * b) - u0 * u0 * (1 - 2 * M * u0)
  if (disc < 0) return []
  const dudphi0 = Math.sqrt(disc)

  let u = u0, uPrev = u0 - dudphi0 * 0.004
  const pts = []
  let peaked = false

  for (let i = 0; i < 3500; i++) {
    const phi = i * 0.004
    const d2u = 3 * M * u * u - u
    const uNext = 2 * u - uPrev + d2u * 0.000016
    uPrev = u; u = uNext

    if (u <= 0 || 1 / u < M * 2.1) break
    const r = Math.min(1 / u, SIZE + 4)
    const rawX = r * Math.cos(phi), rawZ = r * Math.sin(phi)
    // rotate around Y by phiOffset
    const x = rawX * Math.cos(phiOffset) - rawZ * Math.sin(phiOffset)
    const z = rawX * Math.sin(phiOffset) + rawZ * Math.cos(phiOffset)
    pts.push([x, warpY(x, z, mass) + 0.06, z])

    if (r < rStart - 1 && !peaked) peaked = true
    if (peaked && r > rStart - 0.5) break
  }
  return pts
}

// Newtonian reference: the closed ellipse with the same periapsis/apoapsis
export function newtonianOrbit(rp, ra, mass, nPts = 360) {
  const p = (2 * rp * ra) / (rp + ra), e = (ra - rp) / (ra + rp)
  const pts = []
  for (let i = 0; i <= nPts; i++) {
    const phi = (i / nPts) * Math.PI * 2
    const r = p / (1 + e * Math.cos(phi))
    const x = r * Math.cos(phi), z = r * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
  }
  return pts
}
