import { useState, useEffect, useRef, useCallback } from 'react'
import useModuleStore from '../store/useModuleStore'

// ── Journey definitions ──────────────────────────────────────────────────────
const JOURNEYS = [
  {
    id: 'birth-of-light',
    title: 'Birth of Light',
    subtitle: 'From Maxwell to Photons',
    era: '1865 – 1905',
    difficulty: 'BEGINNER',
    color: '#f59e0b',
    glow: '245,158,11',
    icon: '✦',
    steps: [
      {
        module: 'electromagnetism',
        title: 'Maxwell\'s Unified Field',
        body: 'James Clerk Maxwell wrote four equations that unified electricity and magnetism into a single force. The equations predicted something nobody expected: a self-sustaining wave of oscillating fields that travels at exactly the speed of light.',
        insight: 'Set the source to DIPOLE. Watch how the fields ripple outward in all directions — this is electromagnetic radiation.',
        badge: 'Field Pioneer',
      },
      {
        module: 'optics',
        title: 'Light as a Wave',
        body: 'Maxwell\'s wave turned out to be light itself. When light enters a glass prism at an angle, different wavelengths (colors) bend by different amounts — Snell\'s Law. This is why a prism splits white light into a rainbow.',
        insight: 'Adjust the prism angle to maximum dispersion. The rainbow spread is called angular dispersion — the physics behind every camera lens ever made.',
        badge: 'Spectrum Splitter',
      },
      {
        module: 'wave-mechanics',
        title: 'Interference — Light\'s Fingerprint',
        body: 'Thomas Young shone light through two slits in 1801 and saw bands of light and dark on the wall behind — proof that light was a wave. Where two crests meet, you get bright bands; where a crest meets a trough, they cancel.',
        insight: 'Enable double-slit mode. The bright fringes tell you the wavelength to within nanometers — the same technique we use to analyze distant stars.',
        badge: 'Interference Expert',
      },
      {
        module: 'special-relativity',
        title: 'The Constant Speed Paradox',
        body: 'Einstein asked: if I ride a beam of light, what do I see? Maxwell said light always travels at c. But Newton said velocities add. They can\'t both be right. Einstein chose Maxwell — and rewrote time itself to make it work.',
        insight: 'Push velocity to 0.99c and watch time dilation approach infinity. The muons hitting our atmosphere right now survive the trip only because time slows for them.',
        badge: 'Relativist',
      },
    ],
    completion: {
      title: 'Light Fully Understood',
      body: 'You\'ve traced light from Maxwell\'s field equations through wave interference to the speed-of-light paradox that broke Newtonian physics. This 40-year arc is the most productive in the history of science.',
      xp: 420,
    },
  },
  {
    id: 'quantum-leap',
    title: 'The Quantum Leap',
    subtitle: 'Into the Probabilistic Universe',
    era: '1900 – 1935',
    difficulty: 'INTERMEDIATE',
    color: '#a855f7',
    glow: '168,85,247',
    icon: '◈',
    steps: [
      {
        module: 'wave-mechanics',
        title: 'The Wave-Particle Paradox',
        body: 'An electron fired at a double slit creates an interference pattern — even when fired one at a time. The electron interferes with itself. This is the strangest experiment in physics: matter behaving like a wave.',
        insight: 'Watch the membrane mode. Each ripple is a probability amplitude — the squared height tells you how likely a particle is to land at that point.',
        badge: 'Duality Witness',
      },
      {
        module: 'quantum-mechanics',
        title: 'The Bloch Sphere',
        body: 'A qubit lives on the surface of a sphere. The north pole is |0⟩, the south pole is |1⟩, and anywhere else is a superposition of both — simultaneously. When you measure it, the sphere collapses to a pole. This is the entire logic of quantum computing.',
        insight: 'Drag the state vector to the equator: that\'s a 50/50 superposition, equivalent to a qubit after a Hadamard gate.',
        badge: 'Qubit Wrangler',
      },
      {
        module: 'quantum-mechanics',
        title: 'Tunneling Through Walls',
        body: 'In quantum mechanics a particle\'s "location" is a probability cloud. If that cloud overlaps a barrier, the particle has a real chance of appearing on the other side — without ever passing through. Tunnel diodes, USB flash drives, and the Sun itself depend on this.',
        insight: 'Enable tunneling mode. Narrow the barrier and watch the transmission probability jump. The Sun fuses hydrogen because protons tunnel through the Coulomb barrier.',
        badge: 'Tunnel Engineer',
      },
      {
        module: 'frontier-physics',
        title: 'Quantum Gravity Horizon',
        body: 'General Relativity and Quantum Mechanics are the two most tested theories in history — and they are mathematically incompatible. At the Planck scale (10⁻³⁵ m), spacetime itself should be quantized. String theory, loop quantum gravity, and causal dynamical triangulations are our current best guesses.',
        insight: 'The Schwarzschild radius simulation shows where quantum effects can no longer be ignored. Hawking radiation is our only observational hint of quantum gravity.',
        badge: 'Planck Pioneer',
      },
    ],
    completion: {
      title: 'Quantum Reality Unlocked',
      body: 'From wave-particle duality through superposition and tunneling to the open frontier of quantum gravity — you\'ve walked the path that defines modern physics. The quantum revolution is still unfinished.',
      xp: 520,
    },
  },
  {
    id: 'edge-of-chaos',
    title: 'Edge of Chaos',
    subtitle: 'Order Hidden in Disorder',
    era: '1960 – Present',
    difficulty: 'INTERMEDIATE',
    color: '#22c55e',
    glow: '34,197,94',
    icon: '⬡',
    steps: [
      {
        module: 'dynamical-systems',
        title: 'The Butterfly Effect',
        body: 'In 1961, Edward Lorenz rounded a weather simulation input from 0.506127 to 0.506 and got a completely different forecast. The error of 0.0001% diverged exponentially. Sensitive dependence on initial conditions — the butterfly effect — was born.',
        insight: 'Start two Lorenz attractors with nearly identical initial conditions. Watch them diverge on the same strange attractor — same shape, completely different paths.',
        badge: 'Chaos Cartographer',
      },
      {
        module: 'fluid-dynamics',
        title: 'Turbulence — The Unsolved Problem',
        body: 'Richard Feynman called turbulence "the most important unsolved problem in classical physics." When flow velocity exceeds a critical threshold, laminar flow breaks into eddies, which spawn smaller eddies, all the way to the molecular scale. The Navier-Stokes equations describe it — but nobody can solve them analytically.',
        insight: 'Increase flow speed past the critical Reynolds number. The Kármán vortex street you see is the same pattern that collapsed the Tacoma Narrows Bridge in 1940.',
        badge: 'Flow Analyst',
      },
      {
        module: 'thermodynamics',
        title: 'Entropy — The Arrow of Time',
        body: 'Every physical law is time-symmetric except one: entropy always increases. A cup falls and shatters; it never reassembles. This asymmetry is the only physical law that distinguishes past from future — the true origin of the "arrow of time."',
        insight: 'Watch the Maxwell-Boltzmann distribution evolve. The system always moves toward maximum entropy — the most probable microstate. There are simply more disordered arrangements than ordered ones.',
        badge: 'Entropy Master',
      },
      {
        module: 'acoustic-physics',
        title: 'Chladni\'s Hidden Order',
        body: 'Ernst Chladni drew a bow across a vibrating plate sprinkled with sand in 1787. The sand gathered along the nodal lines — places of no vibration — forming intricate geometric patterns. Order emerging from vibration. The mathematics behind this is identical to quantum mechanical wave functions.',
        insight: 'Sweep through resonant frequencies. Each pattern is an eigenmode — the same mathematics that defines the orbital shapes of electrons in atoms.',
        badge: 'Pattern Revealer',
      },
    ],
    completion: {
      title: 'Chaos Mastered',
      body: 'You\'ve seen the hidden structure in apparent disorder — from Lorenz attractors to turbulence to entropy to standing waves. Chaos isn\'t random; it\'s deterministic unpredictability. The patterns are real, just unreachable by prediction.',
      xp: 490,
    },
  },
  {
    id: 'curved-universe',
    title: 'The Curved Universe',
    subtitle: 'Einstein\'s Geometry of Gravity',
    era: '1905 – 2016',
    difficulty: 'ADVANCED',
    color: '#f97316',
    glow: '249,115,22',
    icon: '◯',
    steps: [
      {
        module: 'special-relativity',
        title: 'Time is Not Universal',
        body: 'Einstein\'s 1905 paper begins with a thought experiment: two lightning strikes hit opposite ends of a moving train simultaneously for a platform observer. For the passenger on the train, they don\'t. Simultaneity is relative. From this single insight, time dilation and length contraction follow mathematically.',
        insight: 'Set velocity to 0.866c — that\'s γ = 2. Your proper time runs at half the rate of the stationary observer. GPS satellites correct for exactly this effect every microsecond.',
        badge: 'Relativist',
      },
      {
        module: 'general-relativity',
        title: 'Gravity as Geometry',
        body: 'In 1915 Einstein extended special relativity to include gravity. His answer: gravity is not a force. It is the curvature of spacetime caused by mass and energy. Objects in free fall (including planets in orbit) are moving in straight lines through curved spacetime — geodesics.',
        insight: 'Place a mass in the spacetime grid and watch geodesics curve. The orbit you see is a straight line through curved 4D geometry, not a circular path under a central force.',
        badge: 'Geometer of Spacetime',
      },
      {
        module: 'general-relativity',
        title: 'Gravitational Waves',
        body: 'When massive objects accelerate, they create ripples in spacetime — gravitational waves. On September 14, 2015, LIGO detected the merger of two black holes 1.3 billion light-years away. The signal stretched and compressed Earth by less than one-thousandth the diameter of a proton.',
        insight: 'Tune the binary mass ratio and orbital frequency. The chirp pattern — frequency increasing as the objects spiral inward — is exactly what LIGO recorded.',
        badge: 'Wave Detector',
      },
      {
        module: 'frontier-physics',
        title: 'Dark Energy and the Accelerating Universe',
        body: 'In 1998, astronomers measuring distant supernovae expected to find the universe\'s expansion slowing due to gravity. Instead they found it accelerating. Something — dark energy — is pushing spacetime apart at an ever-increasing rate. It constitutes 68% of all energy in the universe and we have no idea what it is.',
        insight: 'The Hubble constant simulation shows recession velocity proportional to distance. Beyond the Hubble radius, galaxies recede faster than light — we can never see them.',
        badge: 'Cosmologist',
      },
    ],
    completion: {
      title: 'The Cosmos Understood',
      body: 'From the relativity of time through curved spacetime, gravitational waves, and dark energy — you\'ve walked the arc from Einstein\'s train to the edge of the observable universe. The geometry of gravity is still yielding secrets.',
      xp: 580,
    },
  },
  {
    id: 'thermodynamic-arrow',
    title: 'Fire and Ice',
    subtitle: 'Heat, Work, and the Fate of the Universe',
    era: '1824 – 1900',
    difficulty: 'BEGINNER',
    color: '#ef4444',
    glow: '239,68,68',
    icon: '◊',
    steps: [
      {
        module: 'thermodynamics',
        title: 'The Carnot Engine',
        body: 'Sadi Carnot proved in 1824 that no heat engine can be more efficient than a perfect reversible cycle between two temperatures. The maximum efficiency depends only on the temperatures: η = 1 − T_cold/T_hot. No engineering trick can beat this — it\'s a law of nature.',
        insight: 'Open the PV diagram mode. The Carnot cycle is the rectangle of maximum area for given temperature limits — every deviation shrinks it.',
        badge: 'Thermodynamicist',
      },
      {
        module: 'thermodynamics',
        title: 'Maxwell\'s Demon',
        body: 'Maxwell imagined a demon guarding a tiny door between two gas chambers, letting fast molecules through one way and slow molecules the other — creating a temperature difference without doing work. This would violate the second law. The demon was finally exorcised in 1961: erasing the demon\'s memory costs exactly the entropy it gained.',
        insight: 'Watch the Maxwell-Boltzmann distribution. The demon\'s job is to sort by speed — but sorting information has an irreducible thermodynamic cost: kT·ln(2) per bit erased.',
        badge: 'Demon Slayer',
      },
      {
        module: 'fluid-dynamics',
        title: 'Convection — Heat in Motion',
        body: 'Heat rises. This simple fact drives ocean currents, atmospheric circulation, plate tectonics, and the solar convection zone. Hot fluid is less dense, rises, cools, becomes denser, sinks, reheats — a cycle powered by a temperature gradient.',
        insight: 'Enable the thermal mode. Rayleigh-Bénard convection cells form above a critical heating rate — the same hexagonal pattern seen in solar granulation.',
        badge: 'Convection Expert',
      },
      {
        module: 'acoustic-physics',
        title: 'Sound as Thermodynamic Waves',
        body: 'Sound is a compression wave — air molecules jostling neighbors, each collision transferring kinetic energy forward. The speed of sound is determined by the gas\'s thermodynamic properties: c = √(γRT/M). Temperature is why your voice sounds higher in a helium atmosphere.',
        insight: 'Watch the Lissajous mode. Two frequencies beating against each other show thermoacoustic resonance — the physics behind Stirling engines and acoustic refrigerators.',
        badge: 'Acoustic Thermodynamicist',
      },
    ],
    completion: {
      title: 'Heat Laws Mastered',
      body: 'From Carnot efficiency limits through Maxwell\'s Demon to convection and acoustic waves — you\'ve traced the thermodynamic thread that connects steam engines to the heat death of the universe.',
      xp: 380,
    },
  },
]

