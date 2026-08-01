# Physics Sandbox

An interactive 3D physics visualizer covering special relativity, quantum mechanics, and frontier physics. Each module lets you manipulate parameters and watch the physics respond in real time — Lorentz-contracted rods, collapsing wavefunctions, galaxy rotation curves that refuse to follow Kepler. Built in React Three Fiber with a dark oscilloscope aesthetic.

**Live demo:** https://physics-sandbox-eosin.vercel.app

---

## Why I built this

I was working through special relativity and quantum mechanics on my own and kept running into the same problem: the math makes sense on paper but the intuition doesn't click until you can see it. So I built the visualizations I wished existed. The frontier physics module came later, when I got frustrated with popular-science explanations that present dark matter and dark energy as solved mysteries. This project tries to clearly separate what's measured, what's inferred, and what's genuinely unknown.

---

## Tech stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI and component tree |
| Vite | 8 | Build tooling and HMR |
| React Three Fiber | 9.6 | Declarative Three.js in React |
| @react-three/drei | 10.7 | R3F helpers (Html, Line, etc.) |
| Three.js | 0.185 | 3D rendering engine |
| Zustand | 5 | Global state (module params) |
| Tailwind CSS | 3.4 | Styling |

---

## Modules

### Special Relativity
Lorentz transforms, time dilation, and length contraction at relativistic velocities. A velocity slider (β = v/c) drives all three views simultaneously. The light cone view shows how causality structure changes as β → 1; the time dilation view shows the twin-paradox factor γ updating live; length contraction collapses a rod's proper length by the same factor.

### Quantum Mechanics
Three scenes: a Bloch sphere (qubit state space with θ/φ sliders, live amplitude readout, and |0⟩/|1⟩/|+⟩/|−⟩ labels), a particle-in-a-box (animated Re[ψ]·cos(E_n·t) wavefunction with probability density overlay and energy ladder for n=1..6), and a double-slit experiment (particle accumulation into interference fringes with a which-path measurement toggle that destroys the pattern and explains why).

### Frontier Physics
Two scenes built around what's actually observed versus what's inferred. The rotation curves view shows a spiral galaxy with an orbital probe: drag the radius slider and watch the measured velocity hold flat while the Keplerian prediction (from visible mass alone) drops — the gap is the "missing mass" problem. The Hubble expansion view shows a comoving galaxy grid expanding outward with velocity labels demonstrating v = H₀·d linearly; the InfoPanel notes the unresolved 5σ Hubble tension.

---

## Screenshots

![Module picker](./screenshots/picker.png)
![Special Relativity module](./screenshots/sr-module.png)
![Bloch Sphere — Quantum Mechanics](./screenshots/qm-bloch.png)
![Particle in Box](./screenshots/qm-box.png)
![Double Slit](./screenshots/qm-slit.png)
![Rotation Curves — Frontier Physics](./screenshots/fp-rotation.png)
![Hubble Expansion](./screenshots/fp-expansion.png)

---

## Getting started

```bash
git clone https://github.com/subhanrao/physics-sandbox.git
cd physics-sandbox
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174).

```bash
# Production build
npm run build
npm run preview
```

---

## Source structure

```
src/
├── App.jsx                          # Top-level routing (module picker → module)
├── main.jsx
├── index.css                        # Global tokens, glow utilities, fonts
├── store/
│   └── useModuleStore.js            # Zustand store: all module state
├── components/
│   ├── SceneWrapper.jsx             # Single persistent R3F Canvas + CameraRig
│   ├── ControlPanel.jsx             # Labeled sliders panel (right column)
│   ├── InfoPanel.jsx                # Collapsible explanation + metrics (left column)
│   └── ModulePicker.jsx             # Landing card grid
└── modules/
    ├── special-relativity/
    │   ├── SRModule.jsx
    │   ├── LightCone.jsx
    │   ├── TimeDilation.jsx
    │   ├── LengthContraction.jsx
    │   └── srMath.js
    ├── quantum/
    │   ├── QuantumModule.jsx
    │   ├── BlochSphere.jsx
    │   ├── ParticleInBox.jsx
    │   ├── DoubleSlit.jsx
    │   └── qmMath.js
    └── frontier/
        ├── FrontierModule.jsx
        ├── RotationCurve.jsx
        ├── ExpansionSim.jsx
        └── frontierMath.js
```

---

## Known limitations / honesty note

**Frontier Physics module:** The dark matter fraction displayed in the rotation curves view is *inferred* from the velocity discrepancy, not directly observed. Dark matter itself has never been directly detected. The flat rotation curve is real and reproducible; the explanation for it is not settled. The module says this explicitly in the InfoPanel.

**Natural units:** All physics is in natural units (c = 1, ℏ = 1) with normalized galaxy masses. The visualizations show the right qualitative behaviour and correct functional forms — they are not numerically accurate simulations of specific real systems.

**Single Canvas:** The app uses one persistent Three.js Canvas across all views to avoid remount issues in React Three Fiber v9. Switching between modules does not destroy and recreate the WebGL context.

---

## License

MIT © 2026 Subhan
