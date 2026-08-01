import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { contractedLength, lorentzFactor } from './srMath'

const PROPER_LENGTH = 3.0 // L₀

function MotionStreaks({ velocity, contractedLen }) {
  if (velocity < 0.05) return null
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const y = (i - 3.5) * 0.28
        const len = 0.3 + velocity * 0.9
        return (
          <Line
            key={i}
            points={[[-contractedLen / 2 - 0.15 - len, y, 0], [-contractedLen / 2 - 0.1, y, 0]]}
            color="#162229"
            lineWidth={1}
            transparent
            opacity={velocity * 0.7}
          />
        )
      })}
    </group>
  )
}

function RulerTicks({ length, color }) {
  const ticks = useMemo(() => {
    const n = Math.max(2, Math.floor(length * 2))
    return Array.from({ length: n + 1 }, (_, i) => -length / 2 + (i / n) * length)
  }, [length])

  return (
    <group position={[0, -0.25, 0]}>
      <Line points={[[-length / 2, 0, 0], [length / 2, 0, 0]]} color={color} lineWidth={1} transparent opacity={0.5} />
      {ticks.map((x, i) => (
        <Line
          key={i}
          points={[[x, 0, 0], [x, i % 2 === 0 ? -0.12 : -0.07, 0]]}
          color={color}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  )
}

export default function LengthContraction() {
  const velocity = useModuleStore((s) => s.sr.velocity)
  const gamma = lorentzFactor(velocity)
  const Lc = contractedLength(PROPER_LENGTH, velocity)

  const groupRef = useRef()
  const scrollRef = useRef(0)

  useFrame((_, delta) => {
    scrollRef.current += delta * velocity * 2
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(scrollRef.current * 0.5) * velocity * 0.03
    }
  })

  // Rod color transitions cyan → amber → rose with velocity
  const t = velocity / 0.99
  const rodColor = '#' + new THREE.Color(t * 0.8, 0.898 - t * 0.7, 0.769 - t * 0.5).getHexString()
  const contractionPct = ((1 - Lc / PROPER_LENGTH) * 100).toFixed(1)

  return (
    <group ref={groupRef}>
      {/* ── Rest-frame reference (ghost) ── */}
      <group position={[0, 1.5, 0]}>
        <RoundedBox args={[PROPER_LENGTH, 0.26, 0.26]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#0c2530" emissive="#00e5c4" emissiveIntensity={0.18} transparent opacity={0.55} wireframe={false} />
        </RoundedBox>
        <Line
          points={[
            [-PROPER_LENGTH / 2, 0.14, 0.14],
            [PROPER_LENGTH / 2, 0.14, 0.14],
            [PROPER_LENGTH / 2, -0.14, 0.14],
            [-PROPER_LENGTH / 2, -0.14, 0.14],
            [-PROPER_LENGTH / 2, 0.14, 0.14],
          ]}
          color="#162229"
          lineWidth={1}
          dashed
          dashSize={0.15}
          gapSize={0.08}
        />
        <RulerTicks length={PROPER_LENGTH} color="#162229" />
        <Html position={[0, 0.32, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#4a7a74', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            REST  L₀ = {PROPER_LENGTH.toFixed(1)}
          </span>
        </Html>
      </group>

      {/* ── Contracted rod (moving frame) ── */}
      <group position={[0, 0, 0]}>
        <MotionStreaks velocity={velocity} contractedLen={Lc} />

        <RoundedBox args={[Lc, 0.26, 0.26]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color={rodColor} emissive={rodColor} emissiveIntensity={0.4} roughness={0.3} metalness={0.7} />
        </RoundedBox>

        {/* Dimension arrows */}
        <Line points={[[-Lc / 2, 0.28, 0], [Lc / 2, 0.28, 0]]} color={rodColor} lineWidth={2} />
        <mesh position={[-Lc / 2, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.05, 0.13, 6]} />
          <meshStandardMaterial color={rodColor} emissive={rodColor} emissiveIntensity={1} />
        </mesh>
        <mesh position={[Lc / 2, 0.28, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.05, 0.13, 6]} />
          <meshStandardMaterial color={rodColor} emissive={rodColor} emissiveIntensity={1} />
        </mesh>

        <RulerTicks length={Lc} color={rodColor} />
        <pointLight color={rodColor} intensity={0.8} distance={2} position={[Lc / 2, 0, 0]} />
        <pointLight color={rodColor} intensity={0.8} distance={2} position={[-Lc / 2, 0, 0]} />

        <Html position={[0, -0.58, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: rodColor, textShadow: `0 0 8px ${rodColor}`, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
            L′ = {Lc.toFixed(3)}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#4a7a74', marginTop: 4, whiteSpace: 'nowrap' }}>
            L₀ / γ = {PROPER_LENGTH} / {gamma.toFixed(3)}
          </div>
        </Html>
      </group>

      {/* Motion arrow */}
      {velocity > 0.05 && (
        <group position={[PROPER_LENGTH / 2 + 0.7, 0, 0]}>
          <Line points={[[-0.5, 0, 0], [0.35, 0, 0]]} color="#f59e0b" lineWidth={2} />
          <mesh position={[0.35, 0, 0]}>
            <coneGeometry args={[0.07, 0.18, 6]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} />
          </mesh>
          <Html position={[0, 0.35, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#f59e0b', whiteSpace: 'nowrap' }}>v →</span>
          </Html>
        </group>
      )}

      {/* Contraction summary */}
      <Html position={[0, -1.55, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
          Contraction: {contractionPct}%
        </div>
      </Html>
    </group>
  )
}
