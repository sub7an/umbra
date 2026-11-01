// Double pendulum chaos visualization
// N_PEND pendulums with nearly identical ICs diverge exponentially.
// RK4 integration; Lyapunov exponent estimated from pairwise separation.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'

const N_PEND = 8
const L      = 1.5          // arm length (scene units)
const G      = 9.81
const TRAIL  = 280          // history buffer per pendulum
const EPS    = 1e-5         // initial condition perturbation
const SUB    = 4            // RK4 sub-steps per frame
const PIVOT  = new THREE.Vector3(-0.9, 0.7, 0)

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
const RESTART_T = 30        // seconds before the experiment replays
const PLOT_W = 180, PLOT_H = 56
const UP = new THREE.Vector3(0, 1, 0)

function initialState() {
  // All start from θ₁ = θ₂ = 2.4 rad, each nudged by ε in θ₁
  return Array.from({ length: N_PEND }, (_, i) => ({
    th1: 2.4 + i * EPS, th2: 2.4, om1: 0, om2: 0,
    trail: new Float32Array(TRAIL * 3), idx: 0, fill: 0,
  }))
}

// Orient a unit-height cylinder between two points
function placeRod(mesh, ax, ay, bx, by, tmp) {
  if (!mesh) return
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0)
  tmp.set(dx / len, dy / len, 0)
  mesh.quaternion.setFromUnitVectors(UP, tmp)
  mesh.scale.set(1, len, 1)
}

