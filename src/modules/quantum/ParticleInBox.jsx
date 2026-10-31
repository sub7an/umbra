// Particle in a box: ψ_n(x, t) = √2 · sin(nπx) · e^(−iE_n t), E_n ∝ n².
//
// Everything is coloured by the complex phase of ψ, so the time evolution is
// visible even in the |ψ|² view: the whole state cycles round the colour wheel
// at a rate ∝ n², and neighbouring lobes always sit on opposite hues (a sign
// flip is a phase of π).
//
//   • glass box with glowing edges: the infinite well
//   • lit wave surface (height = |ψ|², Re ψ or Im ψ) with contour lines
//   • a pool of light on the floor under each lobe
//   • a twinkling probability tube of position samples along the floor
//   • nodes as bright points; an energy ladder spaced as n²
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
const FLOOR_Y   = -WALL_H / 2
const TOP_Y     = WALL_H / 2 + 0.6
const DEPTH     = 3.2          // box depth (z)
const TUBE_Y    = FLOOR_Y + 0.42
const TUBE_R    = 0.26

const SURF_NX  = 200
const SURF_NZ  = 72
const SURF_AMP = 0.88

// Visual phase rate: keeps E ∝ n² but slow enough to watch
const omegaVis = (n) => 0.35 * n * n

// Shared GLSL: a smooth cyclic palette for the phase (sRGB → linear)
const PHASE_GLSL = /* glsl */`
  vec3 phaseColor(float ph) {
    float t = ph / 6.2831853;
    vec3 c = vec3(0.55) + vec3(0.45) * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
    return pow(c, vec3(2.2));
  }
`

// ── Wave surface ──────────────────────────────────────────────────────────────

const SURF_VERT = /* glsl */`
  uniform float uN, uPhase, uMode, uAmp;
  varying float vH;
  varying float vPsi;
  varying float vTaper;
  varying vec3  vNormal;
  varying vec3  vView;
  const float LEFT = ${BOX_LEFT.toFixed(2)}, W = ${BOX_W.toFixed(2)}, ZS = ${DEPTH.toFixed(2)};
  const float PI = 3.14159265;
  void main() {
    vec3 p = position;
    float xi = (p.x - LEFT) / W;
    float k = uN * PI;
    float psi  = sqrt(2.0) * sin(k * xi);
    float dpsi = sqrt(2.0) * k / W * cos(k * xi);
    float tp   = sin(PI * (p.z / ZS + 0.5));
    float dtp  = PI / ZS * cos(PI * (p.z / ZS + 0.5));
    float c = cos(uPhase), s = sin(uPhase);
    float f, df;
    if (uMode < 0.5)      { f = psi * psi * 0.52; df = 2.0 * psi * dpsi * 0.52; }
    else if (uMode < 1.5) { f = psi * c;          df = dpsi * c; }
    else                  { f = -psi * s;         df = -dpsi * s; }
    float h = f * tp * uAmp;
    p.y = h;
    vH = h; vPsi = psi; vTaper = tp;
    vec3 n = normalize(vec3(-df * tp * uAmp, 1.0, -f * dtp * uAmp));
    vNormal = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const SURF_FRAG = /* glsl */`
  uniform float uPhase;
  varying float vH;
  varying float vPsi;
  varying float vTaper;
  varying vec3  vNormal;
  varying vec3  vView;
  ${PHASE_GLSL}
  void main() {
    // arg ψ = −E t (+π where ψ_n < 0)
    float ph = mod(-uPhase + (vPsi < 0.0 ? 3.14159265 : 0.0), 6.2831853);
    float mag = abs(vPsi) / 1.41421356 * vTaper;
    vec3 base = phaseColor(ph) * (0.05 + 0.95 * mag);

    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.35, 0.9, 0.5));
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 64.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float c = abs(fract(vH * 10.0 + 0.5) - 0.5) / fwidth(vH * 10.0);
    float contour = (1.0 - min(c, 1.0)) * smoothstep(0.02, 0.08, abs(vH));

    vec3 col = base * (0.25 + 1.0 * diff)
             + vec3(1.0) * spec * 0.55 * mag
             + base * fres * 1.6
             + base * contour * 1.2;
    float alpha = mix(0.25, 0.92, smoothstep(0.0, 0.25, mag));
    gl_FragColor = vec4(col, alpha);
  }
