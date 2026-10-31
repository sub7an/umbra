import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
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
const SURF_NX     = 180
const SURF_NZ     = 64
const SURF_AMP    = 0.88
const SURF_Z_SPAN = 3.2

// The surface is displaced on the GPU: height h(x, z) = ψ-quantity(x) · taper(z),
// with analytic normals so it can be properly lit.
const SURF_VERT = /* glsl */`
  uniform float uN, uCos, uSin, uMode, uAmp;
  varying float vH;
  varying vec3  vNormal;
  varying vec3  vView;
  const float LEFT = ${BOX_LEFT.toFixed(2)}, W = ${BOX_W.toFixed(2)}, ZS = ${SURF_Z_SPAN.toFixed(2)};
  const float PI = 3.14159265;
  void main() {
    vec3 p = position;
    float xi = (p.x - LEFT) / W;
    float k = uN * PI;
    float psi  = sqrt(2.0) * sin(k * xi);
    float dpsi = sqrt(2.0) * k / W * cos(k * xi);
    float tp   = sin(PI * (p.z / ZS + 0.5));
    float dtp  = PI / ZS * cos(PI * (p.z / ZS + 0.5));
    float f, df;
    if (uMode < 0.5)      { f = psi * psi * 0.52; df = 2.0 * psi * dpsi * 0.52; }
    else if (uMode < 1.5) { f = psi * uCos;       df = dpsi * uCos; }
    else                  { f = psi * uSin;       df = dpsi * uSin; }
    float h = f * tp * uAmp;
    p.y = h;
    vH = h;
    vec3 n = normalize(vec3(-df * tp * uAmp, 1.0, -f * dtp * uAmp));
    vNormal = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const SURF_FRAG = /* glsl */`
  varying float vH;
  varying vec3  vNormal;
  varying vec3  vView;
  void main() {
    float t = clamp(vH * 1.3 + 0.5, 0.0, 1.0);
    vec3 low  = vec3(0.32, 0.02, 0.58);
    vec3 zero = vec3(0.02, 0.05, 0.16);
    vec3 high = vec3(0.05, 0.58, 0.96);
    vec3 base = t < 0.5 ? mix(low, zero, t * 2.0) : mix(zero, high, (t - 0.5) * 2.0);
    base = pow(base, vec3(2.2));

    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.35, 0.9, 0.5));
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 48.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    // Contour lines every 0.1 in height
    float c = abs(fract(vH * 10.0 + 0.5) - 0.5) / fwidth(vH * 10.0);
    float contour = (1.0 - min(c, 1.0)) * smoothstep(0.02, 0.08, abs(vH));

    vec3 col = base * (0.35 + 0.9 * diff) + vec3(0.9, 0.95, 1.0) * spec * 0.5 + base * fres * 1.2;
    col += base * contour * 1.5;
    gl_FragColor = vec4(col, 0.88);
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
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(BOX_W, SURF_Z_SPAN, SURF_NX - 1, SURF_NZ - 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SURF_VERT, fragmentShader: SURF_FRAG,
    uniforms: { uN: { value: 1 }, uCos: { value: 1 }, uSin: { value: 0 }, uMode: { value: 0 }, uAmp: { value: SURF_AMP } },
    side: THREE.DoubleSide, transparent: true,
  }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useEffect(() => {
    mat.uniforms.uN.value = n
    mat.uniforms.uMode.value = vizMode === 'prob' ? 0 : vizMode === 'real' ? 1 : 2
  }, [mat, n, vizMode])

  const tRef = useRef(0)
  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.033)
    mat.uniforms.uCos.value = Math.cos(En * tRef.current * 0.9)
    mat.uniforms.uSin.value = Math.sin(En * tRef.current * 0.9)
  })

  return <mesh geometry={geo} material={mat} position={[(BOX_LEFT + BOX_RIGHT) / 2, 0, 0]} frustumCulled={false} />
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
    color: new THREE.Color("#7c8cff"),
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
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
    else if (vizMode === 'real') mat.color.set('#7c8cff')
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
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color={[2.2, 2.2, 2.6]} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

