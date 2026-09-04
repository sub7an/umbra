import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SIZE = 10
const GRID = 36

// ─── Physics helpers ────────────────────────────────────────────────────────

function warpY(x, z, mass) {
  const r = Math.sqrt(x * x + z * z)
  return -mass / (r + 0.6)
}

// Massive-particle geodesic: d²u/dφ² = -u + 3Mu²
function integrateGeodesic(mass, r0, vTangential, nSteps = 1800, dphi = 0.014) {
  const M = mass * 0.15
  const u0 = 1 / r0
  let u = u0
  let uPrev = u0 * (1 - vTangential * dphi)
  const pts = []
  for (let i = 0; i < nSteps; i++) {
    const phi = i * dphi
    const d2u = -u + 3 * M * u * u
    const uNext = 2 * u - uPrev + d2u * dphi * dphi
    uPrev = u; u = uNext
    if (u <= 0 || 1 / u < M * 2.1) break
    const r = Math.min(1 / u, SIZE - 1)
    const x = r * Math.cos(phi), z = r * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
  }
  return pts
}

// Null geodesic (light): d²u/dφ² = 3Mu² - u
function integrateLightRay(mass, bScale, phiOffset = 0) {
  const M  = mass * 0.15
  const bCrit = 5.196 * M          // critical impact parameter
  const b  = bCrit * bScale         // bScale > 1 → escapes, < 1 → captured

  const rStart = 14
  const u0     = 1 / rStart
  const disc   = 1 / (b * b) - u0 * u0 * (1 - 2 * M * u0)
  if (disc < 0) return []
  const dudphi0 = Math.sqrt(disc)

  let u = u0, uPrev = u0 - dudphi0 * 0.004
  const pts = []
  let peaked = false

  for (let i = 0; i < 3500; i++) {
    const phi = i * 0.004
    const d2u = 3 * M * u * u - u
    const uNext = 2 * u - uPrev + d2u * 0.000016
    uPrev = u; u = uNext

    if (u <= 0 || 1 / u < M * 2.1) break
    const r = Math.min(1 / u, SIZE + 4)
    const rawX = r * Math.cos(phi), rawZ = r * Math.sin(phi)
    // rotate around Y by phiOffset
    const x = rawX * Math.cos(phiOffset) - rawZ * Math.sin(phiOffset)
    const z = rawX * Math.sin(phiOffset) + rawZ * Math.cos(phiOffset)
    pts.push([x, warpY(x, z, mass) + 0.06, z])

    if (r < rStart - 1 && !peaked) peaked = true
    if (peaked && r > rStart - 0.5) break
  }
  return pts
}

// Newtonian reference orbit (perfect ellipse, no precession)
function newtonianOrbit(r0, mass, nPts = 256) {
  const pts = []
  for (let i = 0; i <= nPts; i++) {
    const phi = (i / nPts) * Math.PI * 2
    const x = r0 * Math.cos(phi), z = r0 * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
  }
  return pts
}

// ─── Background warped surface ───────────────────────────────────────────────

const SURF_VERT = `
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SURF_FRAG = `
  varying float vH;
  void main() {
    float t = clamp(-vH * 0.38, 0.0, 1.0);
    vec3 col = mix(vec3(0.04, 0.08, 0.18), vec3(0.26, 0.10, 0.02), t);
    gl_FragColor = vec4(col, 0.30);
  }
