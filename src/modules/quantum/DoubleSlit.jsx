// Double slit, seen from above.
//
// A shader draws the wave itself: a circular wave from the source, and beyond
// the barrier the Huygens sum of two slit wavelets, each with its single-slit
// envelope sinc(k·a·sinθ/2). Bright bands are crests; the dark rays fanning out
// between them are the nodal lines where the two wavelets cancel. A soft glow
// shows the time-averaged intensity.
//
// With "measure which slit" on, the cross term is gone: the two wavelets are
// drawn in separate tints and simply add in intensity, so the nodal rays vanish.
//
// On the detector, single particle hits accumulate one by one, sampled from
// the same intensity, and the fringe pattern builds up out of random dots.
import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

const SOURCE_X  = -4.2
const BARRIER_X = 0
const SCREEN_X  = 3.8
const HALF_H    = 3.2       // half-height of the field and the detector
const SLIT_SEP  = 1.0       // d
const SLIT_W    = 0.22      // a, slit width
const D         = SCREEN_X - BARRIER_X
const MAX_HITS  = 4000
const HIT_RATE  = 60        // hits per second
const STRIP_W   = 0.45      // detector face width (hits scatter across it)

// Detector intensity at height y (far-field, normalised to ≤ 1)
function sinc(x) { return Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x }
function screenIntensity(y, lambda, measured) {
  const k = (2 * Math.PI) / lambda
  if (measured) {
    // Incoherent sum of the two single-slit patterns, each centred on its slit
    const e = (yy) => sinc(0.5 * k * SLIT_W * yy / Math.hypot(yy, D)) ** 2
    return 0.5 * (e(y - SLIT_SEP / 2) + e(y + SLIT_SEP / 2))
  }
  const s = y / Math.hypot(y, D)
  return Math.cos(0.5 * k * SLIT_SEP * s) ** 2 * sinc(0.5 * k * SLIT_W * s) ** 2
}
function sampleHit(lambda, measured) {
  for (let i = 0; i < 300; i++) {
    const y = (Math.random() * 2 - 1) * HALF_H
    if (Math.random() < screenIntensity(y, lambda, measured)) return y
  }
  return 0
}

// ── Wave field ────────────────────────────────────────────────────────────────
const FIELD_VERT = /* glsl */`
varying vec2 vPos;
void main() {
  vPos = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`
const FIELD_FRAG = /* glsl */`
uniform float uK, uT, uMeasured;
varying vec2 vPos;
const float SRC = ${SOURCE_X.toFixed(2)};
const float BAR = ${BARRIER_X.toFixed(2)};
const float SCR = ${SCREEN_X.toFixed(2)};
const float HD  = ${(SLIT_SEP / 2).toFixed(3)};
const float A   = ${SLIT_W.toFixed(3)};
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float sinc(float x) { return abs(x) < 1e-4 ? 1.0 : sin(x) / x; }

void main() {
  vec2 p = vPos;
  vec3 crestA = lin(vec3(0.55, 0.62, 1.0));   // brand violet-blue
  vec3 crestB = lin(vec3(1.0, 0.70, 0.35));   // amber (second slit, when measured)
  vec3 col = vec3(0.006, 0.008, 0.016);

  if (p.x < BAR) {
    float r = length(p - vec2(SRC, 0.0));
    float amp = 1.15 / sqrt(r + 0.5);
    float w = cos(uK * r - uT) * amp;
    col += crestA * (max(w, 0.0) * 0.75 + max(-w, 0.0) * 0.06);
    col += crestA * amp * amp * 0.10;
  } else if (p.x < SCR) {
    vec2 s1 = vec2(BAR, HD), s2 = vec2(BAR, -HD);
    float L  = length(s1 - vec2(SRC, 0.0));      // same for both slits
    vec2 d1 = p - s1, d2 = p - s2;
    float r1 = length(d1), r2 = length(d2);
    float e1 = sinc(0.5 * uK * A * d1.y / max(r1, 1e-3));
    float e2 = sinc(0.5 * uK * A * d2.y / max(r2, 1e-3));
    // Forward-only wavelets, fading in over the first wavelength
    float f1 = smoothstep(0.0, 0.25, d1.x), f2 = smoothstep(0.0, 0.25, d2.x);
    float a1 = 0.95 * e1 * f1 / sqrt(r1 + 0.2), a2 = 0.95 * e2 * f2 / sqrt(r2 + 0.2);
    float ph1 = uK * (r1 + L) - uT, ph2 = uK * (r2 + L) - uT;
    float w1 = a1 * cos(ph1), w2 = a2 * cos(ph2);
    if (uMeasured < 0.5) {
      float w = w1 + w2;
      float I = 0.5 * (a1 * a1 + a2 * a2 + 2.0 * a1 * a2 * cos(ph1 - ph2));
      col += crestA * (max(w, 0.0) * 0.6 + max(-w, 0.0) * 0.05);
      col += crestA * I * 0.35;
    } else {
      col += crestA * (max(w1, 0.0) * 0.55 + a1 * a1 * 0.18);
      col += crestB * (max(w2, 0.0) * 0.55 + a2 * a2 * 0.18);
    }
  }
  // Fade at the top and bottom of the field
  col *= 1.0 - smoothstep(${(HALF_H - 0.6).toFixed(2)}, ${HALF_H.toFixed(2)}, abs(p.y));
  gl_FragColor = vec4(col, 1.0);
}
`

