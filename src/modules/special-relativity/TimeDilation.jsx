import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import useModuleStore from '../../store/useModuleStore'
import { lorentzFactor } from './srMath'

// Ticking analog clock face built from 3D primitives
function ClockFace({ position, color, tRef, label, sublabel }) {
  const minuteRef = useRef()
  const secondRef = useRef()

  useFrame(() => {
    const t = tRef.current
    if (minuteRef.current) minuteRef.current.rotation.z = -(t % (Math.PI * 2)) * 0.5
    if (secondRef.current) secondRef.current.rotation.z = -(t % (Math.PI * 2)) * 6
  })

  return (
    <group position={position}>
      {/* Bezel */}
      <RoundedBox args={[1.7, 1.7, 0.12]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#0c1419" emissive={color} emissiveIntensity={0.04} roughness={0.8} metalness={0.3} />
      </RoundedBox>

      {/* Face disc */}
      <mesh position={[0, 0, 0.07]}>
        <circleGeometry args={[0.66, 48]} />
        <meshStandardMaterial color="#07090c" roughness={0.9} />
      </mesh>

      {/* Hour markers */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const r = 0.54
        const major = i % 3 === 0
        return (
          <mesh key={i} position={[Math.sin(angle) * r, Math.cos(angle) * r, 0.08]}>
            <boxGeometry args={[major ? 0.04 : 0.025, major ? 0.1 : 0.06, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={major ? 1.2 : 0.6} />
          </mesh>
        )
      })}

      {/* Center pivot */}
      <mesh position={[0, 0, 0.1]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>

      {/* Minute hand */}
      <group ref={minuteRef} position={[0, 0, 0.09]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.025, 0.44, 0.015]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
        </mesh>
      </group>

      {/* Second hand (amber) */}
      <group ref={secondRef} position={[0, 0, 0.1]}>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.012, 0.56, 0.012]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.012, 0.14, 0.012]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.5} />
        </mesh>
      </group>

      {/* Glow */}
      <pointLight color={color} intensity={0.6} distance={3} position={[0, 0, 0.5]} />

      {/* HTML labels — no font suspension */}
      <Html position={[0, -1.1, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 12, color, letterSpacing: '0.14em', whiteSpace: 'nowrap', textShadow: `0 0 6px ${color}` }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#4a7a74', marginTop: 3, whiteSpace: 'nowrap' }}>
            {sublabel}
          </div>
        )}
      </Html>
    </group>
  )
}

// Stationary clock
function LabClock({ position }) {
  const tRef = useRef(0)
  useFrame((_, delta) => { tRef.current += delta * 0.6 })
  return (
    <ClockFace
      position={position}
      color="#00e5c4"
      tRef={tRef}
      label="LAB FRAME"
      sublabel="stationary"
    />
  )
}

// Moving clock (ticks slower by γ)
function MovingClock({ position, velocity, gamma }) {
  const tRef = useRef(0)
  useFrame((_, delta) => { tRef.current += (delta * 0.6) / gamma })
  return (
    <ClockFace
      position={position}
      color="#e040fb"
      tRef={tRef}
      label="MOVING FRAME"
      sublabel={`β = ${velocity.toFixed(3)}`}
    />
  )
}

export default function TimeDilation() {
  const velocity = useModuleStore((s) => s.sr.velocity)
  const gamma = lorentzFactor(velocity)

  const pct = ((1 - 1 / gamma) * 100).toFixed(1)

  return (
    <group>
      {/* Frame labels */}
      <Html position={[-2.2, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 11, color: '#4a7a74', letterSpacing: '0.18em' }}>STATIONARY</span>
      </Html>
      <Html position={[2.2, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 11, color: '#4a7a74', letterSpacing: '0.18em' }}>MOVING</span>
      </Html>

      {/* Clocks */}
      <LabClock position={[-2.2, 0, 0]} />
      <MovingClock position={[2.2, 0, 0]} velocity={velocity} gamma={gamma} />

      {/* Central gamma readout */}
      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, color: '#f59e0b', textShadow: '0 0 10px rgba(245,158,11,0.6)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          γ = {gamma.toFixed(4)}
        </div>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 10, color: '#4a7a74', marginTop: 6, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          MOVING CLOCK: {pct}% SLOWER
        </div>
      </Html>
    </group>
  )
}
