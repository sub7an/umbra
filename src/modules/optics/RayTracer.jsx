// 3D spectral prism: Cauchy dispersion, Snell's law, TIR, projection screen.
// Prism angle slider lets user see how rotation changes dispersion + triggers TIR.
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const N_RAYS     = 48
const PRISM_HALF = 1.8
const PRISM_H    = PRISM_HALF * Math.sqrt(3)
const N1_AIR     = 1.0003
const SCREEN_X   = 6.2   // projection screen x-position

// ── Cauchy dispersion: visually amplified (real B≈3500; using 20000 for spread)
function cauchyN(wl) { return 1.44 + 20000 / (wl * wl) }

// ── Wavelength → sRGB color ───────────────────────────────────────────────────
function wlToRGB(wl) {
  let r, g, b
  if      (wl < 440) { r = -(wl-440)/60; g = 0;           b = 1 }
  else if (wl < 490) { r = 0;            g = (wl-440)/50; b = 1 }
  else if (wl < 510) { r = 0;            g = 1;           b = -(wl-510)/20 }
  else if (wl < 580) { r = (wl-510)/70;  g = 1;           b = 0 }
  else if (wl < 645) { r = 1;            g = -(wl-645)/65;b = 0 }
  else               { r = 1;            g = 0;           b = 0 }
  const fac = wl < 420 ? 0.3+0.7*(wl-380)/40 : wl > 700 ? 0.3+0.7*(720-wl)/20 : 1.0
  return new THREE.Color(r * fac, g * fac, b * fac)
}

// ── Vector Snell's law ────────────────────────────────────────────────────────
function snellRefract(dir, normal, n1, n2) {
  const d = dir.clone().normalize()
  const n = normal.clone().normalize()
  const cosI = -d.dot(n)
  const ratio = n1 / n2
  const sinT2 = ratio * ratio * (1 - cosI * cosI)
  if (sinT2 > 1) return null  // total internal reflection
  const cosT = Math.sqrt(1 - sinT2)
  return d.clone().multiplyScalar(ratio).add(n.clone().multiplyScalar(ratio * cosI - cosT))
}

// Specular reflection: r = d - 2(d·n)n
function reflect(dir, normal) {
  const d = dir.clone().normalize()
  const n = normal.clone().normalize()
  return d.clone().sub(n.clone().multiplyScalar(2 * d.dot(n)))
}

// Fresnel reflectance (unpolarized, for intensity falloff at interfaces)
function fresnelR(cosI, n1, n2) {
  const cosT = Math.sqrt(Math.max(0, 1 - (n1/n2)*(n1/n2)*(1-cosI*cosI)))
  const Rs = ((n1*cosI - n2*cosT)/(n1*cosI + n2*cosT)) ** 2
  const Rp = ((n2*cosI - n1*cosT)/(n2*cosI + n1*cosT)) ** 2
  return (Rs + Rp) / 2
}

// ── Base prism vertices (equilateral, XZ plane, apex at -z) ───────────────────
const P_BASE = [
  new THREE.Vector3(-PRISM_HALF, 0,  PRISM_H * 2/3),   // bottom-left
  new THREE.Vector3( PRISM_HALF, 0,  PRISM_H * 2/3),   // bottom-right
  new THREE.Vector3( 0,          0, -PRISM_H / 3),      // apex
]

function rotatePrism(angle) {
  const c = Math.cos(angle), s = Math.sin(angle)
  return P_BASE.map(p => new THREE.Vector3(p.x*c - p.z*s, 0, p.x*s + p.z*c))
}

function faceOutwardNormal(a, b) {
  const d = new THREE.Vector3().subVectors(b, a).normalize()
  // Prism centroid is near origin — normal pointing away from it
  const mid = a.clone().lerp(b, 0.5)
  const n = new THREE.Vector3(-d.z, 0, d.x)
  return n.dot(mid) > 0 ? n : n.negate()
}

// ── Ray-segment intersection in XZ plane ─────────────────────────────────────
function rayHitFace(origin, dir, fA, fB) {
  const ox = origin.x, oz = origin.z
  const dx = dir.x,    dz = dir.z
  const ex = fB.x - fA.x, ez = fB.z - fA.z
  const denom = dx * ez - dz * ex
  if (Math.abs(denom) < 1e-9) return null
  const t = ((fA.x - ox) * ez - (fA.z - oz) * ex) / denom
  const u = ((fA.x - ox) * dz - (fA.z - oz) * dx) / denom
  if (t < 0.001 || u < 0 || u > 1) return null
  return t
}

