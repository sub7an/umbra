import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Constants ──────────────────────────────────────────────────────────────────
const N        = 5000    // tracer particle count
const SOFT     = 0.55    // softening: prevents r=0 singularity
const DAMPING  = 0.991   // velocity damping per frame
const SPEED_MAX = 8.5
const DX = 10, DY = 6.5  // domain half-extents (world units)
const MAX_SRC = 16       // sources the field shader can show
const STREAK = 0.07      // streak length per unit speed

export const SOURCE_DEFS = {
  attractor:  { color: '#7c8cff', label: 'Attractor',  symbol: '◉', G:  3.5, Γ:  0   },
  repulsor:   { color: '#fb923c', label: 'Repulsor',   symbol: '⊘', G: -3.5, Γ:  0   },
  vortex_ccw: { color: '#a855f7', label: 'Vortex ↺',  symbol: '↺', G:  0,   Γ:  3.0 },
  vortex_cw:  { color: '#f59e0b', label: 'Vortex ↻',  symbol: '↻', G:  0,   Γ: -3.0 },
}

// ── Speed-based color ramp ──────────────────────────────────────────────────
// slow: deep blue → mid: cyan → fast: orange → max: white
const C = [
  [0.03, 0.07, 0.28],  // 0.00
  [0.00, 0.90, 0.77],  // 0.33
  [0.98, 0.57, 0.24],  // 0.66
  [1.00, 1.00, 1.00],  // 1.00
]
function writeColor(buf, base, t) {
  const s0 = t < 0.33 ? 0 : t < 0.66 ? 1 : 2
  const s1 = s0 + 1
  const f  = t < 0.33 ? t/0.33 : t < 0.66 ? (t-0.33)/0.33 : (t-0.66)/0.34
  buf[base]   = C[s0][0] + (C[s1][0]-C[s0][0])*f
  buf[base+1] = C[s0][1] + (C[s1][1]-C[s0][1])*f
  buf[base+2] = C[s0][2] + (C[s1][2]-C[s0][2])*f
}

// ── Field backdrop: potential wells and vortex streamlines ───────────────────
// Φ = Σ G·s / √(r² + soft²) is the depth of the combined potential (positive
// near attractors, negative near repulsors). Ψ = Σ Γ·s · ln r is the stream
// function of the vortices; its contours are the circulating streamlines.
const FIELD_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const FIELD_FRAG = /* glsl */`
  uniform vec4 uSrc[${MAX_SRC}];   // x, y, G·s, Γ·s
  uniform int uCount;
  uniform float uT;
  varying vec2 vP;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    float phi = 0.0, psi = 0.0, swirl = 0.0;
    for (int i = 0; i < ${MAX_SRC}; i++) {
      if (i >= uCount) break;
      vec2 d = vP - uSrc[i].xy;
      float r2 = dot(d, d);
      phi += uSrc[i].z / sqrt(r2 + ${(SOFT * SOFT).toFixed(3)});
      psi += uSrc[i].w * 0.5 * log(r2 + 0.04);
      swirl += abs(uSrc[i].w) / (r2 + 0.6);
    }
    vec3 col = lin(vec3(0.030, 0.035, 0.050));
    col += lin(vec3(0.20, 0.25, 0.75)) * pow(clamp(phi * 0.12, 0.0, 1.0), 2.0) * 0.6;   // wells
    col += lin(vec3(0.80, 0.38, 0.12)) * pow(clamp(-phi * 0.12, 0.0, 1.0), 2.0) * 0.6;  // hills
    // Equipotentials and streamlines, thin and faint
    float kp = phi * 1.6;
    float eq = 1.0 - min(abs(fract(kp) - 0.5) / fwidth(kp), 1.0);
    col += lin(vec3(0.45, 0.50, 0.95)) * eq * 0.10 * clamp(abs(phi) * 0.5, 0.0, 1.0);
    float ks = psi * 1.2 - uT * 0.4;
    float st = 1.0 - min(abs(fract(ks) - 0.5) / fwidth(ks), 1.0);
    col += lin(vec3(0.70, 0.45, 1.0)) * st * 0.14 * clamp(swirl * 0.6, 0.0, 1.0);
    // Faint dot grid
    vec2 g = abs(fract(vP + 0.5) - 0.5) / fwidth(vP);
    col += lin(vec3(0.12, 0.13, 0.18)) * (1.0 - min(length(g) * 0.5, 1.0)) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`

