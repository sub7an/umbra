// Pure 3D magnetic field math — no Three.js dependency

const EPS = 1e-6

export const mag3 = (v) => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])

export const norm3 = (v) => {
  const m = mag3(v)
  return m < EPS ? [0, 0, 0] : [v[0]/m, v[1]/m, v[2]/m]
}

export const add3   = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
export const sub3   = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
export const scale3 = (v, s) => [v[0]*s, v[1]*s, v[2]*s]
export const dot3   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]

// ── Magnetic dipole: B = (3(m·r̂)r̂ − m) / r³  (omits μ₀/4π for visualization) ──
export function dipoleBField(pos, center = [0,0,0], moment = [0,1,0]) {
  const r  = sub3(pos, center)
  const rr = mag3(r)
  if (rr < EPS) return [0, 0, 0]
  const r3  = rr * rr * rr
  const r5  = r3 * rr * rr
  const mdr = dot3(moment, r)
  return [
    3*mdr*r[0]/r5 - moment[0]/r3,
    3*mdr*r[1]/r5 - moment[1]/r3,
    3*mdr*r[2]/r5 - moment[2]/r3,
  ]
}

// ── Bar magnet: two magnetic monopoles ±qm separated by 2·halfLen ─────────────
export function barMagnetBField(pos, center = [0,0,0], halfLen = 0.8) {
  const qm    = 5.0
  const north = [center[0], center[1] + halfLen, center[2]]
  const south = [center[0], center[1] - halfLen, center[2]]
  const rN = sub3(pos, north), mN = mag3(rN)
  const rS = sub3(pos, south), mS = mag3(rS)
  if (mN < EPS || mS < EPS) return [0, 0, 0]
  return add3(scale3(rN, qm / (mN*mN*mN)), scale3(rS, -qm / (mS*mS*mS)))
}

// ── Solenoid: N stacked current-loop dipoles along y-axis ────────────────────
export function solenoidBField(pos, center = [0,0,0], loops = 10, length = 2.0, radius = 0.5) {
  let B = [0, 0, 0]
  const mu = Math.PI * radius * radius
  for (let i = 0; i < loops; i++) {
    const y = center[1] - length/2 + (i + 0.5) * length / loops
    B = add3(B, dipoleBField(pos, [center[0], y, center[2]], [0, mu, 0]))
  }
  return B
}

// ── Halbach array: 4 magnets with rotating moments → strong above, ≈0 below ──
export function halbachBField(pos, center = [0,0,0]) {
  const sp = 1.0
  // CCW rotation → constructive above (+y), destructive below (−y)
  const cfgs = [
    { o: [-1.5*sp, 0, 0], m: [0, 1, 0] },
    { o: [-0.5*sp, 0, 0], m: [-1, 0, 0] },
    { o: [ 0.5*sp, 0, 0], m: [0,-1, 0] },
    { o: [ 1.5*sp, 0, 0], m: [1, 0, 0] },
  ]
  return cfgs.reduce((acc, { o, m }) =>
    add3(acc, dipoleBField(pos, add3(center, o), scale3(m, 2.5))), [0, 0, 0])
}

// ── Dispatch by magnet type ──────────────────────────────────────────────────
export function totalBField(pos, magnetType, center = [0,0,0]) {
  switch (magnetType) {
    case 'dipole':   return dipoleBField(pos, center)
    case 'bar':      return barMagnetBField(pos, center)
    case 'solenoid': return solenoidBField(pos, center)
    case 'halbach':  return halbachBField(pos, center)
    default:         return dipoleBField(pos, center)
  }
}

