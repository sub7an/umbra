// Thin converging lens, real-is-positive convention: 1/f = 1/u + 1/v.
// u = object distance (in front of the lens), f > 0.

// Image of an object at distance u. v > 0: real image behind the lens;
// v < 0: virtual image on the object's side. m = −v/u (negative = inverted).
// An object at the focal point sends rays out parallel: the image is at infinity.
export function thinLensImage(u, f) {
  if (Math.abs(u - f) < 0.03) return { v: Infinity, m: Infinity, real: false, atInfinity: true }
  const v = (u * f) / (u - f)
  return { v, m: -v / u, real: v > 0, atInfinity: false }
}

// Paraxial ray from the tip of an object of height h at distance u, crossing
// the lens at height y0. The lens bends every ray by the same rule:
//   slope_out = slope_in − y0/f
export function traceThrough(y0, u, f, h) {
  const sIn = (y0 - h) / u
  return { y0, sIn, sOut: sIn - y0 / f }
}
