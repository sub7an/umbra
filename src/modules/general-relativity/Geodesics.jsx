import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const SIZE = 10
const GRID = 36

// ─── Physics helpers ────────────────────────────────────────────────────────

function warpY(x, z, mass) {
  const r = Math.sqrt(x * x + z * z)
  return -mass / (r + 0.6)
}

// Massive-particle geodesic (Schwarzschild orbit equation, u = 1/r):
//     d²u/dφ² = M/L² − u + 3Mu²
// The 3Mu² term is GR's correction; without it the orbit is a closed ellipse.
// Orbits are specified by periapsis/apoapsis. Equal effective potential
// (1 − 2M/r)(1 + L²/r²) at both turning points fixes L exactly; the orbit
// starts at periapsis with du/dφ = 0 and is integrated with RK4 in φ.
const ORBIT_DPHI = 0.01
function orbitL(mass, rp, ra) {
  const M = mass * 0.15
  const num = 2 * M * (1 / rp - 1 / ra)
  const den = (1 - 2 * M / rp) / (rp * rp) - (1 - 2 * M / ra) / (ra * ra)
  return Math.sqrt(Math.max(num / den, 1e-6))
}
function integrateGeodesic(mass, rp, ra, turns = 6) {
  const M = mass * 0.15
  const L = orbitL(mass, rp, ra)
  const k = M / (L * L)
  const f = (u) => k - u + 3 * M * u * u
  let u = 1 / rp, w = 0
  const h = ORBIT_DPHI
  const pts = []
  const n = Math.round((turns * Math.PI * 2) / h)
  for (let i = 0; i < n; i++) {
    const phi = i * h
    if (u <= 0 || 1 / u < M * 2.05) break        // plunged through the horizon
    const r = 1 / u
    if (r > SIZE - 0.8) break
    const x = r * Math.cos(phi), z = r * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
    const k1u = w, k1w = f(u)
    const k2u = w + 0.5 * h * k1w, k2w = f(u + 0.5 * h * k1u)
    const k3u = w + 0.5 * h * k2w, k3w = f(u + 0.5 * h * k2u)
    const k4u = w + h * k3w, k4w = f(u + h * k3u)
    u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u)
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)
  }
  return pts
}

// Null geodesic (light): d²u/dφ² = 3Mu² - u
function integrateLightRay(mass, bScale, phiOffset = 0) {
  const M  = mass * 0.15
  const bCrit = 5.196 * M          // critical impact parameter
  const b  = bCrit * bScale         // bScale > 1 → escapes, < 1 → captured

  const rStart = 14
  const u0     = 1 / rStart
  const disc   = 1 / (b * b) - u0 * u0 * (1 - 2 * M * u0)
  if (disc < 0) return []
  const dudphi0 = Math.sqrt(disc)

  let u = u0, uPrev = u0 - dudphi0 * 0.004
  const pts = []
  let peaked = false

  for (let i = 0; i < 3500; i++) {
    const phi = i * 0.004
    const d2u = 3 * M * u * u - u
    const uNext = 2 * u - uPrev + d2u * 0.000016
    uPrev = u; u = uNext

    if (u <= 0 || 1 / u < M * 2.1) break
    const r = Math.min(1 / u, SIZE + 4)
    const rawX = r * Math.cos(phi), rawZ = r * Math.sin(phi)
    // rotate around Y by phiOffset
    const x = rawX * Math.cos(phiOffset) - rawZ * Math.sin(phiOffset)
    const z = rawX * Math.sin(phiOffset) + rawZ * Math.cos(phiOffset)
    pts.push([x, warpY(x, z, mass) + 0.06, z])

    if (r < rStart - 1 && !peaked) peaked = true
    if (peaked && r > rStart - 0.5) break
  }
  return pts
}

// Newtonian reference: the closed ellipse with the same periapsis/apoapsis
function newtonianOrbit(rp, ra, mass, nPts = 360) {
  const p = (2 * rp * ra) / (rp + ra), e = (ra - rp) / (ra + rp)
  const pts = []
  for (let i = 0; i <= nPts; i++) {
    const phi = (i / nPts) * Math.PI * 2
    const r = p / (1 + e * Math.cos(phi))
    const x = r * Math.cos(phi), z = r * Math.sin(phi)
    pts.push([x, warpY(x, z, mass) + 0.06, z])
  }
  return pts
}

// ─── Curved spacetime sheet: displaced on the GPU, lit, with a polar grid ────

