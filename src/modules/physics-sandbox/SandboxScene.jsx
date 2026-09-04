import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// ── Constants ──────────────────────────────────────────────────────────────────
const N        = 900     // tracer particle count
const SOFT     = 0.55    // softening: prevents r=0 singularity
const DAMPING  = 0.991   // velocity damping per frame
const SPEED_MAX = 8.5
const DX = 10, DY = 6.5  // domain half-extents (world units)

export const SOURCE_DEFS = {
  attractor:  { color: '#f59e0b', label: 'Attractor',  symbol: '◉', G:  3.5, Γ:  0   },
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

// ── Source visual marker ────────────────────────────────────────────────────
function SourceMarker({ src, mode, onRemove }) {
  const def  = SOURCE_DEFS[src.type]
  const tRef = useRef(0)
  const coreRef = useRef(), ringRef = useRef()
  const isErase = mode === 'erase'

  useFrame((_, dt) => {
    tRef.current += dt
    const t = tRef.current
    if (coreRef.current) coreRef.current.scale.setScalar(1 + 0.07 * Math.sin(t * 3.2))
    if (ringRef.current) ringRef.current.scale.setScalar(1 + 0.18 * Math.sin(t * 1.9 + 1))
  })

  return (
    <group
      position={[src.x, src.y, 0.05]}
      onClick={(e) => { e.stopPropagation(); if (isErase) onRemove(src.id) }}
    >
      <mesh ref={coreRef}>
        <circleGeometry args={[0.22, 40]} />
        <meshBasicMaterial color={def.color} transparent opacity={isErase ? 0.4 : 0.85} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.30, 0.40, 48]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{
          display: 'block',
          transform: 'translateY(-30px)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 15,
          fontWeight: 700,
          color: def.color,
          textShadow: `0 0 10px ${def.color}, 0 0 20px ${def.color}`,
        }}>
          {isErase ? '✕' : def.symbol}
        </span>
      </Html>
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
  const geoRef     = useRef()
  const sourcesRef = useRef(sources)
  const strengthRef = useRef(strength)
  const [ghostPos, setGhostPos] = useState(null)

  useEffect(() => { sourcesRef.current = sources },  [sources])
  useEffect(() => { strengthRef.current = strength }, [strength])

  // Particle state — allocated once, mutated every frame
  const { pos2, vel2, pos3, col } = useMemo(() => {
    const pos2 = new Float32Array(N * 2)
    const vel2 = new Float32Array(N * 2)
    const pos3 = new Float32Array(N * 3)
    const col  = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos2[i*2]   = (Math.random()-0.5) * DX * 2
      pos2[i*2+1] = (Math.random()-0.5) * DY * 2
      vel2[i*2]   = (Math.random()-0.5) * 0.3
      vel2[i*2+1] = (Math.random()-0.5) * 0.3
      writeColor(col, i*3, 0.05)
    }
    return { pos2, vel2, pos3, col }
  }, [])

  // ── Physics loop ────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const dt   = Math.min(delta, 0.033)
    const srcs = sourcesRef.current
    const str  = strengthRef.current

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
          // Radial (gravity / repulsion): F = G/r²  direction along (dx,dy)
          const inv = def.G * str / (r2 * r)
          ax += inv * dx
          ay += inv * dy
        }
        if (def.Γ !== 0) {
          // Tangential (vortex): F = Γ/r²  direction perpendicular to (dx,dy)
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

      // Wrap at domain boundary
      if (px >  DX) px -= DX*2
      if (px < -DX) px += DX*2
      if (py >  DY) py -= DY*2
      if (py < -DY) py += DY*2

      vel2[i2]   = vx; vel2[i2+1] = vy
      pos2[i2]   = px; pos2[i2+1] = py
      pos3[i*3]  = px; pos3[i*3+1] = py; pos3[i*3+2] = 0
      writeColor(col, i*3, Math.min(sp / SPEED_MAX, 1))
    }

    if (geoRef.current) {
      geoRef.current.attributes.position.needsUpdate = true
      geoRef.current.attributes.color.needsUpdate    = true
    }
  })

  // ── Interaction handlers ────────────────────────────────────────────────
  const handlePlaneClick = (e) => {
    e.stopPropagation()
    if (mode === 'erase') return
    onAdd({ id: _nextId++, type: mode, x: e.point.x, y: e.point.y })
  }

  const handlePointerMove = (e) => {
    setGhostPos([e.point.x, e.point.y])
  }

  const handlePointerOut = () => setGhostPos(null)

  return (
    <>
      {/* ── Tracer particles ── */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos3, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col,  3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.10} vertexColors transparent opacity={0.88}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
        />
      </points>

      {/* ── Click plane (behind everything) ── */}
      <mesh
        position={[0, 0, -0.2]}
        onClick={handlePlaneClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[DX*2, DY*2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Source markers ── */}
      {sources.map((src) => (
        <SourceMarker key={src.id} src={src} mode={mode} onRemove={onRemove} />
      ))}

      {/* ── Ghost cursor preview ── */}
      {ghostPos && mode !== 'erase' && (
        <GhostMarker pos={ghostPos} type={mode} />
      )}
    </>
  )
}
