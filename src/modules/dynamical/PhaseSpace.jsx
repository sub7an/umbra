// Van der Pol phase portrait:  ẋ = v,  v̇ = μ(1 − x²)v − x
//
// Layers, back to front:
//   • a shaded field plane: flow speed |f| as a soft heat map, faint grid,
//     and the v-nullcline μ(1 − x²)v = x where the flow is purely horizontal
//   • ~1,400 comet trails, each an independent initial condition, coloured by
//     speed, so the flow itself is visible as streaks converging on the cycle
//   • the limit cycle as a glowing tube with beads riding it at true speed
//   • the unstable focus at the origin, pulsing outward
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

// Phase space → scene scale factors
const SX = 1.3   // x ∈ [-2.7, 2.7] → X ∈ [-3.5, 3.5]
const SY = 0.62  // v ∈ [-4.5, 4.5] → Y ∈ [-2.8, 2.8]
const PW = 13.0, PH = 8.6  // field plane size (scene units)

function vanderpol(x, v, mu) {
  return [v, mu * (1 - x * x) * v - x]
}

function rkStep(x, v, mu, dt) {
  const [dx1, dv1] = vanderpol(x, v, mu)
  const [dx2, dv2] = vanderpol(x + dx1 * dt * 0.5, v + dv1 * dt * 0.5, mu)
  const [dx3, dv3] = vanderpol(x + dx2 * dt * 0.5, v + dv2 * dt * 0.5, mu)
  const [dx4, dv4] = vanderpol(x + dx3 * dt, v + dv3 * dt, mu)
  return [
    x + (dx1 + 2*dx2 + 2*dx3 + dx4) * dt / 6,
    v + (dv1 + 2*dv2 + 2*dv3 + dv4) * dt / 6,
  ]
}

