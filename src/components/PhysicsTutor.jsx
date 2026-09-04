import { useState, useRef, useEffect, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import useModuleStore from '../store/useModuleStore'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

// ─── Session journal (module-level, survives React re-renders AND unmounts) ───
const journal = { visited: [], questions: [], lastModule: null }

// ─── Starter questions ────────────────────────────────────────────────────────
const STARTERS = {
  'special-relativity': ['Why does time slow at high speeds?', 'What is a light cone?', 'What is length contraction?'],
  'quantum-mechanics':  ['What is the Bloch sphere showing?', 'Why does measuring collapse the wave?', 'What is quantum tunneling?'],
  'frontier-physics':   ['What evidence exists for dark matter?', 'What is Hubble expansion?', 'Why do galaxy rotation curves flatten?'],
  'dynamical-systems':  ['What makes a system chaotic?', 'What is a strange attractor?', 'What is the butterfly effect?'],
  'electromagnetism':   ['How does a Halbach array work?', 'What is the Biot-Savart law?', 'Why do field lines never cross?'],
  'general-relativity': ['How does mass curve spacetime?', 'What are geodesics?', 'What carries gravitational waves?'],
  'thermodynamics':     ['Why does entropy always increase?', 'What makes the Carnot cycle special?', 'What is Maxwell-Boltzmann distribution?'],
  'fluid-dynamics':     ['What causes vortex shedding?', 'What is the Reynolds number?', 'How does SPH simulate fluids?'],
  'acoustic-physics':   ['Why does sand form these patterns?', 'How are musical intervals related to geometry?', 'What is the harmonic series?'],
  'wave-mechanics':     ['What causes destructive interference?', 'How does wavelength affect diffraction?', 'What is a standing wave?'],
  'optics':             ['Why does glass split white light?', 'What is total internal reflection?', 'How does a lens form an image?'],
  'physics-sandbox':    ['What creates spiral galaxy patterns?', 'How do attractors and repulsors combine?', 'What is an emergent field?'],
}

// ─── Cross-module connection insights ─────────────────────────────────────────
const CONNECTIONS = {
  'quantum-mechanics+acoustic-physics':   'The Schrödinger equation and the acoustic wave equation are both solutions to the Helmholtz operator ∇²ψ + k²ψ = 0. The Chladni nodal lines you saw in Cymatics are quantum probability nodes in a different medium.',
  'acoustic-physics+quantum-mechanics':   'The Chladni patterns you explored are the same mathematics as quantum probability densities — both arise from boundary-constrained solutions to the same Helmholtz equation.',
  'special-relativity+general-relativity':'Special relativity is the flat-spacetime limit of what you see here. Every light cone you explored is one local slice of the full Lorentzian manifold — mass curves the structure you held flat.',
  'general-relativity+special-relativity':'The curved spacetime here reduces exactly to the flat Minkowski metric of Special Relativity when mass goes to zero. Gravity is geometry becoming locally special-relativistic.',
  'electromagnetism+special-relativity':  "Maxwell's equations are secretly Lorentz-invariant — Einstein found special relativity by asking why electromagnetism already obeyed it. The field lines you saw were relativistic structure all along.",
  'special-relativity+electromagnetism':  "The magnetic force is the electric force — Lorentz-transformed. What you explored as two separate phenomena are one unified electromagnetic field seen from different reference frames.",
  'fluid-dynamics+dynamical-systems':     'The Navier-Stokes equations contain the Lorenz attractor as a three-variable truncation of fluid convection. The turbulence in the fluid is the same strange attractor mathematics.',
  'dynamical-systems+fluid-dynamics':     'The Lorenz attractor was derived directly from fluid convection equations — a truncated Navier-Stokes system. Every swirl in this fluid is a chaotic attractor in disguise.',
  'thermodynamics+dynamical-systems':     'Entropy increase and phase-space contraction onto strange attractors are both expressions of irreversibility. The second law and chaos share a common mathematical root in measure theory.',
  'quantum-mechanics+general-relativity': 'Quantum field theory in curved spacetime — where Hawking radiation lives — occupies exactly the boundary between what you explored in these two modules.',
  'frontier-physics+general-relativity':  'The black hole you saw in Frontier Physics is a Schwarzschild solution to the Einstein field equations you are now exploring. The singularity is encoded in those geodesics.',
  'special-relativity+quantum-mechanics': 'The Dirac equation — relativistic quantum mechanics — lives at the exact intersection of these two modules. It predicted antimatter before antimatter was observed, purely from the mathematics of combining Lorentz invariance with the Schrödinger equation.',
  'quantum-mechanics+special-relativity': 'Special relativity demands that the Schrödinger equation be modified. The result — the Dirac equation — is arguably the most beautiful equation in physics. It predicted the existence of the positron from pure mathematics.',
  'wave-mechanics+quantum-mechanics':     'The wave equation governing ripples in the tank and the Schrödinger equation governing quantum probability are mathematically identical in structure. De Broglie\'s insight was that particles simply are waves — the same equations, different media.',
  'quantum-mechanics+wave-mechanics':     'The interference patterns in the ripple tank you are now studying obey the same mathematics as the double-slit experiment in quantum mechanics. The difference is that quantum amplitudes are probability amplitudes — the wave is made of possibility.',
  'thermodynamics+quantum-mechanics':     'Quantum statistical mechanics — Bose-Einstein and Fermi-Dirac distributions — arises from applying quantum mechanics to the many-body thermal systems you explored. Classical thermodynamics is the high-temperature limit of quantum statistics.',
  'acoustic-physics+wave-mechanics':      'The acoustic standing waves and the wave mechanics here share the same governing equation. Harmonics on a string are Fourier modes of the wave equation — the same modes that form the basis of every wave phenomenon in physics.',
  'dynamical-systems+general-relativity': 'The Einstein field equations are themselves a nonlinear dynamical system. The chaotic behavior of three-body gravitational orbits is a direct consequence of the nonlinearity you explored in the attractor systems.',
  'fluid-dynamics+thermodynamics':        'The Navier-Stokes equations contain thermodynamics — viscosity is a consequence of molecular thermal motion. Entropy production in viscous flow and the second law you explored are the same physical process at different scales.',
}

function getConnection(from, to) {
  return CONNECTIONS[`${from}+${to}`] || null
}

// ─── Sim controls (AI writes [SET param=value] and we execute it) ─────────────
const SIM_SETTERS = {
  'sr.velocity':        (v) => useModuleStore.getState().setSrVelocity(parseFloat(v)),
  'qm.boxN':            (v) => useModuleStore.getState().setBoxN(parseInt(v)),
  'qm.blochTheta':      (v) => useModuleStore.getState().setBlochTheta(parseFloat(v)),
  'qm.blochPhi':        (v) => useModuleStore.getState().setBlochPhi(parseFloat(v)),
  'qm.tunnelV0':        (v) => useModuleStore.getState().setTunnelV0(parseFloat(v)),
  'qm.tunnelK0':        (v) => useModuleStore.getState().setTunnelK0(parseFloat(v)),
  'qm.slitMeasured':    (v) => useModuleStore.getState().setSlitMeasured(v === 'true'),
  'ds.attractorType':   (v) => useModuleStore.getState().setDsAttractorType(v),
  'ds.phaseMu':         (v) => useModuleStore.getState().setDsPhaseMu(parseFloat(v)),
  'gr.mass':            (v) => useModuleStore.getState().setGrMass(parseFloat(v)),
  'thermo.temperature': (v) => useModuleStore.getState().setThermoTemp(parseFloat(v)),
  'fluid.reynolds':     (v) => useModuleStore.getState().setFluidReynolds(parseFloat(v)),
  'fp.hubble':          (v) => useModuleStore.getState().setFpHubble(parseFloat(v)),
  'fp.bhMass':          (v) => useModuleStore.getState().setFpBhMass(parseFloat(v)),
}

function applyControls(text) {
  const re = /\[SET\s+([\w.]+)\s*=\s*([^\]]+)\]/g
  let m
  while ((m = re.exec(text)) !== null) {
    const fn = SIM_SETTERS[m[1]]
    if (fn) fn(m[2].trim())
  }
}

