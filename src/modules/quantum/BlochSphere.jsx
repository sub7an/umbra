import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { blochCoordinates } from './qmMath'

// Map Bloch {x,y,z} → Three.js [x, z, y]  (Bloch z-axis → Three.js Y vertical)
function toThree(bx, by, bz) { return [bx, bz, by] }

// ── State vector trail ─────────────────────────────────────────────────────────

const TRAIL_LEN = 60
const TRAIL_DT  = 0.035  // sample every ~35 ms

function StateTrail({ thetaRef, phiRef }) {
  const samplesRef  = useRef([])
  const lastTRef    = useRef(-1)
  const posArr      = useMemo(() => new Float32Array(TRAIL_LEN * 3), [])
  const colArr      = useMemo(() => new Float32Array(TRAIL_LEN * 3), [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colArr,  3))
    g.setDrawRange(0, 0)
    return g
  }, [posArr, colArr])

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent:  true,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
  }), [])

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (t - lastTRef.current > TRAIL_DT) {
      lastTRef.current = t
      const theta = thetaRef.current
      const phi   = phiRef.current
      const bx = Math.sin(theta) * Math.cos(phi)
      const by = Math.sin(theta) * Math.sin(phi)
      const bz = Math.cos(theta)
      // Convert to Three.js space (same as toThree): [bx, bz, by]
      const px = bx, py = bz, pz = by
      const last = samplesRef.current[samplesRef.current.length - 1]
      const moved = !last || (Math.abs(last[0] - px) + Math.abs(last[1] - py) + Math.abs(last[2] - pz)) > 0.003
      if (moved) {
        samplesRef.current.push([px, py, pz])
        if (samplesRef.current.length > TRAIL_LEN) samplesRef.current.shift()
      }
    }

    const samples = samplesRef.current
    const n       = samples.length
    for (let i = 0; i < n; i++) {
      const [x, y, z] = samples[i]
      posArr[i * 3]     = x; posArr[i * 3 + 1] = y; posArr[i * 3 + 2] = z
      const a = i / (TRAIL_LEN - 1)
      colArr[i * 3] = 0; colArr[i * 3 + 1] = a * 0.85; colArr[i * 3 + 2] = a * 0.72
    }
    geo.setDrawRange(0, Math.max(n, 0))
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate    = true
  })

  return <line geometry={geo} material={mat} />
}

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  uniform float uMode;
  uniform vec3  uBloch;  // r̂ in Three.js space
  uniform vec3  uBlochU; // perpendicular direction for Im mode
  uniform float uSize;
  varying vec3  vColor;
  varying float vAlpha;

  // Deterministic hash ∈ [0, 1] based on position — avoids gl_VertexID
  float hash(vec3 p) {
    vec3 q = fract(p * vec3(443.8975, 397.2973, 491.1871));
    q += dot(q, q.yxz + 19.19);
    return fract((q.x + q.y) * q.z);
  }

  void main() {
    vec3 cyan  = vec3(0.0,   0.898, 0.769);
    vec3 amber = vec3(0.961, 0.624, 0.043);
    vec3 rose  = vec3(0.878, 0.251, 0.984);

    vec3  n3     = normalize(position);  // unit direction on sphere
    float dotVal = dot(n3, uBloch);      // ranges [-1, 1]
    float h      = hash(position);       // deterministic "random" ∈ [0, 1]

    if (uMode < 0.5) {
      // |ψ|² — Husimi Q-function: accept prob = (1 + dot) / 2
      float accept = (1.0 + dotVal) * 0.5;
      vAlpha = (h < accept) ? 1.0 : 0.0;
      // Brightness scales with local density (brighter near state direction)
      vColor = cyan * mix(0.4, 1.0, accept);
    } else if (uMode < 1.5) {
      // Re(ψ) — overlap with state: cyan=+, rose=−
      vAlpha = 1.0;
      float v = dotVal;
      vColor  = v > 0.0 ? cyan * v : rose * (-v);
    } else {
      // Im(ψ) — component along u ⊥ r̂ (azimuthal twist): rose=+, amber=−
      float compU = dot(n3, uBlochU);
      vAlpha = 1.0;
      vColor = compU > 0.0 ? rose * compU : amber * (-compU);
    }

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
    gl_Position  = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.5) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a);
  }
