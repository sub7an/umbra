// Gravitational N-body: RK4, softened potential, trail ring buffers.
// Three presets: figure-8 choreography, binary+probe, chaotic 4-body.
import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'
import { rk4Step, totalEnergy3D } from './frontierMath'

const TRAIL    = 600   // history points per body
const SUBSTEPS = 4     // RK4 sub-steps per frame

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  figure8: {
    label: 'Figure-8',
    G: 1.0, eps: 0.02,
    desc: 'Chenciner-Montgomery choreographic solution (2000)',
    bodies: [
      { pos: [ 0.97000436, 0, -0.24308753], vel: [ 0.4662037, 0,  0.4323657], mass: 1.0, color: '#38bdf8' },
      { pos: [-0.97000436, 0,  0.24308753], vel: [ 0.4662037, 0,  0.4323657], mass: 1.0, color: '#f472b6' },
      { pos: [ 0,          0,  0          ], vel: [-0.9324074, 0, -0.8647315], mass: 1.0, color: '#4ade80' },
    ],
  },
  binary: {
    label: 'Binary + Probe',
    G: 1.0, eps: 0.08,
    desc: 'Two heavy stars + light probe in perturbed orbit',
    bodies: [
      { pos: [ 2.0, 0,  0], vel: [0, 0, -0.791], mass: 5.0, color: '#fbbf24' },
      { pos: [-2.0, 0,  0], vel: [0, 0,  0.791], mass: 5.0, color: '#fb923c' },
      { pos: [ 5.8, 0,  0], vel: [0, 0,  1.265], mass: 0.02, color: '#a3e635' },
    ],
  },
  chaos: {
    label: 'Chaotic 4-Body',
    G: 1.0, eps: 0.06,
    desc: 'Four bodies — sensitivity to initial conditions',
    bodies: [
      { pos: [ 2.0, 0,  0.3], vel: [ 0.08, 0,  0.78], mass: 1.0, color: '#38bdf8' },
      { pos: [-0.5, 0,  2.0], vel: [-0.88, 0, -0.08], mass: 1.2, color: '#f472b6' },
      { pos: [-1.5, 0, -1.5], vel: [ 0.40, 0, -0.48], mass: 0.8, color: '#4ade80' },
      { pos: [ 0.8, 0, -1.8], vel: [ 0.28, 0, -0.10], mass: 1.1, color: '#fbbf24' },
    ],
  },
}

