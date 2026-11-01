// Carnot cycle: PV diagram (shaded work area, labelled states) + animated
// piston whose gas colour tracks the instantaneous temperature T = pV
import { Fragment, useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { hotReservoirT } from './carnot'
import SceneCard from '../../components/SceneCard'

const STEPS = 200

const PHASE_COLORS = [
  new THREE.Color('#7c8cff'),  // A→B isothermal expansion   (hot)
  new THREE.Color('#f59e0b'),  // B→C adiabatic expansion
  new THREE.Color('#fb923c'),  // C→D isothermal compression (cold)
  new THREE.Color('#a855f7'),  // D→A adiabatic compression
]

const GAS_COLD = new THREE.Color('#3b82f6')
const GAS_HOT  = new THREE.Color('#f97316')
const LABEL = { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }

const PHASE_LABELS = [
  'A→B isothermal expansion',
  'B→C adiabatic expansion',
  'C→D isothermal compression',
  'D→A adiabatic compression',
]

function carnotCycle(T) {
  const TH    = hotReservoirT(T)
  const TC    = 1.0
  // Monatomic ideal gas (γ = 5/3, same gas as the kinetic-theory view), nR = 1.
  // Adiabats obey T·V^(γ−1) = const, so V_C = V_B·(T_H/T_C)^(1/(γ−1)).
  const gamma = 5 / 3
  const VA = 0.5, VB = 2.0
  const PA = TH / VA, PB = TH / VB
  const VC = VB * Math.pow(TH / TC, 1 / (gamma - 1))
  const PC = TC / VC
  const VD = VA * Math.pow(TH / TC, 1 / (gamma - 1))
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
  const states = [
    { id: 'A', V: VA, P: PA }, { id: 'B', V: VB, P: PB },
    { id: 'C', V: VC, P: PC }, { id: 'D', V: VD, P: PD },
  ]
  // nR = 1: heat in on the hot isotherm, heat out on the cold one
  const Qin  = TH * Math.log(VB / VA)
  const Qout = TC * Math.log(VC / VD)
  return { pts, states, TH, TC, Qin, Qout, efficiency: 1 - TC / TH, VA, Vmax: Math.max(VB, VC, VD) }
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
function PistonCylinder({ VRef, PRef, phaseRef, VA, Vmax, TH, TC }) {
  const gasRef      = useRef()
  const gasMatRef   = useRef()
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
    // Gas column fills from the hot cap to the piston; colour tracks T = PV
    if (gasRef.current) {
      const left = -CYL_LEN / 2 + 0.07
      const len = Math.max(0.05, px - left)
      gasRef.current.scale.x = len
      gasRef.current.position.x = left + len / 2
    }
    if (gasMatRef.current) {
      const Tnow = PRef.current * V
      const k = Math.min(1, Math.max(0, (Tnow - TC) / Math.max(1e-6, TH - TC)))
      gasMatRef.current.color.copy(GAS_COLD).lerp(GAS_HOT, k)
      gasMatRef.current.emissive.copy(gasMatRef.current.color)
    }

    const isHot  = phase === 0
    const isCold = phase === 2
    const pulse  = Math.sin(tRef.current * 12)

    if (flameRef.current) flameRef.current.intensity = isHot  ? 1.0 + 0.7 * pulse : 0
    if (coldRef.current)  coldRef.current.intensity  = isCold ? 0.7 + 0.3 * Math.sin(tRef.current * 9) : 0
    if (hotMatRef.current)  hotMatRef.current.emissiveIntensity  = isHot  ? 0.7 + 0.4 * pulse : 0.05
    if (coldMatRef.current) coldMatRef.current.emissiveIntensity = isCold ? 0.5 + 0.2 * Math.sin(tRef.current * 9) : 0.05
  })

  return (
    <group position={[0.25, -2.7, 0]} scale={1.2}>
      {/* Gas column (unit-length box, scaled along x each frame) */}
      <mesh ref={gasRef}>
        <boxGeometry args={[1, CYL_R * 1.55, CYL_R * 1.55]} />
        <meshStandardMaterial ref={gasMatRef} transparent opacity={0.35} emissiveIntensity={0.6} roughness={1} depthWrite={false} />
      </mesh>

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
      <Html position={[-CYL_LEN/2, -1.0, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL, color: '#fb7185' }}>Hot reservoir · Q in</span>
      </Html>
      <Html position={[CYL_LEN/2, -1.0, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL, color: '#60a5fa' }}>Cold reservoir · Q out</span>
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
  const PRef      = useRef(1)
  const phaseRef  = useRef(0)

  const { pts, states, efficiency, TH, TC, Qin, Qout, VA, Vmax } = useMemo(
    () => carnotCycle(temperature), [temperature]
  )
  const { posArr, mapV, mapP } = useMemo(
    () => buildGeometry(pts), [pts]
  )

  const phaseLines = useMemo(() => {
    const groups = [[], [], [], []]
    pts.forEach(({ V, P, phase }) => groups[phase].push(new THREE.Vector3(mapV(V), mapP(P), 0)))
    return groups
  }, [pts, mapV, mapP])

  // Enclosed area of the cycle = net work per cycle → shade it
  const workGeo = useMemo(() => {
    const shape = new THREE.Shape(pts.map(({ V, P }) => new THREE.Vector2(mapV(V), mapP(P))))
    return new THREE.ShapeGeometry(shape)
  }, [pts, mapV, mapP])
  useEffect(() => () => workGeo.dispose(), [workGeo])

  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta * 0.15) % 1.0
    const idx = Math.floor(tRef.current * (pts.length - 1))
    VRef.current     = pts[idx].V
    PRef.current     = pts[idx].P
    phaseRef.current = pts[idx].phase
    if (dotRef.current) dotRef.current.position.set(posArr[idx*3], posArr[idx*3+1], 0.1)
    if (dotMatRef.current) {
      const c = PHASE_COLORS[pts[idx].phase]
      dotMatRef.current.color.set(c)
      dotMatRef.current.emissive.set(c)
    }
  })

  const W = Qin - Qout

  return (
    <group position={[-1.1, -0.6, 0]}>
      <group position={[0, 0.3, 0]}>
        {/* Axes */}
        <Line points={[[-4, -0.4, 0], [4.4, -0.4, 0]]} color="#94a3b8" lineWidth={1.2} transparent opacity={0.6} />
        <Line points={[[-4, -0.4, 0], [-4, 5.0, 0]]}   color="#94a3b8" lineWidth={1.2} transparent opacity={0.6} />
        <Html position={[4.7, -0.4, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ ...LABEL, color: '#cbd5e1' }}>Volume V</span>
        </Html>
        <Html position={[-4, 5.35, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ ...LABEL, color: '#cbd5e1' }}>Pressure p</span>
        </Html>

        {/* Net work = enclosed area */}
        <mesh geometry={workGeo} position={[0, 0, -0.02]}>
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* Cycle segments */}
        {phaseLines.map((linePts, i) => linePts.length > 1 && (
          <Line key={i} points={linePts} color={`#${PHASE_COLORS[i].getHexString()}`} lineWidth={3} />
        ))}

        {/* State points A–D */}
        {states.map((st) => (
          <group key={st.id} position={[mapV(st.V), mapP(st.P), 0.05]}>
            <mesh>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshBasicMaterial color="#e2e8f0" />
            </mesh>
            <Html position={[0.28, 0.28, 0]} center style={{ pointerEvents: 'none' }}>
              <span style={{ ...LABEL, fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{st.id}</span>
            </Html>
          </group>
        ))}

        {/* Working point */}
        <mesh ref={dotRef}>
          <sphereGeometry args={[0.17, 16, 16]} />
          <meshStandardMaterial ref={dotMatRef} emissiveIntensity={2.8} roughness={0} metalness={0} />
        </mesh>
      </group>

      {/* Piston cylinder */}
      <PistonCylinder VRef={VRef} PRef={PRef} phaseRef={phaseRef} VA={VA} Vmax={Vmax} TH={TH} TC={TC} />

      {/* Readouts, pinned to the scene corner */}
      <SceneCard>
        <div style={{
          width: 214, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Carnot cycle</div>
          <div style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
            {PHASE_LABELS.map((lbl, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--c-text-muted))' }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, flexShrink: 0, background: `#${PHASE_COLORS[i].getHexString()}` }} />
                {lbl}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--c-text-muted))' }}>
              <span style={{ width: 14, height: 10, borderRadius: 2, flexShrink: 0, background: 'rgba(251,191,36,0.35)' }} />
              Shaded area = net work W
            </div>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 12, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 8 }}>
            {[
              ['Hot reservoir T_H', TH.toFixed(2), '#fb7185'],
              ['Cold reservoir T_C', TC.toFixed(2), '#60a5fa'],
              ['Heat in Q_H', Qin.toFixed(2)],
              ['Heat out Q_C', Qout.toFixed(2)],
              ['Net work W', W.toFixed(2), '#fbbf24'],
              ['Efficiency η', `${(efficiency * 100).toFixed(1)}%`, '#fbbf24'],
            ].map(([k, v, c]) => (
              <Fragment key={k}>
                <dt style={{ color: 'rgb(var(--c-text-muted))' }}>{k}</dt>
                <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: c ?? 'rgb(var(--c-text))', fontWeight: c ? 600 : 400 }}>{v}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      </SceneCard>
    </group>
  )
}