// ── RK4 field line integrator ────────────────────────────────────────────────
export function traceFieldLine(start, bFunc, steps = 180, dt = 0.09) {
  const pts = [[...start]]
  let pos = [...start]
  for (let i = 0; i < steps; i++) {
    const b1 = norm3(bFunc(pos))
    if (!b1[0] && !b1[1] && !b1[2]) break
    const p2 = add3(pos, scale3(b1, dt/2))
    const b2 = norm3(bFunc(p2))
    const p3 = add3(pos, scale3(b2, dt/2))
    const b3 = norm3(bFunc(p3))
    const p4 = add3(pos, scale3(b3, dt))
    const b4 = norm3(bFunc(p4))
    pos = [
      pos[0] + dt/6 * (b1[0]+2*b2[0]+2*b3[0]+b4[0]),
      pos[1] + dt/6 * (b1[1]+2*b2[1]+2*b3[1]+b4[1]),
      pos[2] + dt/6 * (b1[2]+2*b2[2]+2*b3[2]+b4[2]),
    ]
    const rr = mag3(pos)
    if (!isFinite(rr) || rr > 9 || rr < 0.04) break
    pts.push([...pos])
  }
  return pts
}

// ── Seed points at field-line sources (north pole / strong-field region) ──────
export function generateSeeds(magnetType) {
  if (magnetType === 'bar') {
    const seeds = [], topY = 0.85
    const rings = [{r:0.05,n:1},{r:0.15,n:5},{r:0.30,n:8},{r:0.46,n:8},{r:0.62,n:5}]
    for (const {r, n} of rings)
      for (let i = 0; i < n; i++) {
        const phi = (i/n) * Math.PI * 2
        seeds.push([r*Math.cos(phi), topY, r*Math.sin(phi)])
      }
    return seeds
  }
  if (magnetType === 'solenoid') {
    const seeds = [], topY = 1.06
    for (let i = 0; i < 20; i++) {
      const phi = (i/20) * Math.PI * 2
      const r = 0.07 + (i % 4) * 0.10
      seeds.push([r*Math.cos(phi), topY, r*Math.sin(phi)])
    }
    return seeds
  }
  if (magnetType === 'halbach') {
    const seeds = []
    for (let xi = 0; xi < 8; xi++) {
      const x = -1.75 + xi * 0.5
      for (let zi = 0; zi < 3; zi++)
        seeds.push([x, 0.13, -0.4 + zi*0.4])
    }
    return seeds
  }
  // Dipole: rings in northern hemisphere at r=0.30 around the north pole
  const seeds = [], r0 = 0.30
  const rings = [{t:0.30,n:2},{t:0.55,n:5},{t:0.82,n:8},{t:1.05,n:8},{t:1.25,n:5}]
  for (const {t, n} of rings)
    for (let i = 0; i < n; i++) {
      const phi = (i/n) * Math.PI * 2
      seeds.push([r0*Math.sin(t)*Math.cos(phi), r0*Math.cos(t), r0*Math.sin(t)*Math.sin(phi)])
    }
  return seeds
}

// ── Colormaps ────────────────────────────────────────────────────────────────

// Field line color keyed by normalized distance: t=1 → close/strong, t=0 → far/weak
export function fieldLineColor(t) {
  if (t < 0.35) {
    const s = t / 0.35
    return [s*0.4, 0, s*0.85]               // dark → dim violet
  } else if (t < 0.65) {
    const s = (t - 0.35) / 0.30
    return [0.4+s*0.3, s*0.25, 0.85+s*0.15] // violet → violet-cyan
  } else {
    const s = (t - 0.65) / 0.35
    return [0.7+s*0.3, 0.25+s*0.75, 1.0]    // violet-cyan → white
  }
}

// Heatmap color: dark → violet → orange → white
export function heatColor(t) {
  if (t < 0.33) {
    const s = t / 0.33
    return [s*0.55, 0, 0.5+s*0.5]           // dark → violet
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33
    return [0.55+s*0.45, s*0.38, 1-s]       // violet → orange
  } else {
    const s = (t - 0.66) / 0.34
    return [1.0, 0.38+s*0.62, s*0.45]       // orange → white
  }
}
