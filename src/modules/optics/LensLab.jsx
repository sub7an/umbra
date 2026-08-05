// 3D convex lens with principal ray paths
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const FOCAL_LENGTH = 2.5
const N_PARALLEL = 12  // number of parallel rays

function buildLensRays(f) {
  const segs = []
  const lensX = 0
  const colors = {
    parallel: new THREE.Color('#fcd34d'),  // yellow
    focal:    new THREE.Color('#22d3ee'),  // cyan
    center:   new THREE.Color('#f472b6'),  // pink
  }

  // Parallel rays coming from left → converge at focal point
  for (let i = 0; i < N_PARALLEL; i++) {
    const y = (i / (N_PARALLEL - 1) - 0.5) * 3.5
    const col = new THREE.Color().lerpColors(new THREE.Color('#fcd34d'), new THREE.Color('#fb923c'), Math.abs(y) / 2)

    // Before lens
    segs.push({ from: new THREE.Vector3(-5, y, 0), to: new THREE.Vector3(lensX, y, 0), color: col })

    // After lens: converge to focal point
    const fx = lensX + f
    segs.push({ from: new THREE.Vector3(lensX, y, 0), to: new THREE.Vector3(fx, 0, 0), color: col })
    // Continue past focal point (diverge)
    const dir = new THREE.Vector3(fx - lensX, -y, 0).normalize()
    segs.push({
      from: new THREE.Vector3(fx, 0, 0),
      to: new THREE.Vector3(fx + dir.x * 2.5, dir.y * 2.5, 0),
      color: col.clone().multiplyScalar(0.45),
    })
  }

  return segs
}

function LensMesh({ f }) {
  const geo = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -2, 0),
      new THREE.Vector3(0.35, -1.5, 0),
      new THREE.Vector3(0.5, -0.8, 0),
      new THREE.Vector3(0.55, 0, 0),
      new THREE.Vector3(0.5, 0.8, 0),
      new THREE.Vector3(0.35, 1.5, 0),
      new THREE.Vector3(0, 2, 0),
    ], false, 'catmullrom', 0.5)

    const lathePoints = path.getPoints(40)
    const geo = new THREE.LatheGeometry(
      lathePoints.map(p => new THREE.Vector2(p.z + 0.55, p.y)),
      32
    )
    geo.rotateZ(Math.PI / 2)
    return geo
  }, [])

  return (
    <>
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color="#d4f0ff"
          transparent
          opacity={0.18}
          roughness={0.01}
          metalness={0}
          transmission={0.9}
          ior={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.08} />
      </mesh>
    </>
  )
}

export default function LensLab() {
  const f = FOCAL_LENGTH
  const segments = useMemo(() => buildLensRays(f), [f])

  const lineGeos = useMemo(() => segments.map((s) => ({
    geo: new THREE.BufferGeometry().setFromPoints([s.from, s.to]),
    color: s.color,
  })), [segments])

  // Focal point marker
  const focalPos = new THREE.Vector3(f, 0, 0)
  const focalPosNeg = new THREE.Vector3(-f, 0, 0)

  return (
    <group>
      <ambientLight intensity={0.10} color="#0a0a08" />
      <directionalLight position={[0, 8, 4]} intensity={0.35} color="#fff8e0" />
      <pointLight position={[f, 0, 0]} intensity={1.2} color="#fcd34d" distance={8} decay={2} />

      {/* Optical axis */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[12, 0.01, 0.01]} />
        <meshBasicMaterial color="rgba(255,255,255,0.1)" transparent opacity={0.15} />
      </mesh>

      {/* Lens */}
      <LensMesh f={f} />

      {/* Rays */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={0.8} />
        </line>
      ))}

      {/* Focal point markers */}
      {[focalPos, focalPosNeg].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color="#fcd34d" />
          </mesh>
          <pointLight color="#fcd34d" intensity={0.5} distance={3} decay={2} />
        </group>
      ))}
    </group>
  )
}
