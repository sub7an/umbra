import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { hubbleExpansion, toHubbleUnits } from './frontierMath'

const GRID_N = 5
const SPACING = 1.1
const T_CYCLE = 7
const EXPAND_RATE = 0.09

// Varied galaxy appearances (color, scale)
const GALAXY_PALETTE = [
  '#fff4d6', '#ffe0c4', '#d4eeff', '#ffcfcf', '#ccedee',
  '#fffde0', '#d0d8ff', '#f0ffe0', '#ffd6f0', '#e0fff8',
  '#fff0e0', '#dde8ff',
]
const GALAXY_SCALES = [0.80, 1.10, 1.25, 0.90, 1.05, 0.95, 1.30, 0.78, 1.00, 1.18, 0.88, 1.12]

function buildGrid() {
  const positions = []
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = (i - 2) * SPACING
      const z = (j - 2) * SPACING
      if (i === 2 && j === 2) continue
      positions.push([x, 0, z])
    }
  }
  return positions
}

const LABELED_GALAXIES = [
  { pos: [SPACING, 0, 0],     d: SPACING },
  { pos: [-SPACING, 0, 0],    d: SPACING },
  { pos: [0, 0, SPACING],     d: SPACING },
  { pos: [2 * SPACING, 0, 0], d: 2 * SPACING },
]

// ── Hubble velocity arrows on all galaxies ─────────────────────────────────
function VelocityArrows({ gridPositions, hubble, scaleRef }) {
  const N = gridPositions.length
  const posArr = useMemo(() => new Float32Array(N * 6), [N])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    return g
  }, [posArr])

  useEffect(() => () => geo.dispose(), [geo])

  useFrame(() => {
    const a = scaleRef.current
    let idx = 0
    for (let i = 0; i < N; i++) {
      const [x0, , z0] = gridPositions[i]
      const wx = x0 * a
      const wz = z0 * a
      const len = Math.sqrt(wx * wx + wz * wz)
      const d = len                       // proper distance in scene units
      const arrowLen = hubble * d * 0.2   // v = H₀d, scaled to scene
      const nx = len > 0 ? wx / len : 0
      const nz = len > 0 ? wz / len : 0
      posArr[idx++] = wx
      posArr[idx++] = 0
      posArr[idx++] = wz
      posArr[idx++] = wx + nx * arrowLen
      posArr[idx++] = 0
      posArr[idx++] = wz + nz * arrowLen
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#f59e0b" transparent opacity={0.7} />
    </lineSegments>
  )
}

export default function ExpansionSim() {
  const hubble = useModuleStore((s) => s.fp.hubble)

  const gridPositions = useMemo(() => buildGrid(), [])
  const N = gridPositions.length

  const instancedRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const timeRef = useRef(0)
  const scaleRef = useRef(1)

  // Apply varied colors per galaxy instance
  useEffect(() => {
    if (!instancedRef.current) return
    for (let i = 0; i < N; i++) {
      const color = new THREE.Color(GALAXY_PALETTE[i % GALAXY_PALETTE.length])
      instancedRef.current.setColorAt(i, color)
    }
    instancedRef.current.instanceColor.needsUpdate = true
  }, [N])

  useFrame((_, delta) => {
    timeRef.current += delta * 0.22
    const phase = timeRef.current % (2 * T_CYCLE)
    const t = phase < T_CYCLE ? phase : 2 * T_CYCLE - phase
    const a = 1 + hubble * t * EXPAND_RATE
    scaleRef.current = a

    if (!instancedRef.current) return

    for (let i = 0; i < N; i++) {
      const [x0, y0, z0] = gridPositions[i]
      dummy.position.set(x0 * a, y0 * a, z0 * a)
      const instScale = GALAXY_SCALES[i % GALAXY_SCALES.length]
      dummy.scale.setScalar(instScale)
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

      {/* Expanding galaxies — white material so instanceColor shows through */}
      <instancedMesh ref={instancedRef} args={[null, null, N]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* Hubble velocity arrows on all galaxies */}
      <VelocityArrows gridPositions={gridPositions} hubble={hubble} scaleRef={scaleRef} />

      {/* Velocity labels on selected galaxies */}
      {LABELED_GALAXIES.map(({ pos, d }, idx) => (
        <GalaxyLabel
          key={idx}
          initialPos={pos}
          comoving={d}
          hubble={hubble}
          scaleRef={scaleRef}
        />
      ))}

      <GridLines />
    </group>
  )
}

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
          color: 'rgba(245,158,11,0.85)',
          background: 'rgba(5,9,12,0.75)',
          padding: '1px 4px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(245,158,11,0.25)',
        }}>
          v={vRec.toFixed(2)} H₀d
        </div>
      </Html>
    </group>
  )
}

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
