// 1D quantum tunneling: Gaussian wave packet hitting a rectangular barrier.
// Semi-analytical: exact T coefficient; packet split uses Gaussian pair at
// barrier contact rather than a full PDE solve.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

const NX        = 200
const X_MIN     = -7
const X_MAX     = 7
const START_X   = -5.4
const BARRIER_W = 0.8
const SIGMA     = 0.65
const H_SCALE   = 2.2

const XS = new Float32Array(NX)
for (let i = 0; i < NX; i++) XS[i] = X_MIN + (X_MAX - X_MIN) * i / (NX - 1)

// Static baseline geometry (constant; avoids per-render re-allocation)
const BASELINE_GEO = (() => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-7,0,0, 7,0,0]), 3))
  return g
})()

// ── Physics ────────────────────────────────────────────────────────────────────
function transmissionCoeff(V0, k0) {
  const a = BARRIER_W
  const E = 0.5 * k0 * k0
  if (V0 <= 0) return 1
  if (Math.abs(E - V0) < 1e-6) return 1 / (1 + 0.25 * V0 * a * a)
  if (E < V0) {
    const kappa = Math.sqrt(2 * (V0 - E))
    const s = Math.sinh(kappa * a)
    return 1 / (1 + V0 * V0 * s * s / (4 * E * (V0 - E)))
  }
  const k2 = Math.sqrt(2 * (E - V0))
  const s  = Math.sin(k2 * a)
  return 1 / (1 + V0 * V0 * s * s / (4 * E * (E - V0)))
}

function smstep(lo, hi, x) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

function gauss(x, x0) {
  return Math.exp(-0.5 * ((x - x0) / SIGMA) ** 2) / (SIGMA * 2.5066)
}

function psiSq(x, t, k0, V0) {
  const t_impact = (Math.abs(START_X) + BARRIER_W / 2) / k0
  const x_inc = START_X + k0 * t
  const x_ref = -(k0 * Math.max(0, t - t_impact))
  const x_tr  =  (k0 * Math.max(0, t - t_impact)) + BARRIER_W / 2

  const T   = transmissionCoeff(V0, k0)
  const R   = 1 - T
  const alpha = smstep(t_impact - 0.3, t_impact + 1.2, t)

  return (1 - alpha) * gauss(x, x_inc) +
         alpha * (R * gauss(x, x_ref) + T * gauss(x, x_tr))
}

// ── Ribbon geometry ───────────────────────────────────────────────────────────
function buildRibbonGeo() {
  const pos = new Float32Array(NX * 2 * 3)
  const col = new Float32Array(NX * 2 * 3)
  const idx = new Uint16Array((NX - 1) * 6)
  for (let i = 0; i < NX - 1; i++) {
    const q = i * 6
    idx[q]   = i*2;   idx[q+1] = i*2+2; idx[q+2] = i*2+1
    idx[q+3] = i*2+1; idx[q+4] = i*2+2; idx[q+5] = i*2+3
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Tunneling() {
  const V0 = useModuleStore((s) => s.qm.tunnelV0)
  const k0 = useModuleStore((s) => s.qm.tunnelK0)

  const tRef   = useRef(0)
  const tDom   = useRef()
  const rDom   = useRef()
  const evDom  = useRef()

  const ribbonGeo = useMemo(() => buildRibbonGeo(), [])

  useEffect(() => { tRef.current = 0 }, [V0, k0])

  useFrame((_, delta) => {
    const t      = tRef.current
    const PERIOD = (Math.abs(START_X) + X_MAX + BARRIER_W / 2 + 1.5) / k0
    tRef.current = (t + delta) % PERIOD

    const pa = ribbonGeo.attributes.position
    const ca = ribbonGeo.attributes.color

    for (let i = 0; i < NX; i++) {
      const x  = XS[i]
      const p  = psiSq(x, t, k0, V0) * H_SCALE
      const b0 = i * 2, b1 = b0 + 1
      pa.setXYZ(b0, x, 0, 0);     ca.setXYZ(b0, 0.01, 0.04, 0.09)
      pa.setXYZ(b1, x, p, 0)
      const s = Math.min(1, p)
      ca.setXYZ(b1, 0.08*s, 0.68*s + 0.08*s*s, 0.97*s)
    }
    pa.needsUpdate = true; ca.needsUpdate = true

    const T   = transmissionCoeff(V0, k0)
    const E   = 0.5 * k0 * k0
    if (tDom.current)  tDom.current.textContent  = (T * 100).toFixed(2) + '%'
    if (rDom.current)  rDom.current.textContent  = ((1-T) * 100).toFixed(2) + '%'
    if (evDom.current) evDom.current.textContent = (E / V0).toFixed(3)
  })

  const barrierH = V0 * 0.38

  return (
    <group>
      <ambientLight intensity={0.05} color="#030a10" />
      <pointLight position={[0, 5, 4]} intensity={0.7} color="#38bdf8" distance={18} decay={2} />

      {/* Probability density ribbon */}
      <mesh geometry={ribbonGeo}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide}
          transparent opacity={0.95}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Soft glow duplicate */}
      <mesh geometry={ribbonGeo} scale={[1, 1.15, 1]}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide}
          transparent opacity={0.16}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Baseline */}
      <line geometry={BASELINE_GEO}>
        <lineBasicMaterial color="#0d2030" />
      </line>

      {/* Barrier box */}
      <mesh position={[0, barrierH / 2, 0]}>
        <boxGeometry args={[BARRIER_W, barrierH, 0.4]} />
        <meshStandardMaterial color="#f59e0b" emissive="#c4780a"
          emissiveIntensity={0.45} transparent opacity={0.30} roughness={0.35} />
      </mesh>

      {/* Barrier glow point */}
      <pointLight position={[0, barrierH, 0]}
        color="#f59e0b" intensity={0.4} distance={3} decay={2} />

      {/* ── Live readout ── */}
      <Html position={[5.0, 1.6, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(3,8,16,0.90)',
          border: '1px solid rgba(56,189,248,0.20)',
          borderRadius: 3, padding: '7px 10px', minWidth: 132,
        }}>
          <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.45)', letterSpacing: '0.14em', marginBottom: 5 }}>
            TUNNELING
          </div>
          <div style={{ fontSize: 8, color: 'rgba(56,189,248,0.55)', marginBottom: 2 }}>
            T = <span ref={tDom} style={{ color: '#38bdf8' }}>—</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(248,113,113,0.55)', marginBottom: 2 }}>
            R = <span ref={rDom} style={{ color: '#f87171' }}>—</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(251,191,36,0.55)' }}>
            E/V₀ = <span ref={evDom} style={{ color: '#fbbf24' }}>—</span>
          </div>
        </div>
      </Html>
    </group>
  )
}
