import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { interferenceIntensity, sampleInterference, sampleMeasured } from './qmMath'

const MAX_PARTICLES = 2000
const EMIT_RATE = 30
const SCREEN_X = 3.8
const BARRIER_X = 0
const SOURCE_X = -4.2
const SCREEN_HALF_H = 3.2
const SLIT_SEP = 1.0
const SLIT_H = 0.38
const SCREEN_DIST = SCREEN_X - BARRIER_X

// Intensity curve on the screen
function buildIntensityCurve(lambda, measured, n = 80) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const y = -SCREEN_HALF_H + (i / n) * 2 * SCREEN_HALF_H
    let intensity
    if (measured) {
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

// ── Expanding circular wave rings from source ─────────────────────────────────
const WAVE_N = 5
const SRC_MAX_R = Math.abs(SOURCE_X) + 0.5  // slightly past barrier

function SourceWaves() {
  const SEGS = 48
  const geos = useMemo(() => Array.from({ length: WAVE_N }, () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEGS + 1) * 3), 3))
    return g
  }), [])
  const mats = useMemo(() => Array.from({ length: WAVE_N }, () =>
    new THREE.LineBasicMaterial({ color: new THREE.Color('#f59e0b'), transparent: true, opacity: 0 })
  ), [])
  const phases = useRef(Array.from({ length: WAVE_N }, (_, i) => i / WAVE_N))

  useEffect(() => () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) }, [geos, mats])

  useFrame((_, delta) => {
    for (let i = 0; i < WAVE_N; i++) {
      phases.current[i] = (phases.current[i] + delta * 0.55 / SRC_MAX_R) % 1
      const p = phases.current[i]
      const r = p * SRC_MAX_R
      const arr = geos[i].attributes.position.array
      for (let s = 0; s <= SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2
        arr[s * 3] = SOURCE_X + Math.cos(a) * r
        arr[s * 3 + 1] = Math.sin(a) * r
        arr[s * 3 + 2] = 0
      }
      geos[i].attributes.position.needsUpdate = true
      const fadeIn = Math.min(p * 6, 1)
      const fadeOut = Math.pow(1 - p, 2.2)
      mats[i].opacity = fadeIn * fadeOut * 0.38
    }
  })

  return (
    <>
      {geos.map((g, i) => (
        <line key={i} geometry={g} material={mats[i]} />
      ))}
    </>
  )
}

// ── Right-facing semicircular waves from each slit ────────────────────────────
const SLIT_WAVE_N = 4
const SLIT_MAX_R = SCREEN_DIST + 1.2

function SlitWaves({ measured }) {
  const SEGS = 36
  const color = measured ? '#f59e0b' : '#f59e0b'

  // Two sets of rings (top slit + bottom slit), SLIT_WAVE_N each
  const total = SLIT_WAVE_N * 2
  const geos = useMemo(() => Array.from({ length: total }, () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEGS + 1) * 3), 3))
    return g
  }), [total])
  const mats = useMemo(() => Array.from({ length: total }, () =>
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0 })
  ), [color, total])
  const phases = useRef(Array.from({ length: total }, (_, i) => (i % SLIT_WAVE_N) / SLIT_WAVE_N))

  useEffect(() => () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) }, [geos, mats])

  useFrame((_, delta) => {
    for (let i = 0; i < total; i++) {
      phases.current[i] = (phases.current[i] + delta * 0.6 / SLIT_MAX_R) % 1
      const p = phases.current[i]
      const r = p * SLIT_MAX_R
      const slitY = i < SLIT_WAVE_N ? SLIT_SEP / 2 : -SLIT_SEP / 2
      const arr = geos[i].attributes.position.array
      for (let s = 0; s <= SEGS; s++) {
        const a = -Math.PI / 2 + (s / SEGS) * Math.PI  // right-facing semicircle
        arr[s * 3] = BARRIER_X + Math.cos(a) * r
        arr[s * 3 + 1] = slitY + Math.sin(a) * r
        arr[s * 3 + 2] = 0
      }
      geos[i].attributes.position.needsUpdate = true
      const fadeIn = Math.min(p * 5, 1)
      const fadeOut = Math.pow(1 - p, 1.8)
      mats[i].opacity = fadeIn * fadeOut * 0.45
    }
  })

  return (
    <>
      {geos.map((g, i) => (
        <line key={i} geometry={g} material={mats[i]} />
      ))}
    </>
  )
}

