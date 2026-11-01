// Cosmic expansion sim: monotonic Hubble flow, Hubble sphere, redshift coloring.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { hubbleExpansion } from './frontierMath'
import SceneCard from '../../components/SceneCard'

const GRID_N     = 6      // 6×6 grid, center removed → 35 galaxies
const SPACING    = 1.0
const EXPAND_MAX = 2.6    // reset expansion when a reaches this
const EXPAND_RATE= 0.065  // a units per scene-second (at hubble=1)

// ── Redshift color: blue-white at d=0 → orange-red at max separation ─────────
const NEAR = new THREE.Color('#93c5fd')
const MIDZ = new THREE.Color('#fde68a')
const FAR  = new THREE.Color('#f87171')
function redshiftColor(comoving, a, hubble, out = new THREE.Color()) {
  const properD = comoving * a
  const zVis    = Math.min(hubble * properD * 0.16, 1.0) // visual z in [0,1]
  return zVis < 0.5 ? out.copy(NEAR).lerp(MIDZ, zVis * 2) : out.copy(MIDZ).lerp(FAR, (zVis - 0.5) * 2)
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
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#7dd3fc', whiteSpace: 'nowrap' }}>
          Hubble radius c/H₀
        </div>
      </Html>
    </>
  )
}

// ── Grid reference lines ──────────────────────────────────────────────────────
// Comoving grid: it stretches with the scale factor a — space itself expands,
// galaxies are not flying through a fixed grid.
function GridLines({ scaleRef }) {
  const ref = useRef()
  useFrame(() => { if (ref.current) ref.current.scale.setScalar(scaleRef.current) })
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
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color="#334155" transparent opacity={0.55} />
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
  const col          = useMemo(() => new THREE.Color(), [])
  const timeRef      = useRef(0)
  const scaleRef     = useRef(1)
  const cardRef      = useRef()
  const plotClock    = useRef(0)

  // Hubble-diagram axis limits (max proper distance in the run)
  const D_MAX = Math.SQRT2 * (GRID_N - 1) / 2 * SPACING * EXPAND_MAX
  const V_MAX = D_MAX * 2.5

  useFrame((_, delta) => {
    timeRef.current += delta * EXPAND_RATE * hubble
    let a = 1 + timeRef.current
    if (a > EXPAND_MAX) { timeRef.current = 0; a = 1 } // monotonic expansion, then restart
    scaleRef.current = a

    const inst = instancedRef.current
    if (!inst) return
    for (let i = 0; i < N; i++) {
      const { x: x0, z: z0, comoving } = gridPositions[i]
      dummy.position.set(x0 * a, 0, z0 * a)
      dummy.rotation.set(0, i * 1.7, 0.35)
      dummy.scale.set(0.15, 0.04, 0.15) // flattened disc galaxies
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      inst.setColorAt(i, redshiftColor(comoving, a, hubble, col))
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true

    // Card: scale factor + live Hubble diagram (v = H₀·d for every galaxy)
    const card = cardRef.current
    if (!card) return
    const aEl = card.querySelector('.x-a')
    if (aEl) aEl.textContent = a.toFixed(2)
    plotClock.current += delta
    if (plotClock.current < 0.2) return
    plotClock.current = 0
    const dots = card.querySelectorAll('.x-dot')
    for (let i = 0; i < N && i < dots.length; i++) {
      const d = gridPositions[i].comoving * a
      const v = hubbleExpansion(d, hubble)
      dots[i].setAttribute('cx', ((d / D_MAX) * 100).toFixed(1))
      dots[i].setAttribute('cy', (100 - Math.min(1, v / V_MAX) * 100).toFixed(1))
      dots[i].setAttribute('fill', `#${redshiftColor(gridPositions[i].comoving, a, hubble, col).getHexString()}`)
    }
  })

  const lineEnd = Math.min(1, (hubbleExpansion(D_MAX, hubble)) / V_MAX)

  return (
    <group>
      {/* You: reference galaxy at the origin */}
      <mesh>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.6} />
      </mesh>
      <Html position={[0, 0.55, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL, color: '#fbbf24' }}>You are here</span>
      </Html>

      {/* Galaxies, coloured by redshift */}
      <instancedMesh ref={instancedRef} args={[null, null, N]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.5} />
      </instancedMesh>

      <VelocityArrows gridPositions={gridPositions} hubble={hubble} scaleRef={scaleRef} />
      <HubbleSphere hubble={hubble} />
      <GridLines scaleRef={scaleRef} />

      {/* Pinned card */}
      <SceneCard>
        <div ref={cardRef} style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Hubble's law</span>
            <span style={{ color: 'rgb(var(--c-text-muted))' }}>a = <span className="x-a" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgb(var(--c-text))' }}>1.00</span></span>
          </div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 6 }}>Every galaxy: recession speed vs distance</div>
          <div style={{ position: 'relative', height: 96, borderLeft: '1px solid rgb(var(--c-border))', borderBottom: '1px solid rgb(var(--c-border))' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <line x1="0" y1="100" x2="100" y2={100 - lineEnd * 100} stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
              {gridPositions.map((_, i) => <circle key={i} className="x-dot" r="2.2" cx="0" cy="100" fill="#93c5fd" />)}
            </svg>
            <span style={{ position: 'absolute', left: 4, top: 2, fontSize: 11, color: 'rgb(var(--c-text-muted))' }}>v</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgb(var(--c-text-muted))', marginTop: 3 }}>
            <span>0</span><span>distance d →</span>
          </div>
          <div style={{ marginTop: 6, color: 'rgb(var(--c-text-muted))' }}>
            <span style={{ color: '#fbbf24' }}>- -</span> slope = H₀ (v = H₀d)
          </div>
          <div style={{ height: 8, borderRadius: 3, marginTop: 8, background: 'linear-gradient(90deg, #93c5fd, #fde68a, #f87171)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3, color: 'rgb(var(--c-text-muted))' }}>
            <span>near · low z</span><span>far · redshifted</span>
          </div>
          <div style={{ marginTop: 8, color: 'rgb(var(--c-text-muted))' }}>
            The grid stretches too: space itself expands.
          </div>
        </div>
      </SceneCard>
    </group>
  )
}

const LABEL = { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }
