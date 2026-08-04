import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Integrate Schwarzschild geodesic in polar coords (u = 1/r, φ)
// d²u/dφ² = -u + 3u² (geometric units, M=1 scaled by mass)
function integrateGeodesic(mass, r0, dr_dphi0, nSteps = 800) {
  const M  = mass * 0.15
  const u0 = 1 / r0
  let u = u0, uPrev = u0 - dr_dphi0 * u0 * u0 * 0.01
  const pts = []
  let phi = 0

  for (let i = 0; i < nSteps; i++) {
    phi += 0.02
    const d2u = -u + 3 * M * u * u
    const uNext = 2 * u - uPrev + d2u * (0.02 * 0.02)
    uPrev = u; u = uNext
    if (u <= 0 || 1/u < M * 1.5) break // inside horizon
    const r = Math.min(1 / u, 20)
    pts.push(new THREE.Vector3(r * Math.cos(phi), 0, r * Math.sin(phi)))
  }
  return pts
}

// Light ray: same equation but different initial conditions
function integrateLightRay(mass, bParam) {
  const M = mass * 0.15
  const r0 = bParam * 5 + 3
  const u0 = 1 / r0
  let u = u0 * 1.002, uPrev = u0 * 0.998
  const pts = []

  for (let i = 0; i < 1200; i++) {
    const d2u = -u + 3 * M * u * u
    const uNext = 2 * u - uPrev + d2u * 0.0004
    uPrev = u; u = uNext
    const phi = -Math.PI / 2 + i * 0.0004
    if (u <= 0 || 1/u < M * 1.5) break
    const r = Math.min(1 / u, 22)
    pts.push(new THREE.Vector3(r * Math.cos(phi), 0, r * Math.sin(phi)))
  }
  return pts
}

function OrbitLine({ pts, color, opacity = 0.9 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    return g
  }, [pts])
  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  )
}

// Animated particle on geodesic
function GeoParticle({ pts, color, speed = 0.3 }) {
  const ref  = useRef()
  const tRef = useRef(Math.random())
  useFrame((_, delta) => {
    tRef.current = (tRef.current + speed * delta) % 1.0
    const idx = Math.floor(tRef.current * (pts.length - 1))
    const p   = pts[idx]
    if (ref.current && p) ref.current.position.copy(p)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

export default function Geodesics({ mass }) {
  const timeRef = useRef(0)
  const starRef = useRef()

  const orbits = useMemo(() => [
    { pts: integrateGeodesic(mass, 5.0, 0.05,  800), color: '#00e5c4', speed: 0.18 },
    { pts: integrateGeodesic(mass, 3.5, 0.12,  800), color: '#f59e0b', speed: 0.28 },
    { pts: integrateGeodesic(mass, 7.0, 0.02,  800), color: '#a855f7', speed: 0.12 },
  ], [mass])

  const lightRays = useMemo(() => [
    integrateLightRay(mass, 0.2),
    integrateLightRay(mass, 0.6),
    integrateLightRay(mass, 1.0),
  ], [mass])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (starRef.current) {
      const s = 1 + 0.05 * Math.sin(timeRef.current * 2)
      starRef.current.scale.set(s, s, s)
    }
  })

  const M = mass * 0.15
  const rs = M * 1.5   // rough horizon

  return (
    <group>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 3, 0]} intensity={1.5} color="#fb923c" />
      <pointLight position={[5, 2, 5]} intensity={0.3} color="#00e5c4" />

      {/* Central mass */}
      <mesh ref={starRef} position={[0, 0, 0]}>
        <sphereGeometry args={[Math.max(rs, 0.2), 24, 24]} />
        <meshStandardMaterial
          color="#fb923c" emissive="#fb923c" emissiveIntensity={1.5}
          roughness={0} metalness={0}
        />
      </mesh>

      {/* Orbits */}
      {orbits.map((o, i) => (
        <group key={i}>
          <OrbitLine pts={o.pts} color={o.color} opacity={0.5} />
          <GeoParticle pts={o.pts} color={o.color} speed={o.speed} />
        </group>
      ))}

      {/* Light rays */}
      {lightRays.map((pts, i) => (
        <OrbitLine key={`lr${i}`} pts={pts} color="#ffffff" opacity={0.25} />
      ))}

      {/* Reference circle (Newtonian orbit, no precession) */}
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[5.0 - 0.01, 5.0 + 0.01, 128]} />
        <meshBasicMaterial color="#00e5c4" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
