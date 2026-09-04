import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { contractedLength, lorentzFactor } from './srMath'

const PROPER_LENGTH = 3.0

// ── Scrolling reference-frame grid (vertical lines moving right→left) ─────────
const REF_GRID_N = 18
const REF_GRID_EXTENT = 7.0
const REF_SPACING = (REF_GRID_EXTENT * 2) / REF_GRID_N  // ~0.78 proper spacing

function ReferenceGrid({ velocity }) {
  const posArr = useRef(new Float32Array(REF_GRID_N * 6))
  const phaseRef = useRef(0)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    phaseRef.current = (phaseRef.current + delta * velocity * 2.2) % REF_SPACING
    for (let i = 0; i < REF_GRID_N; i++) {
      const x = -REF_GRID_EXTENT + i * REF_SPACING - phaseRef.current
      posArr.current[i * 6]     = x
      posArr.current[i * 6 + 1] = -1.6
      posArr.current[i * 6 + 2] = 0
      posArr.current[i * 6 + 3] = x
      posArr.current[i * 6 + 4] =  1.2
      posArr.current[i * 6 + 5] = 0
    }
    geo.attributes.position.needsUpdate = true
  })

  const opacity = Math.max(0.05, Math.min(0.22, 0.05 + velocity * 0.2))

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#0e2d40" transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  )
}

// ── Streaming speed-particles (trailing lines flying right→left) ──────────────
const STREAM_N = 40

function SpeedParticles({ velocity }) {
  const posArr = useMemo(() => new Float32Array(STREAM_N * 6), [])
  const xs = useMemo(() => {
    const a = new Float32Array(STREAM_N)
    for (let i = 0; i < STREAM_N; i++) a[i] = (Math.random() - 0.5) * 14
    return a
  }, [])
  const ys = useMemo(() => {
    const a = new Float32Array(STREAM_N)
    for (let i = 0; i < STREAM_N; i++) a[i] = (Math.random() - 0.5) * 3.4
    return a
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    return g
  }, [posArr])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    const speed = velocity * 5.0
    const trailLen = 0.08 + velocity * 0.65

    for (let i = 0; i < STREAM_N; i++) {
      xs[i] -= delta * speed
      if (xs[i] < -7.5) {
        xs[i] = 7.5 + Math.random() * 0.8
        ys[i] = (Math.random() - 0.5) * 3.4
      }
      posArr[i * 6]     = xs[i]
      posArr[i * 6 + 1] = ys[i]
      posArr[i * 6 + 2] = 0
      posArr[i * 6 + 3] = xs[i] + trailLen
      posArr[i * 6 + 4] = ys[i]
      posArr[i * 6 + 5] = 0
    }
    geo.attributes.position.needsUpdate = true
  })

  if (velocity < 0.04) return null
  const opacity = Math.min(0.55, velocity * 0.65)

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#4a7a74" transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  )
}

// ── Pulsing rings at each rod endpoint ────────────────────────────────────────
const EP_RING_N = 5

function EndpointRings({ x, color }) {
  const refs = useRef(Array.from({ length: EP_RING_N }, () => null))
  const phases = useRef(Array.from({ length: EP_RING_N }, (_, i) => i / EP_RING_N))

  const mats = useMemo(() =>
    Array.from({ length: EP_RING_N }, () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  , [color])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  useFrame((_, delta) => {
    for (let i = 0; i < EP_RING_N; i++) {
      phases.current[i] = (phases.current[i] + delta * 0.28) % 1
      const p = phases.current[i]
      const r = p * 0.9
      const ref = refs.current[i]
      if (!ref) continue
      ref.scale.set(r || 0.001, r || 0.001, 1)
      mats[i].opacity = Math.min(p * 6, 1) * Math.pow(1 - p, 1.8) * 0.45
    }
  })

  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: EP_RING_N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el }}
          rotation={[-Math.PI / 2, 0, 0]}
          material={mats[i]}
        >
          <ringGeometry args={[0.88, 1.0, 48]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Ruler ticks ───────────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
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

  const t = velocity / 0.99
  const rodColor = '#' + new THREE.Color(t * 0.8, 0.898 - t * 0.7, 0.769 - t * 0.5).getHexString()
  const contractionPct = ((1 - Lc / PROPER_LENGTH) * 100).toFixed(1)

  return (
    <group ref={groupRef}>
      {/* ── Scrolling reference grid (lab frame background) ── */}
      <ReferenceGrid velocity={velocity} />

      {/* ── Streaming particles (motion cue) ── */}
      <SpeedParticles velocity={velocity} />

      {/* ── Rest-frame reference (ghost) ── */}
      <group position={[0, 1.5, 0]}>
        <RoundedBox args={[PROPER_LENGTH, 0.26, 0.26]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#0c2530" emissive="#f59e0b" emissiveIntensity={0.18} transparent opacity={0.55} />
        </RoundedBox>
        <Line
          points={[
            [-PROPER_LENGTH / 2, 0.14, 0.14],
            [PROPER_LENGTH / 2, 0.14, 0.14],
            [PROPER_LENGTH / 2, -0.14, 0.14],
            [-PROPER_LENGTH / 2, -0.14, 0.14],
            [-PROPER_LENGTH / 2, 0.14, 0.14],
          ]}
          color="#1a3545"
          lineWidth={1}
          dashed
          dashSize={0.15}
          gapSize={0.08}
        />
        <RulerTicks length={PROPER_LENGTH} color="#1a3545" />
        <Html position={[0, 0.32, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#4a7a74', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            REST  L₀ = {PROPER_LENGTH.toFixed(1)}
          </span>
        </Html>
      </group>

      {/* ── Contracted rod (moving frame) ── */}
      <group position={[0, 0, 0]}>
        {/* Endpoint pulse rings */}
        <EndpointRings x={-Lc / 2} color={rodColor} />
        <EndpointRings x={ Lc / 2} color={rodColor} />

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
        <pointLight color={rodColor} intensity={1.0} distance={2.5} position={[Lc / 2, 0, 0]} />
        <pointLight color={rodColor} intensity={1.0} distance={2.5} position={[-Lc / 2, 0, 0]} />

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

      {/* γ readout */}
      <Html position={[0, -1.1, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, color: '#f59e0b', textShadow: '0 0 10px rgba(245,158,11,0.6)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          γ = {gamma.toFixed(4)}
        </div>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 10, color: '#4a7a74', marginTop: 5, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          CONTRACTED BY {contractionPct}%
        </div>
      </Html>
    </group>
  )
}
