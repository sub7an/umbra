// ── Bloch Sphere ─────────────────────────────────────────────────────────────

// |ψ⟩ = cos(θ/2)|0⟩ + e^(iφ)sin(θ/2)|1⟩
// Bloch vector components on the unit sphere:
//   x = sin(θ)cos(φ),  y = sin(θ)sin(φ),  z = cos(θ)
export function blochCoordinates(theta, phi) {
  return {
    x: Math.sin(theta) * Math.cos(phi),
    y: Math.sin(theta) * Math.sin(phi),
    z: Math.cos(theta),
  }
}

// P(|0⟩) = cos²(θ/2)
export function prob0(theta) {
  return Math.cos(theta / 2) ** 2
}

// P(|1⟩) = sin²(θ/2)
export function prob1(theta) {
  return Math.sin(theta / 2) ** 2
}

// ── Infinite Square Well ──────────────────────────────────────────────────────

// ψ_n(x) = √(2/L) · sin(nπx/L),  x ∈ [0, L]
export function particleInBoxWavefunction(n, x, L = 1) {
  if (x <= 0 || x >= L) return 0
  return Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L)
}

// E_n = n²π²ℏ²/(2mL²)
// Natural units (ℏ=1, 2m=1, L=1): E_n = n²π²/2
export function particleInBoxEnergy(n, L = 1) {
  return (n * n * Math.PI * Math.PI) / (2 * L * L)
}

// ── Double Slit ───────────────────────────────────────────────────────────────

// Fraunhofer intensity at screen position y:
// I(y) = I₀ · cos²(πdy/(λD))
// d = slit separation, λ = wavelength, D = screen distance
export function interferenceIntensity(d, lambda, y, D = 4) {
  const phase = (Math.PI * d * y) / (lambda * D)
  return Math.cos(phase) ** 2
}

// Rejection-sample a screen hit position from the interference pattern.
// screenHalfHeight: half-height of the detector screen in scene units.
export function sampleInterference(d, lambda, screenHalfHeight = 3.5, D = 4) {
  let y, accept
  let tries = 0
  do {
    y = (Math.random() - 0.5) * 2 * screenHalfHeight
    accept = interferenceIntensity(d, lambda, y, D)
    tries++
  } while (Math.random() > accept && tries < 200)
  return y
}

// Sample a "which-path measured" hit: Gaussian blob centred on each slit image.
// With measurement, the particle went through one slit → single-slit diffraction
// (approximated here as a Gaussian for simplicity).
export function sampleMeasured(d, sigma = 0.9) {
  const slit = Math.random() < 0.5 ? -1 : 1
  const center = slit * (d / 2)
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return center + sigma * z
}
