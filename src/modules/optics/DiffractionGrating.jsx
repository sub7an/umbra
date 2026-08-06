// 3D diffraction grating: spectral orders + animated photon pulses
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function wlToRGB(wl) {
  let r, g, b
  if      (wl < 440) { r = -(wl - 440) / 60; g = 0; b = 1 }
  else if (wl < 490) { r = 0; g = (wl - 440) / 50; b = 1 }
  else if (wl < 510) { r = 0; g = 1; b = -(wl - 510) / 20 }
  else if (wl < 580) { r = (wl - 510) / 70; g = 1; b = 0 }
  else if (wl < 645) { r = 1; g = -(wl - 645) / 65; b = 0 }
  else               { r = 1; g = 0; b = 0 }
  const f = wl < 420 ? 0.3 + 0.7 * (wl - 380) / 40 : wl > 700 ? 0.3 + 0.7 * (720 - wl) / 20 : 1
  return [r * f, g * f, b * f]
}

const D       = 600e-9
const N_WL    = 20
const ORDERS  = [-2, -1, 0, 1, 2]
const GRATING_X = 0

function buildGratingData() {
  const segs  = []
  const paths = []   // for photon animation

  for (let wi = 0; wi < N_WL; wi++) {
    const wl = (380 + wi * (340 / (N_WL - 1))) * 1e-9
    const [r, g, b] = wlToRGB(wl / 1e-9)
    const col = new THREE.Color(r, g, b)
    const y   = (wi / (N_WL - 1) - 0.5) * 3.5

    // Incident ray
    const incFrom = new THREE.Vector3(-5, y, 0)
    const incTo   = new THREE.Vector3(GRATING_X, y, 0)
    segs.push({ from: incFrom, to: incTo, color: new THREE.Color('#ffe8a0'), opacity: 0.5 })

    for (const m of ORDERS) {
      const sinTheta = m * wl / D
      if (Math.abs(sinTheta) > 1) continue
      const theta    = Math.asin(sinTheta)
      const cosTheta = Math.cos(theta)
      const len      = 5
      const diffFrom = new THREE.Vector3(GRATING_X, y, 0)
      const diffTo   = new THREE.Vector3(GRATING_X + cosTheta * len, y, Math.sin(theta) * len)
      segs.push({ from: diffFrom, to: diffTo, color: col.clone(), opacity: m === 0 ? 0.4 : 0.75 })

      // Build photon path (incident → grating → diffracted end) for animated subset
      if (wi % 4 === 0) {
        paths.push({
          points: [incFrom.clone(), incTo.clone(), diffTo.clone()],
          color:  m === 0 ? new THREE.Color('#ffe8a0') : col.clone(),
          delay:  (wi * ORDERS.length + ORDERS.indexOf(m)) / (N_WL * ORDERS.length),
        })
      }
    }
  }
  return { segs, paths }
}

// ─── Animated grating surface ────────────────────────────────────────────────
function GratingSurface() {
  const meshRef = useRef()
  const tRef    = useRef(0)

  const geo = useMemo(() => {
    const W = 64, H = 32
    const pos = new Float32Array(W * H * 3)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3
        pos[k]     = 0
        pos[k + 1] = (j / (H - 1) - 0.5) * 4
        pos[k + 2] = (i / (W - 1) - 0.5) * 6
      }
    }
    const idxArr = new Uint32Array((W - 1) * (H - 1) * 6)
    let p = 0
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j*W+i, b = a+1, c = a+W, d = c+1
        idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b
        idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [])

  useFrame((_, delta) => {
    tRef.current += delta * 2
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    const W = 64, H = 32
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        attr.setX(j * W + i, Math.sin(i / (W - 1) * Math.PI * 16 + tRef.current) * 0.04)
      }
    }
    attr.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ─── Photon pulse ────────────────────────────────────────────────────────────
function Photon({ points, color, delay }) {
  const ref  = useRef()
  const tRef = useRef(delay)

  useFrame((_, delta) => {
    tRef.current = (tRef.current + 0.18 * delta) % 1
    const t  = tRef.current
    const fi = t * (points.length - 1)
    const si = Math.floor(fi)
    const fr = fi - si
    if (ref.current && si < points.length - 1) {
      ref.current.position.lerpVectors(points[si], points[si + 1], fr)
    }
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 6, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function DiffractionGrating() {
  const { segs, paths } = useMemo(() => buildGratingData(), [])

  const lineGeos = useMemo(() => segs.map((s) => ({
    geo:     new THREE.BufferGeometry().setFromPoints([s.from, s.to]),
    color:   s.color,
    opacity: s.opacity,
  })), [segs])

  return (
    <group>
      <ambientLight intensity={0.08} color="#0a0808" />
      <directionalLight position={[0, 8, 0]} intensity={0.3} color="#fff8d0" />
      <pointLight position={[-4, 0, 0]} intensity={0.5} color="#fff8d0" distance={10} decay={2} />

      <GratingSurface />

      {/* Grating barrier */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.06, 4.5, 6.5]} />
        <meshBasicMaterial color="#222018" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.07, 4.5, 6.5]} />
        <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.10} />
      </mesh>

      {/* Spectral ray lines */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={l.opacity} />
        </line>
      ))}

      {/* Animated photon pulses on diffracted rays */}
      {paths.map((p, i) => (
        <Photon key={i} points={p.points} color={p.color} delay={p.delay} />
      ))}
    </group>
  )
}
