// Hard-sphere kinetic gas: elastic collisions, wall-impact "pressure" flashes,
// velocity streaks, and a live speed histogram overlaid with the theoretical
// Maxwell–Boltzmann distribution on a fixed speed axis (so heating visibly
// shifts the peak right and flattens it).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const N     = 150
const BOX   = 4.5   // half-side → box spans ±4.5
const R     = 0.17  // particle radius
const DIAM2 = (2 * R) * (2 * R)
const BINS  = 16
const V_AXIS = 7    // fixed histogram speed axis (≈ 4σ at the hottest T = 3)
const STREAK = 0.16 // velocity streak length per unit speed
const FLASHES = 64  // pooled wall-impact rings
const FLASH_LIFE = 0.45

function gaussRandom() {
  let u, v
  do { u = Math.random() } while (u === 0)
  do { v = Math.random() } while (v === 0)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Thermal colour map: slow = cool blue, medium = amber, fast = white-hot
const C_SLOW = new THREE.Color('#3b82f6')
const C_MID  = new THREE.Color('#f59e0b')
const C_FAST = new THREE.Color('#fff7ed')
function speedColor(t, out) {
  const u = Math.min(1, Math.max(0, t))
  return u < 0.5 ? out.copy(C_SLOW).lerp(C_MID, u * 2) : out.copy(C_MID).lerp(C_FAST, (u - 0.5) * 2)
}

// 3D Maxwell–Boltzmann speed pdf with σ² = kT/m = T
function mbPdf(v, T) {
  const s2 = T
  return Math.sqrt(2 / Math.PI) * (v * v) / Math.pow(s2, 1.5) * Math.exp(-(v * v) / (2 * s2))
}

// Speed markers on the histogram: [class, label, colour]
const MARKERS = [['m-vp', 'Peak vₚ', '#93c5fd'], ['m-vm', 'Mean v̄', '#fcd34d'], ['m-vr', 'v_rms', '#fda4af']]

const WALL_NORMALS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]

