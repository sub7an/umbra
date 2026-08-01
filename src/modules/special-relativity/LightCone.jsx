import { useRef, useMemo, useCallback, Suspense } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { coneRegion } from './srMath'

// Wireframe cone built from line segments
function ConeLines({ apex, height, radius, color, segments = 32, opacity = 1 }) {
  const lineGroups = useMemo(() => {
    const groups = []
    // Base circle
    const circle = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      circle.push(new THREE.Vector3(Math.cos(a) * radius, apex + height, Math.sin(a) * radius))
    }
    groups.push(circle)
    // Spokes from apex to base rim
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

// Draggable event point (octahedron)
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
    dragPlane.current.setFromNormalAndCoplanarPoint(
      camera.position.clone().normalize(),
      e.point
    )
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
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0.1} metalness={0.8} />
      <pointLight color={color} intensity={2} distance={3} />
    </mesh>
  )
}

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
      {/* Future light cone */}
      <ConeLines apex={0} height={height} radius={height} color="#00e5c4" opacity={0.6} />
      {/* Past light cone */}
      <ConeLines apex={0} height={-height} radius={height} color="#007a6a" opacity={0.4} />

      {/* Light-speed diagonals (x = ±t) */}
      <Line points={[[-height, -height, 0], [height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.5} />
      <Line points={[[height, -height, 0], [-height, height, 0]]} color="#f59e0b" lineWidth={1.5} transparent opacity={0.5} />

      {/* Spacetime axes */}
      <Line points={[[0, -height - 0.5, 0], [0, height + 0.5, 0]]} color="#4a7a74" lineWidth={1} />
      <Line points={[[-height - 0.5, 0, 0], [height + 0.5, 0, 0]]} color="#4a7a74" lineWidth={1} />

      {/* Axis HTML labels */}
      <Html position={[0, height + 1, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#4a7a74', whiteSpace: 'nowrap' }}>t</span>
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

      {/* Origin dot */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} />
      </mesh>

      {/* Draggable event */}
      <EventPoint position={[ex, et, 0]} onDrag={handleDrag} region={region} />

      {/* Region label near event */}
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
