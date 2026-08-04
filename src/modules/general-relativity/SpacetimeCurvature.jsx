import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GRID = 64
const SIZE = 8

function warpY(x, z, mass) {
  const r = Math.sqrt(x * x + z * z)
  return -mass / (r + 0.6)
}

export default function SpacetimeCurvature({ mass }) {
  const meshRef    = useRef()
  const gridRef    = useRef()
  const ringRef    = useRef()
  const timeRef    = useRef(0)

  // Build base grid positions once
  const { posArr, uvArr, idxArr, linePos } = useMemo(() => {
    const verts = (GRID + 1) * (GRID + 1)
    const posArr = new Float32Array(verts * 3)
    const uvArr  = new Float32Array(verts * 2)
    const idxArr = []

    for (let iz = 0; iz <= GRID; iz++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const i = iz * (GRID + 1) + ix
        const x = (ix / GRID - 0.5) * SIZE * 2
        const z = (iz / GRID - 0.5) * SIZE * 2
        posArr[i*3]   = x
        posArr[i*3+1] = 0
        posArr[i*3+2] = z
        uvArr[i*2]   = ix / GRID
        uvArr[i*2+1] = iz / GRID
      }
    }
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const a = iz * (GRID + 1) + ix
        const b = a + 1
        const c = a + (GRID + 1)
        const d = c + 1
        idxArr.push(a, b, c,  b, d, c)
      }
    }

    // Grid lines for wireframe overlay (32×32 coarser grid)
    const G2 = 32
    const lineVerts = []
    for (let i = 0; i <= G2; i++) {
      const t = i / G2
      lineVerts.push(-SIZE, 0, (t - 0.5) * SIZE * 2)
      lineVerts.push( SIZE, 0, (t - 0.5) * SIZE * 2)
      lineVerts.push((t - 0.5) * SIZE * 2, 0, -SIZE)
      lineVerts.push((t - 0.5) * SIZE * 2, 0,  SIZE)
    }
    const linePos = new Float32Array(lineVerts)

    return { posArr, uvArr, idxArr: new Uint32Array(idxArr), linePos }
  }, [])

  // Geometry objects (plain THREE, declarative JSX below)
  const surfaceGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.slice(), 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(uvArr,           2))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [posArr, uvArr, idxArr])

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(linePos.slice(), 3))
    return g
  }, [linePos])

  // Warp geometry every frame (mass can change)
  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    // Surface
    const pos = surfaceGeo.attributes.position.array
    for (let iz = 0; iz <= GRID; iz++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const i = iz * (GRID + 1) + ix
        const x = (ix / GRID - 0.5) * SIZE * 2
        const z = (iz / GRID - 0.5) * SIZE * 2
        pos[i*3+1] = warpY(x, z, mass)
      }
    }
    surfaceGeo.attributes.position.needsUpdate = true
    surfaceGeo.computeVertexNormals()

    // Grid lines (coarser)
    const lp = lineGeo.attributes.position.array
    const G2 = 32
    let vi = 0
    for (let i = 0; i <= G2; i++) {
      const t2 = i / G2
      const z1 = (t2 - 0.5) * SIZE * 2
      // horizontal line: varying x, fixed z
      lp[vi*3] = -SIZE; lp[vi*3+1] = warpY(-SIZE, z1, mass); lp[vi*3+2] = z1; vi++
      lp[vi*3] =  SIZE; lp[vi*3+1] = warpY( SIZE, z1, mass); lp[vi*3+2] = z1; vi++
      // vertical line: fixed x, varying z
      const x1 = (t2 - 0.5) * SIZE * 2
      lp[vi*3] = x1; lp[vi*3+1] = warpY(x1, -SIZE, mass); lp[vi*3+2] = -SIZE; vi++
      lp[vi*3] = x1; lp[vi*3+1] = warpY(x1,  SIZE, mass); lp[vi*3+2] =  SIZE; vi++
    }
    lineGeo.attributes.position.needsUpdate = true

    // Pulsing ring at photon sphere
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.4
      const rs = mass * 0.18
      ringRef.current.scale.set(1 + 0.04 * Math.sin(t * 3), 1, 1 + 0.04 * Math.sin(t * 3))
      ringRef.current.position.y = warpY(rs, 0, mass) + 0.05
    }
  })

  const surfaceMat = useMemo(() => new THREE.MeshStandardMaterial({
    color:         '#0a1f2e',
    emissive:      '#003355',
    emissiveIntensity: 0.25,
    roughness:     0.7,
    metalness:     0.3,
    side:          THREE.DoubleSide,
    wireframe:     false,
  }), [])

  const lineMat = useMemo(() => new THREE.LineBasicMaterial({
    color:       '#00e5c4',
    transparent: true,
    opacity:     0.18,
  }), [])

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       '#fb923c',
    transparent: true,
    opacity:     0.7,
    side:        THREE.DoubleSide,
  }), [])

  const centerY = warpY(0, 0, mass)

  return (
    <group>
      <ambientLight intensity={0.3} color="#0a2030" />
      <pointLight position={[0, 4, 0]} intensity={1.2} color="#fb923c" />
      <pointLight position={[3, 2, 3]} intensity={0.4} color="#00e5c4" />

      {/* Warped surface */}
      <mesh ref={meshRef} geometry={surfaceGeo} material={surfaceMat} />

      {/* Grid overlay */}
      <lineSegments ref={gridRef} geometry={lineGeo} material={lineMat} />

      {/* Central mass */}
      <mesh position={[0, centerY + mass * 0.22, 0]}>
        <sphereGeometry args={[mass * 0.18, 32, 32]} />
        <meshStandardMaterial
          color="#fb923c" emissive="#fb923c" emissiveIntensity={1.2}
          roughness={0.1} metalness={0.5}
        />
      </mesh>

      {/* Photon-sphere ring */}
      <mesh ref={ringRef} position={[0, 0, 0]}>
        <torusGeometry args={[mass * 0.55, 0.03, 8, 64]} />
        <primitive object={ringMat} />
      </mesh>
    </group>
  )
}
