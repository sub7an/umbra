// 3D convex lens with principal ray paths + animated photon pulses
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N_PARALLEL = 14

function buildLensRays(f) {
  const segs = []
  const lensX = 0

  for (let i = 0; i < N_PARALLEL; i++) {
    const y = (i / (N_PARALLEL - 1) - 0.5) * 4.0
    const col = new THREE.Color().lerpColors(
      new THREE.Color('#fcd34d'),
      new THREE.Color('#fb923c'),
      Math.abs(y) / 2.2
    )

    // Before lens (incoming parallel ray)
    segs.push({ from: new THREE.Vector3(-6, y, 0), to: new THREE.Vector3(lensX, y, 0), color: col })
    // After lens: converge to focal point
    segs.push({ from: new THREE.Vector3(lensX, y, 0), to: new THREE.Vector3(lensX + f, 0, 0), color: col })
    // Continue past focal (diverge)
    const dir = new THREE.Vector3(f, -y, 0).normalize()
    segs.push({
      from:  new THREE.Vector3(lensX + f, 0, 0),
      to:    new THREE.Vector3(lensX + f + dir.x * 3.0, dir.y * 3.0, 0),
      color: col.clone().multiplyScalar(0.40),
    })
  }
  return segs
}

// Group into per-ray paths for photon animation
function buildPhotonPaths(f) {
  const paths = []
  for (let i = 0; i < N_PARALLEL; i++) {
    const segs = [
      // mirror of buildLensRays but only the first 2 bright segments per ray
    ]
    const y = (i / (N_PARALLEL - 1) - 0.5) * 4.0
    const col = new THREE.Color().lerpColors(
      new THREE.Color('#fcd34d'),
      new THREE.Color('#fb923c'),
      Math.abs(y) / 2.2
    )
    const p0 = new THREE.Vector3(-6, y, 0)
    const p1 = new THREE.Vector3(0, y, 0)
    const p2 = new THREE.Vector3(f, 0, 0)
    const dir = new THREE.Vector3(f, -y, 0).normalize()
    const p3 = new THREE.Vector3(f + dir.x * 3.0, dir.y * 3.0, 0)
    paths.push({ points: [p0, p1, p2, p3], color: col, delay: i / N_PARALLEL })
  }
  return paths
}

// ─── Photon pulse ────────────────────────────────────────────────────────────
function Photon({ points, color, delay, speed = 0.20 }) {
  const ref  = useRef()
  const tRef = useRef(delay)

  useFrame((_, delta) => {
    tRef.current = (tRef.current + speed * delta) % 1
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

// ─── Lens mesh ───────────────────────────────────────────────────────────────
function LensMesh() {
  const geo = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -2.2, 0),
      new THREE.Vector3(0.38, -1.6, 0),
      new THREE.Vector3(0.54, -0.8, 0),
      new THREE.Vector3(0.60,  0,   0),
      new THREE.Vector3(0.54,  0.8, 0),
      new THREE.Vector3(0.38,  1.6, 0),
      new THREE.Vector3(0,     2.2, 0),
    ], false, 'catmullrom', 0.5)

    const lathePoints = path.getPoints(40)
    const g = new THREE.LatheGeometry(
      lathePoints.map(p => new THREE.Vector2(p.z + 0.60, p.y)),
      32
    )
    g.rotateZ(Math.PI / 2)
    return g
  }, [])

  return (
    <>
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color="#d4f0ff" transparent opacity={0.18}
          roughness={0.01} metalness={0} transmission={0.9} ior={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.08} />
      </mesh>
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LensLab({ f = 2.5 }) {
  const segments    = useMemo(() => buildLensRays(f), [f])
  const photonPaths = useMemo(() => buildPhotonPaths(f), [f])

  const lineGeos = useMemo(() => segments.map((s) => ({
    geo:   new THREE.BufferGeometry().setFromPoints([s.from, s.to]),
    color: s.color,
  })), [segments])

  const focalPos    = new THREE.Vector3(f,  0, 0)
  const focalPosNeg = new THREE.Vector3(-f, 0, 0)

  return (
    <group>
      <ambientLight intensity={0.10} color="#0a0a08" />
      <directionalLight position={[0, 8, 4]} intensity={0.35} color="#fff8e0" />
      <pointLight position={[f, 0, 0]} intensity={1.4} color="#fcd34d" distance={8} decay={2} />

      {/* Optical axis */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[14, 0.012, 0.012]} />
        <meshBasicMaterial color="white" transparent opacity={0.12} />
      </mesh>

      {/* Lens */}
      <LensMesh />

      {/* Ray lines */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={0.80} />
        </line>
      ))}

      {/* Animated photon pulses */}
      {photonPaths.map((p, i) => (
        <Photon key={i} points={p.points} color={p.color} delay={p.delay} />
      ))}

      {/* Focal point markers */}
      {[focalPos, focalPosNeg].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color="#fcd34d" />
          </mesh>
          <pointLight color="#fcd34d" intensity={0.6} distance={3} decay={2} />
        </group>
      ))}
    </group>
  )
}