`

function WaveSurface({ n, vizMode, phaseRef }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(BOX_W, DEPTH * 0.96, SURF_NX - 1, SURF_NZ - 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SURF_VERT, fragmentShader: SURF_FRAG,
    uniforms: { uN: { value: 1 }, uPhase: { value: 0 }, uMode: { value: 0 }, uAmp: { value: SURF_AMP } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useEffect(() => {
    mat.uniforms.uN.value = n
    mat.uniforms.uMode.value = vizMode === 'prob' ? 0 : vizMode === 'real' ? 1 : 2
  }, [mat, n, vizMode])
  useFrame(() => { mat.uniforms.uPhase.value = phaseRef.current })
  return <mesh geometry={geo} material={mat} renderOrder={2} frustumCulled={false} />
}

// ── Floor: light pooled under each lobe, plus a fine grid ────────────────────

const FLOOR_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const FLOOR_FRAG = /* glsl */`
  uniform float uN, uPhase;
  varying vec2 vP;
  ${PHASE_GLSL}
  void main() {
    float xi = (vP.x - ${BOX_LEFT.toFixed(2)}) / ${BOX_W.toFixed(2)};
    float psi = sqrt(2.0) * sin(uN * 3.14159265 * xi);
    float zf = exp(-pow(vP.y / ${(DEPTH * 0.28).toFixed(3)}, 2.0));
    float ph = mod(-uPhase + (psi < 0.0 ? 3.14159265 : 0.0), 6.2831853);
    vec3 col = vec3(0.008, 0.010, 0.020);
    col += phaseColor(ph) * psi * psi * 0.5 * zf * 0.5;
    vec2 g = abs(fract(vP / 0.25 + 0.5) - 0.5) * 0.25 / fwidth(vP);
    float grid = 1.0 - min(min(g.x, g.y), 1.0);
    col += vec3(0.05, 0.06, 0.10) * grid * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`

function Floor({ n, phaseRef }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG,
    uniforms: { uN: { value: n }, uPhase: { value: 0 } },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { mat.uniforms.uN.value = n }, [mat, n])
  useFrame(() => { mat.uniforms.uPhase.value = phaseRef.current })
  return (
    <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[BOX_W, DEPTH]} />
    </mesh>
  )
}

// ── Glass box ─────────────────────────────────────────────────────────────────

const GLASS_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const GLASS_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    // Brighter toward the edges of each pane, fading toward the top
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = exp(-min(e.x, e.y) * 18.0);
    float fade = 1.0 - smoothstep(0.55, 1.0, vUv.y);
    float sheen = 0.5 + 0.5 * sin((vUv.x - vUv.y) * 9.0);
    vec3 col = uColor * (0.035 + edge * 0.35 + sheen * 0.015) * fade * uStrength;
    gl_FragColor = vec4(col, 1.0);
  }
`

function GlassPane({ position, rotation, size, strength = 1 }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
    uniforms: { uColor: { value: new THREE.Color('#7c8cff') }, uStrength: { value: strength } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [strength])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <planeGeometry args={size} />
    </mesh>
  )
}

