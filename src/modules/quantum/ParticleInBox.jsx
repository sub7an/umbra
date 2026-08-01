import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import useModuleStore from '../../store/useModuleStore'
import { particleInBoxWavefunction, particleInBoxEnergy } from './qmMath'

const SAMPLES = 120
const BOX_LEFT = -2.5
const BOX_RIGHT = 2.5
const BOX_W = BOX_RIGHT - BOX_LEFT
const PSI_SCALE = 1.1    // visual amplitude scale for ψ
const PROB_SCALE = 0.85  // visual amplitude scale for |ψ|²
const WALL_H = 2.8

// Static point arrays — shapes fixed, only amplitude changes with time
function computePsiShape(n) {
  const pts = new Float32Array((SAMPLES + 1) * 3)
  for (let i = 0; i <= SAMPLES; i++) {
    const xi = i / SAMPLES
    const x = BOX_LEFT + xi * BOX_W
    const psi = particleInBoxWavefunction(n, xi, 1) * PSI_SCALE
    pts[i * 3]     = x
    pts[i * 3 + 1] = psi
    pts[i * 3 + 2] = 0
  }
  return pts
}

function computeProbShape(n) {
  const pts = new Float32Array((SAMPLES + 1) * 3)
  for (let i = 0; i <= SAMPLES; i++) {
    const xi = i / SAMPLES
    const x = BOX_LEFT + xi * BOX_W
    const psi = particleInBoxWavefunction(n, xi, 1)
    const prob = psi * psi * PROB_SCALE
    pts[i * 3]     = x
    pts[i * 3 + 1] = prob
    pts[i * 3 + 2] = 0
  }
  return pts
}

function AnimatedPsi({ n, En }) {
  const geoRef = useRef()
  const groupRef = useRef()

  const staticShape = useMemo(() => computePsiShape(n), [n])

  // Write positions once when n changes
  useEffect(() => {
    if (geoRef.current) {
      const pos = geoRef.current.attributes.position
      for (let i = 0; i <= SAMPLES; i++) {
        pos.setXYZ(i, staticShape[i * 3], staticShape[i * 3 + 1], staticShape[i * 3 + 2])
      }
      pos.needsUpdate = true
    }
  }, [staticShape])

  // Animate by scaling Y — works because Re[ψ(x,t)] = ψ_n(x)·cos(E_n·t)
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.scale.y = Math.cos(En * clock.getElapsedTime() * 0.9)
    }
  })

  return (
    <group ref={groupRef}>
      <line>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute
            attach="attributes-position"
            count={SAMPLES + 1}
            array={new Float32Array((SAMPLES + 1) * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00e5c4" />
      </line>
    </group>
  )
}

function ProbDensity({ n }) {
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i <= SAMPLES; i++) {
      const xi = i / SAMPLES
      const x = BOX_LEFT + xi * BOX_W
      const psi = particleInBoxWavefunction(n, xi, 1)
      pts.push([x, psi * psi * PROB_SCALE, 0.05])
    }
    return pts
  }, [n])

  return (
    <Line
      points={points}
      color="#f59e0b"
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  )
}

function EnergyLadder({ n }) {
  // Show faint horizontal lines for n=1..6, highlight current n
  const lines = useMemo(() => {
    const result = []
    for (let k = 1; k <= 6; k++) {
      const Ek = particleInBoxEnergy(k)
      const Emax = particleInBoxEnergy(6)
      const y = (Ek / Emax) * (WALL_H - 0.4) - WALL_H / 2 + 0.2
      result.push({ k, y, active: k === n })
    }
    return result
  }, [n])

  return (
    <group position={[BOX_RIGHT + 0.15, 0, 0]}>
      {lines.map(({ k, y, active }) => (
        <group key={k}>
          <Line
            points={[[0, y, 0], [0.5, y, 0]]}
            color={active ? '#f59e0b' : '#162229'}
            lineWidth={active ? 2 : 1}
            transparent
            opacity={active ? 1 : 0.5}
          />
          <Html position={[0.6, y, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: active ? '#f59e0b' : '#4a7a74',
              whiteSpace: 'nowrap',
            }}>
              n={k}
            </span>
          </Html>
        </group>
      ))}
    </group>
  )
}

export default function ParticleInBox() {
  const n = useModuleStore((s) => s.qm.boxN)
  const En = useMemo(() => particleInBoxEnergy(n), [n])

  return (
    <group position={[0, 0.2, 0]}>
      {/* Box walls */}
      <mesh position={[BOX_LEFT, 0, 0]}>
        <boxGeometry args={[0.04, WALL_H, 0.04]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[BOX_RIGHT, 0, 0]}>
        <boxGeometry args={[0.04, WALL_H, 0.04]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={0.5} />
      </mesh>

      {/* Floor line */}
      <Line
        points={[[BOX_LEFT, -WALL_H / 2, 0], [BOX_RIGHT, -WALL_H / 2, 0]]}
        color="#162229"
        lineWidth={1}
        transparent
        opacity={0.6}
      />

      {/* Zero line */}
      <Line
        points={[[BOX_LEFT, 0, 0], [BOX_RIGHT, 0, 0]]}
        color="#162229"
        lineWidth={1}
        transparent
        opacity={0.35}
        dashed
        dashSize={0.2}
        gapSize={0.1}
      />

      {/* Wavefunction ψ (animated) */}
      <AnimatedPsi n={n} En={En} />

      {/* Probability density |ψ|² */}
      <ProbDensity n={n} />

      {/* Energy ladder on the right */}
      <EnergyLadder n={n} />

      {/* Labels */}
      <Html position={[0, PSI_SCALE * 1.25, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#00e5c4', textShadow: '0 0 6px rgba(0,229,196,0.6)', whiteSpace: 'nowrap' }}>
          ψ_n(x) · cos(E_n·t)
        </span>
      </Html>
      <Html position={[0, PROB_SCALE * 1.1, 0.05]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#f59e0b', textShadow: '0 0 6px rgba(245,158,11,0.5)', whiteSpace: 'nowrap' }}>
          |ψ_n(x)|²
        </span>
      </Html>

      <Html position={[BOX_LEFT - 0.15, WALL_H / 2 + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>V=∞</span>
      </Html>
      <Html position={[BOX_RIGHT + 0.15, WALL_H / 2 + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>V=∞</span>
      </Html>

      {/* n and E readout */}
      <Html position={[0, -WALL_H / 2 - 0.45, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)', whiteSpace: 'nowrap' }}>
          n = {n} · E_n = {En.toFixed(2)} (ℏ²/2mL²)
        </div>
      </Html>
    </group>
  )
}
