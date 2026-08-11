// 2D ferromagnetic Ising model on a square lattice with periodic boundary
// conditions. Metropolis-Hastings Monte Carlo at temperature T.
// Tc = 2/ln(1+√2) ≈ 2.269 (exact Onsager solution for J=k_B=1).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

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

  // DOM refs for live readout
  const mDom = useRef()
  const eDom = useRef()

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
  })

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

      {/* ── Live readout (un-rotate back to world space) ── */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Html position={[gridSpan + 0.6, 0, -1.0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(3,8,16,0.90)',
            border: '1px solid rgba(56,189,248,0.20)',
            borderRadius: 3, padding: '7px 10px', minWidth: 128,
          }}>
            <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.45)', letterSpacing: '0.14em', marginBottom: 5 }}>
              ORDER PARAM
            </div>
            <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.55)', marginBottom: 2 }}>
              |M| = <span ref={mDom} style={{ color: '#38bdf8' }}>—</span>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(251,191,36,0.55)', marginBottom: 4 }}>
              E/N = <span ref={eDom} style={{ color: '#fbbf24' }}>—</span>
            </div>
            <div style={{ fontSize: 7, color: 'rgba(56,189,248,0.30)' }}>
              T_c ≈ {TC.toFixed(3)}
            </div>
          </div>
        </Html>
      </group>
    </group>
  )
}
