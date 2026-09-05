import { useState, useEffect, useRef, useCallback } from 'react'
import katex from 'katex'
import useModuleStore from '../store/useModuleStore'

// Inline/block KaTeX — same config as InfoPanel
function Katex({ tex, block = false }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: true, strict: false })
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

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
        figure: 'James Clerk Maxwell · 1865',
        body: 'James Clerk Maxwell wrote four equations that unified electricity and magnetism into a single force. The equations predicted something nobody expected: a self-sustaining wave of oscillating fields that travels at exactly the speed of light.',
        equation: 'c = \\frac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}',
        deeper: 'The speed falls out of two lab-measured constants — the permeability μ₀ and permittivity ε₀ of empty space — that have nothing to do with astronomy. That a wave of pure field must travel at light\'s measured speed was the clue that light IS an electromagnetic wave.',
        insight: 'Set the source to DIPOLE. Watch how the fields ripple outward in all directions — this is electromagnetic radiation.',
        quiz: {
          q: 'Why was it shocking that c appears in Maxwell\'s equations?',
          options: [
            'It emerges from electric/magnetic constants alone, with no reference to light',
            'The equations were solved on a computer',
            'It proved light travels instantaneously',
          ],
          answer: 0,
          why: 'μ₀ and ε₀ are measured with capacitors and coils — yet their combination gives the speed of light, revealing light as an EM wave.',
        },
        badge: 'Field Pioneer',
      },
      {
        module: 'optics',
        title: 'Light as a Wave',
        figure: 'Willebrord Snell · 1621',
        body: 'Maxwell\'s wave turned out to be light itself. When light enters a glass prism at an angle, different wavelengths (colors) bend by different amounts — Snell\'s Law. This is why a prism splits white light into a rainbow.',
        equation: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2',
        deeper: 'The refractive index n depends slightly on wavelength (dispersion), so blue light — with a higher index in glass — bends more than red. That tiny wavelength dependence is what fans white light into a spectrum.',
        insight: 'Adjust the prism angle to maximum dispersion. The rainbow spread is called angular dispersion — the physics behind every camera lens ever made.',
        quiz: {
          q: 'In a glass prism, which color bends the most?',
          options: ['Red', 'Blue', 'They all bend equally'],
          answer: 1,
          why: 'Blue light has the shortest wavelength and the highest refractive index in glass, so Snell\'s Law bends it the most.',
        },
        badge: 'Spectrum Splitter',
      },
      {
        module: 'wave-mechanics',
        title: 'Interference — Light\'s Fingerprint',
        figure: 'Thomas Young · 1801',
        body: 'Thomas Young shone light through two slits in 1801 and saw bands of light and dark on the wall behind — proof that light was a wave. Where two crests meet, you get bright bands; where a crest meets a trough, they cancel.',
        equation: 'd\\sin\\theta = m\\lambda',
        deeper: 'The fringe spacing depends only on the slit separation d and the wavelength λ. Measure the spacing and you can back out λ to within nanometers — the working principle of every spectrometer, from lab benches to space telescopes.',
        insight: 'Enable double-slit mode. The bright fringes tell you the wavelength to within nanometers — the same technique we use to analyze distant stars.',
        quiz: {
          q: 'A dark fringe appears where the two paths differ by…',
          options: ['A whole number of wavelengths', 'Half a wavelength (½, 1½, …)', 'Exactly one metre'],
          answer: 1,
          why: 'A half-wavelength path difference puts a crest over a trough — destructive interference — leaving darkness.',
        },
        badge: 'Interference Expert',
      },
      {
        module: 'special-relativity',
        title: 'The Constant Speed Paradox',
        figure: 'Albert Einstein · 1905',
        body: 'Einstein asked: if I ride a beam of light, what do I see? Maxwell said light always travels at c. But Newton said velocities add. They can\'t both be right. Einstein chose Maxwell — and rewrote time itself to make it work.',
        equation: '\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}',
        deeper: 'Holding c constant for every observer forces space and time to stretch instead. The Lorentz factor γ measures that stretch: at v = 0.99c, γ ≈ 7, so moving clocks tick seven times slower as seen from rest.',
        insight: 'Push velocity to 0.99c and watch time dilation approach infinity. The muons hitting our atmosphere right now survive the trip only because time slows for them.',
        quiz: {
          q: 'As v approaches c, the Lorentz factor γ…',
          options: ['Approaches zero', 'Stays at 1', 'Grows without bound'],
          answer: 2,
          why: 'The 1/√(1−v²/c²) denominator shrinks toward zero, so γ diverges — time dilation and length contraction become extreme.',
        },
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
        figure: 'Louis de Broglie · 1924',
        body: 'An electron fired at a double slit creates an interference pattern — even when fired one at a time. The electron interferes with itself. This is the strangest experiment in physics: matter behaving like a wave.',
        equation: '\\lambda = \\frac{h}{p}',
        deeper: 'De Broglie proposed every particle has a wavelength inversely proportional to its momentum. For a baseball it\'s absurdly tiny (~10⁻³⁴ m); for an electron it\'s about the size of an atom — which is exactly why electron waves interfere in the lab.',
        insight: 'Watch the membrane mode. Each ripple is a probability amplitude — the squared height tells you how likely a particle is to land at that point.',
        quiz: {
          q: 'Why don\'t we see the wave nature of a thrown baseball?',
          options: ['Baseballs aren\'t made of atoms', 'Its momentum is huge, so λ = h/p is unmeasurably small', 'Gravity cancels the wave'],
          answer: 1,
          why: 'A macroscopic momentum makes the de Broglie wavelength ~10⁻³⁴ m — far too small to ever detect interference.',
        },
        badge: 'Duality Witness',
      },
      {
        module: 'quantum-mechanics',
        title: 'The Bloch Sphere',
        figure: 'Felix Bloch · 1946',
        body: 'A qubit lives on the surface of a sphere. The north pole is |0⟩, the south pole is |1⟩, and anywhere else is a superposition of both — simultaneously. When you measure it, the sphere collapses to a pole. This is the entire logic of quantum computing.',
        equation: '|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}|0\\rangle + e^{i\\phi}\\sin\\tfrac{\\theta}{2}|1\\rangle',
        deeper: 'The two angles θ and φ place the state anywhere on the sphere. Crucially, the measurement probability of |1⟩ is sin²(θ/2) — so the equator is a perfect 50/50, and the relative phase φ (invisible to a single measurement) is what quantum algorithms manipulate.',
        insight: 'Drag the state vector to the equator: that\'s a 50/50 superposition, equivalent to a qubit after a Hadamard gate.',
        quiz: {
          q: 'A state vector on the Bloch equator gives measurement odds of…',
          options: ['100% |0⟩', '50/50 between |0⟩ and |1⟩', '100% |1⟩'],
          answer: 1,
          why: 'At the equator θ = 90°, so sin²(θ/2) = ½ — an equal superposition, like a qubit after a Hadamard gate.',
        },
        badge: 'Qubit Wrangler',
      },
      {
        module: 'quantum-mechanics',
        title: 'Tunneling Through Walls',
        figure: 'George Gamow · 1928',
        body: 'In quantum mechanics a particle\'s "location" is a probability cloud. If that cloud overlaps a barrier, the particle has a real chance of appearing on the other side — without ever passing through. Tunnel diodes, USB flash drives, and the Sun itself depend on this.',
        equation: 'T \\approx e^{-2\\kappa L},\\quad \\kappa = \\tfrac{\\sqrt{2m(V_0-E)}}{\\hbar}',
        deeper: 'The transmission probability falls off exponentially with barrier width L and height. That exponential sensitivity is why a scanning tunneling microscope can resolve single atoms: a fraction-of-an-atom change in gap width swings the tunneling current by orders of magnitude.',
        insight: 'Enable tunneling mode. Narrow the barrier and watch the transmission probability jump. The Sun fuses hydrogen because protons tunnel through the Coulomb barrier.',
        quiz: {
          q: 'Halving a barrier\'s width changes tunneling probability how?',
          options: ['Doubles it linearly', 'Increases it exponentially', 'No effect — only height matters'],
          answer: 1,
          why: 'T ∝ e^(−2κL), so the probability depends exponentially on width L — small changes have huge effects.',
        },
        badge: 'Tunnel Engineer',
      },
      {
        module: 'frontier-physics',
        title: 'Quantum Gravity Horizon',
        figure: 'Max Planck · 1899',
        body: 'General Relativity and Quantum Mechanics are the two most tested theories in history — and they are mathematically incompatible. At the Planck scale (10⁻³⁵ m), spacetime itself should be quantized. String theory, loop quantum gravity, and causal dynamical triangulations are our current best guesses.',
        equation: '\\ell_P = \\sqrt{\\frac{\\hbar G}{c^3}} \\approx 1.6\\times10^{-35}\\,\\text{m}',
        deeper: 'The Planck length is built from the three constants of quantum mechanics (ℏ), gravity (G), and relativity (c). It marks where a particle\'s Compton wavelength equals its own Schwarzschild radius — the scale at which "distance" itself may stop making sense.',
        insight: 'The Schwarzschild radius simulation shows where quantum effects can no longer be ignored. Hawking radiation is our only observational hint of quantum gravity.',
        quiz: {
          q: 'The Planck length is constructed from which constants?',
          options: ['ℏ, G, and c', 'Only Newton\'s G', 'The fine-structure constant alone'],
          answer: 0,
          why: 'ℓ_P = √(ℏG/c³) combines quantum mechanics, gravity, and relativity — which is why it flags the quantum-gravity regime.',
        },
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
        figure: 'Edward Lorenz · 1963',
        body: 'In 1961, Edward Lorenz rounded a weather simulation input from 0.506127 to 0.506 and got a completely different forecast. The error of 0.0001% diverged exponentially. Sensitive dependence on initial conditions — the butterfly effect — was born.',
        equation: '\\delta(t) \\approx \\delta_0\\, e^{\\lambda t},\\quad \\lambda > 0',
        deeper: 'The rate of divergence is set by the largest Lyapunov exponent λ. A positive λ is the mathematical definition of chaos: any measurement error, no matter how small, is amplified exponentially — which caps weather forecasts at roughly two weeks regardless of computing power.',
        insight: 'Start two Lorenz attractors with nearly identical initial conditions. Watch them diverge on the same strange attractor — same shape, completely different paths.',
        quiz: {
          q: 'A positive Lyapunov exponent means nearby trajectories…',
          options: ['Converge to one path', 'Separate exponentially over time', 'Stay a fixed distance apart'],
          answer: 1,
          why: 'δ(t) ≈ δ₀e^(λt) with λ > 0 is the signature of chaos — errors grow exponentially, destroying long-term predictability.',
        },
        badge: 'Chaos Cartographer',
      },
      {
        module: 'fluid-dynamics',
        title: 'Turbulence — The Unsolved Problem',
        figure: 'Osborne Reynolds · 1883',
        body: 'Richard Feynman called turbulence "the most important unsolved problem in classical physics." When flow velocity exceeds a critical threshold, laminar flow breaks into eddies, which spawn smaller eddies, all the way to the molecular scale. The Navier-Stokes equations describe it — but nobody can solve them analytically.',
        equation: 'Re = \\frac{\\rho v L}{\\mu}',
        deeper: 'The Reynolds number is the ratio of inertial to viscous forces. Below Re ≈ 2000 viscosity keeps flow orderly; above it, inertia wins and the flow becomes turbulent. Proving smooth solutions always exist for the 3D Navier–Stokes equations is a $1M Clay Millennium Prize problem — still open.',
        insight: 'Increase flow speed past the critical Reynolds number. The Kármán vortex street you see is the same pattern that collapsed the Tacoma Narrows Bridge in 1940.',
        quiz: {
          q: 'The Reynolds number compares which two forces?',
          options: ['Gravity vs. buoyancy', 'Inertial vs. viscous', 'Electric vs. magnetic'],
          answer: 1,
          why: 'Re = ρvL/μ is the ratio of inertial to viscous forces; high Re means inertia dominates and flow turns turbulent.',
        },
        badge: 'Flow Analyst',
      },
      {
        module: 'thermodynamics',
        title: 'Entropy — The Arrow of Time',
        figure: 'Ludwig Boltzmann · 1877',
        body: 'Every physical law is time-symmetric except one: entropy always increases. A cup falls and shatters; it never reassembles. This asymmetry is the only physical law that distinguishes past from future — the true origin of the "arrow of time."',
        equation: 'S = k_B \\ln \\Omega',
        deeper: 'Boltzmann\'s insight: entropy counts the number of microscopic arrangements Ω that look the same macroscopically. A shattered cup has astronomically more arrangements than an intact one, so the system overwhelmingly drifts toward disorder — not by any force, but by sheer counting.',
        insight: 'Watch the Maxwell-Boltzmann distribution evolve. The system always moves toward maximum entropy — the most probable microstate. There are simply more disordered arrangements than ordered ones.',
        quiz: {
          q: 'Entropy increases because disordered states…',
          options: ['Have lower energy', 'Are vastly more numerous than ordered ones', 'Are forbidden by gravity'],
          answer: 1,
          why: 'S = k_B ln Ω: there are exponentially more disordered microstates, so a system almost certainly evolves toward them.',
        },
        badge: 'Entropy Master',
      },
      {
        module: 'acoustic-physics',
        title: 'Chladni\'s Hidden Order',
        figure: 'Ernst Chladni · 1787',
        body: 'Ernst Chladni drew a bow across a vibrating plate sprinkled with sand in 1787. The sand gathered along the nodal lines — places of no vibration — forming intricate geometric patterns. Order emerging from vibration. The mathematics behind this is identical to quantum mechanical wave functions.',
        equation: '\\nabla^2 u + k^2 u = 0',
        deeper: 'Each pattern is an eigenmode of the Helmholtz equation on the plate — a standing wave whose nodal lines (where displacement is zero) collect the sand. The exact same eigenvalue problem, applied to the Schrödinger equation, gives the orbital shapes of electrons in atoms.',
        insight: 'Sweep through resonant frequencies. Each pattern is an eigenmode — the same mathematics that defines the orbital shapes of electrons in atoms.',
        quiz: {
          q: 'Sand collects on a Chladni plate along…',
          options: ['The antinodes (max vibration)', 'The nodal lines (zero vibration)', 'The warmest regions'],
          answer: 1,
          why: 'Sand is shaken away from moving antinodes and settles on the still nodal lines, tracing the eigenmode.',
        },
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
        figure: 'Albert Einstein · 1905',
        body: 'Einstein\'s 1905 paper begins with a thought experiment: two lightning strikes hit opposite ends of a moving train simultaneously for a platform observer. For the passenger on the train, they don\'t. Simultaneity is relative. From this single insight, time dilation and length contraction follow mathematically.',
        equation: '\\Delta t = \\gamma\\, \\Delta\\tau',
        deeper: 'Proper time τ is what a clock reads in its own rest frame; Δt is the longer interval a moving observer measures. GPS satellites move fast enough that special relativity slows their clocks by ~7 μs/day — uncorrected, positions would drift kilometres within hours.',
        insight: 'Set velocity to 0.866c — that\'s γ = 2. Your proper time runs at half the rate of the stationary observer. GPS satellites correct for exactly this effect every microsecond.',
        quiz: {
          q: 'Two events simultaneous for one observer are, for a moving observer…',
          options: ['Always simultaneous too', 'Not necessarily simultaneous', 'Impossible to compare'],
          answer: 1,
          why: 'Relativity of simultaneity: the order/timing of spatially-separated events depends on the observer\'s motion.',
        },
        badge: 'Relativist',
      },
      {
        module: 'general-relativity',
        title: 'Gravity as Geometry',
        figure: 'Albert Einstein · 1915',
        body: 'In 1915 Einstein extended special relativity to include gravity. His answer: gravity is not a force. It is the curvature of spacetime caused by mass and energy. Objects in free fall (including planets in orbit) are moving in straight lines through curved spacetime — geodesics.',
        equation: 'G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}',
        deeper: 'The left side (G_μν) is pure geometry — how spacetime curves; the right side (T_μν) is the matter and energy that curve it. As Wheeler put it: matter tells spacetime how to curve, and spacetime tells matter how to move. A planet\'s orbit is the straightest possible path through that curvature.',
        insight: 'Place a mass in the spacetime grid and watch geodesics curve. The orbit you see is a straight line through curved 4D geometry, not a circular path under a central force.',
        quiz: {
          q: 'In general relativity, a planet orbits because it…',
          options: ['Feels a pulling force from the Sun', 'Follows a geodesic — a straight line in curved spacetime', 'Is pushed by dark energy'],
          answer: 1,
          why: 'GR reframes gravity as geometry: free-falling bodies follow geodesics, the straightest paths through curved spacetime.',
        },
        badge: 'Geometer of Spacetime',
      },
      {
        module: 'general-relativity',
        title: 'Gravitational Waves',
        figure: 'LIGO Collaboration · 2015',
        body: 'When massive objects accelerate, they create ripples in spacetime — gravitational waves. On September 14, 2015, LIGO detected the merger of two black holes 1.3 billion light-years away. The signal stretched and compressed Earth by less than one-thousandth the diameter of a proton.',
        equation: 'h \\sim \\frac{\\Delta L}{L} \\approx 10^{-21}',
        deeper: 'The strain h is the fractional stretch of space a wave induces. At 10⁻²¹ over LIGO\'s 4 km arms, that\'s a length change ~10⁻¹⁸ m — a thousandth of a proton\'s width. Detecting it required laser interferometry stable enough to sense that against all of Earth\'s seismic noise.',
        insight: 'Tune the binary mass ratio and orbital frequency. The chirp pattern — frequency increasing as the objects spiral inward — is exactly what LIGO recorded.',
        quiz: {
          q: 'The "chirp" in a black-hole merger signal is the frequency…',
          options: ['Staying constant', 'Rising as the objects spiral inward and speed up', 'Dropping to zero at merger'],
          answer: 1,
          why: 'As the binary inspirals it orbits faster, so both the gravitational-wave frequency and amplitude sweep upward — the chirp.',
        },
        badge: 'Wave Detector',
      },
      {
        module: 'frontier-physics',
        title: 'Dark Energy and the Accelerating Universe',
        figure: 'Perlmutter, Schmidt & Riess · 1998',
        body: 'In 1998, astronomers measuring distant supernovae expected to find the universe\'s expansion slowing due to gravity. Instead they found it accelerating. Something — dark energy — is pushing spacetime apart at an ever-increasing rate. It constitutes 68% of all energy in the universe and we have no idea what it is.',
        equation: 'v = H_0\\, d',
        deeper: 'Hubble\'s law says recession velocity grows with distance, so beyond the Hubble radius (~14 billion ly) galaxies recede faster than light and their light will never reach us. Dark energy makes that horizon shrink over time — the observable universe is slowly going dark.',
        insight: 'The Hubble constant simulation shows recession velocity proportional to distance. Beyond the Hubble radius, galaxies recede faster than light — we can never see them.',
        quiz: {
          q: 'The 1998 supernova surveys surprised everyone by showing expansion is…',
          options: ['Slowing under gravity', 'Perfectly constant', 'Accelerating'],
          answer: 2,
          why: 'Distant supernovae were dimmer/farther than a decelerating universe predicts — evidence expansion is accelerating, driven by dark energy.',
        },
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
        figure: 'Sadi Carnot · 1824',
        body: 'Sadi Carnot proved in 1824 that no heat engine can be more efficient than a perfect reversible cycle between two temperatures. The maximum efficiency depends only on the temperatures: η = 1 − T_cold/T_hot. No engineering trick can beat this — it\'s a law of nature.',
        equation: '\\eta_{\\max} = 1 - \\frac{T_c}{T_h}',
        deeper: 'The bound depends only on the absolute temperatures of the hot and cold reservoirs — not the working fluid, not the design. A car engine burning at ~2000 K exhausting to ~300 K is capped near 85%, and real friction/irreversibility pulls it far lower. This is why waste heat is unavoidable.',
        insight: 'Open the PV diagram mode. The Carnot cycle is the rectangle of maximum area for given temperature limits — every deviation shrinks it.',
        quiz: {
          q: 'Carnot efficiency can only reach 100% if…',
          options: ['The engine is frictionless', 'The cold reservoir is at absolute zero', 'The fuel is perfect'],
          answer: 1,
          why: 'η = 1 − T_c/T_h hits 1 only when T_c = 0 K — impossible, so no heat engine is ever perfectly efficient.',
        },
        badge: 'Thermodynamicist',
      },
      {
        module: 'thermodynamics',
        title: 'Maxwell\'s Demon',
        figure: 'Maxwell · 1867 → Landauer · 1961',
        body: 'Maxwell imagined a demon guarding a tiny door between two gas chambers, letting fast molecules through one way and slow molecules the other — creating a temperature difference without doing work. This would violate the second law. The demon was finally exorcised in 1961: erasing the demon\'s memory costs exactly the entropy it gained.',
        equation: 'E_{\\min} = k_B T \\ln 2 \\;\\; \\text{per bit erased}',
        deeper: 'Landauer\'s principle links information and thermodynamics: erasing one bit dumps at least k_B T ln2 of heat into the environment. The demon can lower the gas\'s entropy, but recording which molecules to pass fills its memory — and clearing that memory pays the entropy back. Information is physical.',
        insight: 'Watch the Maxwell-Boltzmann distribution. The demon\'s job is to sort by speed — but sorting information has an irreducible thermodynamic cost: kT·ln(2) per bit erased.',
        quiz: {
          q: 'Maxwell\'s Demon doesn\'t break the second law because…',
          options: ['Molecules are too fast to sort', 'Erasing its memory costs at least k_B T ln2 per bit', 'Demons don\'t exist'],
          answer: 1,
          why: 'Landauer showed the demon\'s information processing — specifically memory erasure — generates entropy that balances the books.',
        },
        badge: 'Demon Slayer',
      },
      {
        module: 'fluid-dynamics',
        title: 'Convection — Heat in Motion',
        figure: 'Lord Rayleigh · 1916',
        body: 'Heat rises. This simple fact drives ocean currents, atmospheric circulation, plate tectonics, and the solar convection zone. Hot fluid is less dense, rises, cools, becomes denser, sinks, reheats — a cycle powered by a temperature gradient.',
        equation: 'Ra = \\frac{g\\beta\\,\\Delta T\\,L^3}{\\nu\\alpha}',
        deeper: 'Convection only switches on when the Rayleigh number exceeds a critical value (~1708 for a fluid between plates). Below it, heat just diffuses; above it, buoyancy overcomes viscosity and organized rolls or hexagonal cells appear — the same pattern in a pot of soup, the atmosphere, and the Sun\'s granulated surface.',
        insight: 'Enable the thermal mode. Rayleigh-Bénard convection cells form above a critical heating rate — the same hexagonal pattern seen in solar granulation.',
        quiz: {
          q: 'Convection cells form only when the Rayleigh number is…',
          options: ['Exactly zero', 'Above a critical threshold', 'Negative'],
          answer: 1,
          why: 'Below the critical Ra, viscosity/diffusion win and heat just conducts; above it, buoyancy drives organized convection.',
        },
        badge: 'Convection Expert',
      },
      {
        module: 'acoustic-physics',
        title: 'Sound as Thermodynamic Waves',
        figure: 'Pierre-Simon Laplace · 1816',
        body: 'Sound is a compression wave — air molecules jostling neighbors, each collision transferring kinetic energy forward. The speed of sound is determined by the gas\'s thermodynamic properties: c = √(γRT/M). Temperature is why your voice sounds higher in a helium atmosphere.',
        equation: 'c = \\sqrt{\\frac{\\gamma R T}{M}}',
        deeper: 'Newton first computed the speed of sound and got it ~15% too low; Laplace fixed it by realizing the compressions are adiabatic (too fast for heat to escape), introducing the factor γ. Helium\'s low molar mass M raises c dramatically, shifting your voice\'s resonances up — the squeaky-voice effect.',
        insight: 'Watch the Lissajous mode. Two frequencies beating against each other show thermoacoustic resonance — the physics behind Stirling engines and acoustic refrigerators.',
        quiz: {
          q: 'Your voice sounds higher after breathing helium because helium\'s…',
          options: ['Low molar mass raises the speed of sound', 'Coldness shrinks your throat', 'Density slows the waves'],
          answer: 0,
          why: 'c = √(γRT/M): the small molar mass M of helium raises the sound speed, shifting your vocal-tract resonances upward.',
        },
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
          background: i < current ? 'rgba(94,106,210,0.5)' : i === current ? '#5e6ad2' : 'rgba(255,255,255,0.12)',
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
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                letterSpacing: '0.10em', color: '#5e6ad2',
                background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.25)',
                borderRadius: 3, padding: '2px 6px',
              }}>DONE</span>
            )}
          </div>
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12,
            color: 'rgba(247,248,248,0.62)', letterSpacing: 'normal', marginBottom: 8,
          }}>{journey.subtitle} · {journey.era}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.10em',
              color: DIFF_COLOR[journey.difficulty],
              background: `${DIFF_COLOR[journey.difficulty]}18`,
              border: `1px solid ${DIFF_COLOR[journey.difficulty]}40`,
              borderRadius: 3, padding: '2px 7px',
            }}>{journey.difficulty}</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: 'rgba(200,230,220,0.50)', letterSpacing: '0.08em',
            }}>{journey.steps.length} MODULES · {journey.completion.xp} XP</span>
            {stepsDone >= 0 && !done && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: journey.color, letterSpacing: '0.08em',
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
            background: done ? '#5e6ad2' : journey.color,
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
  const [quizPick, setQuizPick] = useState(null)   // selected option index
  const [showDeeper, setShowDeeper] = useState(false)
  const current = journey.steps[step]
  const quizCorrect = current?.quiz ? quizPick === current.quiz.answer : true

  // Reset per-step interactive state when the step changes
  useEffect(() => { setQuizPick(null); setShowDeeper(false) }, [step])

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
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: journey.color }}>BADGE EARNED</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#e8f4f0', marginTop: 1 }}>{current?.badge}</div>
            </div>
          </div>
        )}

        {/* Completion card */}
        {completed ? (
          <div style={{
            background: 'rgba(10,10,12,0.98)',
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
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: `rgba(${journey.glow},0.75)`, marginBottom: 4 }}>JOURNEY COMPLETE</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e8f4f0' }}>{journey.completion.title}</div>
              </div>
              <span style={{ fontSize: 22 }}>🎓</span>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(200,230,220,0.7)', lineHeight: 1.7, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
                {journey.completion.body}
              </p>

              {xpShown && <XPBurst xp={journey.completion.xp} color={journey.color} />}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
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
            background: 'rgba(10,10,12,0.97)',
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
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em', color: `rgba(${journey.glow},0.70)` }}>
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
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#e8f4f0', marginBottom: 2, lineHeight: 1.4 }}>
                {current.title}
              </div>
              {current.figure && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: `rgba(${journey.glow},0.6)`, marginBottom: 10 }}>
                  {current.figure.toUpperCase()}
                </div>
              )}
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(200,230,220,0.7)', lineHeight: 1.75, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                {current.body}
              </p>

              {/* Equation */}
              {current.equation && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid rgba(${journey.glow},0.14)`,
                  borderRadius: 5, padding: '12px 10px', marginBottom: 12,
                  color: '#e8f4f0', fontSize: 15, overflowX: 'auto',
                }}>
                  <Katex tex={current.equation} block />
                </div>
              )}

              {/* Go deeper (collapsible) */}
              {current.deeper && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => setShowDeeper(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
                      color: `rgba(${journey.glow},0.70)`,
                    }}
                  >
                    <span style={{ transform: showDeeper ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▸</span>
                    GO DEEPER
                  </button>
                  {showDeeper && (
                    <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, color: 'rgba(200,230,220,0.62)', lineHeight: 1.7, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
                      {current.deeper}
                    </p>
                  )}
                </div>
              )}

              {/* Insight box */}
              <div style={{
                background: `rgba(${journey.glow},0.04)`,
                border: `1px solid rgba(${journey.glow},0.15)`,
                borderLeft: `3px solid rgba(${journey.glow},0.5)`,
                borderRadius: '0 4px 4px 0',
                padding: '8px 10px',
                marginBottom: 14,
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: `rgba(${journey.glow},0.70)`, marginBottom: 5 }}>TRY THIS</div>
                <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: `rgba(${journey.color.replace('#','')},0.85)`, lineHeight: 1.65, margin: 0, letterSpacing: '-0.01em' }}>
                  {current.insight}
                </p>
              </div>

              {/* Comprehension quiz gate */}
              {current.quiz && (
                <div style={{
                  border: `1px solid rgba(${journey.glow},0.15)`,
                  borderRadius: 6, padding: '11px 12px', marginBottom: 14,
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', color: `rgba(${journey.glow},0.70)`, marginBottom: 8 }}>
                    CHECK YOUR UNDERSTANDING
                  </div>
                  <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, color: '#e8f4f0', lineHeight: 1.55, margin: '0 0 10px' }}>
                    {current.quiz.q}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {current.quiz.options.map((opt, i) => {
                      const picked = quizPick === i
                      const isRight = i === current.quiz.answer
                      const answered = quizPick !== null
                      let bg = 'rgba(255,255,255,0.02)', bd = 'rgba(255,255,255,0.10)', fg = 'rgba(200,230,220,0.75)'
                      if (answered && isRight) { bg = 'rgba(34,197,94,0.12)'; bd = 'rgba(34,197,94,0.5)'; fg = '#86efac' }
                      else if (answered && picked && !isRight) { bg = 'rgba(239,68,68,0.10)'; bd = 'rgba(239,68,68,0.45)'; fg = '#fca5a5' }
                      return (
                        <button
                          key={i}
                          onClick={() => { if (!quizCorrect) setQuizPick(i) }}
                          disabled={quizCorrect}
                          style={{
                            textAlign: 'left', padding: '7px 10px', borderRadius: 4,
                            background: bg, border: `1px solid ${bd}`, color: fg,
                            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, lineHeight: 1.45,
                            cursor: quizCorrect ? 'default' : 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {answered && isRight ? '✓ ' : answered && picked && !isRight ? '✗ ' : ''}{opt}
                        </button>
                      )
                    })}
                  </div>
                  {quizPick !== null && (
                    <p style={{
                      fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11.5,
                      color: quizCorrect ? 'rgba(134,239,172,0.85)' : 'rgba(252,165,165,0.85)',
                      lineHeight: 1.6, margin: '9px 0 0',
                    }}>
                      {quizCorrect ? current.quiz.why : 'Not quite — try again.'}
                    </p>
                  )}
                </div>
              )}

              {/* Next / Finish */}
              <button
                onClick={() => { if (quizCorrect) handleNext() }}
                disabled={!quizCorrect}
                title={quizCorrect ? '' : 'Answer the check above to continue'}
                style={{
                  width: '100%', padding: '10px 0',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
                  color: quizCorrect ? '#08090a' : 'rgba(255,255,255,0.35)',
                  background: quizCorrect ? journey.color : 'rgba(255,255,255,0.06)',
                  border: 'none', borderRadius: 5, cursor: quizCorrect ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  boxShadow: quizCorrect ? `0 4px 16px rgba(${journey.glow},0.35)` : 'none',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (quizCorrect) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {step < journey.steps.length - 1 ? `NEXT: ${journey.steps[step + 1].title.toUpperCase()}  ›` : 'COMPLETE JOURNEY  ✓'}
              </button>

              {/* Step / badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.08em' }}>
                  MODULE {step + 1} / {journey.steps.length}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: `rgba(${journey.glow},0.60)`, letterSpacing: '0.08em' }}>
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
            position: 'fixed', top: 64, left: 20, zIndex: 10100,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 13px',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em',
            color: open ? '#e8f4f0' : 'rgba(200,230,220,0.58)',
            background: open ? 'rgba(94,106,210,0.08)' : 'rgba(8,9,10,0.72)',
            border: `1px solid ${open ? 'rgba(94,106,210,0.3)' : 'rgba(94,106,210,0.12)'}`,
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
            <span style={{ color: '#5e6ad2', marginLeft: 2 }}>{totalXP} XP</span>
          )}
        </button>
      )}

      {/* Journey selection panel */}
      {open && !activeModule && (
        <div style={{
          position: 'fixed', top: 104, left: 20, zIndex: 10100,
          width: 380,
          background: 'rgba(8,9,10,0.96)',
          border: '1px solid rgba(94,106,210,0.12)',
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
            borderBottom: '1px solid rgba(94,106,210,0.07)',
            background: 'rgba(94,106,210,0.02)',
            position: 'sticky', top: 0,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(94,106,210,0.65)', marginBottom: 4 }}>STORY MODE</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#e8f4f0' }}>Guided Journeys</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(94,106,210,0.60)', letterSpacing: '0.12em' }}>TOTAL XP</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#5e6ad2' }}>{totalXP}</div>
              </div>
            </div>
            <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(247,248,248,0.65)', lineHeight: 1.6, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
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
            borderTop: '1px solid rgba(94,106,210,0.07)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: 'rgba(200,230,220,0.38)', letterSpacing: '0.10em', textAlign: 'center',
          }}>
            PRESS J TO TOGGLE · PROGRESS AUTO-SAVED
          </div>
        </div>
      )}
    </>
  )
}
