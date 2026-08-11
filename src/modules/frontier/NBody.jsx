// Gravitational N-body: RK4, softened potential, trail ring buffers.
// Three presets: figure-8 choreography, binary+probe, chaotic 4-body.
import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

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

// ── Physics ───────────────────────────────────────────────────────────────────
function accel(pos, masses, G, eps) {
  return pos.map((pi, i) => {
    let ax = 0, ay = 0, az = 0
    for (let j = 0; j < pos.length; j++) {
      if (i === j) continue
      const dx = pos[j][0]-pi[0], dy = pos[j][1]-pi[1], dz = pos[j][2]-pi[2]
      const f  = G * masses[j] / Math.pow(dx*dx + dy*dy + dz*dz + eps*eps, 1.5)
      ax += f*dx; ay += f*dy; az += f*dz
    }
    return [ax, ay, az]
  })
}

function vadd(a, b, s) {
  return a.map((ai, i) => [ai[0]+b[i][0]*s, ai[1]+b[i][1]*s, ai[2]+b[i][2]*s])
}

function rk4Step(pos, vel, masses, G, eps, dt) {
  const a1 = accel(pos, masses, G, eps)
  const p2 = vadd(pos, vel, dt/2), v2 = vadd(vel, a1, dt/2)
  const a2 = accel(p2, masses, G, eps)
  const p3 = vadd(pos, v2, dt/2), v3 = vadd(vel, a2, dt/2)
  const a3 = accel(p3, masses, G, eps)
  const p4 = vadd(pos, v3, dt),   v4 = vadd(vel, a3, dt)
  const a4 = accel(p4, masses, G, eps)
  return {
    pos: pos.map((p, i) => [
      p[0] + dt/6*(vel[i][0]+2*v2[i][0]+2*v3[i][0]+v4[i][0]),
      p[1] + dt/6*(vel[i][1]+2*v2[i][1]+2*v3[i][1]+v4[i][1]),
      p[2] + dt/6*(vel[i][2]+2*v2[i][2]+2*v3[i][2]+v4[i][2]),
    ]),
    vel: vel.map((v, i) => [
      v[0] + dt/6*(a1[i][0]+2*a2[i][0]+2*a3[i][0]+a4[i][0]),
      v[1] + dt/6*(a1[i][1]+2*a2[i][1]+2*a3[i][1]+a4[i][1]),
      v[2] + dt/6*(a1[i][2]+2*a2[i][2]+2*a3[i][2]+a4[i][2]),
    ]),
  }
}

function totalEnergy(pos, vel, masses, G, eps) {
  let KE = 0, PE = 0
  for (let i = 0; i < pos.length; i++) {
    const [vx, vy, vz] = vel[i]
    KE += 0.5 * masses[i] * (vx*vx + vy*vy + vz*vz)
    for (let j = i+1; j < pos.length; j++) {
      const dx=pos[j][0]-pos[i][0], dy=pos[j][1]-pos[i][1], dz=pos[j][2]-pos[i][2]
      PE -= G * masses[i] * masses[j] / Math.sqrt(dx*dx+dy*dy+dz*dz+eps*eps)
    }
  }
  return KE + PE
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
  const trailGeos = useRef([])

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
    e0Ref.current = totalEnergy(pos, vel, ms, p.G, p.eps)
    return { pos, vel, trails }
  }

  // Re-init when preset changes
  useEffect(() => {
    const p = PRESETS[presetKey]
    simRef.current = initSim(p)

    // Rebuild trail geos
    trailGeos.current.forEach(g => g.dispose())
    trailGeos.current = Array.from({length: p.bodies.length}, () => makeTrailGeo())
  }, [presetKey])  // eslint-disable-line

  // Initial init
  useMemo(() => {
    simRef.current = initSim(preset)
    trailGeos.current = Array.from({length: N}, () => makeTrailGeo())
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
      const geo = trailGeos.current[i]
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
    const E  = totalEnergy(sim.pos, sim.vel, masses, p.G, p.eps)
    const E0 = e0Ref.current ?? E
    const drift = Math.abs((E - E0) / (Math.abs(E0) + 1e-12)) * 100
    if (eRef.current)     eRef.current.textContent     = E.toFixed(4)
    if (driftRef.current) driftRef.current.textContent = `ΔE/E₀ = ${drift.toFixed(4)}%`
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
            {trailGeos.current[i] && (
              <line geometry={trailGeos.current[i]}>
                <lineBasicMaterial
                  vertexColors transparent opacity={0.75}
                  blending={THREE.AdditiveBlending} depthWrite={false}
                />
              </line>
            )}
          </group>
        )
      })}

      {/* ── Live readout ── */}
      <Html position={[5.5, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(4,6,14,0.88)',
          border: '1px solid rgba(245,158,11,0.18)',
          borderRadius: 3, padding: '7px 10px', minWidth: 148,
        }}>
          <div style={{ fontSize: 8, color: 'rgba(245,158,11,0.45)', letterSpacing: '0.14em', marginBottom: 4 }}>
            {preset.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(245,158,11,0.30)', marginBottom: 6 }}>
            {preset.desc}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(245,158,11,0.45)', marginBottom: 2 }}>
            E = <span ref={eRef} style={{ color: '#fbbf24' }}>—</span>
          </div>
          <div ref={driftRef} style={{ fontSize: 7, color: 'rgba(245,158,11,0.35)', letterSpacing: '0.08em' }}>
            ΔE/E₀ = —
          </div>
        </div>
      </Html>

      {/* ── Preset selector ── */}
      <Html position={[0, -4.5, 0]} center style={{ pointerEvents: 'all' }}>
        <div style={{ display: 'flex', gap: 4, fontFamily: 'JetBrains Mono,monospace' }}>
          {presetList.map(([key, p]) => (
            <button key={key} onClick={() => setPresetKey(key)} style={{
              fontSize: 8, letterSpacing: '0.12em',
              padding: '4px 10px',
              background: presetKey === key ? 'rgba(245,158,11,0.10)' : 'rgba(4,6,14,0.85)',
              border: `1px solid ${presetKey === key ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.14)'}`,
              color: presetKey === key ? '#fbbf24' : 'rgba(245,158,11,0.40)',
              borderRadius: 2, cursor: 'pointer',
            }}>
              {p.label.toUpperCase()}
            </button>
          ))}
        </div>
      </Html>
    </group>
  )
}
