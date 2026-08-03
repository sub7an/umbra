// ODE definitions and RK4 integration for strange attractors

export const ATTRACTOR_DEFS = {
  lorenz: {
    name: 'Lorenz',
    abbr: 'LOR',
    dt: 0.005,
    stepsPerFrame: 5,
    seedCenter: [0.5, 0.5, 20.0],
    seedRadius: 1.2,
    warmup: 250,
    scale: 0.075,
    sceneOffset: [0, 0, -1.9],
    defaultParams: { sigma: 10, rho: 28, beta: 2.667 },
    paramControls: [
      { key: 'sigma', label: 'σ  sigma',   min: 1,   max: 20,  step: 0.5, decimals: 1 },
      { key: 'rho',   label: 'ρ  rho',     min: 10,  max: 45,  step: 0.5, decimals: 1 },
      { key: 'beta',  label: 'β  beta',    min: 0.5, max: 5.0, step: 0.1, decimals: 2 },
    ],
  },
  rossler: {
    name: 'Rössler',
    abbr: 'ROS',
    dt: 0.01,
    stepsPerFrame: 5,
    seedCenter: [0, -5, 0],
    seedRadius: 1.0,
    warmup: 700,
    scale: 0.065,
    sceneOffset: [0, 0.4, -0.9],
    defaultParams: { a: 0.2, b: 0.2, c: 5.7 },
    paramControls: [
      { key: 'a', label: 'a',  min: 0.1, max: 0.5, step: 0.01, decimals: 2 },
      { key: 'c', label: 'c',  min: 3.0, max: 10,  step: 0.1,  decimals: 1 },
    ],
  },
  thomas: {
    name: 'Thomas',
    abbr: 'THO',
    dt: 0.08,
    stepsPerFrame: 3,
    seedCenter: [0.1, 0, 0],
    seedRadius: 0.8,
    warmup: 300,
    scale: 0.55,
    sceneOffset: [0, 0, 0],
    defaultParams: { b: 0.19 },
    paramControls: [
      { key: 'b', label: 'b  dissipation', min: 0.05, max: 0.38, step: 0.005, decimals: 3 },
    ],
  },
  aizawa: {
    name: 'Aizawa',
    abbr: 'AIZ',
    dt: 0.015,
    stepsPerFrame: 3,
    seedCenter: [0.1, 0, 0],
    seedRadius: 0.12,
    warmup: 300,
    scale: 1.1,
    sceneOffset: [0, 0, -0.5],
    defaultParams: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 },
    paramControls: [
      { key: 'a', label: 'a', min: 0.5, max: 1.2, step: 0.05, decimals: 2 },
      { key: 'b', label: 'b', min: 0.4, max: 1.0, step: 0.05, decimals: 2 },
    ],
  },
}

function deriv(type, x, y, z, p) {
  switch (type) {
    case 'lorenz':
      return [p.sigma * (y - x), x * (p.rho - z) - y, x * y - p.beta * z]
    case 'rossler':
      return [-y - z, x + p.a * y, p.b + z * (x - p.c)]
    case 'thomas':
      return [Math.sin(y) - p.b * x, Math.sin(z) - p.b * y, Math.sin(x) - p.b * z]
    case 'aizawa':
      return [
        (z - p.b) * x - p.d * y,
        p.d * x + (z - p.b) * y,
        p.c + p.a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x,
      ]
    default:
      return [0, 0, 0]
  }
}

export function attractorStep(type, x, y, z, p, dt) {
  const k1 = deriv(type, x, y, z, p)
  const k2 = deriv(type, x + k1[0] * dt * 0.5, y + k1[1] * dt * 0.5, z + k1[2] * dt * 0.5, p)
  const k3 = deriv(type, x + k2[0] * dt * 0.5, y + k2[1] * dt * 0.5, z + k2[2] * dt * 0.5, p)
  const k4 = deriv(type, x + k3[0] * dt, y + k3[1] * dt, z + k3[2] * dt, p)
  return [
    x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    z + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
  ]
}
