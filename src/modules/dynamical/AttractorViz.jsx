// Strange attractors, drawn in two layers:
//   • a faint "skeleton": one long trajectory (~150k RK4 steps) whose points
//     build up the attractor's invariant density, recomputed when parameters change
//   • 1,800 comets: independent initial conditions with glowing trails, so you
//     watch nearby states race apart (sensitive dependence) yet stay on the set
// Equilibria are marked where they have closed forms (Lorenz, Rössler).
// The vertical axis of each system (Lorenz/Rössler/Aizawa z) is drawn upright.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ATTRACTOR_DEFS, attractorStep } from './attractorMath'

const N = 1800   // comets
const T = 72     // trail length per comet
const SKELETON_STEPS = 150000

// Attractor coords → scene coords (swap y/z so the system's z axis points up)
function makeToScene(type, def) {
  const sc = def.scale
  const [ox, oy, oz] = def.sceneOffset
  if (type === 'thomas') return (x, y, z, out, o) => { out[o] = x * sc + ox; out[o + 1] = y * sc + oy; out[o + 2] = z * sc + oz }
  return (x, y, z, out, o) => { out[o] = x * sc + ox; out[o + 1] = z * sc + oz; out[o + 2] = y * sc + oy }
}

// Colour by position, per system
function colourFor(type, x, y, z, out, o, k) {
  let r, g, b
  if (type === 'lorenz') {
    const t = Math.max(0, Math.min(1, (z - 2) / 45))
    r = t * 0.96; g = 0.9 - t * 0.28; b = 0.77 - t * 0.73
  } else if (type === 'rossler') {
    const t = Math.max(0, Math.min(1, z / 35))
    r = 0.96 - t * 0.08; g = 0.62 - t * 0.62; b = 0.04 + t * 0.94
  } else if (type === 'thomas') {
    const m = Math.min(Math.sqrt(x * x + y * y + z * z) / 5, 1)
    r = 0.55 + m * 0.45; g = m * 0.25; b = 0.97 - m * 0.17
  } else {
    const t = Math.max(0, Math.min(1, (z + 1.5) / 3))
    r = 0; g = 0.63 + t * 0.27; b = 0.5 + t * 0.5
  }
  out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k
}

// Closed-form equilibria
function equilibria(type, p) {
  if (type === 'lorenz' && p.rho > 1) {
    const s = Math.sqrt(p.beta * (p.rho - 1))
    return [[0, 0, 0], [s, s, p.rho - 1], [-s, -s, p.rho - 1]]
  }
  if (type === 'rossler') {
    const disc = p.c * p.c - 4 * p.a * p.b
    if (disc < 0) return []
    return [1, -1].map((sg) => { const x = (p.c + sg * Math.sqrt(disc)) / 2; return [x, -x / p.a, x / p.a] })
  }
  return []
}

function useDotTexture() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

// ── Skeleton: long-run density of a single trajectory ────────────────────────
function Skeleton({ type, def, params, tex }) {
  const geo = useMemo(() => {
    const toScene = makeToScene(type, def)
    const pos = new Float32Array(SKELETON_STEPS * 3), col = new Float32Array(SKELETON_STEPS * 3)
    let [x, y, z] = def.seedCenter
    for (let i = 0; i < def.warmup * 2; i++) [x, y, z] = attractorStep(type, x, y, z, params, def.dt)
    let n = 0
    for (let i = 0; i < SKELETON_STEPS; i++) {
      ;[x, y, z] = attractorStep(type, x, y, z, params, def.dt)
      if (!isFinite(x) || Math.abs(x) > 500) break
      toScene(x, y, z, pos, n * 3)
      colourFor(type, x, y, z, col, n * 3, 0.16)
      n++
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, n * 3), 3))
    return g
  }, [type, def, params])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <points geometry={geo}>
      <pointsMaterial vertexColors map={tex} size={0.03} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ── Equilibrium markers: a bright core inside a slowly pulsing ring ──────────
