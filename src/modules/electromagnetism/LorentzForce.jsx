// Charged particle in uniform B field: cyclotron / helical motion
// B = B0 ŷ, F = qv × B  →  circular motion in xz plane + drift along y
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const TRAIL  = 320
const GRID_N = 5   // B-field arrow grid (GRID_N × GRID_N)
const GRID_S = 1.8 // grid spacing

// ─── Uniform B-field arrow grid ──────────────────────────────────────────────
function BFieldGrid({ B }) {
  const arrows = useMemo(() => {
    const dir    = new THREE.Vector3(0, 1, 0)
    const up     = new THREE.Vector3(0, 1, 0)
    const origin = new THREE.Vector3()
    const len    = 0.55 + B * 0.18
    const list   = []
    const half   = Math.floor(GRID_N / 2)
    for (let i = -half; i <= half; i++) {
      for (let j = -half; j <= half; j++) {
        const x = i * GRID_S, z = j * GRID_S
        // Skip cells near the particle's typical path (center)
        if (Math.abs(x) < 0.5 && Math.abs(z) < 0.5) continue
        list.push(new THREE.Vector3(x, -2.8, z))
      }
    }
    return { list, dir, len }
  }, [B])

  return (
    <group>
      {arrows.list.map((pos, i) => (
        <arrowHelper key={i}
          args={[arrows.dir, pos, arrows.len, '#6b21a8', arrows.len * 0.26, arrows.len * 0.14]}
        />
      ))}
    </group>
  )
}

