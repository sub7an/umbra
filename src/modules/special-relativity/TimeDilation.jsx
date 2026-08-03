import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { lorentzFactor } from './srMath'

// ── Tick-pulse ring pool emitted by each clock ────────────────────────────────
const RING_N = 10
const RING_SPEED = 1.8   // units/s expansion
const RING_MAX_R = 2.6

function TickRings({ position, color, rate }) {
  const rings = useRef(Array.from({ length: RING_N }, () => ({ r: -1, alive: false })))
  const cooldown = useRef(rate > 0 ? 1 / rate : 9999)
  const meshRefs = useRef(Array.from({ length: RING_N }, () => null))

  const mats = useMemo(() =>
    Array.from({ length: RING_N }, () =>
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

  // keep cooldown in sync with rate prop changes (γ changes as slider moves)
  useEffect(() => {
    cooldown.current = rate > 0 ? 1 / rate : 9999
  }, [rate])

  const timeToNextRef = useRef(0.1)

  useFrame((_, delta) => {
    timeToNextRef.current -= delta
    if (timeToNextRef.current <= 0) {
      timeToNextRef.current = cooldown.current
      const idx = rings.current.findIndex((r) => !r.alive)
      if (idx >= 0) rings.current[idx] = { r: 0.01, alive: true }
    }

    for (let i = 0; i < RING_N; i++) {
      const ring = rings.current[i]
      const ref = meshRefs.current[i]
      if (!ref) continue
      if (!ring.alive) { mats[i].opacity = 0; continue }
      ring.r += delta * RING_SPEED
      if (ring.r > RING_MAX_R) { ring.alive = false; mats[i].opacity = 0; continue }
      const p = ring.r / RING_MAX_R
      mats[i].opacity = Math.pow(1 - p, 1.4) * 0.75
      ref.scale.set(ring.r, ring.r, 1)
    }
  })

  return (
    <group position={position}>
      {Array.from({ length: RING_N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el }}
          rotation={[-Math.PI / 2, 0, 0]}
          material={mats[i]}
        >
          <ringGeometry args={[0.88, 1.0, 64]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Elapsed tick counter (column of glowing dots) ─────────────────────────────
const DOT_INTERVAL = 0.6   // seconds of lab time per dot

function TickCounter({ position, color, rate }) {
  const dotCount = useRef(0)
  const accum = useRef(0)
  const MAX_DOTS = 20

  const dotRefs = useRef(Array.from({ length: MAX_DOTS }, () => null))
  const dotMats = useMemo(() =>
    Array.from({ length: MAX_DOTS }, () =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0 })
    )
  , [color])

  useEffect(() => () => dotMats.forEach((m) => m.dispose()), [dotMats])

  useFrame((_, delta) => {
    accum.current += delta * rate
    while (accum.current >= 1 && dotCount.current < MAX_DOTS) {
      accum.current -= 1
      dotMats[dotCount.current].opacity = 0.85
      dotCount.current++
    }
  })

  return (
    <group position={position}>
      {Array.from({ length: MAX_DOTS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { dotRefs.current[i] = el }}
          position={[0, i * 0.14, 0]}
          material={dotMats[i]}
        >
          <sphereGeometry args={[0.045, 6, 6]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Connecting time-stream between clocks (particles flowing rightward) ───────
const STREAM_N = 24
function TimeStream({ gamma }) {
  const posArr = useRef(new Float32Array(STREAM_N * 3))
  const phases = useRef(Array.from({ length: STREAM_N }, (_, i) => i / STREAM_N))
  const opacities = useRef(new Float32Array(STREAM_N))

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3))
    return g
  }, [])

  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    const speed = 0.55
    for (let i = 0; i < STREAM_N; i++) {
      phases.current[i] = (phases.current[i] + delta * speed) % 1
      const p = phases.current[i]
      const x = -2.2 + p * 4.4
      const y = Math.sin(p * Math.PI * 2) * 0.08
      posArr.current[i * 3] = x
      posArr.current[i * 3 + 1] = y
      posArr.current[i * 3 + 2] = 0
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <points geometry={geo}>
      <pointsMaterial
        color="#f59e0b"
        size={0.06}
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// ── Clock face ────────────────────────────────────────────────────────────────
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
      {/* Outer glow disc */}
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[0.95, 48]} />
        <meshBasicMaterial color={new THREE.Color(color)} transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Bezel */}
      <RoundedBox args={[1.7, 1.7, 0.12]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#0c1419" emissive={color} emissiveIntensity={0.06} roughness={0.8} metalness={0.3} />
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

      {/* Second hand */}
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

      <pointLight color={color} intensity={1.0} distance={3.5} position={[0, 0, 0.5]} />

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

// ── Clock instances ───────────────────────────────────────────────────────────
const LAB_RATE = 0.6  // rad/s

function LabClock({ position }) {
  const tRef = useRef(0)
  useFrame((_, delta) => { tRef.current += delta * LAB_RATE })
  return <ClockFace position={position} color="#00e5c4" tRef={tRef} label="LAB FRAME" sublabel="stationary" />
}

function MovingClock({ position, velocity, gamma }) {
  const tRef = useRef(0)
  useFrame((_, delta) => { tRef.current += (delta * LAB_RATE) / gamma })
  return <ClockFace position={position} color="#e040fb" tRef={tRef} label="MOVING FRAME" sublabel={`β = ${velocity.toFixed(3)}`} />
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TimeDilation() {
  const velocity = useModuleStore((s) => s.sr.velocity)
  const gamma = lorentzFactor(velocity)

  const pct = ((1 - 1 / gamma) * 100).toFixed(1)

  // Tick rate = one ring per half-rotation (π rad), scaled to real time
  const labRate = LAB_RATE / Math.PI        // rings/s for lab clock
  const movRate = labRate / gamma           // rings/s for moving clock

  return (
    <group>
      {/* ── Frame labels ── */}
      <Html position={[-2.2, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 11, color: '#4a7a74', letterSpacing: '0.18em' }}>STATIONARY</span>
      </Html>
      <Html position={[2.2, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 11, color: '#4a7a74', letterSpacing: '0.18em' }}>MOVING</span>
      </Html>

      {/* ── Tick rings ── */}
      <TickRings position={[-2.2, 0, -0.1]} color="#00e5c4" rate={labRate} />
      <TickRings position={[2.2, 0, -0.1]} color="#e040fb" rate={movRate} />

      {/* ── Elapsed tick counters ── */}
      <TickCounter position={[-3.3, -1.3, 0]} color="#00e5c4" rate={labRate * 2} />
      <TickCounter position={[3.0, -1.3, 0]} color="#e040fb" rate={(labRate * 2) / gamma} />

      {/* ── Clock faces ── */}
      <LabClock position={[-2.2, 0, 0]} />
      <MovingClock position={[2.2, 0, 0]} velocity={velocity} gamma={gamma} />

      {/* ── Time-stream connection ── */}
      <TimeStream gamma={gamma} />

      {/* ── γ central readout ── */}
      <Html position={[0, 0.55, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
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