function GlassBox() {
  const H = TOP_Y - FLOOR_Y, cy = (TOP_Y + FLOOR_Y) / 2, hz = DEPTH / 2
  const edges = useMemo(() => {
    const L = BOX_LEFT, R = BOX_RIGHT, B = FLOOR_Y, T = TOP_Y
    return [
      [[L, B, -hz], [R, B, -hz]], [[L, B, hz], [R, B, hz]],
      [[L, B, -hz], [L, B, hz]], [[R, B, -hz], [R, B, hz]],
      [[L, B, -hz], [L, T, -hz]], [[R, B, -hz], [R, T, -hz]],
    ]
  }, [hz])
  const walls = [[BOX_LEFT, hz], [BOX_RIGHT, hz]]
  return (
    <group>
      {/* The two infinite walls: brighter glass */}
      <GlassPane position={[BOX_LEFT, cy, 0]} rotation={[0, Math.PI / 2, 0]} size={[DEPTH, H]} strength={1.6} />
      <GlassPane position={[BOX_RIGHT, cy, 0]} rotation={[0, Math.PI / 2, 0]} size={[DEPTH, H]} strength={1.6} />
      {/* Back pane, faint */}
      <GlassPane position={[0, cy, -hz]} rotation={[0, 0, 0]} size={[BOX_W, H]} strength={0.5} />
      {edges.map((pts, i) => (
        <Line key={i} points={pts} color="#7c8cff" lineWidth={1.2} transparent opacity={0.45} />
      ))}
      {/* Bright front edges of the walls */}
      {walls.map(([x], i) => (
        <mesh key={i} position={[x, cy, hz]}>
          <boxGeometry args={[0.03, H, 0.03]} />
          <meshBasicMaterial color={[1.0, 1.1, 2.4]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ── Probability tube: position samples drawn from |ψ_n|², twinkling ──────────

const TUBE_VERT = /* glsl */`
  attribute float aPsi;
  attribute float aSeed;
  uniform float uPhase, uTime, uSize, uGain;
  varying vec3  vColor;
  varying float vAlpha;
  ${PHASE_GLSL}
  void main() {
    float ph = mod(-uPhase + (aPsi < 0.0 ? 3.14159265 : 0.0), 6.2831853);
    vColor = phaseColor(ph) * 1.6;
    // Each sample flickers in and out: a fresh position "measurement" each time
    float tw = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
    vAlpha = tw * tw * uGain;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(uSize * (0.6 + 0.8 * tw) * (8.0 / -mv.z), 7.0);
    gl_Position = projectionMatrix * mv;
  }
`
const TUBE_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = exp(-d * d * 18.0) * vAlpha;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`

function sampleTube(n, count) {
  const pos = new Float32Array(count * 3), psiA = new Float32Array(count), seed = new Float32Array(count)
  let i = 0, tries = 0
  while (i < count && tries++ < count * 30) {
    const xi = Math.random()
    const psi = particleInBoxWavefunction(n, xi, 1)
    if (Math.random() * 2 > psi * psi) continue
    // Uniform in a disc whose radius follows |ψ|
    const r = TUBE_R * (Math.abs(psi) / Math.SQRT2) * Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    pos[i * 3] = BOX_LEFT + xi * BOX_W
    pos[i * 3 + 1] = TUBE_Y + r * Math.sin(a)
    pos[i * 3 + 2] = r * Math.cos(a)
    psiA[i] = psi
    seed[i] = Math.random()
    i++
  }
  return { pos: pos.slice(0, i * 3), psi: psiA.slice(0, i), seed: seed.slice(0, i) }
}

function ProbabilityTube({ n, phaseRef }) {
  const particleCount = useModuleStore((s) => s.qm.particleCount)
  const geo = useMemo(() => {
    const { pos, psi, seed } = sampleTube(n, Math.min(particleCount, 30000))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPsi', new THREE.BufferAttribute(psi, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [n, particleCount])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG,
    uniforms: { uPhase: { value: 0 }, uTime: { value: 0 }, uSize: { value: 4.5 }, uGain: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { mat.uniforms.uGain.value = Math.min(1, 6000 / particleCount) }, [mat, particleCount])
  useFrame(({ clock }) => {
    mat.uniforms.uPhase.value = phaseRef.current
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// ── Profile curve on the back pane: the same quantity as the surface ─────────
const CURVE_SEGS = 160

function ProfileCurve({ n, vizMode, phaseRef }) {
  const ref = useRef()
  const pts = useMemo(() => Array.from({ length: CURVE_SEGS + 1 }, () => [0, 0, 0]), [])
  useFrame(() => {
    const line = ref.current
    if (!line) return
    const c = Math.cos(phaseRef.current), s = Math.sin(phaseRef.current)
    const flat = []
    for (let i = 0; i <= CURVE_SEGS; i++) {
      const xi = i / CURVE_SEGS
      const psi = particleInBoxWavefunction(n, xi, 1)
      const y = vizMode === 'prob' ? psi * psi * 0.52 : vizMode === 'real' ? psi * c : -psi * s
      flat.push(BOX_LEFT + xi * BOX_W, y * SURF_AMP, -DEPTH / 2 + 0.01)
    }
    line.geometry.setPositions(flat)
  })
  return <Line ref={ref} points={pts} color="#e2e8f0" lineWidth={1.5} transparent opacity={0.55} />
}

// ── Nodes: bright points on the surface's zero line ──────────────────────────
function NodeMarkers({ n }) {
  const xs = useMemo(() => Array.from({ length: n - 1 }, (_, k) => BOX_LEFT + ((k + 1) / n) * BOX_W), [n])
  return (
    <>
      {xs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshBasicMaterial color={[2.4, 2.4, 2.8]} toneMapped={false} />
          </mesh>
          <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.09, 32]} />
            <meshBasicMaterial color="#cbd5e1" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
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
    <group position={[BOX_RIGHT + 0.9, 0, 0]}>
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
  const n       = useModuleStore((s) => s.qm.boxN)
  const vizMode = useModuleStore((s) => s.qm.boxVizMode)

  // Shared phase E·t for every layer, so they all cycle together
  const phaseRef = useRef(0)
  useFrame((_, delta) => {
    phaseRef.current = (phaseRef.current + Math.min(delta, 0.05) * omegaVis(n)) % (Math.PI * 2)
  })

  return (
    <group position={[-0.35, 0.2, 0]}>
      <Floor n={n} phaseRef={phaseRef} />
      <GlassBox />
      <ProfileCurve n={n} vizMode={vizMode} phaseRef={phaseRef} />
      <ProbabilityTube n={n} phaseRef={phaseRef} />
      <WaveSurface n={n} vizMode={vizMode} phaseRef={phaseRef} />
      <NodeMarkers n={n} />
      <EnergyLadder n={n} />
    </group>
  )
}
