// Pure acoustics physics used by AcousticModule. No React or three.js here.

// First `count` resonant frequencies of a pipe with fundamental f0.
// Open (both ends): f0·n. Closed (one end): odd harmonics only, f0·(2n-1).
export function pipeHarmonics(f0, end, count) {
  const out = []
  for (let i = 1; i <= count; i++) out.push(end === 'closed' ? f0 * (2 * i - 1) : f0 * i)
  return out
}

// Harmonic series of an ideal string: f0·n.
export function stringHarmonics(f0, count) {
  const out = []
  for (let n = 1; n <= count; n++) out.push(f0 * n)
  return out
}

// Standing-wave shape of string mode n along x in [0, 1]: sin(nπx). Nodes at k/n.
// (The harmonics shader evaluates the same expression in GLSL.)
export function stringModeShape(n, x) {
  return Math.sin(n * Math.PI * x)
}

// Signed displacement envelope of harmonic n at time t: amp·cos(n·ω0·t).
// ω0 = 1.8 rad/s is the visual base rate used by the harmonics view.
export function harmonicDisplacement(n, amp, t, omega0 = 1.8) {
  return amp * Math.cos(n * omega0 * t)
}

// Chladni plate pattern for a square plate on [0, 1]²:
// u = cos(nπx)cos(mπy) − cos(mπx)cos(nπy). Zero on the diagonal, and everywhere for m = n.
export function chladniAmplitude(m, n, x, y) {
  return Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) -
    Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
}

// Analytic gradient [∂u/∂x, ∂u/∂y] of chladniAmplitude on [0, 1]².
export function chladniGradient(m, n, x, y) {
  const kn = n * Math.PI, km = m * Math.PI
  const dudx = -kn * Math.sin(kn * x) * Math.cos(km * y) + km * Math.sin(km * x) * Math.cos(kn * y)
  const dudy = -km * Math.cos(kn * x) * Math.sin(km * y) + kn * Math.cos(km * x) * Math.sin(kn * y)
  return [dudx, dudy]
}

// Lissajous point: x = R·sin(a t), y = R·sin(b t + delta).
export function lissajous(t, a, b, delta, R = 1) {
  return [R * Math.sin(a * t), R * Math.sin(b * t + delta)]
}