`

// ── Uniform sphere sample (CPU once, shader does the rest) ─────────────────────

// Uniform distribution on sphere surface: φ random, cos(θ) uniform in [-1,1]
function uniformSpherePts(count) {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const cosTheta = 2 * Math.random() - 1       // uniform in [-1,1]
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
    const phi      = Math.random() * 2 * Math.PI
    pos[i * 3]     = sinTheta * Math.cos(phi)
    pos[i * 3 + 1] = sinTheta * Math.sin(phi)
    pos[i * 3 + 2] = cosTheta
  }
  return pos
}

// ── Derive perpendicular direction u ⊥ r̂ for Im mode ─────────────────────────

function blochU(rx, ry, rz) {
  // u = normalize(r × ŷ);  if r ≈ ±ŷ use r × x̂
  // Three.js Y = [0,1,0]
  // r × [0,1,0] = (ry·0-rz·1, rz·0-rx·0, rx·1-ry·0) = (-rz, 0, rx)
  let ux = -rz, uy = 0, uz = rx
  let len = Math.sqrt(ux * ux + uy * uy + uz * uz)
  if (len < 0.01) {
    // r ≈ ±ŷ → use r × x̂ = (0·0-rz·0, rz·1-rx·0, rx·0-0·1) = (0, rz, 0)
    // Wait: r × [1,0,0] = (ry·0-rz·0, rz·1-rx·0, rx·0-ry·1) = (0, rz, -ry)
    ux = 0; uy = rz; uz = -ry
    len = Math.sqrt(ux * ux + uy * uy + uz * uz)
  }
  return [ux / len, uy / len, uz / len]
}

// ── Point cloud component ──────────────────────────────────────────────────────

function SphereCloud({ theta, phi, vizMode }) {
  const particleCount = useModuleStore((s) => s.qm.particleCount)
  const matRef = useRef()

  // Positions: uniform on sphere, recompute only when count changes
  const positions = useMemo(() => uniformSpherePts(particleCount), [particleCount])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  // Bloch vector in Three.js space: (bx, bz, by)
  const bloch = blochCoordinates(theta, phi)
  const [rx, ry, rz] = toThree(bloch.x, bloch.y, bloch.z)
  const [ux, uy, uz] = blochU(rx, ry, rz)

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMode:   { value: 0.0 },
      uBloch:  { value: new THREE.Vector3(rx, ry, rz) },
      uBlochU: { value: new THREE.Vector3(ux, uy, uz) },
      uSize:   { value: 2.2 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }), [])  // create once

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  // Sync uniforms when inputs change (no re-create needed)
  useEffect(() => {
    if (!mat) return
    mat.uniforms.uMode.value = vizMode === 'prob' ? 0.0 : vizMode === 'real' ? 1.0 : 2.0
  }, [vizMode, mat])

  useEffect(() => {
    if (!mat) return
    mat.uniforms.uBloch.value.set(rx, ry, rz)
    mat.uniforms.uBlochU.value.set(ux, uy, uz)
  }, [rx, ry, rz, ux, uy, uz, mat])

  return <points ref={matRef} geometry={geo} material={mat} />
}

// ── Supporting geometry ────────────────────────────────────────────────────────

function greatCirclePoints(n = 64, transform) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push(transform(t))
  }
  return pts
}

function GreatCircles() {
  const equator    = useMemo(() => greatCirclePoints(64, (t) => [Math.cos(t), 0, Math.sin(t)]), [])
  const meridianXY = useMemo(() => greatCirclePoints(64, (t) => [Math.cos(t), Math.sin(t), 0]), [])
  const meridianYZ = useMemo(() => greatCirclePoints(64, (t) => [0, Math.cos(t), Math.sin(t)]), [])
  const style = { color: '#1a3d50', lineWidth: 1, transparent: true, opacity: 0.55 }
  return (
    <>
      <Line points={equator}    {...style} />
      <Line points={meridianXY} {...style} />
      <Line points={meridianYZ} {...style} />
    </>
  )
}

function StateArrow({ vecPos }) {
  const dir = useMemo(() => new THREE.Vector3(...vecPos).normalize(), [vecPos])
  const len = Math.sqrt(vecPos[0] ** 2 + vecPos[1] ** 2 + vecPos[2] ** 2)

  const quaternion = useMemo(() => {
    const q  = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    if (Math.abs(dir.dot(up) + 1) < 0.001) {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    } else {
      q.setFromUnitVectors(up, dir)
    }
    return q
  }, [dir])

  const tipPos = [dir.x * (len - 0.12), dir.y * (len - 0.12), dir.z * (len - 0.12)]

  return (
    <group>
      <Line points={[[0, 0, 0], vecPos]} color="#b44dff" lineWidth={3} />
      <mesh position={tipPos} quaternion={quaternion}>
        <coneGeometry args={[0.055, 0.18, 10]} />
        <meshStandardMaterial color="#b44dff" emissive="#b44dff" emissiveIntensity={1.2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#b44dff" emissive="#b44dff" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

const LABEL_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.04em',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlochSphere() {
  const theta   = useModuleStore((s) => s.qm.blochTheta)
  const phi     = useModuleStore((s) => s.qm.blochPhi)
  const vizMode = useModuleStore((s) => s.qm.blochVizMode)

  const bloch  = blochCoordinates(theta, phi)
  const vecPos = toThree(bloch.x, bloch.y, bloch.z)

  // Refs so trail useFrame always reads the latest theta/phi without stale closure
  const thetaRef = useRef(theta)
  const phiRef   = useRef(phi)
  thetaRef.current = theta
  phiRef.current   = phi

  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.06
  })

  return (
    <group ref={groupRef}>
      {/* Ghost sphere shell */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#0c2530"
          emissive="#002a38"
          emissiveIntensity={0.12}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Monte Carlo particle cloud (shader-driven, all modes) */}
      <SphereCloud theta={theta} phi={phi} vizMode={vizMode} />

      {/* State vector trail — glowing arc tracing the state's history on the sphere */}
      <StateTrail thetaRef={thetaRef} phiRef={phiRef} />

      {/* Great circles */}
      <GreatCircles />

      {/* Axes */}
      <Line points={[[0, -1.45, 0], [0, 1.45, 0]]} color="#b44dff" lineWidth={1} transparent opacity={0.45} />
      <Line points={[[-1.45, 0, 0], [1.45, 0, 0]]} color="#f59e0b" lineWidth={1} transparent opacity={0.35} />
      <Line points={[[0, 0, -1.45], [0, 0, 1.45]]} color="#e040fb" lineWidth={1} transparent opacity={0.35} />

      {/* State vector */}
      <StateArrow vecPos={vecPos} />

      {/* Pole and equator labels */}
      <Html position={[0, 1.55, 0]}    center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#b44dff', textShadow: '0 0 8px rgba(180,77,255,0.7)' }}>|0⟩</span>
      </Html>
      <Html position={[0, -1.55, 0]}   center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#b44dff', textShadow: '0 0 8px rgba(180,77,255,0.7)' }}>|1⟩</span>
      </Html>
      <Html position={[1.55, 0, 0]}    center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#f59e0b', textShadow: '0 0 6px rgba(245,158,11,0.5)' }}>|+⟩</span>
      </Html>
      <Html position={[-1.55, 0, 0]}   center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#f59e0b', textShadow: '0 0 6px rgba(245,158,11,0.5)' }}>|−⟩</span>
      </Html>
      <Html position={[0, 0, 1.55]}    center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#e040fb', textShadow: '0 0 6px rgba(224,64,251,0.5)' }}>|+i⟩</span>
      </Html>

      {/* State label near arrow tip */}
      <Html
        position={[vecPos[0] * 1.35, vecPos[1] * 1.35 + 0.12, vecPos[2] * 1.35]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#ede9ff',
          background: 'rgba(7,11,13,0.82)',
          padding: '2px 5px',
          borderRadius: 3,
          border: '1px solid rgba(180,77,255,0.2)',
          whiteSpace: 'nowrap',
        }}>
          θ={theta.toFixed(2)} φ={phi.toFixed(2)}
        </div>
      </Html>

      <pointLight position={vecPos} color="#b44dff" intensity={0.4} distance={2} />
    </group>
  )
}
