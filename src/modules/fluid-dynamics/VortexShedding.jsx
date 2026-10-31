// Kármán vortex street: point vortices shed alternately from the cylinder,
// advected by potential flow + Biot–Savart. A per-pixel vorticity field
// (red = counter-clockwise, blue = clockwise) and dye released from the
// cylinder's shoulders reveal the street the way a flow-lab photo does.
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const U_BASE  = 1.5
const R       = 1.2
const CORE    = 0.35
const MAX_V   = 80
const DYE_TOP = new THREE.Color('#5eead4')
const DYE_BOT = new THREE.Color('#fbbf24')
const EMIT_PER_FRAME = 10
const N_TRACE = 1600 // dye particles

// Potential flow velocity around cylinder
function potentialFlow(x, y, U) {
  const r2 = x * x + y * y
  if (r2 <= R * R) return [0, 0]
  const r4 = r2 * r2
  return [
    U * (1 - R * R * (x * x - y * y) / r4),
    -U * R * R * 2 * x * y / r4,
  ]
}

// Biot-Savart velocity from vortex array at a point
function bsVel(px, py, vxA, vyA, gA, count) {
  let vx = 0, vy = 0
  for (let k = 0; k < count; k++) {
    const dx = px - vxA[k], dy = py - vyA[k]
    const r2 = dx * dx + dy * dy + CORE * CORE
    vx -= gA[k] * dy / (2 * Math.PI * r2)
    vy += gA[k] * dx / (2 * Math.PI * r2)
  }
  return [vx, vy]
}

const VORT_VERT = `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const VORT_FRAG = `
  uniform vec3 uV[${MAX_V}];
  uniform float uN;
  varying vec2 vP;
  void main() {
    float w = 0.0;
    // Only live vortices, and only ones close enough to matter (exp(-12) ≈ 0)
    for (int k = 0; k < ${MAX_V}; k++) {
      if (float(k) >= uN) break;
      vec2 d = vP - uV[k].xy;
      float r2 = dot(d, d);
      if (r2 > 4.2) continue;
      w += uV[k].z * exp(-r2 / 0.35);
    }
    if (dot(vP, vP) < ${(R * R).toFixed(3)}) discard;
    float m = clamp(abs(w) * 0.55, 0.0, 1.0);
    vec3 col = w > 0.0 ? vec3(0.95, 0.30, 0.30) : vec3(0.25, 0.50, 1.0);
    gl_FragColor = vec4(pow(col, vec3(2.2)), m * 0.75);
  }
