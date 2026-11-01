import { create } from 'zustand'

const useModuleStore = create((set) => ({
  // Active module: null = picker screen, string = module id
  activeModule: null,

  // Special Relativity state
  sr: {
    velocity: 0.5, // β = v/c, range [0, 0.99)
    eventX: 1.2,   // light-cone draggable event x position
    eventT: 0.8,   // light-cone draggable event t position
  },

  setActiveModule: (id) => set({ activeModule: id }),

  // View requested by the URL (/simulations/<module>/<view>); ModuleShell
  // applies it once the module mounts, then clears it
  pendingView: null,
  setPendingView: (v) => set({ pendingView: v }),

  setSrVelocity: (v) =>
    set((state) => ({
      sr: { ...state.sr, velocity: Math.min(0.99, Math.max(0, v)) },
    })),

  setSrEvent: (x, t) =>
    set((state) => ({
      sr: { ...state.sr, eventX: x, eventT: t },
    })),

  resetSr: () =>
    set((state) => ({
      sr: { ...state.sr, velocity: 0.5, eventX: 1.2, eventT: 0.8 },
    })),

  // Quantum Mechanics state
  qm: {
    blochTheta: Math.PI / 3,   // polar angle θ ∈ [0, π]
    blochPhi: Math.PI / 4,     // azimuthal angle φ ∈ [0, 2π]
    boxN: 2,                   // quantum number n ∈ [1, 6]
    slitWavelength: 0.6,       // effective wavelength for interference
    slitMeasured: false,       // whether which-path measurement is active
    particleCount: 20000,      // Monte Carlo sample count for PIB and Bloch
    boxVizMode: 'prob',        // 'prob' | 'real' | 'imag'
    blochVizMode: 'prob',      // 'prob' | 'real' | 'imag'
    entangleAlpha: Math.PI / 8, // coupling angle α ∈ [0, π/4]; C = sin(2α)
    tunnelV0: 3.0,             // barrier height V₀ ∈ [0.5, 6]
    tunnelK0: 2.0,             // incident momentum k₀ ∈ [0.5, 4]
  },

  setBlochTheta: (v) =>
    set((state) => ({
      qm: { ...state.qm, blochTheta: Math.max(0, Math.min(Math.PI, v)) },
    })),

  setBlochPhi: (v) =>
    set((state) => ({
      qm: { ...state.qm, blochPhi: ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) },
    })),

  setBoxN: (n) =>
    set((state) => ({
      qm: { ...state.qm, boxN: Math.round(Math.max(1, Math.min(6, n))) },
    })),

  setSlitWavelength: (v) =>
    set((state) => ({
      qm: { ...state.qm, slitWavelength: Math.max(0.3, Math.min(1.2, v)) },
    })),

  setSlitMeasured: (v) =>
    set((state) => ({
      qm: { ...state.qm, slitMeasured: v },
    })),

  setParticleCount: (v) =>
    set((state) => ({
      qm: { ...state.qm, particleCount: Math.round(Math.max(1000, Math.min(100000, v))) },
    })),

  setBoxVizMode: (v) =>
    set((state) => ({ qm: { ...state.qm, boxVizMode: v } })),

  setBlochVizMode: (v) =>
    set((state) => ({ qm: { ...state.qm, blochVizMode: v } })),

  setEntangleAlpha: (v) =>
    set((state) => ({
      qm: { ...state.qm, entangleAlpha: Math.max(0, Math.min(Math.PI / 4, v)) },
    })),

  setTunnelV0: (v) =>
    set((state) => ({ qm: { ...state.qm, tunnelV0: Math.max(0.5, Math.min(6.0, v)) } })),

  setTunnelK0: (v) =>
    set((state) => ({ qm: { ...state.qm, tunnelK0: Math.max(0.5, Math.min(4.0, v)) } })),

  resetQm: () =>
    set({
      qm: {
        blochTheta: Math.PI / 3,
        blochPhi: Math.PI / 4,
        boxN: 2,
        slitWavelength: 0.6,
        slitMeasured: false,
        particleCount: 20000,
        boxVizMode: 'prob',
        blochVizMode: 'prob',
        entangleAlpha: Math.PI / 8,
        tunnelV0: 3.0,
        tunnelK0: 2.0,
      },
    }),

  // Dynamical Systems state
  ds: {
    attractorType: 'lorenz',
    phaseMu: 1.0,  // Van der Pol μ ∈ [0, 3]
  },

  setDsAttractorType: (v) =>
    set((state) => ({ ds: { ...state.ds, attractorType: v } })),

  setDsPhaseMu: (v) =>
    set((state) => ({ ds: { ...state.ds, phaseMu: Math.max(0, Math.min(3, v)) } })),

  resetDs: () => set({ ds: { attractorType: 'lorenz', phaseMu: 1.0 } }),

  // Electromagnetism state
  em: {
    magnetType: 'dipole', // 'dipole' | 'bar' | 'solenoid' | 'halbach'
  },

  setEmMagnetType: (v) =>
    set((state) => ({ em: { ...state.em, magnetType: v } })),

  resetEm: () =>
    set({ em: { magnetType: 'dipole' } }),

  // Frontier Physics state
  fp: {
    fpRadius: 3.0,  // orbital radius for rotation curve slider ∈ [0.2, 6.5]
    hubble: 1.0,    // normalized Hubble constant (1.0 ≈ 70 km/s/Mpc) ∈ [0.2, 2.5]
    bhMass: 1.0,    // black hole mass scaling ∈ [0.3, 1.5]; Rs = bhMass * 0.5
  },

  setFpRadius: (v) =>
    set((state) => ({
      fp: { ...state.fp, fpRadius: Math.max(0.2, Math.min(6.5, v)) },
    })),

  setFpHubble: (v) =>
    set((state) => ({
      fp: { ...state.fp, hubble: Math.max(0.2, Math.min(2.5, v)) },
    })),

  setFpBhMass: (v) =>
    set((state) => ({
      fp: { ...state.fp, bhMass: Math.max(0.3, Math.min(1.5, v)) },
    })),

  resetFp: () =>
    set({ fp: { fpRadius: 3.0, hubble: 1.0, bhMass: 1.0 } }),

  // General Relativity state
  gr: {
    mass: 2.0,       // central mass scale ∈ [0.5, 5]
    viewType: 'curvature', // 'curvature' | 'geodesics' | 'waves'
  },

  setGrMass: (v) =>
    set((state) => ({ gr: { ...state.gr, mass: Math.max(0.5, Math.min(5, v)) } })),

  setGrView: (v) =>
    set((state) => ({ gr: { ...state.gr, viewType: v } })),

  resetGr: () => set({ gr: { mass: 2.0, viewType: 'curvature' } }),

  // Thermodynamics state
  thermo: {
    temperature: 1.0,  // normalized temperature ∈ [0.2, 3.0]
    viewType: 'gas',   // 'gas' | 'entropy' | 'engine'
  },

  setThermoTemp: (v) =>
    set((state) => ({ thermo: { ...state.thermo, temperature: Math.max(0.2, Math.min(3.0, v)) } })),

  setThermoView: (v) =>
    set((state) => ({ thermo: { ...state.thermo, viewType: v } })),

  resetThermo: () => set({ thermo: { temperature: 1.0, viewType: 'gas' } }),

  // Fluid Dynamics state
  fluid: {
    viewType: 'streamlines', // 'streamlines' | 'vortex' | 'sph'
    reynolds: 1.0,           // flow speed/intensity ∈ [0.3, 2.5]
  },

  setFluidView: (v) =>
    set((state) => ({ fluid: { ...state.fluid, viewType: v } })),

  setFluidReynolds: (v) =>
    set((state) => ({ fluid: { ...state.fluid, reynolds: Math.max(0.3, Math.min(2.5, v)) } })),

  resetFluid: () => set({ fluid: { viewType: 'streamlines', reynolds: 1.0 } }),

  // Wave Mechanics state
  wave: {
    viewType: 'ripple', // 'ripple' | 'slit' | 'modes'
    modeIdx: 0,         // index into NormalModes MODES ∈ [0, 8]
    slitMode: 0,        // ripple-tank barrier: 0 open | 1 single slit | 2 double slit
  },

  setWaveView: (v) =>
    set((state) => (['ripple', 'slit', 'modes'].includes(v) ? { wave: { ...state.wave, viewType: v } } : {})),

  setWaveModeIdx: (v) =>
    set((state) => ({ wave: { ...state.wave, modeIdx: Math.round(Math.max(0, Math.min(8, v))) } })),

  setWaveSlitMode: (v) =>
    set((state) => ({ wave: { ...state.wave, slitMode: Math.round(Math.max(0, Math.min(2, v))) } })),

  resetWave: () => set({ wave: { viewType: 'ripple', modeIdx: 0, slitMode: 0 } }),

  // Optics state
  optics: {
    viewType: 'prism', // 'prism' | 'lens' | 'grating'
    focalLength: 2.5,  // lens focal length f ∈ [1.5, 5]
    objectDist: 5.0,   // lens lab object distance u ∈ [0.8, 8]
    gratingLines: 600, // grating lines per mm ∈ [200, 1200]
  },

  setOpticsView: (v) =>
    set((state) => (['prism', 'lens', 'grating'].includes(v) ? { optics: { ...state.optics, viewType: v } } : {})),

  setOpticsFocalLength: (v) =>
    set((state) => ({ optics: { ...state.optics, focalLength: Math.max(1.5, Math.min(5.0, v)) } })),

  setOpticsObjectDist: (v) =>
    set((state) => ({ optics: { ...state.optics, objectDist: Math.max(0.8, Math.min(8.0, v)) } })),

  setOpticsGratingLines: (v) =>
    set((state) => ({ optics: { ...state.optics, gratingLines: Math.round(Math.max(200, Math.min(1200, v))) } })),

  resetOptics: () => set({ optics: { viewType: 'prism', focalLength: 2.5, objectDist: 5.0, gratingLines: 600 } }),

  // Acoustic Physics state
  acoustic: {
    viewType: 'cymatics',     // 'cymatics' | 'harmonics' | 'lissajous'
    modeIdx: 3,               // Chladni mode index ∈ [0, 9]
    presetIdx: 1,             // Lissajous ratio preset index ∈ [0, 7]
    lissPhase: Math.PI / 4,   // Lissajous phase offset ∈ [0, 2π]
    lissBaseFreq: 220,        // Lissajous base frequency (Hz) ∈ [80, 440]
  },

  setAcousticView: (v) =>
    set((state) => (['cymatics', 'harmonics', 'lissajous'].includes(v) ? { acoustic: { ...state.acoustic, viewType: v } } : {})),

  setAcousticModeIdx: (v) =>
    set((state) => ({ acoustic: { ...state.acoustic, modeIdx: Math.round(Math.max(0, Math.min(9, v))) } })),

  setAcousticPresetIdx: (v) =>
    set((state) => ({ acoustic: { ...state.acoustic, presetIdx: Math.round(Math.max(0, Math.min(7, v))) } })),

  setAcousticLissPhase: (v) =>
    set((state) => ({ acoustic: { ...state.acoustic, lissPhase: Math.max(0, Math.min(2 * Math.PI, v)) } })),

  setAcousticLissBaseFreq: (v) =>
    set((state) => ({ acoustic: { ...state.acoustic, lissBaseFreq: Math.round(Math.max(80, Math.min(440, v))) } })),

  resetAcoustic: () =>
    set({ acoustic: { viewType: 'cymatics', modeIdx: 3, presetIdx: 1, lissPhase: Math.PI / 4, lissBaseFreq: 220 } }),

  // Physics Sandbox state (placed sources stay local to the scene)
  sandbox: {
    mode: 'attractor', // 'attractor' | 'repulsor' | 'vortex_ccw' | 'vortex_cw' | 'erase'
    strength: 1.0,     // source strength ∈ [0.2, 3]
  },

  setSandboxMode: (v) =>
    set((state) => (['attractor', 'repulsor', 'vortex_ccw', 'vortex_cw', 'erase'].includes(v) ? { sandbox: { ...state.sandbox, mode: v } } : {})),

  setSandboxStrength: (v) =>
    set((state) => ({ sandbox: { ...state.sandbox, strength: Math.max(0.2, Math.min(3.0, v)) } })),

  resetSandbox: () => set({ sandbox: { mode: 'attractor', strength: 1.0 } }),
}))

export default useModuleStore
