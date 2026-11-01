// Binary black-hole inspiral → merger → ringdown, and the waves it sends out.
//
// The orbit shrinks as a(τ) ∝ τ^¼ (τ = time to merger, quadrupole radiation
// reaction), so the orbital frequency climbs as a^(−3/2) and the strain
// amplitude as 1/a: the classic chirp. After merger the remnant rings down at
// a fixed frequency with an exponential decay, then the cycle restarts.
//
// The emitted wave is recorded in a history buffer. Every point on the sheet
// reads it at its retarded time t − r/c, giving
//     h₊(r, θ) = A(t_r) · cos(2θ − Φ_gw(t_r)) / √r
// which draws the two-armed outgoing spiral. A ring of free test masses far
// out is stretched and squeezed by h₊ as the wave passes, and the corner card
// plots the strain a detector there would record.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneCard from '../../components/SceneCard'

const SIZE    = 11            // half-size of the sheet
const SEG     = 240
const C_WAVE  = 3.2           // wave speed (scene units / s)
const HIST_N  = 1024          // history samples
const HIST_DT = 1 / 120       // seconds per sample
const A0      = 1.6           // initial separation
const A_MERGE = 0.42          // separation at merger
const RING_T  = 3.2           // ringdown duration
const QUIET_T = 1.6           // pause before the next inspiral
const DET_R   = 8.2           // test-mass ring distance
const RING_N  = 28
const PLOT_N  = 180
const TRAIL_N = 90

// ── Sheet shader: height from the retarded history, lit and gridded ─────────
const VERT = /* glsl */`
  uniform sampler2D uHist;     // R = Φ_gw, G = amplitude
  uniform float uHead;         // index of newest sample
  uniform float uDepth;        // central potential well
  varying float vH;
  varying vec3  vN;
  varying vec3  vView;
  varying vec2  vXZ;
  const float N = ${HIST_N.toFixed(1)};
  const float DT = ${HIST_DT.toFixed(6)};
  const float C = ${C_WAVE.toFixed(2)};

  float height(vec2 p) {
    float r = length(p);
    float idx = uHead - (r / C) / DT;
    vec2 s = texture2D(uHist, vec2((mod(idx, N) + 0.5) / N, 0.5)).rg;
    float th = atan(p.y, p.x);
    float wave = s.g * cos(2.0 * th - s.r) / sqrt(r + 0.6);
    wave *= smoothstep(0.5, 1.6, r) * (1.0 - smoothstep(${(SIZE - 1.8).toFixed(1)}, ${SIZE.toFixed(1)}, max(abs(p.x), abs(p.y))));
    // Valid only where the history reaches
    wave *= step(r / C, (N - 2.0) * DT);
    float well = -uDepth / sqrt(r * r + 0.6);
    return wave + well;
  }
  void main() {
    vec2 p = position.xz;
    float e = ${(2 * SIZE / SEG).toFixed(4)};
    float h  = height(p);
    float hx = height(p + vec2(e, 0.0));
    float hz = height(p + vec2(0.0, e));
    vec3 n = normalize(vec3(h - hx, e, h - hz));
    vH = h; vXZ = p;
    vN = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p.x, h, p.y, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const FRAG = /* glsl */`
  uniform float uDepth;
  varying float vH;
  varying vec3  vN;
  varying vec3  vView;
  varying vec2  vXZ;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    float r = length(vXZ);
    float w = vH + uDepth / sqrt(r * r + 0.6);         // wave part only
    float t = clamp(w * 1.6, -1.0, 1.0);
    vec3 trough = lin(vec3(0.10, 0.30, 0.95));
    vec3 mid    = lin(vec3(0.05, 0.05, 0.14));
    vec3 crest  = lin(vec3(1.00, 0.55, 0.20));
    vec3 base = t < 0.0 ? mix(mid, trough, -t * 0.75) : mix(mid, crest, t * 0.75);

    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.3, 1.0, 0.4));
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec2 g = abs(fract(vXZ / 0.5 + 0.5) - 0.5) * 0.5 / fwidth(vXZ);
    float grid = 1.0 - min(min(g.x, g.y), 1.0);
    vec3 gridCol = lin(vec3(0.55, 0.45, 1.0));

    vec3 col = base * (0.45 + 0.8 * diff) + vec3(1.0) * spec * 0.25 + gridCol * grid * (0.10 + abs(t) * 0.35) + lin(vec3(0.4, 0.35, 0.9)) * fres * 0.15;
    float edge = 1.0 - smoothstep(${(SIZE - 2.5).toFixed(1)}, ${SIZE.toFixed(1)}, max(abs(vXZ.x), abs(vXZ.y)));
    gl_FragColor = vec4(col * edge, 1.0);
  }
