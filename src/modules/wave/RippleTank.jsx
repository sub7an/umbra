import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const W     = 128
const H     = 128
const C2    = 0.30
const DAMP  = 0.993
const SPONGE = 14
const AMP   = 0.45

// Barrier: 4-cell-wide wall at column 62–65 (world x ≈ 0)
const BAR_I_LO = 62
const BAR_I_HI = 65
const SRC_FREQ  = 2.5   // Hz — fixed so sources are coherent (clean interference)

const VERT = /* glsl */`
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  varying float vH;
  void main() {
    float t = clamp(vH * 1.5 + 0.5, 0.0, 1.0);
    vec3 deep = vec3(0.00, 0.03, 0.14);
    vec3 mid  = vec3(0.03, 0.48, 0.85);
    vec3 peak = vec3(1.35, 1.75, 1.90);
    vec3 col = t < 0.5
      ? mix(deep, mid, t * 2.0)
      : mix(mid, peak, pow((t - 0.5) * 2.0, 1.4));
    gl_FragColor = vec4(col, 0.97);
  }
`

// j-index → world Z
const jToZ = (j) => (j / (H - 1) - 0.5) * 10

// Build Uint8Array barrier mask for given slitMode (0/1/2)
function buildBarrier(slitMode) {
  const barrier = new Uint8Array(W * H)
  if (slitMode === 0) return barrier
  const mid = Math.floor(H / 2)
  // Slit openings: [jLo, jHi] inclusive
  const slits = slitMode === 1
    ? [[mid - 7, mid + 7]]                                      // 15-cell single slit
    : [[mid - 24, mid - 14], [mid + 14, mid + 24]]             // two 11-cell slits
  for (let j = 0; j < H; j++) {
    const open = slits.some(([lo, hi]) => j >= lo && j <= hi)
    if (!open) {
      for (let i = BAR_I_LO; i <= BAR_I_HI; i++) barrier[j * W + i] = 1
    }
  }
  return barrier
}

// World-space box descriptions for each solid segment of the barrier
function barrierSegments(slitMode) {
  if (slitMode === 0) return []
  const mid = Math.floor(H / 2)
  const slits = slitMode === 1
    ? [[mid - 7, mid + 7]]
    : [[mid - 24, mid - 14], [mid + 14, mid + 24]]
  const sorted = [...slits].sort((a, b) => a[0] - b[0])
  const segs = []
  let prev = 1  // skip row 0 (sponge edge)
  for (const [lo, hi] of sorted) {
    if (lo > prev) segs.push([prev, lo - 1])
    prev = hi + 1
  }
  if (prev < H - 1) segs.push([prev, H - 2])
  return segs.map(([jLo, jHi]) => {
    const zLo = jToZ(jLo)
    const zHi = jToZ(jHi)
    return { zCenter: (zLo + zHi) / 2, depth: zHi - zLo + 0.04 }
  })
}

