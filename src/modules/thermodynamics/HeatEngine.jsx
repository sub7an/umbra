// Carnot cycle: PV diagram + animated 3D piston cylinder
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

const STEPS = 200

const PHASE_COLORS = [
  new THREE.Color('#f59e0b'),  // A→B isothermal expansion   (hot)
  new THREE.Color('#f59e0b'),  // B→C adiabatic expansion
  new THREE.Color('#fb923c'),  // C→D isothermal compression (cold)
  new THREE.Color('#a855f7'),  // D→A adiabatic compression
]

const PHASE_LABELS = [
  'Isothermal exp.',
  'Adiabatic exp.',
  'Isothermal comp.',
  'Adiabatic comp.',
]

function carnotCycle(T) {
  const TH    = T * 2 + 1
  const TC    = 1.0
  const gamma = 1.4
  const VA = 0.5, VB = 2.0
  const PA = TH / VA, PB = TH / VB
  const VC = Math.pow(PB * Math.pow(VB, gamma) / TC, 1 / gamma)
  const PC = TC / VC
  const VD = Math.pow(PA * Math.pow(VA, gamma) / TC, 1 / gamma)
  const PD = TC / VD
  const pts = []
  const addPts = (phase, V0, V1, Pfn) => {
    for (let i = 0; i <= STEPS; i++) {
      const V = V0 + (i / STEPS) * (V1 - V0)
      const P = Pfn(V)
      if (P > 0) pts.push({ V, P, phase })
    }
  }
  addPts(0, VA, VB, (V) => TH / V)
  addPts(1, VB, VC,  (V) => PB * Math.pow(VB / V, gamma))
  addPts(2, VC, VD,  (V) => TC / V)
  addPts(3, VD, VA,  (V) => PD * Math.pow(VD / V, gamma))
  return { pts, TH, TC, efficiency: 1 - TC / TH, VA, Vmax: Math.max(VB, VC, VD) }
}

function buildGeometry(pts) {
  const allV = pts.map(p => p.V), allP = pts.map(p => p.P)
  const minV = Math.min(...allV), maxV = Math.max(...allV)
  const minP = Math.min(...allP), maxP = Math.max(...allP)
  const mapV = (V) => ((V - minV) / (maxV - minV) - 0.5) * 7
  const mapP = (P) => ((P - minP) / (maxP - minP)) * 4.5
  const posArr = new Float32Array(pts.length * 3)
  const colArr = new Float32Array(pts.length * 3)
  pts.forEach(({ V, P, phase }, i) => {
    posArr[i*3] = mapV(V); posArr[i*3+1] = mapP(P); posArr[i*3+2] = 0
    const c = PHASE_COLORS[phase]
    colArr[i*3] = c.r; colArr[i*3+1] = c.g; colArr[i*3+2] = c.b
  })
  return { posArr, colArr, mapV, mapP }
}

