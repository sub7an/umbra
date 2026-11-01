import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'

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
const DROP_R = 0.42 // drawn droplet radius (overlaps neighbours into a liquid body)
const WATER_DEEP = new THREE.Color('#1d4ed8')
const WATER_MID  = new THREE.Color('#38bdf8')
const FOAM       = new THREE.Color('#f0f9ff')

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
  const simRef = useRef(null)

  if (!simRef.current) simRef.current = initParticles()

  const ballsRef = useRef()
  const cardRef  = useRef()
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color() }), [])

  const releaseDam = useCallback(() => { simRef.current = initParticles() }, [])

  useFrame((_, delta) => {
    if (!simRef.current || !ballsRef.current) return
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

    // — Draw: instanced water droplets, deep blue at rest → white foam when fast
    const balls = ballsRef.current
    let maxSp = 0, sumY = 0
    for (let i = 0; i < N; i++) {
      const sp = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2)
      if (sp > maxSp) maxSp = sp
      sumY += pos[i*3+1]
      tmp.m.makeTranslation(pos[i*3], pos[i*3+1], pos[i*3+2])
      balls.setMatrixAt(i, tmp.m)
      const t = Math.min(sp / 9, 1)
      if (t < 0.6) tmp.c.copy(WATER_DEEP).lerp(WATER_MID, t / 0.6)
      else tmp.c.copy(WATER_MID).lerp(FOAM, (t - 0.6) / 0.4)
      balls.setColorAt(i, tmp.c)
    }
    balls.instanceMatrix.needsUpdate = true
    if (balls.instanceColor) balls.instanceColor.needsUpdate = true

    const card = cardRef.current
    if (card) {
      const set = (sel, v) => { const el = card.querySelector(sel); if (el) el.textContent = v }
      set('.s-max', maxSp.toFixed(1))
      set('.s-h', (sumY / N - YMIN).toFixed(2))
    }
  })

  const W = XMAX - XMIN, Ht = YMAX - YMIN, D = ZMAX - ZMIN

  const tankGeo  = useMemo(() => new THREE.BoxGeometry(W, Ht, D), [W, Ht, D])
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(tankGeo), [tankGeo])
  useEffect(() => () => { tankGeo.dispose(); edgesGeo.dispose() }, [tankGeo, edgesGeo])

  return (
    <group>
      {/* Glass tank */}
      <mesh geometry={tankGeo}>
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.05} roughness={0.1} metalness={0.2} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#99f6e4" transparent opacity={0.5} />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, YMIN - 0.01, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Water */}
      <instancedMesh ref={ballsRef} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[DROP_R, 18, 14]} />
        <meshStandardMaterial roughness={0.12} metalness={0.05} transparent opacity={0.92} envMapIntensity={1.2} />
      </instancedMesh>

      <SceneCard interactive>
        <div ref={cardRef} style={{
          width: 194, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Dam break</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>
            {N} SPH particles · Navier–Stokes
          </div>
          <div style={{ height: 8, borderRadius: 3, background: 'linear-gradient(90deg, #1d4ed8, #38bdf8 60%, #f0f9ff)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'rgb(var(--c-text-muted))' }}>
            <span>at rest</span><span>fast (foam)</span>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, marginTop: 10, fontSize: 12, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 8 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Fastest particle</dt>
            <dd className="s-max" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>–</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Mean water height</dt>
            <dd className="s-h" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>–</dd>
          </dl>
          <button type="button" onClick={releaseDam} className="ui-btn w-full mt-3 h-8">Release the dam again</button>
        </div>
      </SceneCard>
    </group>
  )
}
