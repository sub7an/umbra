// 3D diffraction grating: spectral orders rendered as angled beams
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

const D = 600e-9   // grating spacing 600 nm (lines/mm = 1666)
const N_WL = 20
const ORDERS = [-2, -1, 0, 1, 2]
const GRATING_X = 0

function buildGratingRays() {
  const segs = []
  const incidentDir = new THREE.Vector3(1, 0, 0)  // normal incidence

  for (let wi = 0; wi < N_WL; wi++) {
    const wl = (380 + wi * (340 / (N_WL - 1))) * 1e-9
    const [r, g, b] = wlToRGB(wl / 1e-9)
    const col = new THREE.Color(r, g, b)

    for (const m of ORDERS) {
      const sinTheta = m * wl / D
      if (Math.abs(sinTheta) > 1) continue
      const theta = Math.asin(sinTheta)
      const cosTheta = Math.cos(theta)

      const y = (wi / (N_WL - 1) - 0.5) * 3.5

      // Incident ray
      segs.push({
        from: new THREE.Vector3(-5, y, 0),
        to:   new THREE.Vector3(GRATING_X, y, 0),
        color: new THREE.Color('#ffe8a0'),
        opacity: 0.5,
      })

      // Diffracted ray in XZ plane
      const dirX =  cosTheta
      const dirZ =  sinTheta
      const len = 5
      segs.push({
        from: new THREE.Vector3(GRATING_X, y, 0),
        to:   new THREE.Vector3(GRATING_X + dirX * len, y, dirZ * len),
        color: col.clone(),
        opacity: m === 0 ? 0.4 : 0.75,
      })
    }
  }
  return segs
}

// Animated grating surface
function GratingSurface() {
  const meshRef = useRef()
  const tRef = useRef(0)

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
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1
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
    const t = tRef.current
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    const W = 64, H = 32
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const fz = i / (W - 1)
        attr.setX(j * W + i, Math.sin(fz * Math.PI * 16 + t) * 0.04)
      }
    }
    attr.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshBasicMaterial
        color="#fcd34d"
        wireframe
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function DiffractionGrating() {
  const segs = useMemo(() => buildGratingRays(), [])

  const lineGeos = useMemo(() => segs.map((s) => ({
    geo: new THREE.BufferGeometry().setFromPoints([s.from, s.to]),
    color: s.color,
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
        <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.1} />
      </mesh>

      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={l.opacity} />
        </line>
      ))}
    </group>
  )
}