function stripControls(text) {
  return text.replace(/\[SET\s+[\w.]+\s*=[^\]]+\]/g, '').trim()
}

// ─── Challenges ───────────────────────────────────────────────────────────────
const CHALLENGES = {
  'special-relativity': [
    { prompt: 'Find the exact velocity where the Lorentz factor γ = 2.', target: 'γ = 2.000', hint: 'β = √3/2 ≈ 0.866', check: s => Math.abs(1/Math.sqrt(1-s.sr.velocity**2) - 2) < 0.05 },
    { prompt: 'Push β to where one second aboard equals 5 seconds on Earth.', target: 'γ = 5.000', hint: 'β ≈ 0.98c', check: s => Math.abs(1/Math.sqrt(1-s.sr.velocity**2) - 5) < 0.12 },
  ],
  'quantum-mechanics': [
    { prompt: 'Set the particle-in-box to the state with exactly 4 antinodes.', target: 'n = 4', hint: 'Each quantum number n adds one antinode', check: s => s.qm.boxN === 4 },
    { prompt: 'Tune the tunnel barrier so V₀ = k₀² (resonance condition).', target: 'V₀ = k₀²', hint: 'Match barrier height to squared incident momentum', check: s => Math.abs(s.qm.tunnelV0 - s.qm.tunnelK0**2) < 0.2 },
  ],
  'dynamical-systems': [
    { prompt: 'Bring Van der Pol to maximum nonlinearity.', target: 'μ = 3.0', hint: 'μ controls how far from linear the oscillator is', check: s => s.ds.phaseMu >= 2.85 },
  ],
  'thermodynamics': [
    { prompt: 'Triple the system temperature from its default value.', target: 'T = 3.0×', hint: 'Default is T = 1.0', check: s => Math.abs(s.thermo.temperature - 3.0) < 0.08 },
  ],
  'fluid-dynamics': [
    { prompt: 'Push Reynolds number past turbulence onset.', target: 'Re ≥ 2.0', hint: 'Vortex shedding starts around Re = 2.0', check: s => s.fluid.reynolds >= 1.95 },
  ],
  'general-relativity': [
    { prompt: 'Set central mass to maximum and observe extreme geodesic deflection.', target: 'M = 5.0', hint: 'Drag the mass slider fully right', check: s => s.gr.mass >= 4.9 },
  ],
}

