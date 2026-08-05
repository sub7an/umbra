// 3D prism scene: spectral light rays refracted through a glass prism
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N_RAYS = 24  // spectral samples 380–720 nm

// Wavelength → approximate sRGB
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

// Cauchy index of refraction for glass
function cauchyN(wl) {
  return 1.458 + 3540 / (wl * wl)
}

// Snell refraction in 3D. Returns null on total internal reflection.
function snellRefract(dir, normal, n1, n2) {
  const d = dir.clone().normalize()
  const n = normal.clone().normalize()
  const cosI = -d.dot(n)
  const ratio = n1 / n2
  const sinT2 = ratio * ratio * (1 - cosI * cosI)
  if (sinT2 > 1) return null  // TIR
  const cosT = Math.sqrt(1 - sinT2)
  return d.clone().multiplyScalar(ratio).add(n.clone().multiplyScalar(ratio * cosI - cosT))
}

// Build the prism vertices (equilateral, apex up, lying in XZ plane)
// Prism: equilateral triangle, faces in XZ plane, extruded along Y
const PRISM_HALF = 1.8
const PRISM_H = PRISM_HALF * Math.sqrt(3)
const N1_AIR = 1.0003

// Triangle vertices (in XZ), Y = 0 (bottom face)
const P = [
  new THREE.Vector3(-PRISM_HALF, 0, PRISM_H * 2 / 3),   // A (bottom-left)
  new THREE.Vector3( PRISM_HALF, 0, PRISM_H * 2 / 3),   // B (bottom-right)
  new THREE.Vector3( 0,          0, -PRISM_H / 3),       // C (apex)
]
// Prism normals for each of the 3 faces (pointing outward)
// Face AB: normal pointing down-Z (bottom face, but we use left and right faces for refraction)
// Left face (AC): normal perpendicular to AC, pointing left
// Right face (BC): normal perpendicular to BC, pointing right
function faceNormal(a, b) {
  // Outward normal for edge a→b in XZ plane (points right of travel direction a→b when viewed from above)
  const d = new THREE.Vector3().subVectors(b, a).normalize()
  return new THREE.Vector3(d.z, 0, -d.x)  // perpendicular in XZ
}

const FACE_LEFT_NORMAL  = faceNormal(P[0], P[2]).negate()  // pointing left-outward
const FACE_RIGHT_NORMAL = faceNormal(P[2], P[1])           // pointing right-outward
const FACE_BOTTOM_NORMAL = new THREE.Vector3(0, 0, 1)       // pointing forward

// Ray-triangle-prism intersection helpers
// The prism is infinite in Y (we use a 2D cross-section approach for simplicity)
function rayHitFace(origin, dir, faceA, faceB, normal) {
  // Ray in XZ only, parametric t
  // Face is the segment from faceA to faceB
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

// Trace one ray through the prism, return array of [{from, to, color}] segments
function traceRay(wl, yOff) {
  const n2 = cauchyN(wl)
  const [r, g, b] = wlToRGB(wl)
  const color = new THREE.Color(r, g, b)

  // Incident ray: comes from left, hits left face (P[0]→P[2])
  const startX = -6
  const startZ = P[0].z + (P[2].z - P[0].z) * 0.5 + yOff * 0.06
  const origin = new THREE.Vector3(startX, 0, startZ)
  const dir = new THREE.Vector3(1, 0, 0)

  const segs = []

  // Hit left face
  const t1 = rayHitFace(origin, dir, P[0], P[2], FACE_LEFT_NORMAL)
  if (!t1) return segs
  const hit1 = origin.clone().addScaledVector(dir, t1)
  segs.push({ from: new THREE.Vector3(startX, yOff * 0.04, startZ), to: new THREE.Vector3(hit1.x, yOff * 0.04, hit1.z), color })

  // Refract into prism
  const leftNorm = FACE_LEFT_NORMAL.clone()
  const refracted1 = snellRefract(dir, leftNorm.negate(), N1_AIR, n2)
  if (!refracted1) return segs

  // Hit right face (P[2]→P[1])
  const t2 = rayHitFace(hit1, refracted1, P[2], P[1], FACE_RIGHT_NORMAL)
  if (!t2) return segs
  const hit2 = hit1.clone().addScaledVector(refracted1, t2)
  segs.push({ from: new THREE.Vector3(hit1.x, yOff * 0.04, hit1.z), to: new THREE.Vector3(hit2.x, yOff * 0.04, hit2.z), color })

  // Refract out of prism
  const rightNorm = FACE_RIGHT_NORMAL.clone()
  const refracted2 = snellRefract(refracted1, rightNorm.negate(), n2, N1_AIR)
  if (!refracted2) return segs

  // Extend output ray
  const endX = 6
  const t3 = (endX - hit2.x) / refracted2.x
  const end = hit2.clone().addScaledVector(refracted2, t3)
  segs.push({ from: new THREE.Vector3(hit2.x, yOff * 0.04, hit2.z), to: new THREE.Vector3(end.x, yOff * 0.04, end.z), color })

  return segs
}

function buildRayLines() {
  const allSegs = []
  for (let i = 0; i < N_RAYS; i++) {
    const wl = 380 + (i / (N_RAYS - 1)) * 340
    const segs = traceRay(wl, (i - N_RAYS / 2) * 0.5)
    allSegs.push(...segs)
  }
  return allSegs
}

export default function RayTracer() {
  const groupRef = useRef()

  const segments = useMemo(() => buildRayLines(), [])

  // Build line geometry
  const lineGeos = useMemo(() => {
    return segments.map((seg) => {
      const points = [seg.from, seg.to]
      const g = new THREE.BufferGeometry().setFromPoints(points)
      return { geo: g, color: seg.color }
    })
  }, [segments])

  // Animate prism with slow rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08
    }
  })

  // Prism geometry (extruded triangle)
  const prismGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(P[0].x, P[0].z)
    shape.lineTo(P[1].x, P[1].z)
    shape.lineTo(P[2].x, P[2].z)
    shape.closePath()
    const extrudeSettings = { depth: 0.8, bevelEnabled: false }
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geo.rotateX(Math.PI / 2)
    geo.translate(0, -0.4, 0)
    return geo
  }, [])

  return (
    <group>
      <ambientLight intensity={0.08} color="#0a0a1a" />
      <directionalLight position={[0, 8, 4]} intensity={0.3} color="#fff8e0" />
      <pointLight position={[-5, 2, 0]} intensity={0.4} color="#fff8d0" distance={12} decay={2} />

      {/* Prism (slowly rotates) */}
      <group ref={groupRef}>
        <mesh geometry={prismGeo}>
          <meshPhysicalMaterial
            color="#a0d8ef"
            transparent
            opacity={0.22}
            roughness={0.01}
            metalness={0.0}
            transmission={0.85}
            ior={1.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Prism wireframe */}
        <mesh geometry={prismGeo}>
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.12} />
        </mesh>
      </group>

      {/* Static ray fan — rays don't rotate with prism (approximation) */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={0.75} />
        </line>
      ))}
    </group>
  )
}
