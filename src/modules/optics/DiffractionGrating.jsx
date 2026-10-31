// Diffraction grating spectroscope, seen from above.
//
// A collimated white beam hits a ruled grating. Each order m fans out as a
// continuous rainbow sheet at the angles d·sinθ = mλ (380–700 nm) and lands on
// a curved screen, where the spectrum is painted as bright bands. The zeroth
// order goes straight through, white. Higher orders are dimmer, spread wider,
// and vanish once sinθ would exceed 1. Changing the line density changes d and
// re-fans every order.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WL_MIN = 380, WL_MAX = 700
const N_WL   = 96
const R      = 5.0          // screen radius (centred on the grating)
const SRC_X  = -4.2
const BEAM_W = 0.28
const MAX_M  = 4

function wlToRGB(wl) {
  let r, g, b
  if      (wl < 440) { r = -(wl - 440) / 60; g = 0; b = 1 }
  else if (wl < 490) { r = 0; g = (wl - 440) / 50; b = 1 }
  else if (wl < 510) { r = 0; g = 1; b = -(wl - 510) / 20 }
  else if (wl < 580) { r = (wl - 510) / 70; g = 1; b = 0 }
  else if (wl < 645) { r = 1; g = -(wl - 645) / 65; b = 0 }
  else               { r = 1; g = 0; b = 0 }
  const f = wl < 420 ? 0.3 + 0.7 * (wl - 380) / 40 : wl > 680 ? 0.3 + 0.7 * (WL_MAX - wl) / 20 : 1
  return [r * f, g * f, b * f]
}

// Relative order brightness: single-slit envelope with slit width ≈ d/3
function orderWeight(m) {
  if (m === 0) return 1
  const x = Math.PI * m / 3
  return (Math.sin(x) / x) ** 2
}

// Angles θ(λ) for order m, or null where the order doesn't exist
function orderAngles(m, dNm) {
  const out = []
  for (let i = 0; i < N_WL; i++) {
    const wl = WL_MIN + (i / (N_WL - 1)) * (WL_MAX - WL_MIN)
    const s = (m * wl) / dNm
    out.push(Math.abs(s) <= 1 ? { wl, th: Math.asin(s) } : null)
  }
  return out
}

