import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const W = 128
const H = 128
const C2 = 0.30
const DAMP = 0.993
const SPONGE = 14
const AMP = 0.45

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
    float t = clamp(vH * 1.4 + 0.5, 0.0, 1.0);
    vec3 deep = vec3(0.01, 0.04, 0.16);
    vec3 mid  = vec3(0.05, 0.52, 0.88);
    vec3 peak = vec3(0.80, 0.97, 1.00);
    vec3 col = t < 0.5
      ? mix(deep, mid, t * 2.0)
      : mix(mid, peak, (t - 0.5) * 2.0);
    float diff = 0.55 + 0.45 * dot(vNorm, normalize(vec3(0.4, 1.0, 0.6)));
    gl_FragColor = vec4(col * diff, 0.95);
  }
`

export default function RippleTank({ onSourceCount }) {
  const meshRef = useRef()
  const [sources, setSources] = useState([{ x: W / 2, y: H / 2, freq: 3.2, t: 0 }])
  const srcRef = useRef(sources)

  const { cur, prv, nxt } = useMemo(() => ({
    cur: new Float32Array(W * H),
    prv: new Float32Array(W * H),
    nxt: new Float32Array(W * H),
  }), [])

  const { geo } = useMemo(() => {
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
    return { geo }
  }, [])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    const gx = Math.round((e.point.x / 5 + 0.5) * (W - 1))
    const gz = Math.round((e.point.z / 5 + 0.5) * (H - 1))
    if (gx < 2 || gx >= W - 2 || gz < 2 || gz >= H - 2) return
    setSources((prev) => {
      const next = [...prev, { x: gx, y: gz, freq: 2.0 + Math.random() * 2.5, t: 0 }].slice(-5)
      srcRef.current = next
      if (onSourceCount) onSourceCount(next.length)
      return next
    })
  }, [onSourceCount])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033)
    for (const s of srcRef.current) {
      s.t += dt
      cur[s.y * W + s.x] = Math.sin(s.t * s.freq * Math.PI * 2) * 1.3
    }
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = j * W + i
        nxt[idx] = DAMP * (2 * cur[idx] - prv[idx] +
          C2 * (cur[idx - 1] + cur[idx + 1] + cur[idx - W] + cur[idx + W] - 4 * cur[idx]))
      }
    }
    for (let s = 0; s < SPONGE; s++) {
      const f = 1 - 0.14 * (SPONGE - s) / SPONGE
      for (let i = 0; i < W; i++) {
        nxt[s * W + i] *= f; nxt[(H - 1 - s) * W + i] *= f
      }
      for (let j = 0; j < H; j++) {
        nxt[j * W + s] *= f; nxt[j * W + (W - 1 - s)] *= f
      }
    }
    prv.set(cur); cur.set(nxt)

    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let k = 0; k < W * H; k++) attr.setY(k, cur[k] * AMP)
    attr.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()
  })

  return (
    <group>
      <ambientLight intensity={0.12} color="#061020" />
      <directionalLight position={[4, 10, 6]} intensity={0.5} color="#7de8ff" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#22d3ee" distance={20} decay={2} />

      <mesh ref={meshRef} geometry={geo} onClick={handleClick}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Transparent click catcher for the flat region */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {sources.map((src, i) => {
        const wx = (src.x / (W - 1) - 0.5) * 10
        const wz = (src.y / (H - 1) - 0.5) * 10
        return (
          <group key={i} position={[wx, 0.18, wz]}>
            <mesh>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshBasicMaterial color="#22d3ee" />
            </mesh>
            <pointLight color="#22d3ee" intensity={0.5} distance={2.5} decay={2} />
          </group>
        )
      })}
    </group>
  )
}
