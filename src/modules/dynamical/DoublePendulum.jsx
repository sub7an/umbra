// Double pendulum chaos visualization
// N_PEND pendulums with nearly identical ICs diverge exponentially.
// RK4 integration; Lyapunov exponent estimated from pairwise separation.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const N_PEND = 8
const L      = 1.5          // arm length (scene units)
const G      = 9.81
const TRAIL  = 280          // history buffer per pendulum
const EPS    = 1e-5         // initial condition perturbation
const SUB    = 4            // RK4 sub-steps per frame
const PIVOT  = new THREE.Vector3(0, 2.6, 0)

// 8 distinct hues (red→orange→yellow→green→teal→blue→indigo→pink)
const PCOLORS = [
  new THREE.Color('#ef4444'),
  new THREE.Color('#f97316'),
  new THREE.Color('#eab308'),
  new THREE.Color('#22c55e'),
  new THREE.Color('#14b8a6'),
  new THREE.Color('#38bdf8'),
  new THREE.Color('#818cf8'),
  new THREE.Color('#e879f9'),
]

// ── RK4 integration ──────────────────────────────────────────────────────────
const gL = G / L

function derivs(th1, th2, om1, om2) {
  const d   = th1 - th2
  const den = 3 - Math.cos(2 * d)
  const a1  = (-3 * gL * Math.sin(th1)
               - gL * Math.sin(th1 - 2 * th2)
               - 2 * Math.sin(d) * (om2 * om2 + om1 * om1 * Math.cos(d))
              ) / den
  const a2  = 2 * Math.sin(d) * (
                2 * om1 * om1
                + 2 * gL * Math.cos(th1)
                + om2 * om2 * Math.cos(d)
              ) / den
  return [om1, om2, a1, a2]  // [dθ1, dθ2, dω1, dω2]
}

function rk4Step(th1, th2, om1, om2, dt) {
  const [p1,p2,p3,p4] = derivs(th1,th2,om1,om2)
  const [q1,q2,q3,q4] = derivs(th1+p1*dt/2,th2+p2*dt/2,om1+p3*dt/2,om2+p4*dt/2)
  const [r1,r2,r3,r4] = derivs(th1+q1*dt/2,th2+q2*dt/2,om1+q3*dt/2,om2+q4*dt/2)
  const [s1,s2,s3,s4] = derivs(th1+r1*dt,  th2+r2*dt,  om1+r3*dt,  om2+r4*dt)
  return [
    th1 + dt*(p1+2*q1+2*r1+s1)/6,
    th2 + dt*(p2+2*q2+2*r2+s2)/6,
    om1 + dt*(p3+2*q3+2*r3+s3)/6,
    om2 + dt*(p4+2*q4+2*r4+s4)/6,
  ]
}

