// Young's double slit in a water tank, drawn entirely on the GPU.
//
// A plane wave arrives from the left and meets a barrier with two narrow
// slits. Behind it the surface is the sum of two circular wavelets (Huygens),
// each from one slit. Where they arrive in phase the water heaves; where they
// arrive half a wavelength apart it stays flat, so calm nodal lines fan out
// between rows of large waves. A screen on the far side glows with the
// time-averaged intensity: the fringes, spaced Δy = λL/d.
import { useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WATER_FRAG } from './waterShader'

const HALF   = 5          // tank half-size
const BAR_X  = -1.6       // barrier position
const SLIT_D = 1.6        // slit separation d
const SLIT_A = 0.32       // slit width a
const LAMBDA = 0.62
const AMP    = 0.14
const SCREEN_X = HALF - 0.05
const L_DIST = SCREEN_X - BAR_X

// Height field: shared by the surface and its finite-difference normals
const HEIGHT_GLSL = /* glsl */`
  uniform float uT;
  const float K = ${(2 * Math.PI / LAMBDA).toFixed(4)};
  const float BAR = ${BAR_X.toFixed(2)};
  const float HD = ${(SLIT_D / 2).toFixed(3)};
  const float A = ${SLIT_A.toFixed(3)};
  float sinc(float x) { return abs(x) < 1e-4 ? 1.0 : sin(x) / x; }
  float height(vec2 p) {
    if (p.x < BAR) {
      // Incoming plane wave, fading in from the left edge
      return ${AMP.toFixed(3)} * cos(K * p.x - uT) * smoothstep(${(-HALF).toFixed(1)}, ${(-HALF + 1.2).toFixed(1)}, p.x);
    }
    float w = 0.0;
    for (int s = 0; s < 2; s++) {
      vec2 o = vec2(BAR, s == 0 ? HD : -HD);
      vec2 d = p - o;
      float r = length(d);
      float env = sinc(0.5 * K * A * d.y / max(r, 1e-3)) * smoothstep(0.0, 0.3, d.x);
      w += env * cos(K * (r + BAR) - uT) / sqrt(r + 0.3);
    }
    return ${AMP.toFixed(3)} * 0.95 * w;
  }
`
const VERT = /* glsl */`
  ${HEIGHT_GLSL}
  varying vec3  vN;
  varying vec3  vWorld;
  varying float vH;
  varying float vFocus;
  void main() {
    vec2 p = position.xz;
    float e = 0.04;
    float h = height(p);
    float hl = height(p - vec2(e, 0.0)), hr = height(p + vec2(e, 0.0));
    float hd = height(p - vec2(0.0, e)), hu = height(p + vec2(0.0, e));
    vec3 n = normalize(vec3(hl - hr, 2.0 * e, hd - hu));
    vFocus = -(hl + hr + hd + hu - 4.0 * h) / (e * e) * 0.035;
    vH = h;
    vN = normalize(mat3(modelMatrix) * n);
    vec4 w = modelMatrix * vec4(p.x, h, p.y, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

// Screen: time-averaged |ψ₁ + ψ₂|² at x = SCREEN_X
const SCREEN_FRAG = /* glsl */`
  varying vec2 vUv;
  const float K = ${(2 * Math.PI / LAMBDA).toFixed(4)};
  float sinc(float x) { return abs(x) < 1e-4 ? 1.0 : sin(x) / x; }
  void main() {
    float y = (vUv.x - 0.5) * ${(2 * HALF).toFixed(1)};
    vec2 a = vec2(0.0), d;
    for (int s = 0; s < 2; s++) {
      d = vec2(${L_DIST.toFixed(3)}, y - (s == 0 ? ${(SLIT_D / 2).toFixed(3)} : ${(-SLIT_D / 2).toFixed(3)}));
      float r = length(d);
      float env = sinc(0.5 * K * ${SLIT_A.toFixed(3)} * d.y / r) / sqrt(r + 0.3);
      a += env * vec2(cos(K * r), sin(K * r));
    }
    float I = dot(a, a) * 0.9;
    vec3 col = pow(vec3(0.55, 0.92, 1.0), vec3(2.2)) * I * 1.6 + pow(vec3(0.05, 0.08, 0.12), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);
  }
`
const SCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

export default function DoubleSlit() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, 320, 320)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: WATER_FRAG,
    uniforms: { uT: { value: 0 } }, side: THREE.DoubleSide,
  }), [])
  const screenMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose(); screenMat.dispose() }, [geo, mat, screenMat])
  useFrame((_, delta) => { mat.uniforms.uT.value += Math.min(delta, 0.05) * 4.0 })

  // Barrier: three solid pieces leaving two slits
  const top = SLIT_D / 2 + SLIT_A / 2, inner = SLIT_D / 2 - SLIT_A / 2
  const pieces = [
    [(HALF + top) / 2, HALF - top],
    [-(HALF + top) / 2, HALF - top],
    [0, inner * 2],
  ]

  return (
    <group>
      <mesh geometry={geo} material={mat} frustumCulled={false} />

      {/* Tank */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[HALF * 2 + 0.6, 0.1, HALF * 2 + 0.6]} />
        <meshStandardMaterial color="#0b1220" metalness={0.3} roughness={0.8} />
      </mesh>
      {[[0, HALF + 0.15, HALF * 2 + 0.6, 0.3], [0, -HALF - 0.15, HALF * 2 + 0.6, 0.3], [-HALF - 0.15, 0, 0.3, HALF * 2]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -0.05, z]}>
          <boxGeometry args={[w, 0.6, d]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
        </mesh>
      ))}

      {/* Wave generator: a paddle along the left edge */}
      <mesh position={[-HALF + 0.15, 0.15, 0]}>
        <boxGeometry args={[0.12, 0.35, HALF * 2 - 0.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
      </mesh>

      {pieces.map(([z, len], i) => (
        <mesh key={i} position={[BAR_X, 0.1, z]}>
          <boxGeometry args={[0.12, 0.5, len]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}

      {/* Screen showing the fringes */}
      <mesh position={[SCREEN_X + 0.2, 0.35, 0]} rotation={[0, -Math.PI / 2, 0]} material={screenMat}>
        <planeGeometry args={[HALF * 2, 0.9]} />
      </mesh>
      <mesh position={[SCREEN_X + 0.27, 0.35, 0]}>
        <boxGeometry args={[0.06, 1.0, HALF * 2 + 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
      </mesh>
    </group>
  )
}