// ── Interference amplitude field between barrier and screen ───────────────────
function InterferenceField({ lambda, measured }) {
  const geoRef = useRef(null)

  const geo = useMemo(() => {
    if (geoRef.current) geoRef.current.dispose()
    if (measured) {
      geoRef.current = null
      return null
    }
    const NX = 16, NY = 52
    const positions = []
    const colors = []
    for (let ix = 0; ix < NX; ix++) {
      for (let iy = 0; iy < NY; iy++) {
        const x = BARRIER_X + 0.3 + (ix / (NX - 1)) * (SCREEN_X - BARRIER_X - 0.4)
        const y = -SCREEN_HALF_H * 0.96 + (iy / (NY - 1)) * SCREEN_HALF_H * 1.92
        const D = Math.max(0.25, x - BARRIER_X)
        const I = interferenceIntensity(SLIT_SEP, lambda, y, D)
        const nearFade = Math.min((x - BARRIER_X) / 0.5, 1)
        const v = I * nearFade
        positions.push(x, y, 0)
        colors.push(0, v * 0.898, v * 0.769)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geoRef.current = g
    return g
  }, [lambda, measured])

  useEffect(() => () => { if (geoRef.current) geoRef.current.dispose() }, [])

  if (!geo) return null

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.10}
        vertexColors
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function Barrier({ measured }) {
  const gapY = SLIT_SEP / 2
  const barrierColor = '#0e2235'
  const edgeColor = '#1e4a60'
  const slitGlowColor = measured ? '#f59e0b' : '#f59e0b'

  return (
    <group position={[BARRIER_X, 0, 0]}>
      <mesh position={[0, SCREEN_HALF_H / 2 + gapY + SLIT_H + (SCREEN_HALF_H - gapY - SLIT_H) / 2, 0]}>
        <boxGeometry args={[0.18, SCREEN_HALF_H - gapY - SLIT_H, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.18, SLIT_SEP - SLIT_H * 2, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -(SCREEN_HALF_H / 2 + gapY + SLIT_H + (SCREEN_HALF_H - gapY - SLIT_H) / 2), 0]}>
        <boxGeometry args={[0.18, SCREEN_HALF_H - gapY - SLIT_H, 0.4]} />
        <meshStandardMaterial color={barrierColor} emissive="#0a1e30" emissiveIntensity={0.4} />
      </mesh>

      <Line points={[[-0.09, -SCREEN_HALF_H, 0], [-0.09, SCREEN_HALF_H, 0]]} color={edgeColor} lineWidth={1} />
      <Line points={[[0.09, -SCREEN_HALF_H, 0], [0.09, SCREEN_HALF_H, 0]]} color={edgeColor} lineWidth={1} />

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
      color={measured ? '#f59e0b' : '#f59e0b'}
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

  useEffect(() => {
    countRef.current = 0
    accumRef.current = 0
    if (instancedRef.current) {
      instancedRef.current.count = 0
    }
  }, [measured, lambda])

  const color = measured ? '#f59e0b' : '#f59e0b'
  const emissive = measured ? '#f59e0b' : '#f59e0b'

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
      {/* ── Wave propagation from source ── */}
      <SourceWaves />

      {/* ── Wave propagation from slits ── */}
      <SlitWaves measured={measured} />

      {/* ── Interference amplitude field ── */}
      <InterferenceField lambda={lambda} measured={measured} />

      {/* ── Source ── */}
      <mesh position={[SOURCE_X, 0, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[SOURCE_X, 0, 0]} color="#f59e0b" intensity={0.8} distance={2} />

      {/* ── Beam lines from source to slits ── */}
      <Line
        points={[[SOURCE_X, 0, 0], [BARRIER_X - 0.1, SLIT_SEP / 2, 0]]}
        color="#f59e0b"
        lineWidth={1}
        transparent
        opacity={0.15}
      />
      <Line
        points={[[SOURCE_X, 0, 0], [BARRIER_X - 0.1, -SLIT_SEP / 2, 0]]}
        color="#f59e0b"
        lineWidth={1}
        transparent
        opacity={0.15}
      />

      <Barrier measured={measured} />
      <Screen />
      <IntensityCurve lambda={lambda} measured={measured} />
      <ParticleCloud measured={measured} lambda={lambda} />

      {/* ── Labels ── */}
      <Html position={[SOURCE_X, -0.55, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>SOURCE</span>
      </Html>
      <Html position={[BARRIER_X, SCREEN_HALF_H + 0.25, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>BARRIER</span>
      </Html>
      <Html position={[SCREEN_X, SCREEN_HALF_H + 0.25, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>DETECTOR</span>
      </Html>

      <Html position={[SCREEN_X + 1.0, 0, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: measured ? '#f59e0b' : '#f59e0b',
          textShadow: measured ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(245,158,11,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {measured ? 'CLASSICAL\nTWO-BAND' : 'INTERFERENCE\nFRINGES'}
        </div>
      </Html>
    </group>
  )
}
