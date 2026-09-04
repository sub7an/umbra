import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { keplerianVelocity, observedRotationVelocity } from './frontierMath'

const GALAXY_CENTER = [-0.8, 0, 0]
const R_MAX = 6.5
const GRAPH_POS = [4.0, 0.8, 0]

// ── Spiral galaxy particle cloud ─────────────────────────────────────────────

function buildGalaxyPositions(nStars = 2800) {
  const pos = new Float32Array(nStars * 3)
  const N_ARMS = 3

  const bulge = Math.floor(nStars * 0.22)
  for (let i = 0; i < bulge; i++) {
    const r = Math.pow(Math.random(), 2.2) * 0.7
    const theta = Math.random() * 2 * Math.PI
    const phi = (Math.random() - 0.5) * 0.25
    pos[i * 3]     = r * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi)
    pos[i * 3 + 2] = r * Math.sin(theta)
  }

  for (let i = bulge; i < nStars; i++) {
    const arm = i % N_ARMS
    const r = 0.35 + Math.pow(Math.random(), 0.55) * 3.6
    const spiral = (arm / N_ARMS) * 2 * Math.PI + r * 1.35
    const scatter = (Math.random() - 0.5) * Math.min(r * 0.18, 0.4)
    pos[i * 3]     = r * Math.cos(spiral) + scatter
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.14
    pos[i * 3 + 2] = r * Math.sin(spiral) + scatter
  }
  return pos
}

function Galaxy() {
  const positions = useMemo(() => buildGalaxyPositions(), [])
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.028
  })

  return (
    <group ref={groupRef} position={GALAXY_CENTER}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#7af0df" size={0.038} transparent opacity={0.72} sizeAttenuation />
      </points>
      <pointLight color="#f59e0b" intensity={0.6} distance={1.8} />
      <mesh>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.0} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// ── Dark matter halo (translucent nested shells) ──────────────────────────────

function DarkMatterHalo() {
  const radii  = [2.6, 4.0, 5.5]
  const opacities = [0.055, 0.038, 0.025]

  return (
    <group position={GALAXY_CENTER}>
      {radii.map((r, i) => (
        <mesh key={i}>
          <sphereGeometry args={[r, 20, 16]} />
          <meshBasicMaterial
            color="#7030c8"
            transparent
            opacity={opacities[i]}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <Html position={[0, 5.7, 0]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(130,60,220,0.75)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          DARK MATTER HALO
        </span>
      </Html>
    </group>
  )
}

// ── Orbital probe — animated marker + tangential velocity arrow ───────────────

function buildRingPoints(cx, cz, r, n = 80) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push([cx + r * Math.cos(t), 0, cz + r * Math.sin(t)])
  }
  return pts
}

function OrbitalProbe({ radius }) {
  const ringPts = useMemo(
    () => buildRingPoints(GALAXY_CENTER[0], GALAXY_CENTER[2], radius),
    [radius],
  )

  const angleRef  = useRef(0)
  const markerRef = useRef()

  const arrowPosArr = useMemo(() => new Float32Array(6), [])
  const arrowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arrowPosArr, 3))
    return g
  }, [arrowPosArr])
  useEffect(() => () => arrowGeo.dispose(), [arrowGeo])

  useFrame((_, delta) => {
    const vObs = observedRotationVelocity(radius)
    angleRef.current += delta * vObs * 0.45

    const a  = angleRef.current
    const cx = GALAXY_CENTER[0]
    const cz = GALAXY_CENTER[2]
    const x  = cx + radius * Math.cos(a)
    const z  = cz + radius * Math.sin(a)

    if (markerRef.current) markerRef.current.position.set(x, 0, z)

    // Tangential direction: (-sin a, 0, cos a)
    const arrowLen = vObs * 1.5
    arrowPosArr[0] = x
    arrowPosArr[1] = 0
    arrowPosArr[2] = z
    arrowPosArr[3] = x + (-Math.sin(a)) * arrowLen
    arrowPosArr[4] = 0
    arrowPosArr[5] = z + Math.cos(a) * arrowLen
    arrowGeo.attributes.position.needsUpdate = true
  })

  return (
    <>
      {/* Orbital ring */}
      <Line points={ringPts} color="#f59e0b" lineWidth={1} transparent opacity={0.35} />

      {/* Animated marker */}
      <group ref={markerRef} position={[GALAXY_CENTER[0] + radius, 0, GALAXY_CENTER[2]]}>
        <mesh>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.4} />
        </mesh>
        <pointLight color="#f59e0b" intensity={1.0} distance={1.8} />
        <Html position={[0, 0.35, 0]} center style={{ pointerEvents: 'none' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', whiteSpace: 'nowrap', textShadow: '0 0 6px rgba(245,158,11,0.7)' }}>
            r = {radius.toFixed(2)}
          </span>
        </Html>
      </group>

      {/* Tangential velocity arrow */}
      <lineSegments geometry={arrowGeo}>
        <lineBasicMaterial color="#f59e0b" transparent opacity={0.85} depthWrite={false} />
      </lineSegments>
    </>
  )
}

// ── Velocity graph (SVG inside Html) ─────────────────────────────────────────

const G_W = 224, G_H = 175
const PAD = { l: 34, r: 14, t: 20, b: 30 }
const pw = G_W - PAD.l - PAD.r
const ph = G_H - PAD.t - PAD.b
const N_SAMPLES = 90

function buildCurvePath(fn, rMax, toX, toY) {
  const parts = []
  for (let i = 1; i <= N_SAMPLES; i++) {
    const r = (i / N_SAMPLES) * rMax
    const v = fn(r)
    const cmd = i === 1 ? 'M' : 'L'
    parts.push(`${cmd} ${toX(r).toFixed(1)},${toY(v).toFixed(1)}`)
  }
  return parts.join(' ')
}

function VelocityGraph({ radius }) {
  const toX = r => PAD.l + (r / R_MAX) * pw
  const toY = v => PAD.t + ph - Math.min(Math.max(v, 0), 1.15) * ph

  const kepPath = useMemo(() => buildCurvePath(keplerianVelocity, R_MAX, toX, toY), [])
  const obsPath = useMemo(() => buildCurvePath(observedRotationVelocity, R_MAX, toX, toY), [])

  const vKep = keplerianVelocity(radius)
  const vObs = observedRotationVelocity(radius)
  const disc  = vObs - vKep

  const rx = toX(radius)
  const ky = toY(vKep)
  const oy = toY(vObs)

  return (
    <div style={{ width: G_W, background: 'rgba(5,9,12,0.95)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 6, overflow: 'hidden', userSelect: 'none' }}>
      <div style={{ padding: '6px 10px 3px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', letterSpacing: '0.12em', opacity: 0.9 }}>
        ROTATION CURVES
      </div>

      <svg width={G_W} height={G_H}>
        <rect x={PAD.l} y={PAD.t} width={pw} height={ph} fill="rgba(16,12,8,0.6)" />

        {[0.25, 0.5, 0.75, 1.0].map(v => (
          <line key={v} x1={PAD.l} y1={toY(v)} x2={PAD.l + pw} y2={toY(v)} stroke="rgba(20,32,40,0.9)" strokeWidth={1} />
        ))}
        {[2, 4, 6].map(r => (
          <line key={r} x1={toX(r)} y1={PAD.t} x2={toX(r)} y2={PAD.t + ph} stroke="rgba(20,32,40,0.9)" strokeWidth={1} />
        ))}

        <line x1={rx} y1={PAD.t} x2={rx} y2={PAD.t + ph} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3,3" />

        {/* Dark matter discrepancy fill */}
        {disc > 0.005 && (
          <line x1={rx} y1={ky} x2={rx} y2={oy} stroke="rgba(112,48,200,0.5)" strokeWidth={2} />
        )}

        <path d={kepPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.82} />
        <path d={obsPath} fill="none" stroke="#f59e0b" strokeWidth={2} />

        <circle cx={rx} cy={ky} r={4.5} fill="#f59e0b" opacity={0.9} />
        <circle cx={rx} cy={oy} r={4.5} fill="#f59e0b" />

        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + ph} stroke="#1a2e3c" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t + ph} x2={PAD.l + pw} y2={PAD.t + ph} stroke="#1a2e3c" strokeWidth={1} />

        {[2, 4, 6].map(r => (
          <text key={r} x={toX(r)} y={PAD.t + ph + 11} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace">{r}</text>
        ))}

        <text x={PAD.l + pw / 2} y={G_H - 4} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace">r (orbital radius)</text>
        <text x={10} y={PAD.t + ph / 2} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace" transform={`rotate(-90,10,${PAD.t + ph / 2})`}>v</text>

        <line x1={PAD.l + 4} y1={PAD.t + 8} x2={PAD.l + 18} y2={PAD.t + 8} stroke="#f59e0b" strokeWidth={2} />
        <text x={PAD.l + 22} y={PAD.t + 11} fill="#f59e0b" fontSize={8} fontFamily="JetBrains Mono, monospace">measured</text>
        <line x1={PAD.l + 4} y1={PAD.t + 19} x2={PAD.l + 18} y2={PAD.t + 19} stroke="#f59e0b" strokeWidth={1.5} opacity={0.85} />
        <text x={PAD.l + 22} y={PAD.t + 22} fill="#f59e0b" fontSize={8} fontFamily="JetBrains Mono, monospace" opacity={0.85}>keplerian</text>
        <line x1={PAD.l + 4} y1={PAD.t + 30} x2={PAD.l + 18} y2={PAD.t + 30} stroke="rgba(112,48,200,0.7)" strokeWidth={2} />
        <text x={PAD.l + 22} y={PAD.t + 33} fill="rgba(130,60,220,0.8)" fontSize={8} fontFamily="JetBrains Mono, monospace">dark matter</text>
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 10px 7px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        <span style={{ color: '#f59e0b' }}>v_obs {vObs.toFixed(3)}</span>
        <span style={{ color: '#f59e0b', opacity: 0.85 }}>v_kep {vKep.toFixed(3)}</span>
        <span style={{ color: 'rgba(130,60,220,0.85)' }}>Δv +{Math.max(0, disc).toFixed(3)}</span>
      </div>
    </div>
  )
}

// ── Scene root ────────────────────────────────────────────────────────────────

export default function RotationCurve() {
  const radius = useModuleStore((s) => s.fp.fpRadius)

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.3} color="#d4f0ff" />

      {/* Dark matter halo (renders behind galaxy) */}
      <DarkMatterHalo />

      {/* Galaxy */}
      <Galaxy />

      {/* Orbital radius probe */}
      <OrbitalProbe radius={radius} />

      {/* Velocity graph */}
      <Html position={GRAPH_POS} center={false} occlude={false} style={{ pointerEvents: 'none' }}>
        <VelocityGraph radius={radius} />
      </Html>

      <Html position={[-0.8, 3.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2a4a5a', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          SPIRAL GALAXY · FACE-ON VIEW
        </div>
      </Html>
    </group>
  )
}