// ─── Piston cylinder (reads VRef + phaseRef imperatively each frame) ──────────
function PistonCylinder({ VRef, phaseRef, VA, Vmax }) {
  const pistonRef   = useRef()
  const flameRef    = useRef()
  const coldRef     = useRef()
  const hotMatRef   = useRef()
  const coldMatRef  = useRef()
  const tRef        = useRef(0)

  const TRAVEL  = 2.4
  const CYL_LEN = TRAVEL + 1.3
  const CYL_R   = 0.62

  const cylGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_LEN, 32, 1, true)
    g.rotateZ(Math.PI / 2)
    return g
  }, [CYL_LEN])

  const pistonGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(CYL_R * 0.92, CYL_R * 0.92, 0.14, 32)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])

  const capGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(CYL_R, CYL_R, 0.14, 32)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])

  useFrame((_, delta) => {
    tRef.current += delta
    const V     = VRef.current
    const phase = phaseRef.current
    const t     = (V - VA) / (Vmax - VA)
    const px    = -TRAVEL / 2 + t * TRAVEL

    if (pistonRef.current) pistonRef.current.position.x = px

    const isHot  = phase === 0
    const isCold = phase === 2
    const pulse  = Math.sin(tRef.current * 12)

    if (flameRef.current) flameRef.current.intensity = isHot  ? 1.0 + 0.7 * pulse : 0
    if (coldRef.current)  coldRef.current.intensity  = isCold ? 0.7 + 0.3 * Math.sin(tRef.current * 9) : 0
    if (hotMatRef.current)  hotMatRef.current.emissiveIntensity  = isHot  ? 0.7 + 0.4 * pulse : 0.05
    if (coldMatRef.current) coldMatRef.current.emissiveIntensity = isCold ? 0.5 + 0.2 * Math.sin(tRef.current * 9) : 0.05
  })

  return (
    <group position={[3.8, -1.5, 0]}>
      {/* Barrel */}
      <mesh geometry={cylGeo}>
        <meshStandardMaterial color="#5566aa" transparent opacity={0.16}
          roughness={0.1} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={cylGeo}>
        <meshBasicMaterial color="#6677bb" wireframe transparent opacity={0.10} />
      </mesh>

      {/* Hot end cap (left) */}
      <mesh geometry={capGeo} position={[-CYL_LEN/2, 0, 0]}>
        <meshStandardMaterial ref={hotMatRef} color="#ff4422" emissive="#ff2200"
          emissiveIntensity={0.05} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Cold end cap (right) */}
      <mesh geometry={capGeo} position={[CYL_LEN/2, 0, 0]}>
        <meshStandardMaterial ref={coldMatRef} color="#4488ff" emissive="#2255ff"
          emissiveIntensity={0.05} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Piston (animated) */}
      <mesh ref={pistonRef} geometry={pistonGeo}>
        <meshStandardMaterial color="#99bbdd" roughness={0.15} metalness={0.85} />
      </mesh>

      {/* Dynamic lights */}
      <pointLight ref={flameRef} position={[-CYL_LEN/2 + 0.4, 0, 0]}
        color="#ff4422" intensity={0} distance={3.5} decay={2} />
      <pointLight ref={coldRef}  position={[CYL_LEN/2 - 0.4, 0, 0]}
        color="#4488ff" intensity={0} distance={3.5} decay={2} />

      {/* Labels */}
      <Html position={[-CYL_LEN/2, -1.1, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: '#ff6644', letterSpacing: '0.1em' }}>Q_IN</span>
      </Html>
      <Html position={[CYL_LEN/2, -1.1, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: '#4488ff', letterSpacing: '0.1em' }}>Q_OUT</span>
      </Html>
    </group>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HeatEngine({ temperature }) {
  const dotRef    = useRef()
  const dotMatRef = useRef()
  const tRef      = useRef(0)
  const VRef      = useRef(0.5)
  const phaseRef  = useRef(0)

  const { pts, efficiency, TH, VA, Vmax } = useMemo(
    () => carnotCycle(temperature), [temperature]
  )
  const { posArr, colArr, mapV, mapP } = useMemo(
    () => buildGeometry(pts), [pts]
  )

  const phaseLines = useMemo(() => {
    const groups = [[], [], [], []]
    pts.forEach(({ V, P, phase }) => groups[phase].push(new THREE.Vector3(mapV(V), mapP(P), 0)))
    return groups
  }, [pts, mapV, mapP])

  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta * 0.15) % 1.0
    const idx = Math.floor(tRef.current * (pts.length - 1))
    VRef.current    = pts[idx].V
    phaseRef.current = pts[idx].phase
    if (dotRef.current) {
      dotRef.current.position.set(posArr[idx*3], posArr[idx*3+1], 0.1)
    }
    if (dotMatRef.current) {
      const c = PHASE_COLORS[pts[idx].phase]
      dotMatRef.current.color.set(c)
      dotMatRef.current.emissive.set(c)
    }
  })

  return (
    <group position={[-2.5, 0.5, 0]}>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 4]} intensity={0.5} color="#38bdf8" />

      {/* PV axes */}
      <Line points={[[-4, -0.4, 0], [4.5, -0.4, 0]]} color="#38bdf8" lineWidth={1} transparent opacity={0.28} />
      <Line points={[[-4, -0.4, 0], [-4, 5.1, 0]]}   color="#38bdf8" lineWidth={1} transparent opacity={0.28} />

      {/* Cycle segments */}
      {phaseLines.map((linePts, i) => linePts.length > 1 && (
        <Line key={i} points={linePts}
          color={`#${PHASE_COLORS[i].getHexString()}`}
          lineWidth={2.2} transparent opacity={0.85} />
      ))}

      {/* Working point */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial ref={dotMatRef} emissiveIntensity={2.8} roughness={0} metalness={0} />
      </mesh>

      {/* Axis labels */}
      <Html position={[5.0, -0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#38bdf8', opacity: 0.65 }}>V</span>
      </Html>
      <Html position={[-4.5, 5.4, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#38bdf8', opacity: 0.65 }}>P</span>
      </Html>

      {/* Efficiency readout */}
      <Html position={[1.8, 4.6, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, textAlign: 'right', lineHeight: 1.75 }}>
          <div style={{ color: '#f59e0b' }}>T_H = {TH.toFixed(2)}</div>
          <div style={{ color: '#fb923c' }}>T_C = 1.00</div>
          <div style={{ color: '#f59e0b', fontWeight: 700 }}>η = {(efficiency*100).toFixed(1)}%</div>
        </div>
      </Html>

      {/* Phase legend */}
      <Html position={[-3.8, 4.6, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, lineHeight: 2.0 }}>
          {PHASE_COLORS.map((c, i) => (
            <div key={i} style={{ color: `#${c.getHexString()}` }}>─ {PHASE_LABELS[i]}</div>
          ))}
        </div>
      </Html>

      {/* Piston cylinder */}
      <PistonCylinder VRef={VRef} phaseRef={phaseRef} VA={VA} Vmax={Vmax} />
    </group>
  )
}