// ── Rainbow fans (grating → screen) and the painted spectrum on the screen ───
function Spectra({ dNm }) {
  const { fan, bands } = useMemo(() => {
    const fp = [], fc = [], fi = []
    const bp = [], bc = [], bi = []
    for (let m = -MAX_M; m <= MAX_M; m++) {
      if (m === 0) continue
      const ang = orderAngles(m, dNm)
      const w = orderWeight(m)
      let prev = null
      ang.forEach((a) => {
        if (!a) { prev = null; return }
        const [r, g, b] = wlToRGB(a.wl)
        const cx = Math.cos(a.th), cy = Math.sin(a.th)
        // Fan: a thin triangle from the grating spot to this point on the screen
        const base = fp.length / 3
        fp.push(0, 0, 0, cx * R, cy * R, 0)
        const k0 = 0.16 * w, k1 = 0.05 * w
        fc.push(r * k0, g * k0, b * k0, r * k1, g * k1, b * k1)
        if (prev !== null) fi.push(prev, prev + 1, base + 1, prev, base + 1, base)
        // Screen band: a short radial quad at the screen
        const bb = bp.length / 3
        bp.push(cx * (R - 0.12), cy * (R - 0.12), 0.01, cx * (R + 0.02), cy * (R + 0.02), 0.01)
        const kb = 1.6 * Math.max(w, 0.15)
        bc.push(r * kb, g * kb, b * kb, r * kb * 0.6, g * kb * 0.6, b * kb * 0.6)
        if (prev !== null) bi.push(bb - 2, bb - 1, bb + 1, bb - 2, bb + 1, bb)
        prev = base
      })
    }
    const mk = (p, c, i) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
      g.setIndex(i)
      return g
    }
    return { fan: mk(fp, fc, fi), bands: mk(bp, bc, bi) }
  }, [dNm])
  useEffect(() => () => { fan.dispose(); bands.dispose() }, [fan, bands])

  return (
    <group>
      <mesh geometry={fan}>
        <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={bands}>
        <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── White beam in, zeroth order out ───────────────────────────────────────────
function WhiteBeam() {
  const geo = useMemo(() => {
    // Incoming beam (source → grating) and the straight-through zeroth order
    const p = [], c = []
    const strip = (x0, x1, a0, a1) => {
      p.push(x0, -BEAM_W / 2, 0, x0, BEAM_W / 2, 0, x1, BEAM_W / 2, 0, x0, -BEAM_W / 2, 0, x1, BEAM_W / 2, 0, x1, -BEAM_W / 2, 0)
      c.push(a0, a0, a0, a0, a0, a0, a1, a1, a1, a0, a0, a0, a1, a1, a1, a1, a1, a1)
    }
    strip(SRC_X + 0.4, 0, 0.35, 0.55)
    strip(0, R, 0.4, 0.18)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Bright core line */}
      <mesh position={[(SRC_X + 0.4 + R) / 2, 0, 0.01]}>
        <planeGeometry args={[R - SRC_X - 0.4, 0.03]} />
        <meshBasicMaterial color={[1.6, 1.55, 1.4]} toneMapped={false} />
      </mesh>
      {/* Zeroth-order spot on the screen */}
      <mesh position={[R - 0.05, 0, 0.02]}>
        <planeGeometry args={[0.14, BEAM_W * 1.2]} />
        <meshBasicMaterial color={[2.4, 2.4, 2.3]} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Photons: sparks running outward along random wavelengths and orders ──────
const N_SPARK = 220
function Sparks({ dNm }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SPARK * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_SPARK * 3), 3))
    return g
  }, [])
  const state = useMemo(() => Array.from({ length: N_SPARK }, () => ({ s: Math.random(), th: 0, col: [1, 1, 1] })), [])
  useEffect(() => () => geo.dispose(), [geo])

  const respawn = (p) => {
    // Pick an order weighted by brightness, then a wavelength that exists in it
    for (let tries = 0; tries < 20; tries++) {
      const m = Math.round((Math.random() * 2 - 1) * MAX_M)
      if (Math.random() > orderWeight(m) + 0.05) continue
      const wl = WL_MIN + Math.random() * (WL_MAX - WL_MIN)
      const sn = (m * wl) / dNm
      if (Math.abs(sn) > 1) continue
      p.th = Math.asin(sn)
      p.col = m === 0 ? [1.6, 1.6, 1.5] : wlToRGB(wl).map((v) => v * 2.2)
      return
    }
    p.th = 0; p.col = [1.6, 1.6, 1.5]
  }
  useEffect(() => { state.forEach(respawn) }, [dNm]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const pos = geo.attributes.position.array, col = geo.attributes.color.array
    const total = -SRC_X + R
    state.forEach((p, i) => {
      p.s += Math.min(delta, 0.05) * 0.16
      if (p.s > 1) { p.s -= 1; respawn(p) }
      const d = p.s * total
      if (d < -SRC_X) { pos[i * 3] = SRC_X + d; pos[i * 3 + 1] = (Math.random() - 0.5) * BEAM_W * 0.6 }
      else { const r = d + SRC_X; pos[i * 3] = Math.cos(p.th) * r; pos[i * 3 + 1] = Math.sin(p.th) * r }
      pos[i * 3 + 2] = 0.02
      const before = d < -SRC_X
      col[i * 3] = before ? 1.4 : p.col[0]; col[i * 3 + 1] = before ? 1.4 : p.col[1]; col[i * 3 + 2] = before ? 1.3 : p.col[2]
    })
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial size={0.07} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ── Hardware: lamp + slit, grating with ruling, curved screen ────────────────
const RULING_FRAG = /* glsl */`
  uniform float uLines;
  varying vec2 vUv;
  void main() {
    float l = abs(fract(vUv.y * uLines) - 0.5);
    float rule = smoothstep(0.18, 0.32, l);
    // Rulings shimmer with a faint rainbow, as a real grating does
    vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (vUv.y * 2.0 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(vec3(0.05, 0.06, 0.09), vec3(0.25, 0.28, 0.35) + iri * 0.12, rule);
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
  }
`
const RULING_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

function Grating({ linesPerMm }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RULING_VERT, fragmentShader: RULING_FRAG,
    uniforms: { uLines: { value: 60 } },
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  // Visual ruling count scales with line density (not 1:1, which would alias)
  useEffect(() => { mat.uniforms.uLines.value = 20 + linesPerMm / 15 }, [mat, linesPerMm])
  return (
    <group>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[0.16, 3.0, 0.3]} />
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0.085, 0, 0.0]} rotation={[0, 0, 0]} material={mat}>
        <planeGeometry args={[0.05, 2.6]} />
      </mesh>
      <mesh position={[0, 0, 0.14]} material={mat}>
        <planeGeometry args={[0.14, 2.6]} />
      </mesh>
    </group>
  )
}

function Lamp() {
  return (
    <group position={[SRC_X, 0, 0]}>
      <mesh position={[-0.35, 0, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.02, 0, 0.26]}>
        <planeGeometry args={[0.06, BEAM_W]} />
        <meshBasicMaterial color={[2.4, 2.35, 2.1]} toneMapped={false} />
      </mesh>
      {/* Collimating slit jaws */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.45, s * (BEAM_W / 2 + 0.25), 0]}>
          <boxGeometry args={[0.08, 0.5, 0.4]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function Screen() {
  const geo = useMemo(() => {
    // Arc of ±80° at radius R, a thin ribbon facing the grating
    const p = [], idx = []
    const N = 160
    for (let i = 0; i <= N; i++) {
      const a = (-80 + (i / N) * 160) * Math.PI / 180
      p.push(Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), -0.05, Math.cos(a) * (R + 0.22), Math.sin(a) * (R + 0.22), -0.05)
      if (i > 0) { const b = i * 2; idx.push(b - 2, b - 1, b + 1, b - 2, b + 1, b) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setIndex(idx)
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function DiffractionGrating({ linesPerMm = 600 }) {
  const dNm = 1e6 / linesPerMm
  const ref = useRef()
  return (
    <group ref={ref} position={[-1.6, 0, 0]}>
      <Screen />
      <Lamp />
      <WhiteBeam />
      <Spectra dNm={dNm} />
      <Sparks dNm={dNm} />
      <Grating linesPerMm={linesPerMm} />
    </group>
  )
}
