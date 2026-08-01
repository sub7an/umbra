import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import useModuleStore from '../../store/useModuleStore'
import { keplerianVelocity, observedRotationVelocity } from './frontierMath'

const GALAXY_CENTER = [-0.8, 0, 0]  // world position of galaxy center
const R_MAX = 6.5                    // max slider radius (scene units)
const GRAPH_POS = [4.0, 0.8, 0]     // world position of graph Html panel

// ── Spiral galaxy particle cloud ─────────────────────────────────────────────

function buildGalaxyPositions(nStars = 2800) {
  const pos = new Float32Array(nStars * 3)
  const N_ARMS = 3

  // Central bulge: ~22% of stars
  const bulge = Math.floor(nStars * 0.22)
  for (let i = 0; i < bulge; i++) {
    const r = Math.pow(Math.random(), 2.2) * 0.7
    const theta = Math.random() * 2 * Math.PI
    const phi = (Math.random() - 0.5) * 0.25
    pos[i * 3]     = r * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi)
    pos[i * 3 + 2] = r * Math.sin(theta)
  }

  // Spiral arms
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
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.028
    }
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
        <pointsMaterial
          color="#7af0df"
          size={0.038}
          transparent
          opacity={0.72}
          sizeAttenuation
        />
      </points>
      {/* Central core glow */}
      <pointLight color="#00e5c4" intensity={0.6} distance={1.8} />
      <mesh>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#00e5c4" emissive="#00e5c4" emissiveIntensity={1.0} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// ── Orbital probe (ring + glowing marker) ────────────────────────────────────

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

  const probeX = GALAXY_CENTER[0] + radius
  const probePos = [probeX, 0, GALAXY_CENTER[2]]

  return (
    <group>
      {/* Orbital ring */}
      <Line
        points={ringPts}
        color="#f59e0b"
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      {/* Probe marker */}
      <mesh position={probePos}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={probePos} color="#f59e0b" intensity={0.8} distance={1.5} />
      {/* Probe label */}
      <Html position={[probePos[0], probePos[1] + 0.32, probePos[2]]} center style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', whiteSpace: 'nowrap', textShadow: '0 0 6px rgba(245,158,11,0.7)' }}>
          r = {radius.toFixed(2)}
        </span>
      </Html>
    </group>
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
  const disc = vObs - vKep

  const rx = toX(radius)
  const ky = toY(vKep)
  const oy = toY(vObs)

  return (
    <div style={{
      width: G_W,
      background: 'rgba(5,9,12,0.95)',
      border: '1px solid rgba(245,158,11,0.28)',
      borderRadius: 6,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ padding: '6px 10px 3px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#f59e0b', letterSpacing: '0.12em', opacity: 0.9 }}>
        ROTATION CURVES
      </div>

      <svg width={G_W} height={G_H}>
        {/* Plot background */}
        <rect x={PAD.l} y={PAD.t} width={pw} height={ph} fill="rgba(10,18,24,0.6)" />

        {/* Horizontal grid */}
        {[0.25, 0.5, 0.75, 1.0].map(v => (
          <line key={v}
            x1={PAD.l} y1={toY(v)}
            x2={PAD.l + pw} y2={toY(v)}
            stroke="rgba(20,32,40,0.9)" strokeWidth={1}
          />
        ))}

        {/* Vertical grid every 2 units */}
        {[2, 4, 6].map(r => (
          <line key={r}
            x1={toX(r)} y1={PAD.t}
            x2={toX(r)} y2={PAD.t + ph}
            stroke="rgba(20,32,40,0.9)" strokeWidth={1}
          />
        ))}

        {/* Current r marker */}
        <line
          x1={rx} y1={PAD.t}
          x2={rx} y2={PAD.t + ph}
          stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3,3"
        />

        {/* Keplerian curve (amber — predicted from visible matter) */}
        <path d={kepPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.82} />

        {/* Observed curve (cyan — what we actually measure) */}
        <path d={obsPath} fill="none" stroke="#00e5c4" strokeWidth={2} />

        {/* Discrepancy bar */}
        {disc > 0.005 && (
          <line x1={rx} y1={ky} x2={rx} y2={oy} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        )}

        {/* Marker dots */}
        <circle cx={rx} cy={ky} r={4.5} fill="#f59e0b" opacity={0.9} />
        <circle cx={rx} cy={oy} r={4.5} fill="#00e5c4" />

        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + ph} stroke="#1a2e3c" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t + ph} x2={PAD.l + pw} y2={PAD.t + ph} stroke="#1a2e3c" strokeWidth={1} />

        {/* X-axis ticks */}
        {[2, 4, 6].map(r => (
          <text key={r} x={toX(r)} y={PAD.t + ph + 11} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace">{r}</text>
        ))}

        {/* Axis labels */}
        <text x={PAD.l + pw / 2} y={G_H - 4} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace">r (orbital radius)</text>
        <text x={10} y={PAD.t + ph / 2} textAnchor="middle" fill="#2a4a5a" fontSize={8} fontFamily="JetBrains Mono, monospace" transform={`rotate(-90,10,${PAD.t + ph / 2})`}>v</text>

        {/* Legend */}
        <line x1={PAD.l + 4} y1={PAD.t + 8} x2={PAD.l + 18} y2={PAD.t + 8} stroke="#00e5c4" strokeWidth={2} />
        <text x={PAD.l + 22} y={PAD.t + 11} fill="#00e5c4" fontSize={8} fontFamily="JetBrains Mono, monospace">measured</text>
        <line x1={PAD.l + 4} y1={PAD.t + 19} x2={PAD.l + 18} y2={PAD.t + 19} stroke="#f59e0b" strokeWidth={1.5} opacity={0.85} />
        <text x={PAD.l + 22} y={PAD.t + 22} fill="#f59e0b" fontSize={8} fontFamily="JetBrains Mono, monospace" opacity={0.85}>keplerian</text>
      </svg>

      {/* Readout row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '3px 10px 7px',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
      }}>
        <span style={{ color: '#00e5c4' }}>v_obs {vObs.toFixed(3)}</span>
        <span style={{ color: '#f59e0b', opacity: 0.85 }}>v_kep {vKep.toFixed(3)}</span>
        <span style={{ color: 'rgba(255,255,255,0.38)' }}>Δv +{Math.max(0, disc).toFixed(3)}</span>
      </div>
    </div>
  )
}

// ── Scene root ────────────────────────────────────────────────────────────────

export default function RotationCurve() {
  const radius = useModuleStore((s) => s.fp.fpRadius)

  return (
    <group>
      {/* Ambient + directional lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.3} color="#d4f0ff" />

      {/* Galaxy */}
      <Galaxy />

      {/* Orbital radius probe */}
      <OrbitalProbe radius={radius} />

      {/* Velocity graph panel — floats to the right of the galaxy */}
      <Html position={GRAPH_POS} center={false} occlude={false} style={{ pointerEvents: 'none' }}>
        <VelocityGraph radius={radius} />
      </Html>

      {/* Scene label */}
      <Html position={[-0.8, 3.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2a4a5a', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          SPIRAL GALAXY · FACE-ON VIEW
        </div>
      </Html>
    </group>
  )
}
