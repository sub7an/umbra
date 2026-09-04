import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GRID = 80
const SIZE = 10

const VERT = `
  varying float vH;
  void main() { vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`
const FRAG = `
  varying float vH;
  void main() {
    float t = clamp(vH * 4.0 + 0.5, 0.0, 1.0);
    vec3 neg  = vec3(0.18, 0.02, 0.32);
    vec3 zero = vec3(0.02, 0.04, 0.10);
    vec3 pos  = vec3(0.38, 0.12, 0.62);
    vec3 col = t < 0.5 ? mix(neg, zero, t * 2.0) : mix(zero, pos, (t - 0.5) * 2.0);
    gl_FragColor = vec4(col, 0.90);
  }
`

export default function GravitationalWaves({ mass }) {
  const timeRef  = useRef(0)
  const body1Ref = useRef()
  const body2Ref = useRef()
  const surfGeo  = useRef()
  const lineGeo  = useRef()

  const { posArr, idxArr, linePos } = useMemo(() => {
    const verts  = (GRID + 1) * (GRID + 1)
    const posArr = new Float32Array(verts * 3)
    const idxArr = []

    for (let iz = 0; iz <= GRID; iz++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const i = iz * (GRID + 1) + ix
        posArr[i*3]   = (ix / GRID - 0.5) * SIZE * 2
        posArr[i*3+1] = 0
        posArr[i*3+2] = (iz / GRID - 0.5) * SIZE * 2
      }
    }
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const a = iz*(GRID+1)+ix, b=a+1, c=a+(GRID+1), d=c+1
        idxArr.push(a,b,c,b,d,c)
      }
    }

    const G2 = 40
    const lv = []
    for (let i = 0; i <= G2; i++) {
      const t = (i/G2 - 0.5) * SIZE * 2
      lv.push(-SIZE, 0, t,  SIZE, 0, t,  t, 0, -SIZE,  t, 0, SIZE)
    }
    const linePos = new Float32Array(lv)

    return { posArr, idxArr: new Uint32Array(idxArr), linePos }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.slice(), 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    surfGeo.current = g
    return g
  }, [posArr, idxArr])

  const lgeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(linePos.slice(), 3))
    lineGeo.current = g
    return g
  }, [linePos])

  useFrame((_, delta) => {
    timeRef.current += delta * (0.6 + mass * 0.15)
    const t  = timeRef.current
    const f  = 1.2 + mass * 0.3   // orbital frequency
    const R  = 1.2                 // orbital radius

    // Binary positions
    const x1 = R * Math.cos(f * t),   z1 = R * Math.sin(f * t)
    const x2 = R * Math.cos(f * t + Math.PI), z2 = R * Math.sin(f * t + Math.PI)

    if (body1Ref.current) body1Ref.current.position.set(x1, 0.15, z1)
    if (body2Ref.current) body2Ref.current.position.set(x2, 0.15, z2)

    // Wave surface — h₊ polarization from binary
    const sg = surfGeo.current
    if (!sg) return
    const pos = sg.attributes.position.array
    const amp = mass * 0.08

    for (let iz = 0; iz <= GRID; iz++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const i = iz*(GRID+1)+ix
        const x = (ix/GRID - 0.5) * SIZE * 2
        const z = (iz/GRID - 0.5) * SIZE * 2
        const r = Math.sqrt(x*x + z*z) + 0.01
        const wave = amp * Math.sin(2*f*(t - r/3)) / Math.max(r * 0.25, 1)
        // h+ polarization modulates x² - z² strain
        const hplus = wave * (x*x - z*z) / (r*r + 1)
        pos[i*3+1] = hplus
      }
    }
    sg.attributes.position.needsUpdate = true

    // Grid lines
    const lg = lineGeo.current
    if (!lg) return
    const lp = lg.attributes.position.array
    const G2 = 40
    let vi = 0
    const warpAt = (x, z) => {
      const r = Math.sqrt(x*x + z*z) + 0.01
      const w = amp * Math.sin(2*f*(t - r/3)) / Math.max(r*0.25, 1)
      return w * (x*x - z*z) / (r*r + 1)
    }
    for (let i = 0; i <= G2; i++) {
      const tc = (i/G2 - 0.5) * SIZE * 2
      lp[vi*3]=-SIZE; lp[vi*3+1]=warpAt(-SIZE,tc); lp[vi*3+2]=tc; vi++
      lp[vi*3]= SIZE; lp[vi*3+1]=warpAt( SIZE,tc); lp[vi*3+2]=tc; vi++
      lp[vi*3]=tc;    lp[vi*3+1]=warpAt(tc,-SIZE);  lp[vi*3+2]=-SIZE; vi++
      lp[vi*3]=tc;    lp[vi*3+1]=warpAt(tc, SIZE);  lp[vi*3+2]= SIZE; vi++
    }
    lg.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <ambientLight intensity={0.2} color="#0a1020" />
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#a855f7" />
      <pointLight position={[4, 3, 4]} intensity={0.4} color="#f59e0b" />

      {/* Wave surface */}
      <mesh geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Grid overlay */}
      <lineSegments geometry={lgeo}>
        <lineBasicMaterial color="#a855f7" transparent opacity={0.2} />
      </lineSegments>

      {/* Binary bodies */}
      <mesh ref={body1Ref}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={2} />
      </mesh>
      <mesh ref={body2Ref}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
