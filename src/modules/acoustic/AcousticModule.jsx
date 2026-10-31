import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell from '../../components/ModuleShell'
import useModuleStore from '../../store/useModuleStore'

const ACCENT = '#a855f7'

const VIEWS = [
  { id: 'cymatics',  label: 'Cymatics' },
  { id: 'harmonics', label: 'Harmonics' },
  { id: 'lissajous', label: 'Lissajous' },
]
const CAMERA = {
  cymatics:  [0, 3.1, 2.1],
  harmonics: [0, 0, 7.2],
  lissajous: [0, 0, 6.6],
}

// Chladni modes — f_mn = 100·√(m²+n²)
// Free square plate modes (m ≠ n; for m = n the Chladni combination vanishes).
// f = 100·√(m² + n²) Hz keeps frequency rising with pattern complexity.
const CHLADNI_MODES = [
  { m:1, n:2, label:'(1,2)', freq:224, note:'A3' },
  { m:1, n:3, label:'(1,3)', freq:316, note:'Eb4' },
  { m:2, n:3, label:'(2,3)', freq:361, note:'F#4' },
  { m:1, n:4, label:'(1,4)', freq:412, note:'Ab4' },
  { m:2, n:4, label:'(2,4)', freq:447, note:'A4' },
  { m:3, n:4, label:'(3,4)', freq:500, note:'B4' },
  { m:1, n:5, label:'(1,5)', freq:510, note:'C5' },
  { m:2, n:5, label:'(2,5)', freq:539, note:'C#5' },
  { m:3, n:5, label:'(3,5)', freq:583, note:'D5' },
  { m:4, n:5, label:'(4,5)', freq:640, note:'Eb5' },
]

// Harmonics of C3 (130.8 Hz)
const C3 = 130.8
const HARMONIC_COLORS = ['#FF6B6B','#FFB347','#FFD166','#A8E063','#00D4FF','#6677FF','#BB66FF','#FF77BB']
const HARMONIC_NOTES  = ['C3','C4','G4','C5','E5','G5','Bb5','C6']

// Lissajous musical intervals
const LISSAJOUS_PRESETS = [
  { a:1, b:1, name:'Unison',         ratio:'1:1', color:'#00D4FF' },
  { a:1, b:2, name:'Octave',         ratio:'1:2', color:'#FFD166' },
  { a:2, b:3, name:'Perfect Fifth',  ratio:'2:3', color:'#A8E063' },
  { a:3, b:4, name:'Perfect Fourth', ratio:'3:4', color:'#FF6B6B' },
  { a:4, b:5, name:'Major Third',    ratio:'4:5', color:'#FF77BB' },
  { a:5, b:6, name:'Minor Third',    ratio:'5:6', color:'#BB66FF' },
  { a:3, b:5, name:'Major Sixth',    ratio:'3:5', color:'#FFB347' },
  { a:5, b:8, name:'Minor Sixth',    ratio:'5:8', color:'#6677FF' },
]