const SURF_VERT = /* glsl */`
  uniform float uMass;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vXZ;
  varying float vH;
  float warp(vec2 p) { return -uMass / (length(p) + 0.6); }
  void main() {
    vec2 p = position.xz;
    float h = warp(p);
    float e = 0.04;
    vec3 n = normalize(vec3(h - warp(p + vec2(e, 0.0)), e, h - warp(p + vec2(0.0, e))));
    vN = normalize(normalMatrix * n);
    vXZ = p; vH = h;
    vec4 mv = modelViewMatrix * vec4(p.x, h, p.y, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const SURF_FRAG = /* glsl */`
  uniform float uMass;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vXZ;
  varying float vH;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    float r = length(vXZ);
    float th = atan(vXZ.y, vXZ.x);
    // Polar grid: rings every 0.5, 24 spokes; lines thin out with distance
    float rr = r / 0.5;
    float ring = 1.0 - min(abs(fract(rr + 0.5) - 0.5) / fwidth(rr), 1.0);
    float ss = th / (6.2831853 / 24.0);
    float spoke = (1.0 - min(abs(fract(ss + 0.5) - 0.5) / fwidth(ss), 1.0)) * smoothstep(0.3, 1.2, r);

    vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    float diff = max(dot(N, normalize(vec3(0.3, 1.0, 0.2))), 0.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);

    // Deeper = warmer: a soft glow down the throat of the well
    float depth = clamp(-vH / (uMass / 0.6), 0.0, 1.0);
    vec3 base = mix(lin(vec3(0.020, 0.026, 0.06)), lin(vec3(0.50, 0.20, 0.05)), pow(depth, 1.6));
    vec3 col = base * (0.55 + 0.6 * diff)
             + lin(vec3(0.40, 0.48, 0.95)) * (ring * 0.07 + spoke * 0.04) * (0.5 + 1.5 * depth)
             + lin(vec3(0.30, 0.35, 0.8)) * fres * 0.05;
    float edge = 1.0 - smoothstep(${(SIZE - 2.5).toFixed(1)}, ${SIZE.toFixed(1)}, r);
    gl_FragColor = vec4(col * edge, edge);
  }
