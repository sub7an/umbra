// Pure wave physics shared by the wave-mechanics views and the validation suite.

// Frequency of mode n on a string of length L, tension T, linear density mu (Hz).
export function stringModeFrequency(n, L, T, mu) {
  return (n / (2 * L)) * Math.sqrt(T / mu)
}

function sinc(x) {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x
}

// Far-field double-slit intensity, normalised to 1 on axis:
// cos²(π d sinθ / λ) · sinc²(π a sinθ / λ)
export function doubleSlitIntensity(theta, d, a, lambda) {
  const s = Math.sin(theta)
  const c = Math.cos((Math.PI * d * s) / lambda)
  const e = sinc((Math.PI * a * s) / lambda)
  return c * c * e * e
}

// Angular frequency of mode (m, n) of a square membrane of side L and wave speed c:
// ω = c π √(m² + n²) / L
export function membraneModeOmega(m, n, c = 1, L = 1) {
  return (c * Math.PI * Math.sqrt(m * m + n * n)) / L
}

// Spatial shape of mode (m, n) at (x, y) in [0, 1]²: sin(mπx) sin(nπy)
export function membraneModeShape(m, n, x, y) {
  return Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y)
}

// One explicit second-order (leapfrog) step of the 2D wave equation on an nx×ny grid:
// out = damp · (2u − uPrev + (c dt/dx)² · ∇²u). Edge cells are held at zero
// (reflecting). opts.barrier (Uint8Array, 1 = solid) pins cells to zero;
// opts.damp (default 1) is a per-step amplitude factor.
export function waveStep(u, uPrev, out, nx, ny, c, dt, dx, opts = {}) {
  const { damp = 1, barrier = null } = opts
  const c2 = (c * dt / dx) ** 2
  for (let i = 0; i < nx; i++) { out[i] = 0; out[(ny - 1) * nx + i] = 0 }
  for (let j = 0; j < ny; j++) { out[j * nx] = 0; out[j * nx + nx - 1] = 0 }
  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i
      if (barrier && barrier[k]) { out[k] = 0; continue }
      out[k] = damp * (2 * u[k] - uPrev[k] +
        c2 * (u[k - 1] + u[k + 1] + u[k - nx] + u[k + nx] - 4 * u[k]))
    }
  }
}

// Discrete energy of the leapfrog scheme from consecutive fields (u newer than uPrev):
// ½ [ dx² Σ((u − uPrev)/dt)² + c² Σ_edges Δu·ΔuPrev ]. Conserved exactly for the
// undamped scheme with zero edges.
export function waveEnergy(u, uPrev, nx, ny, c, dt, dx) {
  let kin = 0
  for (let k = 0; k < nx * ny; k++) {
    const v = (u[k] - uPrev[k]) / dt
    kin += v * v
  }
  let pot = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (i + 1 < nx) pot += (u[k + 1] - u[k]) * (uPrev[k + 1] - uPrev[k])
      if (j + 1 < ny) pot += (u[k + nx] - u[k]) * (uPrev[k + nx] - uPrev[k])
    }
  }
  return 0.5 * (dx * dx * kin + c * c * pot)
}
