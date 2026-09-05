import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../store/useModuleStore'
import PhysicsBg from './PhysicsBg'
import CardPreview from './CardPreview'
import ConstellationMap from './ConstellationMap'
import { useGesture } from '../context/GestureContext'
import DecodeText from './DecodeText'

// ── Scroll-reveal: fade-up cards as they enter the viewport ───────────────────
function useReveal(idx = 0) {
  const ref = useRef()
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const delay = (idx % 4) * 90
  return [ref, {
    opacity: vis ? 1 : 0,
    transform: vis ? 'none' : 'translateY(24px)',
    transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }]
}

const SECRET_PHRASE = 'sabrina'
const STORE_KEY     = 'umbra_unlocked'

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
      'Drop attractors, repulsors, and vortices onto a live particle field. 900 tracers respond to every source simultaneously — combine them to build spiral galaxies, standing waves, or pure chaos.',
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
      '3D glass prism dispersing 24 spectral wavelengths via Cauchy dispersion. Biconvex lens converging parallel rays to the focal point. Diffraction grating spreading orders m=0,±1,±2 by wavelength.',
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

const ACCENT_HEX = {
  cyan:    '#5e6ad2',
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
      <pointLight color="#5e6ad2" intensity={1.0} distance={7} decay={2} />
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
  const [fadeIn,   setFadeIn]  = useState(true)
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
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        borderRadius: 4,
        border: '1px solid rgba(94,106,210,0.14)',
        boxShadow: '0 0 48px rgba(94,106,210,0.05), 0 24px 64px rgba(0,0,0,0.6)',
      }}
    >
      {/* Window chrome top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2.5 px-3.5 py-2.5"
        style={{
          background: 'rgba(8,9,10,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(94,106,210,0.08)',
        }}
      >
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(94,106,210,0.18)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(94,106,210,0.18)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(94,106,210,0.55)' }} />
        </div>
        <span
          className="font-mono-data text-[9px] tracking-[0.22em] uppercase ml-1"
          style={{ color: 'rgba(255,255,255,0.25)', transition: 'opacity 0.4s', opacity: labelOpacity }}
        >
          {cycle.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#5e6ad2', boxShadow: '0 0 6px #5e6ad2', animation: 'umbra-pulse 1.8s ease-in-out infinite' }}
          />
          <span className="font-mono-data text-[8px] tracking-wider" style={{ color: 'rgba(94,106,210,0.5)' }}>LIVE</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: HERO_CAMERAS[idx], fov: 46 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
        style={{ background: '#08090a', width: '100%', height: '100%', display: 'block' }}
      >
        <HeroCameraRig idx={idx} />
        <HeroActiveScene idx={idx} />
      </Canvas>

      {/* Bottom formula bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-3.5 py-2.5"
        style={{
          background: 'rgba(8,9,10,0.88)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(94,106,210,0.06)',
          transition: 'opacity 0.4s',
          opacity: labelOpacity,
        }}
      >
        <span className="font-mono-data text-[9px] tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {cycle.formula}
        </span>
        <span
          className="ml-auto font-mono-data text-[8px] tracking-[0.15em] uppercase"
          style={{ color: 'rgba(94,106,210,0.28)' }}
        >
          GPU · REAL-TIME
        </span>
      </div>

      {/* Subtle corner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 80% 20%, ${cycle.color}0a 0%, transparent 60%)`,
          transition: 'background 0.5s',
        }}
      />
    </div>
  )
}

// ── Stats strip ────────────────────────────────────────────────────────────────
const STATS = [
  { value: `${MODULES.length}`,  label: 'Modules' },
  { value: '50+',  label: 'Simulations' },
  { value: 'GPU',  label: 'Accelerated' },
  { value: '0',    label: 'Server calls' },
  { value: 'LIVE', label: 'Particles computed', live: true },
]

// ── Module card ────────────────────────────────────────────────────────────────
function ModuleCard({ module, onEnter, onHoverIn, onHoverOut, cardRef, idx = 0 }) {
  const hex    = ACCENT_HEX[module.color]
  const hexRgb = parseInt(hex.slice(1), 16)
  const r = (hexRgb >> 16) & 0xff
  const g = (hexRgb >>  8) & 0xff
  const b =  hexRgb        & 0xff
  const [revealRef, revealStyle] = useReveal(idx)

  return (
    <div ref={revealRef} style={revealStyle} className="flex">
    <button
      ref={cardRef}
      onClick={onEnter}
      onMouseEnter={(e) => onHoverIn(e.currentTarget)}
      onMouseLeave={onHoverOut}
      className="group relative flex flex-col flex-1 text-left p-5 rounded-sm cursor-pointer focus:outline-none focus-visible:ring-1"
      style={{
        background: 'rgba(17,17,19, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid rgba(${r},${g},${b},0.18)`,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const dx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)
        const dy = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)
        const rotY =  dx * 9
        const rotX = -dy * 7
        e.currentTarget.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.025) translateZ(4px)`
        e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.75)`
        e.currentTarget.style.boxShadow   = `0 0 24px 3px rgba(${r},${g},${b},0.18), inset 0 1px 0 rgba(${r},${g},${b},0.1), ${-rotY*0.8}px ${-rotX*0.8}px 22px rgba(${r},${g},${b},0.09)`
        const glare = e.currentTarget.querySelector('[data-glare]')
        if (glare) glare.style.background = `radial-gradient(circle at ${(dx+1)/2*100}% ${(dy+1)/2*100}%, rgba(255,255,255,0.10) 0%, transparent 65%)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform   = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1) translateZ(0)'
        e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.18)`
        e.currentTarget.style.boxShadow   = 'none'
        const glare = e.currentTarget.querySelector('[data-glare]')
        if (glare) glare.style.background = 'none'
        onHoverOut(e.currentTarget)
      }}
    >
      <div
        className="font-display text-[42px] font-bold leading-none mb-3"
        style={{ color: hex, textShadow: `0 0 20px rgba(${r},${g},${b},0.5)` }}
      >
        {module.abbr}
      </div>
      <div className="mb-3">
        <h2 className="font-display text-[15px] font-semibold text-text-primary mb-1 leading-tight tracking-wide">
          {module.name}
        </h2>
        <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, lineHeight: 1.5, color: `rgba(${r},${g},${b},0.85)`, margin: 0 }}>
          {module.tagline}
        </p>
      </div>
      <p className="font-body leading-relaxed mb-4 flex-1" style={{ fontSize: 13, color: 'rgba(247,248,248,0.68)' }}>
        {module.description}
      </p>
      <div
        className="self-start font-mono-data text-[11px] px-2 py-0.5 rounded border"
        style={{
          color: hex,
          borderColor: `rgba(${r},${g},${b},0.3)`,
          background: `rgba(${r},${g},${b},0.07)`,
        }}
      >
        {module.formula}
      </div>
      <div
        className="absolute bottom-4 right-4 font-mono-data text-[10px] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color: hex }}
      >
        ENTER →
      </div>
      {/* Glare overlay */}
      <div data-glare="1" className="absolute inset-0 rounded-sm pointer-events-none" style={{ transition: 'background 0.08s' }} />
    </button>
    </div>
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
        onMouseLeave={onHoverOut}
        className="group relative flex flex-col text-left p-5 rounded-sm cursor-pointer focus:outline-none transition-all duration-300"
        style={{
          background: 'rgba(17,17,19, 0.72)',
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
        <p className="font-body leading-relaxed mb-4 flex-1" style={{ fontSize: 13, color: 'rgba(247,248,248,0.68)' }}>
          something made for you, because you deserve it.
        </p>
        <div className="self-start font-mono-data text-[11px] px-2 py-0.5 rounded border"
          style={{ color: '#ff69b4', borderColor: 'rgba(255,105,180,0.3)', background: 'rgba(255,105,180,0.07)' }}>
          mwah ♥
        </div>
        <div className="absolute bottom-4 right-4 font-mono-data text-[10px] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
  const [recentIds]                         = useState(() => {
    try { return JSON.parse(localStorage.getItem('umbra_recent') || '[]') } catch { return [] }
  })
  const mouseRef  = useRef({ x: 0, y: 0 })
  const cardRefs  = useRef({})
  const gridRef   = useRef(null)
  const gesture   = useGesture()

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = {
      x:  (e.clientX - rect.left)  / rect.width  * 2 - 1,
      y: -((e.clientY - rect.top)  / rect.height * 2 - 1),
    }
  }, [])

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

  const totalModules = unlocked ? MODULES.length + 1 : MODULES.length

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#08090a' }}
      onMouseMove={handleMouseMove}
    >
      <style>{`@keyframes umbra-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* ── Live physics background ── */}
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        camera={{ position: [0, 0, 12], fov: 60 }}
        gl={{ antialias: false, alpha: false }}
      >
        <color attach="background" args={['#08090a']} />
        <PhysicsBg mouseRef={mouseRef} hoveredModule={hoveredModule} />
      </Canvas>

      {/* ── Content layer ── */}
      <div className="relative flex flex-col h-full overflow-y-auto thin-scroll" style={{ zIndex: 10 }}>

        {/* ── Navbar ── */}
        <nav className="shrink-0 flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid rgba(94,106,210,0.07)' }}>
          <button
            onClick={handleTitleTap}
            className="flex items-baseline gap-3 select-none focus:outline-none"
            style={{ cursor: 'default' }}
          >
            <span
              className="font-display text-[22px] font-bold tracking-[0.14em] uppercase leading-none"
              style={{
                color: '#5e6ad2',
                textShadow: '0 0 24px rgba(94,106,210,0.35), 0 0 48px rgba(94,106,210,0.12)',
              }}
            >
              UMBRA
            </span>
            <span className="font-mono-data text-[10px] tracking-[0.22em] uppercase text-text-dim hidden sm:block">
              Physics Visualizer
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('umbra-pricing-open'))}
              className="font-mono-data text-[10px] tracking-[0.14em] uppercase"
              style={{
                color: 'rgba(94,106,210,0.60)', background: 'transparent', border: 'none',
                cursor: 'pointer', padding: '4px 6px', transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#5e6ad2' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(94,106,210,0.60)' }}
            >
              Pricing
            </button>
            <div className="font-mono-data text-[10px] text-text-dim tracking-wider hidden md:block">
              NATURAL UNITS · c = ℏ = G = 1
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('umbra-palette-open'))}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                letterSpacing: '0.08em', color: 'rgba(94,106,210,0.50)',
                border: '1px solid rgba(94,106,210,0.12)',
                borderRadius: 3, padding: '4px 8px', cursor: 'pointer',
                background: 'transparent', transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(94,106,210,0.7)'; e.currentTarget.style.borderColor = 'rgba(94,106,210,0.28)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(94,106,210,0.38)'; e.currentTarget.style.borderColor = 'rgba(94,106,210,0.12)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7.2 7.2L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              ⌘K
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded"
              style={{ border: '1px solid rgba(94,106,210,0.14)', background: 'rgba(94,106,210,0.04)' }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#5e6ad2', boxShadow: '0 0 5px #5e6ad2', animation: 'umbra-pulse 2s ease-in-out infinite' }} />
              <span className="font-mono-data text-[10px] tracking-wider" style={{ color: 'rgba(94,106,210,0.8)' }}>
                {totalModules} MODULES ACTIVE
              </span>
            </div>
          </div>
        </nav>

        {/* ── Hero section ── */}
        <section className="shrink-0 flex flex-col lg:flex-row items-center gap-10 lg:gap-16 px-8 lg:px-14 pt-14 pb-16 lg:min-h-[calc(100vh-56px)]">

          {/* Left: headline + CTA */}
          <div className="flex-1 max-w-[540px]">
            <p className="font-mono-data text-[11px] tracking-[0.28em] uppercase mb-6"
              style={{ color: 'rgba(94,106,210,0.65)' }}>
              Interactive · Real-time · Browser-native
            </p>

            <h1 className="font-display font-bold leading-[1.05] mb-6">
              <DecodeText
                text="Explore physics."
                duration={950}
                as="span"
                className="block text-white"
                style={{ fontSize: 'clamp(40px, 5.5vw, 74px)' }}
              />
              <DecodeText
                text="In real time."
                delay={350}
                duration={950}
                as="span"
                className="block"
                style={{
                  fontSize: 'clamp(40px, 5.5vw, 74px)',
                  color: '#5e6ad2',
                  textShadow: '0 0 40px rgba(94,106,210,0.28), 0 0 80px rgba(94,106,210,0.10)',
                }}
              />
            </h1>

            <p className="font-body leading-relaxed mb-10 max-w-[400px]"
              style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)' }}>
              <span style={{ color: 'rgba(94,106,210,0.85)', fontWeight: 500 }}>
                {MODULES.length} modules. Zero downloads.
              </span>{' '}
              From quantum tunneling to gravitational N-body — all running on your GPU, all in your browser.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 font-mono-data text-[11px] tracking-[0.14em] uppercase px-6 py-3 rounded transition-all duration-200"
                style={{
                  border: '1px solid rgba(94,106,210,0.45)',
                  background: 'rgba(94,106,210,0.07)',
                  color: '#5e6ad2',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(94,106,210,0.14)'
                  e.currentTarget.style.borderColor = 'rgba(94,106,210,0.75)'
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(94,106,210,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(94,106,210,0.07)'
                  e.currentTarget.style.borderColor = 'rgba(94,106,210,0.45)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Browse all modules →
              </button>
              <span className="font-mono-data text-[10px] tracking-wider hidden sm:block"
                style={{ color: 'rgba(255,255,255,0.42)' }}>
                No account required
              </span>
            </div>
          </div>

          {/* Right: floating 3D preview card */}
          <div
            className="shrink-0 w-full lg:w-[480px] xl:w-[520px]"
            style={{ height: 'clamp(280px, 38vh, 420px)' }}
          >
            <HeroCanvas />
          </div>
        </section>

        {/* ── Stats strip ── */}
        <div
          className="shrink-0 flex items-stretch"
          style={{ borderTop: '1px solid rgba(94,106,210,0.06)', borderBottom: '1px solid rgba(94,106,210,0.06)' }}
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-7 px-4"
              style={{ borderRight: i < STATS.length - 1 ? '1px solid rgba(94,106,210,0.06)' : 'none' }}
            >
              <span
                className="font-display font-bold tabular-nums leading-none"
                style={{
                  fontSize: 'clamp(22px, 3vw, 36px)',
                  color: s.live ? '#5e6ad2' : '#ffffff',
                  textShadow: s.live ? '0 0 20px rgba(94,106,210,0.5)' : '0 0 20px rgba(94,106,210,0.18)',
                }}
              >
                {s.live ? <LiveParticleCount /> : s.value}
              </span>
              <div className="flex items-center gap-1.5">
                {s.live && (
                  <span className="w-1 h-1 rounded-full" style={{ background: '#5e6ad2', boxShadow: '0 0 4px #5e6ad2', animation: 'umbra-pulse 1.2s ease-in-out infinite' }} />
                )}
                <span className="font-mono-data text-[11px] tracking-[0.18em] uppercase text-center" style={{ color: '#8d8d96' }}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Module grid header + view toggle ── */}
        <div ref={gridRef} className="shrink-0 flex items-center gap-4 px-8 pt-10 pb-5">
          <div className="flex-1 h-px" style={{ background: 'rgba(94,106,210,0.08)' }} />
          <span className="font-mono-data text-[10px] tracking-[0.24em] uppercase px-1" style={{ color: '#8d8d96' }}>
            // SELECT MODULE
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(94,106,210,0.08)' }} />
          {/* View toggle */}
          <div className="flex shrink-0" style={{ border: '1px solid rgba(94,106,210,0.12)', borderRadius: 4, overflow: 'hidden' }}>
            {[['grid', '≡ GRID'], ['constellation', '⊕ MAP']].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  letterSpacing: '0.1em', padding: '5px 10px', cursor: 'pointer',
                  border: 'none', borderRight: mode === 'grid' ? '1px solid rgba(94,106,210,0.12)' : 'none',
                  background: viewMode === mode ? 'rgba(94,106,210,0.10)' : 'transparent',
                  color: viewMode === mode ? '#5e6ad2' : 'rgba(94,106,210,0.3)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* ── Recently visited strip ── */}
        {recentIds.length > 0 && (() => {
          const recent = recentIds.map(id => MODULES.find(m => m.id === id)).filter(Boolean)
          if (!recent.length) return null
          return (
            <div className="px-8 pb-5">
              <p className="font-mono-data text-[10px] tracking-[0.22em] uppercase mb-3" style={{ color: 'rgba(94,106,210,0.50)' }}>
                Recently visited
              </p>
              <div className="flex flex-wrap gap-2">
                {recent.map(mod => {
                  const hex = ACCENT_HEX[mod.color]
                  return (
                    <button
                      key={mod.id}
                      onClick={() => setActiveModule(mod.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 11px',
                        background: `${hex}0c`,
                        border: `1px solid ${hex}28`,
                        borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'background 0.1s, border-color 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${hex}1c`; e.currentTarget.style.borderColor = `${hex}55` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${hex}0c`; e.currentTarget.style.borderColor = `${hex}28` }}
                    >
                      <span style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 12, fontWeight: 700, color: hex }}>
                        {mod.abbr}
                      </span>
                      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: 'rgba(223,242,237,0.65)', letterSpacing: '0.01em' }}>
                        {mod.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <main className="flex-1 px-8 pb-8">
          {viewMode === 'constellation' ? (
            <ConstellationMap onNavigate={setActiveModule} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MODULES.map((mod, mi) => (
                <ModuleCard
                  key={mod.id}
                  idx={mi}
                  module={mod}
                  cardRef={(el) => { cardRefs.current[mod.id] = el }}
                  onEnter={() => setActiveModule(mod.id)}
                  onHoverIn={(el) => { setHoveredModule(mod.id); setHoveredCardEl(el) }}
                  onHoverOut={() => { setHoveredModule(null); setHoveredCardEl(null) }}
                />
              ))}
              {unlocked && (
                <SabrinaCard
                  cardRef={(el) => { cardRefs.current['sabrina'] = el }}
                  onEnter={() => setActiveModule('sabrina')}
                  onHoverIn={() => setHoveredModule('sabrina')}
                  onHoverOut={() => setHoveredModule(null)}
                  bloomIn={justUnlocked}
                />
              )}
            </div>
          )}
        </main>

        {/* ── For educators / use-cases strip ── */}
        <section className="shrink-0 px-8 lg:px-14 pt-16 pb-14" style={{ borderTop: '1px solid rgba(94,106,210,0.07)' }}>
          <p className="font-mono-data text-[11px] tracking-[0.28em] uppercase mb-3" style={{ color: 'rgba(94,106,210,0.65)' }}>
            For classrooms · For the curious
          </p>
          <h2 className="font-display font-bold text-white mb-10" style={{ fontSize: 'clamp(26px, 3vw, 40px)' }}>
            Physics you can hand to a student.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1100px]">
            {[
              {
                title: 'Teach with it',
                desc: 'Every simulation embeds in Canvas, Moodle, Notion, or any webpage with one copied line. Project it, let students drive it, set the daily challenges as homework.',
                accent: '#5e6ad2',
                tag: 'EMBED ANYWHERE',
              },
              {
                title: 'Learn with it',
                desc: 'Guided story journeys walk you from Galileo to Hawking. The built-in AI tutor answers questions about exactly what is on screen — no context switching.',
                accent: '#10b981',
                tag: 'AI-GUIDED',
              },
              {
                title: 'Explore with it',
                desc: 'Multiplayer rooms sync the simulation for everyone in them. Record clips, share exact parameter states by link, control the camera with hand gestures.',
                accent: '#f59e0b',
                tag: 'REAL-TIME · TOGETHER',
              },
            ].map((c) => (
              <div key={c.title} className="p-6 rounded-sm" style={{
                background: 'rgba(17,17,19,0.72)', border: `1px solid ${c.accent}26`,
                backdropFilter: 'blur(10px)',
              }}>
                <div className="font-mono-data text-[10px] tracking-[0.2em] mb-3" style={{ color: c.accent }}>{c.tag}</div>
                <div className="font-display font-bold text-[17px] text-white mb-2">{c.title}</div>
                <p className="font-body text-[13px] leading-relaxed m-0" style={{ color: 'rgba(247,248,248,0.60)' }}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-10">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('umbra-pricing-open'))}
              className="inline-flex items-center gap-2 font-mono-data text-[11px] tracking-[0.14em] uppercase px-6 py-3 rounded cursor-pointer transition-all duration-200"
              style={{ border: '1px solid rgba(94,106,210,0.45)', background: 'rgba(94,106,210,0.07)', color: '#5e6ad2' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(94,106,210,0.14)'
                e.currentTarget.style.borderColor = 'rgba(94,106,210,0.75)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(94,106,210,0.07)'
                e.currentTarget.style.borderColor = 'rgba(94,106,210,0.45)'
              }}
            >
              School & university licensing →
            </button>
            <span className="font-mono-data text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Free for individual learners, forever
            </span>
          </div>
        </section>

        {/* ── Physics intel ticker ── */}
        <div className="shrink-0 overflow-hidden" style={{ borderTop: '1px solid rgba(94,106,210,0.07)', background: 'rgba(0,0,0,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', gap: 10 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.18em', color: '#5e6ad2', flexShrink: 0, opacity: 0.7 }}>
              UMBRA INTEL
            </span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'inline-block', animation: 'umbra-ticker 90s linear infinite', whiteSpace: 'nowrap' }}>
                {[...TICKER_FACTS, ...TICKER_FACTS].map((fact, i) => (
                  <span key={i} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'rgba(94,106,210,0.60)', letterSpacing: '0.01em', marginRight: '4em' }}>
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 px-8 pb-6 pt-2">
          <div className="h-px mb-4" style={{ background: 'rgba(94,106,210,0.06)' }} />
          <p className="font-mono-data text-[10px] tracking-wider" style={{ color: '#8d8d96' }}>
            UMBRA · All visualizations run in your browser — no server, no data sent.
          </p>
        </footer>
      </div>

      {/* Hovered module name overlay */}
      {hoveredModule && (
        <div
          className="absolute bottom-5 right-8 font-mono-data text-[11px] tracking-[0.18em] uppercase pointer-events-none transition-opacity duration-200"
          style={{ zIndex: 20, color: '#8d8d96' }}
        >
          {MODULES.find((m) => m.id === hoveredModule)?.name || 'For Sabrina'}
        </div>
      )}

      <CardPreview moduleId={hoveredModule} cardEl={hoveredCardEl} />
    </div>
  )
}