// ── Trace one spectral ray through the prism ─────────────────────────────────
function traceRay(wl, yOff, rP) {
  const n2    = cauchyN(wl)
  const color = wlToRGB(wl)
  const dir   = new THREE.Vector3(1, 0, 0)
  const segs  = []    // { from, to, color, opacity }
  let   tirOccurred = false

  // ── Entry: try left face (rP[0]-rP[2]) first, then front face (rP[0]-rP[1]) ─
  const faces = [
    { a: rP[0], b: rP[2] },
    { a: rP[0], b: rP[1] },
  ]

  const startX = -6.2
  const startZ = rP[0].z + (rP[2].z - rP[0].z) * 0.5 + yOff * 0.04
  const origin = new THREE.Vector3(startX, yOff * 0.035, startZ)

  let entryHit = null, entryFace = null
  for (const f of faces) {
    const t = rayHitFace(origin, dir, f.a, f.b)
    if (t !== null) { entryHit = t; entryFace = f; break }
  }
  if (entryHit === null) return { segs, tirOccurred, screenHit: null }

  const hit1 = origin.clone().addScaledVector(dir, entryHit)
  segs.push({ from: new THREE.Vector3(startX, origin.y, origin.z), to: hit1.clone(), color, opacity: 0.75 })

  // Snell at entry
  const entryNorm = faceOutwardNormal(entryFace.a, entryFace.b).negate()  // inward
  const refracted1 = snellRefract(dir, entryNorm, N1_AIR, n2)
  if (!refracted1) return { segs, tirOccurred, screenHit: null }

  // Fresnel transmission at entry (attenuate)
  const cosI1 = Math.abs(dir.dot(entryNorm.clone().normalize()))
  const T1    = 1 - fresnelR(cosI1, N1_AIR, n2)

  // ── Exit: try right face (rP[2]-rP[1]), then base (rP[0]-rP[1]) ───────────
  const exitFaces = [
    { a: rP[2], b: rP[1] },
    { a: rP[0], b: rP[1] },
  ]

  let exitHit = null, exitFace = null
  for (const f of exitFaces) {
    const t = rayHitFace(hit1, refracted1, f.a, f.b)
    if (t !== null) { exitHit = t; exitFace = f; break }
  }
  if (exitHit === null) return { segs, tirOccurred, screenHit: null }

  const hit2 = hit1.clone().addScaledVector(refracted1, exitHit)
  segs.push({ from: hit1.clone(), to: hit2.clone(), color, opacity: T1 * 0.68 })

  // Snell at exit
  const exitNorm   = faceOutwardNormal(exitFace.a, exitFace.b)
  const refracted2 = snellRefract(refracted1, exitNorm.clone().negate(), n2, N1_AIR)

  if (!refracted2) {
    // ── Total Internal Reflection ──────────────────────────────────────────
    tirOccurred = true
    const reflected = reflect(refracted1, exitNorm)
    const endTIR = hit2.clone().addScaledVector(reflected, 2.5)
    segs.push({ from: hit2.clone(), to: endTIR, color: new THREE.Color(0.9, 0.9, 0.9), opacity: 0.3, isTIR: true })
    return { segs, tirOccurred, screenHit: null }
  }

  // ── Extension to projection screen ────────────────────────────────────────
  const Fresnel2 = 1 - fresnelR(Math.abs(refracted1.dot(exitNorm.clone().normalize())), n2, N1_AIR)
  const exitOpacity = T1 * Fresnel2 * 0.72

  if (refracted2.x > 0.001) {
    const t3 = (SCREEN_X - hit2.x) / refracted2.x
    if (t3 > 0 && t3 < 20) {
      const end = hit2.clone().addScaledVector(refracted2, t3)
      segs.push({ from: hit2.clone(), to: end.clone(), color, opacity: exitOpacity })
      const screenHit = { z: end.z, y: end.y, color }
      return { segs, tirOccurred, screenHit }
    }
  }

  return { segs, tirOccurred, screenHit: null }
}

// ── Build all rays ─────────────────────────────────────────────────────────────
function buildRayData(angle) {
  const rP    = rotatePrism(angle)
  const allSegs = []
  const paths   = []
  const screenHits = []
  let anyTIR = false

  for (let i = 0; i < N_RAYS; i++) {
    const wl   = 380 + (i / (N_RAYS - 1)) * 340
    const yOff = (i - N_RAYS / 2) * 0.35
    const { segs, tirOccurred, screenHit } = traceRay(wl, yOff, rP)
    allSegs.push(...segs)
    if (tirOccurred) anyTIR = true
    if (screenHit) screenHits.push(screenHit)
    if (segs.length >= 2) {
      paths.push({
        points: [segs[0].from, ...segs.map(s => s.to)],
        color: segs[0].color,
        delay: i / N_RAYS,
      })
    }
  }
  return { allSegs, paths, screenHits, rP, anyTIR }
}