export default function DoublePendulum() {
  // Trails: per-vertex colour fades from the tail (dark) to the bob (bright)
  const trailGeos = useMemo(() => PCOLORS.map((c) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setDrawRange(0, 0)
    g.userData.color = c
    return g
  }), [])
  useEffect(() => () => trailGeos.forEach((g) => g.dispose()), [trailGeos])

  const rods  = useRef([])     // [pi*2 + k]
  const bob1s = useRef([])
  const bob2s = useRef([])
  const lyapRef = useRef(), pathRef = useRef(), clockRef = useRef()
  const timeRef = useRef(0)
  const logSep = useRef([])
  const lastSample = useRef(0)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const sim = useRef(initialState())

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.033)
    const dt = step / SUB
    timeRef.current += step
    if (timeRef.current > RESTART_T) {
      sim.current = initialState(); timeRef.current = 0; logSep.current = []; lastSample.current = 0
    }
    const simArr = sim.current

    for (let pi = 0; pi < N_PEND; pi++) {
      const s = simArr[pi]
      let { th1, th2, om1, om2 } = s
      for (let k = 0; k < SUB; k++) [th1, th2, om1, om2] = rk4Step(th1, th2, om1, om2, dt)
      s.th1 = th1; s.th2 = th2; s.om1 = om1; s.om2 = om2
      const [b1x, b1y, b2x, b2y] = bobPos(th1, th2, PIVOT.x, PIVOT.y)

      placeRod(rods.current[pi * 2], PIVOT.x, PIVOT.y, b1x, b1y, tmp)
      placeRod(rods.current[pi * 2 + 1], b1x, b1y, b2x, b2y, tmp)
      bob1s.current[pi]?.position.set(b1x, b1y, 0)
      bob2s.current[pi]?.position.set(b2x, b2y, 0)

      s.trail[s.idx * 3] = b2x; s.trail[s.idx * 3 + 1] = b2y; s.trail[s.idx * 3 + 2] = 0
      s.idx = (s.idx + 1) % TRAIL
      if (s.fill < TRAIL) s.fill++
      const g = trailGeos[pi], c = g.userData.color
      const pos = g.attributes.position.array, col = g.attributes.color.array
      for (let i = 0; i < s.fill; i++) {
        const ti = (s.idx - s.fill + i + TRAIL) % TRAIL
        pos[i * 3] = s.trail[ti * 3]; pos[i * 3 + 1] = s.trail[ti * 3 + 1]; pos[i * 3 + 2] = -0.02
        const a = Math.pow(i / s.fill, 1.6) * 1.5
        col[i * 3] = c.r * a; col[i * 3 + 1] = c.g * a; col[i * 3 + 2] = c.b * a
      }
      g.attributes.position.needsUpdate = true
      g.attributes.color.needsUpdate = true
      g.setDrawRange(0, s.fill)
    }

    // Separation between pendulums 0 and 1 in angle space
    const t = timeRef.current
    const s0 = simArr[0], s1 = simArr[1]
    const dist = Math.hypot(s1.th1 - s0.th1, s1.th2 - s0.th2)
    if (t - lastSample.current > 0.1) {
      lastSample.current = t
      logSep.current.push(Math.log10(Math.max(dist, 1e-9)))
    }
    if (lyapRef.current && t > 1) {
      lyapRef.current.textContent = `${(Math.log(dist / EPS) / t).toFixed(2)} s⁻¹`
    }
    if (clockRef.current) clockRef.current.textContent = `${t.toFixed(1)} s`
    if (pathRef.current) {
      // log₁₀(separation) from −6 to +1 against time 0 … RESTART_T
      const pts = logSep.current
      let d = ''
      for (let i = 0; i < pts.length; i++) {
        const x = (i * 0.1 / RESTART_T) * PLOT_W
        const y = PLOT_H - ((Math.min(Math.max(pts[i], -6), 1) + 6) / 7) * PLOT_H
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
      }
      pathRef.current.setAttribute('d', d || 'M0 0')
    }
  })

  return (
    <group>
      {/* Mount: a bracket the pendulums hang from */}
      <mesh position={[PIVOT.x, PIVOT.y + 0.18, -0.12]}>
        <boxGeometry args={[1.4, 0.12, 0.22]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[PIVOT.x, PIVOT.y, 0]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {PCOLORS.map((col, pi) => {
        const hex = `#${col.getHexString()}`
        const lead = pi === 0
        return (
          <group key={pi}>
            <line geometry={trailGeos[pi]}>
              <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </line>
            {[0, 1].map((k) => (
              <mesh key={k} ref={(el) => (rods.current[pi * 2 + k] = el)}>
                <cylinderGeometry args={[lead ? 0.022 : 0.014, lead ? 0.022 : 0.014, 1, 10]} />
                <meshStandardMaterial color={lead ? '#e2e8f0' : hex} metalness={0.8} roughness={0.25} transparent opacity={lead ? 1 : 0.45} />
              </mesh>
            ))}
            <mesh ref={(el) => (bob1s.current[pi] = el)}>
              <sphereGeometry args={[lead ? 0.06 : 0.04, 16, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} transparent opacity={lead ? 1 : 0.5} />
            </mesh>
            <group ref={(el) => (bob2s.current[pi] = el)}>
              <mesh>
                <sphereGeometry args={[lead ? 0.1 : 0.07, 20, 20]} />
                <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={lead ? 1.6 : 0.9} metalness={0.4} roughness={0.25} />
              </mesh>
              <mesh>
                <sphereGeometry args={[lead ? 0.22 : 0.15, 16, 16]} />
                <meshBasicMaterial color={hex} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          </group>
        )
      })}

      <SceneCard>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Butterfly effect</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 6 }}>
            {N_PEND} pendulums released {EPS.toExponential(0)} rad apart. Their separation grows exponentially until they disagree completely.
          </div>
          <svg width={PLOT_W} height={PLOT_H} viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} style={{ display: 'block' }}>
            <rect x="0" y="0" width={PLOT_W} height={PLOT_H} fill="none" stroke="rgb(var(--c-border))" />
            <path ref={pathRef} fill="none" stroke="#818cf8" strokeWidth="1.5" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgb(var(--c-text-muted))', fontSize: 11, marginTop: 2 }}>
            <span>log separation vs time</span><span ref={clockRef} style={{ fontFamily: 'JetBrains Mono, monospace' }}>0.0 s</span>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', marginTop: 6 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Lyapunov estimate λ</dt>
            <dd ref={lyapRef} style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#818cf8' }}>–</dd>
          </dl>
        </div>
      </SceneCard>
    </group>
  )
}
