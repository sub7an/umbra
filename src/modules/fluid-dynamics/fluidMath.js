// Pure fluid-dynamics maths shared by the SPH, streamlines and vortex views.

// ─── SPH constants (3D dam break) ───────────────────────────────────────────
export const SPH_H = 0.9 // smoothing radius
export const SPH_MASS = 1.0
export const SPH_RHO0 = 14.0 // rest density
export const SPH_K_P = 90.0 // pressure stiffness
export const SPH_MU = 0.16 // viscosity
export const SPH_BOUNDS = { xmin: -5, xmax: 5, ymin: -5, ymax: 5, zmin: -3.5, zmax: 3.5 }
export const SPH_DAMP = 0.38
export const SPH_MAX_SPEED = 24

// Cubic spline kernel in 2D, support radius 2h, normalised so the integral over the plane is 1.
// Validated reference kernel; the 3D view uses the Müller kernels below.
export function cubicSplineKernel2D(r, h) {
  const q = r / h
  const sigma = 10 / (7 * Math.PI * h * h)
  if (q < 1) return sigma * (1 - 1.5 * q * q + 0.75 * q * q * q)
  if (q < 2) return sigma * 0.25 * (2 - q) ** 3
  return 0
}

// Müller 2003 kernels (3D), as used by the SPH view.
const POLY6_C = 315.0 / (64.0 * Math.PI * Math.pow(SPH_H, 9))
const SPIKY_C = 45.0 / (Math.PI * Math.pow(SPH_H, 6))
const VISC_C = 45.0 / (Math.PI * Math.pow(SPH_H, 6))
const H2 = SPH_H * SPH_H

// Density kernel, takes the squared distance.
export function poly6Kernel3D(r2) {
  if (r2 >= H2) return 0
  const d = H2 - r2
  return POLY6_C * d * d * d
}

// Radial derivative dW/dr of the spiky kernel (negative: repulsive push).
export function spikyGradient3D(r) {
  if (r >= SPH_H || r < 1e-5) return 0
  const d = SPH_H - r
  return -SPIKY_C * d * d
}

// Laplacian of the viscosity kernel.
export function viscosityLaplacian3D(r) {
  if (r >= SPH_H) return 0
  return VISC_C * (SPH_H - r)
}

// Initial dam-break block. pos and vel are flat xyz arrays.
export function initSphParticles(rng, cols = 6, rows = 6, depth = 6) {
  const n = cols * rows * depth
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  const sX = 1.8 / Math.max(cols - 1, 1)
  const sY = 4.2 / Math.max(rows - 1, 1)
  const sZ = 3.0 / Math.max(depth - 1, 1)
  let k = 0
  for (let d = 0; d < depth; d++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pos[k * 3] = -4.8 + c * sX + (rng() - 0.5) * 0.05
        pos[k * 3 + 1] = -4.8 + r * sY + (rng() - 0.5) * 0.05
        pos[k * 3 + 2] = -1.5 + d * sZ + (rng() - 0.5) * 0.05
        vel[k * 3] = 0.4 + rng() * 0.6 // initial push (+X = dam break)
        k++
      }
    }
  }
  return { pos, vel, n }
}

// One SPH substep: density, pressure + viscosity forces, integrate, wall bounce.
// particles = { pos, vel, n }; params = { g, dt }. Mutates pos and vel in place.
// The step is deterministic; rng is accepted so callers inject randomness uniformly (unused here).
// eslint-disable-next-line no-unused-vars
export function sphStep(particles, params, rng) {
  const { pos, vel, n: N } = particles
  const { g, dt } = params
  const MASS = SPH_MASS
  const { xmin, xmax, ymin, ymax, zmin, zmax } = SPH_BOUNDS

  const rho = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const xi = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2]
    for (let j = 0; j < N; j++) {
      const dx = pos[j*3]-xi, dy = pos[j*3+1]-yi, dz = pos[j*3+2]-zi
      rho[i] += MASS * poly6Kernel3D(dx*dx + dy*dy + dz*dz)
    }
  }

  const ax = new Float32Array(N)
  const ay = new Float32Array(N)
  const az = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    ay[i] = -g
    const pi = Math.max(SPH_K_P * (rho[i] - SPH_RHO0), 0)
    const xi = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2]
    const rhoi = Math.max(rho[i], 0.01)
    for (let j = 0; j < N; j++) {
      if (j === i) continue
      const dx = pos[j*3]-xi, dy = pos[j*3+1]-yi, dz = pos[j*3+2]-zi
      const r2 = dx*dx + dy*dy + dz*dz
      if (r2 >= H2 || r2 < 1e-8) continue
      const r = Math.sqrt(r2)
      const rhoj = Math.max(rho[j], 0.01)
      const pj = Math.max(SPH_K_P * (rho[j] - SPH_RHO0), 0)
      // Pressure (SPH symmetric form)
      const gW = spikyGradient3D(r) / r
      const pFac = MASS * (pi/(rhoi*rhoi) + pj/(rhoj*rhoj)) * gW
      ax[i] += pFac * dx; ay[i] += pFac * dy; az[i] += pFac * dz
      // Viscosity
      const vFac = SPH_MU * MASS * viscosityLaplacian3D(r) / rhoj
      ax[i] += vFac * (vel[j*3]   - vel[i*3])
      ay[i] += vFac * (vel[j*3+1] - vel[i*3+1])
      az[i] += vFac * (vel[j*3+2] - vel[i*3+2])
    }
  }

  for (let i = 0; i < N; i++) {
    vel[i*3]   += ax[i] * dt
    vel[i*3+1] += ay[i] * dt
    vel[i*3+2] += az[i] * dt
    const sp = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2)
    if (sp > SPH_MAX_SPEED) { const f = SPH_MAX_SPEED/sp; vel[i*3]*=f; vel[i*3+1]*=f; vel[i*3+2]*=f }
    pos[i*3]   += vel[i*3]   * dt
    pos[i*3+1] += vel[i*3+1] * dt
    pos[i*3+2] += vel[i*3+2] * dt
    if (pos[i*3]   < xmin) { pos[i*3]   = xmin; vel[i*3]   =  Math.abs(vel[i*3])   * SPH_DAMP }
    if (pos[i*3]   > xmax) { pos[i*3]   = xmax; vel[i*3]   = -Math.abs(vel[i*3])   * SPH_DAMP }
    if (pos[i*3+1] < ymin) { pos[i*3+1] = ymin; vel[i*3+1] =  Math.abs(vel[i*3+1]) * SPH_DAMP }
    if (pos[i*3+1] > ymax) { pos[i*3+1] = ymax; vel[i*3+1] = -Math.abs(vel[i*3+1]) * SPH_DAMP }
    if (pos[i*3+2] < zmin) { pos[i*3+2] = zmin; vel[i*3+2] =  Math.abs(vel[i*3+2]) * SPH_DAMP }
    if (pos[i*3+2] > zmax) { pos[i*3+2] = zmax; vel[i*3+2] = -Math.abs(vel[i*3+2]) * SPH_DAMP }
  }
}

// ─── Potential flow past a cylinder ─────────────────────────────────────────
// Velocity [vx, vy] of uniform flow U past a cylinder of radius R; zero inside.
export function cylinderFlowVelocity(x, y, U, R) {
  const r2 = x * x + y * y
  if (r2 <= R * R) return [0, 0]
  const r4 = r2 * r2
  return [
    U * (1 - R * R * (x * x - y * y) / r4),
    -U * R * R * 2 * x * y / r4,
  ]
}

// Vortex shedding frequency f = St·U/D.
export function sheddingFrequency(U, D, St = 0.2) {
  return St * U / D
}
