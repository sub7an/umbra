import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

// Phase space → scene scale factors
const SX = 1.3   // x ∈ [-2.7, 2.7] → X ∈ [-3.5, 3.5]
const SY = 0.62  // v ∈ [-4, 4] → Y ∈ [-2.5, 2.5]

function vanderpol(x, v, mu) {
  return [v, mu * (1 - x * x) * v - x]
}

function rkStep(x, v, mu, dt) {
  const [dx1, dv1] = vanderpol(x, v, mu)
  const [dx2, dv2] = vanderpol(x + dx1 * dt * 0.5, v + dv1 * dt * 0.5, mu)
  const [dx3, dv3] = vanderpol(x + dx2 * dt * 0.5, v + dv2 * dt * 0.5, mu)
  const [dx4, dv4] = vanderpol(x + dx3 * dt, v + dv3 * dt, mu)
  return [
    x + (dx1 + 2*dx2 + 2*dx3 + dx4) * dt / 6,
    v + (dv1 + 2*dv2 + 2*dv3 + dv4) * dt / 6,
  ]
}

// ── Axes ──────────────────────────────────────────────────────────────────────
function Axes() {
  const geo = useMemo(() => {
    const pts = [
      -4.0, 0, 0,  4.0, 0, 0,   // horizontal (x position)
       0, -2.7, 0,  0, 2.7, 0,  // vertical (velocity)
    ]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#0e3040" transparent opacity={0.9} />
    </lineSegments>
  )
}

// ── Vector field grid ─────────────────────────────────────────────────────────
function VectorField({ mu }) {
  const geo = useMemo(() => {
    const pts = []
    const nx = 18, ny = 13
    const xr = 3.8, yr = 2.6
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const px = -xr + (i / (nx - 1)) * 2 * xr
        const py = -yr + (j / (ny - 1)) * 2 * yr
        const phx = px / SX, phv = py / SY
        const [dx, dv] = vanderpol(phx, phv, mu)
        const len = Math.sqrt(dx * dx + dv * dv)
        if (len < 0.01) continue
        const scale = Math.min(0.1, 0.055 * Math.log(1 + len * 0.5))
        pts.push(px, py, 0)
        pts.push(px + (dx / len) * scale * SX, py + (dv / len) * scale * SY, 0)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [mu])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#0e2d40" transparent opacity={0.85} />
    </lineSegments>
  )
}

// ── Pre-computed limit cycle ──────────────────────────────────────────────────
function LimitCycle({ mu }) {
  const geo = useMemo(() => {
    if (mu < 0.05) return null
    let x = 2, v = 0
    const dt = 0.012
    // settle onto limit cycle
    for (let i = 0; i < 3000; i++) [x, v] = rkStep(x, v, mu, dt)
    // record one cycle worth of points
    const pts = []
    for (let i = 0; i < 3200; i++) {
      ;[x, v] = rkStep(x, v, mu, dt)
      pts.push(x * SX, v * SY, 0.02)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [mu])
  useEffect(() => () => { if (geo) geo.dispose() }, [geo])

  if (!geo) return null
  return (
    <line geometry={geo}>
      <lineBasicMaterial color="#00e5c4" transparent opacity={0.65} />
    </line>
  )
}

// ── Flowing phase-space particles ─────────────────────────────────────────────
const N_PART = 220
function PhaseParticles({ mu }) {
  const xArr = useRef(new Float32Array(N_PART))
  const vArr = useRef(new Float32Array(N_PART))
  const posArr = useMemo(() => new Float32Array(N_PART * 3), [])
  const colArr = useMemo(() => new Float32Array(N_PART * 3), [])
  const initialized = useRef(false)

  if (!initialized.current) {
    for (let i = 0; i < N_PART; i++) {
      xArr.current[i] = (Math.random() - 0.5) * 6
      vArr.current[i] = (Math.random() - 0.5) * 8
    }
    initialized.current = true
  }

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    return g
  }, [posArr, colArr])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * 0.55
    for (let i = 0; i < N_PART; i++) {
      let x = xArr.current[i], v = vArr.current[i]
      if (!isFinite(x) || !isFinite(v) || Math.abs(x) > 5 || Math.abs(v) > 8) {
        x = (Math.random() - 0.5) * 5
        v = (Math.random() - 0.5) * 6
      }
      ;[x, v] = rkStep(x, v, mu, dt)
      xArr.current[i] = x
      vArr.current[i] = v

      posArr[i*3]   = x * SX
      posArr[i*3+1] = v * SY
      posArr[i*3+2] = 0.01

      const [dx, dv] = vanderpol(x, v, mu)
      const speed = Math.sqrt(dx * dx + dv * dv)
      const t = Math.min(speed / 10, 1)
      // slow = emerald, fast = amber
      colArr[i*3]   = t * 0.961 + (1-t) * 0.063    // R
      colArr[i*3+1] = (1-t) * 0.725 + t * 0.651    // G
      colArr[i*3+2] = (1-t) * 0.502 * 0.4          // B (tiny for both)
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// ── Fixed point marker (origin) ───────────────────────────────────────────────
function FixedPoint({ mu }) {
  // For μ > 0, origin is an unstable focus (repeller); limit cycle surrounds it
  const col = mu > 0 ? '#e040fb' : '#00e5c4'
  return (
    <mesh position={[0, 0, 0.03]}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.8} />
    </mesh>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PhaseSpace() {
  const mu = useModuleStore((s) => s.ds.phaseMu)
  return (
    <group>
      <Axes />
      <VectorField mu={mu} />
      <LimitCycle mu={mu} />
      <PhaseParticles mu={mu} />
      <FixedPoint mu={mu} />
    </group>
  )
}