function Equilibria({ type, def, params }) {
  const pts = useMemo(() => {
    const toScene = makeToScene(type, def)
    return equilibria(type, params).map(([x, y, z]) => { const o = [0, 0, 0]; toScene(x, y, z, o, 0); return o })
  }, [type, def, params])
  const rings = useRef([])
  useFrame(({ clock, camera }) => {
    rings.current.forEach((r, i) => {
      if (!r) return
      r.quaternion.copy(camera.quaternion)
      r.scale.setScalar(1 + 0.25 * Math.sin(clock.elapsedTime * 2 + i))
    })
  })
  return pts.map((p, i) => (
    <group key={i} position={p}>
      <mesh>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={[2.2, 2.2, 2.4]} toneMapped={false} />
      </mesh>
      <mesh ref={(el) => (rings.current[i] = el)}>
        <ringGeometry args={[0.08, 0.1, 40]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  ))
}

export default function AttractorViz({ attractorType, params, speedMultiplier = 1 }) {
  const def = ATTRACTOR_DEFS[attractorType]
  const tex = useDotTexture()

  const paramsRef = useRef(params)
  useEffect(() => { paramsRef.current = params }, [params])
  const speedRef = useRef(speedMultiplier)
  useEffect(() => { speedRef.current = speedMultiplier }, [speedMultiplier])

  // Comets (key={attractorType} on the parent remounts this on type change)
  const sim = useMemo(() => {
    const p0 = def.defaultParams
    const [sx, sy, sz] = def.seedCenter
    const sr = def.seedRadius
    const state = new Float32Array(N * 3)
    const trail = new Float32Array(N * T * 3)
    const head  = new Int32Array(N)
    for (let i = 0; i < N; i++) {
      let x = sx + (Math.random() - 0.5) * sr * 2
      let y = sy + (Math.random() - 0.5) * sr * 2
      let z = sz + (Math.random() - 0.5) * sr * 2
      const wu = def.warmup + Math.floor(Math.random() * (def.warmup * 0.6))
      for (let w = 0; w < wu; w++) [x, y, z] = attractorStep(attractorType, x, y, z, p0, def.dt)
      state[i * 3] = x; state[i * 3 + 1] = y; state[i * 3 + 2] = z
      for (let t = 0; t < T; t++) {
        trail[(i * T + t) * 3] = x; trail[(i * T + t) * 3 + 1] = y; trail[(i * T + t) * 3 + 2] = z
      }
    }
    const posAttr = new THREE.BufferAttribute(new Float32Array(N * T * 3), 3)
    const colAttr = new THREE.BufferAttribute(new Float32Array(N * T * 3), 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', posAttr)
    geo.setAttribute('color', colAttr)
    return { state, trail, head, posAttr, colAttr, geo, toScene: makeToScene(attractorType, def) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => sim.geo.dispose(), [sim.geo])

  useFrame(() => {
    const p = paramsRef.current
    const steps = Math.max(1, Math.round(def.stepsPerFrame * speedRef.current))
    const { state, trail, head, posAttr, colAttr, toScene } = sim
    const [sx, sy, sz] = def.seedCenter
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        const next = attractorStep(attractorType, state[ix], state[ix + 1], state[ix + 2], p, def.dt)
        if (!isFinite(next[0]) || Math.abs(next[0]) > 500) {
          state[ix] = sx + (Math.random() - 0.5) * 0.5
          state[ix + 1] = sy + (Math.random() - 0.5) * 0.5
          state[ix + 2] = sz + (Math.random() - 0.5) * 0.5
        } else {
          state[ix] = next[0]; state[ix + 1] = next[1]; state[ix + 2] = next[2]
          head[i] = (head[i] + 1) % T
          const hi = (i * T + head[i]) * 3
          trail[hi] = next[0]; trail[hi + 1] = next[1]; trail[hi + 2] = next[2]
        }
      }
    }
    const posArr = posAttr.array, colArr = colAttr.array
    for (let i = 0; i < N; i++) {
      let j = head[i]
      for (let age = 0; age < T; age++) {
        const src = (i * T + j) * 3, dst = (i * T + age) * 3
        const tx = trail[src], ty = trail[src + 1], tz = trail[src + 2]
        toScene(tx, ty, tz, posArr, dst)
        let k = Math.pow((T - age) / T, 1.7)
        if (age < 3) k *= 2.4      // white-hot head, caught by bloom
        colourFor(attractorType, tx, ty, tz, colArr, dst, k)
        j--; if (j < 0) j = T - 1
      }
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  return (
    <group>
      <Skeleton type={attractorType} def={def} params={params} tex={tex} />
      <points geometry={sim.geo} renderOrder={1}>
        <pointsMaterial vertexColors map={tex} size={0.045} transparent sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <Equilibria type={attractorType} def={def} params={params} />
    </group>
  )
}
