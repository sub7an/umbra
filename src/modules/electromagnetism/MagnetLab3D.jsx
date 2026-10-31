// Magnet lab: the field of four magnet types, three ways at once.
//
//   • 3D field lines traced with RK4, glowing by |B|, with dashes flowing N → S
//   • a vertical slice through the magnet (the plane the classic iron-filing
//     picture lives in): |B| on a log scale with isolines, and ~3,000 iron
//     filings, each a short needle aligned with the local field
//   • particles streaming along the field lines
//
// The magnet bodies are modelled as the real thing: a current loop, a painted
// bar magnet, a copper solenoid, and a Halbach array with each block's
// magnetisation arrow.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { totalBField, traceFieldLine, generateSeeds, fieldLineColor, mag3 } from './magnetMath'

const EXTENT = 5.5      // half-size of the slice
const SLICE_RES = 192
const FILING_N = 72     // filings per side of the jittered grid
const FILING_LEN = 0.15

// Regions occupied by each magnet body (no filings drawn inside)
function insideBody(x, y, type) {
  if (type === 'dipole')   return x * x + y * y < 0.09
  if (type === 'bar')      return Math.abs(x) < 0.24 && Math.abs(y) < 0.95
  if (type === 'solenoid') return Math.abs(x) < 0.62 && Math.abs(y) < 1.12
  if (type === 'halbach')  return Math.abs(x) < 2.0 && Math.abs(y) < 0.3
  return false
}

// ── Field lines: one Line per traced path, coloured by distance, dashes flow ─
function FieldLines({ lines, visible }) {
  const refs = useRef([])
  const data = useMemo(() => lines.filter((l) => l.length > 4).map((line) => {
    const colors = line.map((p) => {
      const t = 1 - Math.min(mag3(p) / EXTENT, 1)
      const [r, g, b] = fieldLineColor(t)
      return [r * 1.4, g * 1.4, b * 1.4]
    })
    return { points: line, colors }
  }), [lines])

  useFrame((_, delta) => {
    refs.current.forEach((l) => { if (l?.material) l.material.dashOffset -= Math.min(delta, 0.05) * 0.6 })
  })

  if (!visible) return null
  return data.map((d, i) => (
    <Line
      key={i}
      ref={(el) => (refs.current[i] = el)}
      points={d.points}
      vertexColors={d.colors}
      lineWidth={1.6}
      transparent
      opacity={0.9}
      dashed
      dashSize={0.35}
      gapSize={0.12}
      toneMapped={false}
    />
  ))
}

// ── Slice through the magnet: log|B| with isolines ───────────────────────────
const SLICE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const SLICE_FRAG = /* glsl */`
  uniform sampler2D uB;
  varying vec2 vUv;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    float v = texture2D(uB, vUv).r;                  // normalised log|B| ∈ [0, 1]
    vec3 c0 = lin(vec3(0.02, 0.02, 0.06));
    vec3 c1 = lin(vec3(0.20, 0.06, 0.40));
    vec3 c2 = lin(vec3(0.62, 0.18, 0.55));
    vec3 c3 = lin(vec3(1.00, 0.62, 0.30));
    vec3 col = v < 0.45 ? mix(c0, c1, v / 0.45) : v < 0.8 ? mix(c1, c2, (v - 0.45) / 0.35) : mix(c2, c3, (v - 0.8) / 0.2);
    col *= 0.55;
    // Isolines of |B|: every factor of ~1.4
    float k = v * 14.0;
    float iso = 1.0 - min(abs(fract(k) - 0.5) * 2.0 / (fwidth(k) * 2.0), 1.0);
    col += lin(vec3(0.75, 0.6, 1.0)) * iso * 0.18 * smoothstep(0.1, 0.4, v);
    // Round vignette so the slice has no hard edge
    float r = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.72, 1.0, r);
    gl_FragColor = vec4(col, a * 0.92);
  }
`

