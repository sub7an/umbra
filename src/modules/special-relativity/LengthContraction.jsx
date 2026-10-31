// Length contraction: two identical ships, one at rest and one flying past at β.
// In the lab frame the moving ship (and the ruler painted on it) is shortened
// along its motion by 1/γ; its height and depth are unchanged. A fixed lab
// ruler under its lane lets you measure L = L₀/γ directly.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { contractedLength, lorentzFactor } from './srMath'

const L0      = 3.0   // proper length of each ship
const LANE_Y  = -1.1  // moving ship's lane
const REST_Y  = 1.3
const SPAN    = 7.0   // moving ship flies from −SPAN/2 to +SPAN/2, then wraps
const V_VIS   = 2.4   // scene units / s at β = 1
const N_EXH   = 160

// A ship of length L0 along +x (nose at +L0/2). Scaling its group on x
// contracts every part of it, including its own ruler.
function Ship({ hull = '#cbd5e1', accent = '#38bdf8' }) {
  const ticks = useMemo(() => Array.from({ length: 7 }, (_, i) => -L0 / 2 + 0.25 + i * ((L0 - 0.5) / 6)), [])
  return (
    <group>
      {/* Hull */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.36, L0 - 0.9, 32]} />
        <meshStandardMaterial color={hull} metalness={0.75} roughness={0.25} />
      </mesh>
      {/* Nose */}
      <mesh position={[L0 / 2 - 0.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.32, 0.6, 32]} />
        <meshStandardMaterial color={hull} metalness={0.75} roughness={0.25} />
      </mesh>
      {/* Engine bell */}
      <mesh position={[-L0 / 2 + 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.28, 0.6, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Engine glow */}
      <mesh position={[-L0 / 2 - 0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {/* Cockpit */}
      <mesh position={[L0 / 2 - 0.85, 0.24, 0]} scale={[1.6, 0.8, 0.9]}>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.2} roughness={0.05} emissive="#0369a1" emissiveIntensity={0.4} />
      </mesh>
      {/* Fins */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[-L0 / 2 + 0.55, 0, s * 0.38]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.7, 0.05, 0.42]} />
          <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      {/* Ruler painted along the hull: contracts with the ship */}
      <Line points={[[-L0 / 2 + 0.25, -0.37, 0.2], [L0 / 2 - 0.25, -0.37, 0.2]]} color={accent} lineWidth={2} />
      {ticks.map((x, i) => (
        <Line key={i} points={[[x, -0.37, 0.2], [x, -0.22, 0.2]]} color={accent} lineWidth={2} />
      ))}
    </group>
  )
}

function LabRuler({ y }) {
  const ticks = useMemo(() => {
    const out = []
    for (let x = -SPAN / 2; x <= SPAN / 2 + 1e-6; x += 0.5) out.push(+x.toFixed(2))
    return out
  }, [])
  return (
    <group position={[0, y, 0]}>
      <Line points={[[-SPAN / 2, 0, 0], [SPAN / 2, 0, 0]]} color="#94a3b8" lineWidth={1.5} />
      {ticks.map((x) => (
        <Line key={x} points={[[x, 0, 0], [x, Number.isInteger(x) ? -0.22 : -0.12, 0]]} color="#94a3b8" lineWidth={1.5} />
      ))}
    </group>
  )
}

export default function LengthContraction() {
  const beta  = useModuleStore((s) => s.sr.velocity)
  const gamma = lorentzFactor(beta)
  const L     = contractedLength(L0, beta)

  const shipRef = useRef()
  const xRef = useRef(-SPAN / 2)

  // Exhaust: particles shed from the engine that drift back and fade
  const exh = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_EXH * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_EXH * 3), 3))
    return { g, life: new Float32Array(N_EXH), next: 0 }
  }, [])
  useEffect(() => () => exh.g.dispose(), [exh])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    xRef.current += beta * V_VIS * dt
    if (xRef.current > SPAN / 2 + L0) xRef.current = -SPAN / 2 - L0
    const x = xRef.current
    if (shipRef.current) {
      shipRef.current.position.x = x
      shipRef.current.scale.x = 1 / gamma
    }
    // spawn exhaust at the (contracted) engine
    const pos = exh.g.attributes.position.array, col = exh.g.attributes.color.array
    const engineX = x - L / 2
    for (let k = 0; k < 2; k++) {
      const i = exh.next; exh.next = (exh.next + 1) % N_EXH
      exh.life[i] = 1
      pos[i * 3] = engineX; pos[i * 3 + 1] = LANE_Y + (Math.random() - 0.5) * 0.25; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25
    }
    for (let i = 0; i < N_EXH; i++) {
      if (exh.life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue }
      exh.life[i] -= dt * 1.4
      pos[i * 3] -= dt * (0.6 + beta * 1.2)
      const a = Math.max(0, exh.life[i]) * Math.min(1, beta * 3)
      col[i * 3] = 0.25 * a; col[i * 3 + 1] = 0.75 * a; col[i * 3 + 2] = 1.0 * a
    }
    exh.g.attributes.position.needsUpdate = true
    exh.g.attributes.color.needsUpdate = true
  })

  return (
    <group>
      {/* Ship at rest (proper length L0) */}
      <group position={[0, REST_Y, 0]}>
        <Ship accent="#38bdf8" />
      </group>
      <LabRuler y={REST_Y - 0.62} />

      {/* Moving ship: contracted along x only */}
      <group ref={shipRef} position={[-SPAN / 2, LANE_Y, 0]}>
        <Ship accent="#fbbf24" />
      </group>
      <points geometry={exh.g} frustumCulled={false}>
        <pointsMaterial size={0.12} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <LabRuler y={LANE_Y - 0.62} />

      <Html calculatePosition={(_, __, size) => [size.width - 216, 52]} style={{ pointerEvents: 'none' }}>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Length contraction</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>
            Identical ships. The moving one — and the ruler on its hull — is shorter along its motion only.
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
            <dt><span style={{ color: '#38bdf8' }}>●</span> At rest, L₀</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{L0.toFixed(2)}</dd>
            <dt><span style={{ color: '#fbbf24' }}>●</span> Moving, L = L₀/γ</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fbbf24' }}>{L.toFixed(2)}</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>γ at β = {beta.toFixed(2)}</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{gamma.toFixed(3)}</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Shorter by</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{((1 - 1 / gamma) * 100).toFixed(1)}%</dd>
          </dl>
          <div style={{ marginTop: 6, color: 'rgb(var(--c-text-muted))' }}>Ruler ticks: 0.5 units.</div>
        </div>
      </Html>
    </group>
  )
}
