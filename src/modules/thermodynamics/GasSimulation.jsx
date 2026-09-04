// Hard-sphere kinetic gas: elastic collisions + live Maxwell-Boltzmann histogram
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const N    = 150
const BOX  = 4.5   // half-side → box spans ±4.5
const R    = 0.17  // particle radius
const DIAM2 = (2 * R) * (2 * R)
const BINS  = 14

function gaussRandom() {
  let u, v
  do { u = Math.random() } while (u === 0)
  do { v = Math.random() } while (v === 0)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function binColor(k) {
  const t = k / (BINS - 1)
  return [
    Math.round((0.2 + t * 0.8) * 255),
    Math.round((0.4 + t * 0.3) * 255),
    Math.round((1.0 - t * 0.9) * 255),
  ]
}

export default function GasSimulation({ temperature }) {
  const geoRef   = useRef()
  const histRef  = useRef()
  const prevTRef = useRef(temperature)
  const tRef     = useRef(temperature)
  tRef.current   = temperature

  const state = useMemo(() => {
    const pos   = new Float32Array(N * 3)
    const vel   = new Float32Array(N * 3)
    const col   = new Float32Array(N * 3)
    const sigma = Math.sqrt(temperature)
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * BOX * 1.75
      pos[i*3+1] = (Math.random() - 0.5) * BOX * 1.75
      pos[i*3+2] = (Math.random() - 0.5) * BOX * 1.75
      vel[i*3]   = gaussRandom() * sigma
      vel[i*3+1] = gaussRandom() * sigma
      vel[i*3+2] = gaussRandom() * sigma
      col[i*3] = 0.2; col[i*3+1] = 0.6; col[i*3+2] = 1.0
    }
    return { pos, vel, col }
  }, [])

  const { pos, vel, col } = state

  useFrame((_, delta) => {
    const T    = tRef.current
    const dt   = Math.min(delta, 0.033)
    const wall = BOX * 0.97

    // Rescale velocities if temperature changed
    if (prevTRef.current !== T) {
      const ratio = Math.sqrt(T / prevTRef.current)
      for (let i = 0; i < N * 3; i++) vel[i] *= ratio
      prevTRef.current = T
    }

    // Integrate
    for (let i = 0; i < N; i++) {
      pos[i*3]   += vel[i*3]   * dt
      pos[i*3+1] += vel[i*3+1] * dt
      pos[i*3+2] += vel[i*3+2] * dt
      for (let d = 0; d < 3; d++) {
        if (pos[i*3+d] >  wall) { pos[i*3+d] =  wall; vel[i*3+d] = -Math.abs(vel[i*3+d]) }
        if (pos[i*3+d] < -wall) { pos[i*3+d] = -wall; vel[i*3+d] =  Math.abs(vel[i*3+d]) }
      }
    }

    // Elastic hard-sphere collisions O(N²/2) with AABB fast-reject
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
        if (dvn <= 0) continue  // already separating
        // Equal-mass elastic: exchange momentum component along normal
        vel[i*3]   -= dvn * nx;  vel[i*3+1] -= dvn * ny;  vel[i*3+2] -= dvn * nz
        vel[j*3]   += dvn * nx;  vel[j*3+1] += dvn * ny;  vel[j*3+2] += dvn * nz
        // Positional correction to prevent tunneling
        const ov = (2*R - d) * 0.501
        pos[i*3]   -= nx*ov;  pos[i*3+1] -= ny*ov;  pos[i*3+2] -= nz*ov
        pos[j*3]   += nx*ov;  pos[j*3+1] += ny*ov;  pos[j*3+2] += nz*ov
      }
    }

    // Speed stats + histogram bins
    let maxSp = 0.001
    const speeds = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const vx = vel[i*3], vy = vel[i*3+1], vz = vel[i*3+2]
      speeds[i] = Math.sqrt(vx*vx + vy*vy + vz*vz)
      if (speeds[i] > maxSp) maxSp = speeds[i]
    }

    const bins = new Int32Array(BINS)
    for (let i = 0; i < N; i++) {
      const t  = speeds[i] / maxSp
      col[i*3]   = 0.2 + t * 0.8
      col[i*3+1] = 0.4 + t * 0.3
      col[i*3+2] = 1.0 - t * 0.9
      bins[Math.min(BINS - 1, Math.floor(t * BINS))]++
    }

    // Update histogram DOM imperatively (no re-render)
    if (histRef.current) {
      const maxBin = Math.max(1, ...bins)
      const bars = histRef.current.querySelectorAll('.hb')
      for (let k = 0; k < BINS; k++) {
        if (bars[k]) bars[k].style.height = ((bins[k] / maxBin) * 58).toFixed(0) + 'px'
      }
      const vrmsEl = histRef.current.querySelector('.vrms')
      if (vrmsEl) vrmsEl.textContent = `v_rms ≈ ${Math.sqrt(3 * T).toFixed(2)}`
    }

    const geo = geoRef.current
    if (!geo) return
    geo.attributes.position.array.set(pos)
    geo.attributes.color.array.set(col)
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate    = true
  })

  return (
    <group>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 7, 2]} intensity={0.4} color="#38bdf8" />

      {/* Container box */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX*1.94, BOX*1.94, BOX*1.94)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.09} />
      </lineSegments>

      {/* Particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.11} vertexColors transparent opacity={0.92}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>

      {/* Live Maxwell-Boltzmann histogram */}
      <Html position={[6.6, 0.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div ref={histRef} style={{
          width: 136,
          background: 'rgba(7,4,26,0.88)',
          border: '1px solid rgba(56,189,248,0.15)',
          borderRadius: 3,
          padding: '8px 10px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ fontSize: 7, letterSpacing: '0.18em', color: 'rgba(56,189,248,0.45)', marginBottom: 6 }}>
            SPEED DISTRIBUTION
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 62 }}>
            {Array.from({ length: BINS }, (_, k) => {
              const [r, g, b] = binColor(k)
              return (
                <div key={k} className="hb" style={{
                  flex: 1,
                  height: 4,
                  background: `rgb(${r},${g},${b})`,
                  borderRadius: '1px 1px 0 0',
                  opacity: 0.82,
                }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 7, color: 'rgba(56,189,248,0.28)' }}>
            <span>0</span><span>v_max</span>
          </div>
          <div className="vrms" style={{ fontSize: 8, color: '#38bdf8', marginTop: 6, opacity: 0.65 }}>
            v_rms ≈ –
          </div>
          <div style={{ fontSize: 7, color: 'rgba(56,189,248,0.28)', marginTop: 2 }}>
            Maxwell-Boltzmann
          </div>
        </div>
      </Html>
    </group>
  )
}
