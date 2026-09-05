import { useRef, useMemo, useEffect } from 'react'
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

// ── Infalling matter: particles spiral down the funnel, white-hot at centre ──
const PN = 1400

function InfallSwirl({ massRef }) {
  const sim = useMemo(() => {
    const r  = new Float32Array(PN)
    const th = new Float32Array(PN)
    const sp = new Float32Array(PN)
    for (let i = 0; i < PN; i++) {
      r[i]  = 1.2 + Math.random() * 6.5
      th[i] = Math.random() * Math.PI * 2
      sp[i] = 0.5 + Math.random() * 0.9
    }
    const posAttr = new THREE.BufferAttribute(new Float32Array(PN * 3), 3)
    const colAttr = new THREE.BufferAttribute(new Float32Array(PN * 3), 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', posAttr)
    geo.setAttribute('color', colAttr)
    return { r, th, sp, posAttr, colAttr, geo }
  }, [])

  useEffect(() => () => sim.geo.dispose(), [sim.geo])

  useFrame((_, dt) => {
    const m = massRef.current
    const d = Math.min(dt, 0.05)
    const { r, th, sp, posAttr, colAttr } = sim
    const horizon = 0.22 + m * 0.1

    for (let i = 0; i < PN; i++) {
      // Keplerian-flavoured: angular speed rises sharply as radius shrinks
      th[i] += ((sp[i] * m * 1.2) / (r[i] * r[i] * 0.5 + 0.3)) * d
      r[i]  -= ((m * 0.24) / (r[i] + 0.4)) * sp[i] * d
      if (r[i] < horizon) {
        r[i]  = 5.5 + Math.random() * 2.2
        th[i] = Math.random() * Math.PI * 2
      }
      const x = Math.cos(th[i]) * r[i]
      const z = Math.sin(th[i]) * r[i]
      posAttr.setXYZ(i, x, warpY(x, z, m) + 0.07, z)

      // Heat gradient: cool indigo at rim → beyond-white at the throat (blooms)
      const heat = Math.max(0, Math.min(1, 1 - (r[i] - horizon) / 6))
      const h2 = heat * heat
      colAttr.setXYZ(i, 0.22 + h2 * 1.6, 0.3 + h2 * 1.1, 0.8 + h2 * 0.4)
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  return (
    <points geometry={sim.geo} renderOrder={2}>
      <pointsMaterial
        vertexColors
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

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

      {/* Infalling matter swirl */}
      <InfallSwirl massRef={massRef} />

      {/* Central mass — hot enough for bloom to halo it */}
      <mesh position={[0, centerY + mass * 0.22, 0]}>
        <sphereGeometry args={[mass * 0.18, 32, 32]} />
        <meshStandardMaterial
          color="#fb923c"
          emissive="#ffb066"
          emissiveIntensity={2.8}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      {/* Photon-sphere ring — additive so it burns */}
      <mesh ref={ringRef} position={[0, centerY + 0.3, 0]}>
        <torusGeometry args={[mass * 0.55, 0.03, 8, 64]} />
        <meshBasicMaterial
          color="#ffc080"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
