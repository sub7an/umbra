import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { coneRegion } from './srMath'

// ── Solid translucent cone mesh (depth/volume cue) ────────────────────────────
function SolidCone({ posY, rotX, h, color, opacity }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color, opacity])

  useEffect(() => () => mat.dispose(), [mat])

  return (
    <mesh position={[0, posY, 0]} rotation={[rotX, 0, 0]} material={mat}>
      <coneGeometry args={[h, h, 64, 1, true]} />
    </mesh>
  )
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

  const colorMap = { timelike: '#00e5c4', spacelike: '#e040fb', lightlike: '#f59e0b' }
  const color = colorMap[region] ?? '#dff2ed'

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
  const eventX = useModuleStore((s) => s.sr.eventX)
  const eventT = useModuleStore((s) => s.sr.eventT)
  const setSrEvent = useModuleStore((s) => s.setSrEvent)

  const height = 3
  const region = coneRegion(eventX, eventT)
  const ex = Math.max(-4, Math.min(4, eventX))
  const et = Math.max(-4, Math.min(4, eventT))

  const handleDrag = useCallback((x, t) => {
    setSrEvent(Math.max(-4, Math.min(4, x)), Math.max(-4, Math.min(4, t)))
  }, [setSrEvent])

  const regionColor = { timelike: '#00e5c4', spacelike: '#e040fb', lightlike: '#f59e0b' }[region]

  return (
    <group>
      {/* ── Solid transparent cone volumes ── */}
      {/* Future cone: ConeGeometry apex at +h/2 local → flip with rotX=PI + position at h/2 */}
      <SolidCone posY={height / 2} rotX={Math.PI} h={height} color="#00e5c4" opacity={0.06} />
      {/* Past cone: apex at +h/2 local → position at -h/2 gives apex at origin */}
      <SolidCone posY={-height / 2} rotX={0} h={height} color="#007a6a" opacity={0.04} />

      {/* ── Minkowski spatial slices (time cross-sections) ── */}
      {[1, 2, 3, -1, -2, -3].map((t) => (
        <MinkowskiSlice key={t} t={t} />
      ))}

      {/* ── Light pulse rings traveling along cone surface ── */}
      <PulseRings height={height} color="#00e5c4" dir={1} speed={0.14} />
      <PulseRings height={height} color="#007a6a" dir={-1} speed={0.11} />

      {/* ── Wireframe cone lines ── */}
      <ConeLines apex={0} height={height} radius={height} color="#00e5c4" opacity={0.6} />
      <ConeLines apex={0} height={-height} radius={height} color="#007a6a" opacity={0.35} />

      {/* ── Null geodesics (x = ±ct) ── */}
      <Line points={[[-height, -height, 0], [height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.55} />
      <Line points={[[height, -height, 0], [-height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.55} />

      {/* ── Spacetime axes ── */}
      <Line points={[[0, -height - 0.5, 0], [0, height + 0.5, 0]]} color="#4a7a74" lineWidth={1} />
      <Line points={[[-height - 0.5, 0, 0], [height + 0.5, 0, 0]]} color="#4a7a74" lineWidth={1} />

      {/* ── Axis labels ── */}
      <Html position={[0, height + 1, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#4a7a74', whiteSpace: 'nowrap' }}>ct</span>
      </Html>
      <Html position={[height + 1, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#4a7a74', whiteSpace: 'nowrap' }}>x</span>
      </Html>
      <Html position={[0, 2.4, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 10, color: '#00b89e', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>FUTURE</span>
      </Html>
      <Html position={[0, -2.4, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 10, color: '#007a6a', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>PAST</span>
      </Html>

      {/* ── Origin event ── */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0, 0, 0]} color="#f59e0b" intensity={1.0} distance={2.5} />

      {/* ── World-line from origin to event ── */}
      <WorldLine ex={ex} et={et} />

      {/* ── Draggable event ── */}
      <EventPoint position={[ex, et, 0]} onDrag={handleDrag} region={region} />

      {/* ── Region label ── */}
      <Html position={[ex + 0.25, et + 0.35, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{
          fontFamily: 'Chakra Petch,sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: regionColor,
          textShadow: `0 0 8px ${regionColor}`,
          letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
        }}>
          {region.toUpperCase()}
        </span>
      </Html>
    </group>
  )
}
