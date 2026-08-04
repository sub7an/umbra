import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N = 1200

// Per-module accent colors (rgb 0-1)
const MOD_COLORS = {
  null:                  [0.0,  0.85, 0.77],
  'physics-sandbox':     [0.52, 0.80, 0.09],
  'special-relativity':  [0.0,  0.90, 0.77],
  'quantum-mechanics':   [0.96, 0.62, 0.04],
  'frontier-physics':    [0.88, 0.25, 0.98],
  'dynamical-systems':   [0.06, 0.73, 0.50],
  'electromagnetism':    [0.66, 0.33, 0.97],
  'general-relativity':  [0.98, 0.57, 0.23],
  'thermodynamics':      [0.22, 0.74, 0.98],
  'fluid-dynamics':      [0.18, 0.83, 0.75],
  'sabrina':             [1.0,  0.41, 0.71],
}

// Per-module behavior mode
function getMode(id) {
  if (!id) return 'default'
  if (['special-relativity', 'fluid-dynamics', 'thermodynamics', 'physics-sandbox'].includes(id)) return 'stream'
  if (['general-relativity', 'quantum-mechanics'].includes(id)) return 'orbital'
  if (['dynamical-systems', 'electromagnetism'].includes(id)) return 'chaotic'
  if (['frontier-physics', 'sabrina'].includes(id)) return 'expansion'
  return 'default'
}

export default function PhysicsBg({ mouseRef, hoveredModule }) {
  const geoRef  = useRef()
  // Use a ref so hoveredModule changes don't force geometry recreation
  const hovRef  = useRef(hoveredModule)
  useEffect(() => { hovRef.current = hoveredModule }, [hoveredModule])

  // Particle arrays — created once, mutated every frame
  const { pos, vel, curCol, col } = useMemo(() => {
    const pos    = new Float32Array(N * 3)
    const vel    = new Float32Array(N * 3)
    const curCol = new Float32Array(N * 3)
    const col    = new Float32Array(N * 3)
    const base   = MOD_COLORS[null]
    for (let i = 0; i < N; i++) {
      // Scatter wide — boundary spring pulls them into viewport range
      pos[i * 3]     = (Math.random() - 0.5) * 44
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3

      vel[i * 3]     = (Math.random() - 0.5) * 0.15
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.15
      vel[i * 3 + 2] = 0

      curCol[i * 3]     = base[0]
      curCol[i * 3 + 1] = base[1]
      curCol[i * 3 + 2] = base[2]
      col[i * 3]     = base[0] * 0.3
      col[i * 3 + 1] = base[1] * 0.3
      col[i * 3 + 2] = base[2] * 0.3
    }
    return { pos, vel, curCol, col }
  }, [])

  const tRef = useRef(0)

  useFrame(({ viewport }, delta) => {
    tRef.current += delta
    const t  = tRef.current
    const hw = viewport.width  / 2
    const hh = viewport.height / 2

    const mouse = mouseRef.current || { x: 0, y: 0 }
    const mx = mouse.x * hw
    const my = mouse.y * hh

    const hov    = hovRef.current
    const target = MOD_COLORS[hov] || MOD_COLORS[null]
    const mode   = getMode(hov)
    const active = !!hov

    for (let i = 0; i < N; i++) {
      let px = pos[i * 3], py = pos[i * 3 + 1]
      let vx = vel[i * 3], vy = vel[i * 3 + 1]

      // Damping
      vx *= 0.974; vy *= 0.974

      // Brownian motion (more chaos when chaotic mode)
      const br = mode === 'chaotic' ? 0.045 : 0.012
      vx += (Math.random() - 0.5) * br
      vy += (Math.random() - 0.5) * br

      // Mouse attraction (always on)
      const dxM = mx - px, dyM = my - py
      const rM2 = dxM * dxM + dyM * dyM + 2.5
      vx += dxM / rM2 * 0.08
      vy += dyM / rM2 * 0.08

      // Mode-specific forces (amplified when a module is hovered)
      const amp = active ? 1.0 : 0.25
      if (mode === 'stream' || mode === 'default') {
        vx += 0.012 * amp
        vy += Math.sin(px * 0.35 + t * 1.1) * 0.005 * amp
      }
      if (mode === 'orbital') {
        const rM = Math.sqrt(rM2) + 0.1
        vx += (-dyM / rM) * 0.04 * amp
        vy += ( dxM / rM) * 0.04 * amp
      }
      if (mode === 'expansion') {
        const rc = Math.sqrt(px * px + py * py) + 0.5
        vx += (px / rc) * 0.007 * amp
        vy += (py / rc) * 0.007 * amp
      }
      if (mode === 'chaotic') {
        vx += Math.sin(py * 0.55 + t * 2.3) * 0.012 * amp
        vy += Math.cos(px * 0.55 + t * 1.8) * 0.012 * amp
      }

      // Soft boundary spring
      const bx = hw + 1.5, by = hh + 1.5
      if (px >  bx) { vx -= (px - bx)  * 0.12; px =  bx }
      if (px < -bx) { vx -= (px + bx)  * 0.12; px = -bx }
      if (py >  by) { vy -= (py - by)  * 0.12; py =  by }
      if (py < -by) { vy -= (py + by)  * 0.12; py = -by }

      // For stream mode: wrap left edge
      if (mode === 'stream' && px > hw + 1) { px = -hw - 1 }

      // Velocity clamp
      const spd   = Math.sqrt(vx * vx + vy * vy)
      const limit = mode === 'stream' ? 0.55 : mode === 'chaotic' ? 0.45 : 0.35
      if (spd > limit) { vx *= limit / spd; vy *= limit / spd }

      vel[i * 3] = vx; vel[i * 3 + 1] = vy
      pos[i * 3]     = px + vx
      pos[i * 3 + 1] = py + vy

      // Smooth color lerp toward module target
      const lr = active ? 0.025 : 0.008
      curCol[i * 3]     += (target[0] - curCol[i * 3])     * lr
      curCol[i * 3 + 1] += (target[1] - curCol[i * 3 + 1]) * lr
      curCol[i * 3 + 2] += (target[2] - curCol[i * 3 + 2]) * lr

      // Brightness falloff from mouse (glows near cursor)
      const distM = Math.sqrt(dxM * dxM + dyM * dyM)
      const glow  = active
        ? 0.18 + 0.82 * Math.exp(-distM * 0.055)
        : 0.10 + 0.40 * Math.exp(-distM * 0.07)

      col[i * 3]     = curCol[i * 3]     * glow
      col[i * 3 + 1] = curCol[i * 3 + 1] * glow
      col[i * 3 + 2] = curCol[i * 3 + 2] * glow
    }

    const geo = geoRef.current
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate    = true
    }
  })

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color"    args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
