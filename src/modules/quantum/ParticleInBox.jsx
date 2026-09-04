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
const Y_SPREAD  = 0.55
const Z_SPREAD  = 0.50
const WAVE_AMP  = 1.0    // visual amplitude of the drawn wavefunction curve

// 3D surface mesh constants
const SURF_NX     = 64
const SURF_NZ     = 28
const SURF_AMP    = 0.88
const SURF_Z_SPAN = 3.2

const SURF_VERT = /* glsl */`
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SURF_FRAG = /* glsl */`
  varying float vH;
  void main() {
    float t = clamp(vH * 1.3 + 0.5, 0.0, 1.0);
    vec3 low  = vec3(0.32, 0.02, 0.58);
    vec3 zero = vec3(0.01, 0.03, 0.12);
    vec3 high = vec3(0.05, 0.58, 0.96);
    vec3 col = t < 0.5
      ? mix(low, zero, t * 2.0)
      : mix(zero, high, (t - 0.5) * 2.0);
    gl_FragColor = vec4(col, 0.78);
  }
`

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

// ── 3D wavefunction surface ───────────────────────────────────────────────────

function WaveSurface3D({ n, En, vizMode }) {
  const meshRef  = useRef()
  const tRef     = useRef(0)
  const nRef     = useRef(n)
  const EnRef    = useRef(En)
  const modeRef  = useRef(vizMode)
  nRef.current   = n
  EnRef.current  = En
  modeRef.current = vizMode

  const geo = useMemo(() => {
    const pos    = new Float32Array(SURF_NX * SURF_NZ * 3)
    const idxArr = new Uint32Array((SURF_NX - 1) * (SURF_NZ - 1) * 6)
    for (let j = 0; j < SURF_NZ; j++) {
      for (let i = 0; i < SURF_NX; i++) {
        const k = (j * SURF_NX + i) * 3
        pos[k]     = BOX_LEFT + (i / (SURF_NX - 1)) * BOX_W
        pos[k + 1] = 0
        pos[k + 2] = (j / (SURF_NZ - 1) - 0.5) * SURF_Z_SPAN
      }
    }
    let p = 0
    for (let j = 0; j < SURF_NZ - 1; j++) {
      for (let i = 0; i < SURF_NX - 1; i++) {
        const a = j * SURF_NX + i, b = a + 1, c = a + SURF_NX, d = c + 1
        idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b
        idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [])

  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.033)
    const t    = tRef.current
    const nn   = nRef.current
    const En_  = EnRef.current
    const mode = modeRef.current
    const cosEt = Math.cos(En_ * t * 0.9)
    const sinEt = Math.sin(En_ * t * 0.9)
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let j = 0; j < SURF_NZ; j++) {
      const zTaper = Math.sin((j / (SURF_NZ - 1)) * Math.PI)  // taper to 0 at edges
      for (let i = 0; i < SURF_NX; i++) {
        const xi  = i / (SURF_NX - 1)
        const psi = particleInBoxWavefunction(nn, xi, 1)
        let y
        if (mode === 'prob')       y = psi * psi * SURF_AMP * 0.52 * zTaper
        else if (mode === 'real')  y = psi * cosEt * SURF_AMP * zTaper
        else                       y = psi * sinEt * SURF_AMP * zTaper
        attr.setY(j * SURF_NX + i, y)
      }
    }
    attr.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={SURF_VERT}
        fragmentShader={SURF_FRAG}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  )
}

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

// ── Animated wavefunction curve (Re(ψ) oscillating with time) ────────────────
const CURVE_SEGS = 128

function WaveCurve({ n, En, vizMode }) {
  const posArr = useRef(new Float32Array((CURVE_SEGS + 1) * 3))
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3))
    return g
  }, [])
  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color('#f59e0b'),
    transparent: true,
    opacity: 0.7,
  }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const cosEt = Math.cos(En * t * 0.9)
    const sinEt = Math.sin(En * t * 0.9)
    for (let i = 0; i <= CURVE_SEGS; i++) {
      const xi = i / CURVE_SEGS
      const psi = particleInBoxWavefunction(n, xi, 1)
      let y
      if (vizMode === 'prob') {
        y = psi * psi * WAVE_AMP * 0.55
      } else if (vizMode === 'real') {
        y = psi * cosEt * WAVE_AMP
      } else {
        y = psi * sinEt * WAVE_AMP
      }
      posArr.current[i * 3]     = BOX_LEFT + xi * BOX_W
      posArr.current[i * 3 + 1] = y
      posArr.current[i * 3 + 2] = 0
    }
    geo.attributes.position.needsUpdate = true
    // Color: |ψ|²=amber, Re=cyan, Im=rose
    if (vizMode === 'prob')  mat.color.set('#f59e0b')
    else if (vizMode === 'real') mat.color.set('#f59e0b')
    else mat.color.set('#e040fb')
  })

  return <line geometry={geo} material={mat} />
}

// ── Node markers (zero-crossing points of ψ_n) ───────────────────────────────
function NodeMarkers({ n }) {
  const nodes = useMemo(() => {
    const pts = []
    for (let k = 1; k < n; k++) {
      pts.push(BOX_LEFT + (k / n) * BOX_W)
    }
    return pts
  }, [n])

  return (
    <>
      {nodes.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#241a0e" emissive="#f59e0b" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </>
  )
}

// ── Wall glow planes ──────────────────────────────────────────────────────────
function WallGlow({ x }) {
  return (
    <mesh position={[x, 0, -0.15]}>
      <planeGeometry args={[0.25, WALL_H * 1.05]} />
      <meshBasicMaterial color={new THREE.Color('#f59e0b')} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
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
            color={active ? '#f59e0b' : '#241a0e'}
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
      {/* ── Potential wall glows ── */}
      <WallGlow x={BOX_LEFT} />
      <WallGlow x={BOX_RIGHT} />

      {/* ── Box walls ── */}
      <mesh position={[BOX_LEFT, 0, 0]}>
        <boxGeometry args={[0.05, WALL_H, 0.05]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[BOX_RIGHT, 0, 0]}>
        <boxGeometry args={[0.05, WALL_H, 0.05]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
      <pointLight position={[BOX_LEFT, 0, 0.3]} color="#f59e0b" intensity={0.5} distance={1.5} />
      <pointLight position={[BOX_RIGHT, 0, 0.3]} color="#f59e0b" intensity={0.5} distance={1.5} />

      {/* ── Floor ── */}
      <Line
        points={[[BOX_LEFT, -WALL_H / 2, 0], [BOX_RIGHT, -WALL_H / 2, 0]]}
        color="#241a0e"
        lineWidth={1}
        transparent
        opacity={0.6}
      />

      {/* ── Zero axis ── */}
      <Line
        points={[[BOX_LEFT, 0, 0], [BOX_RIGHT, 0, 0]]}
        color="#241a0e"
        lineWidth={1}
        transparent
        opacity={0.3}
        dashed
        dashSize={0.2}
        gapSize={0.1}
      />

      {/* ── 3D wavefunction surface mesh ── */}
      <WaveSurface3D n={n} En={En} vizMode={vizMode} />

      {/* ── Oscillating wavefunction curve ── */}
      <WaveCurve n={n} En={En} vizMode={vizMode} />

      {/* ── Node zero-crossing markers ── */}
      <NodeMarkers n={n} />

      {/* ── Monte Carlo particle cloud ── */}
      <ParticleCloud n={n} vizMode={vizMode} En={En} />

      {/* ── Energy ladder ── */}
      <EnergyLadder n={n} />

      {/* ── Labels ── */}
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
