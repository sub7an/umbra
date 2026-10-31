// Time dilation with light clocks.
//
// A light clock ticks each time a photon makes a round trip between two
// mirrors a distance H apart. In the lab frame, the moving clock's photon
// must travel a longer diagonal path at the same speed c, so its vertical
// speed is only c·√(1−β²) = c/γ and every tick takes γ times longer. The tick
// counters make the ratio visible: rest ticks / moving ticks → γ.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { lorentzFactor } from './srMath'

const C     = 2.6   // speed of light in scene units / s
const H     = 2.4   // mirror separation
const SPAN  = 3.8   // how far the moving clock travels before wrapping
const TRAIL = 220   // samples in the moving photon's zigzag trail
const REST_X = -3.1
const MOVE_X0 = -1.1

function Mirror({ y, color }) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[1.3, 0.08, 0.6]} />
      <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.08} emissive={color} emissiveIntensity={0.15} />
    </mesh>
  )
}

function ClockFrame({ color }) {
  return (
    <group>
      <Mirror y={H / 2} color={color} />
      <Mirror y={-H / 2} color={color} />
      {/* struts */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0, -0.25]}>
          <boxGeometry args={[0.04, H, 0.04]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function Photon({ color }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Triangle wave in [−H/2, H/2] for a photon moving vertically at speed vy
function bounceY(dist) {
  const period = 2 * H
  const p = ((dist % period) + period) % period
  return p < H ? -H / 2 + p : H / 2 - (p - H)
}

export default function TimeDilation() {
  const beta  = useModuleStore((s) => s.sr.velocity)
  const gamma = lorentzFactor(beta)

  const restClock = useRef()
  const restPhoton = useRef()
  const moveClock = useRef()
  const movePhoton = useRef()
  const card = useRef()

  const state = useRef({ t: 0, restDist: 0, moveDist: 0, x: 0, restTicks: 0, moveTicks: 0 })
  useEffect(() => { Object.assign(state.current, { restDist: 0, moveDist: 0, x: 0, restTicks: 0, moveTicks: 0 }) }, [beta])

  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setDrawRange(0, 0)
    return { g, buf: new Float32Array(TRAIL * 3), n: 0, head: 0 }
  }, [])
  useEffect(() => () => trail.g.dispose(), [trail])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    // Rest clock: photon moves vertically at c
    const prevRest = Math.floor(s.restDist / (2 * H))
    s.restDist += C * dt
    if (Math.floor(s.restDist / (2 * H)) > prevRest) s.restTicks++
    // Moving clock: horizontal speed βc, so the photon's vertical speed is c/γ
    const prevMove = Math.floor(s.moveDist / (2 * H))
    s.moveDist += (C / gamma) * dt
    if (Math.floor(s.moveDist / (2 * H)) > prevMove) s.moveTicks++
    s.x += beta * C * dt
    let wrapped = false
    if (s.x > SPAN) { s.x -= SPAN; wrapped = true }

    if (restPhoton.current) restPhoton.current.position.set(0, bounceY(s.restDist), 0)
    const mx = MOVE_X0 + s.x
    const my = bounceY(s.moveDist)
    if (moveClock.current) moveClock.current.position.x = mx
    if (movePhoton.current) movePhoton.current.position.set(mx, my, 0)

    // Zigzag trail of the moving photon (cleared when the clock wraps)
    if (wrapped) { trail.n = 0; trail.head = 0 }
    const i = trail.head
    trail.buf[i * 3] = mx; trail.buf[i * 3 + 1] = my; trail.buf[i * 3 + 2] = 0
    trail.head = (i + 1) % TRAIL
    trail.n = Math.min(TRAIL, trail.n + 1)
    const pos = trail.g.attributes.position.array, col = trail.g.attributes.color.array
    for (let k = 0; k < trail.n; k++) {
      const src = (trail.head - trail.n + k + TRAIL) % TRAIL
      pos[k * 3] = trail.buf[src * 3]; pos[k * 3 + 1] = trail.buf[src * 3 + 1]; pos[k * 3 + 2] = 0
      const a = k / trail.n
      col[k * 3] = 0.98 * a; col[k * 3 + 1] = 0.75 * a; col[k * 3 + 2] = 0.3 * a
    }
    trail.g.attributes.position.needsUpdate = true
    trail.g.attributes.color.needsUpdate = true
    trail.g.setDrawRange(0, trail.n)

    const c = card.current
    if (c) {
      const set = (sel, v) => { const el = c.querySelector(sel); if (el) el.textContent = v }
      set('.td-rest', s.restTicks)
      set('.td-move', s.moveTicks)
      set('.td-ratio', s.moveTicks > 0 ? (s.restTicks / s.moveTicks).toFixed(2) : '–')
    }
  })

  return (
    <group position={[-0.7, 0, 0]}>
      {/* Clock at rest */}
      <group ref={restClock} position={[REST_X, 0, 0]}>
        <ClockFrame color="#38bdf8" />
        <group ref={restPhoton}><Photon color="#38bdf8" /></group>
      </group>

      {/* Moving clock + its zigzag light path */}
      <group ref={moveClock} position={[MOVE_X0, 0, 0]}>
        <ClockFrame color="#fbbf24" />
      </group>
      <group ref={movePhoton}><Photon color="#fbbf24" /></group>
      <line geometry={trail.g} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.95} toneMapped={false} />
      </line>

      {/* Track the moving clock rides along */}
      <mesh position={[MOVE_X0 + SPAN / 2, -H / 2 - 0.22, 0]}>
        <boxGeometry args={[SPAN + 1.6, 0.04, 0.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.5} />
      </mesh>

      <Html calculatePosition={(_, __, size) => [size.width - 216, 52]} style={{ pointerEvents: 'none' }}>
        <div ref={card} style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Light clocks</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>
            One tick = light bouncing down and back. The moving photon zigzags a longer path at the same speed c, so it ticks slower.
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
            <dt><span style={{ color: '#38bdf8' }}>●</span> Clock at rest</dt>
            <dd className="td-rest" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>0</dd>
            <dt><span style={{ color: '#fbbf24' }}>●</span> Moving clock (β = {beta.toFixed(2)})</dt>
            <dd className="td-move" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>0</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Tick ratio</dt>
            <dd className="td-ratio" style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fbbf24' }}>–</dd>
            <dt style={{ color: 'rgb(var(--c-text-muted))' }}>γ = 1/√(1−β²)</dt>
            <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: '#fbbf24' }}>{gamma.toFixed(2)}</dd>
          </dl>
        </div>
      </Html>
    </group>
  )
}
