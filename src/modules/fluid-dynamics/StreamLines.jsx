// Potential flow past a cylinder (exact solution). A per-pixel pressure-
// coefficient field Cp = 1 − (v/U)² (Bernoulli) shows high pressure at the
// stagnation points and suction over the shoulders; streamlines and tracers
// coloured by speed ride on top.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const R = 1.2
const N_TRACERS = 520
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
  const starts = []
  for (let k = 0; k < 24; k++) {
    const y0 = -DY + 0.25 + (k / 23) * (2 * DY - 0.5)
    if (Math.abs(y0) > 0.12) starts.push(y0)
  }
  return starts.map((y0) => {
    const verts = []
    let x = -DX + 0.1, y = y0
    for (let i = 0; i < 700; i++) {
      verts.push(x, y, 0.01)
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

// Pressure-coefficient field, evaluated analytically per fragment
const CP_VERT = `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CP_FRAG = `
  uniform float uR;
  varying vec2 vP;
  vec3 ramp(float t) {
    // Cp in [-3, 1] mapped to t in [0, 1]: suction (violet) → free stream (navy) → stagnation (amber)
    vec3 c0 = vec3(0.45, 0.20, 0.85);
    vec3 c1 = vec3(0.06, 0.10, 0.24);
    vec3 c2 = vec3(0.98, 0.62, 0.18);
    return t < 0.75 ? mix(c0, c1, t / 0.75) : mix(c1, c2, (t - 0.75) / 0.25);
  }
  void main() {
    float x = vP.x, y = vP.y;
    float r2 = x * x + y * y;
    float R2 = uR * uR;
    if (r2 < R2) discard;
    float r4 = r2 * r2;
    float vx = 1.0 - R2 * (x * x - y * y) / r4;
    float vy = -R2 * 2.0 * x * y / r4;
    float cp = 1.0 - (vx * vx + vy * vy);            // independent of U
    float t = clamp((cp + 3.0) / 4.0, 0.0, 1.0);
    // Soft edge fade so the field doesn't end in a hard rectangle
    float edge = smoothstep(0.0, 1.2, ${(DX).toFixed(1)} - abs(x)) * smoothstep(0.0, 1.0, ${(DY).toFixed(1)} - abs(y));
    vec3 col = ramp(t);
    gl_FragColor = vec4(pow(col, vec3(2.2)), 0.9 * edge);
  }
`

const SLOW = new THREE.Color('#1e40af')
const MID  = new THREE.Color('#2dd4bf')
const FAST = new THREE.Color('#fde68a')

export default function StreamLines({ reynolds }) {
  const U      = 0.4 + reynolds * 0.55
  const geoRef = useRef()
  const uRef   = useRef(U)
  uRef.current = U

  const { pos, col } = useMemo(() => {
    const pos = new Float32Array(N_TRACERS * 3)
    const col = new Float32Array(N_TRACERS * 3)
    for (let i = 0; i < N_TRACERS; i++) {
      let x, y
      do {
        x = (Math.random() - 0.5) * DX * 2
        y = (Math.random() - 0.5) * DY * 2
      } while (x * x + y * y < R * R)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0.03
    }
    return { pos, col }
  }, [])

  const streamlines = useMemo(() => buildStreamlines(U), [U])
  const lineObjs = useMemo(() => streamlines.map((pts) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return g
  }), [streamlines])
  useEffect(() => () => lineObjs.forEach((g) => g.dispose()), [lineObjs])

  const cpUniforms = useMemo(() => ({ uR: { value: R } }), [])
  const c = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04) * 1.8
    const currentU = uRef.current

    for (let i = 0; i < N_TRACERS; i++) {
      let x = pos[i * 3], y = pos[i * 3 + 1]
      const [vx, vy] = flowVel(x, y, currentU)
      const sp = Math.sqrt(vx * vx + vy * vy)

      x += vx * dt
      y += vy * dt

      const inCyl     = x * x + y * y < R * R * 0.8
      const outBounds = x > DX + 0.2 || Math.abs(y) > DY + 0.5 || x < -DX - 1
      if (inCyl || outBounds) {
        x = -DX + Math.random() * 0.4
        y = (Math.random() - 0.5) * DY * 2
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y

      // Speed relative to free stream: 0 (stagnation) … 2U (shoulders)
      const t = Math.min(sp / (currentU * 2), 1)
      if (t < 0.5) c.copy(SLOW).lerp(MID, t * 2)
      else c.copy(MID).lerp(FAST, (t - 0.5) * 2)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }

    const geo = geoRef.current
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate    = true
    }
  })

  return (
    <group>
      {/* Pressure-coefficient field */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[DX * 2, DY * 2, 1, 1]} />
        <shaderMaterial vertexShader={CP_VERT} fragmentShader={CP_FRAG} uniforms={cpUniforms} transparent depthWrite={false} />
      </mesh>

      {/* Streamlines */}
      {lineObjs.map((g, i) => (
        <line key={i} geometry={g}>
          <lineBasicMaterial color="#e0f2fe" transparent opacity={0.32} />
        </line>
      ))}

      {/* Cylinder (lit, extruded toward the viewer) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.3]}>
        <cylinderGeometry args={[R, R, 0.6, 64]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.61]}>
        <ringGeometry args={[R - 0.02, R + 0.03, 64]} />
        <meshBasicMaterial color="#5eead4" toneMapped={false} />
      </mesh>

      {/* Stagnation points (v = 0, Cp = 1) */}
      {[[-R, 0], [R, 0]].map(([sx, sy], i) => (
        <mesh key={i} position={[sx * 1.03, sy, 0.1]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#fb923c" toneMapped={false} />
        </mesh>
      ))}

      {/* Tracers */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.11} vertexColors transparent opacity={0.95} depthWrite={false} sizeAttenuation toneMapped={false} />
      </points>

      {/* Legend */}
      <Html calculatePosition={(_, __, size) => [size.width - 206, 52]} style={{ pointerEvents: 'none' }}>
        <div style={{
          width: 194, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Pressure coefficient</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>C<sub>p</sub> = 1 − (v/U)²</div>
          <div style={{ height: 10, borderRadius: 3, background: 'linear-gradient(90deg, #7333d9 0%, #0f1a3d 75%, #fa9e2e 100%)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'rgb(var(--c-text-muted))', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>−3</span><span>0</span><span>+1</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgb(var(--c-text-muted))' }}>
            <span>suction</span><span>stagnation</span>
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 10, fontSize: 12, color: 'rgb(var(--c-text-muted))' }}>
            <span><span style={{ color: '#fb923c' }}>●</span> Stagnation point (v = 0)</span>
            <span><span style={{ color: '#fde68a' }}>●</span> Fastest: 2U over the top</span>
          </div>
        </div>
      </Html>
    </group>
  )
}
