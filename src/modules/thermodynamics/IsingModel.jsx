// 2D ferromagnetic Ising model on a square lattice with periodic boundary
// conditions. Metropolis-Hastings Monte Carlo at temperature T.
// Tc = 2/ln(1+√2) ≈ 2.269 (exact Onsager solution for J=k_B=1).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'

const L       = 40     // lattice side
const N       = L * L
const SPACING = 0.22   // gap between spin tiles
const TILE    = 0.185  // tile size (< SPACING so there's a grid gap)
const SWEEPS  = 4      // Metropolis sweeps per frame

const TC = 2.0 / Math.log(1 + Math.sqrt(2))   // ≈ 2.2692

const UP_CLR   = new THREE.Color('#38bdf8')   // cyan — spin +1
const DOWN_CLR = new THREE.Color('#f472b6')   // pink — spin -1

function randomLattice() {
  const s = new Int8Array(N)
  for (let i = 0; i < N; i++) s[i] = Math.random() < 0.5 ? 1 : -1
  return s
}

// Single spin-flip Metropolis step (J = k_B = 1)
function metropolis(spins, T) {
  const i   = (Math.random() * N) | 0
  const row = (i / L) | 0
  const col = i % L
  const sum = spins[((row > 0 ? row-1 : L-1)*L + col)] +
              spins[((row < L-1 ? row+1 : 0)*L + col)] +
              spins[(row*L + (col > 0 ? col-1 : L-1))] +
              spins[(row*L + (col < L-1 ? col+1 : 0))]
  const dE = 2 * spins[i] * sum
  if (dE < 0 || Math.random() < Math.exp(-dE / T)) spins[i] *= -1
}

export default function IsingModel({ temperature }) {
  const spinsRef = useRef(randomLattice())
  const meshRef  = useRef()
  const dummy    = useMemo(() => new THREE.Object3D(), [])

  // DOM refs for live readout + |M|(t) trace
  const mDom = useRef()
  const eDom = useRef()
  const traceDom = useRef()
  const trace = useMemo(() => ({ v: new Float32Array(100), n: 0, clock: 0 }), [])

  // Reset lattice when temperature crosses Tc
  const prevPhaseRef = useRef(temperature < TC ? 'ferro' : 'para')
  useEffect(() => {
    const phase = temperature < TC ? 'ferro' : 'para'
    if (phase !== prevPhaseRef.current) {
      // Crossing phase boundary → reset to random (show equilibration)
      spinsRef.current = randomLattice()
      prevPhaseRef.current = phase
    }
  }, [temperature])

  // Pre-compute positions (constant grid)
  const positions = useMemo(() => {
    const p = []
    for (let i = 0; i < N; i++) {
      const row = (i / L) | 0
      const col = i % L
      p.push(
        (col - L / 2 + 0.5) * SPACING,
        (row - L / 2 + 0.5) * SPACING,
      )
    }
    return p
  }, [])

  useFrame(() => {
    const spins = spinsRef.current
    const T = Math.max(0.05, temperature)

    // Metropolis sweeps
    for (let s = 0; s < SWEEPS; s++) {
      for (let k = 0; k < N; k++) metropolis(spins, T)
    }

    const mesh = meshRef.current
    if (!mesh) return

    let sumM = 0, sumE = 0
    for (let i = 0; i < N; i++) {
      const x = positions[i * 2], z = positions[i * 2 + 1]
      dummy.position.set(x, 0, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, spins[i] > 0 ? UP_CLR : DOWN_CLR)
      sumM += spins[i]

      // Energy contribution from right and bottom neighbors (avoid double-count)
      const row = (i / L) | 0, col = i % L
      const right = row * L + (col < L - 1 ? col + 1 : 0)
      const down  = (row < L - 1 ? row + 1 : 0) * L + col
      sumE += -spins[i] * (spins[right] + spins[down])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    const M = Math.abs(sumM / N)
    const E = sumE / N
    if (mDom.current) mDom.current.textContent = M.toFixed(3)
    if (eDom.current) eDom.current.textContent = E.toFixed(3)

    trace.clock += 1 / 60
    if (trace.clock >= 0.2) {
      trace.clock = 0
      if (trace.n < trace.v.length) trace.v[trace.n++] = M
      else { trace.v.copyWithin(0, 1); trace.v[trace.v.length - 1] = M }
      if (traceDom.current && trace.n > 1) {
        const pts = []
        for (let k = 0; k < trace.n; k++) pts.push(`${(k / (trace.v.length - 1) * 100).toFixed(1)},${(100 - trace.v[k] * 92).toFixed(1)}`)
        traceDom.current.setAttribute('points', pts.join(' '))
      }
    }
  })

  const ordered = temperature < TC
  const tPos = Math.min(100, (temperature / 3) * 100)
  const tcPos = (TC / 3) * 100

  const gridSpan = (L - 1) * SPACING / 2

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <ambientLight intensity={0.3} color="#020810" />

      {/* Spin lattice as flat InstancedMesh in XY plane (group is rotated XZ) */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, N]}>
        <planeGeometry args={[TILE, TILE]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} />
      </instancedMesh>

      {/* Grid border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(gridSpan*2 + SPACING, gridSpan*2 + SPACING)]} />
        <lineBasicMaterial color="#0d2030" transparent opacity={0.5} />
      </lineSegments>

      {/* ── Live readout, pinned to the scene corner ── */}
      <SceneCard>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Phase transition</div>
          <div style={{ color: ordered ? '#38bdf8' : '#f472b6', marginBottom: 8 }}>
            {ordered ? 'Ordered — ferromagnet (T < T_c)' : 'Disordered — paramagnet (T > T_c)'}
          </div>

          {/* Temperature scale with the critical point */}
          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #38bdf8, #a78bfa 75%, #f472b6)' }}>
            <div style={{ position: 'absolute', left: `${tcPos}%`, top: -4, bottom: -4, borderLeft: '2px solid #fbbf24' }} />
            <div style={{ position: 'absolute', left: `calc(${tPos}% - 6px)`, top: -3, width: 12, height: 14, borderRadius: 3, background: 'rgb(var(--c-text))' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'rgb(var(--c-text-muted))' }}>
            <span>T = {temperature.toFixed(2)}</span><span style={{ color: '#fbbf24' }}>T_c ≈ {TC.toFixed(3)}</span>
          </div>

          <div style={{ position: 'relative', height: 54, margin: '10px 0 4px', borderLeft: '1px solid rgb(var(--c-border))', borderBottom: '1px solid rgb(var(--c-border))' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <polyline ref={traceDom} fill="none" stroke="#38bdf8" strokeWidth="2" vectorEffect="non-scaling-stroke" points="" />
            </svg>
            <span style={{ position: 'absolute', left: 4, top: 0, fontSize: 11, color: 'rgb(var(--c-text-muted))' }}>|M|(t)</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 8 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Magnetisation |M|</dt>
            <dd ref={mDom} style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#38bdf8' }}>—</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Energy per spin E/N</dt>
            <dd ref={eDom} style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fbbf24' }}>—</dd>
          </dl>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, color: 'rgb(var(--c-text-muted))' }}>
            <span><span style={{ color: '#38bdf8' }}>■</span> spin up</span>
            <span><span style={{ color: '#f472b6' }}>■</span> spin down</span>
          </div>
        </div>
      </SceneCard>
    </group>
  )
}