`

function BackgroundSurface({ mass }) {
  const { surfGeo, wireGeo } = useMemo(() => {
    const N = GRID + 1
    const posArr = new Float32Array(N * N * 3)
    const idxArr = []
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = (iz * N + ix) * 3
        const x = (ix / GRID - 0.5) * SIZE * 2
        const z = (iz / GRID - 0.5) * SIZE * 2
        posArr[k]   = x
        posArr[k+1] = warpY(x, z, mass)
        posArr[k+2] = z
      }
    }
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const a = iz * N + ix
        idxArr.push(a, a+1, a+N, a+1, a+N+1, a+N)
      }
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    sg.setIndex(idxArr)

    // Wireframe grid (lineSegments pairs)
    const G = 18
    const wirePts = []
    for (let i = 0; i <= G; i++) {
      const s = (i / G - 0.5) * SIZE * 2
      for (let j = 0; j < G; j++) {
        const a = (j / G - 0.5) * SIZE * 2
        const b = ((j+1) / G - 0.5) * SIZE * 2
        wirePts.push(a, warpY(a, s, mass) + 0.02, s, b, warpY(b, s, mass) + 0.02, s)
        wirePts.push(s, warpY(s, a, mass) + 0.02, a, s, warpY(s, b, mass) + 0.02, b)
      }
    }
    const wg = new THREE.BufferGeometry()
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wirePts), 3))

    return { surfGeo: sg, wireGeo: wg }
  }, [mass])

  return (
    <group>
      <mesh geometry={surfGeo} frustumCulled={false}>
        <shaderMaterial vertexShader={SURF_VERT} fragmentShader={SURF_FRAG}
          side={THREE.DoubleSide} transparent depthWrite={false} />
      </mesh>
      <lineSegments geometry={wireGeo} frustumCulled={false}>
        <lineBasicMaterial color="#1e3a5f" transparent opacity={0.22} />
      </lineSegments>
    </group>
  )
}

// ─── Special radius rings ────────────────────────────────────────────────────

function RadiusRing({ r, mass, color, opacity = 0.6 }) {
  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 128; i++) {
      const phi = (i / 128) * Math.PI * 2
      const x = r * Math.cos(phi), z = r * Math.sin(phi)
      pts.push(new THREE.Vector3(x, warpY(x, z, mass) + 0.08, z))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [r, mass])

  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

// ─── Geodesic orbit line ─────────────────────────────────────────────────────

function OrbitLine({ pts, color, opacity = 0.18 }) {
  const geo = useMemo(() => {
    const arr = new Float32Array(pts.length * 3)
    pts.forEach(([x, y, z], i) => { arr[i*3]=x; arr[i*3+1]=y; arr[i*3+2]=z })
    return new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(arr, 3)
    )
  }, [pts])
  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

// ─── Particle with glowing trail ─────────────────────────────────────────────

const TRAIL = 90

function GeoParticle({ pts, color, speed }) {
  const dotRef   = useRef()
  const trailRef = useRef()
  const tRef     = useRef(Math.random())

  const trailGeo = useMemo(() => {
    const arr = new Float32Array((TRAIL + 1) * 3)
    const p = pts[0] || [0, 0, 0]
    for (let i = 0; i <= TRAIL; i++) { arr[i*3]=p[0]; arr[i*3+1]=p[1]; arr[i*3+2]=p[2] }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [pts])

  useFrame((_, delta) => {
    tRef.current = (tRef.current + speed * delta) % 1
    const idx = Math.floor(tRef.current * pts.length)

    const p = pts[idx]
    if (!p) return
    dotRef.current?.position.set(p[0], p[1], p[2])

    const pos = trailRef.current?.geometry.attributes.position
    if (!pos) return
    for (let i = 0; i <= TRAIL; i++) {
      const ti = (idx - i + pts.length) % pts.length
      const tp = pts[ti]
      pos.setXYZ(i, tp[0], tp[1], tp[2])
    }
    pos.needsUpdate = true
  })

  return (
    <group>
      <line ref={trailRef} geometry={trailGeo} frustumCulled={false}>
        <lineBasicMaterial color={color} transparent opacity={0.75} />
      </line>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.10, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

// ─── Animated photon pulse on a light ray ────────────────────────────────────

function PhotonPulse({ pts, color = '#ffffff', speed = 0.12 }) {
  const ref  = useRef()
  const tRef = useRef(Math.random())

  useFrame((_, delta) => {
    tRef.current = (tRef.current + speed * delta) % 1
    const idx = Math.floor(tRef.current * (pts.length - 1))
    const p   = pts[idx]
    if (ref.current && p) ref.current.position.set(p[0], p[1], p[2])
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Geodesics({ mass }) {
  const starRef = useRef()
  const tRef    = useRef(0)
  const M       = mass * 0.15

  const { orbits, lightRays } = useMemo(() => {
    const orbits = [
      {
        pts:   integrateGeodesic(mass, 4.8, 0.09, 2200, 0.013),
        color: '#f59e0b', speed: 0.16,
        label: 'Tight precessing orbit',
      },
      {
        pts:   integrateGeodesic(mass, 3.2, 0.18, 2200, 0.013),
        color: '#f59e0b', speed: 0.26,
        label: 'Strong GR precession',
      },
      {
        pts:   integrateGeodesic(mass, 7.0, 0.04, 1400, 0.016),
        color: '#a855f7', speed: 0.10,
        label: 'Wide stable orbit',
      },
    ]
    const lightRays = [
      { pts: integrateLightRay(mass, 1.3, 0),              color: '#ffffff' },
      { pts: integrateLightRay(mass, 2.0, Math.PI * 0.55), color: '#a5f3fc' },
      { pts: integrateLightRay(mass, 3.8, Math.PI * 1.10), color: '#7dd3fc' },
    ]
    return { orbits, lightRays }
  }, [mass])

  // Newtonian reference orbit (same radius as cyan orbit)
  const newtonPts = useMemo(() => newtonianOrbit(4.8, mass), [mass])

  useFrame((_, delta) => {
    tRef.current += delta
    if (starRef.current) {
      const s = 1 + 0.06 * Math.sin(tRef.current * 2.4)
      starRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={2.2} color="#fb923c" />
      <pointLight position={[4, 3, 5]} intensity={0.4} color="#f59e0b" />

      {/* Curved spacetime background */}
      <BackgroundSurface mass={mass} />

      {/* ── Special radii ─────────────────────────────── */}
      {/* Event horizon r = 2M */}
      <RadiusRing r={2 * M} mass={mass} color="#ff4040" opacity={0.70} />
      {/* Photon sphere r = 3M */}
      <RadiusRing r={3 * M} mass={mass} color="#fbbf24" opacity={0.55} />
      {/* ISCO r = 6M */}
      <RadiusRing r={6 * M} mass={mass} color="#f59e0b" opacity={0.30} />

      {/* ── Newtonian reference (closed circle, no precession) ── */}
      <OrbitLine pts={newtonPts} color="#94a3b8" opacity={0.20} />

      {/* ── GR geodesic orbits ────────────────────────── */}
      {orbits.map((o, i) => (
        <group key={i}>
          <OrbitLine pts={o.pts} color={o.color} opacity={0.14} />
          <GeoParticle pts={o.pts} color={o.color} speed={o.speed} />
        </group>
      ))}

      {/* ── Bent light rays ───────────────────────────── */}
      {lightRays.map((lr, i) => (
        lr.pts.length > 2 && (
          <group key={`lr${i}`}>
            <OrbitLine pts={lr.pts} color={lr.color} opacity={0.28} />
            <PhotonPulse pts={lr.pts} color={lr.color} speed={0.10 + i * 0.03} />
          </group>
        )
      ))}

      {/* ── Central mass ──────────────────────────────── */}
      <mesh ref={starRef} position={[0, warpY(0, 0, mass) + M * 0.4, 0]}>
        <sphereGeometry args={[Math.max(M * 1.2, 0.18), 28, 28]} />
        <meshStandardMaterial
          color="#fb923c" emissive="#fb923c" emissiveIntensity={1.8}
          roughness={0} metalness={0}
        />
      </mesh>
    </group>
  )
}
