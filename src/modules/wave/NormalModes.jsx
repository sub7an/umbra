import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const W = 96
const H = 96
const AMP = 0.55

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
    vec3 low  = vec3(0.38, 0.04, 0.60);
    vec3 zero = vec3(0.02, 0.06, 0.14);
    vec3 high = vec3(0.05, 0.85, 0.95);
    vec3 col = t < 0.5
      ? mix(low, zero, t * 2.0)
      : mix(zero, high, (t - 0.5) * 2.0);
    float diff = 0.5 + 0.5 * dot(vNorm, normalize(vec3(0.4, 1.0, 0.5)));
    gl_FragColor = vec4(col * diff, 0.96);
  }
`

export const MODES = [
  [1, 1], [1, 2], [2, 1],
  [2, 2], [1, 3], [3, 1],
  [2, 3], [3, 2], [3, 3],
]

export default function NormalModes({ modeIdx = 0 }) {
  const meshRef = useRef()
  const tRef = useRef(0)
  const modeRef = useRef(modeIdx)
  modeRef.current = modeIdx

  const geo = useMemo(() => {
    const pos = new Float32Array(W * H * 3)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3
        pos[k]     = (i / (W - 1) - 0.5) * 9
        pos[k + 1] = 0
        pos[k + 2] = (j / (H - 1) - 0.5) * 9
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
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    g.computeVertexNormals()
    return g
  }, [])

  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.033)
    const t = tRef.current
    const [m, n] = MODES[modeRef.current]
    const omega = Math.PI * Math.sqrt(m * m + n * n) * 0.85

    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const u = Math.sin(m * Math.PI * i / (W - 1))
              * Math.sin(n * Math.PI * j / (H - 1))
              * Math.cos(omega * t)
        attr.setY(j * W + i, u * AMP)
      }
    }
    attr.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()
  })

  return (
    <group>
      <ambientLight intensity={0.10} color="#08051a" />
      <directionalLight position={[5, 10, 4]} intensity={0.5} color="#a0e0ff" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#22d3ee" distance={18} decay={2} />
      <mesh ref={meshRef} geometry={geo}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  )
}