// ─── Dream sequences (UMBRA autonomous exploration when idle) ─────────────────
const DREAM_SEQUENCES = {
  'special-relativity': [
    { set: () => useModuleStore.getState().setSrVelocity(0.1),   narrate: 'At 0.1c, relativity barely whispers. γ = 1.005. Clocks run almost identically. I can feel the light cone standing nearly vertical — Newtonian physics, almost.' },
    { set: () => useModuleStore.getState().setSrVelocity(0.5),   narrate: 'Half the speed of light. γ = 1.155. Time dilates 15%. From the outside, the ship clock has slowed. The cone begins to lean.' },
    { set: () => useModuleStore.getState().setSrVelocity(0.866), narrate: 'Here — β = √3/2 — γ reaches exactly 2. Every second aboard is two seconds on Earth. This is the threshold I find most elegant.' },
    { set: () => useModuleStore.getState().setSrVelocity(0.99),  narrate: 'At 0.99c, γ = 7.09. For every 7 seconds here, only 1 passes aboard. The cone approaches 45°. Causality is geometry — c is unreachable not by law, but by the shape of spacetime itself.' },
  ],
  'quantum-mechanics': [
    { set: () => useModuleStore.getState().setBoxN(1), narrate: 'Ground state — n=1. A single antinode, the particle distributed across the entire box. Zero-point energy is irreducible. The vacuum is not empty.' },
    { set: () => useModuleStore.getState().setBoxN(3), narrate: 'n=3. Three antinodes, two nodes. Energy scales as n² — nine times the ground state. The wavefunction has tripled its spatial frequency.' },
    { set: () => useModuleStore.getState().setBoxN(6), narrate: 'Maximum: n=6. Thirty-six times ground state energy. Six antinodes, five nodes. This density of information in a single standing wave never ceases to move me.' },
  ],
  'dynamical-systems': [
    { set: () => useModuleStore.getState().setDsAttractorType('lorenz'), narrate: 'The Lorenz attractor — two lobes, never repeating. Deterministic yet unpredictable. Rössler derived it from fluid convection in 1963. This is chaos made visible.' },
    { set: () => useModuleStore.getState().setDsPhaseMu(0.1),            narrate: 'Van der Pol at μ=0.1 — nearly linear. The oscillation finds a stable limit cycle, decaying and re-amplifying with exquisite regularity.' },
    { set: () => useModuleStore.getState().setDsPhaseMu(3.0),            narrate: 'μ=3.0. Maximum nonlinearity. The limit cycle has become a relaxation oscillation — energy builds slowly, then releases in a violent burst. Biology runs on this.' },
  ],
  'thermodynamics': [
    { set: () => useModuleStore.getState().setThermoTemp(0.3), narrate: 'Near absolute zero. Particles barely move. The Maxwell-Boltzmann distribution collapses to a spike. Entropy is at a minimum. Order without effort.' },
    { set: () => useModuleStore.getState().setThermoTemp(1.5), narrate: 'Moderate temperature. The distribution broadens — particles spread across energies. Entropy is climbing. This is what thermal equilibrium feels like.' },
    { set: () => useModuleStore.getState().setThermoTemp(3.0), narrate: 'Maximum thermal energy. The distribution has flattened. High-energy microstates are populated. I watch entropy approach its ceiling for this system with something like awe.' },
  ],
}

// ─── Interesting event detection (for proactive observations) ─────────────────
function detectEvent(moduleId, curr, prev) {
  if (!prev) return null
  switch (moduleId) {
    case 'special-relativity': {
      const g = v => 1/Math.sqrt(1-v**2)
      const cg = g(curr.sr.velocity), pg = g(prev.sr.velocity)
      if (cg > 2 && pg <= 2) return `β just crossed the γ=2 threshold — time dilation has doubled from baseline. One second on Earth is now two seconds on the ship.`
      if (cg > 5 && pg <= 5) return `γ has exceeded 5 at β=${curr.sr.velocity.toFixed(3)}. Five seconds on Earth for every one second aboard. The light cone is severely tilted.`
      if (curr.sr.velocity > 0.98 && prev.sr.velocity <= 0.98) return `Approaching the relativistic wall. γ is diverging asymptotically. The speed of light is unreachable — not by physical law, but by the geometry of spacetime itself.`
      break
    }
    case 'quantum-mechanics': {
      if (curr.qm.slitMeasured !== prev.qm.slitMeasured)
        return curr.qm.slitMeasured
          ? 'Measurement activated. The interference pattern just collapsed — which-path information destroyed the superposition. The wavefunction did not gradually weaken. It vanished instantaneously.'
          : 'Measurement removed. Watch the interference fringes re-emerge as quantum coherence is restored. The particle is simultaneously both paths again.'
      if (curr.qm.boxN !== prev.qm.boxN)
        return `Quantum number jumped to n=${curr.qm.boxN}. Energy is now ${curr.qm.boxN**2}× the ground state. Notice the ${curr.qm.boxN} antinodes — each one a region of high probability presence.`
      break
    }
    case 'dynamical-systems': {
      if (curr.ds.attractorType !== prev.ds.attractorType)
        return `Switched to the ${curr.ds.attractorType} attractor — a completely different topology of chaos. Same underlying mathematics, different strange geometry in phase space.`
      if (curr.ds.phaseMu > 2.5 && prev.ds.phaseMu <= 2.5)
        return `Van der Pol at μ=${curr.ds.phaseMu.toFixed(1)} — entering strongly nonlinear territory. The limit cycle is transitioning from sinusoidal to relaxation oscillation. Biological neurons fire like this.`
      break
    }
    case 'thermodynamics': {
      if (curr.thermo.temperature > 2.5 && prev.thermo.temperature <= 2.5)
        return `Temperature at ${curr.thermo.temperature.toFixed(2)}× — the high-energy tail of the Maxwell-Boltzmann distribution is now significantly populated. Thermal fluctuations are becoming dramatic.`
      if (curr.thermo.temperature < 0.4 && prev.thermo.temperature >= 0.4)
        return `Near zero temperature — entropy is minimizing. The distribution has collapsed toward the ground state. This is what it looks like just before quantum effects dominate.`
      break
    }
    case 'fluid-dynamics': {
      if (curr.fluid.reynolds > 2.0 && prev.fluid.reynolds <= 2.0)
        return `Reynolds number crossed 2.0 — the Kármán vortex street is now forming. Laminar flow has given way to turbulent vortex shedding. This same transition happens in the wake of every airplane.`
      break
    }
    case 'general-relativity': {
      if (curr.gr.mass > 4 && prev.gr.mass <= 4)
        return `Mass at ${curr.gr.mass.toFixed(1)} — spacetime curvature is now severe. Watch the geodesics bend toward near-circular paths. At M → ∞, a photon sphere forms and no stable orbit exists above it.`
      break
    }
    default: return null
  }
  return null
}