export default function GasSimulation({ temperature }) {
  const ballsRef  = useRef()
  const streakRef = useRef()
  const flashRef  = useRef()
  const histRef   = useRef()
  const prevTRef  = useRef(temperature)
  const tRef      = useRef(temperature)
  tRef.current    = temperature

  const state = useMemo(() => {
    const pos   = new Float32Array(N * 3)
    const vel   = new Float32Array(N * 3)
    const sigma = Math.sqrt(temperature)
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * BOX * 1.75
      pos[i*3+1] = (Math.random() - 0.5) * BOX * 1.75
      pos[i*3+2] = (Math.random() - 0.5) * BOX * 1.75
      vel[i*3]   = gaussRandom() * sigma
      vel[i*3+1] = gaussRandom() * sigma
      vel[i*3+2] = gaussRandom() * sigma
    }
    const streakPos = new Float32Array(N * 2 * 3)
    const streakCol = new Float32Array(N * 2 * 3)
    const flashes = Array.from({ length: FLASHES }, () => ({ life: 0, x: 0, y: 0, z: 0, wall: 0 }))
    return { pos, vel, streakPos, streakCol, flashes, nextFlash: 0, impacts: 0, impactClock: 0, pressure: 0 }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const streakGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.streakPos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(state.streakCol, 3))
    return g
  }, [state])
  useEffect(() => () => streakGeo.dispose(), [streakGeo])

  const boxGeo   = useMemo(() => new THREE.BoxGeometry(BOX * 2, BOX * 2, BOX * 2), [])
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo])
  useEffect(() => () => { boxGeo.dispose(); edgesGeo.dispose() }, [boxGeo, edgesGeo])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), c: new THREE.Color(), up: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3() }), [])

  useFrame((_, delta) => {
    const T    = tRef.current
    const dt   = Math.min(delta, 0.033)
    const wall = BOX - R
    const { pos, vel, flashes } = state

    if (prevTRef.current !== T) {
      const ratio = Math.sqrt(T / prevTRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTRef.current = T
    }

    const spawnFlash = (x, y, z, wallIdx) => {
      const f = flashes[state.nextFlash]
      state.nextFlash = (state.nextFlash + 1) % FLASHES
      f.life = FLASH_LIFE; f.x = x; f.y = y; f.z = z; f.wall = wallIdx
      state.impacts++
    }

    // Integrate + wall bounces (each bounce = momentum transfer = pressure)
    for (let i = 0; i < N; i++) {
      for (let d = 0; d < 3; d++) {
        pos[i*3+d] += vel[i*3+d] * dt
        if (pos[i*3+d] > wall)  { pos[i*3+d] =  wall; vel[i*3+d] = -Math.abs(vel[i*3+d]); spawnFlash(pos[i*3], pos[i*3+1], pos[i*3+2], d * 2) }
        if (pos[i*3+d] < -wall) { pos[i*3+d] = -wall; vel[i*3+d] =  Math.abs(vel[i*3+d]); spawnFlash(pos[i*3], pos[i*3+1], pos[i*3+2], d * 2 + 1) }
      }
    }

    // Elastic hard-sphere collisions O(N²/2) with axis fast-reject
    for (let i = 0; i < N - 1; i++) {
      const xi = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2]
      for (let j = i + 1; j < N; j++) {
        const dx = pos[j*3] - xi
        if (dx > 2*R || dx < -2*R) continue
        const dy = pos[j*3+1] - yi
        if (dy > 2*R || dy < -2*R) continue
        const dz = pos[j*3+2] - zi
        const d2 = dx*dx + dy*dy + dz*dz
        if (d2 >= DIAM2 || d2 < 1e-10) continue
        const d   = Math.sqrt(d2)
        const nx  = dx / d, ny = dy / d, nz = dz / d
        const dvn = (vel[i*3]-vel[j*3])*nx + (vel[i*3+1]-vel[j*3+1])*ny + (vel[i*3+2]-vel[j*3+2])*nz
        if (dvn <= 0) continue
        vel[i*3]   -= dvn * nx;  vel[i*3+1] -= dvn * ny;  vel[i*3+2] -= dvn * nz
        vel[j*3]   += dvn * nx;  vel[j*3+1] += dvn * ny;  vel[j*3+2] += dvn * nz
        const ov = (2*R - d) * 0.501
        pos[i*3]   -= nx*ov;  pos[i*3+1] -= ny*ov;  pos[i*3+2] -= nz*ov
        pos[j*3]   += nx*ov;  pos[j*3+1] += ny*ov;  pos[j*3+2] += nz*ov
      }
    }

    // Particles (instanced lit spheres) + velocity streaks, coloured by speed
    const balls = ballsRef.current
    const bins = new Int32Array(BINS)
    let sumV = 0
    for (let i = 0; i < N; i++) {
      const vx = vel[i*3], vy = vel[i*3+1], vz = vel[i*3+2]
      const sp = Math.sqrt(vx*vx + vy*vy + vz*vz)
      sumV += sp
      bins[Math.min(BINS - 1, Math.floor((sp / V_AXIS) * BINS))]++
      speedColor(sp / (V_AXIS * 0.75), tmp.c)

      if (balls) {
        tmp.m.makeTranslation(pos[i*3], pos[i*3+1], pos[i*3+2])
        balls.setMatrixAt(i, tmp.m)
        balls.setColorAt(i, tmp.c)
      }
      const o = i * 6
      state.streakPos[o]   = pos[i*3];   state.streakPos[o+1] = pos[i*3+1]; state.streakPos[o+2] = pos[i*3+2]
      state.streakPos[o+3] = pos[i*3]   - vx * STREAK
      state.streakPos[o+4] = pos[i*3+1] - vy * STREAK
      state.streakPos[o+5] = pos[i*3+2] - vz * STREAK
      state.streakCol[o] = tmp.c.r; state.streakCol[o+1] = tmp.c.g; state.streakCol[o+2] = tmp.c.b
      state.streakCol[o+3] = 0;     state.streakCol[o+4] = 0;       state.streakCol[o+5] = 0
    }
    if (balls) {
      balls.instanceMatrix.needsUpdate = true
      if (balls.instanceColor) balls.instanceColor.needsUpdate = true
    }
    streakGeo.attributes.position.needsUpdate = true
    streakGeo.attributes.color.needsUpdate = true

    // Wall-impact flashes: rings lying flat on the wall that expand and fade
    const fl = flashRef.current
    if (fl) {
      for (let k = 0; k < FLASHES; k++) {
        const f = flashes[k]
        f.life = Math.max(0, f.life - dt)
        const age = 1 - f.life / FLASH_LIFE
        const scale = f.life > 0 ? 0.15 + age * 0.45 : 0
        const [nx, ny, nz] = WALL_NORMALS[f.wall]
        tmp.n.set(nx, ny, nz)
        tmp.q.setFromUnitVectors(tmp.up, tmp.n)
        tmp.p.set(f.x + nx * R, f.y + ny * R, f.z + nz * R)
        tmp.s.set(scale, scale, scale)
        tmp.m.compose(tmp.p, tmp.q, tmp.s)
        fl.setMatrixAt(k, tmp.m)
        tmp.c.setRGB(0.35, 0.75, 1).multiplyScalar(f.life / FLASH_LIFE * 1.6)
        fl.setColorAt(k, tmp.c)
      }
      fl.instanceMatrix.needsUpdate = true
      if (fl.instanceColor) fl.instanceColor.needsUpdate = true
    }

    // Pressure ∝ wall-impact rate (smoothed over ~1 s)
    state.impactClock += dt
    if (state.impactClock >= 0.5) {
      const rate = state.impacts / state.impactClock
      state.pressure = state.pressure ? state.pressure * 0.6 + rate * 0.4 : rate
      state.impacts = 0
      state.impactClock = 0
    }

    // Histogram + theory curve (DOM updated imperatively — no re-render)
    const h = histRef.current
    if (h) {
      const binW = V_AXIS / BINS
      let maxCount = 1
      const expected = new Float32Array(BINS)
      for (let k = 0; k < BINS; k++) {
        expected[k] = N * mbPdf((k + 0.5) * binW, T) * binW
        maxCount = Math.max(maxCount, bins[k], expected[k])
      }
      const bars = h.querySelectorAll('.hb')
      for (let k = 0; k < BINS; k++) {
        if (bars[k]) bars[k].style.height = ((bins[k] / maxCount) * 100).toFixed(1) + '%'
      }
      const curve = h.querySelector('.mb-curve')
      if (curve) {
        const pts = []
        for (let s = 0; s <= 60; s++) {
          const v = (s / 60) * V_AXIS
          const y = (N * mbPdf(v, T) * binW) / maxCount
          pts.push(`${((s / 60) * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`)
        }
        curve.setAttribute('points', pts.join(' '))
      }
      const sigma = Math.sqrt(T)
      const marks = { '.m-vp': sigma * Math.SQRT2, '.m-vm': sigma * Math.sqrt(8 / Math.PI), '.m-vr': sigma * Math.sqrt(3) }
      for (const [sel, v] of Object.entries(marks)) {
        const el = h.querySelector(sel)
        if (el) el.style.left = `${Math.min(100, (v / V_AXIS) * 100).toFixed(1)}%`
      }
      const set = (sel, txt) => { const el = h.querySelector(sel); if (el) el.textContent = txt }
      set('.r-vrms', (sigma * Math.sqrt(3)).toFixed(2))
      set('.r-mean', (sumV / N).toFixed(2))
      set('.r-p', state.pressure ? state.pressure.toFixed(0) : '–')
    }
  })

  return (
    <group>
      {/* Container: faint glass faces + crisp edges */}
      <mesh geometry={boxGeo}>
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.035} roughness={0.15} metalness={0.1} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.45} />
      </lineSegments>

      {/* Particles */}
      <instancedMesh ref={ballsRef} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[R, 20, 14]} />
        <meshStandardMaterial roughness={0.35} metalness={0.15} emissive="#1e3a8a" emissiveIntensity={0.25} />
      </instancedMesh>

      {/* Velocity streaks (fade from particle colour to transparent black) */}
      <lineSegments ref={streakRef} geometry={streakGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Wall-impact flashes */}
      <instancedMesh ref={flashRef} args={[undefined, undefined, FLASHES]} frustumCulled={false}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      {/* Live speed distribution vs Maxwell–Boltzmann theory */}
      {/* Pinned to the scene's top-right corner so it's always in view */}
      <Html calculatePosition={(_, __, size) => [size.width - 246, 52]} style={{ pointerEvents: 'none' }}>
        <div ref={histRef} style={{
          width: 230,
          background: 'rgb(var(--c-panel) / 0.92)',
          border: '1px solid rgb(var(--c-border))',
          borderRadius: 10,
          padding: '12px 14px',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: 'rgb(var(--c-text))',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Speed distribution</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--c-text-muted))', marginBottom: 10 }}>
            Bars: simulation · line: Maxwell–Boltzmann
          </div>

          <div style={{ position: 'relative', height: 96, borderLeft: '1px solid rgb(var(--c-border))', borderBottom: '1px solid rgb(var(--c-border))' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 2, padding: '0 1px' }}>
              {Array.from({ length: BINS }, (_, k) => {
                const c = speedColor((k + 0.5) / BINS / 0.75, new THREE.Color())
                return (
                  <div key={k} className="hb" style={{
                    flex: 1, height: '0%',
                    background: `#${c.getHexString()}`,
                    borderRadius: '2px 2px 0 0', opacity: 0.85,
                  }} />
                )
              })}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <polyline className="mb-curve" fill="none" stroke="#e2e8f0" strokeWidth="1.6" vectorEffect="non-scaling-stroke" points="" />
            </svg>
            {MARKERS.map(([cls, , col]) => (
              <div key={cls} className={cls} style={{ position: 'absolute', top: -2, bottom: 0, width: 0, borderLeft: `1px dashed ${col}` }}>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'rgb(var(--c-text-muted))', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>0</span><span>speed v</span><span>{V_AXIS}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
            {MARKERS.map(([cls, lbl, col]) => (
              <span key={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgb(var(--c-text-muted))' }}>
                <span style={{ width: 10, borderTop: `2px dashed ${col}` }} />{lbl}
              </span>
            ))}
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, marginTop: 10, fontSize: 12 }}>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>v_rms = √(3kT/m)</dt>
            <dd className="r-vrms" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>–</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Mean speed (sim)</dt>
            <dd className="r-mean" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>–</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Wall hits / s (∝ p)</dt>
            <dd className="r-p" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>–</dd>
          </dl>
        </div>
      </Html>
    </group>
  )
}