`

// ── A black hole: dark sphere with a lensing glow ring ───────────────────────
function BlackHole({ innerRef, r }) {
  return (
    <group ref={innerRef}>
      <mesh>
        <sphereGeometry args={[r, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh>
        <sphereGeometry args={[r * 1.9, 32, 32]} />
        <meshBasicMaterial color="#ffb366" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[r * 1.25, 32, 32]} />
        <meshBasicMaterial color={[2.0, 1.2, 0.6]} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function GravitationalWaves({ mass }) {
  // Larger mass: stronger waves and a faster, deeper chirp
  const T_INSP = 14 / Math.sqrt(mass)
  const amp0   = 0.10 + mass * 0.035

  const hist = useMemo(() => {
    const data = new Float32Array(HIST_N * 4)
    const tex = new THREE.DataTexture(data, HIST_N, 1, THREE.RGBAFormat, THREE.FloatType)
    tex.minFilter = tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return { data, tex, head: 0 }
  }, [])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uHist: { value: hist.tex }, uHead: { value: 0 }, uDepth: { value: 0.3 } },
    side: THREE.DoubleSide,
  }), [hist])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE * 2, SIZE * 2, SEG, SEG)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  useEffect(() => () => { geo.dispose(); mat.dispose(); hist.tex.dispose() }, [geo, mat, hist])
  useEffect(() => { mat.uniforms.uDepth.value = 0.15 + mass * 0.07 }, [mat, mass])

  // Binary state
  const sim = useRef({ phase: 0, t: 0, stage: 'insp', acc: 0 })
  const bh1 = useRef(), bh2 = useRef(), rem = useRef()
  // One fading trail per hole (newest point first)
  const trail = useMemo(() => {
    const mk = () => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3))
      g.setDrawRange(0, 0)
      return g
    }
    return { gs: [mk(), mk()], n: 0 }
  }, [])
  useEffect(() => () => trail.gs.forEach((g) => g.dispose()), [trail])

  // Test-mass ring
  const ringGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_N * 3), 3))
    return g
  }, [])
  const ringLine = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RING_N + 1) * 3), 3))
    return g
  }, [])
  useEffect(() => () => { ringGeo.dispose(); ringLine.dispose() }, [ringGeo, ringLine])

  const pathRef = useRef()

  useFrame((_, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 0.05)
    s.acc += dt
    // Advance the binary in fixed history steps so the buffer is frame-rate independent
    while (s.acc >= HIST_DT) {
      s.acc -= HIST_DT
      s.t += HIST_DT
      let a = A0, A = 0, phiGw = 0
      if (s.stage === 'insp') {
        const tau = Math.max(T_INSP - s.t, 1e-3)
        a = A0 * Math.pow(tau / T_INSP, 0.25)
        const omega = 1.25 * Math.pow(A0 / a, 1.5)
        s.phase += omega * HIST_DT
        A = amp0 * (A0 / a)
        if (a <= A_MERGE) { s.stage = 'ring'; s.t = 0; s.aLast = a; s.omegaLast = omega; s.Alast = A }
        s.a = a
      } else if (s.stage === 'ring') {
        const omegaR = s.omegaLast * 1.35
        s.phase += omegaR * HIST_DT
        A = s.Alast * Math.exp(-s.t / 0.45)
        if (s.t > RING_T) { s.stage = 'quiet'; s.t = 0 }
      } else {
        A = 0
        if (s.t > QUIET_T) { s.stage = 'insp'; s.t = 0; s.phase = 0; s.a = A0; trail.n = 0 }
      }
      phiGw = 2 * s.phase
      hist.head = (hist.head + 1) % HIST_N
      hist.data[hist.head * 4] = phiGw
      hist.data[hist.head * 4 + 1] = A
    }
    hist.tex.needsUpdate = true
    mat.uniforms.uHead.value = hist.head

    // Bodies
    const inspiral = s.stage === 'insp'
    const a = inspiral ? s.a ?? A0 : 0
    const c = Math.cos(s.phase), sn = Math.sin(s.phase)
    if (bh1.current) { bh1.current.visible = inspiral; bh1.current.position.set(a / 2 * c, 0.05, a / 2 * sn) }
    if (bh2.current) { bh2.current.visible = inspiral; bh2.current.position.set(-a / 2 * c, 0.05, -a / 2 * sn) }
    if (rem.current) {
      rem.current.visible = !inspiral
      const k = s.stage === 'ring' ? 1 + 0.08 * Math.exp(-s.t / 0.45) * Math.sin(s.t * 18) : 1
      rem.current.scale.setScalar(k)
    }
    // Orbit trails
    if (inspiral) {
      if (trail.n < TRAIL_N) trail.n++
      trail.gs.forEach((g, k) => {
        const p = g.attributes.position.array
        const sgn = k === 0 ? 1 : -1
        p.copyWithin(3, 0, (TRAIL_N - 1) * 3)
        p[0] = sgn * a / 2 * c; p[1] = 0.05; p[2] = sgn * a / 2 * sn
        g.attributes.position.needsUpdate = true
        g.setDrawRange(0, trail.n)
      })
    } else trail.gs.forEach((g) => g.setDrawRange(0, 0))

    // Retarded sample at the detector ring (θ = 0, so h₊ = A cos(−Φ))
    const sampleAt = (r, back = 0) => {
      const idx = Math.round(hist.head - (r / C_WAVE) / HIST_DT - back)
      const j = ((idx % HIST_N) + HIST_N) % HIST_N
      return hist.data[j * 4 + 1] * Math.cos(-hist.data[j * 4]) / Math.sqrt(r + 0.6)
    }
    const h = sampleAt(DET_R) * 2.2
    const rp = ringGeo.attributes.position.array, lp = ringLine.attributes.position.array
    for (let i = 0; i <= RING_N; i++) {
      const th = (i / RING_N) * Math.PI * 2
      const y = Math.cos(th) * 0.8 * (1 + h), z = Math.sin(th) * 0.8 * (1 - h)
      if (i < RING_N) { rp[i * 3] = 0; rp[i * 3 + 1] = y; rp[i * 3 + 2] = z }
      lp[i * 3] = 0; lp[i * 3 + 1] = y; lp[i * 3 + 2] = z
    }
    ringGeo.attributes.position.needsUpdate = true
    ringLine.attributes.position.needsUpdate = true

    // Strain plot in the corner card
    if (pathRef.current) {
      let d = ''
      for (let k = 0; k < PLOT_N; k++) {
        const v = sampleAt(DET_R, (PLOT_N - 1 - k) * 3)
        const x = (k / (PLOT_N - 1)) * 180, y = 28 - Math.max(-26, Math.min(26, v * 260))
        d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
      }
      pathRef.current.setAttribute('d', d)
    }
  })

  return (
    <group>
      <mesh geometry={geo} material={mat} frustumCulled={false} />

      <BlackHole innerRef={bh1} r={0.16} />
      <BlackHole innerRef={bh2} r={0.13} />
      <BlackHole innerRef={rem} r={0.24} />
      {trail.gs.map((g, k) => (
        <line key={k} geometry={g} frustumCulled={false}>
          <lineBasicMaterial color="#fdba74" transparent opacity={0.4} />
        </line>
      ))}

      {/* Free test masses: a ring transverse to the wave's direction */}
      <group position={[DET_R, 1.3, 0]}>
        <points geometry={ringGeo}>
          <pointsMaterial size={0.11} color={[2.0, 2.0, 2.2]} toneMapped={false} />
        </points>
        <line geometry={ringLine}>
          <lineBasicMaterial color="#a5b4fc" transparent opacity={0.5} />
        </line>
        <mesh position={[0, -0.95, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      <SceneCard>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Detector strain h₊</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 6 }}>
            What the ring of test masses feels: a rising chirp, then ringdown.
          </div>
          <svg width="180" height="56" viewBox="0 0 180 56" style={{ display: 'block' }}>
            <line x1="0" y1="28" x2="180" y2="28" stroke="rgb(var(--c-border))" strokeWidth="1" />
            <path ref={pathRef} fill="none" stroke="#a5b4fc" strokeWidth="1.5" />
          </svg>
        </div>
      </SceneCard>
    </group>
  )
}