// ── Field plane (speed heat map, grid, nullcline) ─────────────────────────────
const FIELD_VERT = /* glsl */`
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const FIELD_FRAG = /* glsl */`
uniform float uMu;
uniform vec2  uScale;
varying vec2 vPos;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  vec2 ph = vPos / uScale;               // (x, v)
  float x = ph.x, v = ph.y;
  float fx = v, fv = uMu * (1.0 - x * x) * v - x;
  float spd = length(vec2(fx, fv));

  // Heat map: deep navy at rest → teal → violet where the flow is fast
  float t = 1.0 - exp(-spd * 0.22);
  vec3 col = mix(vec3(0.020, 0.028, 0.055), vec3(0.02, 0.075, 0.10), smoothstep(0.0, 0.55, t));
  col = mix(col, vec3(0.075, 0.045, 0.13), smoothstep(0.55, 1.0, t));

  // Grid every 1 unit in phase coordinates, axes brighter
  vec2 g = abs(fract(ph + 0.5) - 0.5) / fwidth(ph);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  col += vec3(0.05, 0.07, 0.10) * grid * 0.5;
  vec2 a = abs(ph) / fwidth(ph);
  col += vec3(0.10, 0.16, 0.22) * (1.0 - min(min(a.x, a.y), 1.0));

  // v-nullcline: μ(1 − x²)v − x = 0  (flow is horizontal here)
  float gfun = uMu * (1.0 - x * x) * v - x;
  vec2 grad = vec2(-2.0 * uMu * x * v - 1.0, uMu * (1.0 - x * x));
  float d = abs(gfun) / max(length(grad), 1e-3);
  float px = length(fwidth(ph));
  col += lin(vec3(0.95, 0.45, 0.75)) * (1.0 - smoothstep(0.0, 1.6 * px, d)) * 0.35;

  // Vignette toward the plane edges
  vec2 e = abs(vPos) / vec2(${(PW / 2).toFixed(2)}, ${(PH / 2).toFixed(2)});
  col *= 1.0 - smoothstep(0.45, 1.0, length(e * vec2(0.9, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}
`

function FieldPlane({ mu }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: { uMu: { value: mu }, uScale: { value: new THREE.Vector2(SX, SY) } },
    extensions: { derivatives: true },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { mat.uniforms.uMu.value = mu }, [mat, mu])
  return (
    <mesh position={[0, 0, -0.05]} material={mat}>
      <planeGeometry args={[PW, PH]} />
    </mesh>
  )
}

// ── Comet trails ──────────────────────────────────────────────────────────────
const N_PART = 1400
const TL     = 16     // history samples per trail

function spawn(state, i) {
  // Seed uniformly over the visible plane, in phase coordinates
  state.x[i] = (Math.random() - 0.5) * (PW / SX) * 0.7
  state.v[i] = (Math.random() - 0.5) * (PH / SY) * 0.7
  state.age[i] = 0
  state.life[i] = 4 + Math.random() * 6
  for (let k = 0; k < TL; k++) {
    state.hx[i * TL + k] = state.x[i]
    state.hv[i * TL + k] = state.v[i]
  }
}

function CometTrails({ mu }) {
  const state = useMemo(() => {
    const s = {
      x: new Float32Array(N_PART), v: new Float32Array(N_PART),
      age: new Float32Array(N_PART), life: new Float32Array(N_PART),
      hx: new Float32Array(N_PART * TL), hv: new Float32Array(N_PART * TL),
      head: 0,
    }
    for (let i = 0; i < N_PART; i++) { spawn(s, i); s.age[i] = Math.random() * s.life[i] }
    return s
  }, [])

  // Each trail = (TL − 1) segments = 2(TL − 1) vertices
  const SEG = TL - 1
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_PART * SEG * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_PART * SEG * 6), 3))
    return g
  }, [SEG])
  useEffect(() => () => geo.dispose(), [geo])

  const tick = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * 0.55
    const s = state
    // Advance the ring-buffer head once every frame
    s.head = (s.head + 1) % TL
    tick.current++
    const pos = geo.attributes.position.array, col = geo.attributes.color.array
    for (let i = 0; i < N_PART; i++) {
      let x = s.x[i], v = s.v[i]
      s.age[i] += dt
      if (!isFinite(x) || !isFinite(v) || Math.abs(x) > 5 || Math.abs(v) > 8 || s.age[i] > s.life[i]) {
        spawn(s, i); x = s.x[i]; v = s.v[i]
      }
      ;[x, v] = rkStep(x, v, mu, dt)
      s.x[i] = x; s.v[i] = v
      s.hx[i * TL + s.head] = x
      s.hv[i * TL + s.head] = v

      const [fx, fv] = vanderpol(x, v, mu)
      const t = 1 - Math.exp(-Math.sqrt(fx * fx + fv * fv) * 0.25)
      // slow: teal (0.18,0.85,0.75) → fast: amber (1.0,0.72,0.25)
      const r = 0.18 + 0.82 * t, gg = 0.85 - 0.13 * t, b = 0.75 - 0.5 * t
      // Fade in at birth, out at death
      const env = Math.min(1, s.age[i] * 2) * Math.min(1, (s.life[i] - s.age[i]) * 1.5)

      const base = i * SEG * 6
      for (let k = 0; k < SEG; k++) {
        // k = 0 is the tail, k = SEG−1 touches the head
        const i0 = i * TL + ((s.head + 1 + k) % TL)
        const i1 = i * TL + ((s.head + 2 + k) % TL)
        const o = base + k * 6
        pos[o]     = s.hx[i0] * SX; pos[o + 1] = s.hv[i0] * SY; pos[o + 2] = 0.01
        pos[o + 3] = s.hx[i1] * SX; pos[o + 4] = s.hv[i1] * SY; pos[o + 5] = 0.01
        const a0 = (k / SEG) ** 1.4 * env * 1.5, a1 = ((k + 1) / SEG) ** 1.4 * env * 1.5
        col[o] = r * a0; col[o + 1] = gg * a0; col[o + 2] = b * a0
        col[o + 3] = r * a1; col[o + 4] = gg * a1; col[o + 5] = b * a1
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}

// ── Limit cycle: glowing tube + beads at true speed ──────────────────────────
function useCycle(mu) {
  return useMemo(() => {
    if (mu < 0.05) {
      // μ = 0: a family of circles, no attracting cycle; show the r = 2 circle faintly
      const pts = []
      for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push([2 * Math.cos(a), 2 * Math.sin(a)]) }
      return { pts, period: Math.PI * 2, dt: (Math.PI * 2) / 256, attracting: false }
    }
    let x = 2, v = 0
    const dt = 0.004
    for (let i = 0; i < 12000; i++) [x, v] = rkStep(x, v, mu, dt)
    // Record exactly one period: from one downward crossing of v = 0 to the next
    const down = () => {
      let prev = v
      for (let g = 0; g < 40000; g++) {
        ;[x, v] = rkStep(x, v, mu, dt)
        if (prev > 0 && v <= 0) return
        prev = v
      }
    }
    down()
    const pts = [[x, v]]
    let prevV = v
    for (let n = 0; n < 40000; n++) {
      ;[x, v] = rkStep(x, v, mu, dt)
      pts.push([x, v])
      if (prevV > 0 && v <= 0) break
      prevV = v
    }
    return { pts, period: pts.length * dt, dt, attracting: true }
  }, [mu])
}

function LimitCycle({ mu }) {
  const cyc = useCycle(mu)
  const tube = useMemo(() => {
    const step = Math.max(1, Math.floor(cyc.pts.length / 900))
    const v3 = []
    for (let i = 0; i < cyc.pts.length; i += step) v3.push(new THREE.Vector3(cyc.pts[i][0] * SX, cyc.pts[i][1] * SY, 0.03))
    const curve = new THREE.CatmullRomCurve3(v3, true)
    return new THREE.TubeGeometry(curve, Math.min(1400, v3.length * 2), 0.026, 10, true)
  }, [cyc])
  const glow = useMemo(() => {
    const step = Math.max(1, Math.floor(cyc.pts.length / 900))
    const v3 = []
    for (let i = 0; i < cyc.pts.length; i += step) v3.push(new THREE.Vector3(cyc.pts[i][0] * SX, cyc.pts[i][1] * SY, 0.02))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v3, true), Math.min(1400, v3.length * 2), 0.09, 8, true)
  }, [cyc])
  useEffect(() => () => { tube.dispose(); glow.dispose() }, [tube, glow])

  const beads = useRef([])
  const phase = useRef(0)
  useFrame((_, delta) => {
    // Beads travel in real phase-space time, so they visibly crawl along the
    // slow branches and whip around the fast jumps at large μ
    phase.current += Math.min(delta, 0.05) * 0.55
    const N = cyc.pts.length
    beads.current.forEach((b, k) => {
      if (!b) return
      const tt = (phase.current + (k / 3) * cyc.period) % cyc.period
      const idx = Math.min(N - 1, Math.floor(tt / cyc.dt))
      b.position.set(cyc.pts[idx][0] * SX, cyc.pts[idx][1] * SY, 0.06)
    })
  })

  const op = cyc.attracting ? 1 : 0.35
  return (
    <group>
      <mesh geometry={glow}>
        <meshBasicMaterial color="#7c8cff" transparent opacity={0.18 * op} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={tube}>
        <meshBasicMaterial color={[0.62 * 1.5, 0.68 * 1.5, 1.0 * 1.5]} transparent opacity={op} toneMapped={false} />
      </mesh>
      {cyc.attracting && [0, 1, 2].map((k) => (
        <group key={k} ref={(el) => (beads.current[k] = el)}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color={[2.2, 2.2, 2.4]} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color="#a5b4fc" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── Unstable focus at the origin: rings pulse outward ─────────────────────────
function FixedPoint({ mu }) {
  const rings = useRef([])
  useFrame(({ clock }) => {
    rings.current.forEach((r, k) => {
      if (!r) return
      const p = (clock.elapsedTime * 0.5 + k / 3) % 1
      r.scale.setScalar(0.15 + p * 0.9)
      r.material.opacity = mu > 0 ? (1 - p) * 0.5 : 0
    })
  })
  const col = mu > 0 ? '#f472b6' : '#7c8cff'
  return (
    <group position={[0, 0, 0.04]}>
      <mesh>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color={col} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(el) => (rings.current[k] = el)}>
          <ringGeometry args={[0.9, 1.0, 48]} />
          <meshBasicMaterial color={col} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PhaseSpace() {
  const mu = useModuleStore((s) => s.ds.phaseMu)
  return (
    <group>
      <FieldPlane mu={mu} />
      <CometTrails mu={mu} />
      <LimitCycle mu={mu} />
      <FixedPoint mu={mu} />
    </group>
  )
}
