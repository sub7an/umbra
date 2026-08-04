import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// PV diagram in 2D rendered as 3D line geometry in XZ plane
// Carnot cycle: two isothermals + two adiabatics
// T_hot = temperature * 2 + 1, T_cold = 1.0

const STEPS = 200

function carnotCycle(T) {
  const TH = T * 2 + 1   // hot reservoir temp
  const TC = 1.0          // cold reservoir temp
  const gamma = 1.4       // diatomic ideal gas

  // Isothermal expansion A→B at TH: PV = TH → P = TH/V
  const VA = 0.5, VB = 2.0
  const PA = TH / VA, PB = TH / VB

  // Adiabatic expansion B→C: PV^gamma = const
  const PC = TC / (TH / PB) * PB  // heuristic scaling
  const VC = (PB * Math.pow(VB, gamma) / PC) ** (1 / gamma)

  // Isothermal compression C→D at TC
  const VD = VC * (TC / TH) ** (1 / (gamma - 1))
  const PD = TC / VD

  // Adiabatic compression D→A: back to (VA, PA)
  const pts = []

  // A→B isothermal expansion (cyan)
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const V = VA + t * (VB - VA)
    const P = TH / V
    pts.push({ V, P, phase: 0 })
  }
  // B→C adiabatic expansion (amber)
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const V = VB + t * (VC - VB)
    const P = PB * Math.pow(VB / V, gamma)
    pts.push({ V, P, phase: 1 })
  }
  // C→D isothermal compression (orange)
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const V = VC + t * (VD - VC)
    const P = TC / V
    pts.push({ V, P, phase: 2 })
  }
  // D→A adiabatic compression (violet)
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const V = VD + t * (VA - VD)
    const P = PD * Math.pow(VD / V, gamma)
    pts.push({ V, P, phase: 3 })
  }

  return { pts, TH, TC, efficiency: 1 - TC / TH }
}

const PHASE_COLORS = [
  new THREE.Color('#00e5c4'),  // isothermal expansion
  new THREE.Color('#f59e0b'),  // adiabatic expansion
  new THREE.Color('#fb923c'),  // isothermal compression
  new THREE.Color('#a855f7'),  // adiabatic compression
]

function buildGeometry(pts) {
  const posArr = new Float32Array(pts.length * 3)
  const colArr = new Float32Array(pts.length * 3)

  const minV = Math.min(...pts.map((p) => p.V))
  const maxV = Math.max(...pts.map((p) => p.V))
  const minP = Math.min(...pts.map((p) => p.P))
  const maxP = Math.max(...pts.map((p) => p.P))

  pts.forEach((p, i) => {
    const x = ((p.V - minV) / (maxV - minV) - 0.5) * 8
    const y = ((p.P - minP) / (maxP - minP)) * 5
    posArr[i*3] = x; posArr[i*3+1] = y; posArr[i*3+2] = 0

    const c = PHASE_COLORS[p.phase]
    colArr[i*3] = c.r; colArr[i*3+1] = c.g; colArr[i*3+2] = c.b
  })

  return { posArr, colArr, scale: { minV, maxV, minP, maxP } }
}

export default function HeatEngine({ temperature }) {
  const cycleRef  = useRef()
  const dotRef    = useRef()
  const dotMatRef = useRef()
  const tRef      = useRef(0)

  const { pts, efficiency, TH } = useMemo(() => carnotCycle(temperature), [temperature])
  const { posArr, colArr }      = useMemo(() => buildGeometry(pts), [pts])

  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta * 0.15) % 1.0
    const idx = Math.floor(tRef.current * (pts.length - 1))
    if (!dotRef.current || !posArr) return
    dotRef.current.position.set(posArr[idx*3], posArr[idx*3+1], posArr[idx*3+2] + 0.1)
    if (dotMatRef.current) {
      const c = PHASE_COLORS[pts[idx].phase]
      dotMatRef.current.color.set(c)
      dotMatRef.current.emissive.set(c)
    }
  })

  const totalPts = pts.length

  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 4]} intensity={0.6} color="#38bdf8" />

      {/* PV curve as colored line */}
      <line>
        <bufferGeometry ref={cycleRef}>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color"    args={[colArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.9} />
      </line>

      {/* Animated working point */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial ref={dotMatRef} emissiveIntensity={2} roughness={0} metalness={0} />
      </mesh>

      {/* Axes */}
      <arrowHelper args={[new THREE.Vector3(1,0,0), new THREE.Vector3(-4.5,-0.3,0), 10, '#38bdf8', 0.3, 0.2]} />
      <arrowHelper args={[new THREE.Vector3(0,1,0), new THREE.Vector3(-4.5,-0.3,0), 6.5, '#38bdf8', 0.3, 0.2]} />

      {/* Labels */}
      <Html position={[5.5, -0.5, 0]} center>
        <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>V</span>
      </Html>
      <Html position={[-4.5, 6.5, 0]} center>
        <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>P</span>
      </Html>

      {/* Carnot efficiency readout */}
      <Html position={[2, 5, 0]} center>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a855f7', textAlign: 'right', lineHeight: 1.6 }}>
          <div style={{ color: '#00e5c4' }}>T_hot = {TH.toFixed(2)}</div>
          <div style={{ color: '#fb923c' }}>T_cold = 1.00</div>
          <div style={{ color: '#f59e0b' }}>η = {(efficiency * 100).toFixed(1)}%</div>
        </div>
      </Html>

      {/* Phase legend */}
      <Html position={[-4, 5.5, 0]}>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', lineHeight: 1.8 }}>
          <div style={{ color: '#00e5c4' }}>─ Isothermal expansion</div>
          <div style={{ color: '#f59e0b' }}>─ Adiabatic expansion</div>
          <div style={{ color: '#fb923c' }}>─ Isothermal compression</div>
          <div style={{ color: '#a855f7' }}>─ Adiabatic compression</div>
        </div>
      </Html>
    </group>
  )
}
