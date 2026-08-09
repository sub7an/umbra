// Lorentz force: two opposite charges in B field, optional E×B drift.
// B = B₀ŷ → positive charge gyrates CCW, negative CW; both drift same way under E.
import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const TRAIL  = 280
const GRID_N = 5
const GRID_S = 1.8

// ── Acceleration for charge q in fields B (up) and optional E (z direction) ──
function makeAcc(q, Ez) {
  // F = q*(E + v×B), B=[0,B,0], E=[0,0,Ez]
  // v×B = [-vz*B, 0, vx*B]
  return (vx, vy, vz, B) => [
    q * (-vz * B),
    0,
    q * (vx * B + Ez),
  ]
}

function rk4(pos, vel, dt, B, acc) {
  const [vx, vy, vz] = vel
  const a1 = acc(vx, vy, vz, B)
  const v2 = [vx + a1[0]*dt/2, vy + a1[1]*dt/2, vz + a1[2]*dt/2]
  const a2 = acc(...v2, B)
  const v3 = [vx + a2[0]*dt/2, vy + a2[1]*dt/2, vz + a2[2]*dt/2]
  const a3 = acc(...v3, B)
  const v4 = [vx + a3[0]*dt, vy + a3[1]*dt, vz + a3[2]*dt]
  const a4 = acc(...v4, B)
  const nv = [
    vx + dt/6*(a1[0]+2*a2[0]+2*a3[0]+a4[0]),
    vy + dt/6*(a1[1]+2*a2[1]+2*a3[1]+a4[1]),
    vz + dt/6*(a1[2]+2*a2[2]+2*a3[2]+a4[2]),
  ]
  const np = [
    pos[0] + dt/2*(vx+nv[0]),
    pos[1] + dt/2*(vy+nv[1]),
    pos[2] + dt/2*(vz+nv[2]),
  ]
  return { pos: np, vel: nv }
}

function makeTrailGeo() {
  const arr = new Float32Array(TRAIL * 3)
  const col = new Float32Array(TRAIL * 3)
  const g   = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3))
  g.setDrawRange(0, 0)
  return g
}

function makeSim(px, pz, vx, vy) {
  return {
    pos:   [px, -2.8, pz],
    vel:   [vx, vy,  0.0],
    trail: new Float32Array(TRAIL * 3),
    idx:   0,
    fill:  0,
  }
}

// ── B-field arrow grid ────────────────────────────────────────────────────────
function BFieldGrid({ B }) {
  const { list, len } = useMemo(() => {
    const half = Math.floor(GRID_N / 2)
    const l = []
    for (let i = -half; i <= half; i++) {
      for (let j = -half; j <= half; j++) {
        if (Math.abs(i) < 1 && Math.abs(j) < 1) continue
        l.push(new THREE.Vector3(i * GRID_S, -3.0, j * GRID_S))
      }
    }
    return { list: l, len: 0.5 + B * 0.16 }
  }, [B])

  const dir = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  return (
    <group>
      {list.map((pos, i) => (
        <arrowHelper key={i} args={[dir, pos, len, '#7c3aed', len * 0.28, len * 0.14]} />
      ))}
    </group>
  )
}

