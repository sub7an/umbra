// Gibbs mixing: two gases separated by a partition. After 2 s the partition
// slides away and the gases diffuse into each other. Molecules keep their
// identity (A = cyan, B = orange); the mixing entropy is computed from where
// each species actually is, and a live S(t) trace shows it rising to ln 2
// and levelling off — the arrow of time.
import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'

const N      = 400
const HALF_W = 4.05   // box half-width
const HALF_H = 3.15   // box half-height
const DEPTH  = 0.9
const R      = 0.085
const OPEN_AT = 2.0   // s before the partition starts to lift
const TRACE_N = 120   // samples in the S(t) trace
const TRACE_DT = 0.25 // s between samples

const COL_A = new THREE.Color('#22d3ee')
const COL_B = new THREE.Color('#fb923c')

function initState(temperature) {
  const pos  = new Float32Array(N * 3)
  const vel  = new Float32Array(N * 3)
  const side = new Int8Array(N) // 0 = gas A (starts left), 1 = gas B (starts right)
  for (let i = 0; i < N; i++) {
    const s = i < N / 2 ? 0 : 1
    side[i] = s
    pos[i*3]   = (s === 0 ? -1 : 1) * (0.15 + Math.random() * (HALF_W - 0.3))
    pos[i*3+1] = (Math.random() * 2 - 1) * (HALF_H - 0.15)
    pos[i*3+2] = (Math.random() * 2 - 1) * (DEPTH * 0.5 - R)
    const sigma = Math.sqrt(temperature)
    const a = Math.random() * Math.PI * 2
    const sp = sigma * (0.6 + Math.random() * 0.8) * 1.4
    vel[i*3]   = Math.cos(a) * sp
    vel[i*3+1] = Math.sin(a) * sp
    vel[i*3+2] = 0
  }
  return { pos, vel, side }
}

// Binary entropy (nats): positional entropy of one species split f : 1 − f
function H(f) {
  if (f <= 0 || f >= 1) return 0
  return -(f * Math.log(f) + (1 - f) * Math.log(1 - f))
}

