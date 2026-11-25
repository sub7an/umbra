import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'
import { initSphParticles, sphStep, SPH_BOUNDS } from './fluidMath'

// ─── 3D SPH — Navier-Stokes via Smoothed Particle Hydrodynamics ─────────────
// 216 particles (6×6×6 cube) collapsing as a dam break in a 3D box.
// Kernels (Müller 2003) and the step live in fluidMath.js

const COLS  = 6, ROWS  = 6, DEPTH = 6
const N     = COLS * ROWS * DEPTH   // 216
const { xmin: XMIN, xmax: XMAX, ymin: YMIN, ymax: YMAX, zmin: ZMIN, zmax: ZMAX } = SPH_BOUNDS
const DROP_R = 0.42 // drawn droplet radius (overlaps neighbours into a liquid body)
const WATER_DEEP = new THREE.Color('#1d4ed8')
const WATER_MID  = new THREE.Color('#38bdf8')
const FOAM       = new THREE.Color('#f0f9ff')

function initParticles() {
  return initSphParticles(Math.random, COLS, ROWS, DEPTH)
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

    const particles = { pos, vel, n: N }
    for (let step = 0; step < substeps; step++) sphStep(particles, { g, dt }, Math.random)

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
