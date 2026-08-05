import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const W = 128
const H = 128
const AMP = 0.5

// Two source positions (in grid coords)
const SRC = [
  { x: 20, y: H / 2 - 12 },
  { x: 20, y: H / 2 + 12 },
]
const LAMBDA = 18  // wavelength in grid units
const K = (2 * Math.PI) / LAMBDA

const VERT = `
  varying float vH;
  varying vec3 vNorm;
  void main() {
    vH = position.y;
    vNorm = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = `
  varying float vH;
  varying vec3 vNorm;
  void main() {
    float t = clamp(vH * 1.2 + 0.5, 0.0, 1.0);
    vec3 dark = vec3(0.01, 0.02, 0.08);
    vec3 mid  = vec3(0.04, 0.48, 0.80);
    vec3 brt  = vec3(0.70, 0.94, 1.00);
    vec3 col = t < 0.5
      ? mix(dark, mid, t * 2.0)
      : mix(mid, brt, (t - 0.5) * 2.0);
    float diff = 0.60 + 0.40 * dot(vNorm, normalize(vec3(0.3, 1.0, 0.5)));
    gl_FragColor = vec4(col * diff, 0.92);
  }
`

export default function DoubleSlit() {
  const meshRef = useRef()
  const tRef = useRef(0)

  const { geo, positions } = useMemo(() => {
    const pos = new Float32Array(W * H * 3)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3
        pos[k]     = (i / (W - 1) - 0.5) * 10
        pos[k + 1] = 0
        pos[k + 2] = (j / (H - 1) - 0.5) * 10
      }
    }
    const idxArr = new Uint32Array((W - 1) * (H - 1) * 6)
    let p = 0
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1
        idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b
        idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(idxArr, 1))
    geo.computeVertexNormals()
    return { geo, positions: pos }
  }, [])

  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.033)
    const t = tRef.current
    const omega = K * 3.5  // angular frequency

    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position

    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let u = 0
        for (const src of SRC) {
          const dx = i - src.x
          const dy = j - src.y
          const r = Math.sqrt(dx * dx + dy * dy) + 0.001
          // Attenuate with distance, animate with time
          u += (1 / (0.5 + r * 0.06)) * Math.sin(K * r - omega * t)
        }
        attr.setY(j * W + i, u * AMP * 0.5)
      }
    }
    attr.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()
  })

  // Barrier geometry: two rectangles with a gap (the slits)
  const barrierMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#334' }), [])

  const srcX = (SRC[0].x / (W - 1) - 0.5) * 10  // world x of sources

  return (
    <group>
      <ambientLight intensity={0.12} color="#06101a" />
      <directionalLight position={[5, 10, 4]} intensity={0.5} color="#7de8ff" />
      <pointLight position={[srcX, 4, 0]} intensity={1.2} color="#22d3ee" distance={18} decay={2} />

      <mesh ref={meshRef} geometry={geo}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Barrier wall */}
      <mesh position={[srcX - 0.05, 0.18, 0]} material={barrierMat}>
        <boxGeometry args={[0.08, 0.35, 10]} />
      </mesh>

      {/* Slit openings — cut by removing the wall section */}
      {SRC.map((src, i) => {
        const wz = (src.y / (H - 1) - 0.5) * 10
        return (
          <group key={i} position={[srcX, 0.5, wz]}>
            <mesh>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshBasicMaterial color="#22d3ee" />
            </mesh>
            <pointLight color="#22d3ee" intensity={0.4} distance={2.5} decay={2} />
          </group>
        )
      })}
    </group>
  )
}