// Pendulum joint positions in world space
function bobPos(theta1, theta2, pivotX, pivotY) {
  const b1x = pivotX + L * Math.sin(theta1)
  const b1y = pivotY - L * Math.cos(theta1)
  const b2x = b1x   + L * Math.sin(theta2)
  const b2y = b1y   - L * Math.cos(theta2)
  return [b1x, b1y, b2x, b2y]
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DoublePendulum() {
  // Arm line geometries — each is a TWO-segment polyline: pivot→bob1→bob2
  const armGeos = useMemo(() => Array.from({ length: N_PEND }, () => {
    const arr = new Float32Array(9)  // 3 points × 3 coords
    const g   = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 3)
    return g
  }), [])

  // Trail geometries — ring buffer of bob2 positions
  const trailGeos = useMemo(() => Array.from({ length: N_PEND }, () => {
    const arr = new Float32Array(TRAIL * 3)
    const g   = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setDrawRange(0, 0)
    return g
  }), [])

  // Bob dot meshes (one per pendulum) — filled via callback refs
  const bob2Refs = useRef(new Array(N_PEND).fill(null))

  // Lyapunov readout DOM ref
  const lyapRef  = useRef()
  const timeRef  = useRef(0)

  // Simulation state in a ref (mutated every frame)
  const sim = useRef((() => {
    // All start from θ₁=2.4, θ₂=2.4 with ε perturbations in θ₁
    const IC_T1 = 2.4, IC_T2 = 2.4
    return Array.from({ length: N_PEND }, (_, i) => ({
      th1: IC_T1 + i * EPS,
      th2: IC_T2,
      om1: 0,
      om2: 0,
      trail: new Float32Array(TRAIL * 3),
      idx:  0,
      fill: 0,
    }))
  })())

  useEffect(() => {
    return () => {
      armGeos.forEach((g) => g.dispose())
      trailGeos.forEach((g) => g.dispose())
    }
  }, [armGeos, trailGeos])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033) / SUB
    const simArr = sim.current

    // Integrate all pendulums
    for (let pi = 0; pi < N_PEND; pi++) {
      const s = simArr[pi]
      let { th1, th2, om1, om2 } = s
      for (let k = 0; k < SUB; k++) {
        ;[th1, th2, om1, om2] = rk4Step(th1, th2, om1, om2, dt)
      }
      s.th1 = th1; s.th2 = th2; s.om1 = om1; s.om2 = om2

      // Bob world positions (Z = 0 for all, pure XY plane)
      const [b1x, b1y, b2x, b2y] = bobPos(th1, th2, PIVOT.x, PIVOT.y)

      // Update arm geometry: pivot → bob1 → bob2
      const armAttr = armGeos[pi].attributes.position
      armAttr.setXYZ(0, PIVOT.x, PIVOT.y, 0)
      armAttr.setXYZ(1, b1x,     b1y,     0)
      armAttr.setXYZ(2, b2x,     b2y,     0)
      armAttr.needsUpdate = true

      // Append bob2 to trail ring buffer
      const idx = s.idx
      s.trail[idx*3]   = b2x
      s.trail[idx*3+1] = b2y
      s.trail[idx*3+2] = 0
      s.idx  = (idx + 1) % TRAIL
      if (s.fill < TRAIL) s.fill++

      // Reorder ring buffer into trail geometry (oldest → newest)
      const fill    = s.fill
      const trailAttr = trailGeos[pi].attributes.position
      for (let i = 0; i < fill; i++) {
        const ti = (s.idx - fill + i + TRAIL) % TRAIL
        trailAttr.setXYZ(i, s.trail[ti*3], s.trail[ti*3+1], 0)
      }
      trailAttr.needsUpdate = true
      trailGeos[pi].setDrawRange(0, fill)

      // Update bob2 sphere position
      const bobEl = bob2Refs.current[pi]
      if (bobEl) bobEl.position.set(b2x, b2y, 0)
    }

    // Lyapunov estimate: distance between pendulum 0 and 1 in angle space
    timeRef.current += Math.min(delta, 0.033)
    const t = timeRef.current
    const s0 = simArr[0], s1 = simArr[1]
    const d_th1 = s1.th1 - s0.th1
    const d_th2 = s1.th2 - s0.th2
    const dist  = Math.sqrt(d_th1*d_th1 + d_th2*d_th2)
    const lyap  = t > 0.1 ? (Math.log(dist / (EPS * Math.sqrt(2))) / t).toFixed(2) : '—'

    if (lyapRef.current && t > 1) {
      lyapRef.current.textContent = `λ ≈ ${lyap} s⁻¹`
    }
  })

  return (
    <group>
      <ambientLight intensity={0.06} color="#0a0a14" />
      <directionalLight position={[3, 6, 4]} intensity={0.3} color="#c0d0ff" />
      <pointLight position={[0, 2.5, 0]} intensity={0.8} color="#ffffff" distance={8} decay={2} />

      {/* Pivot sphere */}
      <mesh position={[PIVOT.x, PIVOT.y, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
      </mesh>

      {Array.from({ length: N_PEND }, (_, pi) => {
        const col = PCOLORS[pi]
        const hexStr = `#${col.getHexString()}`
        const armOpacity = pi === 0 ? 0.9 : 0.25 + pi * 0.04

        return (
          <group key={pi}>
            {/* Arm lines: fully opaque for first pendulum, faded for others */}
            <line geometry={armGeos[pi]}>
              <lineBasicMaterial color={hexStr} transparent opacity={armOpacity} />
            </line>

            {/* Bob2 trail */}
            <line geometry={trailGeos[pi]}>
              <lineBasicMaterial
                color={hexStr} transparent opacity={0.70}
                blending={THREE.AdditiveBlending} depthWrite={false}
              />
            </line>

            {/* Bob2 sphere */}
            <mesh ref={(el) => { bob2Refs.current[pi] = el }}>
              <sphereGeometry args={[0.065, 10, 10]} />
              <meshStandardMaterial
                color={hexStr} emissive={hexStr}
                emissiveIntensity={pi === 0 ? 2.2 : 1.1}
                roughness={0} metalness={0.2}
              />
            </mesh>
          </group>
        )
      })}

      {/* Lyapunov readout */}
      <Html position={[3.5, 2.6, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '0.12em',
          background: 'rgba(4,6,14,0.82)',
          border: '1px solid rgba(130,140,248,0.2)',
          borderRadius: 2,
          padding: '5px 9px',
          color: 'rgba(165,180,252,0.85)',
          whiteSpace: 'nowrap',
        }}>
          <div ref={lyapRef} style={{ marginBottom: 3 }}>λ ≈ —</div>
          <div style={{ color: 'rgba(165,180,252,0.38)', fontSize: 8 }}>
            LYAPUNOV EXP
          </div>
          <div style={{ color: 'rgba(165,180,252,0.28)', fontSize: 8, marginTop: 2 }}>
            Δθ₀ = {EPS.toExponential(0)}
          </div>
        </div>
      </Html>

      {/* Legend */}
      <Html position={[-4.8, 2.2, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8, letterSpacing: '0.1em',
          color: 'rgba(180,180,220,0.55)',
        }}>
          {N_PEND} pendulums · Δθ₁ = ε each
        </div>
      </Html>
    </group>
  )
}
