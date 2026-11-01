import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../store/useModuleStore'
import CardPreview from './CardPreview'
import ConstellationMap from './ConstellationMap'
import FeatureRail from './FeatureRail'
import { useGesture } from '../context/GestureContext'
import { useAuth } from '../context/AuthContext'
import { getTheme, toggleTheme } from '../lib/theme'

const SECRET_PHRASE = 'sabrina'
const STORE_KEY     = 'umbra_unlocked'

// ── Theme toggle (sun/moon) ───────────────────────────────────────────────────
// ── Account chip: Sign in when logged out, email + PRO badge + menu in ────────
function AccountButton() {
  const { configured, user, isPro, signOut } = useAuth()
  const [menu, setMenu] = useState(false)
  if (!configured) return null

  if (!user) {
    return (
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('umbra-auth-open'))} className="ui-btn">
        Sign in
      </button>
    )
  }

  const initial = (user.email || '?')[0].toUpperCase()
  return (
    <div className="relative">
      <button type="button" onClick={() => setMenu(v => !v)} aria-expanded={menu} aria-label="Account menu" className="ui-btn px-1.5 gap-1.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-glow/20 text-cyan-mid text-[13px] font-semibold">{initial}</span>
        {isPro && <span className="px-1.5 rounded text-[11px] font-semibold bg-cyan-glow text-ground">Pro</span>}
        <svg width="10" height="10" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {menu && (
        <div className="absolute top-11 right-0 z-30 min-w-[220px] p-2 rounded-lg bg-panel border border-border-subtle shadow-card">
          <div className="px-2 pt-1 pb-2 text-[13px] text-text-dim break-all">{user.email}</div>
          {!isPro && (
            <button type="button" onClick={() => { setMenu(false); window.dispatchEvent(new CustomEvent('umbra-pricing-open')) }}
              className="w-full text-left px-2 h-9 rounded-md text-[14px] font-medium text-cyan-mid hover:bg-panel-hover">
              Upgrade to Pro
            </button>
          )}
          <button type="button" onClick={() => { setMenu(false); signOut() }}
            className="w-full text-left px-2 h-9 rounded-md text-[14px] text-text-primary hover:bg-panel-hover">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function ThemeButton() {
  const [theme, setTheme] = useState(getTheme())
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  return (
    <button type="button" onClick={() => setTheme(toggleTheme())} title={label} aria-label={label} className="ui-btn-ghost w-9 px-0">
      {theme === 'light'
        ? <svg width="16" height="16" viewBox="0 0 11 11" fill="none" aria-hidden="true"><path d="M9 6.5A4 4 0 1 1 4.5 2 3.2 3.2 0 0 0 9 6.5Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/></svg>
        : <svg width="16" height="16" viewBox="0 0 11 11" fill="none" aria-hidden="true"><circle cx="5.5" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="0.9"/><path d="M5.5 1V2M5.5 9V10M1 5.5H2M9 5.5H10M2.3 2.3L3 3M8 8L8.7 8.7M8.7 2.3L8 3M3 8L2.3 8.7" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/></svg>}
    </button>
  )
}

// ── Live particle counter ─────────────────────────────────────────────────────
function LiveParticleCount() {
  const [n, setN] = useState(2_847_390_000)
  useEffect(() => {
    const id = setInterval(() => setN(c => c + Math.floor(Math.random() * 220_000 + 80_000)), 800)
    return () => clearInterval(id)
  }, [])
  const fmt = n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${Math.floor(n / 1e6)}M`
  return <>{fmt}</>
}

// ── Physics facts ticker ──────────────────────────────────────────────────────
const TICKER_FACTS = [
  'At v = 0.999c, time dilates by γ = 22.4 — a year passes in 16 days for the traveller',
  'Planck length: 1.616 × 10⁻³⁵ m — below this, spacetime itself loses meaning',
  'The Lorenz attractor never repeats yet stays bounded — deterministic infinity',
  'Hawking radiation:  T = ℏc³ / (8πGMk_B) — black holes slowly evaporate',
  'Fine structure constant α ≈ 1/137 — a dimensionless mystery of quantum electrodynamics',
  'Gravitational waves confirmed 14 September 2015 by LIGO at f = 35–250 Hz',
  'Quantum tunneling enables nuclear fusion in stars at temperatures classically forbidden',
  'Navier–Stokes existence and smoothness: still an unsolved Millennium Prize Problem',
  'Wave–particle duality: electrons create interference fringes yet land as discrete points',
  'Entropy always increases: ΔS ≥ 0 — the arrow of time has a thermodynamic origin',
  'A photon at c experiences zero proper time and zero distance — it exists outside time',
  'The Bloch sphere maps every qubit state to a unique point on a unit sphere',
  'Maxwell unified electricity, magnetism, and light in four equations — 1865',
  'Chaos: small differences in initial conditions grow exponentially — butterfly effect',
  'Biot–Savart: every electric current wraps space in a magnetic field',
]

function checkUnlocked() {
  if (sessionStorage.getItem(STORE_KEY) === '1') return true
  if (window.location.hash === '#sabrina') {
    sessionStorage.setItem(STORE_KEY, '1')
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return true
  }
  return false
}

const MODULES = [
  {
    id: 'physics-sandbox',
    name: 'Physics Sandbox',
    abbr: 'Σ',
    tagline: 'Place sources · Watch them interact · Emergent fields',
    description:
      'Drop attractors, repulsors, and vortices onto a live particle field. 5,000 tracers respond to every source simultaneously — combine them to build spiral galaxies, standing waves, or pure chaos.',
    color: 'lime',
    formula: 'F = Σ G·M/r² + Γ/r²',
  },
  {
    id: 'wave-mechanics',
    name: 'Wave Mechanics',
    abbr: '≋',
    tagline: 'Ripple tank · Interference · Diffraction',
    description:
      'Live 3D wave surface solving ∂²u/∂t²=c²∇²u on a 128×128 mesh. Click to drop oscillating sources — interference patterns rise from the surface in real time. Double-slit and membrane normal modes.',
    color: 'azure',
    formula: '∂²u/∂t² = c² ∇²u',
  },
  {
    id: 'optics',
    name: 'Optics',
    abbr: '◈',
    tagline: 'Ray tracing · Prisms · Lens imaging',
    description:
      '3D glass prism dispersing 48 spectral wavelengths via Cauchy dispersion. An optical bench where you move the object and watch real and virtual images form. A grating spectroscope with adjustable line density.',
    color: 'gold',
    formula: 'n₁ sin θ₁ = n₂ sin θ₂',
  },
  {
    id: 'special-relativity',
    name: 'Special Relativity',
    abbr: 'SR',
    tagline: 'Light cones · Time dilation · Length contraction',
    description:
      'Lorentz transform at relativistic velocities. Clocks slow, rods shrink as β → 1. Light cone geometry in Minkowski space.',
    color: 'cyan',
    formula: 'γ = 1/√(1−β²)',
  },
  {
    id: 'quantum-mechanics',
    name: 'Quantum Mechanics',
    abbr: 'QM',
    tagline: 'Wave functions · Uncertainty · Entanglement',
    description:
      'Probability amplitudes, the Schrödinger equation, and quantum superposition visualized in Hilbert space. Bloch sphere and double-slit.',
    color: 'amber',
    formula: 'iℏ ∂ψ/∂t = Ĥψ',
  },
  {
    id: 'frontier-physics',
    name: 'Frontier Physics',
    abbr: 'FP',
    tagline: 'Dark matter · Hubble expansion · Rotation curves',
    description:
      'Galaxy kinematics vs. Keplerian predictions. What the data shows, what is inferred, and what remains unknown.',
    color: 'rose',
    formula: 'v_obs ≫ v_kep',
  },
  {
    id: 'dynamical-systems',
    name: 'Dynamical Systems',
    abbr: 'DS',
    tagline: 'Strange attractors · Chaos · Phase space',
    description:
      '1,800 RK4-integrated particles tracing Lorenz, Rössler, Thomas, and Aizawa attractors. Adjust σ, ρ, β live.',
    color: 'emerald',
    formula: 'dX/dt = F(X)',
  },
  {
    id: 'electromagnetism',
    name: 'Electromagnetism',
    abbr: 'EM',
    tagline: '3D field lines · Biot-Savart · Halbach arrays',
    description:
      'Real Biot-Savart field computation in 3D. RK4-traced field lines for dipole, bar magnet, solenoid, and Halbach array.',
    color: 'violet',
    formula: 'B = μ₀/4π ∮ Idℓ×r̂/r²',
  },
  {
    id: 'general-relativity',
    name: 'General Relativity',
    abbr: 'GR',
    tagline: 'Spacetime curvature · Geodesics · Gravitational waves',
    description:
      'Einstein\'s field equations. Spacetime warp under mass, geodesic precession, and gravitational wave emission from a binary.',
    color: 'orange',
    formula: 'G_μν + Λg_μν = 8πT_μν',
  },
  {
    id: 'thermodynamics',
    name: 'Thermodynamics',
    abbr: 'TD',
    tagline: 'Maxwell-Boltzmann · Entropy · Heat engines',
    description:
      'Statistical mechanics in motion. Gas particles colliding in real time, entropy increasing as order dissolves, Carnot cycles on a PV diagram.',
    color: 'sky',
    formula: 'S = k_B ln Ω',
  },
  {
    id: 'fluid-dynamics',
    name: 'Fluid Dynamics',
    abbr: 'FD',
    tagline: 'Streamlines · Vortex shedding · SPH',
    description:
      'Potential flow, Kármán vortex street via discrete vortex method, and smoothed particle hydrodynamics dam break.',
    color: 'teal',
    formula: 'ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u',
  },
  {
    id: 'acoustic-physics',
    name: 'Acoustic Physics',
    abbr: '♪',
    tagline: 'Cymatics · Harmonics · Lissajous',
    description:
      'Sound meets matter. Chladni figures show how vibrating plates form geometric nodal patterns. The harmonic series reveals why musical intervals sound consonant. Lissajous curves trace the geometric fingerprint of every musical ratio.',
    color: 'violet',
    formula: 'f_n = nf₀,  λ_n = 2L/n',
  },
]

// Catalogue grouping (by area of the physics syllabus)
const TOPICS = [
  { id: 'all',        label: 'All modules' },
  { id: 'waves',      label: 'Waves & optics',        modules: ['wave-mechanics', 'optics', 'acoustic-physics'] },
  { id: 'fields',     label: 'Fields & motion',       modules: ['physics-sandbox', 'electromagnetism', 'dynamical-systems'] },
  { id: 'relativity', label: 'Relativity & cosmos',   modules: ['special-relativity', 'general-relativity', 'frontier-physics'] },
  { id: 'quantum',    label: 'Quantum',               modules: ['quantum-mechanics'] },
  { id: 'thermal',    label: 'Thermal & fluids',      modules: ['thermodynamics', 'fluid-dynamics'] },
]
const topicOf = (id) => TOPICS.find((t) => t.modules?.includes(id))?.label ?? ''

const NAV_LINKS = [
  { label: 'Journeys',   event: 'umbra-journeys-open' },
  { label: 'Challenges', event: 'umbra-challenges-open' },
  { label: 'Rooms',      event: 'umbra-rooms-open' },
]

const ACCENT_HEX = {
  cyan:    '#7c8cff',
  amber:   '#f59e0b',
  rose:    '#e040fb',
  emerald: '#10b981',
  violet:  '#a855f7',
  orange:  '#fb923c',
  sky:     '#38bdf8',
  teal:    '#2dd4bf',
  lime:    '#84cc16',
  azure:   '#22d3ee',
  gold:    '#fcd34d',
}

// ── Hero showcase: cycles through 3 scenes ────────────────────────────────────

const HERO_CYCLES = [
  { label: 'Dynamical Systems',  formula: 'dX/dt = σ(y−x), x(ρ−z)−y, xy−βz', color: '#10b981' },
  { label: 'Wave Mechanics',     formula: '∂²u/∂t² = c²∇²u',                  color: '#22d3ee' },
  { label: 'General Relativity', formula: 'G_μν + Λg_μν = 8πT_μν',            color: '#fb923c' },
]

const H_VERT = `
  attribute float aAge;
  varying vec3 vC;
  void main() {
    vC = mix(vec3(0.18,0.22,0.62), vec3(0.55,0.75,1.0), aAge);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
    gl_PointSize = 2.2;
  }
`
const H_FRAG = `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 0.95); }`

function HeroLorenz() {
  const groupRef = useRef()

  const { geo, mat } = useMemo(() => {
    const sigma = 10, rho = 28, beta = 8 / 3
    const dt = 0.007, SKIP = 600, N = 1600
    let x = 0.1, y = 0, z = 20
    for (let i = 0; i < SKIP; i++) {
      const dx = sigma*(y-x), dy = x*(rho-z)-y, dz = x*y-beta*z
      x += dx*dt; y += dy*dt; z += dz*dt
    }
    const pts = [], age = new Float32Array(N)
    const sc = 0.043
    for (let i = 0; i < N; i++) {
      const dx = sigma*(y-x), dy = x*(rho-z)-y, dz = x*y-beta*z
      x += dx*dt; y += dy*dt; z += dz*dt
      pts.push(new THREE.Vector3(x*sc, (z-25)*sc, y*sc))
      age[i] = i / N
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    g.setAttribute('aAge', new THREE.BufferAttribute(age, 1))
    const m = new THREE.ShaderMaterial({ vertexShader: H_VERT, fragmentShader: H_FRAG })
    return { geo: g, mat: m }
  }, [])

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.20
      groupRef.current.rotation.x += dt * 0.048
    }
  })

  return (
    <group ref={groupRef}>
      <line geometry={geo} material={mat} />
      <points geometry={geo}>
        <shaderMaterial
          vertexShader={H_VERT}
          fragmentShader={H_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight color="#7c8cff" intensity={1.0} distance={7} decay={2} />
      <ambientLight intensity={0.04} color="#04040a" />
    </group>
  )
}

// Wave ripple surface
const WV_NX = 36, WV_NZ = 36
const WV_VERT = `varying float vH; void main(){ vH=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`
const WV_FRAG = `
  varying float vH; void main(){
    float t=clamp(vH*1.6+0.5,0.,1.);
    vec3 d=vec3(0.01,0.06,0.22), m=vec3(0.04,0.55,0.92), p=vec3(0.7,0.97,1.0);
    vec3 c=t<0.5?mix(d,m,t*2.):mix(m,p,(t-.5)*2.);
    gl_FragColor=vec4(c,0.92);
  }
`
function HeroWave() {
  const meshRef  = useRef()
  const groupRef = useRef()
  const tRef     = useRef(0)

  const geo = useMemo(() => {
    const pos = new Float32Array(WV_NX * WV_NZ * 3)
    for (let j = 0; j < WV_NZ; j++)
      for (let i = 0; i < WV_NX; i++) {
        const k = (j * WV_NX + i) * 3
        pos[k]   = (i / (WV_NX-1) - 0.5) * 2.6
        pos[k+1] = 0
        pos[k+2] = (j / (WV_NZ-1) - 0.5) * 2.6
      }
    const idx = new Uint32Array((WV_NX-1)*(WV_NZ-1)*6); let p=0
    for (let j=0; j<WV_NZ-1; j++)
      for (let i=0; i<WV_NX-1; i++) {
        const a=j*WV_NX+i, b=a+1, c=a+WV_NX, d=c+1
        idx[p++]=a; idx[p++]=c; idx[p++]=b; idx[p++]=b; idx[p++]=c; idx[p++]=d
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    return g
  }, [])

  useFrame((_, dt) => {
    tRef.current += dt
    const t = tRef.current
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let j = 0; j < WV_NZ; j++)
      for (let i = 0; i < WV_NX; i++) {
        const x = (i / (WV_NX-1) - 0.5) * 2.6
        const z = (j / (WV_NZ-1) - 0.5) * 2.6
        const r1 = Math.sqrt((x+0.5)*(x+0.5) + z*z)
        const r2 = Math.sqrt((x-0.5)*(x-0.5) + z*z)
        const h  = Math.sin(r1*4.5 - t*2.6) * 0.14 / (1+r1*1.2)
                 + Math.sin(r2*4.5 - t*2.6 + 1.2) * 0.12 / (1+r2*1.2)
        attr.setY(j * WV_NX + i, h)
      }
    attr.needsUpdate = true
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.12
  })

  return (
    <group ref={groupRef} rotation={[-0.35, 0, 0]}>
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={WV_VERT} fragmentShader={WV_FRAG}
          side={THREE.DoubleSide} transparent />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#22d3ee" intensity={1.4} distance={6} decay={2} />
      <ambientLight intensity={0.04} color="#010608" />
    </group>
  )
}

// Spacetime curvature surface (GR preview)
const GR_NX = 28, GR_NZ = 28
const GR_VERT = `varying float vH; void main(){ vH=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`
const GR_FRAG = `
  varying float vH; void main(){
    float t=clamp(-vH*1.8+0.5,0.,1.);
    vec3 a=vec3(.65,.22,.05), b=vec3(.20,.06,.01);
    gl_FragColor=vec4(mix(b,a,t),0.88);
  }
`
function HeroGR() {
  const meshRef  = useRef()
  const groupRef = useRef()

  const geo = useMemo(() => {
    const pos = new Float32Array(GR_NX * GR_NZ * 3)
    const idx = new Uint32Array((GR_NX-1)*(GR_NZ-1)*6)
    for (let j = 0; j < GR_NZ; j++)
      for (let i = 0; i < GR_NX; i++) {
        const k = (j*GR_NX+i)*3
        const x = (i/(GR_NX-1)-0.5)*2.4
        const z = (j/(GR_NZ-1)-0.5)*2.4
        const r = Math.sqrt(x*x+z*z)
        pos[k]=x; pos[k+1] = -0.48/(r+0.32); pos[k+2]=z
      }
    let p=0
    for (let j=0; j<GR_NZ-1; j++) for (let i=0; i<GR_NX-1; i++) {
      const a=j*GR_NX+i, b=a+1, c=a+GR_NX, d=c+1
      idx[p++]=a; idx[p++]=c; idx[p++]=b; idx[p++]=b; idx[p++]=c; idx[p++]=d
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    return g
  }, [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.22
  })

  return (
    <group ref={groupRef} rotation={[-0.48, 0, 0]}>
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={GR_VERT} fragmentShader={GR_FRAG}
          side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#fb923c" emissive="#c04010" emissiveIntensity={1.4} roughness={0} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#fb923c" intensity={1.4} distance={5} decay={2} />
      <ambientLight intensity={0.04} color="#080300" />
    </group>
  )
}

const HERO_CAMERAS = [
  [0, 0.35, 3.8],   // Lorenz
  [0, 1.6, 3.2],    // Wave
  [0.4, 1.0, 3.0],  // GR
]

function HeroCameraRig({ idx }) {
  const { camera } = useThree()
  useEffect(() => {
    const [x, y, z] = HERO_CAMERAS[idx]
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
  }, [idx, camera])
  return null
}

function HeroActiveScene({ idx }) {
  if (idx === 0) return <HeroLorenz />
  if (idx === 1) return <HeroWave />
  return <HeroGR />
}

function HeroCanvas() {
  const [idx,      setIdx]     = useState(0)
  const [labelOpacity, setLO]  = useState(1)

  useEffect(() => {
    const t = setInterval(() => {
      // Fade label out, swap scene, fade back
      setLO(0)
      setTimeout(() => {
        setIdx(i => (i + 1) % HERO_CYCLES.length)
        setLO(1)
      }, 500)
    }, 7000)
    return () => clearInterval(t)
  }, [])

  const cycle = HERO_CYCLES[idx]

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute top-3 left-3 z-10 flex items-center gap-2 h-7 px-2.5 rounded-md bg-ground/75 border border-border-subtle backdrop-blur-sm text-[12px] font-medium text-text-primary"
        style={{ transition: 'opacity 0.4s', opacity: labelOpacity }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: cycle.color }} aria-hidden="true" />
        {cycle.label.charAt(0) + cycle.label.slice(1).toLowerCase()}
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: HERO_CAMERAS[idx], fov: 46 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
        style={{ background: '#0b0d12', width: '100%', height: '100%', display: 'block' }}
      >
        <HeroCameraRig idx={idx} />
        <HeroActiveScene idx={idx} />
      </Canvas>

      <div
        className="absolute bottom-3 left-3 z-10 h-7 flex items-center px-2.5 rounded-md bg-ground/75 border border-border-subtle backdrop-blur-sm font-mono-data text-[12px] text-text-dim"
        style={{ transition: 'opacity 0.4s', opacity: labelOpacity }}
      >
        {cycle.formula}
      </div>
    </div>
  )
}

// ── Stats strip ────────────────────────────────────────────────────────────────
const STATS = [
  { value: `${MODULES.length}`,  label: 'Modules' },
  { value: '40',   label: 'Simulations' },
  { value: 'GPU',  label: 'Accelerated' },
  { value: '100%', label: 'Physics run in your browser' },
  { value: 'LIVE', label: 'Particles computed', live: true },
]

// ── Module card ────────────────────────────────────────────────────────────────
function ModuleCard({ module, onEnter, onHoverIn, onHoverOut, cardRef }) {
  const hex = ACCENT_HEX[module.color]
  return (
    <button
      type="button"
      ref={cardRef}
      onClick={onEnter}
      onMouseEnter={(e) => onHoverIn(e.currentTarget)}
      onMouseLeave={(e) => onHoverOut(e.currentTarget)}
      onFocus={(e) => onHoverIn(e.currentTarget)}
      onBlur={(e) => onHoverOut(e.currentTarget)}
      className="group relative flex flex-col text-left p-5 rounded-xl bg-panel border border-border-subtle transition-[border-color,background-color,transform] duration-200 hover:bg-panel-hover hover:-translate-y-0.5"
      style={{ '--accent': hex }}
    >
      <span className="absolute inset-x-5 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: hex }} aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 mb-4">
        <span
          className="flex items-center justify-center w-10 h-10 rounded-lg text-[20px] font-semibold"
          style={{ color: hex, background: `${hex}1a`, border: `1px solid ${hex}33` }}
          aria-hidden="true"
        >
          {module.abbr}
        </span>
        <span className="text-[12px] text-text-dim">{topicOf(module.id)}</span>
      </div>
      <h3 className="text-[17px] font-semibold text-text-primary leading-tight mb-1">{module.name}</h3>
      <p className="text-[13px] font-medium mb-3" style={{ color: hex }}>{module.tagline}</p>
      <p className="text-[14px] leading-relaxed text-text-dim mb-5 flex-1 line-clamp-3">{module.description}</p>
      <div className="flex items-center justify-between gap-3">
        <code className="font-mono-data text-[12px] px-2 py-1 rounded-md bg-ground border border-border-subtle text-text-primary/90 truncate">
          {module.formula}
        </code>
        <span className="flex items-center gap-1 text-[13px] font-medium text-text-dim group-hover:text-text-primary transition-colors shrink-0">
          Open
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
    </button>
  )
}

function SabrinaCard({ onEnter, onHoverIn, onHoverOut, cardRef, bloomIn }) {
  return (
    <>
      {bloomIn && (
        <style>{`
          @keyframes sabrina-bloom {
            0%   { opacity: 0; transform: scale(0.86); filter: brightness(4); }
            55%  { opacity: 1; transform: scale(1.03); filter: brightness(1.6); }
            100% { opacity: 1; transform: scale(1);    filter: brightness(1); }
          }
        `}</style>
      )}
      <button
        ref={cardRef}
        onClick={onEnter}
        onMouseEnter={onHoverIn}
        className="group relative flex flex-col text-left p-5 rounded-sm cursor-pointer focus:outline-none transition-all duration-300"
        style={{
          background: 'rgba(17,20,27, 0.72)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,105,180,0.18)',
          animation: bloomIn ? 'sabrina-bloom 0.85s cubic-bezier(0.22,1,0.36,1) both' : undefined,
        }}
        onMouseMove={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,105,180,0.75)'
          e.currentTarget.style.boxShadow = '0 0 18px 2px rgba(255,20,147,0.15), inset 0 1px 0 rgba(255,105,180,0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,105,180,0.18)'
          e.currentTarget.style.boxShadow = 'none'
          onHoverOut()
        }}
      >
        <div className="font-display text-[42px] font-bold leading-none mb-3"
          style={{ color: '#ff69b4', textShadow: '0 0 20px rgba(255,20,147,0.5)' }}>
          ♡
        </div>
        <div className="mb-3">
          <h2 className="font-display text-[15px] font-semibold text-text-primary mb-1 leading-tight tracking-wide">
            For Sabrina
          </h2>
          <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, lineHeight: 1.5, color: 'rgba(255,105,180,0.88)', margin: 0 }}>
            a message · just for you
          </p>
        </div>
        <p className="font-body leading-relaxed mb-4 flex-1" style={{ fontSize: 13, color: 'rgba(247,248,248,0.75)' }}>
          something made for you, because you deserve it.
        </p>
        <div className="self-start font-mono-data text-[13px] px-2 py-0.5 rounded border"
          style={{ color: '#ff69b4', borderColor: 'rgba(255,105,180,0.3)', background: 'rgba(255,105,180,0.07)' }}>
          mwah ♥
        </div>
        <div className="absolute bottom-4 right-4 font-mono-data text-[12px] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: '#ff69b4' }}>
          ENTER →
        </div>
      </button>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ModulePicker() {
  const setActiveModule    = useModuleStore((s) => s.setActiveModule)
  const [hoveredModule,  setHoveredModule]  = useState(null)
  const [hoveredCardEl,  setHoveredCardEl]  = useState(null)
  const [unlocked,       setUnlocked]       = useState(checkUnlocked)
  const [justUnlocked,   setJustUnlocked]   = useState(false)
  const [viewMode,       setViewMode]       = useState('grid')
  const [topic,          setTopic]          = useState('all')
  const [recentIds]                         = useState(() => {
    try { return JSON.parse(localStorage.getItem('umbra_recent') || '[]') } catch { return [] }
  })
  const mouseRef  = useRef({ x: 0, y: 0 })
  const cardRefs  = useRef({})
  const gridRef   = useRef(null)
  const gesture   = useGesture()

  useEffect(() => {
    let typed = ''
    const onKey = (e) => {
      if (e.key.length !== 1) return
      typed = (typed + e.key.toLowerCase()).slice(-(SECRET_PHRASE.length * 2))
      if (!unlocked && typed.includes(SECRET_PHRASE)) {
        typed = ''
        doUnlock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unlocked]) // eslint-disable-line react-hooks/exhaustive-deps

  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)

  const doUnlock = useCallback(() => {
    sessionStorage.setItem(STORE_KEY, '1')
    setUnlocked(true)
    setJustUnlocked(true)
    setTimeout(() => setJustUnlocked(false), 1000)
  }, [])

  const handleTitleTap = useCallback(() => {
    if (unlocked) return
    tapCountRef.current += 1
    clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      doUnlock()
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 1800)
    }
  }, [unlocked, doUnlock])

  useEffect(() => {
    if (!gesture.enabled) return
    let rafId
    const tick = () => {
      const ptr = gesture.pointerRef.current
      if (ptr) {
        mouseRef.current = ptr
        const sx = ((ptr.x + 1) / 2) * window.innerWidth
        const sy = ((1 - ptr.y) / 2) * window.innerHeight
        let hit = null
        for (const [id, el] of Object.entries(cardRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) {
            hit = id; break
          }
        }
        setHoveredModule(hit)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [gesture.enabled, gesture.pointerRef, gesture.justPinchedRef, setActiveModule])


  const visibleModules = topic === 'all'
    ? MODULES
    : MODULES.filter((m) => TOPICS.find((t) => t.id === topic)?.modules.includes(m.id))
  const recent = recentIds.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean)
  const navTo = (event) => window.dispatchEvent(new CustomEvent(event))

  return (
    <div className="relative w-full h-full overflow-hidden bg-ground">
      <div className="relative flex flex-col h-full overflow-y-auto thin-scroll">

        {/* ── Navbar ── */}
        <header className="sticky top-0 z-20 shrink-0 bg-ground/85 backdrop-blur-md border-b border-border-subtle">
          <nav className="flex items-center gap-2 h-16 px-4 sm:px-8 max-w-[1280px] mx-auto w-full" aria-label="Main">
            <button
              type="button"
              onClick={handleTitleTap}
              className="flex items-center gap-2.5 mr-2 select-none rounded-md"
              style={{ cursor: 'default' }}
              aria-label="Umbra home"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-glow text-ground font-bold text-[15px]" aria-hidden="true">U</span>
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-text-primary">Umbra</span>
            </button>

            <div className="hidden md:flex items-center gap-1">
              <button type="button" className="ui-btn-ghost" onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth' })}>Modules</button>
              {NAV_LINKS.map((l) => (
                <button key={l.label} type="button" className="ui-btn-ghost" onClick={() => navTo(l.event)}>{l.label}</button>
              ))}
              <button type="button" className="ui-btn-ghost" onClick={() => navTo('umbra-telescopes-open')}>
                <span className="w-2 h-2 rounded-full bg-emerald-glow" aria-hidden="true" />
                Live
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => navTo('umbra-palette-open')}
                className="ui-btn text-text-dim hidden sm:inline-flex"
                aria-label="Search modules and commands"
              >
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M7.2 7.2L9 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                <span className="hidden lg:inline">Search</span>
                <kbd className="font-mono-data text-[11px] px-1.5 rounded border border-border-subtle text-text-dim">⌘K</kbd>
              </button>
              <ThemeButton />
              <button type="button" className="ui-btn-ghost w-9 px-0" onClick={() => navTo('umbra-profile-open')} aria-label="Your profile and progress" title="Profile (P)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </button>
              <AccountButton />
            </div>
          </nav>
          {/* Compact nav for small screens */}
          <div className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto thin-scroll">
            {NAV_LINKS.map((l) => (
              <button key={l.label} type="button" className="ui-btn-ghost h-8 shrink-0" onClick={() => navTo(l.event)}>{l.label}</button>
            ))}
            <button type="button" className="ui-btn-ghost h-8 shrink-0" onClick={() => navTo('umbra-telescopes-open')}>Live</button>
          </div>
        </header>

        <div className="w-full max-w-[1280px] mx-auto">

          {/* ── Hero ── */}
          <section className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14 px-4 sm:px-8 pt-12 sm:pt-16 pb-14">
            <div className="flex-1 max-w-[560px]">
              <p className="inline-flex items-center gap-2 min-h-7 py-1 px-3 mb-6 rounded-2xl text-[13px] font-medium text-text-dim bg-panel border border-border-subtle">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow" aria-hidden="true" />
                {MODULES.length} interactive simulations · mapped to A-level & IB
              </p>
              <h1 className="text-[clamp(36px,5vw,60px)] font-semibold leading-[1.05] tracking-[-0.025em] text-text-primary mb-5">
                See the physics.<br />
                <span className="text-cyan-mid">Then change it.</span>
              </h1>
              <p className="text-[17px] leading-relaxed text-text-dim mb-8 max-w-[480px]">
                Real-time 3D simulations from quantum tunnelling to black holes, each with the governing
                equation, a guided lesson and an AI tutor that sees what you see. Free, in the browser.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth' })} className="ui-btn-primary h-11 px-5 text-[15px]">
                  Explore the modules
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" onClick={() => navTo('umbra-journeys-open')} className="ui-btn h-11 px-5 text-[15px]">
                  Start a guided journey
                </button>
              </div>
              <p className="mt-5 text-[13px] text-text-dim">No account needed · works on any laptop or projector</p>
            </div>

            <div className="w-full lg:w-[520px] shrink-0 rounded-2xl overflow-hidden border border-border-subtle bg-panel" style={{ height: 'clamp(280px, 42vh, 440px)' }}>
              <HeroCanvas />
            </div>
          </section>

          {/* ── Continue where you left off ── */}
          {recent.length > 0 && (
            <section className="px-4 sm:px-8 pb-10" aria-labelledby="recent-h">
              <h2 id="recent-h" className="ui-eyebrow mb-3">Continue where you left off</h2>
              <div className="flex flex-wrap gap-2">
                {recent.map((mod) => {
                  const hex = ACCENT_HEX[mod.color]
                  return (
                    <button key={mod.id} type="button" onClick={() => setActiveModule(mod.id)} className="ui-btn h-10 pl-2 pr-3.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-md text-[13px] font-semibold" style={{ color: hex, background: `${hex}1a` }} aria-hidden="true">{mod.abbr}</span>
                      {mod.name}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Module catalogue ── */}
          <section ref={gridRef} className="px-4 sm:px-8 pb-16 scroll-mt-20" aria-labelledby="modules-h">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <div>
                <h2 id="modules-h" className="text-[26px] font-semibold tracking-[-0.02em] text-text-primary">Modules</h2>
                <p className="text-[15px] text-text-dim mt-1">Pick a topic, open a simulation, and follow the lesson beside it.</p>
              </div>
              <div role="radiogroup" aria-label="Layout" className="flex p-1 rounded-lg bg-panel border border-border-subtle">
                {[['grid', 'Grid'], ['constellation', 'Concept map']].map(([mode, label]) => (
                  <button key={mode} type="button" role="radio" aria-checked={viewMode === mode} onClick={() => setViewMode(mode)}
                    className={`h-8 px-3 rounded-md text-[13px] font-medium transition-colors ${viewMode === mode ? 'bg-panel-hover text-text-primary' : 'text-text-dim hover:text-text-primary'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'constellation' ? (
              <ConstellationMap onNavigate={setActiveModule} />
            ) : (
              <>
                <div role="tablist" aria-label="Filter by topic" className="flex gap-1.5 mb-6 overflow-x-auto thin-scroll pb-1">
                  {TOPICS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={topic === t.id} onClick={() => setTopic(t.id)}
                      className={`h-9 px-3.5 rounded-full text-[14px] font-medium whitespace-nowrap border transition-colors ${
                        topic === t.id ? 'bg-text-primary text-ground border-text-primary' : 'bg-panel text-text-dim border-border-subtle hover:text-text-primary'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleModules.map((mod) => (
                    <ModuleCard
                      key={mod.id}
                      module={mod}
                      cardRef={(el) => { cardRefs.current[mod.id] = el }}
                      onEnter={() => setActiveModule(mod.id)}
                      onHoverIn={(el) => { setHoveredModule(mod.id); setHoveredCardEl(el) }}
                      onHoverOut={() => { setHoveredModule(null); setHoveredCardEl(null) }}
                    />
                  ))}
                  {unlocked && topic === 'all' && (
                    <SabrinaCard
                      cardRef={(el) => { cardRefs.current['sabrina'] = el }}
                      onEnter={() => setActiveModule('sabrina')}
                      onHoverIn={() => setHoveredModule('sabrina')}
                      onHoverOut={() => setHoveredModule(null)}
                      bloomIn={justUnlocked}
                    />
                  )}
                </div>
              </>
            )}
          </section>

          {/* ── Ways to learn ── */}
          <FeatureRail />

          {/* ── For classrooms ── */}
          <section className="px-4 sm:px-8 py-16 border-t border-border-subtle" aria-labelledby="teach-h">
            <p className="ui-eyebrow mb-3">For classrooms</p>
            <h2 id="teach-h" className="text-[clamp(26px,3vw,36px)] font-semibold tracking-[-0.02em] text-text-primary mb-8 max-w-[620px]">
              Physics you can project, set as homework, and hand to a student.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Teach with it', desc: 'Embed any simulation in Canvas, Moodle, Notion or a webpage with one line. Present mode hides the interface for projectors.', tag: 'Embed anywhere' },
                { title: 'Learn with it', desc: 'Guided journeys from Galileo to Hawking, predict-first checkpoints in every lesson, and an AI tutor that answers about exactly what is on screen.', tag: 'Guided' },
                { title: 'Explore together', desc: 'Rooms keep a whole class on the same simulation. Record clips, and share exact parameter settings with a link.', tag: 'Real-time' },
              ].map((c) => (
                <div key={c.title} className="ui-card p-6">
                  <p className="text-[12px] font-semibold text-cyan-mid mb-3">{c.tag}</p>
                  <h3 className="text-[17px] font-semibold text-text-primary mb-2">{c.title}</h3>
                  <p className="text-[15px] leading-relaxed text-text-dim">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <button type="button" onClick={() => navTo('umbra-pricing-open')} className="ui-btn h-11 px-5 text-[15px]">
                School & university licensing
              </button>
              <span className="text-[14px] text-text-dim">Free for individual learners, forever.</span>
            </div>
          </section>

          {/* ── Stats ── */}
          <dl className="grid grid-cols-2 md:grid-cols-5 border-y border-border-subtle mx-4 sm:mx-8">
            {STATS.map((st, i) => (
              <div key={i} className="flex flex-col items-center gap-1 py-6 px-3 text-center">
                <dd className="text-[26px] font-semibold tabular-nums text-text-primary order-1">{st.live ? <LiveParticleCount /> : st.value}</dd>
                <dt className="text-[13px] text-text-dim order-2">{st.label}</dt>
              </div>
            ))}
          </dl>

          {/* ── Footer ── */}
          <footer className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-8 py-8 pb-24">
            <p className="text-[13px] text-text-dim">Umbra · every simulation runs in your browser. Questions you ask the AI tutor are sent to our AI provider to be answered.</p>
            <div className="flex items-center gap-1">
              <button type="button" className="ui-btn-ghost h-8 text-[13px]" onClick={() => navTo('umbra-about-open')}>About</button>
              <button type="button" className="ui-btn-ghost h-8 text-[13px]" onClick={() => navTo('umbra-pricing-open')}>Pricing</button>
              <button type="button" className="ui-btn-ghost h-8 text-[13px]" onClick={() => navTo('umbra-telescopes-open')}>Live from orbit</button>
            </div>
          </footer>
        </div>
      </div>

      <CardPreview moduleId={hoveredModule} cardEl={hoveredCardEl} />
    </div>
  )
}
