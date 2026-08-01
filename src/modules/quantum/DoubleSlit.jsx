import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { interferenceIntensity, sampleInterference, sampleMeasured } from './qmMath'

const MAX_PARTICLES = 2000
const EMIT_RATE = 30          // particles per second
const SCREEN_X = 3.8
const BARRIER_X = 0
const SOURCE_X = -4.2
const SCREEN_HALF_H = 3.2
const SLIT_SEP = 1.0          // slit centre-to-centre (scene units)
const SLIT_H = 0.38           // half-height of each slit opening
const SCREEN_DIST = SCREEN_X - BARRIER_X  // 3.8

// Intensity curve points for the screen overlay
function buildIntensityCurve(lambda, measured, n = 80) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const y = -SCREEN_HALF_H + (i / n) * 2 * SCREEN_HALF_H
    let intensity
    if (measured) {
      // Two Gaussians, one per slit
      const sigma = 0.9
      const g1 = Math.exp(-((y - SLIT_SEP / 2) ** 2) / (2 * sigma ** 2))
      const g2 = Math.exp(-((y + SLIT_SEP / 2) ** 2) / (2 * sigma ** 2))
      intensity = (g1 + g2) / 2
    } else {
      intensity = interferenceIntensity(SLIT_SEP, lambda, y, SCREEN_DIST)
    }
    pts.push([SCREEN_X + intensity * 0.6, y, 0])
  }
  return pts
}

function Barrier({ measured }) {
  const gapY = SLIT_SEP / 2
  const barrierColor = '#0e2235'
  const edgeColor = '#1e4a60'
  const slitGlowColor = measured ? '#f59e0b' : '#00e5c4'

  return (
    <group position={[BARRIER_X, 0, 0]}>
      {/* Top block */}
      <mesh position={[0, SCREEN_HALF_H / 2 + gapY + SLIT_H + (SCREEN_HALF_H - gapY - SLIT_H) / 2, 0]}>
        <boxGeometry args={[0.18, SCREEN_HALF_H - gapY - SLIT_H, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>
      {/* Middle block */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.18, SLIT_SEP - SLIT_H * 2, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>
      {/* Bottom block */}
      <mesh position={[0, -(SCREEN_HALF_H / 2 + gapY + SLIT_H + (SCREEN_HALF_H - gapY - SLIT_H) / 2), 0]}>
        <boxGeometry args={[0.18, SCREEN_HALF_H - gapY - SLIT_H, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>

      {/* Edge highlight lines */}
      <Line points={[[-0.09, -SCREEN_HALF_H, 0], [-0.09, SCREEN_HALF_H, 0]]} color={edgeColor} lineWidth={1} />
      <Line points={[[0.09, -SCREEN_HALF_H, 0], [0.09, SCREEN_HALF_H, 0]]} color={edgeColor} lineWidth={1} />

      {/* Slit glow — shows detector if measured */}
      <pointLight position={[0, gapY, 0]} color={slitGlowColor} intensity={measured ? 1.2 : 0.4} distance={1.5} />
      <pointLight position={[0, -gapY, 0]} color={slitGlowColor} intensity={measured ? 1.2 : 0.4} distance={1.5} />

      {measured && (
        <>
          <Html position={[0.35, gapY, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', whiteSpace: 'nowrap' }}>DET</span>
          </Html>
          <Html position={[0.35, -gapY, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', whiteSpace: 'nowrap' }}>DET</span>
          </Html>
        </>
      )}
    </group>
  )
}

function Screen() {
  return (
    <mesh position={[SCREEN_X, 0, -0.1]}>
      <boxGeometry args={[0.06, SCREEN_HALF_H * 2, 0.4]} />
      <meshStandardMaterial color="#0c1e2a" emissive="#001a22" emissiveIntensity={0.3} />
    </mesh>
  )
}

function IntensityCurve({ lambda, measured }) {
  const pts = useMemo(() => buildIntensityCurve(lambda, measured), [lambda, measured])
  return (
    <Line
      points={pts}
      color={measured ? '#f59e0b' : '#00e5c4'}
      lineWidth={1.5}
      transparent
      opacity={0.5}
    />
  )
}

function ParticleCloud({ measured, lambda }) {
  const instancedRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const countRef = useRef(0)
  const accumRef = useRef(0)

  // Reset when mode or wavelength changes
  useEffect(() => {
    countRef.current = 0
    accumRef.current = 0
    if (instancedRef.current) {
      instancedRef.current.count = 0
    }
  }, [measured, lambda])

  const color = measured ? '#f59e0b' : '#00e5c4'
  const emissive = measured ? '#f59e0b' : '#00e5c4'

  useFrame((_, delta) => {
    if (!instancedRef.current) return

    accumRef.current += delta * EMIT_RATE
    const toEmit = Math.floor(accumRef.current)
    accumRef.current -= toEmit

    for (let i = 0; i < toEmit; i++) {
      const y = measured
        ? sampleMeasured(SLIT_SEP)
        : sampleInterference(SLIT_SEP, lambda, SCREEN_HALF_H, SCREEN_DIST)

      const clampedY = Math.max(-SCREEN_HALF_H, Math.min(SCREEN_HALF_H, y))

      dummy.position.set(SCREEN_X, clampedY, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()

      const idx = countRef.current % MAX_PARTICLES
      instancedRef.current.setMatrixAt(idx, dummy.matrix)
      countRef.current++
    }

    instancedRef.current.count = Math.min(countRef.current, MAX_PARTICLES)
    instancedRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={instancedRef} args={[null, null, MAX_PARTICLES]}>
      <sphereGeometry args={[0.055, 5, 5]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.9} />
    </instancedMesh>
  )
}

export default function DoubleSlit() {
  const lambda = useModuleStore((s) => s.qm.slitWavelength)
  const measured = useModuleStore((s) => s.qm.slitMeasured)

  return (
    <group>
      {/* Source */}
      <mesh position={[SOURCE_X, 0, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[SOURCE_X, 0, 0]} color="#00e5c4" intensity={0.8} distance={2} />

      {/* Beam lines from source to slits */}
      <Line
        points={[[SOURCE_X, 0, 0], [BARRIER_X - 0.1, SLIT_SEP / 2, 0]]}
        color="#00e5c4"
        lineWidth={1}
        transparent
        opacity={0.15}
      />
      <Line
        points={[[SOURCE_X, 0, 0], [BARRIER_X - 0.1, -SLIT_SEP / 2, 0]]}
        color="#00e5c4"
        lineWidth={1}
        transparent
        opacity={0.15}
      />

      <Barrier measured={measured} />
      <Screen />
      <IntensityCurve lambda={lambda} measured={measured} />
      <ParticleCloud measured={measured} lambda={lambda} />

      {/* Labels */}
      <Html position={[SOURCE_X, -0.55, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>SOURCE</span>
      </Html>
      <Html position={[BARRIER_X, SCREEN_HALF_H + 0.25, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>BARRIER</span>
      </Html>
      <Html position={[SCREEN_X, SCREEN_HALF_H + 0.25, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>DETECTOR</span>
      </Html>

      {/* Pattern label */}
      <Html position={[SCREEN_X + 1.0, 0, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: measured ? '#f59e0b' : '#00e5c4',
          textShadow: measured ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(0,229,196,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {measured ? 'CLASSICAL\nTWO-BAND' : 'INTERFERENCE\nFRINGES'}
        </div>
      </Html>
    </group>
  )
}
