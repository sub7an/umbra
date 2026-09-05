import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GRID = 64
const SIZE = 8
const G2 = 32

function warpY(x, z, mass) {
  const r = Math.sqrt(x * x + z * z)
  return -mass / (r + 0.6)
}

const VERT = `
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAG = `
  varying float vH;
  void main() {
    float t = clamp(-vH * 0.45 + 0.08, 0.0, 1.0);
    vec3 c0 = vec3(0.06, 0.14, 0.32);
    vec3 c1 = vec3(0.30, 0.14, 0.04);
    vec3 c2 = vec3(0.90, 0.40, 0.05);
    vec3 col = t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
    gl_FragColor = vec4(col, 0.94);
  }
`

export default function SpacetimeCurvature({ mass }) {
  const meshRef = useRef()
  const wireRef = useRef()
  const ringRef = useRef()
  const massRef = useRef(mass)
  massRef.current = mass

  const { surfaceGeo, wireGeo } = useMemo(() => {
    const N = GRID + 1
    const posArr = new Float32Array(N * N * 3)
    const idxArr = []

    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = (iz * N + ix) * 3
        posArr[k]   = (ix / GRID - 0.5) * SIZE * 2
        posArr[k+1] = 0
        posArr[k+2] = (iz / GRID - 0.5) * SIZE * 2
      }
    }
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const a = iz * N + ix
        idxArr.push(a, a + 1, a + N, a + 1, a + N + 1, a + N)
      }
    }

    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    sg.setIndex(idxArr)

    const wireVerts = new Float32Array((G2 + 1) * 4 * 3)
    let vi = 0
    for (let i = 0; i <= G2; i++) {
      const s = (i / G2 - 0.5) * SIZE * 2
      wireVerts[vi++] = -SIZE; wireVerts[vi++] = 0; wireVerts[vi++] = s
      wireVerts[vi++] =  SIZE; wireVerts[vi++] = 0; wireVerts[vi++] = s
      wireVerts[vi++] = s;     wireVerts[vi++] = 0; wireVerts[vi++] = -SIZE
      wireVerts[vi++] = s;     wireVerts[vi++] = 0; wireVerts[vi++] =  SIZE
    }
    const wg = new THREE.BufferGeometry()
    wg.setAttribute('position', new THREE.BufferAttribute(wireVerts, 3))

    return { surfaceGeo: sg, wireGeo: wg }
  }, [])

  useFrame(() => {
    if (!meshRef.current || !wireRef.current) return
    const m = massRef.current
    const N = GRID + 1

    const sPos = meshRef.current.geometry.attributes.position
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (ix / GRID - 0.5) * SIZE * 2
        const z = (iz / GRID - 0.5) * SIZE * 2
        sPos.setY(iz * N + ix, warpY(x, z, m))
      }
    }
    sPos.needsUpdate = true

    const wPos = wireRef.current.geometry.attributes.position
    let vi = 0
    for (let i = 0; i <= G2; i++) {
      const s = (i / G2 - 0.5) * SIZE * 2
      wPos.setXYZ(vi++, -SIZE, warpY(-SIZE, s, m), s)
      wPos.setXYZ(vi++,  SIZE, warpY( SIZE, s, m), s)
      wPos.setXYZ(vi++, s, warpY(s, -SIZE, m), -SIZE)
      wPos.setXYZ(vi++, s, warpY(s,  SIZE, m),  SIZE)
    }
    wPos.needsUpdate = true

    if (ringRef.current) {
      const t = performance.now() * 0.001
      ringRef.current.rotation.y = t * 0.4
      ringRef.current.position.y = warpY(m * 0.55, 0, m) + 0.05
    }
  })

  const centerY = warpY(0, 0, mass)

  return (
    <group>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 6, 0]} intensity={2.0} color="#fb923c" />
      <pointLight position={[4, 3, 4]} intensity={0.5} color="#5e6ad2" />

      <mesh ref={meshRef} geometry={surfaceGeo} frustumCulled={false}>
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={FRAG}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>

      <lineSegments ref={wireRef} geometry={wireGeo} frustumCulled={false}>
        <lineBasicMaterial color="#5e6ad2" transparent opacity={0.22} />
      </lineSegments>

      {/* Central mass */}
      <mesh position={[0, centerY + mass * 0.22, 0]}>
        <sphereGeometry args={[mass * 0.18, 32, 32]} />
        <meshStandardMaterial
          color="#fb923c"
          emissive="#fb923c"
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      {/* Photon-sphere ring */}
      <mesh ref={ringRef} position={[0, centerY + 0.3, 0]}>
        <torusGeometry args={[mass * 0.55, 0.03, 8, 64]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