`

export default function VortexShedding({ reynolds }) {
  // Strength tuned (offline sweep) so the street forms two staggered rows:
  // clockwise vortices above the wake axis, counter-clockwise below.
  const Gamma       = 0.9 + reynolds * 0.3
  const sheddingDt  = Math.max(0.15, 0.55 - reynolds * 0.1)

  const vxA  = useRef(new Float32Array(MAX_V))
  const vyA  = useRef(new Float32Array(MAX_V))
  const gA   = useRef(new Float32Array(MAX_V))
  const vCnt = useRef(0)
  const shed = useRef(0)
  const pha  = useRef(0)

  const vGeoRef = useRef()
  const tGeoRef = useRef()
  const emit    = useRef(0)

  const vortU = useMemo(() => ({
    uV: { value: Array.from({ length: MAX_V }, () => new THREE.Vector3(1000, 1000, 0)) },
    uN: { value: 0 },
  }), [])

  const { vPos, vCol, tPos, tCol } = useMemo(() => {
    const vPos = new Float32Array(MAX_V * 3)
    const vCol = new Float32Array(MAX_V * 3)
    // Init vortex positions off-screen
    for (let i = 0; i < MAX_V; i++) { vPos[i * 3] = 1000; vPos[i * 3 + 1] = 0; vPos[i * 3 + 2] = 0 }
    const tPos = new Float32Array(N_TRACE * 3)
    const tCol = new Float32Array(N_TRACE * 3)
    for (let i = 0; i < N_TRACE; i++) {
      tPos[i * 3] = 1000; tPos[i * 3 + 1] = 0; tPos[i * 3 + 2] = 0.05 // parked until emitted
      const top = i % 2 === 0
      const c = top ? DYE_TOP : DYE_BOT
      tCol[i * 3] = c.r; tCol[i * 3 + 1] = c.g; tCol[i * 3 + 2] = c.b
    }
    return { vPos, vCol, tPos, tCol }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04)
    const U  = U_BASE

    // Shed vortex
    shed.current += dt
    if (shed.current >= sheddingDt && vCnt.current < MAX_V - 1) {
      shed.current = 0
      const n = vCnt.current
      // Released from the rear, where the boundary layer separates
      vxA.current[n] = 1.8
      vyA.current[n] = pha.current === 0 ? 0.95 : -0.95
      gA.current[n]  = pha.current === 0 ? -Gamma : Gamma
      vCnt.current++
      pha.current = 1 - pha.current
    }

    const n = vCnt.current
    const vxa = vxA.current, vya = vyA.current, ga = gA.current

    // Advect vortices (Euler step with clamping)
    const nx = new Float32Array(n), ny = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const [fx, fy] = potentialFlow(vxa[i], vya[i], U)
      const [bx, by] = bsVel(vxa[i], vya[i], vxa, vya, ga, n)
      const spd = Math.sqrt((fx + bx) ** 2 + (fy + by) ** 2)
      const clamp = Math.min(1, 6 / (spd + 0.01))
      nx[i] = vxa[i] + (fx + bx) * clamp * dt
      ny[i] = vya[i] + (fy + by) * clamp * dt
    }

    // Apply + remove out-of-bounds
    let i = 0
    while (i < vCnt.current) {
      if (nx[i] > 14 || nx[i] < -4 || Math.abs(ny[i]) > 8 ||
          nx[i] * nx[i] + ny[i] * ny[i] < R * R * 0.7) {
        const last = vCnt.current - 1
        vxa[i] = vxa[last]; vya[i] = vya[last]; ga[i] = ga[last]
        nx[i]  = nx[last];  ny[i]  = ny[last]
        vCnt.current--
      } else {
        vxa[i] = nx[i]; vya[i] = ny[i]; i++
      }
    }

    // Update vortex display
    const vGeo = vGeoRef.current
    if (vGeo) {
      for (let k = 0; k < MAX_V; k++) {
        if (k < vCnt.current) {
          vPos[k * 3] = vxa[k]; vPos[k * 3 + 1] = vya[k]; vPos[k * 3 + 2] = 0.1
          const pos = ga[k] > 0
          vCol[k * 3]     = pos ? 1.0 : 0.35
          vCol[k * 3 + 1] = pos ? 0.45 : 0.6
          vCol[k * 3 + 2] = pos ? 0.45 : 1.0
        } else {
          vPos[k * 3] = 1000  // hide inactive
        }
      }
      vGeo.attributes.position.needsUpdate = true
      vGeo.attributes.color.needsUpdate    = true
    }

    // Release dye from the shoulders (round-robin over the pool)
    const tGeo = tGeoRef.current
    for (let e = 0; e < EMIT_PER_FRAME; e++) {
      const k = emit.current
      emit.current = (emit.current + 1) % N_TRACE
      const top = k % 2 === 0
      // Released at the separation points (where the shear layers roll up)
      tPos[k * 3]     = 1.35 + Math.random() * 0.25
      tPos[k * 3 + 1] = (top ? 1 : -1) * (0.85 + Math.random() * 0.2)
    }
    // Advect dye with the full velocity (free stream + every vortex)
    for (let i = 0; i < N_TRACE; i++) {
      const tx = tPos[i * 3], ty = tPos[i * 3 + 1]
      if (tx > 999) continue
      const [fx, fy] = potentialFlow(tx, ty, U)
      const [bx, by] = bsVel(tx, ty, vxa, vya, ga, vCnt.current)
      let ox = tx + (fx + bx) * dt, oy = ty + (fy + by) * dt
      if (ox * ox + oy * oy < R * R || ox > 15 || Math.abs(oy) > 7) { ox = 1000; oy = 0 }
      tPos[i * 3] = ox; tPos[i * 3 + 1] = oy
    }

    // Vorticity field uniforms
    vortU.uN.value = vCnt.current * 1.0
    const vu = vortU.uV.value
    for (let k = 0; k < MAX_V; k++) {
      if (k < vCnt.current) vu[k].set(vxa[k], vya[k], ga[k])
      else vu[k].set(1000, 1000, 0)
    }
    if (tGeo) {
      tGeo.attributes.position.needsUpdate = true
      tGeo.attributes.color.needsUpdate    = true
    }
  })

  const shedRate = 1 / sheddingDt

  return (
    <group position={[-2.2, 0, 0]}>
      {/* Vorticity field */}
      {/* Plane centred on the cylinder so shader coords = flow coords */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[34, 14]} />
        <shaderMaterial vertexShader={VORT_VERT} fragmentShader={VORT_FRAG} uniforms={vortU} transparent depthWrite={false} />
      </mesh>

      {/* Cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.3]}>
        <cylinderGeometry args={[R, R, 0.6, 64]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.61]}>
        <ringGeometry args={[R - 0.02, R + 0.03, 64]} />
        <meshBasicMaterial color="#5eead4" toneMapped={false} />
      </mesh>

      {/* Dye */}
      <points>
        <bufferGeometry ref={tGeoRef}>
          <bufferAttribute attach="attributes-position" args={[tPos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[tCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.09} vertexColors transparent opacity={0.85} depthWrite={false} sizeAttenuation toneMapped={false} />
      </points>

      {/* Vortex cores */}
      <points>
        <bufferGeometry ref={vGeoRef}>
          <bufferAttribute attach="attributes-position" args={[vPos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[vCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.16} vertexColors transparent opacity={0.9} depthWrite={false} sizeAttenuation toneMapped={false} />
      </points>

      {/* Legend */}
      <Html calculatePosition={(_, __, size) => [size.width - 206, 52]} style={{ pointerEvents: 'none' }}>
        <div style={{
          width: 194, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vorticity ω</div>
          <div style={{ height: 10, borderRadius: 3, background: 'linear-gradient(90deg, #4080ff, transparent 50%, #f24d4d)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'rgb(var(--c-text-muted))' }}>
            <span>clockwise</span><span>counter-clockwise</span>
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 10, fontSize: 12, color: 'rgb(var(--c-text-muted))' }}>
            <span><span style={{ color: '#5eead4' }}>●</span> Dye from the top shoulder</span>
            <span><span style={{ color: '#fbbf24' }}>●</span> Dye from the bottom shoulder</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgb(var(--c-border))', fontSize: 12 }}>
            <span style={{ color: 'rgb(var(--c-text-muted))' }}>Vortices shed / s</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{shedRate.toFixed(1)}</span>
          </div>
        </div>
      </Html>
    </group>
  )
}
