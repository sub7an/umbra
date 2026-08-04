import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 2D SPH dam break
// N particles stacked in a tall column, collapse under gravity

const COLS  = 7
const ROWS  = 28
const N     = COLS * ROWS   // 196
const H     = 0.55          // smoothing length
const H2    = H * H
const MASS  = 1.0
const RHO0  = 17.0          // rest density (matches grid packing)
const K_P   = 100.0         // pressure stiffness
const MU    = 0.12          // viscosity
const XMIN  = -5.5, XMAX = 5.5
const YMIN  = -5.5, YMAX = 5.5

// 2D Poly6 kernel: W(r,h) = (4/πh⁸)(h²−r²)³
const POLY6_C = 4.0 / (Math.PI * Math.pow(H, 8))
function poly6(r2) {
  if (r2 >= H2) return 0
  const d = H2 - r2
  return POLY6_C * d * d * d
}

// 2D Spiky gradient magnitude: dW/dr = -(10/πh⁵)(h−r)²
const SPIKY_C = -10.0 / (Math.PI * Math.pow(H, 5))
function spikyGrad(r) {
  if (r >= H || r < 1e-5) return 0
  const d = H - r
  return SPIKY_C * d * d
}

// 2D Viscosity Laplacian: ∇²W = (40/πh⁵)(h−r)
const VISC_C = 40.0 / (Math.PI * Math.pow(H, 5))
function viscLap(r) {
  if (r >= H) return 0
  return VISC_C * (H - r)
}

export default function SPH({ reynolds }) {
  const geoRef = useRef()
  const simRef = useRef(null)

  const gravity = 7 + reynolds * 2.5

  // Build initial state (tall column on left)
  const col = useMemo(() => new Float32Array(N * 3), [])

  if (!simRef.current) {
    const spacingX = 1.5 / (COLS - 1)
    const spacingY = 6.5 / (ROWS - 1)
    const pos = new Float32Array(N * 2)
    const vel = new Float32Array(N * 2)
    let idx = 0
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        pos[idx * 2]     = -5.0 + col * spacingX + (Math.random() - 0.5) * 0.02
        pos[idx * 2 + 1] = -5.0 + row * spacingY + (Math.random() - 0.5) * 0.02
        idx++
      }
    }
    simRef.current = { pos, vel }
  }

  const pos3 = useMemo(() => new Float32Array(N * 3), [])

  const prevRe = useRef(reynolds)

  useFrame((_, delta) => {
    if (!simRef.current) return
    const { pos, vel } = simRef.current
    const g = 7 + reynolds * 2.5
    const substeps = 3
    const dt = Math.min(delta, 0.04) / substeps

    for (let step = 0; step < substeps; step++) {
      // 1. Compute densities
      const rho = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        const xi = pos[i * 2], yi = pos[i * 2 + 1]
        for (let j = 0; j < N; j++) {
          const dx = pos[j * 2] - xi, dy = pos[j * 2 + 1] - yi
          rho[i] += MASS * poly6(dx * dx + dy * dy)
        }
      }

      // 2. Compute accelerations
      const ax = new Float32Array(N)
      const ay = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        ay[i] = -g
        const pi = Math.max(K_P * (rho[i] - RHO0), 0)
        const xi = pos[i * 2], yi = pos[i * 2 + 1]
        const rhoi = Math.max(rho[i], 0.001)

        for (let j = 0; j < N; j++) {
          if (j === i) continue
          const dx = pos[j * 2] - xi, dy = pos[j * 2 + 1] - yi
          const r2 = dx * dx + dy * dy
          if (r2 >= H2 || r2 < 1e-8) continue
          const r    = Math.sqrt(r2)
          const rhoj = Math.max(rho[j], 0.001)

          // Pressure
          const pj   = Math.max(K_P * (rho[j] - RHO0), 0)
          const gW   = spikyGrad(r)
          const pFac = -MASS * (pi / (rhoi * rhoi) + pj / (rhoj * rhoj)) * gW
          ax[i] += pFac * dx / r
          ay[i] += pFac * dy / r

          // Viscosity
          const lapW = viscLap(r)
          const vFac = MU * MASS * lapW / rhoj
          ax[i] += vFac * (vel[j * 2]     - vel[i * 2])
          ay[i] += vFac * (vel[j * 2 + 1] - vel[i * 2 + 1])
        }
      }

      // 3. Integrate + boundary
      for (let i = 0; i < N; i++) {
        vel[i * 2]     += ax[i] * dt
        vel[i * 2 + 1] += ay[i] * dt

        // Clamp velocity
        const sp = Math.sqrt(vel[i * 2] ** 2 + vel[i * 2 + 1] ** 2)
        if (sp > 20) { vel[i * 2] *= 20 / sp; vel[i * 2 + 1] *= 20 / sp }

        pos[i * 2]     += vel[i * 2]     * dt
        pos[i * 2 + 1] += vel[i * 2 + 1] * dt

        // Elastic walls with damping
        if (pos[i * 2] < XMIN) { pos[i * 2] = XMIN; vel[i * 2] = Math.abs(vel[i * 2]) * 0.4 }
        if (pos[i * 2] > XMAX) { pos[i * 2] = XMAX; vel[i * 2] = -Math.abs(vel[i * 2]) * 0.4 }
        if (pos[i * 2 + 1] < YMIN) { pos[i * 2 + 1] = YMIN; vel[i * 2 + 1] = Math.abs(vel[i * 2 + 1]) * 0.4 }
        if (pos[i * 2 + 1] > YMAX) { pos[i * 2 + 1] = YMAX; vel[i * 2 + 1] = -Math.abs(vel[i * 2 + 1]) * 0.4 }
      }

      // Color by density (blue→cyan→white)
      let maxRho = 0.001
      for (let i = 0; i < N; i++) if (rho[i] > maxRho) maxRho = rho[i]
      for (let i = 0; i < N; i++) {
        const t = Math.min(rho[i] / Math.max(maxRho, 1), 1)
        pos3[i * 3]     = pos[i * 2]
        pos3[i * 3 + 1] = pos[i * 2 + 1]
        pos3[i * 3 + 2] = 0
        if (t < 0.5) {
          const s = t * 2
          col[i * 3]     = 0.05 + s * 0.12
          col[i * 3 + 1] = 0.2  + s * 0.63
          col[i * 3 + 2] = 0.65 + s * 0.10
        } else {
          const s = (t - 0.5) * 2
          col[i * 3]     = 0.17 + s * 0.83
          col[i * 3 + 1] = 0.83 + s * 0.17
          col[i * 3 + 2] = 0.75 + s * 0.25
        }
      }
    }

    const geo = geoRef.current
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate    = true
    }
  })

  return (
    <group>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3, 6]} intensity={0.5} color="#2dd4bf" />

      {/* Domain boundary */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry((XMAX - XMIN), (YMAX - YMIN), 0.1)]} />
        <lineBasicMaterial color="#2dd4bf" transparent opacity={0.12} />
      </lineSegments>

      {/* Particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos3, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.14} vertexColors transparent opacity={0.9}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}