export default function RippleTank({ onSourceCount, slitMode = 0, clearCount = 0 }) {
  const meshRef     = useRef()
  const [sources, setSources] = useState([{ x: 32, y: H / 2, freq: SRC_FREQ, t: 0 }])
  const srcRef      = useRef(sources)
  const barrierRef  = useRef(buildBarrier(slitMode))

  const { cur, prv, nxt } = useMemo(() => ({
    cur: new Float32Array(W * H),
    prv: new Float32Array(W * H),
    nxt: new Float32Array(W * H),
  }), [])

  // Recompute barrier mask when slitMode changes
  useEffect(() => {
    barrierRef.current = buildBarrier(slitMode)
    cur.fill(0); prv.fill(0); nxt.fill(0)
  }, [slitMode, cur, prv, nxt])

  // Clear all sources when clearCount increments
  useEffect(() => {
    if (clearCount === 0) return
    const fresh = [{ x: 32, y: H / 2, freq: SRC_FREQ, t: 0 }]
    setSources(fresh)
    srcRef.current = fresh
    cur.fill(0); prv.fill(0); nxt.fill(0)
    if (onSourceCount) onSourceCount(1)
  }, [clearCount, cur, prv, nxt, onSourceCount])

  const { geo } = useMemo(() => {
    const pos = new Float32Array(W * H * 3)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3
        pos[k]     = (i / (W - 1) - 0.5) * 10
        pos[k + 1] = 0
        pos[k + 2] = (j / (H - 1) - 0.5) * 10
      }
    }
    const idxArr = new Uint32Array((W - 1) * (H - 1) * 6)
    let p = 0
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1
        idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b
        idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return { geo }
  }, [])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    const gx = Math.round((e.point.x / 5 + 0.5) * (W - 1))
    const gz = Math.round((e.point.z / 5 + 0.5) * (H - 1))
    if (gx < 2 || gx >= W - 2 || gz < 2 || gz >= H - 2) return
    // Prevent placing sources inside or behind the barrier (barrier is at i=62–65)
    if (gx >= BAR_I_LO - 2) return
    setSources((prev) => {
      const next = [...prev, { x: gx, y: gz, freq: SRC_FREQ, t: 0 }].slice(-5)
      srcRef.current = next
      if (onSourceCount) onSourceCount(next.length)
      return next
    })
  }, [onSourceCount])

  useFrame((_, delta) => {
    const dt      = Math.min(delta, 0.033)
    const barrier = barrierRef.current

    // Drive source cells
    for (const s of srcRef.current) {
      s.t += dt
      cur[s.y * W + s.x] = Math.sin(s.t * s.freq * Math.PI * 2) * 1.3
    }

    // FDTD wave step — skip barrier cells (Dirichlet boundary)
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = j * W + i
        if (barrier[idx]) { nxt[idx] = 0; continue }
        nxt[idx] = DAMP * (2 * cur[idx] - prv[idx] +
          C2 * (cur[idx - 1] + cur[idx + 1] + cur[idx - W] + cur[idx + W] - 4 * cur[idx]))
      }
    }

    // Absorbing sponge at edges
    for (let s = 0; s < SPONGE; s++) {
      const f = 1 - 0.14 * (SPONGE - s) / SPONGE
      for (let i = 0; i < W; i++) {
        nxt[s * W + i]           *= f
        nxt[(H - 1 - s) * W + i] *= f
      }
      for (let j = 0; j < H; j++) {
        nxt[j * W + s]           *= f
        nxt[j * W + (W - 1 - s)] *= f
      }
    }

    prv.set(cur); cur.set(nxt)

    // Enforce barrier boundary in cur/prv to prevent energy bleed
    for (let j = 0; j < H; j++) {
      for (let i = BAR_I_LO; i <= BAR_I_HI; i++) {
        const idx = j * W + i
        if (barrier[idx]) { cur[idx] = 0; prv[idx] = 0 }
      }
    }

    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let k = 0; k < W * H; k++) attr.setY(k, cur[k] * AMP)
    attr.needsUpdate = true
  })

  // Barrier box world dimensions
  const BAR_X      = ((BAR_I_LO + BAR_I_HI) / 2 / (W - 1) - 0.5) * 10  // ≈ -0.059
  const BAR_WIDTH  = (BAR_I_HI - BAR_I_LO) / (W - 1) * 10               // ≈ 0.236
  const segments   = useMemo(() => barrierSegments(slitMode), [slitMode])

  return (
    <group>
      <ambientLight intensity={0.12} color="#061020" />
      <directionalLight position={[4, 10, 6]} intensity={0.5} color="#7de8ff" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#22d3ee" distance={20} decay={2} />

      {/* Wave surface */}
      <mesh ref={meshRef} geometry={geo} onClick={handleClick} frustumCulled={false}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Invisible click catcher for the flat region */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ── Barrier geometry ── */}
      {segments.map((seg, i) => (
        <mesh key={i} position={[BAR_X, 0.22, seg.zCenter]}>
          <boxGeometry args={[BAR_WIDTH + 0.06, 0.44, seg.depth]} />
          <meshStandardMaterial
            color="#0f1d38"
            emissive="#1e3a6a"
            emissiveIntensity={0.35}
            roughness={0.6}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* Source markers */}
      {sources.map((src, i) => {
        const wx = (src.x / (W - 1) - 0.5) * 10
        const wz = (src.y / (H - 1) - 0.5) * 10
        return (
          <group key={i} position={[wx, 0.18, wz]}>
            <mesh>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshBasicMaterial color="#22d3ee" />
            </mesh>
            <pointLight color="#22d3ee" intensity={0.5} distance={2.5} decay={2} />
          </group>
        )
      })}
    </group>
  )
}