// ── Force arrow helper ────────────────────────────────────────────────────────
function ForceArrow({ arrowRef, color }) {
  const groupRef = useRef()
  useEffect(() => {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color, 0.3, 0.16
    )
    groupRef.current.add(arrow)
    arrowRef.current = arrow
    return () => {
      groupRef.current?.remove(arrow)
      arrow.line.geometry.dispose()
      arrow.cone.geometry.dispose()
    }
  }, [arrowRef, color])
  return <group ref={groupRef} />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LorentzForce({ bStrength = 1.0 }) {
  const [eOn, setEOn] = useState(false)
  const bRef = useRef(bStrength)
  bRef.current = bStrength
  const eRef  = useRef(0)
  eRef.current = eOn ? 1.8 : 0

  // Two particles: positive (q=+1, cyan) and negative (q=-1, pink)
  const sim1Ref = useRef(makeSim( 0.0, 0.0, 2.4, 0.7))
  const sim2Ref = useRef(makeSim( 0.5, 1.6, 2.4, 0.7))

  const p1Ref    = useRef()
  const p2Ref    = useRef()
  const a1Ref    = useRef()
  const a2Ref    = useRef()

  const trail1Geo = useMemo(() => makeTrailGeo(), [])
  const trail2Geo = useMemo(() => makeTrailGeo(), [])
  useEffect(() => () => { trail1Geo.dispose(); trail2Geo.dispose() }, [trail1Geo, trail2Geo])

  const readoutRef = useRef()
  const readT      = useRef(0)

  function updateSim(simRef, q, Ez, B, dt) {
    const sim = simRef.current
    const acc = makeAcc(q, Ez)
    const { pos: np, vel: nv } = rk4(sim.pos, sim.vel, dt, B, acc)

    // Wrap y; reset trail if going too far
    if (np[1] > 4.2) { np[1] = -2.8; sim.fill = 0; sim.idx = 0 }
    if (np[1] < -4.5){ np[1] = 4.2;  sim.fill = 0; sim.idx = 0 }

    sim.vel = nv
    sim.pos = np

    // Store trail
    const idx = sim.idx
    sim.trail[idx*3]   = np[0]
    sim.trail[idx*3+1] = np[1]
    sim.trail[idx*3+2] = np[2]
    sim.idx  = (idx + 1) % TRAIL
    if (sim.fill < TRAIL) sim.fill++

    return { pos: np, vel: nv }
  }

  function writeTrail(trailGeo, sim, rVal, gVal, bVal) {
    const posAttr = trailGeo.attributes.position
    const colAttr = trailGeo.attributes.color
    const { trail, fill, idx } = sim
    for (let i = 0; i < fill; i++) {
      const ti  = (idx - fill + i + TRAIL) % TRAIL
      const age = i / fill
      posAttr.setXYZ(i, trail[ti*3], trail[ti*3+1], trail[ti*3+2])
      // fade: dim at tail, bright at head
      colAttr.setXYZ(i, rVal * age, gVal * age, bVal * age)
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    trailGeo.setDrawRange(0, fill)
  }

  function updateForceArrow(arrowRef, pos, vel, q, B) {
    const arrow = arrowRef.current
    if (!arrow) return
    const [vx, , vz] = vel
    const fx = q * (-vz * B)
    const fz = q * (vx * B)
    const fmag = Math.sqrt(fx*fx + fz*fz) + 1e-9
    const flen = Math.min(fmag * 0.35, 2.2)
    arrow.position.set(pos[0], pos[1], pos[2])
    arrow.setDirection(new THREE.Vector3(fx/fmag, 0, fz/fmag))
    arrow.setLength(flen, flen * 0.26, flen * 0.14)
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.016)
    const B  = bRef.current
    const Ez = eRef.current

    const { pos: p1, vel: v1 } = updateSim(sim1Ref, +1, Ez, B, dt)
    const { pos: p2, vel: v2 } = updateSim(sim2Ref, -1, Ez, B, dt)

    if (p1Ref.current) p1Ref.current.position.set(p1[0], p1[1], p1[2])
    if (p2Ref.current) p2Ref.current.position.set(p2[0], p2[1], p2[2])

    writeTrail(trail1Geo, sim1Ref.current, 0.0, 0.9, 0.85)  // cyan
    writeTrail(trail2Geo, sim2Ref.current, 1.0, 0.25, 0.55) // pink

    updateForceArrow(a1Ref, p1, v1, +1, B)
    updateForceArrow(a2Ref, p2, v2, -1, B)

    // Readout
    readT.current += delta
    if (readT.current > 0.22) {
      readT.current = 0
      const vperp = Math.sqrt(v1[0]*v1[0] + v1[2]*v1[2])
      const r     = B > 0.01 ? (vperp / B).toFixed(2) : '∞'
      const wc    = B.toFixed(2)
      const vd    = eOn ? (Math.abs(eRef.current / B)).toFixed(2) : '0'
      if (readoutRef.current) {
        readoutRef.current.innerHTML = [
          `<div>ω<sub>c</sub> = B/m = ${wc}</div>`,
          `<div>r = v⊥/ω<sub>c</sub> = ${r}</div>`,
          eOn ? `<div style="color:rgba(251,191,36,0.7)">v<sub>E×B</sub> = ${vd}</div>` : '',
        ].join('')
      }
    }
  })

  return (
    <group>
      <ambientLight intensity={0.08} color="#06041a" />
      <directionalLight position={[3, 8, 4]} intensity={0.30} color="#dde8ff" />

      {/* B-field arrows */}
      <BFieldGrid B={bStrength} />

      {/* E-field arrows (z direction, shown when E is on) */}
      {eOn && [-GRID_S, 0, GRID_S].map((x, i) => (
        <arrowHelper key={i}
          args={[
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(x, 0, -GRID_S * 2),
            0.9, '#fbbf24', 0.25, 0.13
          ]}
        />
      ))}

      {/* Trails */}
      <line geometry={trail1Geo}>
        <lineBasicMaterial vertexColors transparent opacity={0.85}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <line geometry={trail2Geo}>
        <lineBasicMaterial vertexColors transparent opacity={0.85}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>

      {/* Positive particle (cyan) */}
      <mesh ref={p1Ref}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={3.5} roughness={0} />
        <pointLight color="#00e5c4" intensity={2.0} distance={3.5} decay={2} />
      </mesh>

      {/* Negative particle (pink) */}
      <mesh ref={p2Ref}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial color="#f472b6" emissive="#f472b6" emissiveIntensity={3.5} roughness={0} />
        <pointLight color="#f472b6" intensity={2.0} distance={3.5} decay={2} />
      </mesh>

      {/* Force arrows */}
      <ForceArrow arrowRef={a1Ref} color={0x00e5c4} />
      <ForceArrow arrowRef={a2Ref} color={0xf472b6} />

      {/* Field labels */}
      <Html position={[GRID_N/2 * GRID_S + 0.6, -2.8, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
          color: '#a855f7', letterSpacing: '0.12em', opacity: 0.8 }}>
          B = B₀ŷ
        </div>
      </Html>
      {eOn && (
        <Html position={[GRID_S * 1.5 + 0.6, 0, -GRID_S * 2]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
            color: '#fbbf24', letterSpacing: '0.12em', opacity: 0.8 }}>
            E = E₀ẑ
          </div>
        </Html>
      )}

      {/* Live readout */}
      <Html position={[4.2, 3.0, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
          letterSpacing: '0.10em',
          background: 'rgba(4,6,14,0.88)',
          border: '1px solid rgba(0,229,196,0.18)',
          borderRadius: 3, padding: '7px 10px',
        }}>
          <div style={{ fontSize: 8, color: 'rgba(0,229,196,0.4)', marginBottom: 5 }}>F = q(E+v×B)</div>
          <div style={{ color: '#00e5c4', marginBottom: 2 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#00e5c4', marginRight: 4, verticalAlign: 'middle' }} />
            q = +1
          </div>
          <div style={{ color: '#f472b6', marginBottom: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#f472b6', marginRight: 4, verticalAlign: 'middle' }} />
            q = −1
          </div>
          <div ref={readoutRef} style={{ color: '#a5f3fc', lineHeight: 1.7 }} />
        </div>
      </Html>

      {/* E×B drift toggle */}
      <Html position={[-4.5, 3.0, 0]} center style={{ pointerEvents: 'all' }}>
        <div style={{
          fontFamily: 'JetBrains Mono,monospace',
          background: 'rgba(4,6,14,0.88)',
          border: '1px solid rgba(251,191,36,0.18)',
          borderRadius: 3, padding: '7px 10px',
        }}>
          <div style={{ fontSize: 8, color: 'rgba(251,191,36,0.45)', letterSpacing: '0.12em', marginBottom: 5 }}>
            E×B DRIFT
          </div>
          <button onClick={() => setEOn(v => !v)} style={{
            fontFamily: 'JetBrains Mono,monospace',
            fontSize: 8, letterSpacing: '0.12em',
            padding: '4px 10px',
            background: eOn ? 'rgba(251,191,36,0.12)' : 'rgba(4,6,14,0.6)',
            border: `1px solid ${eOn ? 'rgba(251,191,36,0.45)' : 'rgba(251,191,36,0.15)'}`,
            color: eOn ? '#fbbf24' : 'rgba(251,191,36,0.4)',
            borderRadius: 2, cursor: 'pointer', display: 'block', width: '100%', marginBottom: 4,
          }}>
            {eOn ? 'E ON' : 'E OFF'}
          </button>
          {eOn && (
            <div style={{ fontSize: 7, color: 'rgba(251,191,36,0.5)', lineHeight: 1.6 }}>
              v<sub>D</sub> = E×B/B²<br />charge-independent
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
