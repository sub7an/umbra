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

// ── Gravitational N-body ─────────────────────────────────────────────────────
//
// Softened Newtonian gravity: a_i = Σ_j G m_j (r_j − r_i) / (|r_j − r_i|² + ε²)^(3/2)
// with potential U = −G m_i m_j / sqrt(r² + ε²), so the force and the energy
// used below are consistent (energy is conserved for the softened system).

// Planar accelerations of bodies {x, y, m}. Returns [{ax, ay}, ...].
function planarAccelerations(bodies, G, soft) {
  const e2 = soft * soft
  return bodies.map((bi, i) => {
    let ax = 0
    let ay = 0
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue
      const dx = bodies[j].x - bi.x
      const dy = bodies[j].y - bi.y
      const f = G * bodies[j].m / Math.pow(dx * dx + dy * dy + e2, 1.5)
      ax += f * dx
      ay += f * dy
    }
    return { ax, ay }
  })
}

// One kick-drift-kick leapfrog (velocity Verlet) step, in place. Second order,
// symplectic and time-reversible: energy error stays bounded instead of drifting.
export function leapfrogStep(bodies, dt, G = 1, soft = 0) {
  const a0 = planarAccelerations(bodies, G, soft)
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    b.vx += 0.5 * dt * a0[i].ax
    b.vy += 0.5 * dt * a0[i].ay
    b.x += dt * b.vx
    b.y += dt * b.vy
  }
  const a1 = planarAccelerations(bodies, G, soft)
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    b.vx += 0.5 * dt * a1[i].ax
    b.vy += 0.5 * dt * a1[i].ay
  }
}

// Kinetic + softened potential energy of planar bodies {x, y, vx, vy, m}.
export function totalEnergy(bodies, G = 1, soft = 0) {
  let E = 0
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    E += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy)
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - b.x
      const dy = bodies[j].y - b.y
      E -= G * b.m * bodies[j].m / Math.sqrt(dx * dx + dy * dy + soft * soft)
    }
  }
  return E
}

// ── 3D RK4 integrator (the scheme the N-body scene renders with) ────────────
// pos, vel: arrays of [x, y, z]; masses: array of numbers.
export function nbodyAccel(pos, masses, G, eps) {
  return pos.map((pi, i) => {
    let ax = 0, ay = 0, az = 0
    for (let j = 0; j < pos.length; j++) {
      if (i === j) continue
      const dx = pos[j][0] - pi[0], dy = pos[j][1] - pi[1], dz = pos[j][2] - pi[2]
      const f = G * masses[j] / Math.pow(dx * dx + dy * dy + dz * dz + eps * eps, 1.5)
      ax += f * dx; ay += f * dy; az += f * dz
    }
    return [ax, ay, az]
  })
}

function vadd(a, b, s) {
  return a.map((ai, i) => [ai[0] + b[i][0] * s, ai[1] + b[i][1] * s, ai[2] + b[i][2] * s])
}

// Classical fourth-order Runge-Kutta step. Returns new { pos, vel }.
export function rk4Step(pos, vel, masses, G, eps, dt) {
  const a1 = nbodyAccel(pos, masses, G, eps)
  const p2 = vadd(pos, vel, dt / 2), v2 = vadd(vel, a1, dt / 2)
  const a2 = nbodyAccel(p2, masses, G, eps)
  const p3 = vadd(pos, v2, dt / 2), v3 = vadd(vel, a2, dt / 2)
  const a3 = nbodyAccel(p3, masses, G, eps)
  const p4 = vadd(pos, v3, dt), v4 = vadd(vel, a3, dt)
  const a4 = nbodyAccel(p4, masses, G, eps)
  return {
    pos: pos.map((p, i) => [
      p[0] + dt / 6 * (vel[i][0] + 2 * v2[i][0] + 2 * v3[i][0] + v4[i][0]),
      p[1] + dt / 6 * (vel[i][1] + 2 * v2[i][1] + 2 * v3[i][1] + v4[i][1]),
      p[2] + dt / 6 * (vel[i][2] + 2 * v2[i][2] + 2 * v3[i][2] + v4[i][2]),
    ]),
    vel: vel.map((v, i) => [
      v[0] + dt / 6 * (a1[i][0] + 2 * a2[i][0] + 2 * a3[i][0] + a4[i][0]),
      v[1] + dt / 6 * (a1[i][1] + 2 * a2[i][1] + 2 * a3[i][1] + a4[i][1]),
      v[2] + dt / 6 * (a1[i][2] + 2 * a2[i][2] + 2 * a3[i][2] + a4[i][2]),
    ]),
  }
}

// Total energy of 3D bodies in the pos/vel/masses layout used by rk4Step.
export function totalEnergy3D(pos, vel, masses, G, eps) {
  let KE = 0, PE = 0
  for (let i = 0; i < pos.length; i++) {
    const [vx, vy, vz] = vel[i]
    KE += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz)
    for (let j = i + 1; j < pos.length; j++) {
      const dx = pos[j][0] - pos[i][0], dy = pos[j][1] - pos[i][1], dz = pos[j][2] - pos[i][2]
      PE -= G * masses[i] * masses[j] / Math.sqrt(dx * dx + dy * dy + dz * dz + eps * eps)
    }
  }
  return KE + PE
}

// ── Schwarzschild characteristic radii (G = c = 1, so r = n·M) ──────────────
// Photon sphere: circular light orbit (unstable), r = 3M = 1.5 r_s.
export function photonSphereRadius(M) {
  return 3 * M
}

// Innermost stable circular orbit for massive particles, r = 6M = 3 r_s.
export function iscoRadius(M) {
  return 6 * M
}
