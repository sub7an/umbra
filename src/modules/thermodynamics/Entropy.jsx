import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N = 400
const BOX_W = 4.5
const BOX_H = 3.5
const GAP   = 0.06  // width of partition gap when opening

export default function Entropy({ temperature }) {
  const geoRef     = useRef()
  const wallRef    = useRef()
  const timeRef    = useRef(0)
  const openedRef  = useRef(false)
  const openPctRef = useRef(0)

  const state = useMemo(() => {
    const pos  = new Float32Array(N * 3)
    const vel  = new Float32Array(N * 3)
    const col  = new Float32Array(N * 3)
    const side = new Int8Array(N)  // 0 = left (cyan), 1 = right (orange)

    for (let i = 0; i < N; i++) {
      const s = i < N / 2 ? 0 : 1
      side[i]     = s
      pos[i*3]    = (s === 0 ? -1 : 1) * (Math.random() * (BOX_W * 0.5 - 0.2) + 0.1)
      pos[i*3+1]  = (Math.random() - 0.5) * BOX_H * 1.6
      pos[i*3+2]  = (Math.random() - 0.5) * 1.0

      const sigma = Math.sqrt(temperature) * (s === 0 ? 1.0 : 0.7)
      vel[i*3]    = (Math.random() - 0.5) * sigma * 2
      vel[i*3+1]  = (Math.random() - 0.5) * sigma * 2
      vel[i*3+2]  = 0

      col[i*3]   = s === 0 ? 0.1 : 1.0
      col[i*3+1] = s === 0 ? 0.8 : 0.4
      col[i*3+2] = s === 0 ? 1.0 : 0.1
    }
    return { pos, vel, col, side }
  }, [])

  const { pos, vel, col, side } = state
  const prevTRef = useRef(temperature)

  useFrame((_, delta) => {
    timeRef.current += delta
    const dt = Math.min(delta, 0.04)

    if (prevTRef.current !== temperature) {
      const ratio = Math.sqrt(temperature / prevTRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTRef.current = temperature
    }

    // Open partition after 2s
    if (timeRef.current > 2 && openPctRef.current < 1) {
      openPctRef.current = Math.min(1, openPctRef.current + delta * 0.4)
    }
    const gap = openPctRef.current * BOX_H  // open gap height

    if (wallRef.current) {
      wallRef.current.scale.y = Math.max(0.01, 1 - openPctRef.current)
    }

    for (let i = 0; i < N; i++) {
      pos[i*3]   += vel[i*3]   * dt
      pos[i*3+1] += vel[i*3+1] * dt

      // Container walls
      if (pos[i*3] >  BOX_W * 0.9)  { pos[i*3] =  BOX_W * 0.9;  vel[i*3] *= -1 }
      if (pos[i*3] < -BOX_W * 0.9)  { pos[i*3] = -BOX_W * 0.9;  vel[i*3] *= -1 }
      if (pos[i*3+1] >  BOX_H * 0.9) { pos[i*3+1] =  BOX_H * 0.9; vel[i*3+1] *= -1 }
      if (pos[i*3+1] < -BOX_H * 0.9) { pos[i*3+1] = -BOX_H * 0.9; vel[i*3+1] *= -1 }

      // Partition: block crossing x≈0 unless within the open gap
      const x = pos[i*3], y = pos[i*3+1]
      const withinGap = Math.abs(y) < gap * 0.5
      if (!withinGap) {
        if (vel[i*3] > 0 && x > -GAP && x < GAP && pos[i*3] >= 0 && side[i] === 0) {
          pos[i*3] = -GAP; vel[i*3] *= -1
        }
        if (vel[i*3] < 0 && x > -GAP && x < GAP && pos[i*3] <= 0 && side[i] === 1) {
          pos[i*3] = GAP; vel[i*3] *= -1
        }
      }

      // Color fades from pure side-color toward mix as entropy increases
      const mixFrac = openPctRef.current * 0.4
      const s = side[i]
      col[i*3]   = s === 0 ? 0.1 + mixFrac * 0.9 : 1.0 - mixFrac * 0.4
      col[i*3+1] = s === 0 ? 0.8 - mixFrac * 0.4 : 0.4 + mixFrac * 0.2
      col[i*3+2] = s === 0 ? 1.0 - mixFrac * 0.6 : 0.1 + mixFrac * 0.6
    }

    const geo = geoRef.current
    if (!geo) return
    geo.attributes.position.array.set(pos)
    geo.attributes.color.array.set(col)
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate    = true
  })

  return (
    <group>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 3]} intensity={0.8} color="#38bdf8" />

      {/* Outer box */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_W*1.8, BOX_H*1.8, 1)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.12} />
      </lineSegments>

      {/* Partition wall — scales down as it opens */}
      <mesh ref={wallRef} position={[0, 0, 0]}>
        <boxGeometry args={[0.06, BOX_H * 1.8, 0.3]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4}
          transparent opacity={0.6} />
      </mesh>

      {/* Particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.09} vertexColors transparent opacity={0.85}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}
