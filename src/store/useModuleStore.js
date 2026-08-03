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
      },
    }),

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
}))

export default useModuleStore
