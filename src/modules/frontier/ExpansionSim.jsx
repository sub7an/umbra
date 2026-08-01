import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { hubbleExpansion, toHubbleUnits } from './frontierMath'

const GRID_N = 5
const SPACING = 1.1         // initial comoving separation (scene units)
const T_CYCLE = 7           // seconds for one expansion half-cycle
const EXPAND_RATE = 0.09    // scale factor growth rate multiplier

// Build initial galaxy positions: 5×5 grid with center excluded (= reference).
function buildGrid() {
  const positions = []
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = (i - 2) * SPACING
      const z = (j - 2) * SPACING
      if (i === 2 && j === 2) continue  // center is the reference galaxy
      positions.push([x, 0, z])
    }
  }
  return positions  // 24 non-reference galaxies
}

// Four selected galaxies where we show velocity labels.
// Using exact grid positions so they track their instance correctly.
const LABELED_GALAXIES = [
  { pos: [SPACING, 0, 0],         d: SPACING },
  { pos: [-SPACING, 0, 0],        d: SPACING },
  { pos: [0, 0, SPACING],         d: SPACING },
  { pos: [2 * SPACING, 0, 0],     d: 2 * SPACING },
]

export default function ExpansionSim() {
  const hubble = useModuleStore((s) => s.fp.hubble)

  const gridPositions = useMemo(() => buildGrid(), [])
  const N = gridPositions.length  // 24

  const instancedRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const timeRef = useRef(0)
  const scaleRef = useRef(1)

  useFrame((_, delta) => {
    timeRef.current += delta * 0.22
    // Ping-pong: expand → contract → repeat (no discontinuous snap)
    const phase = timeRef.current % (2 * T_CYCLE)
    const t = phase < T_CYCLE ? phase : 2 * T_CYCLE - phase
    const a = 1 + hubble * t * EXPAND_RATE
    scaleRef.current = a

    if (!instancedRef.current) return

    for (let i = 0; i < N; i++) {
      const [x0, y0, z0] = gridPositions[i]
      dummy.position.set(x0 * a, y0 * a, z0 * a)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      instancedRef.current.setMatrixAt(i, dummy.matrix)
    }
    instancedRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#e0f4ff" />

      {/* Reference galaxy — always at world origin */}
      <mesh>
        <sphereGeometry args={[0.17, 14, 14]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.1} />
      </mesh>
      <pointLight color="#f59e0b" intensity={1.2} distance={2.5} />

      <Html position={[0, 0.4, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: '#f59e0b',
          whiteSpace: 'nowrap',
          textShadow: '0 0 8px rgba(245,158,11,0.8)',
          letterSpacing: '0.08em',
        }}>
          ★ REFERENCE
        </div>
      </Html>

      {/* Expanding galaxies */}
      <instancedMesh ref={instancedRef} args={[null, null, N]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={0.55} />
      </instancedMesh>

      {/* Velocity labels on four selected galaxies */}
      {LABELED_GALAXIES.map(({ pos, d }, idx) => (
        <GalaxyLabel
          key={idx}
          initialPos={pos}
          comoving={d}
          hubble={hubble}
          scaleRef={scaleRef}
        />
      ))}

      {/* Faint reference grid */}
      <GridLines />
    </group>
  )
}

// Label that tracks a galaxy as it expands by updating a group's position each frame.
function GalaxyLabel({ initialPos, comoving, hubble, scaleRef }) {
  const groupRef = useRef()
  const [ix, , iz] = initialPos
  const vRec = hubbleExpansion(comoving, hubble)

  useFrame(() => {
    if (!groupRef.current) return
    const a = scaleRef.current
    groupRef.current.position.set(ix * a, 0.3, iz * a)
  })

  return (
    <group ref={groupRef} position={[ix, 0.3, iz]}>
      <Html center occlude={false} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8,
          color: 'rgba(0,229,196,0.75)',
          background: 'rgba(5,9,12,0.75)',
          padding: '1px 4px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(0,229,196,0.2)',
        }}>
          d={comoving.toFixed(1)} · v={vRec.toFixed(2)}
        </div>
      </Html>
    </group>
  )
}

// Faint grid plane for spatial reference.
function GridLines() {
  const extent = GRID_N * SPACING * 1.45
  const step = SPACING

  const linePairs = useMemo(() => {
    const pairs = []
    for (let i = -2; i <= 2; i++) {
      const v = i * step
      pairs.push({ p1: [-extent, 0, v], p2: [extent, 0, v] })
      pairs.push({ p1: [v, 0, -extent], p2: [v, 0, extent] })
    }
    return pairs
  }, [])

  return (
    <>
      {linePairs.map(({ p1, p2 }, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...p1, ...p2])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#0c1e2a" transparent opacity={0.4} />
        </line>
      ))}
    </>
  )
}
