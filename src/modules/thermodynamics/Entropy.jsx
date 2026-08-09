// Free expansion / Gibbs mixing entropy demo.
// Partition opens after 2 s; live ΔS/Nk readout + mixing bar.
import { useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const N     = 400
const BOX_W = 4.5
const BOX_H = 3.5
const GAP   = 0.06

function initState(temperature) {
  const pos  = new Float32Array(N * 3)
  const vel  = new Float32Array(N * 3)
  const col  = new Float32Array(N * 3)
  const side = new Int8Array(N)   // 0 = cyan (left), 1 = orange (right)
  for (let i = 0; i < N; i++) {
    const s = i < N / 2 ? 0 : 1
    side[i]    = s
    pos[i*3]   = (s === 0 ? -1 : 1) * (Math.random() * (BOX_W * 0.5 - 0.2) + 0.1)
    pos[i*3+1] = (Math.random() - 0.5) * BOX_H * 1.6
    pos[i*3+2] = (Math.random() - 0.5) * 0.8
    const sigma = Math.sqrt(temperature) * (s === 0 ? 1.0 : 0.7)
    vel[i*3]   = (Math.random() - 0.5) * sigma * 2
    vel[i*3+1] = (Math.random() - 0.5) * sigma * 2
    vel[i*3+2] = 0
    col[i*3]   = s === 0 ? 0.12 : 1.0
    col[i*3+1] = s === 0 ? 0.82 : 0.42
    col[i*3+2] = s === 0 ? 1.0  : 0.1
  }
  return { pos, vel, col, side }
}

export default function Entropy({ temperature }) {
  const geoRef      = useRef()
  const wallRef     = useRef()
  const timeRef     = useRef(0)
  const openPctRef  = useRef(0)
  const prevTRef    = useRef(temperature)
  const tRef        = useRef(temperature)
  tRef.current      = temperature

  // Live readout DOM refs
  const dsRef       = useRef()   // ΔS/Nk value
  const barRef      = useRef()   // bar fill
  const pctRef      = useRef()   // percentage text
  const phaseRef    = useRef()   // phase label

  const state = useMemo(() => initState(temperature), [])   // eslint-disable-line
  const { pos, vel, col, side } = state

  const reset = useCallback(() => {
    const fresh = initState(tRef.current)
    pos.set(fresh.pos)
    vel.set(fresh.vel)
    col.set(fresh.col)
    side.set(fresh.side)
    timeRef.current   = 0
    openPctRef.current = 0
    prevTRef.current  = tRef.current
  }, [pos, vel, col, side])

  useFrame((_, delta) => {
    timeRef.current += delta
    const dt = Math.min(delta, 0.04)
    const T  = tRef.current

    // Temperature rescale
    if (prevTRef.current !== T) {
      const ratio = Math.sqrt(T / prevTRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTRef.current = T
    }

    // Partition opening
    if (timeRef.current > 2 && openPctRef.current < 1) {
      openPctRef.current = Math.min(1, openPctRef.current + delta * 0.38)
    }
    const open = openPctRef.current
    const gap  = open * BOX_H

    if (wallRef.current) wallRef.current.scale.y = Math.max(0.001, 1 - open)

    // Integrate particles
    let crossed = 0
    for (let i = 0; i < N; i++) {
      pos[i*3]   += vel[i*3]   * dt
      pos[i*3+1] += vel[i*3+1] * dt

      if (pos[i*3]   >  BOX_W * 0.9) { pos[i*3]   =  BOX_W * 0.9; vel[i*3]   *= -1 }
      if (pos[i*3]   < -BOX_W * 0.9) { pos[i*3]   = -BOX_W * 0.9; vel[i*3]   *= -1 }
      if (pos[i*3+1] >  BOX_H * 0.9) { pos[i*3+1] =  BOX_H * 0.9; vel[i*3+1] *= -1 }
      if (pos[i*3+1] < -BOX_H * 0.9) { pos[i*3+1] = -BOX_H * 0.9; vel[i*3+1] *= -1 }

      const x = pos[i*3], y = pos[i*3+1]
      const withinGap = Math.abs(y) < gap * 0.5
      if (!withinGap) {
        if (vel[i*3] > 0 && x > -GAP && x < GAP && x >= 0 && side[i] === 0) {
          pos[i*3] = -GAP; vel[i*3] *= -1
        }
        if (vel[i*3] < 0 && x > -GAP && x < GAP && x <= 0 && side[i] === 1) {
          pos[i*3] =  GAP; vel[i*3] *= -1
        }
      }

      // Count crossed particles (entropy proxy)
      const wrongSide = (side[i] === 0 && pos[i*3] > 0) || (side[i] === 1 && pos[i*3] < 0)
      if (wrongSide) crossed++

      // Vertex color: fades toward mix as partition opens
      const mixFrac = open * 0.45
      const s = side[i]
      col[i*3]   = s === 0 ? 0.12 + mixFrac * 0.88 : 1.0  - mixFrac * 0.5
      col[i*3+1] = s === 0 ? 0.82 - mixFrac * 0.42 : 0.42 + mixFrac * 0.28
      col[i*3+2] = s === 0 ? 1.0  - mixFrac * 0.60 : 0.10 + mixFrac * 0.55
    }

    const geo = geoRef.current
    if (geo) {
      geo.attributes.position.array.set(pos)
      geo.attributes.color.array.set(col)
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate    = true
    }

    // ── Entropy readout ──────────────────────────────────────────────────────
    // Gibbs mixing: ΔS/Nk = ln(2) at full mixing (crossed = N/2)
    const mixFrac = Math.min(crossed / (N / 2), 1.0)
    const dS = (mixFrac * Math.LN2).toFixed(3)
    const pct = Math.round(mixFrac * 100)

    if (dsRef.current)    dsRef.current.textContent    = dS
    if (pctRef.current)   pctRef.current.textContent   = `${pct}%`
    if (barRef.current)   barRef.current.style.height  = `${pct}%`

    if (phaseRef.current) {
      if (open === 0)      phaseRef.current.textContent = 'SEALED'
      else if (open < 1)   phaseRef.current.textContent = 'OPENING'
      else if (pct < 30)   phaseRef.current.textContent = 'DIFFUSING'
      else if (pct < 70)   phaseRef.current.textContent = 'MIXING'
      else                 phaseRef.current.textContent = 'EQUILIBRIUM'
    }
  })

  return (
    <group>
      <ambientLight intensity={0.08} color="#060e18" />
      <pointLight position={[0, 6, 4]} intensity={0.9} color="#38bdf8" distance={16} decay={2} />
      <pointLight position={[0, 0, 2]} intensity={0.5} color="#ffffff" distance={8} decay={2} />

      {/* Container box */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_W * 1.8, BOX_H * 1.8, 1)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.14} />
      </lineSegments>

      {/* Partition wall — shrinks as it opens */}
      <mesh ref={wallRef}>
        <boxGeometry args={[0.055, BOX_H * 1.8, 0.35]} />
        <meshStandardMaterial
          color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.5}
          transparent opacity={0.65}
        />
      </mesh>

      {/* Particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.10} vertexColors transparent opacity={0.88}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
        />
      </points>

      {/* ── Entropy panel ── */}
      <Html position={[BOX_W * 0.9 + 0.4, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(4,9,14,0.88)',
          border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: 3, padding: '8px 10px',
          width: 88,
          userSelect: 'none',
        }}>
          <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.45)', letterSpacing: '0.14em', marginBottom: 6 }}>
            ΔS / Nk
          </div>

          {/* Bar */}
          <div style={{
            width: 14, height: 90,
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.15)',
            borderRadius: 2, margin: '0 auto 6px',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column-reverse',
          }}>
            <div ref={barRef} style={{
              width: '100%', height: '0%',
              background: 'linear-gradient(to top, rgba(56,189,248,0.8), rgba(56,189,248,0.25))',
              transition: 'height 0.15s linear',
            }} />
          </div>

          <div ref={dsRef} style={{ fontSize: 13, color: '#38bdf8', textAlign: 'center', marginBottom: 2 }}>
            0.000
          </div>
          <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.35)', textAlign: 'center', marginBottom: 6 }}>
            ln 2 = {Math.LN2.toFixed(3)}
          </div>

          <div ref={pctRef} style={{ fontSize: 10, color: '#38bdf8', textAlign: 'center', marginBottom: 4 }}>
            0%
          </div>
          <div ref={phaseRef} style={{
            fontSize: 7, color: 'rgba(56,189,248,0.5)',
            letterSpacing: '0.12em', textAlign: 'center',
          }}>
            SEALED
          </div>
        </div>
      </Html>

      {/* Reset button */}
      <Html position={[0, -BOX_H * 0.9 - 0.55, 0]} center style={{ pointerEvents: 'all' }}>
        <button onClick={reset} style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8, letterSpacing: '0.14em',
          color: 'rgba(56,189,248,0.55)',
          background: 'rgba(4,9,14,0.88)',
          border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: 2, padding: '4px 14px',
          cursor: 'pointer',
        }}>
          RESET
        </button>
      </Html>

      {/* Labels */}
      <Html position={[-BOX_W * 0.5, BOX_H * 0.82, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8, color:'rgba(56,189,248,0.5)', letterSpacing:'0.12em' }}>
          GAS A (cyan)
        </div>
      </Html>
      <Html position={[BOX_W * 0.5, BOX_H * 0.82, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8, color:'rgba(251,146,60,0.5)', letterSpacing:'0.12em' }}>
          GAS B (orange)
        </div>
      </Html>
    </group>
  )
}