// ── Web Audio (module-level singleton) ────────────────────────────────────────
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}
function playTone(freq, duration = 1.2, type = 'sine', vol = 0.22) {
  const ctx  = getAudioCtx()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.value = freq
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.012)
  gain.gain.setValueAtTime(vol, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYMATICS SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const N_PARTICLES = 3200

function CymaticsScene({ modeIdx, scatterToken }) {
  const meshRef = useRef()
  const posRef  = useRef()
  const velRef  = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  const scatter = useCallback(() => {
    if (!posRef.current) return
    for (let i = 0; i < N_PARTICLES; i++) {
      posRef.current[i*2]   = (Math.random() - 0.5) * 1.88
      posRef.current[i*2+1] = (Math.random() - 0.5) * 1.88
      velRef.current[i*2]   = (Math.random() - 0.5) * 0.04
      velRef.current[i*2+1] = (Math.random() - 0.5) * 0.04
    }
  }, [])

  useEffect(() => {
    posRef.current = new Float32Array(N_PARTICLES * 2)
    velRef.current = new Float32Array(N_PARTICLES * 2)
    scatter()
  }, [scatter])

  // Re-scatter on every mode change (pads, mic, tutor, share links), not just pad taps
  useEffect(() => { scatter() }, [scatterToken, modeIdx, scatter])

  useFrame((_, delta) => {
    if (!meshRef.current || !posRef.current) return
    const { m, n } = CHLADNI_MODES[modeIdx]
    const dt   = Math.min(delta, 0.033)
    const DAMP = 0.86, NOISE = 0.0012, FORCE = 0.16

    for (let i = 0; i < N_PARTICLES; i++) {
      let x = posRef.current[i*2], y = posRef.current[i*2+1]
      let vx = velRef.current[i*2], vy = velRef.current[i*2+1]
      // Chladni plate (free edges): u = cos(nπX)cos(mπY) − cos(mπX)cos(nπY),
      // X,Y ∈ [0,1]. Sand is pushed down |u| onto the curved nodal lines.
      const X = (x + 1) * 0.5, Y = (y + 1) * 0.5
      const kn = n * Math.PI, km = m * Math.PI
      const cnX = Math.cos(kn * X), cmY = Math.cos(km * Y), cmX = Math.cos(km * X), cnY = Math.cos(kn * Y)
      const u    = cnX * cmY - cmX * cnY
      const dudx = 0.5 * (-kn * Math.sin(kn * X) * cmY + km * Math.sin(km * X) * cnY)
      const dudy = 0.5 * (-km * cnX * Math.sin(km * Y) + kn * cmX * Math.sin(kn * Y))
      // Smooth descent of u²/2 (force −u∇u): fades to zero on the nodal line, so sand
      // settles all along it instead of jittering across and piling up at crossings
      vx = (vx - u * dudx * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP
      vy = (vy - u * dudy * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP
      x += vx; y += vy
      if (x < -0.97) { x = -0.97; vx =  Math.abs(vx) * 0.3 }
      if (x >  0.97) { x =  0.97; vx = -Math.abs(vx) * 0.3 }
      if (y < -0.97) { y = -0.97; vy =  Math.abs(vy) * 0.3 }
      if (y >  0.97) { y =  0.97; vy = -Math.abs(vy) * 0.3 }
      posRef.current[i*2]   = x;  posRef.current[i*2+1]  = y
      velRef.current[i*2]   = vx; velRef.current[i*2+1]  = vy
      dummy.position.set(x, 0.018, y)
      dummy.scale.setScalar(0.0095)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Brushed-steel plate on a central stem (driven from the centre) */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[2.06, 0.04, 2.06]} />
        <meshStandardMaterial color="#2b3442" metalness={0.85} roughness={0.38} />
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.56, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, N_PARTICLES]}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial color="#f5e6c4" emissive="#8a6a3a" emissiveIntensity={0.25} roughness={0.9} />
      </instancedMesh>
      <directionalLight position={[1, 5, 2]} intensity={0.8} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARMONICS SCENE — eight strings on an instrument body, each drawn by a shader
// that renders the standing wave y = A·sin(nπx)·cos(ωt): a glowing string, its
// ±A envelope as a faint band, and bright nodes where the string never moves.
// ═══════════════════════════════════════════════════════════════════════════════
const S_LEN = 2.8          // speaking length between the bridges
const S_GAP = 0.66         // spacing between strings
const S_H   = 1.7          // shader plane height (room for big plucks)

const STRING_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const STRING_FRAG = /* glsl */`
uniform float uN;       // harmonic number
uniform float uDisp;    // current signed amplitude A·cos(ωt)
uniform float uEnv;     // envelope amplitude A
uniform vec3  uColor;
uniform float uActive;  // 0..1
uniform float uHover;
varying vec2 vUv;
void main() {
  float x = vUv.x;
  float y = (vUv.y - 0.5) * ${S_H.toFixed(2)};
  float s = sin(uN * 3.14159265 * x);
  float d = abs(y - s * uDisp);
  float px = fwidth(y);

  vec3 col = pow(uColor, vec3(2.2));
  float core = 1.0 - smoothstep(0.0, 1.8 * px, d);
  float glow = exp(-d / 0.035) * 0.55 + exp(-d / 0.12) * 0.18;
  // Envelope band: the region the string sweeps through
  float env = abs(s) * uEnv;
  float band = (1.0 - smoothstep(env - px, env + px, abs(y))) * 0.07;
  float edge = (1.0 - smoothstep(0.0, 1.2 * px, abs(abs(y) - env))) * 0.22 * step(0.02, uEnv);
  // Nodes: x = k/n, where the string stays still
  float k = fract(x * uN + 0.5) - 0.5;
  float nd = length(vec2(k / uN * ${S_LEN.toFixed(2)}, y));
  float node = exp(-nd * nd / 0.0012) * 1.4 + exp(-nd / 0.05) * 0.25;
  node *= step(0.5, uN * min(x, 1.0 - x) + 0.5);   // skip the fixed ends

  float a = (core * 1.6 + glow + band + edge) * (0.12 + 0.88 * uActive) * (1.0 + 0.4 * uHover);
  vec3 c = col * a + vec3(1.0, 0.97, 0.9) * node * uActive;
  gl_FragColor = vec4(c, 1.0);
}
`

function StringWave({ n, color, matRef }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STRING_VERT, fragmentShader: STRING_FRAG,
    uniforms: {
      uN: { value: n }, uDisp: { value: 0 }, uEnv: { value: 0 },
      uColor: { value: new THREE.Color(color) }, uActive: { value: 1 }, uHover: { value: 0 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    extensions: { derivatives: true },
  }), [n, color])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { matRef(mat) }, [mat, matRef])
  return (
    <mesh material={mat} position={[0, 0, 0.02]}>
      <planeGeometry args={[S_LEN, S_H]} />
    </mesh>
  )
}

function InstrumentBody() {
  const H = S_GAP * 8 + 0.4
  return (
    <group>
      {/* Soundboard */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[S_LEN + 1.3, H, 0.12]} />
        <meshStandardMaterial color="#1c140e" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Inlay strip along each edge */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * (H / 2 - 0.05), -0.055]}>
          <boxGeometry args={[S_LEN + 1.3, 0.03, 0.01]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.35} metalness={0.5} />
        </mesh>
      ))}
      {/* Nut and bridge */}
      {[-S_LEN / 2, S_LEN / 2].map((x) => (
        <mesh key={x} position={[x, 0, -0.02]}>
          <boxGeometry args={[0.07, H - 0.2, 0.12]} />
          <meshStandardMaterial color="#e8e0cc" roughness={0.3} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}

function HarmonicsScene({ focusN, onPluck }) {
  const pluckRef = useRef(new Array(8).fill(null))
  const hoverRef = useRef(null)
  const mats     = useRef([])
  const setters  = useMemo(() => Array.from({ length: 8 }, (_, i) => (m) => { mats.current[i] = m }), [])

  const handleClick = useCallback((n) => {
    pluckRef.current[n-1] = performance.now()
    onPluck(n)
  }, [onPluck])

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const now = performance.now()
    for (let n = 1; n <= 8; n++) {
      const m = mats.current[n-1]
      if (!m) continue
      const pluckTime = pluckRef.current[n-1]
      const pluckAge  = pluckTime ? (now - pluckTime) / 1000 : null
      if (pluckAge !== null && pluckAge > 3.5) pluckRef.current[n-1] = null
      const isPlucked = pluckAge !== null && pluckAge <= 3.5
      const pluckGain = isPlucked ? Math.exp(-pluckAge * 1.8) : 0
      const isActive  = focusN === null || focusN === n
      const amp = (isActive ? 0.22 : 0.05) + pluckGain * 0.55
      const u = m.uniforms
      u.uDisp.value = amp * Math.cos(n * 1.8 * t)
      u.uEnv.value = amp
      u.uActive.value += ((isActive ? 1 : 0) - u.uActive.value) * 0.15
      u.uHover.value  += ((hoverRef.current === n ? 1 : 0) - u.uHover.value) * 0.2
    }
  })

  return (
    <group>
      <InstrumentBody />
      {HARMONIC_COLORS.map((color, i) => {
        const n = i + 1
        const yOff = -(n - 4.5) * S_GAP
        return (
          <group key={n} position={[0, yOff, 0]}>
            <StringWave n={n} color={color} matRef={setters[i]} />
            {/* Tuning peg past the nut */}
            <mesh position={[-S_LEN / 2 - 0.38, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.1, 20]} />
              <meshStandardMaterial color="#d4b878" metalness={0.9} roughness={0.25} />
            </mesh>
            {/* Invisible clickable hit-zone */}
            <mesh
              position={[0, 0, 0.05]}
              onClick={(e) => { e.stopPropagation(); handleClick(n) }}
              onPointerEnter={() => { hoverRef.current = n; document.body.style.cursor = 'pointer' }}
              onPointerLeave={() => { if (hoverRef.current === n) hoverRef.current = null; document.body.style.cursor = '' }}
            >
              <planeGeometry args={[S_LEN, 0.52]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISSAJOUS SCENE — an oscilloscope in X–Y mode. A phosphor beam traces
// x = sin(a·t), y = sin(b·t + φ); the two input signals scroll out of the
// screen along the bottom and left edges so you can see what builds the figure.
// ═══════════════════════════════════════════════════════════════════════════════
const LIS_TRAIL = 2000
const LIS_R     = 1.5     // beam deflection
const SCREEN    = 1.75    // half-size of the screen
const STRIP_K   = 260     // samples in each side signal strip
const STRIP_DY  = 0.0042  // spacing of strip samples

const SCOPE_FRAG = /* glsl */`
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0 * ${SCREEN.toFixed(2)};
  vec3 col = vec3(0.006, 0.014, 0.012);
  // 8×8 graticule with minor ticks on the centre lines
  float div = ${(SCREEN / 4).toFixed(4)};
  vec2 g = abs(fract(p / div + 0.5) - 0.5) * div / fwidth(p);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  vec2 c = abs(p) / fwidth(p);
  float axes = 1.0 - min(min(c.x, c.y), 1.0);
  vec2 m = abs(fract(p / (div / 5.0) + 0.5) - 0.5) * (div / 5.0) / fwidth(p);
  float minor = (1.0 - min(m.x, 1.0)) * step(abs(p.y), 0.05) + (1.0 - min(m.y, 1.0)) * step(abs(p.x), 0.05);
  col += vec3(0.04, 0.09, 0.08) * (grid * 0.6 + axes * 0.8 + minor * 0.6);
  // Curved-glass falloff
  float r = length(p / ${SCREEN.toFixed(2)});
  col *= 1.0 - 0.45 * r * r;
  gl_FragColor = vec4(col, 1.0);
}
`

function Scope() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STRING_VERT, fragmentShader: SCOPE_FRAG, extensions: { derivatives: true },
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  const W = SCREEN * 2
  return (
    <group>
      <mesh position={[0, 0, -0.03]} material={mat}>
        <planeGeometry args={[W, W]} />
      </mesh>
      {/* Bezel */}
      {[[0, SCREEN + 0.06, W + 0.24, 0.12], [0, -SCREEN - 0.06, W + 0.24, 0.12], [SCREEN + 0.06, 0, 0.12, W], [-SCREEN - 0.06, 0, 0.12, W]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, -0.02]}>
          <boxGeometry args={[w, h, 0.1]} />
          <meshStandardMaterial color="#20262e" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function LissajousScene({ presetIdx, phase }) {
  const dotRef = useRef()
  const { a, b, color } = LISSAJOUS_PRESETS[presetIdx]

  // Phosphor trail: newest sample at index 0, colour fades with age (fixed by index)
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LIS_TRAIL * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LIS_TRAIL * 3), 3))
    return geo
  }, [])
  useEffect(() => () => trailGeo.dispose(), [trailGeo])
  useEffect(() => {
    const c = new THREE.Color(color), hot = new THREE.Color('#ffffff')
    const col = trailGeo.attributes.color.array
    for (let i = 0; i < LIS_TRAIL; i++) {
      const age = i / LIS_TRAIL
      const k = Math.exp(-age * 2.6) * 2.4
      const w = Math.exp(-i / 18)                      // white-hot head
      col[i*3]   = (c.r * (1 - w) + hot.r * w) * k
      col[i*3+1] = (c.g * (1 - w) + hot.g * w) * k
      col[i*3+2] = (c.b * (1 - w) + hot.b * w) * k
    }
    trailGeo.attributes.color.needsUpdate = true
  }, [color, trailGeo])

  // Ghost of the whole closed figure
  const ghostGeo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 1600; i++) {
      const s = (i / 1600) * Math.PI * 2
      pts.push(Math.sin(a * s) * LIS_R, Math.sin(b * s + phase) * LIS_R, 0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [a, b, phase])
  useEffect(() => () => ghostGeo.dispose(), [ghostGeo])

  // Side strips: x-signal scrolling down from the bottom edge, y-signal scrolling
  // left from the left edge, plus guide lines from the beam to each strip
  const stripGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRIP_K * 2 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(STRIP_K * 2 * 3), 3))
    return g
  }, [])
  const guideGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3))
    return g
  }, [])
  useEffect(() => () => { stripGeo.dispose(); guideGeo.dispose() }, [stripGeo, guideGeo])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.55
    const arr = trailGeo.attributes.position.array
    const px = Math.sin(a * t) * LIS_R
    const py = Math.sin(b * t + phase) * LIS_R
    // Sample the trail analytically at fixed time steps, so it stays smooth at any frame rate
    for (let i = 0; i < LIS_TRAIL; i++) {
      const ti = t - i * 0.003
      arr[i*3] = Math.sin(a * ti) * LIS_R; arr[i*3+1] = Math.sin(b * ti + phase) * LIS_R; arr[i*3+2] = 0
    }
    trailGeo.attributes.position.needsUpdate = true
    if (dotRef.current) dotRef.current.position.set(px, py, 0.01)

    // Strips sample the analytic signals at fixed time steps, so they are smooth
    const sp = stripGeo.attributes.position.array, sc = stripGeo.attributes.color.array
    const c = new THREE.Color(color)
    for (let k = 0; k < STRIP_K; k++) {
      const tk = t - k * 0.012
      const f = Math.exp(-k / (STRIP_K * 0.45))
      const o = k * 3, o2 = (STRIP_K + k) * 3
      sp[o]  = Math.sin(a * tk) * LIS_R;  sp[o+1]  = -SCREEN - 0.25 - k * STRIP_DY; sp[o+2]  = 0
      sp[o2] = -SCREEN - 0.25 - k * STRIP_DY; sp[o2+1] = Math.sin(b * tk + phase) * LIS_R; sp[o2+2] = 0
      sc[o] = sc[o2] = c.r * f; sc[o+1] = sc[o2+1] = c.g * f; sc[o+2] = sc[o2+2] = c.b * f
    }
    stripGeo.attributes.position.needsUpdate = true
    stripGeo.attributes.color.needsUpdate = true
    const gp = guideGeo.attributes.position.array
    gp.set([px, py, 0, px, -SCREEN - 0.25, 0, px, py, 0, -SCREEN - 0.25, py, 0])
    guideGeo.attributes.position.needsUpdate = true
  })

  return (
    <group position={[0.3, 0.5, 0]}>
      <Scope />
      <line geometry={ghostGeo}>
        <lineBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
      </line>
      <line geometry={trailGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </line>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshBasicMaterial color={[2.5, 2.5, 2.5]} toneMapped={false} />
      </mesh>
      <StripLines geo={stripGeo} />
      <lineSegments geometry={guideGeo} frustumCulled={false}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.25} />
      </lineSegments>
    </group>
  )
}