function useSliceData(magnetType) {
  return useMemo(() => {
    const N = SLICE_RES
    const logB = new Float32Array(N * N)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * 2 * EXTENT
      const y = (j / (N - 1) - 0.5) * 2 * EXTENT
      logB[j * N + i] = Math.log10(mag3(totalBField([x, y, 0], magnetType)) + 1e-6)
    }
    const sorted = Float32Array.from(logB).sort()
    const lo = sorted[Math.floor(0.03 * N * N)], hi = sorted[Math.floor(0.995 * N * N)]
    const half = new Uint16Array(N * N * 4)
    for (let k = 0; k < N * N; k++) {
      const v = Math.min(Math.max((logB[k] - lo) / (hi - lo), 0), 1)
      half[k * 4] = THREE.DataUtils.toHalfFloat(v)
      half[k * 4 + 3] = THREE.DataUtils.toHalfFloat(1)
    }
    const tex = new THREE.DataTexture(half, N, N, THREE.RGBAFormat, THREE.HalfFloatType)
    tex.minFilter = tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { tex, lo, hi }
  }, [magnetType])
}

function FieldSlice({ magnetType, visible }) {
  const { tex, lo, hi } = useSliceData(magnetType)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SLICE_VERT, fragmentShader: SLICE_FRAG,
    uniforms: { uB: { value: tex } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }), [tex])
  useEffect(() => () => { mat.dispose(); tex.dispose() }, [mat, tex])

  // Iron filings: short needles along (Bx, By), brighter where the field is strong
  const filings = useMemo(() => {
    const pos = [], col = []
    const step = (2 * EXTENT) / FILING_N
    for (let j = 0; j < FILING_N; j++) for (let i = 0; i < FILING_N; i++) {
      const x = -EXTENT + (i + 0.5 + (Math.random() - 0.5) * 0.8) * step
      const y = -EXTENT + (j + 0.5 + (Math.random() - 0.5) * 0.8) * step
      if (x * x + y * y > (EXTENT * 0.92) ** 2 || insideBody(x, y, magnetType)) continue
      const B = totalBField([x, y, 0], magnetType)
      const m = Math.hypot(B[0], B[1])
      if (m < 1e-9) continue
      const dx = (B[0] / m) * FILING_LEN / 2, dy = (B[1] / m) * FILING_LEN / 2
      pos.push(x - dx, y - dy, 0.012, x + dx, y + dy, 0.012)
      const v = Math.min(Math.max((Math.log10(mag3(B) + 1e-6) - lo) / (hi - lo), 0), 1)
      const fade = 1 - Math.min(Math.hypot(x, y) / (EXTENT * 0.92), 1) ** 3
      const b = (0.18 + 0.82 * v) * fade
      col.push(b * 0.85, b * 0.85, b, b * 0.85, b * 0.85, b)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    return g
  }, [magnetType, lo, hi])
  useEffect(() => () => filings.dispose(), [filings])

  if (!visible) return null
  return (
    <group>
      <mesh material={mat} position={[0, 0, -0.01]}>
        <planeGeometry args={[EXTENT * 2, EXTENT * 2]} />
      </mesh>
      <lineSegments geometry={filings}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

// ── Particle stream: glowing points flowing along the field lines ────────────
function ParticleStream({ lines, visible }) {
  const PER_LINE = 6
  const total = lines.length * PER_LINE
  const state = useMemo(() => ({
    t: Float32Array.from({ length: total }, () => Math.random()),
    v: Float32Array.from({ length: total }, () => 0.08 + Math.random() * 0.06),
  }), [total])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3))
    return g
  }, [total])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const pos = geometry.attributes.position.array
    const dt = Math.min(delta, 0.05)
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li], n = line.length
      if (n < 2) continue
      for (let k = 0; k < PER_LINE; k++) {
        const idx = li * PER_LINE + k
        state.t[idx] = (state.t[idx] + state.v[idx] * dt) % 1
        const raw = state.t[idx] * (n - 1), i0 = Math.floor(raw), i1 = Math.min(i0 + 1, n - 1), f = raw - i0
        const p0 = line[i0], p1 = line[i1]
        pos[idx * 3] = p0[0] + (p1[0] - p0[0]) * f
        pos[idx * 3 + 1] = p0[1] + (p1[1] - p0[1]) * f
        pos[idx * 3 + 2] = p0[2] + (p1[2] - p0[2]) * f
      }
    }
    geometry.attributes.position.needsUpdate = true
  })

  if (!visible) return null
  return (
    <points geometry={geometry}>
      <pointsMaterial color={[1.6, 1.3, 2.2]} size={0.09} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ── Magnet bodies ─────────────────────────────────────────────────────────────
function MomentArrow({ dir = [0, 1, 0], len = 0.5, color = '#fde68a', position = [0, 0, 0] }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir])
  return (
    <group position={position} quaternion={q}>
      <mesh position={[0, len * 0.35, 0]}>
        <cylinderGeometry args={[0.025, 0.025, len * 0.7, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, len * 0.82, 0]}>
        <coneGeometry args={[0.07, len * 0.3, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Copper(props) {
  return <meshStandardMaterial color="#c8743a" metalness={0.95} roughness={0.28} emissive="#5a2a0c" emissiveIntensity={0.25} {...props} />
}

function MagnetBody({ magnetType }) {
  const helix = useMemo(() => {
    if (magnetType !== 'solenoid') return null
    const TURNS = 10, R = 0.52, L = 2.0
    class Helix extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = t * TURNS * Math.PI * 2
        return target.set(R * Math.cos(a), -L / 2 + t * L, R * Math.sin(a))
      }
    }
    return new THREE.TubeGeometry(new Helix(), 600, 0.035, 10, false)
  }, [magnetType])
  useEffect(() => () => helix?.dispose(), [helix])

  if (magnetType === 'dipole') {
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.035, 16, 64]} />
          <Copper />
        </mesh>
        <MomentArrow dir={[0, 1, 0]} len={0.55} position={[0, -0.1, 0]} />
      </group>
    )
  }
  if (magnetType === 'bar') {
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.34, 0.9, 0.34]} />
          <meshStandardMaterial color="#d6453d" metalness={0.35} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <boxGeometry args={[0.34, 0.9, 0.34]} />
          <meshStandardMaterial color="#5b6b8c" metalness={0.45} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.36, 0.02, 0.36]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    )
  }
  if (magnetType === 'solenoid') {
    return (
      <group>
        <mesh geometry={helix}><Copper /></mesh>
        <mesh>
          <cylinderGeometry args={[0.46, 0.46, 2.1, 48, 1, true]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.2} roughness={0.15} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <MomentArrow dir={[0, 1, 0]} len={0.9} position={[0, -0.45, 0]} />
      </group>
    )
  }
  if (magnetType === 'halbach') {
    const blocks = [
      { x: -1.5, m: [0, 1, 0] }, { x: -0.5, m: [-1, 0, 0] },
      { x: 0.5, m: [0, -1, 0] }, { x: 1.5, m: [1, 0, 0] },
    ]
    return (
      <group>
        {blocks.map(({ x, m }) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.9, 0.46, 0.46]} />
              <meshStandardMaterial color="#3f3a52" metalness={0.75} roughness={0.3} />
            </mesh>
            <MomentArrow dir={m} len={0.42} position={[-m[0] * 0.21, -m[1] * 0.21, 0.25]} />
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
  const fieldLines = useMemo(() => {
    const bFunc = (p) => totalBField(p, magnetType)
    return generateSeeds(magnetType).map((seed) => traceFieldLine(seed, bFunc))
  }, [magnetType])

  return (
    <group>
      <MagnetBody magnetType={magnetType} />
      <FieldSlice magnetType={magnetType} visible={showHeatmap} />
      <FieldLines key={magnetType} lines={fieldLines} visible={showFieldLines} />
      <ParticleStream key={`p-${magnetType}`} lines={fieldLines} visible={showParticles} />
    </group>
  )
}
