import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── 3D SPH — Navier-Stokes via Smoothed Particle Hydrodynamics ─────────────
// 216 particles (6×6×6 cube) collapsing as a dam break in a 3D box.
// Kernels: Müller 2003 (Poly6 density, Spiky pressure, Viscosity Laplacian)

const COLS  = 6, ROWS  = 6, DEPTH = 6
const N     = COLS * ROWS * DEPTH   // 216
const H     = 0.90                   // smoothing radius
const H2    = H * H
const MASS  = 1.0
const RHO0  = 14.0                   // 3D rest density
const K_P   = 90.0                   // pressure stiffness
const MU    = 0.16                   // viscosity
const XMIN  = -5, XMAX = 5
const YMIN  = -5, YMAX = 5
const ZMIN  = -3.5, ZMAX = 3.5
const DAMP  = 0.38

// Müller 2003 kernels (3D)
const POLY6_C =  315.0 / (64.0 * Math.PI * Math.pow(H, 9))
const SPIKY_C =   45.0 / (Math.PI * Math.pow(H, 6))   // pressure gradient magnitude
const VISC_C  =   45.0 / (Math.PI * Math.pow(H, 6))   // viscosity laplacian

function poly6(r2) {
  if (r2 >= H2) return 0
  const d = H2 - r2
  return POLY6_C * d * d * d
}

function spikyGrad(r) {
  if (r >= H || r < 1e-5) return 0
  const d = H - r
  return -SPIKY_C * d * d   // negative → repulsive push
}

function viscLap(r) {
  if (r >= H) return 0
  return VISC_C * (H - r)
}

function initParticles() {
  const pos = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const sX  = 1.8 / Math.max(COLS - 1, 1)
  const sY  = 4.2 / Math.max(ROWS - 1, 1)
  const sZ  = 3.0 / Math.max(DEPTH - 1, 1)
  let k = 0
  for (let d = 0; d < DEPTH; d++) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        pos[k*3]   = -4.8 + c * sX + (Math.random()-0.5) * 0.05
        pos[k*3+1] = -4.8 + r * sY + (Math.random()-0.5) * 0.05
        pos[k*3+2] = -1.5 + d * sZ + (Math.random()-0.5) * 0.05
        vel[k*3]   =  0.4 + Math.random() * 0.6   // initial push (+X = dam break)
        k++
      }
    }
  }
  return { pos, vel }
}