// ── Animated photon pulse ─────────────────────────────────────────────────────
function Photon({ points, color, delay }) {
  const ref  = useRef()
  const tRef = useRef(delay)
  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta * 0.22) % 1
    const t = tRef.current, fi = t * (points.length - 1)
    const si = Math.floor(fi)
    if (ref.current && si < points.length - 1) {
      ref.current.position.lerpVectors(points[si], points[si + 1], fi - si)
    }
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.038, 6, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RayTracer() {
  const [prismAngle, setPrismAngle] = useState(0)

  const { allSegs, paths, screenHits, rP, anyTIR } = useMemo(
    () => buildRayData(prismAngle),
    [prismAngle]
  )

  const lineGeos = useMemo(() =>
    allSegs.map((seg) => ({
      geo:     new THREE.BufferGeometry().setFromPoints([seg.from, seg.to]),
      color:   seg.color,
      opacity: seg.opacity ?? 0.75,
    })), [allSegs])

  const prismGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(rP[0].x, rP[0].z)
    shape.lineTo(rP[1].x, rP[1].z)
    shape.lineTo(rP[2].x, rP[2].z)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false })
    geo.rotateX(Math.PI / 2)
    geo.translate(0, -0.45, 0)
    return geo
  }, [rP])

  return (
    <group>
      <ambientLight intensity={0.07} color="#0a0a1a" />
      <directionalLight position={[0, 8, 4]} intensity={0.28} color="#fff8e0" />
      <pointLight position={[-5, 2, 0]} intensity={0.4} color="#fff8d0" distance={14} decay={2} />
      <pointLight position={[SCREEN_X, 1, 0]} intensity={0.3} color="#ffffff" distance={6} decay={2} />

      {/* Glass prism */}
      <mesh geometry={prismGeo}>
        <meshPhysicalMaterial
          color="#b8d8f0" transparent opacity={0.24}
          roughness={0.01} metalness={0} transmission={0.88} ior={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={prismGeo}>
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.10} />
      </mesh>

      {/* Spectral ray segments */}
      {lineGeos.map((l, i) => (
        <line key={i} geometry={l.geo}>
          <lineBasicMaterial color={l.color} transparent opacity={l.opacity} linewidth={1} />
        </line>
      ))}

      {/* Photon pulses */}
      {paths.map((p, i) => (
        <Photon key={i} points={p.points} color={p.color} delay={p.delay} />
      ))}

      {/* ── Projection screen ── */}
      <mesh position={[SCREEN_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[9, 1.6]} />
        <meshStandardMaterial color="#060812" roughness={0.95} />
      </mesh>

      {/* Spectrum bar on screen */}
      {screenHits.map((h, i) => (
        <mesh key={i} position={[SCREEN_X - 0.04, h.y, h.z]}>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshBasicMaterial color={h.color} />
          <pointLight color={h.color} intensity={0.06} distance={0.8} decay={2} />
        </mesh>
      ))}

      {/* TIR badge */}
      {anyTIR && (
        <Html position={[0, 2.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'JetBrains Mono,monospace', fontSize: 9,
            color: '#f97316', letterSpacing: '0.16em',
            background: 'rgba(4,6,14,0.80)',
            border: '1px solid rgba(249,115,22,0.35)',
            borderRadius: 2, padding: '3px 9px',
          }}>
            TOTAL INTERNAL REFLECTION
          </div>
        </Html>
      )}

      {/* ── Prism angle slider (inline) ── */}
      <Html position={[0, -3.0, 0]} center style={{ pointerEvents: 'all' }}>
        <div style={{
          fontFamily: 'JetBrains Mono,monospace',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(4,6,14,0.85)',
          border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: 3, padding: '5px 12px',
        }}>
          <span style={{ fontSize: 9, color: 'rgba(56,189,248,0.55)', letterSpacing: '0.14em' }}>
            PRISM ANGLE
          </span>
          <input
            type="range" min={-40} max={40} step={1}
            value={Math.round(prismAngle * 180 / Math.PI)}
            onChange={e => setPrismAngle(parseFloat(e.target.value) * Math.PI / 180)}
            style={{ width: 110, accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: '#38bdf8', minWidth: 36, textAlign: 'right' }}>
            {Math.round(prismAngle * 180 / Math.PI)}°
          </span>
        </div>
      </Html>

      {/* Screen label */}
      <Html position={[SCREEN_X, -1.05, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono,monospace', fontSize: 8,
          color: 'rgba(56,189,248,0.35)', letterSpacing: '0.14em',
        }}>
          SCREEN
        </div>
      </Html>
    </group>
  )
}
