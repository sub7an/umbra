// Shared helpers for physics validation suites.

// Seeded 32-bit PRNG (mulberry32). Same seed gives the same sequence.
export function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Relative error of a against reference b.
export function relErr(a, b) {
  return Math.abs(a - b) / Math.abs(b)
}

// Observed order of convergence from errors at step h and h/ratio.
export function convergenceOrder(errCoarse, errFine, ratio = 2) {
  return Math.log(errCoarse / errFine) / Math.log(ratio)
}

// Composite Simpson's rule on [a, b] with n subintervals (n rounded up to even).
export function integrate(f, a, b, n = 2000) {
  if (n % 2 !== 0) n += 1
  const h = (b - a) / n
  let sum = f(a) + f(b)
  for (let i = 1; i < n; i++) {
    sum += f(a + i * h) * (i % 2 === 0 ? 2 : 4)
  }
  return (sum * h) / 3
}
