// Galaxy rotation curves — the "missing mass" problem, made visible.
//
// Every star orbits at its own speed v(r) taken from the rotation curve
// (differential rotation: ω = v/r, inner stars lap outer ones). Switch the
// stars between the MEASURED curve (flat) and the KEPLERIAN prediction from
// visible matter alone (outer stars crawl) to see why dark matter is inferred.
// Spiral arms are a density wave: a pattern rotating at a fixed speed that
// brightens stars as they pass through it, so the arms stay sharp even though
// the stars themselves shear.
import { useMemo, useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { keplerianVelocity, observedRotationVelocity } from './frontierMath'
import SceneCard from '../../components/SceneCard'

const R_MAX     = 6.5          // graph radius range (slider max)
const DISK_R    = 5.2          // outermost stars
const N_STARS   = 14000
const N_ARMS    = 2
const PITCH     = 0.32         // tan of the spiral pitch angle
const PATTERN_W = 0.11         // arm pattern speed (rad / s)
const TIME_SCALE = 0.55        // orbit speed in scene units
const N_HALO    = 2600

const C_BULGE = new THREE.Color('#ffd9a0')
const C_DISK  = new THREE.Color('#b9c8ff')
const C_ARM   = new THREE.Color('#e8f0ff')
const C_HII   = new THREE.Color('#ff7aa8')

function gauss() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Soft round sprite so stars read as points of light, not squares
function makeStarSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function buildStars() {
  const r = new Float32Array(N_STARS)
  const th = new Float32Array(N_STARS)
  const y = new Float32Array(N_STARS)
  const base = new Float32Array(N_STARS * 3)
  const kind = new Uint8Array(N_STARS) // 0 bulge · 1 disk · 2 HII region
  const nBulge = Math.floor(N_STARS * 0.2)
  for (let i = 0; i < N_STARS; i++) {
    let c
    if (i < nBulge) {
      r[i] = Math.abs(gauss()) * 0.55 + 0.05
      y[i] = gauss() * 0.22 * Math.max(0.3, 1 - r[i])
      c = C_BULGE
      kind[i] = 0
    } else {
      // Exponential disk, scale length 1.5
      r[i] = Math.min(DISK_R, 0.4 - 1.5 * Math.log(1 - Math.random() * 0.97))
      y[i] = gauss() * 0.05
      const hii = Math.random() < 0.04
      c = hii ? C_HII : C_DISK
      kind[i] = hii ? 2 : 1
    }
    th[i] = Math.random() * Math.PI * 2
    base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b
  }
  return { r, th, y, base, kind }
}

// Speed of a star at radius r in the chosen model
function speedAt(r, model) {
  return model === 'kepler' ? keplerianVelocity(r) : observedRotationVelocity(r)
}

function Galaxy({ model }) {
  const stars = useMemo(() => buildStars(), [])
  const sprite = useMemo(() => makeStarSprite(), [])
  useEffect(() => () => sprite.dispose(), [sprite])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_STARS * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_STARS * 3), 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  const modelRef = useRef(model)
  modelRef.current = model
  const tRef = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    tRef.current += dt
    const pattern = tRef.current * PATTERN_W
    const pos = geo.attributes.position.array
    const col = geo.attributes.color.array
    const { r, th, y, base, kind } = stars
    const m = modelRef.current
    const armGap = (Math.PI * 2) / N_ARMS

    for (let i = 0; i < N_STARS; i++) {
      const ri = r[i]
      // Differential rotation: angular speed ω = v(r) / r
      th[i] += (speedAt(ri, m) / Math.max(ri, 0.15)) * dt * TIME_SCALE
      const t = th[i]
      pos[i * 3] = ri * Math.cos(t)
      pos[i * 3 + 1] = y[i]
      pos[i * 3 + 2] = ri * Math.sin(t)

      // Density wave: distance (in angle) to the nearest logarithmic arm
      let b = 1
      if (kind[i] !== 0) {
        const armPhase = pattern + Math.log(Math.max(ri, 0.3)) / PITCH
        let d = ((t - armPhase) % armGap + armGap) % armGap
        if (d > armGap / 2) d -= armGap
        const inArm = Math.exp(-(d * d) / 0.05)
        b = kind[i] === 2 ? 0.12 + 2.0 * inArm : 0.16 + 1.25 * inArm
        if (inArm > 0.5 && kind[i] === 1) {
          // young blue-white stars light up along the arm
          col[i * 3] = C_ARM.r * b; col[i * 3 + 1] = C_ARM.g * b; col[i * 3 + 2] = C_ARM.b * b
          continue
        }
      } else {
        b = 1.1 - Math.min(0.6, ri)
      }
      col[i * 3] = base[i * 3] * b
      col[i * 3 + 1] = base[i * 3 + 1] * b
      col[i * 3 + 2] = base[i * 3 + 2] * b
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  return (
    <group>
      <points geometry={geo} frustumCulled={false}>
        <pointsMaterial map={sprite} size={0.085} vertexColors transparent depthWrite={false}
          blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false} />
      </points>
      {/* Bright core */}
      <mesh>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#ffe8c0" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Arm glow: the same density-wave spiral, drawn as soft light per pixel ────
const ARM_VERT = `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const ARM_FRAG = `
  uniform float uPattern;
  varying vec2 vP;
  const float PI = 3.14159265;
  void main() {
    float r = length(vP);
    if (r > ${(DISK_R + 0.4).toFixed(2)}) discard;
    float th = atan(vP.y, vP.x);
    float gap = 2.0 * PI / ${N_ARMS.toFixed(1)};
    // Disc-local angle = −(star angle), so both terms of the arm phase flip
    float armPhase = uPattern - log(max(r, 0.3)) / ${PITCH.toFixed(3)};
    float d = mod(th - armPhase, gap);
    if (d > gap * 0.5) d -= gap;
    float arm = exp(-(d * d) / 0.07) * exp(-r / 2.6) * smoothstep(0.25, 0.9, r);
    float core = exp(-r * r / 0.35);
    vec3 col = vec3(0.42, 0.52, 1.0) * arm * 0.9 + vec3(1.0, 0.78, 0.5) * core * 0.9;
    float a = clamp(arm * 0.7 + core * 0.8, 0.0, 1.0);
    gl_FragColor = vec4(pow(col, vec3(2.2)), a);
  }
`
function ArmGlow() {
  const uniforms = useMemo(() => ({ uPattern: { value: 0 } }), [])
  const tRef = useRef(0)
  // The plane lies in the disc (rotated flat); its local +y is world −z, so
  // angles are mirrored: uPattern = −(pattern angle).
  useFrame((_, dt) => { tRef.current += Math.min(dt, 0.05); uniforms.uPattern.value = -tRef.current * PATTERN_W })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <circleGeometry args={[DISK_R + 0.4, 96]} />
      <shaderMaterial vertexShader={ARM_VERT} fragmentShader={ARM_FRAG} uniforms={uniforms}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

// ── Dark-matter halo: a faint, roughly spherical cloud (it can't be seen) ────
function DarkMatterHalo({ visible }) {
  const sprite = useMemo(() => makeStarSprite(), [])
  useEffect(() => () => sprite.dispose(), [sprite])
  const geo = useMemo(() => {
    const p = new Float32Array(N_HALO * 3)
    for (let i = 0; i < N_HALO; i++) {
      // Cored isothermal-like profile: density ∝ 1/(r² + rc²)
      const rr = 1.2 * Math.tan(Math.random() * Math.atan(6.5 / 1.2))
      const u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      p[i * 3] = rr * s * Math.cos(phi)
      p[i * 3 + 1] = rr * u * 0.85
      p[i * 3 + 2] = rr * s * Math.sin(phi)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const ref = useRef()
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.02 })
  if (!visible) return null
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={sprite} color="#8b5cf6" size={0.16} transparent opacity={0.22} depthWrite={false}
        blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false} />
    </points>
  )
}

// ── Speed arrows along one radius (toward the viewer), pointing along the
//    direction of orbit: measured (blue) vs Keplerian (amber) ──────────────
const ARROW_RADII = [1, 2, 3, 4, 5]
function SpeedArrows() {
  return (
    <group>
      {ARROW_RADII.map((r) => {
        const vo = observedRotationVelocity(r)
        const vk = keplerianVelocity(r)
        const L = 2.2
        return (
          <group key={r} position={[0, 0.12, r]}>
            <Line points={[[0, 0, 0], [-vo * L, 0, 0]]} color="#7c8cff" lineWidth={3} />
            <mesh position={[-vo * L, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.07, 0.18, 12]} />
              <meshBasicMaterial color="#7c8cff" toneMapped={false} />
            </mesh>
            <Line points={[[0, 0, 0.16], [-vk * L, 0, 0.16]]} color="#fbbf24" lineWidth={3} />
            <mesh position={[-vk * L, 0, 0.16]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.07, 0.18, 12]} />
              <meshBasicMaterial color="#fbbf24" toneMapped={false} />
            </mesh>
          </group>
        )
      })}
      <Line points={[[0, 0.12, 0.4], [0, 0.12, 5.4]]} color="#94a3b8" lineWidth={1} transparent opacity={0.5} />
    </group>
  )
}

// ── Probe ring + marker at the slider radius ─────────────────────────────────
function OrbitalProbe({ radius, model }) {
  const ringPts = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2
      pts.push([radius * Math.cos(t), 0.02, radius * Math.sin(t)])
    }
    return pts
  }, [radius])
  const angleRef = useRef(0)
  const markerRef = useRef()
  useFrame((_, delta) => {
    angleRef.current += (speedAt(radius, model) / Math.max(radius, 0.15)) * Math.min(delta, 0.05) * TIME_SCALE
    const a = angleRef.current
    if (markerRef.current) markerRef.current.position.set(radius * Math.cos(a), 0.05, radius * Math.sin(a))
  })
  return (
    <>
      <Line points={ringPts} color="#fbbf24" lineWidth={1.2} transparent opacity={0.45} />
      <group ref={markerRef}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
        <Html position={[0, 0.38, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={LABEL}>r = {radius.toFixed(2)}</span>
        </Html>
      </group>
    </>
  )
}

// ── Graph card ───────────────────────────────────────────────────────────────
const GW = 200, GH = 120
const N_SAMPLES = 90
function curve(fn) {
  const pts = []
  for (let i = 1; i <= N_SAMPLES; i++) {
    const r = (i / N_SAMPLES) * R_MAX
    pts.push([(r / R_MAX) * GW, GH - Math.min(fn(r), 1.1) / 1.1 * GH])
  }
  return pts
}

function GraphCard({ radius, model, setModel, showHalo, setShowHalo }) {
  const kep = useMemo(() => curve(keplerianVelocity), [])
  const obs = useMemo(() => curve(observedRotationVelocity), [])
  const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  // Area between the curves = what visible matter can't explain
  const gap = `${toPath(obs)} ${kep.slice().reverse().map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} Z`
  const vo = observedRotationVelocity(radius), vk = keplerianVelocity(radius)
  const rx = (radius / R_MAX) * GW
  const yo = GH - Math.min(vo, 1.1) / 1.1 * GH
  const yk = GH - Math.min(vk, 1.1) / 1.1 * GH
  const dmFrac = Math.max(0, 1 - (vk / vo) ** 2)

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Rotation curve</div>
      <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 6 }}>Orbital speed v against radius r</div>
      <svg width={GW} height={GH + 16} style={{ display: 'block', overflow: 'visible' }}>
        <path d={gap} fill="rgba(139,92,246,0.22)" />
        <path d={toPath(kep)} fill="none" stroke="#fbbf24" strokeWidth="2" />
        <path d={toPath(obs)} fill="none" stroke="#7c8cff" strokeWidth="2.5" />
        <line x1={rx} y1={0} x2={rx} y2={GH} stroke="rgb(var(--c-text-muted))" strokeDasharray="3 3" />
        <circle cx={rx} cy={yo} r="4" fill="#7c8cff" />
        <circle cx={rx} cy={yk} r="4" fill="#fbbf24" />
        <line x1={0} y1={GH} x2={GW} y2={GH} stroke="rgb(var(--c-border))" />
        <line x1={0} y1={0} x2={0} y2={GH} stroke="rgb(var(--c-border))" />
        <text x={GW} y={GH + 13} textAnchor="end" fontSize="11" fill="rgb(var(--c-text-muted))">radius r →</text>
      </svg>
      <div style={{ display: 'grid', gap: 3, margin: '6px 0 8px' }}>
        <span><span style={{ color: '#7c8cff' }}>━</span> Measured (stays flat)</span>
        <span><span style={{ color: '#fbbf24' }}>━</span> Visible matter only (Kepler)</span>
        <span><span style={{ color: '#a78bfa' }}>■</span> Gap → inferred dark matter</span>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3, borderTop: '1px solid rgb(var(--c-border))', paddingTop: 6 }}>
        <dt style={MUTED}>v measured / Kepler</dt>
        <dd style={NUM}>{vo.toFixed(2)} / {vk.toFixed(2)}</dd>
        <dt style={MUTED}>Dark matter at r*</dt>
        <dd style={{ ...NUM, color: '#a78bfa' }}>{(dmFrac * 100).toFixed(0)}%</dd>
      </dl>
      <div style={{ marginTop: 8, fontWeight: 600 }}>Stars move using</div>
      <div role="radiogroup" aria-label="Rotation model" style={{ display: 'grid', gap: 4, marginTop: 4 }}>
        {[['measured', 'Measured speeds'], ['kepler', 'Visible matter only']].map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={model === id} onClick={() => setModel(id)}
            className="ui-btn h-8 justify-start"
            style={model === id ? { borderColor: id === 'kepler' ? 'rgba(251,191,36,0.6)' : 'rgba(124,140,255,0.7)', background: id === 'kepler' ? 'rgba(251,191,36,0.12)' : 'rgba(124,140,255,0.14)' } : undefined}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setShowHalo((v) => !v)} aria-pressed={showHalo} className="ui-btn w-full h-8 mt-2">
        {showHalo ? 'Hide dark-matter halo' : 'Show dark-matter halo'}
      </button>
      <div style={{ ...MUTED, marginTop: 6, fontSize: 11 }}>* inferred from the speeds, not observed directly</div>
    </div>
  )
}

const LABEL = { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: '#fde68a', whiteSpace: 'nowrap' }
const CARD = {
  width: 224, padding: '10px 12px', borderRadius: 10,
  background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
  fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
}
const MUTED = { color: 'rgb(var(--c-text-muted))' }
const NUM = { fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }

// ── Scene root ────────────────────────────────────────────────────────────────
export default function RotationCurve() {
  const radius = useModuleStore((s) => s.fp.fpRadius)
  const [model, setModel] = useState('measured')
  const [showHalo, setShowHalo] = useState(true)

  return (
    <group position={[-1.3, 0, 0]}>
      <DarkMatterHalo visible={showHalo} />
      <ArmGlow />
      <Galaxy model={model} />
      <SpeedArrows />
      <OrbitalProbe radius={radius} model={model} />

      <SceneCard interactive>
        <GraphCard radius={radius} model={model} setModel={setModel} showHalo={showHalo} setShowHalo={setShowHalo} />
      </SceneCard>
    </group>
  )
}