// ── Build trail geometry for one body ─────────────────────────────────────────
function makeTrailGeo() {
  const arr = new Float32Array(TRAIL * 3)
  const col = new Float32Array(TRAIL * 3)
  const g   = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3))
  g.setDrawRange(0, 0)
  return g
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function NBody() {
  const [presetKey, setPresetKey] = useState('figure8')

  const preset  = PRESETS[presetKey]
  const N       = preset.bodies.length
  const masses  = preset.bodies.map(b => b.mass)
  const colors  = preset.bodies.map(b => new THREE.Color(b.color))

  // Simulation state — all mutable refs
  const simRef = useRef(null)
  const e0Ref  = useRef(null)      // initial energy (for drift readout)

  // Refs for meshes and trail geos (rebuilt per preset)
  const meshRefs  = useRef([])
  // Trail geometries belong to the current preset; the rendered <line>s and
  // the per-frame writes must use the same objects (the old ref-based rebuild
  // swapped them on mount, so writes went to geometries nothing rendered).
  const trailGeos = useMemo(
    () => Array.from({ length: PRESETS[presetKey].bodies.length }, () => makeTrailGeo()),
    [presetKey],
  )
  useEffect(() => () => trailGeos.forEach((g) => g.dispose()), [trailGeos])

  // DOM refs for live readout
  const driftRef  = useRef()
  const eRef      = useRef()

  // Initialize simulation from preset — uses local ms to avoid stale closure
  function initSim(p) {
    const ms  = p.bodies.map(b => b.mass)
    const pos = p.bodies.map(b => [...b.pos])
    const vel = p.bodies.map(b => [...b.vel])
    const totalM = ms.reduce((s, m) => s+m, 0)
    const vcx = vel.reduce((s,v,i) => s+ms[i]*v[0], 0) / totalM
    const vcy = vel.reduce((s,v,i) => s+ms[i]*v[1], 0) / totalM
    const vcz = vel.reduce((s,v,i) => s+ms[i]*v[2], 0) / totalM
    for (let i=0; i<vel.length; i++) { vel[i][0]-=vcx; vel[i][1]-=vcy; vel[i][2]-=vcz }

    const trails = Array.from({length: p.bodies.length}, () => ({
      buf: new Float32Array(TRAIL * 3), idx: 0, fill: 0
    }))
    e0Ref.current = totalEnergy3D(pos, vel, ms, p.G, p.eps)
    return { pos, vel, trails }
  }

  // Re-init when preset changes
  useEffect(() => {
    const p = PRESETS[presetKey]
    simRef.current = initSim(p)
  }, [presetKey])  // eslint-disable-line

  // Initial init
  useMemo(() => {
    simRef.current = initSim(preset)
    meshRefs.current = new Array(N).fill(null)
  }, [])  // eslint-disable-line

  useFrame((_, delta) => {
    const sim = simRef.current
    if (!sim) return
    const p = PRESETS[presetKey]
    if (sim.pos.length !== p.bodies.length) return   // guard during preset transition
    const dt = Math.min(delta, 0.033) / SUBSTEPS

    for (let s = 0; s < SUBSTEPS; s++) {
      const { pos, vel } = rk4Step(sim.pos, sim.vel, masses, p.G, p.eps, dt)
      sim.pos = pos; sim.vel = vel
    }

    // Update body meshes
    for (let i = 0; i < p.bodies.length; i++) {
      const mesh = meshRefs.current[i]
      if (mesh) mesh.position.set(sim.pos[i][0], sim.pos[i][1], sim.pos[i][2])

      // Append to trail ring buffer
      const tr  = sim.trails[i]
      const idx = tr.idx
      tr.buf[idx*3]   = sim.pos[i][0]
      tr.buf[idx*3+1] = sim.pos[i][1]
      tr.buf[idx*3+2] = sim.pos[i][2]
      tr.idx  = (idx + 1) % TRAIL
      if (tr.fill < TRAIL) tr.fill++

      // Write trail geo
      const geo = trailGeos[i]
      if (!geo) continue
      const pa = geo.attributes.position, ca = geo.attributes.color
      const fill = tr.fill
      const col = colors[i]
      for (let k = 0; k < fill; k++) {
        const ti  = (tr.idx - fill + k + TRAIL) % TRAIL
        const age = k / fill
        pa.setXYZ(k, tr.buf[ti*3], tr.buf[ti*3+1], tr.buf[ti*3+2])
        ca.setXYZ(k, col.r*age, col.g*age, col.b*age)
      }
      pa.needsUpdate = true; ca.needsUpdate = true
      geo.setDrawRange(0, fill)
    }

    // Energy drift readout
    const E  = totalEnergy3D(sim.pos, sim.vel, masses, p.G, p.eps)
    const E0 = e0Ref.current ?? E
    const drift = Math.abs((E - E0) / (Math.abs(E0) + 1e-12)) * 100
    if (eRef.current)     eRef.current.textContent     = E.toFixed(4)
    if (driftRef.current) driftRef.current.textContent = `${drift.toFixed(4)}%`
  })

  const presetList = Object.entries(PRESETS)

  return (
    <group>
      <ambientLight intensity={0.04} color="#04060e" />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#c8d8ff" distance={20} decay={2} />

      {/* Body meshes — built per-preset via inline ref callback */}
      {preset.bodies.map((b, i) => {
        const r = Math.cbrt(b.mass) * 0.14 + 0.06
        return (
          <group key={`${presetKey}-${i}`}>
            <mesh ref={el => { meshRefs.current[i] = el }}>
              <sphereGeometry args={[r, 14, 14]} />
              <meshStandardMaterial
                color={b.color} emissive={b.color}
                emissiveIntensity={b.mass > 1 ? 2.2 : 3.5}
                roughness={0} metalness={0.2}
              />
              <pointLight color={b.color} intensity={b.mass > 1 ? 1.5 : 0.8}
                distance={b.mass > 1 ? 4 : 2} decay={2} />
            </mesh>

            {/* Trail */}
            {trailGeos[i] && (
              <line geometry={trailGeos[i]}>
                <lineBasicMaterial
                  vertexColors transparent opacity={0.95}
                  blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
                />
              </line>
            )}
          </group>
        )
      })}

      {/* ── Readout + presets, pinned to the scene corner ── */}
      <SceneCard interactive>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{preset.label}</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>{preset.desc}</div>
          <div role="radiogroup" aria-label="Orbit preset" style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
            {presetList.map(([key, p]) => (
              <button key={key} type="button" role="radio" aria-checked={presetKey === key} onClick={() => setPresetKey(key)}
                className="ui-btn h-8 justify-start"
                style={presetKey === key ? { borderColor: 'rgba(251,191,36,0.6)', background: 'rgba(251,191,36,0.12)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 8 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Total energy E</dt>
            <dd ref={eRef} style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fbbf24' }}>—</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Energy drift</dt>
            <dd ref={driftRef} style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>—</dd>
          </dl>
          <div style={{ marginTop: 6, color: 'rgb(var(--c-text-muted))' }}>Near-zero drift = the RK4 integrator conserves energy.</div>
        </div>
      </SceneCard>
    </group>
  )
}