`

function SpacetimeSheet({ mass }) {
  const geo = useMemo(() => {
    // Polar mesh: dense near the centre where the well is steep
    const NR = 120, NT = 160
    const pos = [], idx = []
    for (let i = 0; i <= NR; i++) {
      const r = 0.05 + SIZE * Math.pow(i / NR, 1.6)
      for (let j = 0; j <= NT; j++) {
        const t = (j / NT) * Math.PI * 2
        pos.push(r * Math.cos(t), 0, r * Math.sin(t))
      }
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SURF_VERT, fragmentShader: SURF_FRAG,
    uniforms: { uMass: { value: mass } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useEffect(() => { mat.uniforms.uMass.value = mass }, [mat, mass])
  return <mesh geometry={geo} material={mat} frustumCulled={false} />
}

// ─── Special radii (horizon, photon sphere, ISCO) ────────────────────────────

function RadiusRing({ r, mass, color, opacity = 0.6, width = 1.5, dashed = false }) {
  const pts = useMemo(() => {
    const out = []
    for (let i = 0; i <= 160; i++) {
      const phi = (i / 160) * Math.PI * 2
      const x = r * Math.cos(phi), z = r * Math.sin(phi)
      out.push([x, warpY(x, z, mass) + 0.03, z])
    }
    return out
  }, [r, mass])
  return <Line points={pts} color={color} lineWidth={width} transparent opacity={opacity} dashed={dashed} dashSize={0.12} gapSize={0.08} />
}

// ─── Orbit path (faint full rosette) ─────────────────────────────────────────

function OrbitPath({ pts, color, opacity = 0.25, dashed = false }) {
  if (pts.length < 2) return null
  return <Line points={pts} color={color} lineWidth={1.2} transparent opacity={opacity} dashed={dashed} dashSize={0.2} gapSize={0.12} />
}

// ─── Body on a geodesic: Kepler-like timing (dφ/dt ∝ 1/r²), comet trail ─────

const TRAIL = 140

function Traveller({ pts, color, rate, size = 0.09, light = false }) {
  const head = useRef()
  const fRef = useRef(Math.random() * pts.length)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    const c = new THREE.Color(color)
    const col = new Float32Array(TRAIL * 3)
    for (let i = 0; i < TRAIL; i++) {
      const a = Math.pow(1 - i / TRAIL, 1.8) * 1.6
      col[i * 3] = c.r * a; col[i * 3 + 1] = c.g * a; col[i * 3 + 2] = c.b * a
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [color])
  useEffect(() => () => geo.dispose(), [geo])
  const hist = useRef([])

  useFrame((_, delta) => {
    const n = pts.length
    if (n < 2) return
    const i = Math.floor(fRef.current) % n
    const p = pts[i]
    const r2 = p[0] * p[0] + p[2] * p[2]
    // Points are equally spaced in φ. A massive body has dφ/dt ∝ 1/r² (fixed
    // angular momentum); light moves at constant speed, so dφ/dt ∝ 1/r
    const r = Math.sqrt(Math.max(r2, 0.09))
    fRef.current += Math.min(delta, 0.05) * rate / (light ? r : r * r)
    if (fRef.current >= n) { fRef.current %= n; if (light) hist.current.length = 0 }
    const q = pts[Math.floor(fRef.current) % n]
    head.current?.position.set(q[0], q[1], q[2])
    const h = hist.current
    h.unshift(q)
    if (h.length > TRAIL) h.length = TRAIL
    const arr = geo.attributes.position.array
    for (let k = 0; k < TRAIL; k++) {
      const s = h[Math.min(k, h.length - 1)]
      arr[k * 3] = s[0]; arr[k * 3 + 1] = s[1]; arr[k * 3 + 2] = s[2]
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <line geometry={geo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </line>
      <group ref={head}>
        <mesh>
          <sphereGeometry args={[size, 16, 16]} />
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[size * 2.4, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ─── Central black hole: shadow, photon ring, thin hot disc ──────────────────

function CentralHole({ mass }) {
  const M = mass * 0.15
  const y = warpY(0, 0, mass) * 0.92
  const disc = useRef()
  useFrame((_, d) => { if (disc.current) disc.current.rotation.z += d * 0.8 })
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <sphereGeometry args={[Math.max(2 * M, 0.12), 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh>
        <sphereGeometry args={[Math.max(2 * M, 0.12) * 1.5, 32, 32]} />
        <meshBasicMaterial color="#ff9a4d" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(3 * M, 0.2), Math.max(6 * M, 0.45), 96]} />
        <meshBasicMaterial color={[2.2, 1.1, 0.4]} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const clip = (pts) => pts.filter((p) => p[0] * p[0] + p[2] * p[2] < (SIZE - 0.6) ** 2)

export default function Geodesics({ mass }) {
  const M = mass * 0.15

  const { orbits, lightRays } = useMemo(() => {
    // (periapsis, apoapsis, colour). Index rate = 490·L so dφ/dt = L/r² in one shared time scale
    const spec = [[3.0, 6.5, '#7c8cff'], [2.2, 4.4, '#f59e0b'], [5.0, 8.4, '#c084fc']]
    // Keep periapses outside ~5.6M so the orbits stay bound as M grows
    const orbits = spec.map(([rp0, ra0, color]) => {
      const rp = Math.max(rp0, 5.6 * M), ra = Math.min(Math.max(ra0, rp * 1.6), SIZE - 1.2)
      return { pts: integrateGeodesic(mass, rp, ra, 4), color, rate: 490 * orbitL(mass, rp, ra) }
    })
    const lightRays = [
      { pts: clip(integrateLightRay(mass, 1.3, 0)),              color: '#ffffff' },
      { pts: clip(integrateLightRay(mass, 2.0, Math.PI * 0.55)), color: '#a5f3fc' },
      { pts: clip(integrateLightRay(mass, 3.8, Math.PI * 1.10)), color: '#7dd3fc' },
    ]
    return { orbits, lightRays }
  }, [mass])

  const newtonPts = useMemo(() => newtonianOrbit(Math.max(3.0, 5.6 * M), Math.max(6.5, Math.max(3.0, 5.6 * M) * 1.6), mass), [mass, M])

  return (
    <group>
      <SpacetimeSheet mass={mass} />

      <RadiusRing r={2 * M} mass={mass} color="#f87171" opacity={0.9} width={2} />
      <RadiusRing r={3 * M} mass={mass} color="#fbbf24" opacity={0.7} width={1.5} />
      <RadiusRing r={6 * M} mass={mass} color="#818cf8" opacity={0.6} width={1.2} dashed />

      {/* Newtonian reference: a closed orbit that never precesses */}
      <OrbitPath pts={newtonPts} color="#94a3b8" opacity={0.35} dashed />

      {orbits.map((o, i) => (
        <group key={i}>
          <OrbitPath pts={o.pts} color={o.color} opacity={0.22} />
          <Traveller pts={o.pts} color={o.color} rate={o.rate} />
        </group>
      ))}

      {lightRays.map((lr, i) => (
        lr.pts.length > 2 && (
          <group key={`lr${i}`}>
            <OrbitPath pts={lr.pts} color={lr.color} opacity={0.45} />
            <Traveller pts={lr.pts} color={lr.color} rate={700} size={0.06} light />
          </group>
        )
      ))}

      <CentralHole mass={mass} />
    </group>
  )
}
