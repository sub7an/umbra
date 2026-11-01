import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { coneRegion } from './srMath'
import SceneCard from '../../components/SceneCard'

// ── Lorentz-boosted frame overlay ─────────────────────────────────────────────
// Shows t' axis (moving observer's world line), x' axis (simultaneity lines),
// and a grid of simultaneous events in the primed frame.
function BoostFrame({ beta }) {
  const gamma = 1 / Math.sqrt(1 - beta * beta)
  const H = 3.2

  // t' axis: world line of moving observer → direction (β, 1) in (x, ct) space
  // x' axis: simultaneity in primed frame → direction (1, β) in (x, ct) space
  const tPrimeAxis = useMemo(() => [
    new THREE.Vector3(-H * beta, -H, 0),
    new THREE.Vector3( H * beta,  H, 0),
  ], [beta, H])

  const xPrimeAxis = useMemo(() => [
    new THREE.Vector3(-H,  -H * beta, 0),
    new THREE.Vector3( H,   H * beta, 0),
  ], [beta, H])

  // Simultaneity lines at t' = ±1, ±2 in lab coords: ct = β·x + k/γ
  const simLines = useMemo(() =>
    [-2, -1, 1, 2].map((k) => {
      const t0 = k / gamma
      return [
        new THREE.Vector3(-H, t0 + beta * (-H), 0),
        new THREE.Vector3( H, t0 + beta * H,    0),
      ]
    }), [beta, gamma, H]
  )

  // Grid lines at x' = ±1, ±2 in lab coords: ct = (1/β)·x - k/(γ·β)
  // x' = γ(x - βt) = k → x = k/γ + βt → t = (x - k/γ)/β
  const gridLines = useMemo(() => {
    if (Math.abs(beta) < 0.05) return []
    return [-2, -1, 1, 2].map((k) => {
      const x0 = k / gamma
      return [
        new THREE.Vector3(x0 + beta * (-H), -H, 0),
        new THREE.Vector3(x0 + beta *  H,    H, 0),
      ]
    })
  }, [beta, gamma, H])

  if (Math.abs(beta) < 0.02) return null

  return (
    <group>
      {/* t' axis (world line of moving observer) */}
      <Line points={tPrimeAxis} color="#e040fb" lineWidth={1.6}
        transparent opacity={0.75} dashed dashSize={0.22} gapSize={0.10} />

      {/* x' axis (simultaneity plane at t'=0 in moving frame) */}
      <Line points={xPrimeAxis} color="#e040fb" lineWidth={1.6}
        transparent opacity={0.75} dashed dashSize={0.22} gapSize={0.10} />

      {/* Simultaneity lines (ct' = const) in lab frame */}
      {simLines.map((pts, i) => (
        <Line key={i} points={pts} color="#e040fb" lineWidth={0.9}
          transparent opacity={0.20} />
      ))}

      {/* World-line grid (x' = const) in lab frame */}
      {gridLines.map((pts, i) => (
        <Line key={i} points={pts} color="#e040fb" lineWidth={0.9}
          transparent opacity={0.15} />
      ))}

    </group>
  )
}

// ── Light cone surface: fresnel-lit glass with light fronts racing outward ───
const CONE_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vView;
  varying float vY;
  void main() {
    vY = position.y;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const CONE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uT;
  uniform float uH;
  uniform float uDir;
  varying vec3 vN;
  varying vec3 vView;
  varying float vY;
  void main() {
    float y = uH * 0.5 - vY;                 // ConeGeometry apex sits at local +h/2: 0 at the apex → uH at the rim
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
    // Light fronts: expanding spheres of light, i.e. bands moving away from the apex
    float band = fract(y / uH * 3.0 - uT * 0.35);
    float front = smoothstep(0.0, 0.04, band) * (1.0 - smoothstep(0.04, 0.22, band));
    float fade = smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(uH * 0.85, uH, y));
    vec3 c = pow(uColor, vec3(2.2));
    vec3 col = c * (0.05 + rim * 0.35 + front * 0.6) * fade;
    gl_FragColor = vec4(col, 1.0);
  }
