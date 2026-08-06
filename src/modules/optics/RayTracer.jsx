// 3D prism scene: spectral light rays refracted through a glass prism + animated photons
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N_RAYS = 24

function wlToRGB(wl) {
  let r, g, b
  if      (wl < 440) { r = -(wl - 440) / 60; g = 0; b = 1 }
  else if (wl < 490) { r = 0; g = (wl - 440) / 50; b = 1 }
  else if (wl < 510) { r = 0; g = 1; b = -(wl - 510) / 20 }
  else if (wl < 580) { r = (wl - 510) / 70; g = 1; b = 0 }
  else if (wl < 645) { r = 1; g = -(wl - 645) / 65; b = 0 }
  else               { r = 1; g = 0; b = 0 }
  const factor = wl < 420 ? 0.3 + 0.7 * (wl - 380) / 40
               : wl > 700 ? 0.3 + 0.7 * (720 - wl) / 20
               : 1.0
  return [r * factor, g * factor, b * factor]
}

function cauchyN(wl) {
  return 1.458 + 3540 / (wl * wl)
}

function snellRefract(dir, normal, n1, n2) {
  const d    = dir.clone().normalize()
  const n    = normal.clone().normalize()
  const cosI = -d.dot(n)
  const ratio = n1 / n2
  const sinT2 = ratio * ratio * (1 - cosI * cosI)
  if (sinT2 > 1) return null
  const cosT = Math.sqrt(1 - sinT2)
  return d.clone().multiplyScalar(ratio).add(n.clone().multiplyScalar(ratio * cosI - cosT))
}

const PRISM_HALF = 1.8
const PRISM_H    = PRISM_HALF * Math.sqrt(3)
const N1_AIR     = 1.0003

const P = [
  new THREE.Vector3(-PRISM_HALF, 0, PRISM_H * 2 / 3),
  new THREE.Vector3( PRISM_HALF, 0, PRISM_H * 2 / 3),
  new THREE.Vector3( 0,          0, -PRISM_H / 3),
]

function faceNormal(a, b) {
  const d = new THREE.Vector3().subVectors(b, a).normalize()
  return new THREE.Vector3(d.z, 0, -d.x)
}

const FACE_LEFT_NORMAL   = faceNormal(P[0], P[2]).negate()
const FACE_RIGHT_NORMAL  = faceNormal(P[2], P[1])

function rayHitFace(origin, dir, faceA, faceB) {
  const ox = origin.x, oz = origin.z
  const dx = dir.x, dz = dir.z
  const ax = faceA.x, az = faceA.z
  const bx = faceB.x, bz = faceB.z
  const ex = bx - ax, ez = bz - az
  const denom = dx * ez - dz * ex
  if (Math.abs(denom) < 1e-9) return null
  const t = ((ax - ox) * ez - (az - oz) * ex) / denom
  const u = ((ax - ox) * dz - (az - oz) * dx) / denom
  if (t < 0.001 || u < 0 || u > 1) return null
  return t
}

function traceRay(wl, yOff) {
  const n2     = cauchyN(wl)
  const [r, g, b] = wlToRGB(wl)
  const color  = new THREE.Color(r, g, b)
  const startX = -6
  const startZ = P[0].z + (P[2].z - P[0].z) * 0.5 + yOff * 0.06
  const origin = new THREE.Vector3(startX, 0, startZ)
  const dir    = new THREE.Vector3(1, 0, 0)
  const segs   = []

  const t1 = rayHitFace(origin, dir, P[0], P[2])
  if (!t1) return segs
  const hit1 = origin.clone().addScaledVector(dir, t1)
  segs.push({
    from:  new THREE.Vector3(startX, yOff * 0.04, startZ),
    to:    new THREE.Vector3(hit1.x, yOff * 0.04, hit1.z),
    color,
  })

  const refracted1 = snellRefract(dir, FACE_LEFT_NORMAL.clone().negate(), N1_AIR, n2)
  if (!refracted1) return segs

  const t2 = rayHitFace(hit1, refracted1, P[2], P[1])
  if (!t2) return segs
  const hit2 = hit1.clone().addScaledVector(refracted1, t2)
  segs.push({
    from:  new THREE.Vector3(hit1.x, yOff * 0.04, hit1.z),
    to:    new THREE.Vector3(hit2.x, yOff * 0.04, hit2.z),
    color,
  })

  const refracted2 = snellRefract(refracted1, FACE_RIGHT_NORMAL.clone().negate(), n2, N1_AIR)
  if (!refracted2) return segs

  const endX = 6
  const t3   = (endX - hit2.x) / refracted2.x
  const end  = hit2.clone().addScaledVector(refracted2, t3)
  segs.push({
    from:  new THREE.Vector3(hit2.x, yOff * 0.04, hit2.z),
    to:    new THREE.Vector3(end.x,  yOff * 0.04, end.z),
    color,
  })
  return segs
}

// Build all ray segments + photon paths in one pass
function buildRayData() {
  const allSegs = []
  const paths   = []
  for (let i = 0; i < N_RAYS; i++) {
    const wl   = 380 + (i / (N_RAYS - 1)) * 340
    const segs = traceRay(wl, (i - N_RAYS / 2) * 0.5)
    allSegs.push(...segs)
    if (segs.length >= 2) {
      paths.push({
        points: [segs[0].from, ...segs.map(s => s.to)],
        color:  segs[0].color,
        delay:  i / N_RAYS,
      })
    }
  }
  return { allSegs, paths }
}

// ─── Animated photon pulse ───────────────────────────────────────────────────
function Photon({ points, color, delay }) {
  const ref  = useRef()
  const tRef = useRef(delay)

  useFrame((_, delta) => {
    tRef.current = (tRef.current + 0.22 * delta) % 1
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
      <sphereGeometry args={[0.038, 6, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function RayTracer() {
  const groupRef = useRef()

  const { allSegs, paths } = useMemo(() => buildRayData(), [])

  const lineGeos = useMemo(() =>
    allSegs.map((seg) => ({
      geo:   new THREE.BufferGeometry().setFromPoints([seg.from, seg.to]),
      color: seg.color,
    })), [allSegs])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08
  })

  const prismGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(P[0].x, P[0].z)
    shape.lineTo(P[1].x, P[1].z)
    shape.lineTo(P[2].x, P[2].z)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false })
    geo.rotateX(Math.PI / 2)
    geo.translate(0, -0.4, 0)
    return geo
  }, [])

  return (
    <group>
      <ambientLight intensity={0.08} color="#0a0a1a" />
      <directionalLight position={[0, 8, 4]} intensity={0.3} color="#fff8e0" />
      <pointLight position={[-5, 2, 0]} intensity={0.4} color="#fff8d0" distance={12} decay={2} />

      {/* Rotating prism */}
      <group ref={groupRef}>
        <mesh geometry={prismGeo}>
          <meshPhysicalMaterial
            color="#a0d8ef" transparent opacity={0.22}
            roughness={0.01} metalness={0} transmission={0.85} ior={1.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={prismGeo}>
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.12} />
        </mesh>
      </group>

      {/* Spectral ray fan */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={0.75} />
        </line>
      ))}

      {/* Animated photon pulses along each spectral ray */}
      {paths.map((p, i) => (
        <Photon key={i} points={p.points} color={p.color} delay={p.delay} />
      ))}
    </group>
  )
}
