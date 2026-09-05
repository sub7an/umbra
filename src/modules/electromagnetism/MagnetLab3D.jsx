import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { totalBField, traceFieldLine, generateSeeds, fieldLineColor, heatColor, mag3 } from './magnetMath'

// ── Precompute field line paths ───────────────────────────────────────────────
function computeFieldLines(magnetType) {
  const bFunc = (p) => totalBField(p, magnetType)
  return generateSeeds(magnetType).map((seed) => traceFieldLine(seed, bFunc))
}

// ── Heatmap canvas texture (XZ cross-section at y=0) ─────────────────────────
function computeHeatmapTexture(magnetType, res = 128, extent = 5.5) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = res
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(res, res)
  const raw = new Float32Array(res * res)
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const x = (i / (res-1) - 0.5) * 2 * extent
      const z = (j / (res-1) - 0.5) * 2 * extent
      raw[i * res + j] = mag3(totalBField([x, 0, z], magnetType))
    }
  }
  // Use 97th-percentile cap so point singularities don't wash out the rest
  const sorted = Float32Array.from(raw).sort()
  const capB = Math.max(sorted[Math.floor(0.97 * res * res)], 1e-4)
  for (let k = 0; k < res * res; k++) {
    const t = Math.pow(Math.min(raw[k] / capB, 1), 0.32)
    const [r, g, b] = heatColor(t)
    const idx = k * 4
    img.data[idx]   = Math.round(r * 255)
    img.data[idx+1] = Math.round(g * 255)
    img.data[idx+2] = Math.round(b * 255)
    img.data[idx+3] = Math.round(t * 210)
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

// ── Field lines: single LineSegments draw call with vertex colors ─────────────
function FieldLines({ lines, visible }) {
  const geo = useMemo(() => {
    const MAX_D = 5.5
    let segCount = 0
    for (const l of lines) segCount += Math.max(0, l.length - 1)

    const positions = new Float32Array(segCount * 6)
    const colors    = new Float32Array(segCount * 6)
    let ptr = 0

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i], p2 = line[i+1]
        const t1 = 1 - Math.min(mag3(p1) / MAX_D, 1)
        const t2 = 1 - Math.min(mag3(p2) / MAX_D, 1)
        const c1 = fieldLineColor(t1)
        const c2 = fieldLineColor(t2)
        positions[ptr*6]   = p1[0]; positions[ptr*6+1] = p1[1]; positions[ptr*6+2] = p1[2]
        positions[ptr*6+3] = p2[0]; positions[ptr*6+4] = p2[1]; positions[ptr*6+5] = p2[2]
        colors[ptr*6]   = c1[0]; colors[ptr*6+1] = c1[1]; colors[ptr*6+2] = c1[2]
        colors[ptr*6+3] = c2[0]; colors[ptr*6+4] = c2[1]; colors[ptr*6+5] = c2[2]
        ptr++
      }
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, ptr*6), 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colors.slice(0, ptr*6), 3))
    return g
  }, [lines])

  useEffect(() => () => geo.dispose(), [geo])
  if (!visible) return null

  return (
    <lineSegments geometry={geo} renderOrder={1}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.80}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