`

function ConeSurface({ height, color, dir }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 }, uH: { value: height }, uDir: { value: dir } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [color, height, dir])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((_, d) => { mat.uniforms.uT.value += Math.min(d, 0.05) * dir })
  // ConeGeometry: apex at +h/2. Future cone opens upward from the origin.
  return (
    <mesh position={[0, (dir * height) / 2, 0]} rotation={[dir > 0 ? Math.PI : 0, 0, 0]} material={mat}>
      <coneGeometry args={[height, height, 96, 24, true]} />
    </mesh>
  )
}

// ── Photons on the cone: light leaving (and arriving at) the origin event ────
const N_PHOTON = 24
function Photons({ height }) {
  const refs = useRef([])
  const phase = useRef(0)
  useFrame((_, d) => {
    phase.current = (phase.current + Math.min(d, 0.05) * 0.18) % 1
    refs.current.forEach((m, i) => {
      if (!m) return
      const past = i >= N_PHOTON / 2
      const k = i % (N_PHOTON / 2)
      const a = (k / (N_PHOTON / 2)) * Math.PI * 2 + (past ? 0.26 : 0)
      // Future: moving outward from the origin; past: converging onto it
      const p = past ? 1 - phase.current : phase.current
      const r = p * height
      m.position.set(Math.cos(a) * r, (past ? -1 : 1) * r, Math.sin(a) * r)
      m.material.opacity = Math.sin(Math.PI * p) * 0.9
    })
  })
  return Array.from({ length: N_PHOTON }, (_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)}>
      <sphereGeometry args={[0.045, 10, 10]} />
      <meshBasicMaterial color={i < N_PHOTON / 2 ? [2.4, 1.8, 0.6] : [1.2, 1.0, 2.2]} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  ))
}

// ── Invariant hyperbola through the event: every frame agrees on s² ──────────
function Hyperbola({ ex, et }) {
  const s2 = et * et - ex * ex
  const pts = useMemo(() => {
    const out = []
    const R = 3.6
    if (Math.abs(s2) < 0.02) return out
    for (let i = 0; i <= 120; i++) {
      const u = -R + (i / 120) * 2 * R
      if (s2 > 0) {
        const t = Math.sign(et) * Math.sqrt(s2 + u * u)       // timelike: ct = ±√(s² + x²)
        if (Math.abs(t) <= R) out.push([u, t, 0])
      } else {
        const x = Math.sign(ex) * Math.sqrt(-s2 + u * u)      // spacelike: x = ±√(−s² + t²)
        if (Math.abs(x) <= R) out.push([x, u, 0])
      }
    }
    return out
  }, [s2, ex, et])
  if (pts.length < 2) return null
  return <Line points={pts} color={s2 > 0 ? '#a5b4fc' : '#f0abfc'} lineWidth={1.6} transparent opacity={0.7} dashed dashSize={0.12} gapSize={0.07} />
}

// ── Animated pulse rings traveling along cone surface ────────────────────────
const RING_N = 4
function PulseRings({ height, color, dir = 1, speed = 0.14 }) {
  const refs = useRef(Array.from({ length: RING_N }, () => null))
  const phases = useRef(Array.from({ length: RING_N }, (_, i) => i / RING_N))

  const mats = useMemo(() =>
    Array.from({ length: RING_N }, () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  , [color])

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  useFrame((_, delta) => {
    for (let i = 0; i < RING_N; i++) {
      phases.current[i] = (phases.current[i] + delta * speed) % 1
      const p = phases.current[i]
      const r = p * height
      const ref = refs.current[i]
      if (!ref) continue
      ref.position.y = p * height * dir
      ref.scale.x = r || 0.001
      ref.scale.z = r || 0.001
      const fadeIn = Math.min(p * 7, 1)
      const fadeOut = Math.pow(1 - p, 1.6)
      mats[i].opacity = fadeIn * fadeOut * 0.65
    }
  })

  return (
    <>
      {Array.from({ length: RING_N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          rotation={[-Math.PI / 2, 0, 0]}
          material={mats[i]}
        >
          <ringGeometry args={[0.91, 1.0, 64]} />
        </mesh>
      ))}
    </>
  )
}

// ── Minkowski spatial slice — circle at constant t showing spatial section ───
function MinkowskiSlice({ t }) {
  const r = Math.abs(t)
  const pts = useMemo(() => {
    const arr = []
    const N = 64
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      arr.push(new THREE.Vector3(Math.cos(a) * r, t, Math.sin(a) * r))
    }
    return arr
  }, [t, r])

  return (
    <Line
      points={pts}
      color="#1a3540"
      lineWidth={1}
      transparent
      opacity={Math.max(0.08, 0.28 - Math.abs(t) * 0.04)}
    />
  )
}

// ── Wireframe cone lines (spoke + rim) ───────────────────────────────────────
function ConeLines({ apex, height, radius, color, segments = 32, opacity = 1 }) {
  const lineGroups = useMemo(() => {
    const groups = []
    const circle = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      circle.push(new THREE.Vector3(Math.cos(a) * radius, apex + height, Math.sin(a) * radius))
    }
    groups.push(circle)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      groups.push([
        new THREE.Vector3(0, apex, 0),
        new THREE.Vector3(Math.cos(a) * radius, apex + height, Math.sin(a) * radius),
      ])
    }
    return groups
  }, [apex, height, radius, segments])

  return (
    <>
      {lineGroups.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={1} transparent opacity={opacity} />
      ))}
    </>
  )
}

// ── Draggable event point ────────────────────────────────────────────────────
function EventPoint({ position, onDrag, region }) {
  const meshRef = useRef()
  const { camera, gl } = useThree()
  const isDragging = useRef(false)
  const dragPlane = useRef(new THREE.Plane())
  const intersection = useRef(new THREE.Vector3())

  const colorMap = { timelike: '#7c8cff', spacelike: '#e040fb', lightlike: '#f59e0b' }
  const color = colorMap[region] ?? '#eef0f5'

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    isDragging.current = true
    gl.domElement.style.cursor = 'grabbing'
    dragPlane.current.setFromNormalAndCoplanarPoint(camera.position.clone().normalize(), e.point)
    e.target.setPointerCapture(e.pointerId)
  }, [camera, gl])

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false
    gl.domElement.style.cursor = 'grab'
    e.target.releasePointerCapture(e.pointerId)
  }, [gl])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return
    const ray = new THREE.Raycaster()
    ray.setFromCamera(e.pointer, camera)
    if (ray.ray.intersectPlane(dragPlane.current, intersection.current)) {
      onDrag(intersection.current.x, intersection.current.y)
    }
  }, [camera, onDrag])

  useFrame(() => { if (meshRef.current) meshRef.current.rotation.y += 0.01 })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => { gl.domElement.style.cursor = 'grab' }}
      onPointerLeave={() => { gl.domElement.style.cursor = 'auto' }}
    >
      <octahedronGeometry args={[0.18, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} roughness={0.1} metalness={0.8} />
      <pointLight color={color} intensity={3.5} distance={4} />
    </mesh>
  )
}

// ── Dashed world-line from origin to event ───────────────────────────────────
function WorldLine({ ex, et }) {
  const pts = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(ex, et, 0)],
    [ex, et]
  )
  return (
    <Line
      points={pts}
      color="#4a7a74"
      lineWidth={1.5}
      transparent
      opacity={0.55}
      dashed
      dashSize={0.14}
      gapSize={0.08}
    />
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LightCone() {
  const eventX   = useModuleStore((s) => s.sr.eventX)
  const eventT   = useModuleStore((s) => s.sr.eventT)
  const velocity = useModuleStore((s) => s.sr.velocity)
  const setSrEvent = useModuleStore((s) => s.setSrEvent)

  const height = 3
  const region = coneRegion(eventX, eventT)
  const ex = Math.max(-4, Math.min(4, eventX))
  const et = Math.max(-4, Math.min(4, eventT))

  const handleDrag = useCallback((x, t) => {
    setSrEvent(Math.max(-4, Math.min(4, x)), Math.max(-4, Math.min(4, t)))
  }, [setSrEvent])

  const regionColor = { timelike: '#7c8cff', spacelike: '#e040fb', lightlike: '#f59e0b' }[region]
  // Event in the moving observer's frame (c = 1)
  const g = 1 / Math.sqrt(1 - velocity * velocity)
  const tP = g * (et - velocity * ex), xP = g * (ex - velocity * et)
  const s2 = et * et - ex * ex
  const verdict = region === 'timelike'
    ? (et > 0 ? 'In the future cone: the origin can cause it, and every observer agrees on the order.' : 'In the past cone: it can cause the origin.')
    : region === 'lightlike'
      ? 'On the cone: only a light signal links it to the origin.'
      : 'Outside the cone: no signal can connect them, and observers disagree on which came first.'

  return (
    <group>
      <ConeSurface height={height} color="#7c8cff" dir={1} />
      <ConeSurface height={height} color="#8b5cf6" dir={-1} />

      {[1, 2, 3, -1, -2, -3].map((t) => (
        <MinkowskiSlice key={t} t={t} />
      ))}

      <PulseRings height={height} color="#7c8cff" dir={1} speed={0.14} />
      <PulseRings height={height} color="#6d5bd0" dir={-1} speed={0.11} />
      <Photons height={height} />

      <ConeLines apex={0} height={height} radius={height} color="#7c8cff" opacity={0.35} />
      <ConeLines apex={0} height={-height} radius={height} color="#6d5bd0" opacity={0.25} />

      {/* Null lines x = ±ct in the x–ct plane */}
      <Line points={[[-height, -height, 0], [height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.6} />
      <Line points={[[height, -height, 0], [-height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.6} />

      {/* Lab axes */}
      <Line points={[[0, -height - 0.5, 0], [0, height + 0.5, 0]]} color="#64748b" lineWidth={1} />
      <Line points={[[-height - 0.5, 0, 0], [height + 0.5, 0, 0]]} color="#64748b" lineWidth={1} />

      {/* Origin event */}
      <mesh>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={[2.6, 1.9, 0.5]} toneMapped={false} />
      </mesh>

      <BoostFrame beta={velocity} />
      <Hyperbola ex={ex} et={et} />
      <WorldLine ex={ex} et={et} />
      <EventPoint position={[ex, et, 0]} onDrag={handleDrag} region={region} />

      <SceneCard>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: regionColor, textTransform: 'capitalize' }}>{region} event</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', margin: '2px 0 8px' }}>{verdict}</div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Interval s² = (ct)² − x²</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{s2.toFixed(2)}</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Lab (x, ct)</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{ex.toFixed(2)}, {et.toFixed(2)}</dd>
            <dt><span style={{ color: '#e040fb' }}>●</span> Moving frame (x′, ct′)</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#e040fb' }}>{xP.toFixed(2)}, {tP.toFixed(2)}</dd>
          </dl>
          <div style={{ marginTop: 8, color: 'rgb(var(--c-text-muted))', fontSize: 11, lineHeight: 1.45 }}>
            Drag the gem. Dashed hyperbola: every frame's (x′, ct′) lands on it. Pink axes: the moving observer at β = {velocity.toFixed(2)}.
          </div>
        </div>
      </SceneCard>
    </group>
  )
}