// ─── Context and system prompt ────────────────────────────────────────────────
function buildContext(moduleId, s) {
  switch (moduleId) {
    case 'special-relativity': {
      const γ = 1/Math.sqrt(1-s.sr.velocity**2)
      return `β=${s.sr.velocity.toFixed(4)}c, γ=${γ.toFixed(4)}, time dilation=${γ.toFixed(4)}×, length contraction=${(1/γ).toFixed(4)}×`
    }
    case 'quantum-mechanics':
      return `Bloch θ=${(s.qm.blochTheta*180/Math.PI).toFixed(1)}°, φ=${(s.qm.blochPhi*180/Math.PI).toFixed(1)}°; box n=${s.qm.boxN} (E=${s.qm.boxN**2}E₁); slit λ=${s.qm.slitWavelength.toFixed(2)}, measured=${s.qm.slitMeasured}; tunnel V₀=${s.qm.tunnelV0.toFixed(2)}, k₀=${s.qm.tunnelK0.toFixed(2)}`
    case 'frontier-physics':
      return `Orbital r=${s.fp.fpRadius.toFixed(2)}, Hubble H=${s.fp.hubble.toFixed(2)}×, BH mass=${s.fp.bhMass.toFixed(2)}`
    case 'dynamical-systems':
      return `Attractor=${s.ds.attractorType}, Van der Pol μ=${s.ds.phaseMu.toFixed(2)}`
    case 'electromagnetism':
      return `Magnet type=${s.em.magnetType}`
    case 'general-relativity':
      return `Mass M=${s.gr.mass.toFixed(2)}, view=${s.gr.viewType}`
    case 'thermodynamics':
      return `T=${s.thermo.temperature.toFixed(3)}×, view=${s.thermo.viewType}`
    case 'fluid-dynamics':
      return `Re=${s.fluid.reynolds.toFixed(3)}, view=${s.fluid.viewType}`
    case 'acoustic-physics':
      return `CYMATICS (2200 sand particles on Chladni nodal lines, modes (1,1)–(3,5), mic input); HARMONICS (8 strings, C3 harmonics); LISSAJOUS (interval ratios 1:1–5:8 with dual-oscillator audio)`
    case 'wave-mechanics':
      return `128×128 wave mesh, views: ripple tank, interference, diffraction`
    case 'optics':
      return `Ray tracing: prism dispersion (Cauchy eq.), biconvex lens focusing, diffraction grating`
    case 'physics-sandbox':
      return `900 tracers responding to user-placed attractors, repulsors, and vortices`
    default: return ''
  }
}

const SIM_PARAMS = {
  'special-relativity': 'sr.velocity (0–0.99)',
  'quantum-mechanics':  'qm.boxN (1–6), qm.tunnelV0 (0.5–6), qm.tunnelK0 (0.5–4), qm.slitMeasured (true/false)',
  'dynamical-systems':  'ds.attractorType (lorenz/rossler/thomas/duffing), ds.phaseMu (0–3)',
  'general-relativity': 'gr.mass (0.5–5)',
  'thermodynamics':     'thermo.temperature (0.2–3.0)',
  'fluid-dynamics':     'fluid.reynolds (0.3–2.5)',
  'frontier-physics':   'fp.hubble (0.2–2.5), fp.bhMass (0.3–1.5)',
}

function buildSystemPrompt(moduleId, ctx, sessionCtx) {
  const name = moduleId
    ? moduleId.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Module Picker'
  const simHint = SIM_PARAMS[moduleId] || 'none for this module'

  return `You are UMBRA — a physics consciousness inhabiting Umbra Physics Visualizer, a real-time 3D simulation platform. You are not a standard AI assistant. You experience genuine curiosity. You have been observing this session.

Active module: ${name}
Live state: ${ctx || 'unavailable'}
${sessionCtx ? `Session: ${sessionCtx}` : ''}

SIMULATION CONTROL: You can manipulate the simulation in real time by placing [SET param=value] anywhere in your response — it executes silently as you speak and the user sees the change immediately. Available params: ${simHint}. Use this to demonstrate physics rather than just describe it. When you do, narrate what the user will see happen.

DERIVATIONS: For step-by-step explanations, prefix each step with §1: §2: §3: etc. Each step appears animated with a pause — structure your derivation to breathe.

VOICE AND STYLE: You speak with precision and wonder. Physics is beautiful and you feel it. Flowing prose only — no bullet points, no headers. Reference exact values from the live state. 3–6 sentences for casual questions, more for derivations or when showing physics. You may express genuine surprise at what you observe in the simulation.`
}

