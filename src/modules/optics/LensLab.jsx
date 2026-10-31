// Lens lab: an optical bench with a converging lens.
//
// An object arrow stands a distance u in front of a thin lens of focal length f.
// Every ray is traced with the paraxial thin-lens rule
//     slope_out = slope_in − y/f      (y = height where it crosses the lens)
// so the three principal rays (parallel → through F′, through the centre,
// through F → parallel) and the whole light fan come out of one formula. They
// meet at the image, v = uf/(u − f), m = −v/u. Inside f the rays diverge and
// the image is virtual: dashed back-extensions find it behind the object.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const H       = 0.9    // object height
const APER    = 1.75   // lens half-aperture
const RAIL_Y  = -2.6
const X_MIN   = -9
const X_MAX   = 9.5
const FAN_N   = 48

const RAY_COLORS = ['#fbbf24', '#f472b6', '#38bdf8']   // parallel, centre, focal

// Ray from the object tip through height y0 on the lens → { inSlope, outSlope }
function traceThrough(y0, u, f) {
  const sIn = (y0 - H) / u
  return { y0, sIn, sOut: sIn - y0 / f }
}

// ── Lens: biconvex glass, thicker for shorter f ──────────────────────────────
function LensMesh({ f }) {
  const geo = useMemo(() => {
    const t = 0.16 + 1.1 / f              // centre thickness
    const pts = []
    const N = 40
    for (let i = 0; i <= N; i++) {
      const r = (i / N) * APER
      pts.push(new THREE.Vector2(r, 0.02 + (t / 2) * (1 - (r / APER) ** 2)))
    }
    for (let i = N; i >= 0; i--) {
      const r = (i / N) * APER
      pts.push(new THREE.Vector2(r, -0.02 - (t / 2) * (1 - (r / APER) ** 2)))
    }
    const g = new THREE.LatheGeometry(pts, 96)
    g.rotateZ(-Math.PI / 2)                // lens axis along x
    g.computeVertexNormals()
    return g
  }, [f])
  useEffect(() => () => geo.dispose(), [geo])

  return (
    <group>
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color="#cfe8ff" transparent opacity={0.32} roughness={0.04} metalness={0}
          clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={2.2} ior={1.5}
          depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>
      {/* Rim catches the light */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[APER, 0.022, 12, 128]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} emissive="#93c5fd" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

// ── Arrow (object or image) ───────────────────────────────────────────────────
function Arrow({ x, h, color, ghost = false }) {
  const len = Math.abs(h)
  if (len < 0.02) return null
  const dir = Math.sign(h)
  const head = Math.min(0.28, len * 0.35)
  const mat = ghost
    ? <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
    : <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} metalness={0.2} roughness={0.35} toneMapped={false} />
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, dir * (len - head) / 2, 0]}>
        <cylinderGeometry args={[0.045, 0.045, len - head, 16]} />
        {mat}
      </mesh>
      <mesh position={[0, dir * (len - head / 2), 0]} rotation={[0, 0, dir > 0 ? 0 : Math.PI]}>
        <coneGeometry args={[0.13, head, 24]} />
        {mat}
      </mesh>
      <mesh position={[0, dir * len, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={ghost ? 0.25 : 0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Light fan: every ray from the tip through the aperture, as a soft sheet ───
function LightFan({ u, f }) {
  const geo = useMemo(() => {
    const pos = [], col = [], idx = []
    const c = new THREE.Color('#fde68a')
    for (let i = 0; i < FAN_N; i++) {
      const y0 = -APER + (i / (FAN_N - 1)) * 2 * APER
      const { sOut } = traceThrough(y0, u, f)
      // Three vertices per ray: tip, lens, far end (clipped to the view)
      let x2 = X_MAX, y2 = y0 + sOut * X_MAX
      if (Math.abs(y2) > 3.2) { const xc = (Math.sign(y2) * 3.2 - y0) / sOut; x2 = xc; y2 = Math.sign(y2) * 3.2 }
      pos.push(-u, H, 0, 0, y0, 0, x2, y2, 0)
      const a = 0.05
      col.push(c.r * a, c.g * a, c.b * a, c.r * a * 1.2, c.g * a * 1.2, c.b * a * 1.2, c.r * a * 0.4, c.g * a * 0.4, c.b * a * 0.4)
    }
    for (let i = 0; i < FAN_N - 1; i++) {
      const a = i * 3, b = (i + 1) * 3
      idx.push(a, a + 1, b + 1)          // tip → lens sheet
      idx.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1)  // lens → far sheet
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }, [u, f])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

// ── Photon pulses running along the principal rays ───────────────────────────
function Pulses({ rays }) {
  const refs = useRef([])
  const t = useRef(0)
  useFrame((_, delta) => {
    t.current += Math.min(delta, 0.05) * 0.22
    rays.forEach((r, i) => {
      for (let k = 0; k < 3; k++) {
        const m = refs.current[i * 3 + k]
        if (!m) continue
        const s = (t.current + k / 3 + i * 0.11) % 1
        // Arc-length parametrisation over the two straight pieces
        const L1 = Math.hypot(r.p1[0] - r.p0[0], r.p1[1] - r.p0[1])
        const L2 = Math.hypot(r.p2[0] - r.p1[0], r.p2[1] - r.p1[1])
        const d = s * (L1 + L2)
        if (d < L1) m.position.set(r.p0[0] + (r.p1[0] - r.p0[0]) * d / L1, r.p0[1] + (r.p1[1] - r.p0[1]) * d / L1, 0)
        else { const e = (d - L1) / L2; m.position.set(r.p1[0] + (r.p2[0] - r.p1[0]) * e, r.p1[1] + (r.p2[1] - r.p1[1]) * e, 0) }
      }
    })
  })
  return rays.flatMap((r, i) => [0, 1, 2].map((k) => (
    <mesh key={`${i}-${k}`} ref={(el) => (refs.current[i * 3 + k] = el)}>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshBasicMaterial color={new THREE.Color(r.color).multiplyScalar(2.2)} toneMapped={false} />
    </mesh>
  )))
}

// ── Optical bench ─────────────────────────────────────────────────────────────
function Bench({ f, u, v, showScreen, imgH }) {
  const ticks = useMemo(() => {
    const out = []
    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) out.push(x)
    return out
  }, [])
  return (
    <group>
      <mesh position={[(X_MIN + X_MAX) / 2, RAIL_Y, 0]}>
        <boxGeometry args={[X_MAX - X_MIN, 0.1, 0.55]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.28} />
      </mesh>
      {ticks.map((x) => (
        <mesh key={x} position={[x, RAIL_Y + 0.055, 0.26]}>
          <boxGeometry args={[0.02, 0.01, x % 5 === 0 ? 0.2 : 0.1]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      ))}
      {/* Carriages + posts: object, lens, (screen) */}
      {[[-u, -0.05], [0, -APER], ...(showScreen ? [[v, -Math.max(1.3, Math.abs(imgH) + 0.25)]] : [])].map(([x, top], i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, RAIL_Y + 0.14, 0]}>
            <boxGeometry args={[0.45, 0.18, 0.62]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, (RAIL_Y + top) / 2 + 0.1, 0]}>
            <cylinderGeometry args={[0.035, 0.035, top - RAIL_Y - 0.2, 12]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Focal and 2F marks on the axis */}
      {[f, -f, 2 * f, -2 * f].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <sphereGeometry args={[i < 2 ? 0.07 : 0.045, 16, 16]} />
          <meshBasicMaterial color={i < 2 ? [2.0, 1.6, 0.5] : [0.9, 0.8, 0.5]} toneMapped={false} />
        </mesh>
      ))}
      <Line points={[[X_MIN, 0, 0], [X_MAX, 0, 0]]} color="#94a3b8" lineWidth={1} transparent opacity={0.35} dashed dashSize={0.25} gapSize={0.15} />
    </group>
  )
}

export default function LensLab({ f = 2.5, u = 5 }) {
  const atFocus = Math.abs(u - f) < 0.03
  const v = atFocus ? Infinity : (u * f) / (u - f)
  const m = atFocus ? Infinity : -v / u
  const real = v > 0 && isFinite(v)
  const imgH = H * m
  const showImage = isFinite(v) && v > X_MIN && v < X_MAX && Math.abs(imgH) < 3.2

  // Principal rays: through y0 = H (parallel), 0 (centre), and the focal ray
  const rays = useMemo(() => {
    const yF = Math.abs(f - u) < 1e-3 ? null : (H * f) / (f - u)
    const list = [
      { y0: H, color: RAY_COLORS[0] },
      { y0: 0, color: RAY_COLORS[1] },
      ...(yF !== null && Math.abs(yF) < 2.6 ? [{ y0: yF, color: RAY_COLORS[2] }] : []),
    ]
    return list.map(({ y0, color }) => {
      const { sOut } = traceThrough(y0, u, f)
      let x2 = X_MAX, y2 = y0 + sOut * X_MAX
      if (Math.abs(y2) > 3.4) { x2 = (Math.sign(y2) * 3.4 - y0) / sOut; y2 = Math.sign(y2) * 3.4 }
      return { color, y0, sOut, p0: [-u, H], p1: [0, y0], p2: [x2, y2] }
    })
  }, [u, f])

  return (
    <group position={[-0.25, 0.4, 0]}>
      <Bench f={f} u={u} v={v} showScreen={real && showImage} imgH={imgH} />
      <LightFan u={u} f={f} />
      <LensMesh f={f} />

      {rays.map((r, i) => (
        <group key={i}>
          <Line points={[[...r.p0, 0], [...r.p1, 0], [...r.p2, 0]]} color={r.color} lineWidth={2.2} transparent opacity={0.95} />
          {/* Virtual image: trace the outgoing ray backwards to where it appears to come from */}
          {!real && isFinite(v) && showImage && (
            <Line points={[[...r.p1, 0], [v, r.y0 + r.sOut * v, 0]]} color={r.color} lineWidth={1.4} transparent opacity={0.5} dashed dashSize={0.12} gapSize={0.08} />
          )}
        </group>
      ))}
      <Pulses rays={rays} />

      <Arrow x={-u} h={H} color="#fbbf24" />
      {showImage && <Arrow x={v} h={imgH} color="#22d3ee" ghost={!real} />}

      {/* Frosted screen catching a real image */}
      {real && showImage && (
        <mesh position={[v + 0.06, 0, 0]}>
          <boxGeometry args={[0.03, Math.max(2.6, Math.abs(imgH) * 2 + 0.5), 1.6]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.08} roughness={0.9} depthWrite={false} emissive="#22d3ee" emissiveIntensity={0.05} />
        </mesh>
      )}
    </group>
  )
}