export default function Entropy({ temperature }) {
  const ballsRef  = useRef()
  const wallRef   = useRef()
  const cardRef   = useRef()
  const timeRef   = useRef(0)
  const openRef   = useRef(0)
  const prevTRef  = useRef(temperature)
  const tRef      = useRef(temperature)
  tRef.current    = temperature

  const state = useMemo(() => initState(temperature), []) // eslint-disable-line react-hooks/exhaustive-deps
  const trace = useMemo(() => ({ s: new Float32Array(TRACE_N), n: 0, clock: 0 }), [])

  const reset = useCallback(() => {
    const fresh = initState(tRef.current)
    state.pos.set(fresh.pos)
    state.vel.set(fresh.vel)
    state.side.set(fresh.side)
    timeRef.current = 0
    openRef.current = 0
    prevTRef.current = tRef.current
    trace.n = 0
    trace.clock = 0
  }, [state, trace])

  // Colour each molecule once by species — identity never changes
  useEffect(() => {
    const balls = ballsRef.current
    if (!balls) return
    for (let i = 0; i < N; i++) balls.setColorAt(i, state.side[i] === 0 ? COL_A : COL_B)
    if (balls.instanceColor) balls.instanceColor.needsUpdate = true
  }, [state])

  const m4 = useMemo(() => new THREE.Matrix4(), [])

  useFrame((_, delta) => {
    timeRef.current += delta
    const dt = Math.min(delta, 0.04)
    const T  = tRef.current
    const { pos, vel, side } = state

    if (prevTRef.current !== T) {
      const ratio = Math.sqrt(T / prevTRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTRef.current = T
    }

    // Partition lifts out of the box from the bottom up
    if (timeRef.current > OPEN_AT && openRef.current < 1) openRef.current = Math.min(1, openRef.current + delta * 0.45)
    const open = openRef.current
    const gapTop = -HALF_H + open * 2 * HALF_H // gap spans [−HALF_H, gapTop]
    if (wallRef.current) wallRef.current.position.y = open * 2 * HALF_H

    let aRight = 0, bLeft = 0
    for (let i = 0; i < N; i++) {
      const prevX = pos[i*3]
      pos[i*3]   += vel[i*3]   * dt
      pos[i*3+1] += vel[i*3+1] * dt
      const x = pos[i*3], y = pos[i*3+1]

      if (x >  HALF_W - R) { pos[i*3] =  HALF_W - R; vel[i*3] = -Math.abs(vel[i*3]) }
      if (x < -HALF_W + R) { pos[i*3] = -HALF_W + R; vel[i*3] =  Math.abs(vel[i*3]) }
      if (y >  HALF_H - R) { pos[i*3+1] =  HALF_H - R; vel[i*3+1] = -Math.abs(vel[i*3+1]) }
      if (y < -HALF_H + R) { pos[i*3+1] = -HALF_H + R; vel[i*3+1] =  Math.abs(vel[i*3+1]) }

      // Partition: blocks crossing x = 0 except through the opened gap
      const crossed = (prevX < 0) !== (pos[i*3] < 0)
      if (crossed && pos[i*3+1] > gapTop) {
        pos[i*3] = prevX < 0 ? -R : R
        vel[i*3] = -vel[i*3]
      }

      if (side[i] === 0 && pos[i*3] > 0) aRight++
      if (side[i] === 1 && pos[i*3] < 0) bLeft++
    }

    const balls = ballsRef.current
    if (balls) {
      for (let i = 0; i < N; i++) {
        m4.makeTranslation(pos[i*3], pos[i*3+1], pos[i*3+2])
        balls.setMatrixAt(i, m4)
      }
      balls.instanceMatrix.needsUpdate = true
    }

    // Mixing entropy per molecule (in k): average of each species' positional entropy
    const fA = aRight / (N / 2), fB = bLeft / (N / 2)
    const S = 0.5 * (H(fA) + H(fB))

    trace.clock += delta
    if (trace.clock >= TRACE_DT) {
      trace.clock = 0
      if (trace.n < TRACE_N) trace.s[trace.n++] = S
      else { trace.s.copyWithin(0, 1); trace.s[TRACE_N - 1] = S }
    }

    const card = cardRef.current
    if (card) {
      const set = (sel, v) => { const el = card.querySelector(sel); if (el) el.textContent = v }
      set('.e-s', S.toFixed(3))
      set('.e-pct', `${Math.round((S / Math.LN2) * 100)}%`)
      set('.e-fa', `${Math.round(fA * 100)}%`)
      set('.e-fb', `${Math.round(fB * 100)}%`)
      set('.e-phase',
        open === 0 ? 'Partition closed' :
        open < 1   ? 'Partition lifting' :
        S / Math.LN2 < 0.5 ? 'Diffusing' :
        S / Math.LN2 < 0.95 ? 'Mixing' : 'Equilibrium — fully mixed')
      const line = card.querySelector('.e-trace')
      if (line && trace.n > 1) {
        const pts = []
        for (let k = 0; k < trace.n; k++) {
          pts.push(`${((k / (TRACE_N - 1)) * 100).toFixed(1)},${(100 - (trace.s[k] / Math.LN2) * 92).toFixed(1)}`)
        }
        line.setAttribute('points', pts.join(' '))
      }
    }
  })

  const boxGeo   = useMemo(() => new THREE.BoxGeometry(HALF_W * 2, HALF_H * 2, DEPTH), [])
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo])
  useEffect(() => () => { boxGeo.dispose(); edgesGeo.dispose() }, [boxGeo, edgesGeo])

  return (
    <group position={[-1.1, 0, 0]}>
      {/* Container */}
      <mesh geometry={boxGeo}>
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.45} />
      </lineSegments>

      {/* Partition (slides up and out of the box) */}
      <mesh ref={wallRef}>
        <boxGeometry args={[0.06, HALF_H * 2, DEPTH]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.25} transparent opacity={0.8} />
      </mesh>

      {/* Molecules */}
      <instancedMesh ref={ballsRef} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[R, 14, 10]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} emissiveIntensity={0.15} emissive="#0f172a" />
      </instancedMesh>

      {/* Species labels */}
      <Html position={[-HALF_W / 2, HALF_H + 0.45, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#22d3ee', whiteSpace: 'nowrap' }}>Gas A</span>
      </Html>
      <Html position={[HALF_W / 2, HALF_H + 0.45, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#fb923c', whiteSpace: 'nowrap' }}>Gas B</span>
      </Html>

      {/* Readout card, pinned to the scene corner */}
      <SceneCard interactive>
        <div ref={cardRef} style={{
          width: 214, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Mixing entropy</span>
            <span className="e-pct" style={{ fontSize: 12, color: 'rgb(var(--c-text-muted))' }}>0%</span>
          </div>
          <div className="e-phase" style={{ fontSize: 12, color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>Partition closed</div>

          <div style={{ position: 'relative', height: 70, borderLeft: '1px solid rgb(var(--c-border))', borderBottom: '1px solid rgb(var(--c-border))', marginBottom: 4 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '8%', borderTop: '1px dashed #fbbf24', opacity: 0.7 }} />
            <span style={{ position: 'absolute', right: 2, top: 'calc(8% - 15px)', fontSize: 11, color: '#fbbf24' }}>ln 2</span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <polyline className="e-trace" fill="none" stroke="#38bdf8" strokeWidth="2" vectorEffect="non-scaling-stroke" points="" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>
            <span>S(t)</span><span>time →</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 12, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 8 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>ΔS / Nk</dt>
            <dd className="e-s" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>0.000</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Gas A on right</dt>
            <dd className="e-fa" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#22d3ee' }}>0%</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Gas B on left</dt>
            <dd className="e-fb" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fb923c' }}>0%</dd>
          </dl>
          <button type="button" onClick={reset} className="ui-btn w-full mt-3 h-8">Reset partition</button>
        </div>
      </SceneCard>
    </group>
  )
}