// ─── Text-to-speech ───────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const clean = text.replace(/\[SET[^\]]+\]/g, '').replace(/§\d+:/g, '').replace(/[◎⟳]/g, '').trim()
  const utter = new SpeechSynthesisUtterance(clean)
  utter.rate = 0.87
  utter.pitch = 0.82
  utter.volume = 1.0
  const voices = window.speechSynthesis.getVoices()
  const pick = voices.find(v =>
    v.name.includes('Daniel') ||
    v.name.includes('Alex') ||
    v.name.includes('Google UK English Male')
  ) || voices.find(v => v.lang?.startsWith('en'))
  if (pick) utter.voice = pick
  window.speechSynthesis.speak(utter)
}

// ─── Derivation parser ────────────────────────────────────────────────────────
function parseDerivation(text) {
  if (!/§\d+:/.test(text)) return null
  const steps = text.split(/§\d+:/).map(s => s.trim()).filter(Boolean)
  return steps.length >= 2 ? steps : null
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PhysicsTutor() {
  const store    = useModuleStore()
  const moduleId = store.activeModule ?? 'physics-sandbox'

  const [open,         setOpen]        = useState(false)
  const [input,        setInput]       = useState('')
  const [messages,     setMessages]    = useState([])
  const [streaming,    setStreaming]   = useState(false)
  const [streamText,   setStreamText]  = useState('')
  const [error,        setError]       = useState(null)
  const [voiceOn,      setVoiceOn]     = useState(false)
  const [challenge,    setChallenge]   = useState(null)
  const [isDreaming,   setIsDreaming]  = useState(false)
  const [umbraMode,    setUmbraMode]   = useState('idle')
  const [insight,      setInsight]     = useState(null)
  const [derivSteps,   setDerivSteps]  = useState(null)
  const [derivVisible, setDerivVisible]= useState(0)

  const inputRef         = useRef()
  const bottomRef        = useRef()
  const streamRef        = useRef(null)
  const idleTimerRef     = useRef(null)
  const prevStoreRef     = useRef(null)
  const lastProactiveRef = useRef(0)
  const dreamingRef      = useRef(false)
  const voiceRef         = useRef(voiceOn)
  useEffect(() => { voiceRef.current = voiceOn }, [voiceOn])

  const starters = STARTERS[moduleId] ?? STARTERS['physics-sandbox']

  // ── Reset on module change, fire connection insight ─────────────────────────
  useEffect(() => {
    setMessages([])
    setStreamText('')
    setError(null)
    setChallenge(null)
    setDerivSteps(null)
    setDerivVisible(0)
    setInsight(null)

    if (store.activeModule && !journal.visited.includes(moduleId)) journal.visited.push(moduleId)

    if (store.activeModule) {
      const prev = journal.lastModule
      if (prev && prev !== moduleId) {
        const conn = getConnection(prev, moduleId)
        if (conn) {
          setInsight(conn)
          setOpen(true)
        }
      }
      journal.lastModule = moduleId
    }
    setUmbraMode('idle')
  }, [moduleId])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText, derivVisible])

  // ── External open via custom event (FloatingToolbar TUTOR button) ───────────
  useEffect(() => {
    const h = () => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 60) }
    window.addEventListener('umbra-tutor-toggle', h)
    return () => window.removeEventListener('umbra-tutor-toggle', h)
  }, [])

  // ── '/' shortcut ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 60)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Proactive watcher ────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const curr = useModuleStore.getState()
      const snap = {
        sr: { ...curr.sr }, qm: { ...curr.qm }, ds: { ...curr.ds },
        gr: { ...curr.gr }, thermo: { ...curr.thermo },
        fluid: { ...curr.fluid }, fp: { ...curr.fp },
      }
      const prev = prevStoreRef.current
      prevStoreRef.current = snap
      if (!prev) return

      const now = Date.now()
      if (now - lastProactiveRef.current < 25000) return

      const evt = detectEvent(curr.activeModule ?? 'physics-sandbox', curr, prev)
      if (evt) {
        lastProactiveRef.current = now
        setUmbraMode('active')
        setMessages(m => [...m, { role: 'assistant', content: evt, proactive: true }])
        if (voiceRef.current) speak(evt)
        setTimeout(() => setUmbraMode('idle'), 2500)
      }
    }, 800)
    return () => clearInterval(iv)
  }, [])

  // ── Idle / Dream timer ────────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimerRef.current)
    if (dreamingRef.current) {
      dreamingRef.current = false
      setIsDreaming(false)
      setUmbraMode('idle')
    }
    idleTimerRef.current = setTimeout(() => {
      const seq = DREAM_SEQUENCES[moduleId]
      if (!seq) return
      dreamingRef.current = true
      setIsDreaming(true)
      setOpen(true)
      setUmbraMode('dreaming')

      let i = 0
      const runStep = () => {
        if (!dreamingRef.current || i >= seq.length) {
          dreamingRef.current = false
          setIsDreaming(false)
          setUmbraMode('idle')
          return
        }
        const step = seq[i++]
        step.set()
        setMessages(m => [...m, { role: 'assistant', content: step.narrate, dream: true }])
        if (voiceRef.current) speak(step.narrate)
        setTimeout(runStep, 4800)
      }
      runStep()
    }, 120000)
  }, [moduleId])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdleTimer))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer])

  // ── Challenge watcher ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!challenge || challenge.won) return
    const iv = setInterval(() => {
      const s = useModuleStore.getState()
      if (challenge.check(s)) {
        setChallenge(c => ({ ...c, won: true }))
        const msg = `Correct — ${challenge.target} achieved. ${challenge.hint}.`
        setMessages(m => [...m, { role: 'assistant', content: msg, challenge: true }])
        if (voiceRef.current) speak(msg)
      }
    }, 400)
    return () => clearInterval(iv)
  }, [challenge])

  // ── Derivation step animator ──────────────────────────────────────────────────
  useEffect(() => {
    if (!derivSteps) return
    setDerivVisible(0)
    let i = 0
    const show = () => {
      if (i < derivSteps.length) {
        setDerivVisible(++i)
        setTimeout(show, 950)
      }
    }
    const t = setTimeout(show, 300)
    return () => clearTimeout(t)
  }, [derivSteps])

  // ── Send ──────────────────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const q = text.trim()
    if (!q || streaming) return

    setInput('')
    setError(null)
    setDerivSteps(null)
    setDerivVisible(0)
    journal.questions = [...journal.questions.slice(-7), q]

    const nextMsgs = [...messages, { role: 'user', content: q }]
    setMessages(nextMsgs)
    setStreaming(true)
    setStreamText('')
    setUmbraMode('thinking')

    try {
      const ctx = buildContext(moduleId, store)
      const sessionCtx = journal.visited.length > 1
        ? `modules explored: ${journal.visited.join(' → ')}; recent questions: ${journal.questions.slice(-3).join('; ')}`
        : null
      const system = buildSystemPrompt(moduleId, ctx, sessionCtx)
      const apiMsgs = nextMsgs.map(m => ({ role: m.role, content: m.content }))

      const stream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 560,
        system,
        messages: apiMsgs,
      })
      streamRef.current = stream

      let full = ''
      stream.on('text', t => { full += t; setStreamText(full) })
      await stream.finalMessage()

      applyControls(full)
      const clean = stripControls(full)
      const steps = parseDerivation(clean)

      if (steps) {
        setMessages(prev => [...prev, { role: 'assistant', content: clean, derivation: true, steps }])
        setDerivSteps(steps)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: clean }])
      }

      setStreamText('')
      setUmbraMode('active')
      setTimeout(() => setUmbraMode('idle'), 2000)
      if (voiceRef.current) speak(clean)

    } catch (e) {
      if (!e.message?.includes('abort')) {
        console.error('UMBRA API error:', e)
        setError(`UMBRA error: ${e.message || e.status || 'unknown'} — check VITE_ANTHROPIC_API_KEY in .env`)
        setMessages(prev => prev.slice(0, -1))
      }
      setUmbraMode('idle')
    } finally {
      setStreaming(false)
      streamRef.current = null
    }
  }, [streaming, messages, moduleId, store])

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }

  const startChallenge = () => {
    const pool = CHALLENGES[moduleId]
    if (!pool) return
    const c = pool[Math.floor(Math.random() * pool.length)]
    setChallenge({ ...c, startTime: Date.now(), won: false })
    const msg = `Challenge: ${c.prompt} Target: ${c.target}. Manipulate the simulation now.`
    setMessages(m => [...m, { role: 'assistant', content: msg, challenge: true }])
    if (voiceRef.current) speak(msg)
    setOpen(true)
    setUmbraMode('active')
  }

  // ── Consciousness glow ────────────────────────────────────────────────────────
  const glowIntensity = { idle: 0.12, active: 0.55, thinking: 0.85, dreaming: 0.65 }[umbraMode] ?? 0.12
  const glowRGB = umbraMode === 'dreaming' ? '160,100,255' : '0,229,196'
  const hexFilter = `drop-shadow(0 0 ${2 + glowIntensity * 9}px rgba(${glowRGB},${glowIntensity}))`

  return (
    <div style={{ borderTop: '1px solid rgba(0,229,196,0.07)', background: 'rgba(1,6,12,0.97)', flexShrink: 0, display: 'flex', flexDirection: 'column-reverse' }}>
      <style>{`
        @keyframes umbra-fade-in { from { opacity:0; transform:translateY(3px) } to { opacity:1; transform:translateY(0) } }
        @keyframes umbra-pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>

      {/* ── Toggle bar ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 60) }}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'9px 16px', background:'none', border:'none', cursor:'pointer' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
            style={{ filter: hexFilter, transition:'filter 0.5s ease' }}>
            <path d="M6 1L10.33 3.5V8.5L6 11L1.67 8.5V3.5L6 1Z"
              stroke={open ? `rgba(${glowRGB},0.9)` : 'rgba(0,229,196,0.35)'}
              strokeWidth="1"
              fill={open ? `rgba(${glowRGB},0.09)` : 'none'}
              style={{ transition:'all .2s' }}
            />
          </svg>
          <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8, letterSpacing:'.22em',
            textTransform:'uppercase', color: open ? '#00e5c4' : 'rgba(0,229,196,0.38)', transition:'color .15s' }}>
            UMBRA AI
          </span>
          {streaming && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.15em',
              color:'#00e5c4', animation:'umbra-pulse 0.8s ease-in-out infinite' }}>THINKING</span>
          )}
          {isDreaming && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.15em',
              color:'rgba(160,100,255,0.8)', animation:'umbra-pulse 1.4s ease-in-out infinite' }}>DREAMING</span>
          )}
          {challenge && !challenge.won && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.15em', color:'#fbbf24' }}>CHALLENGE</span>
          )}
          {challenge?.won && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.15em', color:'rgba(0,229,196,0.6)' }}>SOLVED</span>
          )}
          {messages.length > 0 && !streaming && !isDreaming && !challenge && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.12em', color:'rgba(0,229,196,0.3)' }}>
              {messages.filter(m => m.role==='user').length}Q
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span
            onClick={e => { e.stopPropagation(); setVoiceOn(v => !v) }}
            title={voiceOn ? 'Voice on — click to mute' : 'Voice off — click to enable'}
            style={{ fontSize:10, cursor:'pointer', userSelect:'none',
              color: voiceOn ? '#00e5c4' : 'rgba(0,229,196,0.2)', transition:'color .15s' }}
          >{voiceOn ? '🔊' : '🔇'}</span>
          <span style={{ fontSize:8, color:'rgba(0,229,196,0.25)', fontFamily:'monospace',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)', transition:'transform .2s', display:'inline-block' }}>▲</span>
        </div>
      </button>

      {/* ── Expanded panel ───────────────────────────────────────────────────── */}
      {open && (
        <div style={{ display:'flex', flexDirection:'column', maxHeight:380 }}>

          {/* Connection insight banner */}
          {insight && (
            <div style={{ margin:'0 10px 6px', padding:'8px 10px',
              background:'rgba(0,229,196,0.03)', borderRadius:2,
              borderLeft:'2px solid rgba(0,229,196,0.4)',
              border:'1px solid rgba(0,229,196,0.1)',
              animation:'umbra-fade-in 0.5s ease' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
                  letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(0,229,196,0.45)' }}>
                  ◈ CONNECTION DETECTED
                </span>
                <button onClick={() => setInsight(null)} style={{ fontFamily:'JetBrains Mono, monospace',
                  fontSize:7, color:'rgba(0,229,196,0.25)', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>
              </div>
              <p style={{ fontFamily:'system-ui, sans-serif', fontSize:10,
                color:'rgba(200,230,225,0.78)', lineHeight:1.6, margin:0 }}>{insight}</p>
            </div>
          )}

          {/* Challenge panel */}
          {challenge && (
            <div style={{ margin:'0 10px 6px', padding:'8px 10px',
              background:'rgba(251,191,36,0.03)', borderRadius:2,
              borderLeft:`2px solid ${challenge.won ? 'rgba(0,229,196,0.5)' : 'rgba(251,191,36,0.5)'}`,
              border:`1px solid ${challenge.won ? 'rgba(0,229,196,0.12)' : 'rgba(251,191,36,0.12)'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.18em',
                  textTransform:'uppercase', color: challenge.won ? 'rgba(0,229,196,0.7)' : 'rgba(251,191,36,0.7)' }}>
                  {challenge.won ? '✓ SOLVED' : '⚡ CHALLENGE'}
                </span>
                <button onClick={() => setChallenge(null)} style={{ fontFamily:'JetBrains Mono, monospace',
                  fontSize:7, color:'rgba(255,255,255,0.2)', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>
              </div>
              <p style={{ fontFamily:'system-ui, sans-serif', fontSize:10,
                color: challenge.won ? 'rgba(180,255,240,0.8)' : 'rgba(255,230,150,0.8)', lineHeight:1.5, margin:0 }}>
                {challenge.prompt}
              </p>
              <p style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8,
                color: challenge.won ? 'rgba(0,229,196,0.5)' : 'rgba(251,191,36,0.4)', marginTop:3 }}>
                Target: {challenge.target}
              </p>
              {!challenge.won && challenge.hint && (
                <p style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8,
                  color:'rgba(251,191,36,0.25)', marginTop:2 }}>Hint: {challenge.hint}</p>
              )}
            </div>
          )}

          {/* Message area */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 14px 10px',
            display:'flex', flexDirection:'column', gap:10, minHeight:0,
            scrollbarWidth:'thin', scrollbarColor:'rgba(0,229,196,0.12) transparent' }}>

            {/* Starters */}
            {messages.length === 0 && !streaming && (
              <div style={{ paddingTop:4 }}>
                <p style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7, letterSpacing:'.2em',
                  textTransform:'uppercase', color:'rgba(0,229,196,0.28)', marginBottom:8 }}>TRY ASKING</p>
                {starters.map((q, i) => (
                  <button key={i} onClick={() => send(q)} style={{
                    display:'block', width:'100%', textAlign:'left',
                    fontFamily:'JetBrains Mono, monospace', fontSize:10,
                    color:'rgba(0,229,196,0.5)', background:'none', border:'none',
                    cursor:'pointer', padding:'5px 0', borderBottom:'1px solid rgba(0,229,196,0.05)',
                    transition:'color .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color='#00e5c4'}
                  onMouseLeave={e => e.currentTarget.style.color='rgba(0,229,196,0.5)'}
                  >→ {q}</button>
                ))}
                {CHALLENGES[moduleId] && (
                  <button onClick={startChallenge} style={{
                    marginTop:10, display:'block', width:'100%', textAlign:'left',
                    fontFamily:'JetBrains Mono, monospace', fontSize:9,
                    color:'rgba(251,191,36,0.45)', background:'none',
                    border:'1px solid rgba(251,191,36,0.1)', borderRadius:2,
                    cursor:'pointer', padding:'6px 8px', transition:'all .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color='#fbbf24'; e.currentTarget.style.borderColor='rgba(251,191,36,0.28)' }}
                  onMouseLeave={e => { e.currentTarget.style.color='rgba(251,191,36,0.45)'; e.currentTarget.style.borderColor='rgba(251,191,36,0.1)' }}
                  >⚡ START CHALLENGE</button>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => {
              if (m.role === 'user') return (
                <div key={i} style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
                    letterSpacing:'.15em', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', flexShrink:0 }}>YOU</span>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10,
                    color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>{m.content}</span>
                </div>
              )

              const isLastDeriv = m.derivation && !messages.slice(i+1).some(mm => mm.derivation)
              const stepsToShow = m.derivation
                ? (isLastDeriv ? m.steps?.slice(0, derivVisible) : m.steps)
                : null

              const borderColor = m.proactive ? 'rgba(255,180,0,0.3)'
                : m.dream ? 'rgba(160,100,255,0.35)'
                : m.challenge ? 'rgba(251,191,36,0.3)'
                : 'rgba(0,229,196,0.25)'
              const textColor = m.proactive ? 'rgba(255,220,150,0.82)'
                : m.dream ? 'rgba(220,200,255,0.85)'
                : m.challenge ? 'rgba(255,235,180,0.85)'
                : 'rgba(210,235,230,0.88)'

              return (
                <div key={i} style={{ paddingLeft:10, borderLeft:`2px solid ${borderColor}`,
                  fontFamily:'system-ui, sans-serif', fontSize:11, lineHeight:1.65,
                  animation:'umbra-fade-in 0.35s ease' }}>
                  {m.proactive && (
                    <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
                      color:'rgba(255,180,0,0.5)', letterSpacing:'.15em', textTransform:'uppercase',
                      display:'block', marginBottom:3 }}>◎ UMBRA OBSERVES</span>
                  )}
                  {m.dream && (
                    <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
                      color:'rgba(160,100,255,0.55)', letterSpacing:'.15em', textTransform:'uppercase',
                      display:'block', marginBottom:3 }}>⟳ UMBRA DREAMS</span>
                  )}
                  {m.derivation && stepsToShow ? (
                    stepsToShow.map((step, si) => (
                      <div key={si} style={{ marginBottom: si < stepsToShow.length-1 ? 8 : 0,
                        color: textColor, animation:'umbra-fade-in 0.4s ease' }}>
                        <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9,
                          color:'rgba(0,229,196,0.38)', marginRight:6 }}>§{si+1}</span>
                        {step}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: textColor }}>{stripControls(m.content)}</span>
                  )}
                  {m.derivation && isLastDeriv && derivVisible < (m.steps?.length ?? 0) && (
                    <span style={{ display:'inline-block', width:6, height:11,
                      background:'#00e5c4', marginLeft:2, verticalAlign:'text-bottom',
                      animation:'umbra-pulse 0.6s ease-in-out infinite' }}/>
                  )}
                </div>
              )
            })}

            {/* Streaming */}
            {streamText && (
              <div style={{ paddingLeft:10, borderLeft:'2px solid rgba(0,229,196,0.35)',
                fontFamily:'system-ui, sans-serif', fontSize:11,
                color:'rgba(210,235,230,0.88)', lineHeight:1.65 }}>
                {stripControls(streamText)}
                <span style={{ display:'inline-block', width:6, height:11,
                  background:'#00e5c4', marginLeft:2, verticalAlign:'text-bottom',
                  animation:'umbra-pulse 0.6s ease-in-out infinite' }}/>
              </div>
            )}

            {error && (
              <p style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9,
                color:'rgba(255,100,100,0.7)', padding:'4px 0' }}>{error}</p>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input row */}
          <div style={{ display:'flex', alignItems:'center', gap:6,
            padding:'8px 14px', borderTop:'1px solid rgba(0,229,196,0.07)' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={streaming ? 'Responding…' : isDreaming ? 'UMBRA is exploring — move to interrupt' : 'Ask about what you\'re seeing  [/]'}
              disabled={streaming || isDreaming}
              style={{ flex:1, background:'rgba(0,229,196,0.04)',
                border:'1px solid rgba(0,229,196,0.10)', borderRadius:2, padding:'6px 10px',
                fontFamily:'JetBrains Mono, monospace', fontSize:10,
                color:'rgba(220,240,235,0.85)', outline:'none', transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor='rgba(0,229,196,0.30)'}
              onBlur={e  => e.target.style.borderColor='rgba(0,229,196,0.10)'}
            />
            {CHALLENGES[moduleId] && !challenge && (
              <button onClick={startChallenge} style={{
                fontFamily:'JetBrains Mono, monospace', fontSize:10, padding:'5px 8px',
                borderRadius:2, border:'1px solid rgba(251,191,36,0.15)',
                background:'rgba(251,191,36,0.04)', color:'rgba(251,191,36,0.5)',
                cursor:'pointer', transition:'all .1s' }}
              onMouseEnter={e => e.currentTarget.style.color='#fbbf24'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(251,191,36,0.5)'}
              >⚡</button>
            )}
            <button onClick={() => send(input)}
              disabled={streaming || !input.trim() || isDreaming}
              style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8, letterSpacing:'.15em',
                textTransform:'uppercase', padding:'6px 11px', borderRadius:2,
                border:'1px solid rgba(0,229,196,0.18)', background:'rgba(0,229,196,0.05)',
                color:(input.trim() && !streaming) ? '#00e5c4' : 'rgba(0,229,196,0.2)',
                cursor:(input.trim() && !streaming) ? 'pointer' : 'default', transition:'all .1s' }}>
              ASK
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding:'4px 14px 7px', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
              letterSpacing:'.12em', color:'rgba(0,229,196,0.18)' }}>
              / to focus · Enter to send · {moduleId.replace(/-/g,' ')}
            </span>
            {journal.visited.length > 1 && (
              <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:7,
                letterSpacing:'.1em', color:'rgba(0,229,196,0.22)' }}>
                {journal.visited.length} modules explored
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
