import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const U_BASE  = 1.5
const R       = 1.2
const CORE    = 0.35
const MAX_V   = 80
const N_TRACE = 600

// Potential flow velocity around cylinder
function potentialFlow(x, y, U) {
  const r2 = x * x + y * y
  if (r2 <= R * R) return [0, 0]
  const r4 = r2 * r2
  return [
    U * (1 - R * R * (x * x - y * y) / r4),
    -U * R * R * 2 * x * y / r4,
  ]
}

// Biot-Savart velocity from vortex array at a point
function bsVel(px, py, vxA, vyA, gA, count) {
  let vx = 0, vy = 0
  for (let k = 0; k < count; k++) {
    const dx = px - vxA[k], dy = py - vyA[k]
    const r2 = dx * dx + dy * dy + CORE * CORE
    vx -= gA[k] * dy / (2 * Math.PI * r2)
    vy += gA[k] * dx / (2 * Math.PI * r2)
  }
  return [vx, vy]
}

export default function VortexShedding({ reynolds }) {
  const Gamma       = 2.0 + reynolds * 0.8
  const sheddingDt  = Math.max(0.15, 0.55 - reynolds * 0.1)

  const vxA  = useRef(new Float32Array(MAX_V))
  const vyA  = useRef(new Float32Array(MAX_V))
  const gA   = useRef(new Float32Array(MAX_V))
  const vCnt = useRef(0)
  const shed = useRef(0)
  const pha  = useRef(0)

  const vGeoRef = useRef()
  const tGeoRef = useRef()

  const { vPos, vCol, tPos, tCol } = useMemo(() => {
    const vPos = new Float32Array(MAX_V * 3)
    const vCol = new Float32Array(MAX_V * 3)
    // Init vortex positions off-screen
    for (let i = 0; i < MAX_V; i++) { vPos[i * 3] = 1000; vPos[i * 3 + 1] = 0; vPos[i * 3 + 2] = 0 }
    const tPos = new Float32Array(N_TRACE * 3)
    const tCol = new Float32Array(N_TRACE * 3)
    for (let i = 0; i < N_TRACE; i++) {
      tPos[i * 3]     = (Math.random() - 0.3) * 18
      tPos[i * 3 + 1] = (Math.random() - 0.5) * 10
      tPos[i * 3 + 2] = 0
      tCol[i * 3] = 0.17; tCol[i * 3 + 1] = 0.83; tCol[i * 3 + 2] = 0.75
    }
    return { vPos, vCol, tPos, tCol }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04)
    const U  = U_BASE

    // Shed vortex
    shed.current += dt
    if (shed.current >= sheddingDt && vCnt.current < MAX_V - 1) {
      shed.current = 0
      const n = vCnt.current
      vxA.current[n] = -0.3
      vyA.current[n] = pha.current === 0 ? R + 0.15 : -(R + 0.15)
      gA.current[n]  = pha.current === 0 ? -Gamma : Gamma
      vCnt.current++
      pha.current = 1 - pha.current
    }

    const n = vCnt.current
    const vxa = vxA.current, vya = vyA.current, ga = gA.current

    // Advect vortices (Euler step with clamping)
    const nx = new Float32Array(n), ny = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const [fx, fy] = potentialFlow(vxa[i], vya[i], U)
      const [bx, by] = bsVel(vxa[i], vya[i], vxa, vya, ga, n)
      const spd = Math.sqrt((fx + bx) ** 2 + (fy + by) ** 2)
      const clamp = Math.min(1, 6 / (spd + 0.01))
      nx[i] = vxa[i] + (fx + bx) * clamp * dt
      ny[i] = vya[i] + (fy + by) * clamp * dt
    }

    // Apply + remove out-of-bounds
    let i = 0
    while (i < vCnt.current) {
      if (nx[i] > 14 || nx[i] < -4 || Math.abs(ny[i]) > 8 ||
          nx[i] * nx[i] + ny[i] * ny[i] < R * R * 0.7) {
        const last = vCnt.current - 1
        vxa[i] = vxa[last]; vya[i] = vya[last]; ga[i] = ga[last]
        nx[i]  = nx[last];  ny[i]  = ny[last]
        vCnt.current--
      } else {
        vxa[i] = nx[i]; vya[i] = ny[i]; i++
      }
    }

    // Update vortex display
    const vGeo = vGeoRef.current
    if (vGeo) {
      for (let k = 0; k < MAX_V; k++) {
        if (k < vCnt.current) {
          vPos[k * 3] = vxa[k]; vPos[k * 3 + 1] = vya[k]; vPos[k * 3 + 2] = 0.1
          const pos = ga[k] > 0
          vCol[k * 3]     = pos ? 0.1 : 1.0
          vCol[k * 3 + 1] = pos ? 0.45 : 0.15
          vCol[k * 3 + 2] = pos ? 1.0  : 0.1
        } else {
          vPos[k * 3] = 1000  // hide inactive
        }
      }
      vGeo.attributes.position.needsUpdate = true
      vGeo.attributes.color.needsUpdate    = true
    }

    // Advect tracers
    const tGeo = tGeoRef.current
    for (let i = 0; i < N_TRACE; i++) {
      const tx = tPos[i * 3], ty = tPos[i * 3 + 1]
      const [fx, fy] = potentialFlow(tx, ty, U)
      const [bx, by] = bsVel(tx, ty, vxa, vya, ga, vCnt.current)

      let ox = tx + (fx + bx) * dt, oy = ty + (fy + by) * dt

      const inCyl = ox * ox + oy * oy < R * R * 0.8
      const out   = ox > 11 || ox < -10 || Math.abs(oy) > 6
      if (inCyl || out) {
        ox = -9 + Math.random() * 0.5
        oy = (Math.random() - 0.5) * 10
      }

      tPos[i * 3] = ox; tPos[i * 3 + 1] = oy

      // Color by local vorticity (sum gamma / distance²)
      let curl = 0
      for (let k = 0; k < vCnt.current; k++) {
        const dx = ox - vxa[k], dy = oy - vya[k]
        curl += ga[k] / (dx * dx + dy * dy + 1.2)
      }
      const c = Math.tanh(curl * 0.6)  // -1 to 1
      if (c > 0) {
        tCol[i * 3]     = 0.17 + c * 0.83
        tCol[i * 3 + 1] = 0.83 - c * 0.63
        tCol[i * 3 + 2] = 0.75 - c * 0.65
      } else {
        tCol[i * 3]     = 0.1 + c * (-0.0)
        tCol[i * 3 + 1] = 0.45 - c * 0.35
        tCol[i * 3 + 2] = 1.0
      }
    }
    if (tGeo) {
      tGeo.attributes.position.needsUpdate = true
      tGeo.attributes.color.needsUpdate    = true
    }
  })

  return (
    <group>
      <ambientLight intensity={0.25} />

      {/* Cylinder fill */}
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[R, 48]} />
        <meshBasicMaterial color="#070d14" />
      </mesh>
      {/* Cylinder rim */}
      <mesh>
        <ringGeometry args={[R - 0.01, R + 0.07, 48]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Vortex cores */}
      <points>
        <bufferGeometry ref={vGeoRef}>
          <bufferAttribute attach="attributes-position" args={[vPos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[vCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.28} vertexColors transparent opacity={0.95}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>

      {/* Tracer field */}
      <points>
        <bufferGeometry ref={tGeoRef}>
          <bufferAttribute attach="attributes-position" args={[tPos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[tCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} vertexColors transparent opacity={0.65}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}
