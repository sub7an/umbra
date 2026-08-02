import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { particleInBoxWavefunction, particleInBoxEnergy } from './qmMath'

const BOX_LEFT  = -2.5
const BOX_RIGHT =  2.5
const BOX_W     = BOX_RIGHT - BOX_LEFT
const WALL_H    = 2.8
const Y_SPREAD  = 0.55   // max y/z amplitude at an antinode
const Z_SPREAD  = 0.50   // max z depth of cloud

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  attribute float aSign;
  uniform float uMode;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uSize;
  varying vec3  vColor;

  void main() {
    vec3 cyan  = vec3(0.0,   0.898, 0.769);
    vec3 amber = vec3(0.961, 0.624, 0.043);
    vec3 rose  = vec3(0.878, 0.251, 0.984);

    float t     = uTime * 0.9;
    float cosEt = cos(uEnergy * t);
    float sinEt = sin(uEnergy * t);

    if (uMode < 0.5) {
      // |ψ|² — static amber cloud (density already encoded by point distribution)
      vColor = amber;
    } else if (uMode < 1.5) {
      // Re(ψ) = ψ_n(x) · cos(E_n t)  →  cyan=positive, rose=negative
      float re = aSign * cosEt;
      vColor = re > 0.0 ? cyan * abs(re) : rose * abs(re);
    } else {
      // Im(ψ) = ψ_n(x) · sin(E_n t)  →  rose=positive, cyan=negative
      float im = aSign * sinEt;
      vColor = im > 0.0 ? rose * abs(im) : cyan * abs(im);
    }

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
    gl_Position  = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a);
  }
`

// ── CPU sampling ──────────────────────────────────────────────────────────────

function sampleCloud(n, count) {
  // Rejection-sample x ~ |ψ_n(x)|²  (acceptance rate ≈ 50% for any n)
  const positions = new Float32Array(count * 3)
  const signs     = new Float32Array(count)
  const maxProb   = 2.0  // sup of |ψ_n|² = 2 (at antinodes, L=1)

  let accepted = 0
  let tries    = 0
  const limit  = count * 20

  while (accepted < count && tries < limit) {
    tries++
    const xi  = Math.random()
    const psi = particleInBoxWavefunction(n, xi, 1)
    const p2  = psi * psi
    if (Math.random() * maxProb > p2) continue

    const worldX = BOX_LEFT + xi * BOX_W
    // Spread in y/z proportional to |ψ| → wider tubes at antinodes
    const amp = Math.abs(psi)
    const y   = (Math.random() - 0.5) * 2 * amp * Y_SPREAD
    const z   = (Math.random() - 0.5) * Z_SPREAD

    const i = accepted
    positions[i * 3]     = worldX
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    signs[i]             = psi >= 0 ? 1 : -1
    accepted++
  }

  return {
    positions: positions.slice(0, accepted * 3),
    signs:     signs.slice(0, accepted),
    count:     accepted,
  }
}

// ── Particle cloud ─────────────────────────────────────────────────────────────

function ParticleCloud({ n, vizMode, En }) {
  const particleCount = useModuleStore((s) => s.qm.particleCount)
  const matRef = useRef()

  const { positions, signs, count } = useMemo(
    () => sampleCloud(n, particleCount),
    [n, particleCount],
  )

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSign',    new THREE.BufferAttribute(signs, 1))
    return g
  }, [positions, signs])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMode:   { value: 0.0 },
      uTime:   { value: 0.0 },
      uEnergy: { value: En  },
      uSize:   { value: 2.5 },
    },
    transparent:  true,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending,
  }), [En])  // En only changes when n changes (new mat not expensive)

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  // Keep uMode in sync without recreating the material
  useEffect(() => {
    if (mat) {
      mat.uniforms.uMode.value = vizMode === 'prob' ? 0.0 : vizMode === 'real' ? 1.0 : 2.0
    }
  }, [vizMode, mat])

  useFrame(({ clock }) => {
    if (mat) mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return <points ref={matRef} geometry={geo} material={mat} />
}

// ── Energy ladder ─────────────────────────────────────────────────────────────

function EnergyLadder({ n }) {
  const lines = useMemo(() => {
    const result = []
    for (let k = 1; k <= 6; k++) {
      const Ek   = particleInBoxEnergy(k)
      const Emax = particleInBoxEnergy(6)
      const y    = (Ek / Emax) * (WALL_H - 0.4) - WALL_H / 2 + 0.2
      result.push({ k, y, active: k === n })
    }
    return result
  }, [n])

  return (
    <group position={[BOX_RIGHT + 0.15, 0, 0]}>
      {lines.map(({ k, y, active }) => (
        <group key={k}>
          <Line
            points={[[0, y, 0], [0.5, y, 0]]}
            color={active ? '#f59e0b' : '#162229'}
            lineWidth={active ? 2 : 1}
            transparent
            opacity={active ? 1 : 0.5}
          />
          <Html position={[0.6, y, 0]} center style={{ pointerEvents: 'none' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: active ? '#f59e0b' : '#4a7a74',
              whiteSpace: 'nowrap',
            }}>
              n={k}
            </span>
          </Html>
        </group>
      ))}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ParticleInBox() {
  const n      = useModuleStore((s) => s.qm.boxN)
  const vizMode = useModuleStore((s) => s.qm.boxVizMode)
  const En     = useMemo(() => particleInBoxEnergy(n), [n])

  return (
    <group position={[0, 0.2, 0]}>
      {/* Box walls */}
      <mesh position={[BOX_LEFT, 0, 0]}>
        <boxGeometry args={[0.04, WALL_H, 0.04]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[BOX_RIGHT, 0, 0]}>
        <boxGeometry args={[0.04, WALL_H, 0.04]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={0.4} />
      </mesh>

      {/* Floor */}
      <Line
        points={[[BOX_LEFT, -WALL_H / 2, 0], [BOX_RIGHT, -WALL_H / 2, 0]]}
        color="#162229"
        lineWidth={1}
        transparent
        opacity={0.6}
      />

      {/* Zero axis */}
      <Line
        points={[[BOX_LEFT, 0, 0], [BOX_RIGHT, 0, 0]]}
        color="#162229"
        lineWidth={1}
        transparent
        opacity={0.3}
        dashed
        dashSize={0.2}
        gapSize={0.1}
      />

      {/* Monte Carlo particle cloud */}
      <ParticleCloud n={n} vizMode={vizMode} En={En} />

      {/* Energy ladder */}
      <EnergyLadder n={n} />

      {/* Labels */}
      <Html position={[BOX_LEFT - 0.15, WALL_H / 2 + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>V=∞</span>
      </Html>
      <Html position={[BOX_RIGHT + 0.15, WALL_H / 2 + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a7a74', whiteSpace: 'nowrap' }}>V=∞</span>
      </Html>

      <Html position={[0, -WALL_H / 2 - 0.45, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)', whiteSpace: 'nowrap' }}>
          n = {n} · E_n = {En.toFixed(2)} (ℏ²/2mL²)
        </div>
      </Html>
    </group>
  )
}
