import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { blochCoordinates } from './qmMath'

// Map Bloch {x,y,z} → Three.js [x, z, y]  (Bloch z-axis → Three.js Y vertical)
function toThree(bx, by, bz) { return [bx, bz, by] }

// ── State vector trail ─────────────────────────────────────────────────────────

const TRAIL_LEN = 90
const TRAIL_DT  = 0.035  // sample every ~35 ms

function StateTrail({ dirRef }) {
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
    toneMapped:   false,
  }), [])

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (t - lastTRef.current > TRAIL_DT) {
      lastTRef.current = t
      const { x: px, y: py, z: pz } = dirRef.current
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
      colArr[i * 3] = a * 0.5; colArr[i * 3 + 1] = a * 0.6; colArr[i * 3 + 2] = a * 1.4
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
      vColor = cyan * mix(0.15, 0.7, accept * accept);
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
  uniform float uGain;   // keeps total brightness steady as the particle count changes
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.5) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.0, d) * uGain;
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
      uSize:   { value: 2.0 },
      uGain:   { value: 1.0 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }), [])  // create once

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  // Sync uniforms when inputs change (no re-create needed)
  useEffect(() => { mat.uniforms.uGain.value = Math.min(1, 2500 / particleCount) }, [mat, particleCount])

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


// ── Glass shell: fresnel rim, 30° graticule, and the state painted on it ──────

const SHELL_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const SHELL_FRAG = /* glsl */`
  uniform vec3  uState;
  uniform vec3  uU;
  uniform float uMode;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    vec3 n = normalize(vLocal);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);

    float lat = asin(clamp(n.y, -1.0, 1.0));
    float lon = atan(n.z, n.x);
    float stp = 3.14159265 / 6.0;
    float gLat = abs(fract(lat / stp + 0.5) - 0.5) * stp;
    float gLon = abs(fract(lon / stp + 0.5) - 0.5) * stp * cos(lat);
    float grid = max(1.0 - smoothstep(0.003, 0.009, gLat), 1.0 - smoothstep(0.003, 0.009, gLon));
    float equator = 1.0 - smoothstep(0.004, 0.012, abs(lat));

    vec3 cyan = lin(vec3(0.0, 0.9, 0.77)), rose = lin(vec3(0.88, 0.25, 0.98)), amber = lin(vec3(0.96, 0.62, 0.04));
    float d = dot(n, uState);
    vec3 col;
    if (uMode < 0.5) {
      // Probability of finding the qubit "along n": (1 + n·r)/2
      float p = (1.0 + d) * 0.5;
      col = cyan * pow(p, 6.0) * 0.3;
    } else if (uMode < 1.5) {
      col = d > 0.0 ? cyan * d * 0.16 : rose * (-d) * 0.16;
    } else {
      float c = dot(n, uU);
      col = c > 0.0 ? rose * c * 0.16 : amber * (-c) * 0.16;
    }
    vec3 rim = lin(vec3(0.5, 0.58, 1.0));
    col += rim * (fres * 0.3 + grid * 0.12 + equator * 0.2);
    gl_FragColor = vec4(col, 1.0);
  }
`

function GlassShell({ dirRef, uRef, vizMode }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
    uniforms: { uState: { value: new THREE.Vector3(0, 1, 0) }, uU: { value: new THREE.Vector3(1, 0, 0) }, uMode: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { mat.uniforms.uMode.value = vizMode === 'prob' ? 0 : vizMode === 'real' ? 1 : 2 }, [mat, vizMode])
  useFrame(() => {
    mat.uniforms.uState.value.copy(dirRef.current)
    mat.uniforms.uU.value.copy(uRef.current)
  })
  return (
    <mesh material={mat}>
      <sphereGeometry args={[1, 96, 64]} />
    </mesh>
  )
}

// ── State vector with its construction: latitude ring, drop line, φ arc ───────

const UP = new THREE.Vector3(0, 1, 0)
const RING_N = 96
const ARC_N = 48

