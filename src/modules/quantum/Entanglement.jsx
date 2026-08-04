import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

// ── Bloch sphere wireframe via lineSegments ───────────────────────────────────
function BlochWireframe({ color }) {
  const geo = useMemo(() => {
    const pts = []
    const n = 48
    // 3 latitude rings
    for (const y of [-0.5, 0, 0.5]) {
      const r = Math.sqrt(1 - y * y)
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        pts.push(r * Math.cos(a0), y, r * Math.sin(a0))
        pts.push(r * Math.cos(a1), y, r * Math.sin(a1))
      }
    }
    // 4 longitude great circles
    for (let k = 0; k < 4; k++) {
      const phi = (k / 4) * Math.PI
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * Math.PI * 2
        const t1 = ((i + 1) / n) * Math.PI * 2
        pts.push(
          Math.sin(t0) * Math.cos(phi), Math.cos(t0), Math.sin(t0) * Math.sin(phi),
          Math.sin(t1) * Math.cos(phi), Math.cos(t1), Math.sin(t1) * Math.sin(phi)
        )
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
    </lineSegments>
  )
}

// ── State vector arrow ────────────────────────────────────────────────────────
function StateArrow({ length, color }) {
  if (length < 0.02) return null
  const shaftLen = Math.max(0.001, length - 0.22)
  return (
    <group>
      <mesh position={[0, shaftLen / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, shaftLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, length - 0.11, 0]}>
        <coneGeometry args={[0.07, 0.22, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
      </mesh>
    </group>
  )
}

// ── Expanding uncertainty rings at equator ────────────────────────────────────
const N_RINGS = 5
function UncertaintyRings({ concurrence, color }) {
  const phases = useRef(Array.from({ length: N_RINGS }, (_, i) => i / N_RINGS))
  const meshRefs = useRef([])
  const mats = useMemo(
    () => Array.from({ length: N_RINGS }, () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true, opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    ), [color]
  )
  useEffect(() => () => mats.forEach(m => m.dispose()), [mats])

  useFrame((_, delta) => {
    for (let i = 0; i < N_RINGS; i++) {
      phases.current[i] = (phases.current[i] + delta * 0.42) % 1
      const p = phases.current[i]
      const r = 0.25 + p * 0.75
      const ref = meshRefs.current[i]
      if (ref) ref.scale.set(r, r, 1)
      mats[i].opacity = Math.min(p * 4, 1) * Math.pow(1 - p, 1.7) * 0.5 * concurrence
    }
  })

  if (concurrence < 0.04) return null
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: N_RINGS }, (_, i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el }} material={mats[i]}>
          <ringGeometry args={[0.9, 1.0, 48]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Full Bloch sphere qubit display ──────────────────────────────────────────
function QubitBloch({ position, color, label, blochLen, concurrence }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <BlochWireframe color={color} />
      <StateArrow length={blochLen} color={color} />
      <UncertaintyRings concurrence={concurrence} color={color} />

      {/* Pole markers */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, -1.05, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.5} />
      </mesh>

      <Html position={[0.18, 1.18, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color, whiteSpace: 'nowrap' }}>|0⟩</span>
      </Html>
      <Html position={[0.18, -1.22, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: `${color}77`, whiteSpace: 'nowrap' }}>|1⟩</span>
      </Html>
      <Html position={[0, -1.88, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 11, color, letterSpacing: '0.14em', textShadow: `0 0 8px ${color}88`, whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

// ── Entanglement correlation beam ─────────────────────────────────────────────
const BEAM_N = 32
function EntanglementBeam({ concurrence }) {
  const posArr = useMemo(() => new Float32Array(BEAM_N * 3), [])
  const phases = useRef(Array.from({ length: BEAM_N }, (_, i) => i / BEAM_N))
  const colArr = useMemo(() => {
    const c = new Float32Array(BEAM_N * 3)
    for (let i = 0; i < BEAM_N; i++) {
      if (i % 2 === 0) { c[i*3]=0; c[i*3+1]=0.898; c[i*3+2]=0.769 }       // cyan #00e5c4
      else              { c[i*3]=0.878; c[i*3+1]=0.251; c[i*3+2]=0.984 }   // rose #e040fb
    }
    return c
  }, [])
  const matRef = useRef()

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    return g
  }, [posArr, colArr])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    const spd = 0.35 + concurrence * 0.4
    for (let i = 0; i < BEAM_N; i++) {
      phases.current[i] = (phases.current[i] + delta * spd) % 1
      const p = phases.current[i]
      posArr[i*3]   = -3 + p * 6
      posArr[i*3+1] = Math.sin(p * Math.PI) * 0.08
      posArr[i*3+2] = 0
    }
    geo.attributes.position.needsUpdate = true
    if (matRef.current) matRef.current.opacity = 0.2 + concurrence * 0.65
  })

  if (concurrence < 0.02) return null
  return (
    <points geometry={geo}>
      <pointsMaterial
        ref={matRef}
        size={0.09}
        vertexColors
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Entanglement() {
  const alpha = useModuleStore((s) => s.qm.entangleAlpha)

  const concurrence = Math.sin(2 * alpha)
  const blochLen    = Math.cos(2 * alpha)
  const stateLabel  =
    concurrence < 0.05 ? 'PRODUCT STATE' :
    concurrence > 0.95 ? '|Φ⁺⟩  BELL STATE' :
    'PARTIAL ENTANGLEMENT'

  return (
    <group>
      <QubitBloch position={[-3, 0, 0]} color="#00e5c4" label="QUBIT A" blochLen={blochLen} concurrence={concurrence} />
      <QubitBloch position={[ 3, 0, 0]} color="#e040fb" label="QUBIT B" blochLen={blochLen} concurrence={concurrence} />
      <EntanglementBeam concurrence={concurrence} />

      {/* Concurrence readout */}
      <Html position={[0, 2.0, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: '#f59e0b', textShadow: '0 0 10px rgba(245,158,11,0.6)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          C = {concurrence.toFixed(4)}
        </div>
        <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 10, color: '#4a7a74', marginTop: 4, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {stateLabel}
        </div>
      </Html>

      {/* State vector */}
      <Html position={[0, -2.6, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a7a74', whiteSpace: 'nowrap' }}>
          {'|ψ⟩ = '}{Math.cos(alpha).toFixed(3)}{'|00⟩ + '}{Math.sin(alpha).toFixed(3)}{'|11⟩'}
        </div>
      </Html>
    </group>
  )
}
