import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N = 300
const BOX = 5

function gaussRandom() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export default function GasSimulation({ temperature }) {
  const geoRef = useRef()

  // Particle state: pos 3N, vel 3N, stored in refs so useFrame can mutate
  const state = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const vel = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const sigma = Math.sqrt(temperature)

    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * BOX * 1.8
      pos[i*3+1] = (Math.random() - 0.5) * BOX * 1.8
      pos[i*3+2] = (Math.random() - 0.5) * BOX * 1.8

      vel[i*3]   = gaussRandom() * sigma
      vel[i*3+1] = gaussRandom() * sigma
      vel[i*3+2] = gaussRandom() * sigma

      // Color by speed — will be updated each frame
      col[i*3] = 0.2; col[i*3+1] = 0.7; col[i*3+2] = 1.0
    }
    return { pos, vel, col }
  }, [])

  // When temperature changes, rescale velocities
  const prevTempRef = useRef(temperature)
  const { pos, vel, col } = state

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const T  = temperature

    // Rescale velocities if temperature changed
    if (prevTempRef.current !== T) {
      const ratio = Math.sqrt(T / prevTempRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTempRef.current = T
    }

    let maxSpeedSq = 0.001
    for (let i = 0; i < N; i++) {
      pos[i*3]   += vel[i*3]   * dt
      pos[i*3+1] += vel[i*3+1] * dt
      pos[i*3+2] += vel[i*3+2] * dt

      // Elastic wall reflection
      const half = BOX * 0.9
      for (let d = 0; d < 3; d++) {
        if (pos[i*3+d] >  half) { pos[i*3+d] =  half; vel[i*3+d] *= -1 }
        if (pos[i*3+d] < -half) { pos[i*3+d] = -half; vel[i*3+d] *= -1 }
      }

      const vx = vel[i*3], vy = vel[i*3+1], vz = vel[i*3+2]
      const spSq = vx*vx + vy*vy + vz*vz
      if (spSq > maxSpeedSq) maxSpeedSq = spSq
    }

    const maxSp = Math.sqrt(maxSpeedSq)
    // Color: slow = blue, fast = orange
    for (let i = 0; i < N; i++) {
      const vx = vel[i*3], vy = vel[i*3+1], vz = vel[i*3+2]
      const sp = Math.sqrt(vx*vx + vy*vy + vz*vz) / maxSp  // 0..1
      col[i*3]   = 0.2 + sp * 0.8    // R: blue→orange
      col[i*3+1] = 0.4 + sp * 0.3    // G
      col[i*3+2] = 1.0 - sp * 0.9    // B
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
      <pointLight position={[0, 6, 0]} intensity={0.6} color="#38bdf8" />
      <pointLight position={[4, 2, 4]} intensity={0.3} color="#fb923c" />

      {/* Container box wireframe */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX*1.8, BOX*1.8, BOX*1.8)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.12} />
      </lineSegments>

      {/* Particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} vertexColors transparent opacity={0.9}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}