function WaveField({ lambda, measured }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
    uniforms: { uK: { value: 1 }, uT: { value: 0 }, uMeasured: { value: 0 } },
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    mat.uniforms.uK.value = (2 * Math.PI) / lambda
    mat.uniforms.uMeasured.value = measured ? 1 : 0
  }, [mat, lambda, measured])
  useFrame((_, delta) => { mat.uniforms.uT.value += Math.min(delta, 0.05) * 4.0 })
  const W = SCREEN_X - SOURCE_X + 0.6
  return (
    <mesh position={[(SOURCE_X - 0.6 + SCREEN_X) / 2, 0, -0.02]} material={mat}>
      <planeGeometry args={[W, HALF_H * 2]} />
    </mesh>
  )
}

// ── Barrier with two slits ────────────────────────────────────────────────────
function Barrier() {
  const T = 0.14, Z = 0.3
  const gapTop = SLIT_SEP / 2 + SLIT_W / 2, gapBot = SLIT_SEP / 2 - SLIT_W / 2
  const outerH = HALF_H - gapTop
  const segs = [
    [ (HALF_H + gapTop) / 2, outerH],
    [-(HALF_H + gapTop) / 2, outerH],
    [0, gapBot * 2],
  ]
  return (
    <group position={[BARRIER_X - T / 2, 0, 0]}>
      {segs.map(([y, h], i) => (
        <mesh key={i} position={[0, y, 0.04]}>
          <boxGeometry args={[T, h, Z]} />
          <meshStandardMaterial color="#2a3240" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// ── Source emitter ────────────────────────────────────────────────────────────
function Source() {
  const glow = useRef()
  useFrame(({ clock }) => {
    if (glow.current) glow.current.scale.setScalar(1 + 0.15 * Math.sin(clock.elapsedTime * 4))
  })
  return (
    <group position={[SOURCE_X, 0, 0.05]}>
      <mesh>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial color={[2.2, 2.3, 3.0]} toneMapped={false} />
      </mesh>
      <mesh ref={glow}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial color="#8b9cff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[-0.35, 0, -0.02]}>
        <boxGeometry args={[0.5, 0.5, 0.3]} />
        <meshStandardMaterial color="#1f2632" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  )
}

// ── Detector: accumulating hits + intensity curve ─────────────────────────────
function useDotTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32)
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])
}

function Detector({ lambda, measured }) {
  const tex = useDotTexture()
  const hits = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_HITS * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_HITS * 3), 3))
    g.setDrawRange(0, 0)
    return { g, n: 0, acc: 0 }
  }, [])
  useEffect(() => () => { hits.g.dispose(); tex.dispose() }, [hits, tex])
  useEffect(() => { hits.n = 0; hits.acc = 0; hits.g.setDrawRange(0, 0) }, [hits, lambda, measured])

  useFrame((_, delta) => {
    if (hits.n >= MAX_HITS) return
    hits.acc += Math.min(delta, 0.5) * HIT_RATE
    const pos = hits.g.attributes.position.array, col = hits.g.attributes.color.array
    while (hits.acc >= 1 && hits.n < MAX_HITS) {
      hits.acc -= 1
      const i = hits.n++
      const y = sampleHit(lambda, measured)
      pos[i * 3] = SCREEN_X + 0.06 + Math.random() * (STRIP_W - 0.12)
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = 0.09
      const warm = Math.random()
      col[i * 3] = 0.85 + 0.15 * warm; col[i * 3 + 1] = 0.8 + 0.1 * warm; col[i * 3 + 2] = 1.0 - 0.3 * warm
    }
    hits.g.attributes.position.needsUpdate = true
    hits.g.attributes.color.needsUpdate = true
    hits.g.setDrawRange(0, hits.n)
  })

  const curve = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 240; i++) {
      const y = -HALF_H + (i / 240) * 2 * HALF_H
      pts.push([SCREEN_X + STRIP_W + 0.12 + screenIntensity(y, lambda, measured) * 0.9, y, 0.05])
    }
    return pts
  }, [lambda, measured])

  return (
    <group>
      {/* Detector panel */}
      <mesh position={[SCREEN_X + STRIP_W / 2, 0, 0]}>
        <boxGeometry args={[STRIP_W, HALF_H * 2, 0.12]} />
        <meshStandardMaterial color="#0b0f17" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[SCREEN_X + STRIP_W + 0.04, 0, 0]}>
        <boxGeometry args={[0.05, HALF_H * 2 + 0.1, 0.16]} />
        <meshStandardMaterial color="#2a3240" metalness={0.85} roughness={0.3} />
      </mesh>
      <points geometry={hits.g} frustumCulled={false}>
        <pointsMaterial size={0.09} map={tex} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <Line points={[[SCREEN_X + STRIP_W + 0.12, -HALF_H, 0.05], [SCREEN_X + STRIP_W + 0.12, HALF_H, 0.05]]} color="#334155" lineWidth={1} />
      <Line points={curve} color="#fbbf24" lineWidth={2} />
    </group>
  )
}

export default function DoubleSlit() {
  const lambda   = useModuleStore((s) => s.qm.slitWavelength)
  const measured = useModuleStore((s) => s.qm.slitMeasured)
  return (
    <group position={[0.05, 0, 0]}>
      <WaveField lambda={lambda} measured={measured} />
      <Source />
      <Barrier />
      <Detector lambda={lambda} measured={measured} />
    </group>
  )
}
