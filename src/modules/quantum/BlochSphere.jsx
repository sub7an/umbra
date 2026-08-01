import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { blochCoordinates } from './qmMath'

// Bloch coords {x,y,z} → Three.js [x, z, y]
// Maps the Bloch z-axis (|0⟩/|1⟩) to Three.js Y (vertical)
function toThree(bx, by, bz) {
  return [bx, bz, by]
}

function greatCirclePoints(n = 64, transform) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push(transform(t))
  }
  return pts
}

function GreatCircles() {
  const equator = useMemo(() =>
    greatCirclePoints(64, (t) => [Math.cos(t), 0, Math.sin(t)]), [])
  const meridianXY = useMemo(() =>
    greatCirclePoints(64, (t) => [Math.cos(t), Math.sin(t), 0]), [])
  const meridianYZ = useMemo(() =>
    greatCirclePoints(64, (t) => [0, Math.cos(t), Math.sin(t)]), [])

  const style = { color: '#1e4a60', lineWidth: 1, transparent: true, opacity: 0.7 }
  return (
    <>
      <Line points={equator} {...style} />
      <Line points={meridianXY} {...style} />
      <Line points={meridianYZ} {...style} />
    </>
  )
}

function Axis({ start, end, color, opacity = 0.5 }) {
  return (
    <Line
      points={[start, end]}
      color={color}
      lineWidth={1}
      transparent
      opacity={opacity}
    />
  )
}

function StateArrow({ vecPos }) {
  const dir = useMemo(() => new THREE.Vector3(...vecPos).normalize(), [vecPos])
  const len = Math.sqrt(vecPos[0] ** 2 + vecPos[1] ** 2 + vecPos[2] ** 2)

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
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
      <Line
        points={[[0, 0, 0], vecPos]}
        color="#00e5c4"
        lineWidth={3}
      />
      <mesh position={tipPos} quaternion={quaternion}>
        <coneGeometry args={[0.055, 0.18, 10]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={1.2} />
      </mesh>
      {/* Origin dot */}
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={1} />
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

export default function BlochSphere() {
  const theta = useModuleStore((s) => s.qm.blochTheta)
  const phi = useModuleStore((s) => s.qm.blochPhi)

  const bloch = blochCoordinates(theta, phi)
  const vecPos = toThree(bloch.x, bloch.y, bloch.z)

  // Slow auto-rotate the whole group for depth perception
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.06
    }
  })

  return (
    <group ref={groupRef}>
      {/* Sphere body */}
      <mesh>
        <sphereGeometry args={[1, 40, 40]} />
        <meshStandardMaterial
          color="#0c2530"
          emissive="#003a4a"
          emissiveIntensity={0.15}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Great circles */}
      <GreatCircles />

      {/* Axes */}
      <Axis start={[0, -1.45, 0]} end={[0, 1.45, 0]} color="#00e5c4" opacity={0.55} />
      <Axis start={[-1.45, 0, 0]} end={[1.45, 0, 0]} color="#f59e0b" opacity={0.45} />
      <Axis start={[0, 0, -1.45]} end={[0, 0, 1.45]} color="#e040fb" opacity={0.45} />

      {/* State vector */}
      <StateArrow vecPos={vecPos} />

      {/* Pole and equator labels */}
      <Html position={[0, 1.55, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#00e5c4', textShadow: '0 0 8px rgba(0,229,196,0.7)' }}>
          |0⟩
        </span>
      </Html>
      <Html position={[0, -1.55, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#00e5c4', textShadow: '0 0 8px rgba(0,229,196,0.7)' }}>
          |1⟩
        </span>
      </Html>
      <Html position={[1.55, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#f59e0b', textShadow: '0 0 6px rgba(245,158,11,0.5)' }}>
          |+⟩
        </span>
      </Html>
      <Html position={[-1.55, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#f59e0b', textShadow: '0 0 6px rgba(245,158,11,0.5)' }}>
          |−⟩
        </span>
      </Html>
      <Html position={[0, 0, 1.55]} center style={{ pointerEvents: 'none' }}>
        <span style={{ ...LABEL_STYLE, color: '#e040fb', textShadow: '0 0 6px rgba(224,64,251,0.5)' }}>
          |+i⟩
        </span>
      </Html>

      {/* State label near tip */}
      <Html
        position={[vecPos[0] * 1.35, vecPos[1] * 1.35 + 0.12, vecPos[2] * 1.35]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#dff2ed',
          background: 'rgba(7,11,13,0.75)',
          padding: '2px 5px',
          borderRadius: 3,
          border: '1px solid rgba(0,229,196,0.2)',
          whiteSpace: 'nowrap',
        }}>
          θ={theta.toFixed(2)} φ={phi.toFixed(2)}
        </div>
      </Html>

      {/* Point light that follows the state */}
      <pointLight
        position={vecPos}
        color="#00e5c4"
        intensity={0.5}
        distance={2}
      />
    </group>
  )
}
