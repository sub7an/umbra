import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const R = 1.2
const N_TRACERS = 700
const DX = 9.0
const DY = 5.0

function flowVel(x, y, U) {
  const r2 = x * x + y * y
  if (r2 <= R * R) return [0, 0]
  const r4 = r2 * r2
  return [
    U * (1 - R * R * (x * x - y * y) / r4),
    -U * R * R * 2 * x * y / r4,
  ]
}

function buildStreamlines(U) {
  const starts = [-4.5, -3.8, -3.0, -2.2, -1.4, -0.7, 0.7, 1.4, 2.2, 3.0, 3.8, 4.5]
  return starts.map((y0) => {
    const verts = []
    let x = -DX + 0.1, y = y0
    for (let i = 0; i < 600; i++) {
      verts.push(x, y, -0.05)
      const [vx, vy] = flowVel(x, y, U)
      const sp = Math.sqrt(vx * vx + vy * vy) + 0.001
      const nx = x + (vx / sp) * 0.07
      const ny = y + (vy / sp) * 0.07
      if (nx > DX || Math.abs(ny) > DY + 0.5 || Math.sqrt(nx * nx + ny * ny) < R - 0.08) break
      x = nx; y = ny
    }
    return new Float32Array(verts)
  })
}

export default function StreamLines({ reynolds }) {
  const U      = 0.4 + reynolds * 0.55
  const geoRef = useRef()

  const { pos, col } = useMemo(() => {
    const pos = new Float32Array(N_TRACERS * 3)
    const col = new Float32Array(N_TRACERS * 3)
    for (let i = 0; i < N_TRACERS; i++) {
      let x, y
      do {
        x = (Math.random() - 0.5) * DX * 2
        y = (Math.random() - 0.5) * DY * 2
      } while (x * x + y * y < R * R)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0
      col[i * 3] = 0.2; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 1.0
    }
    return { pos, col }
  }, [])

  const streamlines = useMemo(() => buildStreamlines(U), [U])

  const prevU = useRef(U)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04) * 1.8
    const currentU = 0.4 + reynolds * 0.55
    let maxSp = 0.001

    for (let i = 0; i < N_TRACERS; i++) {
      let x = pos[i * 3], y = pos[i * 3 + 1]
      const [vx, vy] = flowVel(x, y, currentU)
      const sp = Math.sqrt(vx * vx + vy * vy)
      if (sp > maxSp) maxSp = sp

      x += vx * dt
      y += vy * dt

      const inCyl   = x * x + y * y < R * R * 0.8
      const outBounds = x > DX + 0.2 || Math.abs(y) > DY + 0.5 || x < -DX - 1

      if (inCyl || outBounds) {
        x = -DX + Math.random() * 0.4
        y = (Math.random() - 0.5) * DY * 2
      }

      pos[i * 3] = x; pos[i * 3 + 1] = y

      // Speed-coded color: dark blue → teal → bright orange
      const t = Math.min(sp / Math.max(currentU * 1.8, 0.1), 1)
      if (t < 0.5) {
        const s = t * 2
        col[i * 3]     = 0.04 + s * 0.13
        col[i * 3 + 1] = 0.15 + s * 0.68
        col[i * 3 + 2] = 0.45 + s * 0.30
      } else {
        const s = (t - 0.5) * 2
        col[i * 3]     = 0.17 + s * 0.83
        col[i * 3 + 1] = 0.83 - s * 0.48
        col[i * 3 + 2] = 0.75 - s * 0.65
      }
    }

    const geo = geoRef.current
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate    = true
    }
  })

  return (
    <group>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 5]} intensity={0.4} color="#2dd4bf" />

      {/* Precomputed streamlines */}
      {streamlines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pts, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#2dd4bf" transparent opacity={0.06} />
        </line>
      ))}

      {/* Cylinder fill */}
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[R, 48]} />
        <meshBasicMaterial color="#070d14" />
      </mesh>

      {/* Cylinder rim */}
      <mesh>
        <ringGeometry args={[R - 0.01, R + 0.07, 48]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Stagnation points */}
      {[[-R, 0], [R, 0]].map(([sx, sy], i) => (
        <mesh key={i} position={[sx, sy, 0.05]}>
          <circleGeometry args={[0.07, 12]} />
          <meshBasicMaterial color="#fb923c" />
        </mesh>
      ))}

      {/* Tracer particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.9}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}