// The strip geometry holds two polylines back to back; draw each with its own range
function StripLines({ geo }) {
  const [g1, g2] = useMemo(() => {
    const mk = (start) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', geo.attributes.position)
      g.setAttribute('color', geo.attributes.color)
      g.setDrawRange(start, STRIP_K)
      return g
    }
    return [mk(0), mk(STRIP_K)]
  }, [geo])
  return (
    <>
      {[g1, g2].map((g, i) => (
        <line key={i} geometry={g} frustumCulled={false}>
          <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </line>
      ))}
    </>
  )
}


// ── InfoPanel data ─────────────────────────────────────────────────────────────
function buildEquations(view) {
  switch (view) {
    case 'cymatics': return {
      domain: 'ACOUSTIC PHYSICS · CHLADNI FIGURES',
      syllabus: 'A-level standing waves · 2D Chladni plate',
      primaryEq: `u=\\cos(n\\pi x)\\cos(m\\pi y)-\\cos(m\\pi x)\\cos(n\\pi y)`,
      derivedEqs: [
        { label:'Nodal lines', eq:`u(x,y)=0` },
        { label:'Mode frequency (this model)', eq:`f_{mn}\\propto\\sqrt{m^2+n^2}` },
        { label:'Force on sand', eq:`F\\propto-u\\,\\nabla u` },
      ],
      tryThis: [
        'Step through the modes and watch the sand collect on the still nodal lines.',
        'Higher (m, n) means more nodal lines — and a higher driving frequency.',
      ],
      checkpoint: {
        q: 'On a vibrating Chladni plate, why does the sand gather into sharp lines instead of spreading evenly?',
        a: 'It bounces off the moving antinodes and settles on the nodal lines, where the plate is motionless. Those lines map out the standing-wave pattern of that mode.',
      },
    }
    case 'harmonics': return {
      domain: 'ACOUSTIC PHYSICS · STANDING WAVES',
      syllabus: 'AQA 3.3.1.3 · IB 4.5 · harmonic series',
      primaryEq: `y_n(x,t)=A\\sin\\!\\tfrac{n\\pi x}{L}\\cos(\\omega_n t)`,
      derivedEqs: [
        { label:'Harmonics', eq:`f_n = n\\,f_0 = \\tfrac{nv}{2L}` },
        { label:'Nodes',     eq:`x_k = \\tfrac{kL}{n},\\;k=0\\ldots n` },
      ],
      tryThis: [
        'Play the fundamental, then the 2nd harmonic — double the frequency, one extra node.',
        'Notice f_n = n·f₀: every harmonic is a whole-number multiple of the fundamental.',
      ],
      checkpoint: {
        q: 'A string’s fundamental is 220 Hz. What is the frequency of its 3rd harmonic?',
        a: '660 Hz. Harmonics are integer multiples: f_n = n·f₀, so the 3rd is 3 × 220 = 660 Hz, with two nodes between the fixed ends.',
      },
    }
    case 'lissajous': return {
      domain: 'ACOUSTIC PHYSICS · LISSAJOUS',
      syllabus: 'Enrichment · frequency ratios & phase',
      primaryEq: `x=\\sin(at),\\quad y=\\sin(bt+\\delta)`,
      derivedEqs: [
        { label:'Closed if', eq:`a/b\\in\\mathbb{Q}` },
        { label:'Phase',     eq:`\\delta\\in[0,2\\pi]\\text{ morphs figure}` },
      ],
      tryThis: [
        'Set the frequency ratio to 2:3 and watch a stable closed figure lock into place.',
        'Nudge the phase δ and the same figure morphs and rotates.',
      ],
      checkpoint: {
        q: 'When do two perpendicular oscillations trace a stable, closed Lissajous figure?',
        a: 'When their frequency ratio a/b is a simple whole-number ratio. Irrational ratios never close — the curve drifts and fills the box. It turns a ratio you can hear into one you can see.',
      },
    }
    default: return { domain:'', primaryEq:'', derivedEqs:[] }
  }
}
function buildExplanation(view) {
  switch (view) {
    case 'cymatics':
      return 'Tap the tone pads to vibrate the plate at that mode\'s resonant frequency — and hear it. Sand settles on the curved nodal lines where the plate does not move — the classic Chladni figures. Enable Use mic to let your voice drive the pattern live.'
    case 'harmonics':
      return 'Click any string to pluck it and hear the note. Each harmonic n vibrates at n × f₀. STRUM ALL plays them as a chord. The ratio of overtones defines the timbre of every musical instrument.'
    case 'lissajous':
      return 'Tap PLAY to hear both frequencies simultaneously. Drag PHASE to morph the figure in real time — 0° and 180° give a line, 90° gives an ellipse. Simple ratios produce cleaner figures; this is why consonant intervals look more symmetric.'
    default: return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AcousticModule() {

  const view            = useModuleStore(s => s.acoustic.viewType)
  const modeIdx         = useModuleStore(s => s.acoustic.modeIdx)
  const presetIdx       = useModuleStore(s => s.acoustic.presetIdx)
  const lissPhase       = useModuleStore(s => s.acoustic.lissPhase)
  const lissBaseFreq    = useModuleStore(s => s.acoustic.lissBaseFreq)
  const setView         = useModuleStore(s => s.setAcousticView)
  const setModeIdx      = useModuleStore(s => s.setAcousticModeIdx)
  const setPresetIdx    = useModuleStore(s => s.setAcousticPresetIdx)
  const setLissPhase    = useModuleStore(s => s.setAcousticLissPhase)
  const setLissBaseFreq = useModuleStore(s => s.setAcousticLissBaseFreq)
  const [focusN,       setFocusN]       = useState(null)
  const [scatterToken, setScatterToken] = useState(0)
  const [micActive,    setMicActive]    = useState(false)
  const [lissAudio,    setLissAudio]    = useState(false)

  const micStreamRef = useRef(null)
  const analyserRef  = useRef(null)
  const micRafRef    = useRef(null)
  const lissOscRef   = useRef(null)

  // ── Cymatics: pad tap ───────────────────────────────────────────────────────
  const handlePad = useCallback((i) => {
    setModeIdx(i)
    setScatterToken(t => t + 1)
    playTone(CHLADNI_MODES[i].freq, 1.4)
  }, [setModeIdx])

  // ── Cymatics: microphone ────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const ctx      = getAudioCtx()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      analyserRef.current = analyser
      const buf = new Float32Array(analyser.frequencyBinCount)
      let lastMode = -1
      const tick = () => {
        analyser.getFloatFrequencyData(buf)
        let maxVal = -Infinity, maxIdx = 1
        for (let i = 20; i < buf.length * 0.25; i++) {
          if (buf[i] > maxVal) { maxVal = buf[i]; maxIdx = i }
        }
        const freq = maxIdx * ctx.sampleRate / analyser.fftSize
        let best = 0, bestDist = Infinity
        CHLADNI_MODES.forEach((mode, j) => {
          const d = Math.abs(freq - mode.freq)
          if (d < bestDist) { bestDist = d; best = j }
        })
        if (best !== lastMode) { lastMode = best; setModeIdx(best) }
        micRafRef.current = requestAnimationFrame(tick)
      }
      micRafRef.current = requestAnimationFrame(tick)
      setMicActive(true)
    } catch (e) {
      console.warn('Mic access denied:', e)
    }
  }, [setModeIdx])

  const stopMic = useCallback(() => {
    cancelAnimationFrame(micRafRef.current)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null; analyserRef.current = null
    setMicActive(false)
  }, [])

  // ── Harmonics: pluck ────────────────────────────────────────────────────────
  const handlePluck = useCallback((n) => {
    playTone(C3 * n, 2.2, 'triangle', 0.18)
  }, [])

  const handleStrum = useCallback(() => {
    for (let n = 1; n <= 8; n++) {
      setTimeout(() => playTone(C3 * n, 1.8, 'triangle', 0.14), (n - 1) * 120)
    }
  }, [])

  // ── Lissajous: oscillator management ───────────────────────────────────────
  const stopLissajousAudio = useCallback(() => {
    if (!lissOscRef.current) return
    const { osc1, osc2, gain } = lissOscRef.current
    const ctx = getAudioCtx()
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    setTimeout(() => { try { osc1.stop(); osc2.stop(); gain.disconnect() } catch (_) {} }, 200)
    lissOscRef.current = null
  }, [])

  const startLissajousAudio = useCallback((a, b, baseFreq) => {
    stopLissajousAudio()
    const ctx  = getAudioCtx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.06)
    gain.connect(ctx.destination)
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'; osc1.frequency.value = a * baseFreq
    osc1.connect(gain); osc1.start()
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'; osc2.frequency.value = b * baseFreq
    osc2.connect(gain); osc2.start()
    lissOscRef.current = { osc1, osc2, gain }
  }, [stopLissajousAudio])

  const toggleLissAudio = useCallback(() => {
    if (lissAudio) { stopLissajousAudio(); setLissAudio(false) }
    else {
      const { a, b } = LISSAJOUS_PRESETS[presetIdx]
      startLissajousAudio(a, b, lissBaseFreq)
      setLissAudio(true)
    }
  }, [lissAudio, presetIdx, lissBaseFreq, startLissajousAudio, stopLissajousAudio])

  // Update oscillator freqs live when preset/pitch changes
  useEffect(() => {
    if (!lissAudio || !lissOscRef.current) return
    const { a, b } = LISSAJOUS_PRESETS[presetIdx]
    lissOscRef.current.osc1.frequency.value = a * lissBaseFreq
    lissOscRef.current.osc2.frequency.value = b * lissBaseFreq
  }, [presetIdx, lissBaseFreq, lissAudio])

  // Cleanup on view change or unmount
  useEffect(() => () => { stopLissajousAudio(); stopMic() }, [stopLissajousAudio, stopMic])
  useEffect(() => {
    if (view !== 'lissajous' && lissAudio) { stopLissajousAudio(); setLissAudio(false) }
    if (view !== 'cymatics'  && micActive)  stopMic()
  }, [view, lissAudio, micActive, stopLissajousAudio, stopMic])

  const eq = buildEquations(view)
  const { a: lA, b: lB, color: lColor } = LISSAJOUS_PRESETS[presetIdx]

  return (
    <ModuleShell
      title="Acoustic Physics"
      accent={ACCENT}
      views={VIEWS}
      activeView={view}
      onViewChange={setView}
      readout={view === 'cymatics' ? `Chladni mode · ${CHLADNI_MODES[modeIdx].freq} Hz` : view === 'harmonics' ? '8 strings · harmonics of C3' : <>{lA}:{lB} · {lissBaseFreq} Hz</>}
      lesson={
        <InfoPanel
          domain={eq.domain}
          syllabus={eq.syllabus}
          primaryEq={eq.primaryEq}
          derivedEqs={eq.derivedEqs}
          explanation={buildExplanation(view)}
          tryThis={eq.tryThis}
          checkpoint={eq.checkpoint}
        />
      }
    >
      <style>{`
        .ac-btn{
          font-family:var(--font-body);font-size:13px;font-weight:500;
          height:32px;padding:0 12px;border-radius:6px;cursor:pointer;
          border:1px solid rgb(var(--c-border));
          background:rgb(var(--c-panel) / .85);color:rgb(var(--c-text-muted));
          transition:background-color .15s,color .15s,border-color .15s;
          backdrop-filter:blur(8px);
        }
        .ac-btn:hover{background:rgb(var(--c-panel-hover));color:rgb(var(--c-text));}
        .ac-btn.active{
          background:rgba(192,132,252,.16);border-color:rgba(192,132,252,.6);color:#e9d5ff;
        }
        .tone-pad{
          font-family:var(--font-body);cursor:pointer;
          border:1px solid rgb(var(--c-border));border-radius:8px;
          background:rgb(var(--c-panel) / .9);transition:background-color .12s,border-color .12s,transform .08s;user-select:none;
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:2px;padding:8px 0;min-height:44px;
        }
        .tone-pad:hover{background:rgb(var(--c-panel-hover));border-color:rgba(192,132,252,.45);}
        .tone-pad.active{background:rgba(192,132,252,.16);border-color:rgba(192,132,252,.7);}
        .tone-pad:active{transform:scale(0.96);}
        input[type=range].ac-slider{
          -webkit-appearance:none;appearance:none;
          height:4px;border-radius:2px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,#c084fc var(--val,50%),rgb(var(--c-border)) var(--val,50%));
        }
        input[type=range].ac-slider::-webkit-slider-thumb{
          -webkit-appearance:none;width:16px;height:16px;border-radius:50%;
          background:rgb(var(--c-text));border:2px solid #c084fc;cursor:pointer;
        }
        input[type=range].ac-slider:focus-visible{outline:2px solid rgb(var(--c-brand));outline-offset:4px;}
      `}</style>
        <div className="flex flex-col h-full pb-14">

          {/* 3-D scene */}
          <div style={{flex:1,position:'relative',overflow:'hidden',minHeight:0}}>
            <SceneWrapper cameraPosition={CAMERA[view]} idleRotate={view === 'cymatics'} showGrid={false} minDist={2} maxDist={18}>
              {view==='cymatics'  && <CymaticsScene  modeIdx={modeIdx} scatterToken={scatterToken} />}
              {view==='harmonics' && <HarmonicsScene  focusN={focusN} onPluck={handlePluck} />}
              {view==='lissajous' && <LissajousScene  presetIdx={presetIdx} phase={lissPhase} />}
            </SceneWrapper>


            {/* Lissajous interval picker (overlay) */}
            {view==='lissajous' && (
              <div style={{
                position:'absolute',bottom:10,right:12,
                display:'flex',flexDirection:'column',gap:4,
                pointerEvents:'all',alignItems:'flex-end',
              }}>
                <div style={{fontSize:7,letterSpacing:'.22em',color:'rgba(168,85,247,0.75)',textTransform:'uppercase'}}>INTERVAL</div>
                <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'flex-end'}}>
                  {LISSAJOUS_PRESETS.map((p,i) => (
                    <button key={i} onClick={() => setPresetIdx(i)}
                      className={`ac-btn${presetIdx===i?' active':''}`}
                      style={{
                        borderColor: presetIdx===i ? `${p.color}66` : `${p.color}22`,
                        color: presetIdx===i ? p.color : `${p.color}55`,
                        minWidth:148,textAlign:'left',display:'flex',justifyContent:'space-between',
                      }}
                    >
                      <span>{p.name}</span><span style={{opacity:.55}}>{p.ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom interactive strip ── */}

          {/* CYMATICS: tone pads + mic */}
          {view==='cymatics' && (
            <div style={{
              flexShrink:0,padding:'10px 14px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{fontSize:11,letterSpacing:'.2em',color:'rgba(168,85,247,0.75)',textTransform:'uppercase'}}>
                  TONE PADS — tap to hear the plate vibrate
                </span>
                <button onClick={micActive ? stopMic : startMic}
                  className={`ac-btn${micActive?' active':''}`}
                  style={{
                    marginLeft:'auto',
                    borderColor: micActive ? '#ff6b6b88' : undefined,
                    color:       micActive ? '#ff9090'   : undefined,
                  }}
                >
                  {micActive ? '🎙 MIC ON' : '🎙 USE MIC'}
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
                {CHLADNI_MODES.slice(0,5).map((mode,i) => (
                  <button key={i} onMouseDown={() => handlePad(i)}
                    className={`tone-pad${modeIdx===i?' active':''}`}
                  >
                    <span style={{fontSize:11,color:modeIdx===i?'#c084fc':'rgba(168,85,247,.65)',letterSpacing:'.08em'}}>{mode.label}</span>
                    <span style={{fontSize:12,color:modeIdx===i?'#e0d0ff':'rgba(200,180,255,.45)',fontWeight:600}}>{mode.freq} Hz</span>
                    <span style={{fontSize:11,color:'rgb(var(--c-text-muted))'}}>{mode.note}</span>
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginTop:5}}>
                {CHLADNI_MODES.slice(5).map((mode,i) => (
                  <button key={i+5} onMouseDown={() => handlePad(i+5)}
                    className={`tone-pad${modeIdx===i+5?' active':''}`}
                  >
                    <span style={{fontSize:11,color:modeIdx===i+5?'#c084fc':'rgba(168,85,247,.65)',letterSpacing:'.08em'}}>{mode.label}</span>
                    <span style={{fontSize:12,color:modeIdx===i+5?'#e0d0ff':'rgba(200,180,255,.45)',fontWeight:600}}>{mode.freq} Hz</span>
                    <span style={{fontSize:11,color:'rgb(var(--c-text-muted))'}}>{mode.note}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* HARMONICS: string controls */}
          {view==='harmonics' && (
            <div style={{
              flexShrink:0,padding:'10px 16px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
              display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
            }}>
              <span style={{fontSize:11,letterSpacing:'.2em',color:'rgba(168,85,247,0.75)',textTransform:'uppercase'}}>
                CLICK A STRING TO PLUCK
              </span>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                <button onClick={() => setFocusN(null)} className={`ac-btn${focusN===null?' active':''}`}>ALL</button>
                {Array.from({length:8},(_,i) => {
                  const n = i+1, c = HARMONIC_COLORS[i]
                  return (
                    <button key={n} onClick={() => setFocusN(focusN===n?null:n)}
                      className={`ac-btn${focusN===n?' active':''}`}
                      style={{
                        borderColor: focusN===n ? `${c}66` : `${c}22`,
                        color: focusN===n ? c : `${c}55`,
                      }}
                    >
                      n={n} <span style={{opacity:.5,fontSize:7}}>{HARMONIC_NOTES[i]}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={handleStrum} className="ac-btn" style={{
                marginLeft:'auto',
                borderColor:'rgba(255,200,100,.35)',color:'rgba(255,200,100,.75)',
                padding:'5px 16px',
              }}>♪ STRUM ALL</button>
            </div>
          )}

          {/* LISSAJOUS: audio + phase + pitch */}
          {view==='lissajous' && (
            <div style={{
              flexShrink:0,padding:'10px 18px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
              display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',
            }}>
              {/* Play/stop */}
              <button onClick={toggleLissAudio}
                className={`ac-btn${lissAudio?' active':''}`}
                style={{
                  padding:'6px 18px',fontSize:12,
                  borderColor: lissAudio ? `${lColor}66` : `${lColor}22`,
                  color:       lissAudio ? lColor          : `${lColor}55`,
                  minWidth:90,
                }}
              >{lissAudio ? '⏸ STOP' : '♪ PLAY'}</button>

              {/* Live freq readout */}
              {lissAudio && (
                <div style={{display:'flex',gap:10,fontSize:11,letterSpacing:'.1em'}}>
                  <span style={{color:`${lColor}88`}}>{lA}×<span style={{color:lColor,fontWeight:700,marginLeft:3}}>{(lA*lissBaseFreq).toFixed(0)} Hz</span></span>
                  <span style={{color:'rgba(168,85,247,0.75)'}}>+</span>
                  <span style={{color:`${lColor}88`}}>{lB}×<span style={{color:lColor,fontWeight:700,marginLeft:3}}>{(lB*lissBaseFreq).toFixed(0)} Hz</span></span>
                </div>
              )}

              {/* Base pitch */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,letterSpacing:'.15em',color:'rgba(168,85,247,0.75)',textTransform:'uppercase',whiteSpace:'nowrap'}}>PITCH</span>
                <input type="range" className="ac-slider" min={80} max={440} step={1}
                  value={lissBaseFreq}
                  style={{'--val':`${((lissBaseFreq-80)/360*100).toFixed(1)}%`}}
                  onChange={e => setLissBaseFreq(Number(e.target.value))}
                />
                <span style={{fontSize:11,color:'rgba(168,85,247,0.75)',minWidth:38}}>{lissBaseFreq} Hz</span>
              </div>

              {/* Phase delta */}
              <div style={{display:'flex',alignItems:'center',gap:8,flex:'1 1 auto',maxWidth:260}}>
                <span style={{fontSize:11,letterSpacing:'.15em',color:'rgba(168,85,247,0.75)',textTransform:'uppercase',whiteSpace:'nowrap'}}>PHASE δ</span>
                <input type="range" className="ac-slider" min={0} max={6.283} step={0.01}
                  value={lissPhase}
                  style={{'--val':`${(lissPhase/6.283*100).toFixed(1)}%`}}
                  onChange={e => setLissPhase(Number(e.target.value))}
                />
                <span style={{fontSize:11,color:'rgba(168,85,247,0.75)',minWidth:36}}>
                  {(lissPhase * 180 / Math.PI).toFixed(0)}°
                </span>
              </div>
            </div>
          )}

        </div>
    </ModuleShell>
  )
}
