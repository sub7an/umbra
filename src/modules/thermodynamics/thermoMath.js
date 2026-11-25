// Pure thermodynamics physics. No React, no three.js, no DOM.
// Units: k defaults to 1 (reduced units), matching the simulations.

// Slider T (0.2–3) → hot reservoir temperature, with T_C fixed at 1.
// Kept modest so the Carnot cycle stays a readable shape on linear p–V axes.
export function hotReservoirT(T) {
  return 1 + T * 0.5
}

// 3D Maxwell–Boltzmann speed pdf, f(v) = 4π (m/2πkT)^(3/2) v² exp(−mv²/2kT).
// With σ² = kT/m this equals √(2/π) v² / σ³ · exp(−v²/2σ²).
export function maxwellBoltzmannPdf(v, m, T, k = 1) {
  const s2 = (k * T) / m
  return Math.sqrt(2 / Math.PI) * (v * v) / Math.pow(s2, 1.5) * Math.exp(-(v * v) / (2 * s2))
}

// Mean speed √(8kT/πm).
export function meanSpeed(m, T, k = 1) {
  return Math.sqrt((8 * k * T) / (Math.PI * m))
}

// Ideal gas law: p = N k T / V.
export function idealGasPressure(N, T, V, k = 1) {
  return (N * k * T) / V
}

// Carnot efficiency η = 1 − Tc/Th.
export function carnotEfficiency(Tc, Th) {
  return 1 - Tc / Th
}

// Total Ising energy E = −J Σ_<ij> s_i s_j on an L×L periodic lattice
// (each bond counted once: right and down neighbours).
export function isingEnergy(grid, L, J = 1) {
  let sum = 0
  for (let row = 0; row < L; row++) {
    for (let col = 0; col < L; col++) {
      const s = grid[row * L + col]
      const right = grid[row * L + (col < L - 1 ? col + 1 : 0)]
      const down = grid[(row < L - 1 ? row + 1 : 0) * L + col]
      sum += s * (right + down)
    }
  }
  return -J * sum
}

// Magnetisation per spin, in [−1, 1].
export function isingMagnetisation(grid, L) {
  const N = L * L
  let sum = 0
  for (let i = 0; i < N; i++) sum += grid[i]
  return sum / N
}

// One Metropolis sweep (L² single-spin-flip attempts at random sites), in
// place. J = k = 1; beta = 1/T. rng is a () => [0, 1) source.
export function isingSweep(grid, L, beta, rng) {
  const N = L * L
  for (let k = 0; k < N; k++) {
    const i = (rng() * N) | 0
    const row = (i / L) | 0
    const col = i % L
    const sum = grid[(row > 0 ? row - 1 : L - 1) * L + col] +
                grid[(row < L - 1 ? row + 1 : 0) * L + col] +
                grid[row * L + (col > 0 ? col - 1 : L - 1)] +
                grid[row * L + (col < L - 1 ? col + 1 : 0)]
    const dE = 2 * grid[i] * sum
    if (dE < 0 || rng() < Math.exp(-dE * beta)) grid[i] *= -1
  }
}

// ln Γ(x), Lanczos approximation (g = 7, n = 9), x > 0.
function logGamma(x) {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

// Mixing entropy S/k = ln C(nA+nB, nA) via log-gamma.
export function entropyMixing(nA, nB) {
  return logGamma(nA + nB + 1) - logGamma(nA + 1) - logGamma(nB + 1)
}

// Binary entropy (nats) of a two-way split f : 1 − f. This is the
// large-N (Stirling) limit of entropyMixing per particle.
export function binaryEntropy(f) {
  if (f <= 0 || f >= 1) return 0
  return -(f * Math.log(f) + (1 - f) * Math.log(1 - f))
}
