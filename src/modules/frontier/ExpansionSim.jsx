// Cosmic expansion sim: monotonic Hubble flow, Hubble sphere, redshift coloring.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { hubbleExpansion } from './frontierMath'

const GRID_N     = 6      // 6×6 grid, center removed → 35 galaxies
const SPACING    = 1.0
const EXPAND_MAX = 2.6    // reset expansion when a reaches this
const EXPAND_RATE= 0.065  // a units per scene-second (at hubble=1)

// ── Redshift color: blue-white at d=0 → orange-red at max separation ─────────
function redshiftColor(comoving, a, hubble) {
  const properD  = comoving * a
  const zVis     = Math.min(hubble * properD * 0.28, 1.0)  // visual z in [0,1]
  const r = 0.75 + 0.25 * zVis
  const g = 0.82 - 0.32 * zVis
  const b = 1.00 - 0.55 * zVis
  return new THREE.Color(r, g, b)
}

function buildGrid() {
  const positions = []
  const half = Math.floor(GRID_N / 2)
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const cx = i - (GRID_N - 1) / 2
      const cz = j - (GRID_N - 1) / 2
      if (cx === 0 && cz === 0) continue
      const comoving = Math.sqrt(cx * cx + cz * cz) * SPACING
      positions.push({ x: cx * SPACING, z: cz * SPACING, comoving })
    }
  }
  return positions
}

// ── Velocity arrow segments on all galaxies ───────────────────────────────────
function VelocityArrows({ gridPositions, hubble, scaleRef }) {
  const N      = gridPositions.length
  const posArr = useMemo(() => new Float32Array(N * 6), [N])
  const colArr = useMemo(() => new Float32Array(N * 6), [N])  // 2 verts × 3 rgb

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colArr, 3))
    return g
  }, [posArr, colArr])

  useEffect(() => () => geo.dispose(), [geo])

  useFrame(() => {
    const a = scaleRef.current
    let pi = 0, ci = 0
    for (let i = 0; i < N; i++) {
      const { x: x0, z: z0, comoving } = gridPositions[i]
      const wx = x0 * a, wz = z0 * a
      const len = Math.sqrt(wx * wx + wz * wz)
      const arrowLen = Math.min(hubble * len * 0.22, len * 0.8)
      const nx = len > 0 ? wx / len : 0, nz = len > 0 ? wz / len : 0

      // Color: normal amber → bright red when near Hubble sphere
      const hubbleR = GRID_N * SPACING / (1.5 * hubble)
      const ratio = len / hubbleR
      const isNearH = ratio > 0.7
      const r = 0.95, g = isNearH ? 0.3 : 0.62, b = 0.08

      posArr[pi++] = wx;    posArr[pi++] = 0; posArr[pi++] = wz
      posArr[pi++] = wx+nx*arrowLen; posArr[pi++] = 0; posArr[pi++] = wz+nz*arrowLen
      // start color
      colArr[ci++] = r; colArr[ci++] = g; colArr[ci++] = b
      // tip color (brighter)
      colArr[ci++] = 1.0; colArr[ci++] = isNearH ? 0.15 : 0.75; colArr[ci++] = 0.1
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate    = true
  })

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={0.82} />
    </lineSegments>
  )
}

// ── Hubble sphere: dotted ring ────────────────────────────────────────────────
function HubbleSphere({ hubble }) {
  const radius   = Math.min(Math.max(GRID_N * SPACING / (1.5 * hubble), 1.2), 5.5)
  const geo      = useMemo(() => {
    const N = 96
    const pts = []
    for (let i = 0; i <= N; i++) {
      const θ = (i / N) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(θ) * radius, 0, Math.sin(θ) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <>
      <line geometry={geo}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.28} />
      </line>
      {/* dash overlay — every other quarter arc */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 3 / 2].map((offset, i) => {
        const pts2 = []
        for (let k = 0; k <= 24; k += 2) {
          const θ = offset + (k / 96) * Math.PI * 2
          pts2.push(new THREE.Vector3(Math.cos(θ) * radius, 0, Math.sin(θ) * radius))
        }
        const g2 = new THREE.BufferGeometry().setFromPoints(pts2)
        return (
          <line key={i} geometry={g2}>
            <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
          </line>
        )
      })}

      <Html position={[radius * 0.72, 0, radius * 0.72]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8, color: '#38bdf8',
          letterSpacing: '0.12em',
          textShadow: '0 0 6px rgba(56,189,248,0.5)',
        }}>
          c/H₀
        </div>
      </Html>
    </>
  )
}