function StateVector({ dirRef }) {
  const arrow = useRef()
  const tip   = useRef()
  const ring  = useRef()
  const guideLine = useRef()

  const guides = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3))
    return g
  }, [])
  const ringGeo = useMemo(() => {
    const pts = []
    for (let i = 0; i < RING_N; i++) { const a = (i / RING_N) * Math.PI * 2; pts.push(Math.cos(a), 0, Math.sin(a)) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const arcGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3))
    return g
  }, [])
  useEffect(() => () => { guides.dispose(); ringGeo.dispose(); arcGeo.dispose() }, [guides, ringGeo, arcGeo])

  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    const d = dirRef.current
    if (arrow.current) {
      if (d.dot(UP) < -0.9999) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
      else q.setFromUnitVectors(UP, d)
      arrow.current.quaternion.copy(q)
    }
    if (tip.current) tip.current.position.copy(d)
    // Circle of constant θ through the tip
    if (ring.current) {
      const r = Math.sqrt(Math.max(0, 1 - d.y * d.y))
      ring.current.position.y = d.y
      ring.current.scale.set(Math.max(r, 1e-3), 1, Math.max(r, 1e-3))
    }
    // Drop line tip → equatorial plane → origin
    const p = guides.attributes.position.array
    p.set([d.x, d.y, d.z, d.x, 0, d.z, 0, 0, 0, d.x, 0, d.z])
    guides.attributes.position.needsUpdate = true
    guideLine.current?.computeLineDistances()
    // Azimuth arc from +x toward the state's φ
    let phi = Math.atan2(d.z, d.x); if (phi < 0) phi += Math.PI * 2
    const rr = 0.32, a = arcGeo.attributes.position.array
    for (let i = 0; i < ARC_N; i++) { const t = (i / (ARC_N - 1)) * phi; a[i * 3] = rr * Math.cos(t); a[i * 3 + 1] = 0; a[i * 3 + 2] = rr * Math.sin(t) }
    arcGeo.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <group ref={arrow}>
        <mesh position={[0, 0.43, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.86, 16]} />
          <meshStandardMaterial color="#9aa6ff" emissive="#7c8cff" emissiveIntensity={1.4} metalness={0.3} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <coneGeometry args={[0.055, 0.16, 24]} />
          <meshStandardMaterial color="#c7ceff" emissive="#7c8cff" emissiveIntensity={1.8} metalness={0.3} roughness={0.25} />
        </mesh>
      </group>
      <group ref={tip}>
        <mesh>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={[2.4, 2.5, 3.2]} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#8b9cff" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <lineLoop ref={ring} geometry={ringGeo}>
        <lineBasicMaterial color="#8b9cff" transparent opacity={0.45} toneMapped={false} />
      </lineLoop>
      <lineSegments ref={guideLine} geometry={guides}>
        <lineDashedMaterial color="#cbd5e1" transparent opacity={0.35} dashSize={0.04} gapSize={0.03} />
      </lineSegments>
      <line geometry={arcGeo}>
        <lineBasicMaterial color="#f59e0b" transparent opacity={0.8} toneMapped={false} />
      </line>
    </group>
  )
}

// ── Basis-state markers on the sphere (|0⟩, |1⟩ blue; |±⟩ amber; |±i⟩ violet) ─

const MARKERS = [
  [[0, 1, 0], '#7c8cff'], [[0, -1, 0], '#7c8cff'],
  [[1, 0, 0], '#f59e0b'], [[-1, 0, 0], '#f59e0b'],
  [[0, 0, 1], '#e040fb'], [[0, 0, -1], '#e040fb'],
]

function BasisMarkers() {
  return (
    <>
      {MARKERS.map(([p, c], i) => (
        <group key={i} position={p}>
          <mesh>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color={c} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Line points={[[0, -1.35, 0], [0, 1.35, 0]]} color="#7c8cff" lineWidth={1} transparent opacity={0.4} />
      <Line points={[[-1.35, 0, 0], [1.35, 0, 0]]} color="#f59e0b" lineWidth={1} transparent opacity={0.3} />
      <Line points={[[0, 0, -1.35], [0, 0, 1.35]]} color="#e040fb" lineWidth={1} transparent opacity={0.3} />
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlochSphere() {
  const theta   = useModuleStore((s) => s.qm.blochTheta)
  const phi     = useModuleStore((s) => s.qm.blochPhi)
  const vizMode = useModuleStore((s) => s.qm.blochVizMode)

  const bloch  = blochCoordinates(theta, phi)
  const target = useMemo(() => new THREE.Vector3(...toThree(bloch.x, bloch.y, bloch.z)).normalize(), [bloch.x, bloch.y, bloch.z])

  // Displayed direction rotates smoothly toward the target, so gates sweep
  // the state across the sphere instead of jumping
  const dirRef = useRef(target.clone())
  const uRef   = useRef(new THREE.Vector3(1, 0, 0))
  const qStep  = useMemo(() => new THREE.Quaternion(), [])
  const qId    = useMemo(() => new THREE.Quaternion(), [])
  useFrame((_, delta) => {
    const d = dirRef.current
    if (d.angleTo(target) > 1e-4) {
      qStep.setFromUnitVectors(d, target)
      qId.identity().slerp(qStep, 1 - Math.exp(-Math.min(delta, 0.1) * 5))
      d.applyQuaternion(qId).normalize()
    } else d.copy(target)
    const [ux, uy, uz] = blochU(d.x, d.y, d.z)
    uRef.current.set(ux, uy, uz)
  })

  return (
    <group>
      <GlassShell dirRef={dirRef} uRef={uRef} vizMode={vizMode} />
      <SphereCloud theta={theta} phi={phi} vizMode={vizMode} />
      <StateTrail dirRef={dirRef} />
      <BasisMarkers />
      <StateVector dirRef={dirRef} />
    </group>
  )
}