function FieldBackdrop({ sources, strength }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
    uniforms: {
      uSrc: { value: Array.from({ length: MAX_SRC }, () => new THREE.Vector4()) },
      uCount: { value: 0 }, uT: { value: 0 },
    },
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    const arr = mat.uniforms.uSrc.value
    const list = sources.slice(-MAX_SRC)
    list.forEach((s, i) => {
      const def = SOURCE_DEFS[s.type]
      arr[i].set(s.x, s.y, def.G * strength, def.Γ * strength)
    })
    mat.uniforms.uCount.value = list.length
  }, [mat, sources, strength])
  useFrame((_, d) => { mat.uniforms.uT.value += Math.min(d, 0.05) })
  return (
    <mesh position={[0, 0, -0.3]} material={mat}>
      <planeGeometry args={[DX * 2, DY * 2]} />
    </mesh>
  )
}

// ── Source markers: shapes that act out what each source does ───────────────
function SourceMarker({ src, mode, onRemove }) {
  const def = SOURCE_DEFS[src.type]
  const isErase = mode === 'erase'
  const radial = def.G !== 0
  const rings = useRef([])
  const spin = useRef()
  useFrame(({ clock }, d) => {
    const t = clock.elapsedTime
    // Radial sources: rings flow inward (attractor) or outward (repulsor)
    rings.current.forEach((r, i) => {
      if (!r) return
      let p = (t * 0.6 + i / 3) % 1
      if (def.G > 0) p = 1 - p
      r.scale.setScalar(0.25 + p * 0.9)
      r.material.opacity = Math.sin(Math.PI * p) * 0.6
    })
    if (spin.current) spin.current.rotation.z += d * Math.sign(def.Γ) * 2.2
  })
  return (
    <group position={[src.x, src.y, 0.05]} onClick={(e) => { e.stopPropagation(); if (isErase) onRemove(src.id) }}>
      <mesh>
        <circleGeometry args={[0.16, 40]} />
        <meshBasicMaterial color={new THREE.Color(def.color).multiplyScalar(isErase ? 0.6 : 2.0)} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {radial && [0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)}>
          <ringGeometry args={[0.9, 1.0, 48]} />
          <meshBasicMaterial color={def.color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {!radial && (
        <group ref={spin}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, 0, (i / 3) * Math.PI * 2]}>
              <ringGeometry args={[0.3, 0.38, 32, 1, 0, Math.PI * 0.55]} />
              <meshBasicMaterial color={new THREE.Color(def.color).multiplyScalar(1.6)} transparent opacity={0.85} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
      {isErase && (
        <mesh>
          <ringGeometry args={[0.5, 0.56, 48]} />
          <meshBasicMaterial color="#f87171" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// ── Ghost preview at cursor ─────────────────────────────────────────────────
function GhostMarker({ pos, type }) {
  const def = SOURCE_DEFS[type]
  return (
    <mesh position={[pos[0], pos[1], 0.05]}>
      <ringGeometry args={[0.28, 0.38, 48]} />
      <meshBasicMaterial color={def.color} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Main scene ──────────────────────────────────────────────────────────────
let _nextId = 1

export default function SandboxScene({ sources, mode, strength, onAdd, onRemove }) {
  const sourcesRef  = useRef(sources)
  const strengthRef = useRef(strength)
  const [ghostPos, setGhostPos] = useState(null)

  useEffect(() => { sourcesRef.current = sources },  [sources])
  useEffect(() => { strengthRef.current = strength }, [strength])

  // Particle state; each particle is drawn as a streak from (p − v·STREAK) to p
  const { pos2, vel2, geo } = useMemo(() => {
    const pos2 = new Float32Array(N * 2)
    const vel2 = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      pos2[i*2]   = (Math.random()-0.5) * DX * 2
      pos2[i*2+1] = (Math.random()-0.5) * DY * 2
      vel2[i*2]   = (Math.random()-0.5) * 0.3
      vel2[i*2+1] = (Math.random()-0.5) * 0.3
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    return { pos2, vel2, geo }
  }, [])
  useEffect(() => () => geo.dispose(), [geo])

  // ── Physics loop ────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const dt   = Math.min(delta, 0.033)
    const srcs = sourcesRef.current
    const str  = strengthRef.current
    const P = geo.attributes.position.array, Cc = geo.attributes.color.array
    const tmp = [0, 0, 0]

    for (let i = 0; i < N; i++) {
      const i2 = i * 2
      let px = pos2[i2], py = pos2[i2+1]
      let vx = vel2[i2], vy = vel2[i2+1]
      let ax = 0, ay = 0

      for (const s of srcs) {
        const dx  = s.x - px
        const dy  = s.y - py
        const r2  = dx*dx + dy*dy + SOFT*SOFT
        const r   = Math.sqrt(r2)
        const def = SOURCE_DEFS[s.type]
        if (def.G !== 0) {
          // Radial (gravity / repulsion): F = G/r², along (dx, dy)
          const inv = def.G * str / (r2 * r)
          ax += inv * dx
          ay += inv * dy
        }
        if (def.Γ !== 0) {
          // Tangential (vortex): F = Γ/r², perpendicular to (dx, dy)
          const inv = def.Γ * str / r2
          ax += inv * (-dy)
          ay += inv * (  dx)
        }
      }

      vx = (vx + ax * dt) * DAMPING
      vy = (vy + ay * dt) * DAMPING
      const sp = Math.sqrt(vx*vx + vy*vy)
      if (sp > SPEED_MAX) { vx *= SPEED_MAX/sp; vy *= SPEED_MAX/sp }

      px += vx * dt
      py += vy * dt
      let wrapped = false
      if (px >  DX) { px -= DX*2; wrapped = true }
      if (px < -DX) { px += DX*2; wrapped = true }
      if (py >  DY) { py -= DY*2; wrapped = true }
      if (py < -DY) { py += DY*2; wrapped = true }

      vel2[i2] = vx; vel2[i2+1] = vy
      pos2[i2] = px; pos2[i2+1] = py

      const o = i * 6
      // Streak length ∝ speed, never shorter than a dot so slow tracers stay visible
      const len = wrapped ? 0 : Math.max(sp * STREAK, 0.035)
      const ux = sp > 1e-6 ? vx / sp : 1, uy = sp > 1e-6 ? vy / sp : 0
      P[o] = px - ux * len; P[o+1] = py - uy * len; P[o+2] = 0
      P[o+3] = px;        P[o+4] = py;        P[o+5] = 0
      writeColor(tmp, 0, Math.min(sp / SPEED_MAX, 1))
      const head = 1.1 + 1.4 * Math.min(sp / SPEED_MAX, 1)
      Cc[o] = tmp[0] * 0.25; Cc[o+1] = tmp[1] * 0.25; Cc[o+2] = tmp[2] * 0.25
      Cc[o+3] = tmp[0] * head; Cc[o+4] = tmp[1] * head; Cc[o+5] = tmp[2] * head
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  // ── Interaction handlers ────────────────────────────────────────────────
  const handlePlaneClick = (e) => {
    e.stopPropagation()
    if (mode === 'erase') return
    onAdd({ id: _nextId++, type: mode, x: e.point.x, y: e.point.y })
  }
  const handlePointerMove = (e) => setGhostPos([e.point.x, e.point.y])
  const handlePointerOut = () => setGhostPos(null)

  return (
    <>
      <FieldBackdrop sources={sources} strength={strength} />

      {/* Tracer streaks */}
      <lineSegments geometry={geo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>

      {/* Click plane */}
      <mesh
        position={[0, 0, -0.2]}
        onClick={handlePlaneClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[DX*2, DY*2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {sources.map((src) => (
        <SourceMarker key={src.id} src={src} mode={mode} onRemove={onRemove} />
      ))}

      {ghostPos && mode !== 'erase' && <GhostMarker pos={ghostPos} type={mode} />}
    </>
  )
}