export default function SPH({ reynolds }) {
  const geoRef = useRef()
  const simRef = useRef(null)

  if (!simRef.current) simRef.current = initParticles()

  const pos3 = useMemo(() => new Float32Array(N * 3), [])
  const col  = useMemo(() => new Float32Array(N * 3), [])

  useFrame((_, delta) => {
    if (!simRef.current || !geoRef.current) return
    const { pos, vel } = simRef.current
    const g       = 6.0 + reynolds * 3.5
    const substeps = 3
    const dt      = Math.min(delta, 0.033) / substeps

    for (let step = 0; step < substeps; step++) {
      // — Density ————————————————————————————————
      const rho = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        const xi = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2]
        for (let j = 0; j < N; j++) {
          const dx = pos[j*3]-xi, dy = pos[j*3+1]-yi, dz = pos[j*3+2]-zi
          rho[i] += MASS * poly6(dx*dx + dy*dy + dz*dz)
        }
      }

      // — Forces —————————————————————————————————
      const ax = new Float32Array(N)
      const ay = new Float32Array(N)
      const az = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        ay[i] = -g
        const pi   = Math.max(K_P * (rho[i] - RHO0), 0)
        const xi   = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2]
        const rhoi = Math.max(rho[i], 0.01)
        for (let j = 0; j < N; j++) {
          if (j === i) continue
          const dx = pos[j*3]-xi, dy = pos[j*3+1]-yi, dz = pos[j*3+2]-zi
          const r2 = dx*dx + dy*dy + dz*dz
          if (r2 >= H2 || r2 < 1e-8) continue
          const r    = Math.sqrt(r2)
          const rhoj = Math.max(rho[j], 0.01)
          const pj   = Math.max(K_P * (rho[j] - RHO0), 0)
          // Pressure (SPH symmetric form)
          const gW   = spikyGrad(r) / r
          const pFac = MASS * (pi/(rhoi*rhoi) + pj/(rhoj*rhoj)) * gW
          ax[i] += pFac * dx; ay[i] += pFac * dy; az[i] += pFac * dz
          // Viscosity
          const vFac = MU * MASS * viscLap(r) / rhoj
          ax[i] += vFac * (vel[j*3]   - vel[i*3])
          ay[i] += vFac * (vel[j*3+1] - vel[i*3+1])
          az[i] += vFac * (vel[j*3+2] - vel[i*3+2])
        }
      }

      // — Integrate + 3D wall boundaries ————————
      for (let i = 0; i < N; i++) {
        vel[i*3]   += ax[i] * dt
        vel[i*3+1] += ay[i] * dt
        vel[i*3+2] += az[i] * dt
        // Speed cap
        const sp = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2)
        if (sp > 24) { const f = 24/sp; vel[i*3]*=f; vel[i*3+1]*=f; vel[i*3+2]*=f }
        pos[i*3]   += vel[i*3]   * dt
        pos[i*3+1] += vel[i*3+1] * dt
        pos[i*3+2] += vel[i*3+2] * dt
        // Elastic walls
        if (pos[i*3]   < XMIN) { pos[i*3]   = XMIN; vel[i*3]   =  Math.abs(vel[i*3])   * DAMP }
        if (pos[i*3]   > XMAX) { pos[i*3]   = XMAX; vel[i*3]   = -Math.abs(vel[i*3])   * DAMP }
        if (pos[i*3+1] < YMIN) { pos[i*3+1] = YMIN; vel[i*3+1] =  Math.abs(vel[i*3+1]) * DAMP }
        if (pos[i*3+1] > YMAX) { pos[i*3+1] = YMAX; vel[i*3+1] = -Math.abs(vel[i*3+1]) * DAMP }
        if (pos[i*3+2] < ZMIN) { pos[i*3+2] = ZMIN; vel[i*3+2] =  Math.abs(vel[i*3+2]) * DAMP }
        if (pos[i*3+2] > ZMAX) { pos[i*3+2] = ZMAX; vel[i*3+2] = -Math.abs(vel[i*3+2]) * DAMP }
      }
    }

    // — Color by velocity speed (blue→cyan→amber→white) ——
    let maxSp = 0.5
    for (let i = 0; i < N; i++) {
      const sp = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2)
      if (sp > maxSp) maxSp = sp
    }
    for (let i = 0; i < N; i++) {
      pos3[i*3]   = pos[i*3]
      pos3[i*3+1] = pos[i*3+1]
      pos3[i*3+2] = pos[i*3+2]
      const sp = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2)
      const t  = Math.min(sp / maxSp, 1)
      if (t < 0.30) {
        const s = t / 0.30
        col[i*3] = 0.0; col[i*3+1] = 0.18 + s * 0.68; col[i*3+2] = 0.85
      } else if (t < 0.65) {
        const s = (t - 0.30) / 0.35
        col[i*3] = s * 0.92; col[i*3+1] = 0.86 - s * 0.22; col[i*3+2] = 0.85 - s * 0.80
      } else {
        const s = (t - 0.65) / 0.35
        col[i*3] = 0.92 + s * 0.08; col[i*3+1] = 0.64 - s * 0.52; col[i*3+2] = 0.05
      }
    }

    geoRef.current.attributes.position.needsUpdate = true
    geoRef.current.attributes.color.needsUpdate    = true
  })

  const W = XMAX - XMIN, Ht = YMAX - YMIN, D = ZMAX - ZMIN

  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 8]} intensity={1.0} color="#2dd4bf" />
      <pointLight position={[4, -2, 5]} intensity={0.5} color="#fb923c" />
      <pointLight position={[-4, 3, 6]} intensity={0.3} color="#a855f7" />

      {/* Domain wireframe box */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(W, Ht, D)]} />
        <lineBasicMaterial color="#2dd4bf" transparent opacity={0.12} />
      </lineSegments>

      {/* 3D SPH particle cloud */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos3, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col,  3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.22} vertexColors transparent opacity={0.95}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
        />
      </points>
    </group>
  )
}