const DIFF_COLOR = { BEGINNER: '#22c55e', INTERMEDIATE: '#f59e0b', ADVANCED: '#ef4444' }

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 18 : 6,
          height: 6,
          borderRadius: 3,
          background: i < current ? 'rgba(0,229,196,0.5)' : i === current ? '#00e5c4' : 'rgba(255,255,255,0.12)',
          transition: 'all 0.35s ease',
        }} />
      ))}
    </div>
  )
}

function XPBurst({ xp, color }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 32,
      fontWeight: 700,
      color,
      letterSpacing: '0.06em',
      opacity: show ? 1 : 0,
      transform: show ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(20px)',
      transition: 'all 0.6s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      +{xp} XP
    </div>
  )
}

// Journey selection card
function JourneyCard({ journey, onStart, totalXP }) {
  const [hovered, setHovered] = useState(false)
  const saved = JSON.parse(localStorage.getItem('umbra_story') || '{}')
  const progress = saved[journey.id]
  const done = progress?.completed
  const stepsDone = progress?.step ?? -1

  return (
    <div
      onClick={() => onStart(journey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `rgba(${journey.glow},0.06)`
          : 'rgba(255,255,255,0.018)',
        border: `1px solid rgba(${journey.glow},${hovered ? 0.35 : 0.12})`,
        borderRadius: 8,
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow sweep */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(${journey.glow},0.07) 0%, transparent 70%)`,
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: `rgba(${journey.glow},0.1)`,
          border: `1px solid rgba(${journey.glow},0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: journey.color,
        }}>{journey.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
              color: '#e8f4f0', letterSpacing: '0.03em',
            }}>{journey.title}</span>
            {done && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
                letterSpacing: '0.14em', color: '#00e5c4',
                background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.25)',
                borderRadius: 3, padding: '2px 5px',
              }}>DONE</span>
            )}
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: 'rgba(200,230,220,0.45)', letterSpacing: '0.1em', marginBottom: 8,
          }}>{journey.subtitle} · {journey.era}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 7, letterSpacing: '0.14em',
              color: DIFF_COLOR[journey.difficulty],
              background: `${DIFF_COLOR[journey.difficulty]}18`,
              border: `1px solid ${DIFF_COLOR[journey.difficulty]}40`,
              borderRadius: 3, padding: '2px 6px',
            }}>{journey.difficulty}</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
              color: 'rgba(200,230,220,0.35)', letterSpacing: '0.1em',
            }}>{journey.steps.length} MODULES · {journey.completion.xp} XP</span>
            {stepsDone >= 0 && !done && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                color: journey.color, letterSpacing: '0.1em',
              }}>{stepsDone + 1}/{journey.steps.length} DONE</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div style={{
          color: `rgba(${journey.glow},${hovered ? 0.8 : 0.25})`,
          fontSize: 16, transition: 'all 0.2s',
          transform: hovered ? 'translateX(4px)' : 'none',
        }}>›</div>
      </div>

      {/* Step progress bar */}
      {stepsDone >= 0 && (
        <div style={{ marginTop: 12, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 1,
            background: done ? '#00e5c4' : journey.color,
            width: done ? '100%' : `${((stepsDone + 1) / journey.steps.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}
    </div>
  )
}

// Active journey overlay
function JourneyOverlay({ journey, onClose, onComplete }) {
  const setModule = useModuleStore(s => s.setActiveModule)
  const saved = JSON.parse(localStorage.getItem('umbra_story') || '{}')
  const initStep = saved[journey.id]?.completed ? 'complete' : (saved[journey.id]?.step ?? 0)
  const [step, setStep] = useState(typeof initStep === 'number' ? initStep : 0)
  const [completed, setCompleted] = useState(initStep === 'complete')
  const [xpShown, setXpShown] = useState(false)
  const [badgePop, setBadgePop] = useState(false)
  const current = journey.steps[step]

  // Navigate to the module for this step
  useEffect(() => {
    if (!completed && current) {
      setModule(current.module)
    }
  }, [step, completed, current, setModule])

  // Save progress
  const saveProgress = useCallback((stepIdx, isComplete) => {
    const all = JSON.parse(localStorage.getItem('umbra_story') || '{}')
    all[journey.id] = isComplete ? { completed: true, step: journey.steps.length - 1 } : { step: stepIdx }
    localStorage.setItem('umbra_story', JSON.stringify(all))

    // Update total XP
    const prev = parseInt(localStorage.getItem('umbra_story_xp') || '0', 10)
    if (isComplete && !all[journey.id + '_xp_counted']) {
      localStorage.setItem('umbra_story_xp', String(prev + journey.completion.xp))
      localStorage.setItem('umbra_story_' + journey.id + '_xp_counted', '1')
    }
  }, [journey])

  const handleNext = () => {
    if (step < journey.steps.length - 1) {
      setBadgePop(true)
      setTimeout(() => {
        setBadgePop(false)
        setStep(s => s + 1)
        saveProgress(step + 1, false)
      }, 1200)
    } else {
      setBadgePop(true)
      setTimeout(() => {
        setBadgePop(false)
        setCompleted(true)
        setXpShown(true)
        saveProgress(step, true)
      }, 1200)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10200,
      pointerEvents: 'none',
    }}>
      {/* Main panel — bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 90, left: 20,
        width: 340,
        pointerEvents: 'all',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Badge pop */}
        {badgePop && (
          <div style={{
            marginBottom: 8,
            background: `rgba(${journey.glow},0.12)`,
            border: `1px solid rgba(${journey.glow},0.4)`,
            borderRadius: 6,
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'umbra-slide-up 0.3s ease',
          }}>
            <span style={{ fontSize: 18 }}>🏅</span>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em', color: journey.color }}>BADGE EARNED</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#e8f4f0', marginTop: 1 }}>{current?.badge}</div>
            </div>
          </div>
        )}

        {/* Completion card */}
        {completed ? (
          <div style={{
            background: 'rgba(6,10,16,0.98)',
            border: `1px solid rgba(${journey.glow},0.35)`,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(${journey.glow},0.08)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px 12px',
              background: `linear-gradient(135deg, rgba(${journey.glow},0.12) 0%, transparent 60%)`,
              borderBottom: `1px solid rgba(${journey.glow},0.1)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.18em', color: `rgba(${journey.glow},0.6)`, marginBottom: 3 }}>JOURNEY COMPLETE</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e8f4f0' }}>{journey.completion.title}</div>
              </div>
              <span style={{ fontSize: 22 }}>🎓</span>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(200,230,220,0.7)', lineHeight: 1.7, margin: '0 0 14px' }}>
                {journey.completion.body}
              </p>

              {xpShown && <XPBurst xp={journey.completion.xp} color={journey.color} />}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
                    color: journey.color, background: `rgba(${journey.glow},0.08)`,
                    border: `1px solid rgba(${journey.glow},0.25)`, borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >BACK TO JOURNEYS</button>
              </div>
            </div>
          </div>
        ) : (
          /* Step card */
          <div style={{
            background: 'rgba(6,10,16,0.97)',
            border: `1px solid rgba(${journey.glow},0.22)`,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: `0 16px 50px rgba(0,0,0,0.75), 0 0 30px rgba(${journey.glow},0.06)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}>
            {/* Top bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: `rgba(${journey.glow},0.05)`,
              borderBottom: `1px solid rgba(${journey.glow},0.08)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: journey.color, fontSize: 13 }}>{journey.icon}</span>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, letterSpacing: '0.16em', color: `rgba(${journey.glow},0.5)` }}>
                    {journey.title.toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ProgressDots total={journey.steps.length} current={step} />
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 16, lineHeight: 1, padding: 0 }}
                >×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#e8f4f0', marginBottom: 8, lineHeight: 1.4 }}>
                {current.title}
              </div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: 'rgba(200,230,220,0.7)', lineHeight: 1.75, margin: '0 0 12px' }}>
                {current.body}
              </p>

              {/* Insight box */}
              <div style={{
                background: `rgba(${journey.glow},0.04)`,
                border: `1px solid rgba(${journey.glow},0.15)`,
                borderLeft: `3px solid rgba(${journey.glow},0.5)`,
                borderRadius: '0 4px 4px 0',
                padding: '8px 10px',
                marginBottom: 14,
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, letterSpacing: '0.16em', color: `rgba(${journey.glow},0.5)`, marginBottom: 4 }}>TRY THIS</div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: `rgba(${journey.color.replace('#','')},0.85)`, lineHeight: 1.65, margin: 0 }}>
                  {current.insight}
                </p>
              </div>

              {/* Next / Finish */}
              <button
                onClick={handleNext}
                style={{
                  width: '100%', padding: '9px 0',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em',
                  color: '#04090c', background: journey.color,
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: `0 4px 16px rgba(${journey.glow},0.35)`,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {step < journey.steps.length - 1 ? `NEXT: ${journey.steps[step + 1].title.toUpperCase()}  ›` : 'COMPLETE JOURNEY  ✓'}
              </button>

              {/* Step / badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
                  MODULE {step + 1} / {journey.steps.length}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, color: `rgba(${journey.glow},0.4)`, letterSpacing: '0.1em' }}>
                  BADGE: {current.badge.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main StoryMode component ──────────────────────────────────────────────────
export default function StoryMode() {
  const activeModule = useModuleStore(s => s.activeModule)
  const [open, setOpen] = useState(false)
  const [activeJourney, setActiveJourney] = useState(null)

  // Keyboard shortcut J
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'j' && e.key !== 'J') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (window.__UMBRA_PALETTE_OPEN) return
      if (activeJourney) return
      setOpen(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeJourney])

  const totalXP = parseInt(localStorage.getItem('umbra_story_xp') || '0', 10)

  if (activeJourney) {
    return (
      <JourneyOverlay
        journey={activeJourney}
        onClose={() => { setActiveJourney(null); setOpen(false) }}
        onComplete={() => {}}
      />
    )
  }

  return (
    <>
      {/* JOURNEYS button — only on home screen */}
      {!activeModule && (
        <button
          onClick={() => setOpen(v => !v)}
          title="Story Mode — guided journeys through physics (J)"
          style={{
            position: 'fixed', top: 20, left: 20, zIndex: 10100,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 13px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em',
            color: open ? '#e8f4f0' : 'rgba(200,230,220,0.45)',
            background: open ? 'rgba(0,229,196,0.08)' : 'rgba(4,9,12,0.72)',
            border: `1px solid ${open ? 'rgba(0,229,196,0.3)' : 'rgba(0,229,196,0.12)'}`,
            borderRadius: 5,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 2h9M1 5.5h6M1 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          JOURNEYS
          {totalXP > 0 && (
            <span style={{ color: '#00e5c4', marginLeft: 2 }}>{totalXP} XP</span>
          )}
        </button>
      )}

      {/* Journey selection panel */}
      {open && !activeModule && (
        <div style={{
          position: 'fixed', top: 56, left: 20, zIndex: 10100,
          width: 380,
          background: 'rgba(4,9,12,0.96)',
          border: '1px solid rgba(0,229,196,0.12)',
          borderRadius: 10,
          boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 18px 12px',
            borderBottom: '1px solid rgba(0,229,196,0.07)',
            background: 'rgba(0,229,196,0.02)',
            position: 'sticky', top: 0,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(0,229,196,0.4)', marginBottom: 4 }}>STORY MODE</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#e8f4f0' }}>Guided Journeys</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(0,229,196,0.4)', letterSpacing: '0.12em' }}>TOTAL XP</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#00e5c4' }}>{totalXP}</div>
              </div>
            </div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(200,230,220,0.4)', lineHeight: 1.6, margin: '8px 0 0' }}>
              Five narrative arcs through physics history. Each journey spans 4 modules with guided insights and unlockable badges.
            </p>
          </div>

          {/* Journey list */}
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {JOURNEYS.map(j => (
              <JourneyCard
                key={j.id}
                journey={j}
                totalXP={totalXP}
                onStart={(journey) => {
                  setActiveJourney(journey)
                  setOpen(false)
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(0,229,196,0.07)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            color: 'rgba(200,230,220,0.2)', letterSpacing: '0.12em', textAlign: 'center',
          }}>
            PRESS J TO TOGGLE · PROGRESS AUTO-SAVED
          </div>
        </div>
      )}
    </>
  )
}