// ── Grid reference lines ──────────────────────────────────────────────────────
function GridLines() {
  const extent = GRID_N * SPACING * 1.0
  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= GRID_N; i++) {
      const v = (i - GRID_N / 2) * SPACING
      pts.push(new THREE.Vector3(-extent, 0, v), new THREE.Vector3(extent, 0, v))
      pts.push(new THREE.Vector3(v, 0, -extent), new THREE.Vector3(v, 0, extent))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#0c1a24" transparent opacity={0.5} />
    </lineSegments>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExpansionSim() {
  const hubble = useModuleStore((s) => s.fp.hubble)

  const gridPositions = useMemo(() => buildGrid(), [])
  const N = gridPositions.length

  const instancedRef = useRef()
  const dummy        = useMemo(() => new THREE.Object3D(), [])
  const timeRef      = useRef(0)
  const scaleRef     = useRef(1)
  const scaleReadRef = useRef()
  const aRef         = useRef(1)

  useFrame((_, delta) => {
    timeRef.current += delta * EXPAND_RATE * hubble

    let a = 1 + timeRef.current
    if (a > EXPAND_MAX) {
      // Hard reset — monotonic expansion then snap back to start
      timeRef.current = 0
      a = 1
    }
    scaleRef.current = a
    aRef.current = a

    if (!instancedRef.current) return

    for (let i = 0; i < N; i++) {
      const { x: x0, z: z0, comoving } = gridPositions[i]
      dummy.position.set(x0 * a, 0, z0 * a)
      dummy.scale.setScalar(0.10)
      dummy.updateMatrix()
      instancedRef.current.setMatrixAt(i, dummy.matrix)

      // Redshift coloring per-frame
      instancedRef.current.setColorAt(i, redshiftColor(comoving, a, hubble))
    }
    instancedRef.current.instanceMatrix.needsUpdate = true
    if (instancedRef.current.instanceColor)
      instancedRef.current.instanceColor.needsUpdate = true

    // Scale readout
    if (scaleReadRef.current)
      scaleReadRef.current.textContent = `a = ${a.toFixed(2)}`
  })

  return (
    <group>
      <ambientLight intensity={0.06} color="#060a18" />
      <pointLight position={[0, 12, 0]} intensity={0.5} color="#d4e8ff" distance={20} decay={2} />
      <pointLight position={[0, 3, 0]}  intensity={0.8} color="#fff8d0" distance={5} decay={2} />

      {/* Reference galaxy — Milky Way analogue, always at origin */}
      <mesh>
        <sphereGeometry args={[0.20, 14, 14]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.4} />
      </mesh>
      <pointLight color="#f59e0b" intensity={1.6} distance={3.5} decay={2} />

      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: '#f59e0b',
          letterSpacing: '0.10em',
          textShadow: '0 0 8px rgba(245,158,11,0.7)',
        }}>★ YOU</div>
      </Html>

      {/* Expanding galaxies with per-frame redshift color */}
      <instancedMesh ref={instancedRef} args={[null, null, N]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff" emissive="#aac8ff"
          emissiveIntensity={0.55} toneMapped={false}
        />
      </instancedMesh>

      {/* Velocity arrows */}
      <VelocityArrows gridPositions={gridPositions} hubble={hubble} scaleRef={scaleRef} />

      {/* Hubble sphere boundary */}
      <HubbleSphere hubble={hubble} />

      {/* Grid */}
      <GridLines />

      {/* Scale factor readout */}
      <Html position={[3.2, 0, -3.2]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(4,6,14,0.82)',
          border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: 3, padding: '5px 10px',
        }}>
          <div ref={scaleReadRef} style={{ fontSize: 11, color: '#38bdf8', letterSpacing: '0.1em' }}>
            a = 1.00
          </div>
          <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.40)', letterSpacing: '0.12em', marginTop: 2 }}>
            SCALE FACTOR
          </div>
        </div>
      </Html>

      {/* Legend */}
      <Html position={[-3.5, 0, -3.2]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8, color: 'rgba(180,200,240,0.45)',
          lineHeight: 1.7,
          letterSpacing: '0.10em',
          background: 'rgba(4,6,14,0.75)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 3, padding: '5px 9px',
        }}>
          <div style={{ color: '#38bdf8', marginBottom: 2 }}>BLUE → RED</div>
          <div>Cosmological redshift</div>
          <div>z ∝ H₀ · d</div>
          <div style={{ marginTop: 5, color: '#f59e0b' }}>── ARROWS</div>
          <div>v = H₀ · d (Hubble law)</div>
        </div>
      </Html>
    </group>
  )
}