// ─── Lorentz force arrow (imperative, updated from useFrame) ─────────────────
function ForceArrow({ arrowRef }) {
  const groupRef = useRef()

  useEffect(() => {
    const dir = new THREE.Vector3(1, 0, 0)
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), 1.2, 0x00e5c4, 0.32, 0.18)
    groupRef.current.add(arrow)
    arrowRef.current = arrow
    return () => {
      groupRef.current?.remove(arrow)
      arrow.line.geometry.dispose()
      arrow.cone.geometry.dispose()
    }
  }, [arrowRef])

  return <group ref={groupRef} />
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LorentzForce({ bStrength = 1.0 }) {
  const particleRef  = useRef()
  const trailGeoRef  = useRef()
  const arrowRef     = useRef()
  const bRef         = useRef(bStrength)
  bRef.current       = bStrength

  // Simulation state — all in refs, mutated in useFrame
  const simRef = useRef({
    pos: [0.0, -3.2, 0.0],
    vel: [2.4,  0.9,  0.0],   // v_perp xz + v_drift y
    trail: new Float32Array(TRAIL * 3),
    idx: 0,
    fill: 0,
    age:  new Float32Array(TRAIL),  // 0=oldest, 1=newest (for color fade)
  })

  // Trail geometry
  const trailGeo = useMemo(() => {
    const arr = new Float32Array(TRAIL * 3)
    const col = new Float32Array(TRAIL * 3)
    const g   = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  useEffect(() => {
    trailGeoRef.current = trailGeo
    return () => trailGeo.dispose()
  }, [trailGeo])

  useFrame((_, delta) => {
    const dt  = Math.min(delta, 0.016)
    const sim = simRef.current
    const B   = bRef.current

    // RK4 integration: dv/dt = q/m * v × B, B = [0, B, 0]
    // (v × B)_x = vz*0 - vy*0... wait: B=[0,B,0]
    // v × B = |i  j  k |   = i(vy*0-vz*B) - j(vx*0-vz*0) + k(vx*B-vy*0)
    //         |vx vy vz|
    //         |0  B  0 |
    // = [-vz*B, 0, vx*B]
    const acc = ([vx, vy, vz]) => [-vz * B, 0, vx * B]

    const [x, y, z]     = sim.pos
    const [vx, vy, vz]  = sim.vel

    // k1
    const a1 = acc([vx, vy, vz])
    // k2
    const v2 = [vx + a1[0]*dt/2, vy + a1[1]*dt/2, vz + a1[2]*dt/2]
    const a2 = acc(v2)
    // k3
    const v3 = [vx + a2[0]*dt/2, vy + a2[1]*dt/2, vz + a2[2]*dt/2]
    const a3 = acc(v3)
    // k4
    const v4 = [vx + a3[0]*dt, vy + a3[1]*dt, vz + a3[2]*dt]
    const a4 = acc(v4)

    const nvx = vx + dt/6*(a1[0]+2*a2[0]+2*a3[0]+a4[0])
    const nvy = vy + dt/6*(a1[1]+2*a2[1]+2*a3[1]+a4[1])
    const nvz = vz + dt/6*(a1[2]+2*a2[2]+2*a3[2]+a4[2])
    const nx  = x + dt/2*(vx+nvx)
    const ny  = y + dt/2*(vy+nvy)
    const nz  = z + dt/2*(vz+nvz)

    sim.vel = [nvx, nvy, nvz]
    sim.pos = [nx, ny, nz]

    // Wrap y drift (reset to bottom when too high)
    if (ny > 4.0) {
      sim.pos[1] = -3.2
      // Keep xz velocity, keep drift, reset trail
      sim.fill = 0
      sim.idx  = 0
    }

    // Store trail point
    const idx = sim.idx
    sim.trail[idx*3]   = nx
    sim.trail[idx*3+1] = ny
    sim.trail[idx*3+2] = nz
    sim.idx  = (idx + 1) % TRAIL
    if (sim.fill < TRAIL) sim.fill++

    // Update particle mesh
    if (particleRef.current) {
      particleRef.current.position.set(nx, ny, nz)
    }

    // Update trail geometry (reorder circular buffer + color fade)
    const geo = trailGeoRef.current
    if (geo) {
      const posAttr = geo.attributes.position
      const colAttr = geo.attributes.color
      const fill = sim.fill
      for (let i = 0; i < fill; i++) {
        const ti  = (idx - fill + 1 + i + TRAIL) % TRAIL
        const age = i / fill  // 0=oldest, 1=newest
        posAttr.setXYZ(i, sim.trail[ti*3], sim.trail[ti*3+1], sim.trail[ti*3+2])
        // Color: fade from purple (old) to cyan (new)
        colAttr.setXYZ(i,
          (1 - age) * 0.55 + age * 0.0,   // R
          (1 - age) * 0.0  + age * 0.9,   // G
          (1 - age) * 0.85 + age * 0.85,  // B
        )
      }
      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      geo.setDrawRange(0, fill)
    }

    // Update Lorentz force arrow: F = q*v × B = [-vz*B, 0, vx*B]
    const arrow = arrowRef.current
    if (arrow) {
      const fx = -nvz * B, fy = 0, fz = nvx * B
      const fmag = Math.sqrt(fx*fx + fz*fz) + 1e-9
      const fnorm = new THREE.Vector3(fx/fmag, 0, fz/fmag)
      const flen  = Math.min(fmag * 0.38, 2.4)
      arrow.position.set(nx, ny, nz)
      arrow.setDirection(fnorm)
      arrow.setLength(flen, flen * 0.28, flen * 0.16)
    }
  })

  // Speed readout every ~0.5s via separate counter
  const readoutRef = useRef()
  const readoutT   = useRef(0)
  useFrame((_, delta) => {
    readoutT.current += delta
    if (readoutT.current > 0.25) {
      readoutT.current = 0
      const [vx, , vz] = simRef.current.vel
      const vperp = Math.sqrt(vx*vx + vz*vz)
      const B     = bRef.current
      const r     = B > 0.01 ? (vperp / B).toFixed(2) : '∞'
      if (readoutRef.current) {
        readoutRef.current.textContent = `r = ${r}  |v⊥| = ${vperp.toFixed(2)}`
      }
    }
  })

  return (
    <group>
      <ambientLight intensity={0.10} color="#080814" />
      <directionalLight position={[3, 8, 4]} intensity={0.35} color="#dde8ff" />

      {/* B-field arrow grid */}
      <BFieldGrid B={bStrength} />

      {/* Trail line */}
      <line geometry={trailGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.82}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>

      {/* Particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4"
          emissiveIntensity={3.5} roughness={0} metalness={0.3} />
        <pointLight color="#00e5c4" intensity={2.5} distance={4} decay={2} />
      </mesh>

      {/* Lorentz force arrow (cyan, toward center of curvature) */}
      <ForceArrow arrowRef={arrowRef} />

      {/* B field label */}
      <Html position={[GRID_N/2 * GRID_S + 0.5, -2.8 + 0.6, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
          color: '#a855f7', letterSpacing: '0.14em', opacity: 0.75 }}>B = B₀ŷ</span>
      </Html>

      {/* Live readout */}
      <Html position={[3.6, 3.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
          color: '#00e5c4', opacity: 0.75, letterSpacing: '0.12em',
          background: 'rgba(4,9,12,0.75)', padding: '4px 8px',
          border: '1px solid rgba(0,229,196,0.15)', borderRadius: 2 }}>
          <div ref={readoutRef}>r = –</div>
          <div style={{ color: 'rgba(0,229,196,0.4)', marginTop: 2 }}>F = qv×B</div>
        </div>
      </Html>
    </group>
  )
}