// ── Heatmap plane at y=0, texture shows |B| in XZ slice ──────────────────────
function HeatmapPlane({ magnetType, visible }) {
  const tex = useMemo(() => computeHeatmapTexture(magnetType), [magnetType])
  useEffect(() => () => tex.dispose(), [tex])
  if (!visible) return null

  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[11, 11]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ── Particle stream: points flowing along precomputed field line paths ─────────
function ParticleStream({ lines, visible }) {
  const PER_LINE = 8
  const total    = lines.length * PER_LINE
  const stateRef = useRef(null)

  const geometry = useMemo(() => {
    const posAttr = new THREE.BufferAttribute(new Float32Array(total * 3), 3)
    stateRef.current = {
      posAttr,
      tArr:  Float32Array.from({ length: total }, () => Math.random()),
      speed: Float32Array.from({ length: total }, () => 0.0016 + Math.random() * 0.002),
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', posAttr)
    return g
  }, [total])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const s = stateRef.current
    if (!s) return
    const { posAttr, tArr, speed } = s
    const pos = posAttr.array
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]
      const n = line.length
      if (n < 2) continue
      for (let pi = 0; pi < PER_LINE; pi++) {
        const idx = li * PER_LINE + pi
        tArr[idx] += speed[idx]
        if (tArr[idx] >= 1) tArr[idx] -= 1
        const raw = tArr[idx] * (n - 1)
        const i0  = Math.floor(raw), i1 = Math.min(i0+1, n-1)
        const f   = raw - i0
        const p0  = line[i0], p1 = line[i1]
        pos[idx*3]   = p0[0] + (p1[0]-p0[0]) * f
        pos[idx*3+1] = p0[1] + (p1[1]-p0[1]) * f
        pos[idx*3+2] = p0[2] + (p1[2]-p0[2]) * f
      }
    }
    posAttr.needsUpdate = true
  })

  if (!visible) return null
  return (
    <points geometry={geometry} renderOrder={2}>
      <pointsMaterial
        color="#e2b8ff"
        size={0.11}
        transparent
        opacity={0.90}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Magnet body visuals ───────────────────────────────────────────────────────
function MagnetBody({ magnetType }) {
  const lightRef = useRef()
  useFrame(({ clock }) => {
    if (lightRef.current) {
      const t = clock.getElapsedTime()
      lightRef.current.intensity = 1.8 + 0.7 * Math.sin(t * 2.3)
    }
  })

  if (magnetType === 'dipole') {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={2.5} />
        </mesh>
        <pointLight ref={lightRef} color="#a855f7" intensity={2} distance={4} decay={2} />
      </group>
    )
  }

  if (magnetType === 'bar') {
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.9, 20]} />
          <meshStandardMaterial color="#dc2626" emissive="#b91c1c" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.9, 20]} />
          <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={1.5} />
        </mesh>
        <pointLight position={[0, 0.85, 0]} color="#dc2626" intensity={1.5} distance={3} decay={2} />
        <pointLight position={[0,-0.85, 0]} color="#2563eb" intensity={1.5} distance={3} decay={2} />
      </group>
    )
  }

  if (magnetType === 'solenoid') {
    return (
      <group>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[0, -0.9 + i * 0.2, 0]}>
            <torusGeometry args={[0.52, 0.035, 8, 36]} />
            <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={2.2} />
          </mesh>
        ))}
        <pointLight ref={lightRef} color="#f59e0b" intensity={2} distance={4} decay={2} />
      </group>
    )
  }

  if (magnetType === 'halbach') {
    const cfgs = [
      { x: -1.5, color: '#a855f7', emissive: '#7c3aed' },
      { x: -0.5, color: '#8b5cf6', emissive: '#6d28d9' },
      { x:  0.5, color: '#7c3aed', emissive: '#5b21b6' },
      { x:  1.5, color: '#6d28d9', emissive: '#4c1d95' },
    ]
    return (
      <group>
        {cfgs.map(({ x, color, emissive }) => (
          <group key={x}>
            <mesh position={[x, 0, 0]}>
              <boxGeometry args={[0.46, 0.46, 0.46]} />
              <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.0} />
            </mesh>
            <pointLight position={[x, 0, 0]} color={color} intensity={0.9} distance={2.5} decay={2} />
          </group>
        ))}
      </group>
    )
  }

  return null
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MagnetLab3D({ showFieldLines = true, showHeatmap = true, showParticles = true }) {
  const magnetType = useModuleStore((s) => s.em.magnetType)
  const fieldLines = useMemo(() => computeFieldLines(magnetType), [magnetType])

  return (
    <group>
      <MagnetBody magnetType={magnetType} />
      <FieldLines  lines={fieldLines} visible={showFieldLines} />
      <HeatmapPlane magnetType={magnetType} visible={showHeatmap} />
      <ParticleStream key={magnetType} lines={fieldLines} visible={showParticles} />
    </group>
  )
}