// ── Infinite potential walls: slabs whose glow fades upward ───────────────────
const WALL_FRAG = /* glsl */`
  varying vec2 vUv;
  void main() {
    // Diagonal hatching, brighter at the inner face, fading toward the top
    float hatch = smoothstep(0.35, 0.5, abs(fract((vUv.x + vUv.y * 2.4) * 9.0) - 0.5));
    float fade = 1.0 - smoothstep(0.35, 1.0, vUv.y);
    vec3 col = pow(vec3(0.49, 0.55, 1.0), vec3(2.2)) * (0.03 + hatch * 0.07) * fade;
    gl_FragColor = vec4(col, 1.0);
  }
`
const WALL_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

function PotentialWall({ side }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WALL_VERT, fragmentShader: WALL_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  const x = side < 0 ? BOX_LEFT : BOX_RIGHT
  const SLAB = 0.9
  return (
    <group position={[x, 0, 0]}>
      {/* Hatched slab on the outside of the well */}
      <mesh position={[side * SLAB / 2, 0.4, 0]} material={mat}>
        <planeGeometry args={[SLAB, WALL_H + 0.8]} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.03, WALL_H + 0.8, 0.03]} />
        <meshBasicMaterial color={[0.9, 1.0, 2.2]} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Energy ladder: levels at E ∝ n², the active one glowing ──────────────────

function EnergyLadder({ n }) {
  const lines = useMemo(() => {
    const Emax = particleInBoxEnergy(6)
    return Array.from({ length: 6 }, (_, i) => {
      const k = i + 1
      return { k, y: (particleInBoxEnergy(k) / Emax) * (WALL_H - 0.4) - WALL_H / 2 + 0.2 }
    })
  }, [])
  const glow = useRef()
  useFrame(({ clock }) => {
    if (glow.current) glow.current.material.opacity = 0.35 + 0.2 * Math.sin(clock.elapsedTime * 3)
  })
  const active = lines[n - 1]

  return (
    <group position={[BOX_RIGHT + 1.15, 0, 0]}>
      <Line points={[[0, -WALL_H / 2 + 0.05, 0], [0, WALL_H / 2 + 0.1, 0]]} color="#334155" lineWidth={1} />
      {lines.map(({ k, y }) => (
        <Line
          key={k}
          points={[[0, y, 0], [0.7, y, 0]]}
          color={k === n ? '#fbbf24' : '#475569'}
          lineWidth={k === n ? 3 : 1.5}
          transparent
          opacity={k === n ? 1 : 0.6}
        />
      ))}
      {active && (
        <mesh ref={glow} position={[0.35, active.y, -0.01]}>
          <planeGeometry args={[1.0, 0.16]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ParticleInBox() {
  const n      = useModuleStore((s) => s.qm.boxN)
  const vizMode = useModuleStore((s) => s.qm.boxVizMode)
  const En     = useMemo(() => particleInBoxEnergy(n), [n])

  return (
    <group position={[-0.4, 0.2, 0]}>
      <PotentialWall side={-1} />
      <PotentialWall side={1} />

      {/* Floor of the well */}
      <mesh position={[0, -WALL_H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX_W, SURF_Z_SPAN]} />
        <meshStandardMaterial color="#0b1020" metalness={0.5} roughness={0.6} transparent opacity={0.35} />
      </mesh>

      {/* Zero axis */}
      <Line
        points={[[BOX_LEFT, 0, 0], [BOX_RIGHT, 0, 0]]}
        color="#334155"
        lineWidth={1}
        transparent
        opacity={0.5}
        dashed
        dashSize={0.2}
        gapSize={0.1}
      />

      <WaveSurface3D n={n} En={En} vizMode={vizMode} />
      <WaveCurve n={n} En={En} vizMode={vizMode} />
      <NodeMarkers n={n} />
      <ParticleCloud n={n} vizMode={vizMode} En={En} />
      <EnergyLadder n={n} />
    </group>
  )
}
