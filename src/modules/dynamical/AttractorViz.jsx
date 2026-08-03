import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ATTRACTOR_DEFS, attractorStep } from './attractorMath'

const N = 1800  // particles
const T = 72    // trail length (ring buffer per particle)

export default function AttractorViz({ attractorType, params, speedMultiplier = 1 }) {
  const def = ATTRACTOR_DEFS[attractorType]

  const paramsRef = useRef(params)
  useEffect(() => { paramsRef.current = params }, [params])

  const speedRef = useRef(speedMultiplier)
  useEffect(() => { speedRef.current = speedMultiplier }, [speedMultiplier])

  // Heavy init: runs once per mount (key={attractorType} ensures remount on type change)
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

      // Warm up: stagger particles around the attractor
      const wu = def.warmup + Math.floor(Math.random() * (def.warmup * 0.6))
      for (let w = 0; w < wu; w++) {
        const r = attractorStep(attractorType, x, y, z, p0, def.dt)
        x = r[0]; y = r[1]; z = r[2]
      }

      state[i * 3] = x; state[i * 3 + 1] = y; state[i * 3 + 2] = z

      // Seed trail at current position
      for (let t = 0; t < T; t++) {
        trail[(i * T + t) * 3]     = x
        trail[(i * T + t) * 3 + 1] = y
        trail[(i * T + t) * 3 + 2] = z
      }
    }

    const posAttr = new THREE.BufferAttribute(new Float32Array(N * T * 3), 3)
    const colAttr = new THREE.BufferAttribute(new Float32Array(N * T * 3), 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', posAttr)
    geo.setAttribute('color', colAttr)

    return { state, trail, head, posAttr, colAttr, geo }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => sim.geo.dispose(), [sim.geo])

  useFrame(() => {
    const p     = paramsRef.current
    const steps = Math.max(1, Math.round(def.stepsPerFrame * speedRef.current))
    const { state, trail, head, posAttr, colAttr } = sim
    const [sx, sy, sz] = def.seedCenter

    // Advance all particles
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        let x = state[ix], y = state[ix + 1], z = state[ix + 2]
        const next = attractorStep(attractorType, x, y, z, p, def.dt)

        if (!isFinite(next[0]) || Math.abs(next[0]) > 500) {
          state[ix]     = sx + (Math.random() - 0.5) * 0.5
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

    // Rebuild geometry: unroll trail in age order, compute color inline
    const sc = def.scale
    const [ox, oy, oz] = def.sceneOffset
    const posArr = posAttr.array
    const colArr = colAttr.array
    const isLorenz  = attractorType === 'lorenz'
    const isRossler = attractorType === 'rossler'
    const isThomas  = attractorType === 'thomas'

    for (let i = 0; i < N; i++) {
      let j = head[i]  // most recent slot
      for (let age = 0; age < T; age++) {
        const src = (i * T + j) * 3
        const dst = (i * T + age) * 3

        const tx = trail[src], ty = trail[src + 1], tz = trail[src + 2]
        posArr[dst]     = tx * sc + ox
        posArr[dst + 1] = ty * sc + oy
        posArr[dst + 2] = tz * sc + oz

        const brightness = Math.pow((T - age) / T, 1.7)
        let cr, cg, cb

        if (isLorenz) {
          // Teal (low z) → amber (high z)
          const t = Math.max(0, Math.min(1, (tz - 2) / 45))
          cr = (0.0 + t * 0.96) * brightness
          cg = (0.9 - t * 0.28) * brightness
          cb = (0.77 - t * 0.73) * brightness
        } else if (isRossler) {
          // Amber (low z) → rose (high z)
          const t = Math.max(0, Math.min(1, tz / 35))
          cr = (0.96 - t * 0.08) * brightness
          cg = (0.62 - t * 0.62) * brightness
          cb = (0.04 + t * 0.94) * brightness
        } else if (isThomas) {
          // Violet modulated by distance from origin
          const mag = Math.min(Math.sqrt(tx * tx + ty * ty + tz * tz) / 5, 1)
          cr = (0.55 + mag * 0.45) * brightness
          cg = (0.00 + mag * 0.25) * brightness
          cb = (0.97 - mag * 0.17) * brightness
        } else {
          // Aizawa: emerald (bottom) → cyan (top)
          const t = Math.max(0, Math.min(1, (tz + 1.5) / 3))
          cr = (0.0 + t * 0.0) * brightness
          cg = (0.63 + t * 0.27) * brightness
          cb = (0.50 + t * 0.50) * brightness
        }

        colArr[dst] = cr; colArr[dst + 1] = cg; colArr[dst + 2] = cb

        // Decrement ring buffer index
        j--; if (j < 0) j = T - 1
      }
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  return (
    <points geometry={sim.geo} renderOrder={1}>
      <pointsMaterial
        vertexColors
        size={0.016}
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
